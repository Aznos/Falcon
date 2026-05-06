const TOKEN_KEY = "falcon_token"
const REFRESH_KEY = "falcon_refresh"
const USER_KEY = "falcon_user"

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
}

export function getUser(): import("./types").User | null {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
}

export function saveSession(token: string, refreshToken: string, user: import("./types").User) {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(REFRESH_KEY, refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function updateUser(updates: Partial<import("./types").User>) {
    const user = getUser()
    if(user) localStorage.setItem(USER_KEY, JSON.stringify({ ...user, ...updates }))
}

export function clearSession() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
}

export function isLoggedIn(): boolean {
    return !!getToken()
}