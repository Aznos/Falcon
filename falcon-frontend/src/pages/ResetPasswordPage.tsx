import { useState } from "react"
import { useSearchParams, Link } from "react-router-dom"
import { resetPassword } from "../api"

const inputClass = "w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
const labelClass = "text-xs text-zinc-400 uppercase tracking-wide"

export function ResetPasswordPage() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get("token")
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [status, setStatus] = useState<"form" | "loading" | "success">("form")
    const [error, setError] = useState("")

    if(!token) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                    <h1 className="text-xl font-semibold mb-2">Invalid link</h1>
                    <p className="text-sm text-red-400 mb-6">This reset link is invalid or has expired.</p>
                    <Link to="/login" className="text-sm text-white underline">Back to sign in</Link>
                </div>
            </div>
        )
    }

    async function handleSubmit() {
        if(password !== confirm) { setError("Passwords don't match"); return }
        if(password.length < 6) { setError("Password must be at least 6 characters"); return }
        setStatus("loading")
        setError("")
        try {
            const data = await resetPassword(token!, password)
            if(data.error) throw new Error(data.error)
            setStatus("success")
        } catch(e: any) {
            setError(e.message)
            setStatus("form")
        }
    }

    if(status === "success") {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                    <h1 className="text-xl font-semibold mb-2">Password updated</h1>
                    <p className="text-sm text-zinc-400 mb-6">Your password has been reset. You can now sign in.</p>
                    <Link to="/login" className="text-sm text-white underline">Sign in</Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
            <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800">
                <h1 className="text-xl font-semibold mb-2">New password</h1>
                <p className="text-xs text-zinc-500 mb-6">Choose a new password for your account.</p>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>New password</label>
                        <input
                            className={inputClass}
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Confirm password</label>
                        <input
                            className={inputClass}
                            type="password"
                            placeholder="••••••••"
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSubmit()}
                        />
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <button
                        onClick={handleSubmit}
                        disabled={status === "loading" || !password || !confirm}
                        className="w-full py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                    >
                        {status === "loading" ? "..." : "Update password"}
                    </button>
                </div>
            </div>
        </div>
    )
}
