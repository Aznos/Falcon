import { useState } from "react"

interface Props {
    email: string
    onResend: () => Promise<void>
}

export function VerificationBanner({ email, onResend }: Props) {
    const [sent, setSent] = useState(false)
    const [loading, setLoading] = useState(false)

    async function handleResend() {
        setLoading(true)
        await onResend()
        setSent(true)
        setLoading(false)
    }

    return (
        <div className="bg-amber-950 border-b border-amber-800 px-4 py-2 flex items-center justify-between text-sm">
            <p className="text-amber-200">
                Please verify your email address — check <span className="font-medium">{email}</span> for a confirmation link.
            </p>
            <button
                onClick={handleResend}
                disabled={loading || sent}
                className="ml-4 text-xs text-amber-300 underline hover:text-white disabled:opacity-50 shrink-0"
            >
                {sent ? "Sent!" : loading ? "Sending..." : "Resend"}
            </button>
        </div>
    )
}