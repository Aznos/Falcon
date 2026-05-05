import { promises as dns } from "dns"
import { createSign } from "crypto"
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

function parseResponse(data: string): number {
    return parseInt(data.slice(0, 3))
}

function canonicalizeBody(body: string): string {
    return body.replace(/\r?\n/g, "\r\n").replace(/(\r\n)*$/, "\r\n")
}

function base64(str: string): string {
    return Buffer.from(str).toString("base64")
}

function sha256base64(data: string): string {
    const { createHash } = require("crypto")
    return createHash("sha256").update(data).digest("base64")
}

function generateDKIMHeader({ from, to, subject, date, body}: {
    from: string
    to: string
    subject: string
    date: string
    body: string
}): string {
    const canonBody = canonicalizeBody(body)
    const bodyHash  = sha256base64(canonBody)

    const headersToSign = [
        `from:${from}`,
        `to:${to}`,
        `subject:${subject}`,
        `date:${date}`,
    ].join("\r\n")

    const dkimHeaderBase =
        `v=1; a=rsa-sha256; c=relaxed/simple; d=${DKIM_DOMAIN}; ` +
        `s=${DKIM_SELECTOR}; h=from:to:subject:date; bh=${bodyHash}; b=`

    const signingInput = headersToSign + "\r\n" + "dkim-signature:" + dkimHeaderBase

    const sign = createSign("RSA-SHA256")
    sign.update(signingInput)
    const signature = sign.sign(DKIM_PRIVATE_KEY, "base64")

    return `DKIM-Signature: ${dkimHeaderBase}${signature}`
}

export async function sendRawEmail({ from, to, subject, body }: {
    from: string
    to: string
    subject: string
    body: string
}) {
    const toDomain = to.split('@')[1]
    if(!toDomain) throw new Error('Invalid recipient address')
    const mxHost = await getMXHost(toDomain)

    const date = new Date().toUTCString()
    const dkimHeader = generateDKIMHeader({ from, to, subject, date, body })

    const message =
        `${dkimHeader}\r\n` +
        `From: Maddox <${from}>\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `Date: ${date}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: text/plain; charset=UTF-8\r\n` +
        `\r\n` +
        `${body}`

    return new Promise<void>((resolve, reject) => {
        let state = 'GREETING'
        let buf = ''

        Bun.connect({
            hostname: mxHost,
            port: 25,
            socket: {
                data(socket, data) {
                    buf += new TextDecoder().decode(data)

                    const lines = buf.split('\r\n')
                    buf = lines.pop() ?? ''

                    for (const line of lines) {
                        if (!line) continue
                        const code = parseInt(line.slice(0, 3))
                        const isContinuation = line[3] === '-'
                        console.log(`[SMTP] ${line}`)

                        if (code >= 400) {
                            socket.end()
                            reject(new Error(`SMTP error ${code}: ${line}`))
                            return
                        }

                        if (isContinuation) continue

                        if (state === 'GREETING' && code === 220) {
                            state = 'EHLO'
                            socket.write(`EHLO mail.maddoxh.com\r\n`)
                        } else if (state === 'EHLO' && code === 250) {
                            state = 'MAIL_FROM'
                            socket.write(`MAIL FROM:<${from}>\r\n`)
                        } else if (state === 'MAIL_FROM' && code === 250) {
                            state = 'RCPT_TO'
                            socket.write(`RCPT TO:<${to}>\r\n`)
                        } else if (state === 'RCPT_TO' && code === 250) {
                            state = 'DATA'
                            socket.write('DATA\r\n')
                        } else if (state === 'DATA' && code === 354) {
                            state = 'BODY'
                            socket.write(`${message}\r\n.\r\n`)
                        } else if (state === 'BODY' && code === 250) {
                            state = 'QUIT'
                            socket.write('QUIT\r\n')
                        } else if (state === 'QUIT' && code === 221) {
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