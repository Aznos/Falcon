import { useEffect, useState } from "react"
import type {Email, View, SendStatus, User} from "./types"
import { fetchInbox, fetchSent, sendEmail } from "./api"
import { Sidebar } from "./components/Sidebar"
import { EmailList } from "./components/EmailList"
import { EmailDetail } from "./components/EmailDetail"
import { ComposeForm } from "./components/ComposeForm"
import {clearSession, getUser, isLoggedIn} from "./auth.ts";
import {LoginPage} from "./components/LoginPage.tsx";

export default function App() {
    const [view, setView] = useState<View>("inbox")
    const [emails, setEmails] = useState<Email[]>([])
    const [sentEmails, setSentEmails] = useState<Email[]>([])
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

    const [user, setUser] = useState<User | null>(null)
    const [authChecked, setAuthChecked] = useState(false)

    useEffect(() => {
        if(isLoggedIn()) setUser(getUser())
        setAuthChecked(true)

        const handleLogout = () => {
            setUser(null)
        }

        window.addEventListener("falcon:logout", handleLogout)
        return () => window.removeEventListener("falcon:logout", handleLogout)
    }, [])

    useEffect(() => {
        if(isLoggedIn()) setUser(getUser())
        setAuthChecked(true)
    }, []);

    useEffect(() => {
        if(!user) return
        if(view === "inbox") loadInbox()
        if(view === "sent") loadSent()
    }, [view, user])

    function handleLogout() {
        clearSession()
        setUser(null)
    }

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

    function handleNavigate(next: View) {
        setSelected(null)
        if(next === "compose") setStatus("idle")
        setView(next)
    }

    function handleReply(email: Email) {
        setTo(email.from_address)
        setSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`)
        setBody(`\n\n--- Original message ---\nFrom: ${email.from_address}\n${email.body}`)
        setInReplyTo(email.message_id ?? undefined)
        setReferences(email.message_id ? [email.message_id] : [])
        setView("compose")
    }

    async function handleSend() {
        setStatus("sending")
        setError("")
        try {
            const res = await sendEmail({ to, cc: cc || undefined, subject, body, inReplyTo, references })
            if(res.error) throw new Error(res.error)
            setTo(""); setCc(""); setSubject(""); setBody("")
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

    if(!authChecked) return null
    if(!user) return <LoginPage onAuth={setUser} />

    return (
        <div className="min-h-screen bg-zinc-950 text-white flex">
            <Sidebar view={view} inboxCount={emails.length} onNavigate={handleNavigate} userEmail={user.emailAddress} onLogout={handleLogout} />

            <div className="flex flex-1 overflow-hidden">
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
                        onChange={handleComposeChange}
                        onSend={handleSend}
                        userEmail={user.emailAddress}
                    />
                )}
            </div>
        </div>
    )
}
