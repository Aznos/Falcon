import { useState } from "react"
import type { Email } from "../types"

interface QuotedSegment {
    // Falcon format: separate from + date fields
    from?: string
    date?: string
    // Gmail/standard format: the full "On date, Person <email> wrote:" line
    attribution?: string
    text: string
}

/**
 * Strip leading > quote markers from each line.
 * "> text"  → "text"
 * ">> text" → "text"   (greedy: strips all leading > at once)
 * ">"       → ""       (blank quoted line → blank line, preserving paragraph breaks)
 */
function stripQuoteMarkers(text: string): string {
    return text
        .split("\n")
        .map(line => line.replace(/^>+\s?/, ""))
        .join("\n")
}

/**
 * Recursively parse a body string into a top message + a chain of quoted segments.
 *
 * Handles two separator formats, whichever appears first:
 *   1. Falcon:  "\n\n--- Original message ---\n"  (with From: / Date: header lines)
 *   2. Gmail:   "\n\nOn <date>, <person> wrote:\n" (body lines prefixed with ">")
 */
function parseReplyChain(body: string): { top: string; quoted: QuotedSegment[] } {
    const FALCON_SEP = "\n\n--- Original message ---\n"
    const falconIdx = body.indexOf(FALCON_SEP)

    // Match "On [anything] wrote:\n" — the [\s\S]+? handles wrapped header lines
    const gmailMatch = /\n\nOn [\s\S]+? wrote:\n/.exec(body)
    const gmailIdx = gmailMatch?.index ?? -1

    // No separator found — this is a leaf node
    if(falconIdx === -1 && gmailIdx === -1) {
        return { top: body.trimEnd(), quoted: [] }
    }

    // ── Falcon separator ──────────────────────────────────────────────────────
    if(falconIdx !== -1 && (gmailIdx === -1 || falconIdx <= gmailIdx)) {
        const top = body.slice(0, falconIdx).trimEnd()
        let rest = body.slice(falconIdx + FALCON_SEP.length)
        let from: string | undefined
        let date: string | undefined

        const fromMatch = rest.match(/^From: (.+)\n/)
        if(fromMatch) { from = fromMatch[1].trim(); rest = rest.slice(fromMatch[0].length) }
        const dateMatch = rest.match(/^Date: (.+)\n/)
        if(dateMatch) { date = dateMatch[1].trim(); rest = rest.slice(dateMatch[0].length) }

        const inner = parseReplyChain(rest.trimStart())
        return { top, quoted: [{ from, date, text: inner.top }, ...inner.quoted] }
    }

    // ── Gmail / standard separator ────────────────────────────────────────────
    const top = body.slice(0, gmailIdx).trimEnd()
    // Trim surrounding newlines to get the clean "On date, Person wrote:" line
    const attribution = gmailMatch![0].trim()
    const rest = body.slice(gmailIdx + gmailMatch![0].length)

    // Extract the email address from "<email>" angle brackets, if present
    const emailMatch = attribution.match(/<([^>]+@[^>]+)>/)
    const from = emailMatch?.[1]

    // Strip one level of > from the quoted body, then recurse
    const stripped = stripQuoteMarkers(rest)
    const inner = parseReplyChain(stripped.trimStart())

    return { top, quoted: [{ from, attribution, text: inner.top }, ...inner.quoted] }
}

interface Props {
    email: Email | null
    emptyMessage: string
    onReply?: (email: Email) => void
    onMoveToTrash?: (email: Email) => void
    onRestore?: (email: Email) => void
    onPermanentDelete?: (email: Email) => void
}

export function EmailDetail({ email, emptyMessage, onReply, onMoveToTrash, onRestore, onPermanentDelete }: Props) {
    // Stores the ID of the email whose chain is currently collapsed (null = all expanded)
    const [collapsedId, setCollapsedId] = useState<string | null>(null)

    if(!email) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <p className="text-zinc-600 text-sm">{emptyMessage}</p>
            </div>
        )
    }

    const { top, quoted } = parseReplyChain(email.body)
    const chainCollapsed = collapsedId === email.id

    return (
        <div className="flex-1 p-8 overflow-y-auto">
            {/* Header */}
            <h2 className="text-lg font-semibold mb-3">{email.subject || "(no subject)"}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500 mb-6">
                <span>From: <span className="text-zinc-300">{email.from_address}</span></span>
                <span>To: <span className="text-zinc-300">{email.to_address}</span></span>
                <span>{new Date(email.received_at).toLocaleString()}</span>
            </div>

            {/* Top (most recent) message body */}
            <div className="border-t border-zinc-800 pt-5">
                <p className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{top}</p>
            </div>

            {/* Reply chain — expanded by default so you immediately see the full context */}
            {quoted.length > 0 && (
                <div className="mt-6">
                    <button
                        onClick={() => setCollapsedId(chainCollapsed ? null : email.id)}
                        className="flex items-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors mb-4"
                    >
                        <span className="h-px bg-zinc-800 w-6" />
                        {chainCollapsed
                            ? `Show ${quoted.length} earlier ${quoted.length === 1 ? "message" : "messages"}`
                            : "Hide thread"
                        }
                        <span className="h-px bg-zinc-800 w-6" />
                    </button>

                    {!chainCollapsed && (
                        <div className="space-y-5">
                            {quoted.map((q, i) => (
                                <div
                                    key={i}
                                    className="pl-4 border-l-2 border-zinc-700"
                                    style={{ opacity: Math.max(0.38, 1 - i * 0.18) }}
                                >
                                    {/* Attribution line */}
                                    <p className="text-xs text-zinc-500 mb-2 leading-relaxed">
                                        {q.attribution
                                            // Gmail/standard: display the full "On date, Person wrote:" line
                                            ? q.attribution
                                            // Falcon: render our structured from + date
                                            : q.date && q.from
                                                ? <>On <span className="text-zinc-400">{q.date}</span>,{" "}<span className="font-medium text-zinc-400">{q.from}</span> wrote:</>
                                                : q.from
                                                    ? <><span className="font-medium text-zinc-400">{q.from}</span> wrote:</>
                                                    : null
                                        }
                                    </p>
                                    <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{q.text}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-6">
                {onReply && (
                    <button
                        onClick={() => onReply(email)}
                        className="px-4 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                        Reply
                    </button>
                )}
                {onMoveToTrash && (
                    <button
                        onClick={() => onMoveToTrash(email)}
                        className="px-4 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                    >
                        Move to Trash
                    </button>
                )}
                {onRestore && (
                    <button
                        onClick={() => onRestore(email)}
                        className="px-4 py-1.5 text-xs border border-zinc-700 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                    >
                        Restore
                    </button>
                )}
                {onPermanentDelete && (
                    <button
                        onClick={() => onPermanentDelete(email)}
                        className="px-4 py-1.5 text-xs border border-red-900 rounded-lg text-red-400 hover:bg-red-950 transition-colors"
                    >
                        Delete Forever
                    </button>
                )}
            </div>
        </div>
    )
}
