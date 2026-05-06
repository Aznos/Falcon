import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { startSMTPServer } from "./smtp-server.ts"
import { emailRouter } from "./routes/email.ts"

const app = new Hono()

app.use("*", logger())
app.use("*", cors({ origin: "http://localhost:5173" }))

app.get("/api/health", (c) => c.json({ status: "ok" }))
app.route("/api", emailRouter)

startSMTPServer()

export default {
    port: 3000,
    fetch: app.fetch,
}
