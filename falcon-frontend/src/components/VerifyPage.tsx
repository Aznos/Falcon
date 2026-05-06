import { useEffect, useRef, useState } from "react"
import { updateUser } from "../auth"

export function VerifyPage() {
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [message, setMessage] = useState("")
    const hasFetched = useRef(false)

    useEffect(() => {
        if(hasFetched.current) return
        hasFetched.current = true

        const token = new URLSearchParams(window.location.search).get("token")
        if(!token) {
            setStatus("error")
            setMessage("Invalid verification link.")
            return
        }

        fetch(`/api/auth/verify-email?token=${token}`)
            .then(r => r.json())
            .then(data => {
                if(data.ok) {
                    updateUser({ emailConfirmed: true })
                    setStatus("success")
                } else {
                    setStatus("error")
                    setMessage(data.error ?? "Verification failed.")
                }
            })
            .catch(() => {
                setStatus("error")
                setMessage("Something went wrong.")
            })
    }, [])

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
            <div className="w-full max-w-sm p-8 bg-zinc-900 rounded-xl border border-zinc-800 text-center">
                {status === "loading" && <p className="text-zinc-400">Verifying...</p>}
                {status === "success" && (
                    <>
                        <h1 className="text-xl font-semibold mb-2">Email verified</h1>
                        <p className="text-sm text-zinc-400 mb-6">Your email address has been confirmed.</p>
                        <a href="/" className="text-sm text-white underline">Go to inbox</a>
                    </>
                )}
                {status === "error" && (
                    <>
                        <h1 className="text-xl font-semibold mb-2">Verification failed</h1>
                        <p className="text-sm text-red-400 mb-6">{message}</p>
                        <a href="/" className="text-sm text-white underline">Go back</a>
                    </>
                )}
            </div>
        </div>
    )
}