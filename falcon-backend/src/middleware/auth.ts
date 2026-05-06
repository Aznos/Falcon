import { createMiddleware} from "hono/factory"
import { createClient } from "@supabase/supabase-js"

export const authMiddleware = createMiddleware(async (c, next) => {
    const authHeader = c.req.header("Authorization")
    if(!authHeader?.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401)
    }

    const token = authHeader.slice(7)
    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    if(error || !user) {
        return c.json({ error: "Unauthorized" }, 401)
    }

    c.set("user", user)
    c.set("supabase", supabase)

    await next()
})