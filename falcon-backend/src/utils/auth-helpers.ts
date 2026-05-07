export async function supabaseSignIn(email: string, password: string) {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY! },
        body: JSON.stringify({ email, password }),
    })
    const json = await res.json() as any
    if(!res.ok || !json.access_token) return null
    return { access_token: json.access_token as string, refresh_token: json.refresh_token as string, user: json.user as { id: string; email: string } }
}

export async function supabaseRefresh(refreshToken: string) {
    const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": process.env.SUPABASE_SERVICE_ROLE_KEY! },
        body: JSON.stringify({ refresh_token: refreshToken }),
    })
    const json = await res.json() as any
    if(!res.ok || !json.access_token) return null
    return { access_token: json.access_token as string, refresh_token: json.refresh_token as string }
}
