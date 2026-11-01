/** Read the `token` cookie. The value may contain `=`, so it is not split on that character. */
export function tokenFromCookie(cookie: string): string | null {
    const row = cookie.split("; ").find((item) => item.startsWith("token="));
    if (!row) {
        return null;
    }
    const value = row.slice("token=".length);
    return value.length > 0 ? value : null;
}
