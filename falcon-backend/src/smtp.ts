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
    subject: string
    messageID: string
    date: string
    body: string
}): string {
    const { from, to, subject, messageID, date, body } = headers

    const bodyHash = sha256base64(canonicalizeBodyRelaxed(body))
    const signedHeaderNames = "from:to:subject:date:message-id"
    const timestamp = Math.floor(Date.now() / 1000)

    const dkimHeaderBase =
        `v=1; a=rsa-sha256; c=relaxed/relaxed; d=${DKIM_DOMAIN}; ` +
        `s=${DKIM_SELECTOR}; t=${timestamp}; ` +
        `h=${signedHeaderNames}; bh=${bodyHash}; b=`

    const canonHeaders =
        canonicalizeHeaderRelaxed("from", `Maddox <${from}>`) + "\r\n" +
        canonicalizeHeaderRelaxed("to", to) + "\r\n" +
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

export async function sendRawEmail({ from, to, subject, body }: {
    from: string
    to: string
    subject: string
    body: string
}) {
    const toDomain = to.split("@")[1]
    if(!toDomain) throw new Error("Invalid recipient address")
    const mxHost = await getMXHost(toDomain)

    const date = new Date().toUTCString()
    const messageID = `<${Date.now()}.${Math.random().toString(36).slice(2)}@maddoxh.com>`
    const dkimHeader = generateDKIMHeader({ from, to, subject, messageID, date, body })

    const message =
        `${dkimHeader}\r\n` +
        `From: Maddox <${from}>\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Date: ${date}\r\n` +
        `Message-ID: ${messageID}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n` +
        `\r\n` +
        `${body}`

    return new Promise<void>((resolve, reject) => {
        let state = "GREETING"
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
                            socket.write(`RCPT TO:<${to}>\r\n`)
                        } else if(state === "RCPT_TO" && code === 250) {
                            state = "DATA"
                            socket.write("DATA\r\n")
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