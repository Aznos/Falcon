import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import type { User } from "./types"
import { clearSession, getUser, isLoggedIn } from "./auth"
import { LoginPage } from "./pages/LoginPage"
import { VerifyPage } from "./pages/VerifyPage"
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { MailPage } from "./pages/MailPage"

export default function App() {
    const [user, setUser] = useState<User | null>(null)
    const [authChecked, setAuthChecked] = useState(false)

    useEffect(() => {
        if(isLoggedIn()) setUser(getUser())
        setAuthChecked(true)

        const handleLogout = () => setUser(null)
        window.addEventListener("falcon:logout", handleLogout)
        return () => window.removeEventListener("falcon:logout", handleLogout)
    }, [])

    function handleLogout() {
        clearSession()
        setUser(null)
    }

    if(!authChecked) return null

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/verify" element={<VerifyPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/login" element={
                    user ? <Navigate to="/inbox" replace /> : <LoginPage onAuth={setUser} />
                } />
                <Route path="/inbox" element={
                    user ? <MailPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
                } />
                <Route path="/sent" element={
                    user ? <MailPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
                } />
                <Route path="/compose" element={
                    user ? <MailPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
                } />
                <Route path="/trash" element={
                    user ? <MailPage user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />
                } />
                <Route path="/" element={
                    <Navigate to={user ? "/inbox" : "/login"} replace />
                } />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
