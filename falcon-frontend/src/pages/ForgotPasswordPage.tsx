import { useState } from "react"
import { Link } from "react-router-dom"
import { forgotPassword } from "../api"

const inputClass = "w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
const labelClass = "text-xs text-zinc-400 uppercase tracking-wide"

export function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    async function handleSubmit() {
        if(!email) return
        setLoading(true)
        setError("")
        try {
            await forgotPassword(email)
            setSent(true)
        } catch(e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    if(sent) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                    <h1 className="text-xl font-semibold mb-2">Check your email</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        If an account exists for <span className="text-white">{email}</span>, we've sent a reset link to the backup email address on file. It expires in 1 hour.
                    </p>
                    <p className="text-xs text-zinc-600 mt-3">Didn't get it? Check spam.</p>
                    <Link to="/login" className="mt-6 block text-sm text-zinc-300 underline hover:text-white">
                        Back to sign in
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
            <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800">
                <h1 className="text-xl font-semibold mb-2">Reset password</h1>
                <p className="text-xs text-zinc-500 mb-6">Enter your email or Falcon address. We'll send a reset link to the backup email address on file.</p>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Email or Falcon address</label>
                        <input
                            className={inputClass}
                            type="text"
                            placeholder="you@example.com or you@maddoxh.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSubmit()}
                            autoFocus
                        />
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !email}
                        className="w-full py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "..." : "Send reset link"}
                    </button>
                    <p className="text-xs text-zinc-500 text-center">
                        <Link to="/login" className="text-zinc-300 hover:text-white underline">Back to sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}
