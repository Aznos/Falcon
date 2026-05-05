import { promises as dns } from "dns"
import { createSign, createHash } from "crypto"
import { readFileSync } from "fs"

const DKIM_PRIVATE_KEY = readFileSync("/etc/dkim/mail.private", "utf8")
const DKIM_SELECTOR = "mail"
const DKIM_DOMAIN = "maddoxh.com"

async function getMXHost(domain: string): Promise<string> {
    const records = await dns.resolveMx(domain)
    records.sort((a, b) => a.priority - b.priority)
    const host = records[0]?.exchange
    if(!host) throw new Error(`No MX records found for ${domain}`)
    return host
}

function canonicalizeHeaderRelaxed(name: string, value: string): string {
    return `${name.toLowerCase()}:${value.replace(/\s+/g, " ").trim()}`
}

function canonicalizeBodyRelaxed(body: string): string {
    const lines = body.replace(/\r\n/g, "\n").split("\n")
    const canonical = lines.map(l => l.replace(/\s+/g, " ").trimEnd())

    while(canonical.length > 0 && canonical[canonical.length - 1] === "") {
        canonical.pop()
    }

    return canonical.join("\r\n") + "\r\n"
}

function sha256base64(data: string): string {
    return createHash("sha256").update(data, "utf8").digest("base64")
}

function generateDKIMHeader(headers: {
    from: string
    to: string
    cc?: string
    subject: string
    messageID: string
    date: string
    body: string
}): string {
    const { from, to, cc, subject, messageID, date, body } = headers

    const bodyHash = sha256base64(canonicalizeBodyRelaxed(body))
    const signedHeaderNames = cc
        ? "from:to:cc:subject:date:message-id"
        : "from:to:subject:date:message-id"
    const timestamp = Math.floor(Date.now() / 1000)

    const dkimHeaderBase =
        `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${DKIM_DOMAIN}; ` +
        `s=${DKIM_SELECTOR}; t=${timestamp}; ` +
        `h=${signedHeaderNames}; bh=${bodyHash}; b=`

    let canonHeaders =
        canonicalizeHeaderRelaxed("from", from) + "\r\n" +
        canonicalizeHeaderRelaxed("to", to) + "\r\n" +
        (cc ? canonicalizeHeaderRelaxed("cc", cc) + "\r\n" : "") +
        canonicalizeHeaderRelaxed("subject", subject) + "\r\n" +
        canonicalizeHeaderRelaxed("date", date) + "\r\n" +
        canonicalizeHeaderRelaxed("message-id", messageID) + "\r\n" +
        canonicalizeHeaderRelaxed("dkim-signature", dkimHeaderBase)

    const sign = createSign("RSA-SHA256")
    sign.update(canonHeaders, "utf8")
    const signature = sign.sign(DKIM_PRIVATE_KEY, "base64")
    const folded = signature.replace(/(.{72})/g, "$1\r\n\t")

    return `DKIM-Signature: ${dkimHeaderBase}${folded}`
}

export async function sendRawEmail({ from, to, cc, subject, body, inReplyTo, references }: {
    from: string
    to: string[]
    cc?: string[]
    subject: string
    body: string
    inReplyTo?: string
    references?: string[]
}) {
    if(!to.length) throw new Error("No recipients")

    const allRecipients = [...to, ...(cc ?? [])]
    const firstDomain = to[0]!.split("@")[1]
    if(!firstDomain) throw new Error("Invalid recipient address")

    const byDomain = new Map<string, string[]>()
    for(const addr of allRecipients) {
        const domain = addr.split("@")[1] ?? ""
        if(!byDomain.has(domain)) byDomain.set(domain, [])
        byDomain.get(domain)!.push(addr)
    }

    const date = new Date().toUTCString()
    const messageID = `<${Date.now()}.${Math.random().toString(36).slice(2)}@maddoxh.com>`
    const dkimHeader = generateDKIMHeader({ from: `Maddox <${from}>`, to: to.join(", "), cc: cc?.join(", "), subject, messageID, date, body })

    const message =
        `${dkimHeader}\r\n` +
        `From: Maddox <${from}>\r\n` +
        `To: ${to.join(", ")}\r\n` +
        (cc?.length ? `Cc: ${cc.join(", ")}\r\n` : "") +
        `Subject: ${subject}\r\n` +
        `Date: ${date}\r\n` +
        `Message-ID: ${messageID}\r\n` +
        (inReplyTo ? `In-Reply-To: ${inReplyTo}\r\n` : "") +
        (references?.length ? `References: ${references.join(" ")}\r\n` : "") +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n` +
        `\r\n` +
        `${body}`

    const sends = Array.from(byDomain.entries()).map(([domain, recipients]) =>
        sendToMX({ domain, recipients, from, message })
    )

    await Promise.all(sends)
    return messageID
}

async function sendToMX({ domain, recipients, from, message }: {
    domain: string
    recipients: string[]
    from: string
    message: string
}) {
    const mxHost = await getMXHost(domain)

    return new Promise<void>((resolve, reject) => {
        let state = "GREETING"
        let recipientIndex = 0
        let buf = ""

        Bun.connect({
            hostname: mxHost,
            port: 25,
            socket: {
                data(socket, data) {
                    buf += new TextDecoder().decode(data)
                    const lines = buf.split("\r\n")
                    buf = lines.pop() ?? ""

                    for(const line of lines) {
                        if(!line) continue
                        const code = parseInt(line.slice(0, 3))
                        const isContinuation = line[3] === "-"
                        console.log(`[SMTP] ${line}`)

                        if(code >= 400) {
                            socket.end()
                            reject(new Error(`SMTP error ${code}: ${line}`))
                            return
                        }

                        if(isContinuation) continue

                        if(state === "GREETING" && code === 220) {
                            state = "EHLO"
                            socket.write(`EHLO mail.maddoxh.com\r\n`)
                        } else if(state === "EHLO" && code === 250) {
                            state = "MAIL_FROM"
                            socket.write(`MAIL FROM:<${from}>\r\n`)
                        } else if(state === "MAIL_FROM" && code === 250) {
                            state = "RCPT_TO"
                            socket.write(`RCPT TO:<${recipients[0]}>\r\n`)
                            recipientIndex = 1
                        } else if(state === "RCPT_TO" && code === 250) {
                            if(recipientIndex < recipients.length) {
                                socket.write(`RCPT TO:<${recipients[recipientIndex]}>\r\n`)
                                recipientIndex++
                            } else {
                                state = "DATA"
                                socket.write("DATA\r\n")
                            }
                        } else if(state === "DATA" && code === 354) {
                            state = "BODY"
                            socket.write(`${message}\r\n.\r\n`)
                        } else if(state === "BODY" && code === 250) {
                            state = "QUIT"
                            socket.write("QUIT\r\n")
                        } else if(state === "QUIT" && code === 221) {
                            socket.end()
                            resolve()
                        }
                    }
                },
                error(_, err) { reject(err) },
                connectError(_, err) { reject(err) },
            }
        }).catch(reject)
    })
}