import type { SendStatus } from "../types"

interface Props {
    to: string
    cc: string
    subject: string
    body: string
    status: SendStatus
    error: string
    onChange: (field: "to" | "cc" | "subject" | "body", value: string) => void
    onSend: () => void
}

const inputClass = "w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
const labelClass = "text-xs text-zinc-400 uppercase tracking-wide"

export function ComposeForm({ to, cc, subject, body, status, error, onChange, onSend }: Props) {
    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-lg">
                <h2 className="text-lg font-semibold mb-6">New Message</h2>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>From</label>
                        <p className="mt-1 text-sm text-zinc-300">me@maddoxh.com</p>
                    </div>
                    <div>
                        <label className={labelClass}>To</label>
                        <input
                            className={inputClass}
                            placeholder="recipient@example.com"
                            value={to}
                            onChange={e => onChange("to", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>CC</label>
                        <input
                            className={inputClass}
                            placeholder="cc@example.com, another@example.com"
                            value={cc}
                            onChange={e => onChange("cc", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subject</label>
                        <input
                            className={inputClass}
                            placeholder="Subject"
                            value={subject}
                            onChange={e => onChange("subject", e.target.value)}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Body</label>
                        <textarea
                            className={`${inputClass} resize-none`}
                            rows={8}
                            placeholder="Write your message..."
                            value={body}
                            onChange={e => onChange("body", e.target.value)}
                        />
                    </div>
                    <button
                        onClick={onSend}
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
    )
}
