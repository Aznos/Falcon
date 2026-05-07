import { DOMAIN, NOREPLY_ADDRESS, FRONTEND_URL } from "./config.ts"

export function verificationEmail(recipientEmail: string, verifyToken: string, handle: string, fullName: string | null) {
    const verifyUrl = `${FRONTEND_URL}/verify?token=${verifyToken}`
    return {
        from: NOREPLY_ADDRESS,
        fromDisplay: "Falcon",
        to: [recipientEmail],
        subject: "Verify your Falcon email address",
        body:
            `Hi ${fullName ?? handle},\n\n` +
            `Welcome to Falcon! Your address is ${handle}@${DOMAIN}\n\n` +
            `Please verify your recovery email by clicking the link below:\n\n` +
            `${verifyUrl}\n\n` +
            `This link expires in 24 hours.\n\n` +
            `If you didn't sign up for Falcon, ignore this email.\n\n` +
            `- Falcon`,
    }
}

export function resendVerificationEmail(recipientEmail: string, verifyToken: string) {
    const verifyUrl = `${FRONTEND_URL}/verify?token=${verifyToken}`
    return {
        from: NOREPLY_ADDRESS,
        fromDisplay: "Falcon",
        to: [recipientEmail],
        subject: "Verify your Falcon email address",
        body: `Click here to verify your email:\n\n${verifyUrl}\n\nExpires in 24 hours.\n\n— Falcon`,
    }
}

export function passwordResetEmail(recipientEmail: string, resetToken: string) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`
    return {
        from: NOREPLY_ADDRESS,
        fromDisplay: "Falcon",
        to: [recipientEmail],
        subject: "Reset your Falcon password",
        body:
            `Someone requested a password reset for your Falcon account.\n\n` +
            `Click the link below to set a new password:\n\n` +
            `${resetUrl}\n\n` +
            `This link expires in 1 hour.\n\n` +
            `If you didn't request this, ignore this email.\n\n` +
            `— Falcon`,
    }
}
