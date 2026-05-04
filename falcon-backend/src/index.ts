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
    const { to, subject, body } = await c.req.json()

    if(!to || !subject || !body) {
        return c.json({ error: "Missing fields" }, 400)
    }

    try {
        await sendRawEmail({from: "me@maddoxh.com", to, subject, body})
        return c.json({ ok: true })
    } catch(err: any) {
        return c.json({ error: err.message }, 500)
    }
})

app.get("/api/inbox", async (c) => {
    const { data, error } = await supabase
        .from("emails")
        .select("*")
        .order("received_at", { ascending: false })

    if(error) return c.json({ error: error.message}, 500)
    return c.json(data)
})

export default {
    port: 3000,
    fetch: app.fetch
}