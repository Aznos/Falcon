import { useState } from "react"
import { Link } from "react-router-dom"
import { login, signup, checkHandle } from "../api"
import { saveSession } from "../auth"
import type { User } from "../types"

interface Props {
    onAuth: (user: User) => void
}

const inputClass = "w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
const labelClass = "text-xs text-zinc-400 uppercase tracking-wide"

export function LoginPage({ onAuth }: Props) {
    const [mode, setMode] = useState<"login" | "signup">("login")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [handle, setHandle] = useState("")
    const [fullName, setFullName] = useState("")
    const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [signupDone, setSignupDone] = useState(false)

    async function handleHandleChange(value: string) {
        setHandle(value)
        if(value.length < 2) { setHandleStatus("idle"); return }
        setHandleStatus("checking")
        const { available } = await checkHandle(value)
        setHandleStatus(available ? "available" : "taken")
    }

    async function handleSubmit() {
        setError("")
        setLoading(true)
        try {
            if(mode === "login") {
                const data = await login(email, password)
                if (data.error) throw new Error(data.error)
                saveSession(data.token, data.refreshToken, data.user)
                onAuth(data.user)
            } else {
                if(handleStatus !== "available") {
                    throw new Error("Please choose an available handle")
                }
                const data = await signup(email, password, handle, fullName || undefined)
                if(data.error) throw new Error(data.error)

                setSignupDone(true)
            }
        } catch(e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    if(signupDone) {
        return (
            <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
                <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                    <h1 className="text-xl font-semibold mb-2">Check your email</h1>
                    <p className="text-sm text-zinc-400 mt-2">
                        We sent a confirmation link to <span className="text-white">{email}</span>.
                        Click it to activate your account, then come back to sign in.
                    </p>
                    <p className="text-xs text-zinc-600 mt-4">Didn't get it? Check spam.</p>
                    <button
                        onClick={() => { setSignupDone(false); setMode("login") }}
                        className="mt-6 text-sm text-zinc-300 underline hover:text-white"
                    >
                        Back to sign in
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
            <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800">
                <h1 className="text-xl font-semibold mb-2">Falcon</h1>
                <p className="text-xs text-zinc-500 mb-6">
                    {mode === "login" ? "Sign in to your account" : "Create your account"}
                </p>

                <div className="space-y-4">
                    {mode === "signup" && (
                        <div>
                            <label className={labelClass}>Full name</label>
                            <input
                                className={inputClass}
                                placeholder="Maddox"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                            />
                        </div>
                    )}

                    <div>
                        <label className={labelClass}>{mode === "login" ? "Email or Falcon address" : "Email"}</label>
                        <input
                            className={inputClass}
                            type="text"
                            placeholder={mode === "login" ? "you@example.com" : "your@email.com"}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>Password</label>
                        <input
                            className={inputClass}
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                        {mode === "login" && (
                            <div className="text-right mt-1">
                                <Link to="/forgot-password" className="text-xs text-zinc-500 hover:text-zinc-300">Forgot password?</Link>
                            </div>
                        )}
                    </div>

                    {mode === "signup" && (
                        <div>
                            <label className={labelClass}>Your Falcon address</label>
                            <div className="flex items-center mt-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden focus-within:border-zinc-500">
                                <input
                                    className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                                    placeholder="yourname"
                                    value={handle}
                                    onChange={e => handleHandleChange(e.target.value)}
                                />
                                <span className="px-3 text-sm text-zinc-500 border-l border-zinc-700">@maddoxh.com</span>
                            </div>
                            {handleStatus === "available" && (
                                <p className="text-xs text-green-400 mt-1">{handle}@maddoxh.com is available</p>
                            )}
                            {handleStatus === "taken" && (
                                <p className="text-xs text-red-400 mt-1">That handle is taken</p>
                            )}
                        </div>
                    )}

                    {error && <p className="text-xs text-red-400">{error}</p>}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                    >
                        {loading ? "..." : mode === "login" ? "Sign in" : "Create account"}
                    </button>

                    <p className="text-xs text-zinc-500 text-center">
                        {mode === "login" ? "No account? " : "Already have one? "}
                        <button
                            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError("") }}
                            className="text-zinc-300 hover:text-white underline"
                        >
                            {mode === "login" ? "Sign up" : "Sign in"}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}
