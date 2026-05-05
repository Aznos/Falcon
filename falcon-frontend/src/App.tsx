import {useEffect, useState} from "react";

interface Email {
    id: string
    from_address: string
    to_address: string
    subject: string
    body: string
    received_at: string,
    message_id: string
}

export default function App() {
    const [view, setView] = useState<"inbox" | "sent" | "compose">("inbox")
    const [emails, setEmails] = useState<Email[]>([])
    const [sentEmails, setSentEmails] = useState<Email[]>([])
    const [selected, setSelected] = useState<Email | null>(null)
    const [loading, setLoading] = useState<boolean>(true)

    const [to, setTo] = useState("")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
    const [error, setError] = useState("")

    const [cc, setCc] = useState("")
    const [inReplyTo, setInReplyTo] = useState<string | undefined>()
    const [references, setReferences] = useState<string[]>([])
    const [folder, setFolder] = useState<"inbox" | "sent">("inbox")

    useEffect(() => {
        if(view === "inbox") fetchInbox()
        if(view === "sent") fetchSent()
    }, [view, folder])

    async function fetchInbox() {
        setLoading(true)
        const res = await fetch(`/api/inbox?folder=${folder}`)
        const data = await res.json()
        setEmails(data)
        setLoading(false)
    }

    function handleReply(email: Email) {
        setTo(email.from_address)
        setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`)
        setBody(`\n\n--- Original message ---\nFrom: ${email.from_address}\n${email.body}`)
        setInReplyTo(email.message_id ?? undefined)
        setReferences(email.message_id ? [email.message_id] : [])
        setView("compose")
    }

    async function fetchSent() {
        setLoading(true)
        const res = await fetch("/api/sent")
        const data = await res.json()
        setSentEmails(data)
        setLoading(false)
    }

    async function handleSend() {
        setStatus("sending")
        setError("")
        try {
            const res = await fetch("/api/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to, cc: cc || undefined, subject, body, inReplyTo, references }),
            })

            const data = await res.json()
            if(!res.ok) throw new Error(data.error)
            setTo(""); setCc(""); setSubject(""); setBody("")
            setStatus("sent")
        } catch(e: any) {
            setError(e.message)
            setStatus("error")
        }
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex">

            {/* Sidebar */}
            <div className="w-48 border-r border-zinc-800 p-4 flex flex-col gap-1 shrink-0">
                <p className="text-sm font-semibold text-white mb-4">Falcon</p>
                <p className="text-xs text-zinc-500 mb-1">me@maddoxh.com</p>
                <button
                    onClick={() => { setView("inbox"); setSelected(null) }}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${view === "inbox" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                    Inbox
                    {emails.length > 0 && (
                        <span className="ml-2 text-xs bg-zinc-700 px-1.5 py-0.5 rounded-full">{emails.length}</span>
                    )}
                </button>
                <button
                    onClick={() => { setView("sent"); setSelected(null) }}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${view === "sent" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                    Sent
                </button>
                <button
                    onClick={() => { setView("compose"); setSelected(null); setStatus("idle") }}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition-colors ${view === "compose" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"}`}
                >
                    Compose
                </button>
            </div>

            {/* Main */}
            <div className="flex flex-1 overflow-hidden">

                {/* Inbox list */}
                {view === "inbox" && (
                    <div className="w-72 border-r border-zinc-800 overflow-y-auto shrink-0">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <p className="text-sm font-medium">Inbox</p>
                            <button onClick={fetchInbox} className="text-xs text-zinc-500 hover:text-white transition-colors">Refresh</button>
                        </div>

                        {loading ? (
                            <p className="text-xs text-zinc-500 p-4">Loading...</p>
                        ) : emails.length === 0 ? (
                            <p className="text-xs text-zinc-500 p-4">No emails yet.</p>
                        ) : (
                            emails.map(email => (
                                <div
                                    key={email.id}
                                    onClick={() => setSelected(email)}
                                    className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors ${selected?.id === email.id ? "bg-zinc-900" : ""}`}
                                >
                                    <p className="text-sm font-medium truncate">{email.from_address}</p>
                                    <p className="text-xs text-zinc-400 truncate mt-0.5">{email.subject || "(no subject)"}</p>
                                    <p className="text-xs text-zinc-600 mt-1">{new Date(email.received_at).toLocaleDateString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Email detail */}
                {view === "inbox" && (
                    <div className="flex-1 p-8 overflow-y-auto">
                        {selected ? (
                            <div>
                                <h2 className="text-lg font-semibold mb-4">{selected.subject || "(no subject)"}</h2>
                                <div className="flex gap-6 text-xs text-zinc-400 mb-6">
                                    <span>From: <span className="text-zinc-300">{selected.from_address}</span></span>
                                    <span>To: <span className="text-zinc-300">{selected.to_address}</span></span>
                                    <span>{new Date(selected.received_at).toLocaleString()}</span>
                                </div>
                                <div className="border-t border-zinc-800 pt-6">
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
                                </div>
                                <button
                                    onClick={() => handleReply(selected)}
                                    className="mt-4 px-4 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                                >
                                    Reply
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-zinc-600 text-sm">Select an email to read</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Sent list */}
                {view === "sent" && (
                    <div className="w-72 border-r border-zinc-800 overflow-y-auto shrink-0">
                        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                            <p className="text-sm font-medium">Sent</p>
                            <button onClick={fetchSent} className="text-xs text-zinc-500 hover:text-white transition-colors">Refresh</button>
                        </div>

                        {loading ? (
                            <p className="text-xs text-zinc-500 p-4">Loading...</p>
                        ) : sentEmails.length === 0 ? (
                            <p className="text-xs text-zinc-500 p-4">No sent emails.</p>
                        ) : (
                            sentEmails.map(email => (
                                <div
                                    key={email.id}
                                    onClick={() => setSelected(email)}
                                    className={`p-4 border-b border-zinc-800 cursor-pointer hover:bg-zinc-900 transition-colors ${selected?.id === email.id ? "bg-zinc-900" : ""}`}
                                >
                                    <p className="text-sm font-medium truncate">{email.to_address}</p>
                                    <p className="text-xs text-zinc-400 truncate mt-0.5">{email.subject || "(no subject)"}</p>
                                    <p className="text-xs text-zinc-600 mt-1">{new Date(email.received_at).toLocaleDateString()}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* Sent detail */}
                {view === "sent" && (
                    <div className="flex-1 p-8 overflow-y-auto">
                        {selected ? (
                            <div>
                                <h2 className="text-lg font-semibold mb-4">{selected.subject || "(no subject)"}</h2>
                                <div className="flex gap-6 text-xs text-zinc-400 mb-6">
                                    <span>To: <span className="text-zinc-300">{selected.to_address}</span></span>
                                    <span>{new Date(selected.received_at).toLocaleString()}</span>
                                </div>
                                <div className="border-t border-zinc-800 pt-6">
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{selected.body}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-zinc-600 text-sm">Select a message to read</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Compose */}
                {view === "compose" && (
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-lg">
                            <h2 className="text-lg font-semibold mb-6">New Message</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-400 uppercase tracking-wide">From</label>
                                    <p className="mt-1 text-sm text-zinc-300">me@maddoxh.com</p>
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 uppercase tracking-wide">To</label>
                                    <input
                                        className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                                        placeholder="recipient@example.com"
                                        value={to}
                                        onChange={e => setTo(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 uppercase tracking-wide">CC</label>
                                    <input
                                        className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                                        placeholder="cc@example.com, another@example.com"
                                        value={cc}
                                        onChange={e => setCc(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Subject</label>
                                    <input
                                        className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
                                        placeholder="Subject"
                                        value={subject}
                                        onChange={e => setSubject(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-zinc-400 uppercase tracking-wide">Body</label>
                                    <textarea
                                        className="w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                                        rows={8}
                                        placeholder="Write your message..."
                                        value={body}
                                        onChange={e => setBody(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={handleSend}
                                    disabled={status === "sending"}
                                    className="px-6 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                                >
                                    {status === "sending" ? "Sending..." : "Send"}
                                </button>
                                {status === "sent" && <p className="text-sm text-green-400">Sent.</p>}
                                {status === "error" && <p className="text-sm text-red-400">{error}</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}