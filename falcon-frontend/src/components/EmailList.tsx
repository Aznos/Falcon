import type { Email } from "../types"

interface Props {
    title: string
    emails: Email[]
    loading: boolean
    selected: Email | null
    emptyMessage: string
    displayAddress: (email: Email) => string
    onSelect: (email: Email) => void
    onRefresh: () => void
}

export function EmailList({ title, emails, loading, selected, emptyMessage, displayAddress, onSelect, onRefresh }: Props) {
    return (
        <div className="w-72 border-r border-zinc-800 overflow-y-auto shrink-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <p className="text-sm font-medium">{title}</p>
                <button onClick={onRefresh} className="text-xs text-zinc-500 hover:text-white transition-colors">
                    Refresh
                </button>
            </div>

            {loading ? (
                <p className="text-xs text-zinc-500 p-4">Loading...</p>
            ) : emails.length === 0 ? (
                <p className="text-xs text-zinc-500 p-4">{emptyMessage}</p>
            ) : (
                emails.map(email => (
                    <div
                        key={email.id}
                        onClick={() => onSelect(email)}
                        className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors ${selected?.id === email.id ? "bg-zinc-900" : ""}`}
                    >
                        <p className="text-sm font-medium truncate">{displayAddress(email)}</p>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{email.subject || "(no subject)"}</p>
                        <p className="text-xs text-zinc-600 mt-1">{new Date(email.received_at).toLocaleDateString()}</p>
                    </div>
                ))
            )}
        </div>
    )
}
