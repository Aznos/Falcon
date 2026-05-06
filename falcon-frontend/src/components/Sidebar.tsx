import type { View } from "../types"

interface Props {
    view: View
    inboxCount: number
    onNavigate: (view: View) => void,
    userEmail: string,
    onLogout: () => void
}

export function Sidebar({ view, inboxCount, onNavigate, userEmail, onLogout }: Props) {
    function NavButton({ label, target, badge }: { label: string; target: View; badge?: number }) {
        return (
            <button
                onClick={() => onNavigate(target)}
                className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${view === target ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
                {label}
                {badge != null && badge > 0 && (
                    <span className="ml-2 text-xs bg-zinc-700 px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
            </button>
        )
    }

    return (
        <div className="w-48 border-r border-zinc-800 p-4 flex flex-col gap-1 shrink-0">
            <p className="text-sm font-semibold text-white mb-4">Falcon</p>
            <p className="text-xs text-zinc-500 mb-1">me@maddoxh.com</p>
            <p className="text-xs text-zinc-500 mb-1">{userEmail}</p>
            <button onClick={onLogout} className="text-left text-xs px-3 py-2 text-zinc-600 hover:text-zinc-400 transition-colors mt-auto">
                Sign out
            </button>
            <NavButton label="Inbox" target="inbox" badge={inboxCount} />
            <NavButton label="Sent" target="sent" />
            <NavButton label="Compose" target="compose" />
        </div>
    )
}
