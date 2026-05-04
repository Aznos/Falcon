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

            async data(socket,  rawData) {
                const msg = new TextDecoder().decode(rawData).trim()
                const session: EmailSession = (socket as any).session
                console.log(`[RECV] ${msg}`)

                if(session.collectingData) {
                    if(msg === '.') {
                        session.collectingData = false
                        await saveEmail(session)
                        socket.write("250 OK: Message accepted\r\n")
                    } else {
                        session.data += msg + "\n"
                    }
                    return
                }

                const upper = msg.toUpperCase()
                if(upper.startsWith("EHLO") || upper.startsWith("HELO")) {
                    socket.write("250-mail.maddoxh.com\r\n250-SIZE 10240000\r\n250 OK\r\n")
                } else if(upper.startsWith("MAIL FROM")) {
                    session.from = msg.match(/<(.+)>/)?.[1] ?? ""
                    socket.write("250 OK\r\n")
                } else if(upper.startsWith("RCPT TO")) {
                    session.to = msg.match(/<(.+)>/)?.[1] ?? ""
                    socket.write("250 OK\r\n")
                } else if(upper === "DATA") {
                    session.collectingData = true
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
    const lines = session.data.split("\n")

    const subjectLine = lines.find(l => l.toLowerCase().startsWith("subject:"))
    const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, "").trim() : "(no subject)"

    const blankIndex = lines.findIndex(l => l.trim() === "")
    const body = blankIndex !== -1 ? lines.slice(blankIndex + 1).join("\n").trim() : session.data

    const { error } = await supabase.from("emails").insert({
        from_address: session.from,
        to_address: session.to,
        subject,
        body,
        raw: session.data
    })

    if(error) console.error("[DB] Failed to save email:", error)
    else console.log(`[DB] Saved email from ${session.from} to ${session.to}`)
}