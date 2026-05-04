import {supabase} from "./db.ts";

interface EmailSession {
    from: string
    to: string
    data: string
    collectingData: boolean
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
                socket.write("220 mail.maddoxh.com ESMTP Falcon\r\n")
            },

            async data(socket, rawData) {
                const msg = new TextDecoder().decode(rawData)
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
                    socket.write("250-mail.maddoxh.com\r\n250-SIZE 10240000\r\n250 OK\r\n")
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
    const lines = raw.split("\n")

    // Get subject
    const subjectLine = lines.find(l => l.toLowerCase().startsWith("subject:"))
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : "(no subject)"

    const fromLine = lines.find(l => l.toLowerCase().startsWith("from:"))
    const from = fromLine ? fromLine.replace(/^from:\s*/i, "").trim() : session.from

    let body = ""

    const contentTypeLine = lines.find(l => l.toLowerCase().startsWith("content-type:"))
    if (contentTypeLine?.toLowerCase().includes("multipart")) {
        const boundaryMatch = raw.match(/boundary="([^"]+)"/)
        if(boundaryMatch) {
            const boundary = boundaryMatch[1]
            const parts = raw.split(`--${boundary}`)
            for(const part of parts) {
                if(part.toLowerCase().includes("content-type: text/plain")) {
                    const blankIndex = part.indexOf("\n\n")
                    if(blankIndex !== -1) {
                        body = part.slice(blankIndex + 2).trim()
                        body = body.replace(/--$/, "").trim()
                        break
                    }
                }
            }
        }
    } else {
        const blankIndex = lines.findIndex(l => l.trim() === "")
        body = blankIndex !== -1 ? lines.slice(blankIndex + 1).join("\n").trim() : raw
    }

    const { error } = await supabase.from("emails").insert({
        from_address: session.from,
        to_address: session.to,
        subject,
        body,
        raw,
    })

    if(error) console.error("[DB] Failed to save email:", error)
    else console.log(`[DB] Saved email from ${session.from} to ${session.to}`)
}