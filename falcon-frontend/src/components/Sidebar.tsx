import { useLocation, Link } from "react-router-dom"

interface Props {
    inboxCount: number
    userEmail: string
    onLogout: () => void
}

export function Sidebar({ inboxCount, userEmail, onLogout }: Props) {
    const { pathname } = useLocation()

    function NavLink({ label, to, badge }: { label: string; to: string; badge?: number }) {
        return (
            <Link
                to={to}
                className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${pathname === to ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
            >
                {label}
                {badge != null && badge > 0 && (
                    <span className="ml-2 text-xs bg-zinc-700 px-1.5 py-0.5 rounded-full">{badge}</span>
                )}
            </Link>
        )
    }

    return (
        <div className="w-48 border-r border-zinc-800 p-4 flex flex-col gap-1 shrink-0">
            <p className="text-sm font-semibold text-white mb-4">Falcon</p>
            <p className="text-xs text-zinc-500 mb-2">{userEmail}</p>
            <NavLink label="Inbox" to="/inbox" badge={inboxCount} />
            <NavLink label="Sent" to="/sent" />
            <NavLink label="Compose" to="/compose" />
            <NavLink label="Trash" to="/trash" />
            <button onClick={onLogout} className="text-left text-xs px-3 py-2 text-zinc-600 hover:text-zinc-400 transition-colors mt-auto">
                Sign out
            </button>
        </div>
    )
}
