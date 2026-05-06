import type { Email } from "../types"

interface Props {
    email: Email | null
    emptyMessage: string
    onReply?: (email: Email) => void
}

export function EmailDetail({ email, emptyMessage, onReply }: Props) {
    if(!email) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-zinc-600 text-sm">{emptyMessage}</p>
            </div>
        )
    }

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{email.subject || "(no subject)"}</h2>
            <div className="flex gap-6 text-xs text-zinc-400 mb-6">
                {onReply && <span>From: <span className="text-zinc-300">{email.from_address}</span></span>}
                <span>To: <span className="text-zinc-300">{email.to_address}</span></span>
                <span>{new Date(email.received_at).toLocaleString()}</span>
            </div>
            <div className="border-t border-zinc-800 pt-6">
                <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{email.body}</p>
            </div>
            {onReply && (
                <button
                    onClick={() => onReply(email)}
                    className="mt-4 px-4 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                    Reply
                </button>
            )}
        </div>
    )
}
