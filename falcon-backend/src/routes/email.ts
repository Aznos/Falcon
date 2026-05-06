import { Hono } from "hono"
import type { SupabaseClient, User } from "@supabase/supabase-js"
import { sendRawEmail } from "../smtp.ts"
import { authMiddleware} from "../middleware/auth.ts";

type Variables = {
    user: User
    supabase: SupabaseClient
}

const router = new Hono<{ Variables: Variables }>()

router.use("*", authMiddleware)

router.post("/send", async (c) => {
    const user = c.get("user")
    const supabase = c.get("supabase")
    const { to, cc, subject, body, inReplyTo, references } = await c.req.json()

    if(!to || !subject || !body) {
        return c.json({ error: "Missing fields" }, 400)
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("email_handle, full_name")
        .eq("id", user.id)
        .single()

    if(!profile) return c.json({ error: "Profile not found" }, 404)

    const fromAddress = `${profile.email_handle}@maddoxh.com`
    const fromDisplay = profile.full_name ?? profile.email_handle

    const toList: string[] = Array.isArray(to) ? to : to.split(",").map((s: string) => s.trim()).filter(Boolean)
    const ccList: string[] = cc ? (Array.isArray(cc) ? cc : cc.split(",").map((s: string) => s.trim()).filter(Boolean)) : []

    try {
        const messageID = await sendRawEmail({
            from: fromAddress,
            fromDisplay,
            to: toList,
            cc: ccList.length ? ccList : undefined,
            subject,
            body,
            inReplyTo,
            references,
        })

        await supabase.from("emails").insert({
            owner_id: user.id,
            from_address: fromAddress,
            to_address: toList.join(", "),
            subject,
            body,
            folder: "sent",
            message_id: messageID,
        })

        return c.json({ ok: true, messageID })
    } catch(err: any) {
        return c.json({ error: err.message }, 500)
    }
})

router.get("/sent", async (c) => {
    const user = c.get("user")
    const supabase = c.get("supabase")

    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("owner_id", user.id)
        .eq("folder", "sent")
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message }, 500)
    return c.json(data)
})

router.get("/inbox", async (c) => {
    const user = c.get("user")
    const supabase = c.get("supabase")

    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("owner_id", user.id)
        .eq("folder", "inbox")
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message }, 500)
    return c.json(data)
})

export { router as emailRouter }
