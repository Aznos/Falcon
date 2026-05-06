import { Hono } from "hono"
import { supabase } from "../db"
import {sendRawEmail} from "../smtp.ts";

const router = new Hono()

// Use the Supabase auth REST API directly so we never store a user JWT on the
// shared admin client (which would corrupt subsequent service-role DB calls).
async function supabaseSignIn(email: string, password: string) {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY! },
        body: JSON.stringify({ email, password }),
    })
    const json = await res.json() as any
    if(!res.ok || !json.access_token) return null
    return { access_token: json.access_token as string, refresh_token: json.refresh_token as string, user: json.user as { id: string; email: string } }
}

async function supabaseRefresh(refreshToken: string) {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY! },
        body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const json = await res.json() as any
    if(!res.ok || !json.access_token) return null
    return { access_token: json.access_token as string, refresh_token: json.refresh_token as string }
}

router.get("/check-handle/:handle", async (c) => {
    const handle = c.req.param("handle").toLowerCase()
    if(!/^[a-z0-9._-]{2,32}$/.test(handle)) {
        return c.json({ available: false, error: "Invalid handle" })
    }

    const { data } = await supabase
        .from("profiles")
        .select("email_handle")
        .eq("email_handle", handle)
        .single()

    return c.json({ available: !data })
})

router.post("/signup", async (c) => {
    const { email, password, handle, fullName } = await c.req.json()
    if(!email || !password || !handle) {
        return c.json({ error: "Missing fields" }, 400)
    }

    const cleanHandle = handle.toLowerCase().trim()
    if(!/^[a-z0-9._-]{2,32}$/.test(cleanHandle)) {
        return c.json({ error: "Invalid handle - use letters, numbers, dots, dashes only" }, 400)
    }

    const { data: existing } = await supabase
        .from("profiles")
        .select("email_handle")
        .eq("email_handle", cleanHandle)
        .single()

    if(existing) return c.json({ error: "That handle is already taken "}, 409)

    const {data, error} = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { handle: cleanHandle, full_name: fullName ?? null }
    })

    if(error || !data.user) {
        return c.json({ error: error?.message ?? "Signup failed" }, 500)
    }

    const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email_handle: cleanHandle,
        full_name: fullName ?? null,
        email_verified: false,
    })

    if(profileError) {
        await supabase.auth.admin.deleteUser(data.user.id)
        return c.json({ error: "Failed to create profile" }, 500)
    }

    const verifyToken = crypto.randomUUID()
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("profiles")
        .update({ verify_token: verifyToken, verify_token_expires: verifyExpiry })
        .eq("id", data.user.id)

    const verifyUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/verify?token=${verifyToken}`

    sendRawEmail({
        from: "noreply@maddoxh.com",
        fromDisplay: "Falcon",
        to: [email],
        subject: "Verify your Falcon email address",
        body:
            `Hi ${fullName ?? cleanHandle},\n\n` +
            `Welcome to Falcon! Your address is ${cleanHandle}@maddoxh.com\n\n` +
            `Please verify your recovery email by clicking the link below:\n\n` +
            `${verifyUrl}\n\n` +
            `This link expires in 24 hours.\n\n` +
            `If you didn't sign up for Falcon, ignore this email.\n\n` +
            `- Falcon`,
    }).catch(e => console.error("[Mailer] Failed to send verification email:", e))

    const session = await supabaseSignIn(email, password)
    if(!session) return c.json({ error: "Signup succeeded but login failed" }, 500)

    return c.json({
        token: session.access_token,
        refreshToken: session.refresh_token,
        needsVerification: true,
        user: {
            id: data.user.id,
            email: data.user.email,
            handle: cleanHandle,
            fullName: fullName ?? null,
            emailAddress: `${cleanHandle}@maddoxh.com`,
            emailConfirmed: false,
        }
    })
})

router.post("/login", async (c) => {
    const { email, password } = await c.req.json()

    const session = await supabaseSignIn(email, password)
    if(!session) {
        return c.json({ error: "Invalid email or password" }, 401)
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("email_handle, full_name, email_verified")
        .eq("id", session.user.id)
        .single()

    return c.json({
        token: session.access_token,
        refreshToken: session.refresh_token,
        user: {
            id: session.user.id,
            email: session.user.email,
            handle: profile?.email_handle,
            fullName: profile?.full_name,
            emailAddress: `${profile?.email_handle}@maddoxh.com`,
            emailConfirmed: profile?.email_verified ?? false,
        }
    })
})

router.post("/refresh", async (c) => {
    const { refreshToken } = await c.req.json()

    const session = await supabaseRefresh(refreshToken)
    if(!session) {
        return c.json({ error: "Invalid refresh token" }, 401)
    }

    return c.json({ token: session.access_token, refreshToken: session.refresh_token })
})

router.post("/resend-confirmation", async (c) => {
    const { email } = await c.req.json()

    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const authUser = authUsers?.users.find(u => u.email === email)
    if(!authUser) return c.json({ ok: true })

    const verifyToken = crypto.randomUUID()
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("profiles")
        .update({ verify_token: verifyToken, verify_token_expires: verifyExpiry })
        .eq("id", authUser.id)

    const verifyUrl = `${process.env.FRONTEND_URL ?? "http://localhost:5173"}/verify?token=${verifyToken}`

    sendRawEmail({
        from: "noreply@maddoxh.com",
        fromDisplay: "Falcon",
        to: [email],
        subject: "Verify your Falcon email address",
        body: `Click here to verify your email:\n\n${verifyUrl}\n\nExpires in 24 hours.\n\n— Falcon`,
    }).catch(console.error)

    return c.json({ ok: true })
})

router.get("/verify-email", async (c) => {
    const token = c.req.query("token")
    if(!token) return c.json({ error: "Missing token" }, 400)

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, verify_token_expires")
        .eq("verify_token", token)
        .single()

    if(error || !profile) return c.json({ error: "Invalid token" }, 400)

    if(new Date(profile.verify_token_expires) < new Date()) {
        return c.json({ error: "Token expired" }, 400)
    }

    await supabase.from("profiles").update({
        email_verified: true,
        verify_token: null,
        verify_token_expires: null,
    }).eq("id", profile.id)

    return c.json({ ok: true })
})

export { router as authRouter }