import { Hono } from "hono"
import { supabase } from "../db"
import { sendRawEmail } from "../smtp.ts"
import { supabaseSignIn, supabaseRefresh } from "../utils/auth-helpers.ts"
import { verificationEmail, resendVerificationEmail, passwordResetEmail } from "../utils/email-templates.ts"
import { DOMAIN } from "../utils/config.ts"

const router = new Hono()

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

    sendRawEmail(verificationEmail(email, verifyToken, cleanHandle, fullName ?? null))
        .catch(e => console.error("[Mailer] Failed to send verification email:", e))

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
            emailAddress: `${cleanHandle}@${DOMAIN}`,
            emailConfirmed: false,
        }
    })
})

router.post("/login", async (c) => {
    let { email, password } = await c.req.json()

    if(email?.toLowerCase().endsWith(`@${DOMAIN}`)) {
        const handle = email.split("@")[0].toLowerCase()
        const { data: profile } = await supabase.from("profiles").select("id").eq("email_handle", handle).single()
        if(profile) {
            const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
            if(userData?.user?.email) email = userData.user.email
        }
    }

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
            emailAddress: `${profile?.email_handle}@${DOMAIN}`,
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

    sendRawEmail(resendVerificationEmail(email, verifyToken))
        .catch(console.error)

    return c.json({ ok: true })
})

router.post("/forgot-password", async (c) => {
    const { email } = await c.req.json()
    if(!email) return c.json({ ok: true })

    let userId: string | null = null
    let sendTo: string | null = null

    if(email.toLowerCase().endsWith(`@${DOMAIN}`)) {
        const handle = email.split("@")[0].toLowerCase()
        const { data: profile } = await supabase.from("profiles").select("id").eq("email_handle", handle).single()
        if(profile) {
            const { data: userData } = await supabase.auth.admin.getUserById(profile.id)
            if(userData?.user?.email) {
                userId = profile.id
                sendTo = userData.user.email
            }
        }
    } else {
        const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 })
        const authUser = authUsers?.users.find(u => u.email === email)
        if(authUser?.email) {
            userId = authUser.id
            sendTo = authUser.email
        }
    }

    if(!userId || !sendTo) return c.json({ ok: true })

    const resetToken = crypto.randomUUID()
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString()

    const { error: updateError } = await supabase.from("profiles")
        .update({ reset_token: resetToken, reset_token_expires: resetExpiry })
        .eq("id", userId)

    if(updateError) {
        console.error("[Reset] Failed to store reset token:", updateError.message)
        return c.json({ ok: true })
    }

    sendRawEmail(passwordResetEmail(sendTo, resetToken))
        .catch(console.error)

    return c.json({ ok: true })
})

router.post("/reset-password", async (c) => {
    const { token, password } = await c.req.json()
    if(!token || !password) return c.json({ error: "Missing fields" }, 400)

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, reset_token_expires")
        .eq("reset_token", token)
        .single()

    if(error || !profile) return c.json({ error: "Invalid or expired link" }, 400)

    if(new Date(profile.reset_token_expires) < new Date()) {
        return c.json({ error: "This reset link has expired" }, 400)
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(profile.id, { password })
    if(updateError) return c.json({ error: "Failed to update password" }, 500)

    await supabase.from("profiles").update({
        reset_token: null,
        reset_token_expires: null,
    }).eq("id", profile.id)

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
