import { Hono } from "hono"
import { supabase } from "../db"

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
        email_confirm: false,
        user_metadata: { handle: cleanHandle, full_name: fullName ?? null }
    })

    if(error || !data.user) {
        return c.json({ error: error?.message ?? "Signup failed" }, 500)
    }

    const { error: profileError } = await supabase.from("profiles").insert({
        id: data.user.id,
        email_handle: cleanHandle,
        full_name: fullName ?? null
    })

    if(profileError) {
        await supabase.auth.admin.deleteUser(data.user.id)
        return c.json({ error: "Failed to create profile" }, 500)
    }

    return c.json({ ok: true, emailAddress: `${cleanHandle}@maddoxh.com`, needsConfirmation: true })
})

router.post("/login", async (c) => {
    const { email, password } = await c.req.json()

    const { data, error} = await supabase.auth.signInWithPassword({ email, password })
    if(error || !data.session) {
        return c.json({ error: "Invalid email or password" }, 401)
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("email_handle, full_name")
        .eq("id", data.user.id)
        .single()

    return c.json({
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
            id: data.user.id,
            email: data.user.email,
            handle: profile?.email_handle,
            fullName: profile?.full_name,
            emailAddress: `${profile?.email_handle}@maddoxh.com`,
            emailConfirmed: !!data.user.email_confirmed_at
        }
    })
})

router.post("/refresh", async (c) => {
    const { refreshToken } = await c.req.json()

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
    if(error || !data.session) {
        return c.json({ error: "Invalid refresh token" }, 401)
    }

    return c.json({ token: data.session.access_token, refreshToken: data.session.refresh_token })
})

router.post("/resend-confirmation", async (c) => {
    const { email } = await c.req.json()
    const { error } = await supabase.auth.resend({ type: "signup", email })
    if(error) return c.json({ error: error.message }, 500)
    return c.json({ ok: true })
})

export { router as authRouter }