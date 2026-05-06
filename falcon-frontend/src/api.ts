import type { Email } from "./types"

export async function fetchInbox(): Promise<Email[]> {
    const res = await fetch("/api/inbox?folder=inbox")
    return res.json()
}

export async function fetchSent(): Promise<Email[]> {
    const res = await fetch("/api/sent")
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

export async function sendEmail(params: SendParams): Promise<{ ok?: boolean; messageID?: string; error?: string }> {
    const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    })
    return res.json()
}
