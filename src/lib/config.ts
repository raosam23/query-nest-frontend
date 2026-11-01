const DEFAULT_API_BASE_URL = "http://localhost:8000";

/**
 * REST origin for the QueryNest API.
 * `NEXT_PUBLIC_API_URL` is optional; an empty value keeps the local default.
 * Trailing slashes are removed so paths concatenate cleanly.
 */
export function getApiBaseUrl(): string {
    const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!configured) {
        return DEFAULT_API_BASE_URL;
    }
    return configured.replace(/\/+$/, "");
}

/**
 * WebSocket origin derived from the API origin.
 * `http://` becomes `ws://` and `https://` becomes `wss://`.
 */
export function getWebSocketBaseUrl(): string {
    return getApiBaseUrl().replace(/^http/i, "ws");
}

/** Authenticated research progress socket. The JWT is a `token` query param. */
export function researchStreamUrl(sessionId: string, token: string): string {
    const base = getWebSocketBaseUrl();
    return `${base}/research/${encodeURIComponent(sessionId)}/stream?token=${encodeURIComponent(token)}`;
}
