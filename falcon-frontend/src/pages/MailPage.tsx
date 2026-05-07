import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import type { Email, View, SendStatus, User } from "../types"
import {
    fetchInbox, fetchSent, fetchTrash,
    resendConfirmation, sendEmail,
    moveToTrash, restoreFromTrash, permanentlyDelete,
} from "../api"
import { Sidebar } from "../components/Sidebar"
import { EmailList } from "../components/EmailList"
import { EmailDetail } from "../components/EmailDetail"
import { ComposeForm } from "../components/ComposeForm"
import { VerificationBanner } from "../components/VerificationBanner"

interface Props {
    user: User
    onLogout: () => void
}

/** Returns the top-of-chain text (the most recent reply), excluding quoted content. */
function getTopMessage(body: string): string {
    const idx = body.indexOf("\n\n--- Original message ---\n")
    return idx === -1 ? body : body.slice(0, idx)
}

export function MailPage({ user, onLogout }: Props) {
    const location = useLocation()
    const navigate = useNavigate()

    const pathToView: Record<string, View> = {
        "/inbox": "inbox",
        "/sent": "sent",
        "/compose": "compose",
        "/trash": "trash",
    }
    const view: View = pathToView[location.pathname] ?? "inbox"

    const [emails, setEmails] = useState<Email[]>([])
    const [sentEmails, setSentEmails] = useState<Email[]>([])
    const [trashEmails, setTrashEmails] = useState<Email[]>([])
    const [selected, setSelected] = useState<Email | null>(null)
    const [loading, setLoading] = useState(true)

    const [to, setTo] = useState("")
    const [cc, setCc] = useState("")
    const [subject, setSubject] = useState("")
    const [body, setBody] = useState("")
    const [status, setStatus] = useState<SendStatus>("idle")
    const [error, setError] = useState("")
    const [inReplyTo, setInReplyTo] = useState<string | undefined>()
    const [references, setReferences] = useState<string[]>([])

    // The email being replied to — drives the reply context UI in ComposeForm
    const [replyEmail, setReplyEmail] = useState<Email | null>(null)
    // Set to true by handleReply so the cleanup effect knows not to clear compose state
    const enteringReplyRef = useRef(false)

    useEffect(() => {
        if(view === "inbox") loadInbox()
        else if(view === "sent") loadSent()
        else if(view === "trash") loadTrash()
    }, [view])

    // When navigating to /compose directly (via Sidebar Link, not via Reply), clear compose state
    useEffect(() => {
        if(view === "compose") {
            if(!enteringReplyRef.current) {
                setReplyEmail(null)
                setTo("")
                setCc("")
                setSubject("")
                setBody("")
                setStatus("idle")
                setError("")
                setInReplyTo(undefined)
                setReferences([])
            }
            enteringReplyRef.current = false
        }
    }, [view])

    async function loadInbox() {
        setLoading(true)
        setEmails(await fetchInbox())
        setLoading(false)
    }

    async function loadSent() {
        setLoading(true)
        setSentEmails(await fetchSent())
        setLoading(false)
    }

    async function loadTrash() {
        setLoading(true)
        setTrashEmails(await fetchTrash())
        setLoading(false)
    }

    function handleReply(email: Email) {
        enteringReplyRef.current = true
        setReplyEmail(email)
        setTo(email.from_address)
        setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`)
        setBody("") // user types their reply here; the quote is appended on send
        setInReplyTo(email.message_id ?? undefined)
        setReferences(email.message_id ? [email.message_id] : [])
        setStatus("idle")
        setError("")
        navigate("/compose")
    }

    async function handleSend() {
        setStatus("sending")
        setError("")
        try {
            // Append the quoted original with From + Date headers so the chain
            // can be parsed and displayed correctly by EmailDetail
            const fullBody = replyEmail
                ? `${body}\n\n--- Original message ---\nFrom: ${replyEmail.from_address}\nDate: ${new Date(replyEmail.received_at).toLocaleString()}\n${replyEmail.body}`
                : body
            const res = await sendEmail({ to, cc: cc || undefined, subject, body: fullBody, inReplyTo, references })
            if(res.error) throw new Error(res.error)
            setTo(""); setCc(""); setSubject(""); setBody("")
            setReplyEmail(null)
            setStatus("sent")
        } catch(e: any) {
            setError(e.message)
            setStatus("error")
        }
    }

    function handleComposeChange(field: "to" | "cc" | "subject" | "body", value: string) {
        if(field === "to") setTo(value)
        else if(field === "cc") setCc(value)
        else if(field === "subject") setSubject(value)
        else setBody(value)
    }

    async function handleMoveToTrash(email: Email) {
        await moveToTrash(email.id)
        setSelected(null)
        if(view === "inbox") setEmails(prev => prev.filter(e => e.id !== email.id))
        else if(view === "sent") setSentEmails(prev => prev.filter(e => e.id !== email.id))
    }

    async function handleRestoreFromTrash(email: Email) {
        await restoreFromTrash(email.id)
        setSelected(null)
        setTrashEmails(prev => prev.filter(e => e.id !== email.id))
    }

    async function handlePermanentDelete(email: Email) {
        await permanentlyDelete(email.id)
        setSelected(null)
        setTrashEmails(prev => prev.filter(e => e.id !== email.id))
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
            {!user.emailConfirmed && (
                <VerificationBanner
                    email={user.email}
                    onResend={() => resendConfirmation(user.email)}
                />
            )}

            <div className="flex flex-1 overflow-hidden">
                <Sidebar
                    inboxCount={emails.length}
                    userEmail={user.emailAddress}
                    onLogout={onLogout}
                />

                {view === "inbox" && (
                    <>
                        <EmailList
                            title="Inbox"
                            emails={emails}
                            loading={loading}
                            selected={selected}
                            emptyMessage="No emails yet."
                            displayAddress={e => e.from_address}
                            onSelect={setSelected}
                            onRefresh={loadInbox}
                        />
                        <EmailDetail
                            email={selected}
                            emptyMessage="Select an email to read"
                            onReply={handleReply}
                            onMoveToTrash={handleMoveToTrash}
                        />
                    </>
                )}

                {view === "sent" && (
                    <>
                        <EmailList
                            title="Sent"
                            emails={sentEmails}
                            loading={loading}
                            selected={selected}
                            emptyMessage="No sent emails."
                            displayAddress={e => e.to_address}
                            onSelect={setSelected}
                            onRefresh={loadSent}
                        />
                        <EmailDetail
                            email={selected}
                            emptyMessage="Select a message to read"
                            onMoveToTrash={handleMoveToTrash}
                        />
                    </>
                )}

                {view === "compose" && (
                    <ComposeForm
                        to={to}
                        cc={cc}
                        subject={subject}
                        body={body}
                        status={status}
                        error={error}
                        replyContext={replyEmail ? {
                            fromAddress: replyEmail.from_address,
                            date: new Date(replyEmail.received_at).toLocaleString(),
                            // Show only the top message of the chain as the preview —
                            // the full chain is appended to the outgoing body on send
                            displayBody: getTopMessage(replyEmail.body),
                        } : undefined}
                        onChange={handleComposeChange}
                        onSend={handleSend}
                        userEmail={user.emailAddress}
                    />
                )}

                {view === "trash" && (
                    <>
                        <EmailList
                            title="Trash"
                            emails={trashEmails}
                            loading={loading}
                            selected={selected}
                            emptyMessage="Trash is empty."
                            displayAddress={e => e.from_address}
                            onSelect={setSelected}
                            onRefresh={loadTrash}
                        />
                        <EmailDetail
                            email={selected}
                            emptyMessage="Select an email to read"
                            onRestore={handleRestoreFromTrash}
                            onPermanentDelete={handlePermanentDelete}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
