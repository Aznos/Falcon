export interface Email {
    id: string
    from_address: string
    to_address: string
    subject: string
    body: string
    received_at: string
    message_id: string
}

export type View = "inbox" | "sent" | "compose"
export type SendStatus = "idle" | "sending" | "sent" | "error"
