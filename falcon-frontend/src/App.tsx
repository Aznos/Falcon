import {useState} from "react";

export default function App() {
    const [to, setTo] = useState("")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
    const [error, setError] = useState("")

    async function handleSend() {
        setStatus("sending")
        setError("")
        try {
            const res = await fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, subject, body }),
            })

            const data = await res.json()
            if(!res.ok) throw new Error(data.error)
            setStatus("sent")
        } catch(e: any) {
            setError(e.message)
            setStatus("error")
        }
    }

    return (
        <div className={"min-h-screen bg-zinc-900 text-white flex items-center justify-center"}>
            <div className={"w-full max-w-lg p-8 bg-zinc-900 rounded-xl border border-zinc-800"}>
                <h1 className={"text-xl font-semibold mb-6"}>Falcon</h1>

                <div className={"space-y-4"}>
                    <div>
                        <label className={"text-xs text-zinc-400 uppercase tracking-wide"}>From</label>
                        <p className={"mt-1 text-sm text-zinc-300"}>me@maddoxh.com</p>
                    </div>

                    <div>
                        <label className={"text-xs text-zinc-400 uppercase tracking-wide"}>To</label>
                        <input
                            className={"w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"}
                            placeholder="recipient@example.com"
                            value={to}
                            onChange={e => setTo(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={"text-xs text-zinc-400 uppercase tracking-wide"}>Subject</label>
                        <input
                            className={"w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"}
                            placeholder="Subject"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className={"text-xs text-zinc-400 uppercase tracking-wide"}>Body</label>
                        <textarea
                            className={"w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"}
                            rows={6}
                            placeholder="Write your message.."
                            value={body}
                            onChange={e => setBody(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={status === "sending"}
                        className={"w-full py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"}
                    >
                        {status === "sending" ? "Sending.." : "Send"}
                    </button>

                    {status === "sent" && (
                        <p className={"text-sm text-green-400 text-center"}>Email sent!</p>
                    )}
                    {status === "error" && (
                        <p className={"text-sm text-red-400 text-center"}>{error}</p>
                    )}
                </div>
            </div>
        </div>
    )
}