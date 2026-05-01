import {Hono} from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono()

app.use('*', logger())
app.use('*', cors({ origin: "http://localhost:5173" }))

app.get("/api/health", (c) => c.json({ status: "ok" }))

export default {
    port: 3000,
    fetch: app.fetch
}