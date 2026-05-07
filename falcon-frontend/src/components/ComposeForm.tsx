import type { SendStatus } from "../types"

interface ReplyContext {
    fromAddress: string
    date: string
    displayBody: string
}

interface Props {
    to: string
    cc: string
    subject: string
    body: string
    status: SendStatus
    error: string
    replyContext?: ReplyContext
    onChange: (field: "to" | "cc" | "subject" | "body", value: string) => void
    onSend: () => void
    userEmail: string
}

const inputClass = "w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
const labelClass = "text-xs text-zinc-400 uppercase tracking-wide"

export function ComposeForm({ to, cc, subject, body, status, error, replyContext, onChange, onSend, userEmail }: Props) {
    return (
        <div className="flex-1 p-8 overflow-y-auto">
            <div className="max-w-lg">
                <h2 className="text-lg font-semibold mb-1">
                    {replyContext ? "Reply" : "New Message"}
                </h2>
                {replyContext && (
                    <p className="text-xs text-zinc-500 mb-5">
                        to <span className="text-zinc-300">{replyContext.fromAddress}</span>
                        <span className="text-zinc-600"> · {replyContext.date}</span>
                    </p>
                )}
                {!replyContext && <div className="mb-5" />}

                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>From</label>
                        <p className="mt-1 text-sm text-zinc-300">{userEmail}</p>
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
                        <label className={labelClass}>{replyContext ? "Your reply" : "Body"}</label>
                        <textarea
                            className={`${inputClass} resize-none`}
                            rows={replyContext ? 6 : 8}
                            placeholder={replyContext ? "Write your reply..." : "Write your message..."}
                            value={body}
                            onChange={e => onChange("body", e.target.value)}
                            autoFocus={!!replyContext}
                        />
                    </div>

                    {/* Quoted original — read-only, visually separated from compose area */}
                    {replyContext && (
                        <div className="border-t border-zinc-800 pt-4">
                            <div className="pl-4 border-l-2 border-zinc-700">
                                <p className="text-xs text-zinc-500 mb-2 leading-relaxed">
                                    On <span className="text-zinc-400">{replyContext.date}</span>,{" "}
                                    <span className="font-medium text-zinc-400">{replyContext.fromAddress}</span> wrote:
                                </p>
                                <p className="text-xs text-zinc-500 whitespace-pre-wrap leading-relaxed">
                                    {replyContext.displayBody}
                                </p>
                            </div>
                        </div>
                    )}

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
