import { rateLimiter } from "hono-rate-limiter"

export const authRateLimit = rateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
})

export const apiRateLimit = rateLimiter({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-6",
    keyGenerator: (c) => c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? "unknown",
})