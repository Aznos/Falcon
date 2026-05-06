import { Hono } from "hono"
import { sendRawEmail } from "../smtp.ts"
import { supabase } from "../db.ts"

const router = new Hono()

router.post("/send", async (c) => {
    const { to, cc, subject, body, inReplyTo, references } = await c.req.json()

    if(!to || !subject || !body) {
        return c.json({ error: "Missing fields" }, 400)
    }

    const toList: string[] = Array.isArray(to) ? to : to.split(",").map((s: string) => s.trim()).filter(Boolean)
    const ccList: string[] = cc ? (Array.isArray(cc) ? cc : cc.split(",").map((s: string) => s.trim()).filter(Boolean)) : []

    try {
        const messageID = await sendRawEmail({
            from: "me@maddoxh.com",
            to: toList,
            cc: ccList.length ? ccList : undefined,
            subject,
            body,
            inReplyTo,
            references,
        })

        const { error: insertError } = await supabase.from("emails").insert({
            from_address: "me@maddoxh.com",
            to_address: to,
            subject,
            body,
            folder: "sent",
            message_id: messageID,
        })

        if(insertError) throw new Error(`Failed to save sent email: ${insertError.message}`)

        return c.json({ ok: true, messageID })
    } catch(err: any) {
        return c.json({ error: err.message }, 500)
    }
})

router.get("/sent", async (c) => {
    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("folder", "sent")
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message }, 500)
    return c.json(data)
})

router.get("/inbox", async (c) => {
    const folder = c.req.query("folder") ?? "inbox"
    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("folder", folder)
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message }, 500)
    return c.json(data)
})

export { router as emailRouter }
