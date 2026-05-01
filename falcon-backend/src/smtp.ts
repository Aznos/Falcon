import { promises as dns } from "dns"

async function getMXHost(domain: string): Promise<string> {
    const records = await dns.resolveMx(domain)
    records.sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority)
    // @ts-ignore
    return records[0].exchange
}

function parseResponse(data: string): number {
    return parseInt(data.slice(0, 3))
}

export async function sendRawEmail({
   from,
   to,
   subject,
   body,
}: {
    from: string
    to: string
    subject: string
    body: string
}) {
    const toDomain: string = to.split('@')[1]!!
    const mxHost = await getMXHost(toDomain)

    return new Promise<void>(async (resolve, reject) => {
        const chunks: string[] = []

        const socket = await Bun.connect({
            hostname: mxHost,
            port: 25,
            socket: {
                data(socket, data) {
                    const msg = new TextDecoder().decode(data)
                    chunks.push(msg)
                    const code = parseResponse(msg)

                    if(code === 200) {
                        socket.write(`EHLO maddoxh.com\r\n`)
                    } else if(code === 250 && msg.includes("maddoxh.com")) {
                        socket.write(`MAIL FROM:<${from}>\r\n`)
                    } else if(code === 250 && chunks.length > 2) {
                        const last: string = chunks[chunks.length - 1]!!
                        if(last.includes("MAIL FROM")) {
                            socket.write(`RCPT TO:<${to}>\r\n`)
                        } else if(last.includes("RCPT TO")) {
                            socket.write(`DATA\r\n`)
                        } else if(last.includes("DATA") || code === 354) {
                            socket.write(
                                `From: Maddox <${from}>\r\nTo: ${to}\r\nSubject: ${subject}\r\nDate: ${new Date().toUTCString()}\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${body}\r\n.\r\n`
                            )
                        } else {
                            socket.write(`QUIT\r\n`)
                        }
                    } else if(code === 221) {
                        socket.end()
                        resolve()
                    } else if(code >= 400) {
                        socket.end()
                        reject(new Error(`STMP error ${code}: ${msg.trim()}`))
                    }
                },
                error(socket, err) { reject(err) },
                connectError(socket, err) { reject(err) }
            }
        })
    })
}