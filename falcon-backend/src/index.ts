import {Hono} from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import {sendRawEmail} from "./smtp.ts";
import {startSMTPServer} from "./smtp-server.ts";
import {supabase} from "./db.ts";

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: "http://localhost:5173" }))

startSMTPServer()

app.get("/api/health", (c) => c.json({ status: "ok" }))

app.post("/api/send", async (c) => {
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
            references
        })

        await supabase.from("emails").insert({
            from_address: "me@maddoxh.com",
            to_address: to,
            subject,
            body,
            folder: "sent",
            messageID: messageID
        })

        return c.json({ ok: true, messageID })
    } catch(err: any) {
        return c.json({ error: err.message }, 500)
    }
})

app.get("/api/sent", async (c) => {
    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("from_address", "me@maddoxh.com")
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message }, 500)
    return c.json(data)
})

app.get("/api/inbox", async (c) => {
    const folder = c.req.query("folder") ?? "inbox"
    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .eq("folder", folder)
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message}, 500)
    return c.json(data)
})

export default {
    port: 3000,
    fetch: app.fetch
}