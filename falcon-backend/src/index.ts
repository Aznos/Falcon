import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"
import { startSMTPServer } from "./smtp-server.ts"
import { emailRouter } from "./routes/email.ts"
import {authRouter} from "./routes/auth.ts";
import {apiRateLimit, authRateLimit} from "./middleware/rateLimit.ts";

const app = new Hono()

app.use("*", logger())
app.use("*", cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"]
}))

app.use("/api/auth/*", authRateLimit)
app.use("/api/*", apiRateLimit)

app.get("/api/health", (c) => c.json({ status: "ok" }))
app.route("/api/auth", authRouter)
app.route("/api", emailRouter)

startSMTPServer()

export default {
    port: 3000,
    fetch: app.fetch,
}
