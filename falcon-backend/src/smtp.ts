import { promises as dns } from "dns"

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

export async function sendRawEmail({ from, to, subject, body }: {
    from: string
    to: string
    subject: string
    body: string
}) {
    const toDomain = to.split('@')[1]
    if(!toDomain) throw new Error('Invalid recipient address')
    const mxHost = await getMXHost(toDomain)

    return new Promise<void>((resolve, reject) => {
        const chunks: string[] = []

        Bun.connect({
            hostname: mxHost,
            port: 25,
            socket: {
                data(socket, data) {
                    const msg = new TextDecoder().decode(data)
                    chunks.push(msg)
                    const code = parseResponse(msg)

                    if(code === 220) {
                        socket.write(`EHLO maddoxh.com\r\n`)
                    } else if(code === 250 && msg.includes('maddoxh.com')) {
                        socket.write(`MAIL FROM:<${from}>\r\n`)
                    } else if(code === 250 && chunks.length > 2) {
                        const last = chunks[chunks.length - 1] ?? ''
                        if(last.includes('MAIL FROM')) {
                            socket.write(`RCPT TO:<${to}>\r\n`)
                        } else if(last.includes('RCPT TO')) {
                            socket.write(`DATA\r\n`)
                        } else if(last.includes('DATA')) {
                            socket.write(
                                `From: Maddox <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n.\r\n`
                            )
                        } else {
                            socket.write(`QUIT\r\n`)
                        }
                    } else if(code === 354) {

                    } else if(code === 221) {
                        socket.end()
                        resolve()
                    } else if(code >= 400) {
                        socket.end()
                        reject(new Error(`SMTP error ${code}: ${msg.trim()}`))
                    }
                },
                error(_, err) { reject(err) },
                connectError(_, err) { reject(err) },
            }
        }).catch(reject)
    })
}