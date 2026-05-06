import type { Email } from "./types"
import {clearSession, getToken} from "./auth.ts";

async function authedFetch(url: string, options: RequestInit = {}) {
    const token = getToken()
    const res = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    })

    if(res.status === 401) {
        clearSession()
        window.location.reload()
    }

    return res
}

export async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    })

    return res.json()
}

export async function signup(email: string, password: string, handle: string, fullName?: string) {
    const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, handle, fullName })
    })

    return res.json()
}

export async function checkHandle(handle: string) {
    const res = await fetch(`/api/auth/check-handle/${handle}`)
    return res.json()
}

export async function fetchInbox(): Promise<Email[]> {
    const res = await fetch("/api/inbox?folder=inbox")
    return res.json()
}

export async function fetchSent(): Promise<Email[]> {
    const res = await fetch("/api/sent")
    return res.json()
}

export async function sendEmail(params: SendParams): Promise<{ ok?: boolean; messageID?: string; error?: string }> {
    const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    })
    return res.json()
}

export interface SendParams {
    to: string
    cc?: string
    subject: string
    body: string
    inReplyTo?: string
    references?: string[]
}