export interface Email {
    id: string
    from_address: string
    to_address: string
    subject: string
    body: string
    received_at: string
    message_id: string
}

export interface User {
    id: string
    email: string
    handle: string
    fullName: string | null
    emailAddress: string
    emailConfirmed: boolean
}

export type View = "inbox" | "sent" | "compose" | "trash"
export type SendStatus = "idle" | "sending" | "sent" | "error"
