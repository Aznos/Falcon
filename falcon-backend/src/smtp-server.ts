import {supabase} from "./db.ts";
import { SMTP_HOSTNAME } from "./utils/config.ts"

interface EmailSession {
    from: string
    to: string
    data: string
    collectingData: boolean
}

/**
 * Decode a quoted-printable encoded string to UTF-8.
 * Handles:
 *   - Soft line breaks: "=\r\n" and "=\n" → removed (line continuation)
 *   - Encoded bytes: "=XX" hex pairs → raw bytes, then decoded as UTF-8
 */
function decodeQuotedPrintable(input: string): string {
    // Remove soft line breaks first
    const joined = input.replace(/=\r\n/g, "").replace(/=\n/g, "")

    // Collect raw bytes: QP hex sequences become byte values, everything else is ASCII
    const bytes: number[] = []
    let i = 0
    while (i < joined.length) {
        if (
            joined[i] === "=" &&
            i + 2 < joined.length &&
            /[0-9A-Fa-f]{2}/.test(joined.slice(i + 1, i + 3))
        ) {
            bytes.push(parseInt(joined.slice(i + 1, i + 3), 16))
            i += 3
        } else {
            bytes.push(joined.charCodeAt(i) & 0xff)
            i++
        }
    }

    return Buffer.from(bytes).toString("utf-8")
}

export function startSMTPServer() {
    Bun.listen({
        hostname: "0.0.0.0",
        port: 25,
        socket: {
            open(socket) {
                (socket as any).session = {
                    from: "",
                    to: "",
                    data: "",
                    collectingData: false,
                } as EmailSession
                socket.write(`220 ${SMTP_HOSTNAME} ESMTP Falcon\r\n`)
            },

            async data(socket, rawData) {
                const msg = new TextDecoder().decode(rawData)
                console.log(`[SMTP-RAW] ${JSON.stringify(msg)}`)
                const session: EmailSession = (socket as any).session

                if(session.collectingData) {
                    session.data += msg
                    if(session.data.includes("\r\n.\r\n") || session.data.endsWith("\n.\n") || session.data.endsWith("\n.\r\n")) {
                        session.collectingData = false
                        session.data = session.data
                            .replace(/\r\n\.\r\n$/, "")
                            .replace(/\n\.\r\n$/, "")
                            .replace(/\n\.\n$/, "")
                            .trim()

                        console.log(`[RECV] End of DATA, saving...`)
                        await saveEmail(session)
                        socket.write("250 OK: Message accepted\r\n")
                    }

                    return
                }

                const trimmed = msg.trim()
                console.log(`[RECV] ${trimmed}`)
                const upper = trimmed.toUpperCase()

                if(upper.startsWith("EHLO") || upper.startsWith("HELO")) {
                    socket.write(`250-${SMTP_HOSTNAME}\r\n250-SIZE 10240000\r\n250 OK\r\n`)
                } else if(upper.startsWith("MAIL FROM")) {
                    session.from = trimmed.match(/<(.+)>/)?.[1] ?? ""
                    socket.write("250 OK\r\n")
                } else if(upper.startsWith("RCPT TO")) {
                    session.to = trimmed.match(/<(.+)>/)?.[1] ?? ""
                    socket.write("250 OK\r\n")
                } else if(upper === "DATA") {
                    session.collectingData = true
                    session.data = ""
                    socket.write("354 Start mail input; end with <CRLF>.<CRLF>\r\n")
                } else if(upper === "QUIT") {
                    socket.write("221 Bye\r\n")
                    socket.end()
                } else if(upper.startsWith("NOOP")) {
                    socket.write("250 OK\r\n")
                } else if(upper.startsWith("RSET")) {
                    session.from = ""
                    session.to = ""
                    session.data = ""
                    session.collectingData = false
                    socket.write("250 OK\r\n")
                } else if (upper.startsWith("AUTH")) {
                    socket.write("235 2.7.0 Authentication successful\r\n")
                } else if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
                    socket.write(`250-${SMTP_HOSTNAME}\r\n250-SIZE 10240000\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n`)
                } else {
                    socket.write("502 Command not implemented\r\n")
                }
            },

            error(socket, err) {
                console.error("[SMTP Server Error]", err)
            },

            close() {
                console.log("[SMTP Server Closed]")
            }
        }
    })

    console.log("STMP listening on port 25")
}

async function saveEmail(session: EmailSession) {
    const raw = session.data
    const normalized = raw.replace(/\r\n/g, "\n")
    const lines = normalized.split("\n")

    // Separate headers from body at the first blank line
    const headerBoundary = lines.findIndex(l => l.trim() === "")
    const headerLines = headerBoundary !== -1 ? lines.slice(0, headerBoundary) : lines

    const subjectLine = headerLines.find(l => l.toLowerCase().startsWith("subject:"))
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : "(no subject)"

    const messageIdLine = headerLines.find(l => l.toLowerCase().startsWith("message-id:"))
    const messageId = messageIdLine ? messageIdLine.replace(/^message-id:\s*/i, "").trim() : null

    // Top-level transfer encoding (used for non-multipart messages)
    const topCTELine = headerLines.find(l => l.toLowerCase().startsWith("content-transfer-encoding:"))
    const topCTE = topCTELine?.split(":")[1]?.trim().toLowerCase()

    let body = ""
    const contentTypeLine = headerLines.find(l => l.toLowerCase().startsWith("content-type:"))
    if(contentTypeLine?.toLowerCase().includes("multipart")) {
        const boundaryMatch = normalized.match(/boundary="([^"]+)"/)
        if(boundaryMatch) {
            const boundary = boundaryMatch[1]
            const parts = normalized.split(`--${boundary}`)
            for(const part of parts) {
                if(part.toLowerCase().includes("content-type: text/plain")) {
                    const blankIndex = part.indexOf("\n\n")
                    if(blankIndex !== -1) {
                        let partBody = part.slice(blankIndex + 2).trim().replace(/^--$/, "").trim()

                        // Check the transfer encoding declared in this MIME part's headers
                        const partCTEMatch = part.match(/content-transfer-encoding:\s*(.+)/i)
                        const partCTE = partCTEMatch?.[1]?.trim().toLowerCase()

                        if(partCTE === "quoted-printable") {
                            partBody = decodeQuotedPrintable(partBody)
                        }

                        body = partBody
                        break
                    }
                }
            }
        }
    } else {
        const blankIndex = lines.findIndex(l => l.trim() === "")
        body = blankIndex !== -1 ? lines.slice(blankIndex + 1).join("\n").trim() : normalized

        if(topCTE === "quoted-printable") {
            body = decodeQuotedPrintable(body)
        }
    }

    const handle = session.to.split("@")[0]?.toLowerCase()
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email_handle", handle)
        .single()

    if(!profile) {
        console.log(`[SMTP] No user found for handle: ${handle}, dropping email`)
        return
    }

    const { error } = await supabase.from("emails").insert({
        owner_id: profile.id,
        from_address: session.from,
        to_address: session.to,
        subject,
        body,
        raw,
        folder: "inbox",
        message_id: messageId,
    })

    if(error) console.error("[DB] Failed to save email:", error)
    else console.log(`[DB] Saved email for ${session.to}`)
}
