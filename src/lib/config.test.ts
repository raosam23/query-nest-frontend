import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { getApiBaseUrl, getWebSocketBaseUrl, researchStreamUrl } from "./config.ts";
import { parseStreamMessage } from "./stream.ts";
import { tokenFromCookie } from "./token.ts";

const ORIGINAL = process.env.NEXT_PUBLIC_API_URL;

afterEach(() => {
    if (ORIGINAL === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
    } else {
        process.env.NEXT_PUBLIC_API_URL = ORIGINAL;
    }
});

describe("API and WebSocket origins", () => {
    it("defaults to the local API and derives a ws URL", () => {
        delete process.env.NEXT_PUBLIC_API_URL;
        assert.equal(getApiBaseUrl(), "http://localhost:8000");
        assert.equal(getWebSocketBaseUrl(), "ws://localhost:8000");
    });

    it("treats a blank value as unset and strips trailing slashes", () => {
        process.env.NEXT_PUBLIC_API_URL = "   ";
        assert.equal(getApiBaseUrl(), "http://localhost:8000");
        process.env.NEXT_PUBLIC_API_URL = "https://api.example.com///";
        assert.equal(getApiBaseUrl(), "https://api.example.com");
        assert.equal(getWebSocketBaseUrl(), "wss://api.example.com");
    });

    it("rewrites an http origin to ws, including uppercase schemes", () => {
        process.env.NEXT_PUBLIC_API_URL = "HTTP://localhost:9000";
        assert.equal(getWebSocketBaseUrl(), "ws://localhost:9000");
    });

    it("puts the session id and the JWT on the stream URL", () => {
        process.env.NEXT_PUBLIC_API_URL = "https://api.example.com";
        const url = researchStreamUrl("session/1", "a+b/c=d&e");
        assert.equal(
            url,
            "wss://api.example.com/research/session%2F1/stream?token=a%2Bb%2Fc%3Dd%26e",
        );
        const parsed = new URL(url);
        assert.equal(parsed.searchParams.get("token"), "a+b/c=d&e");
        assert.equal(parsed.pathname, "/research/session%2F1/stream");
    });
});

describe("token cookie", () => {
    it("keeps JWT padding and ignores other cookies", () => {
        assert.equal(tokenFromCookie("theme=dark; token=aaa.bbb.ccc="), "aaa.bbb.ccc=");
        assert.equal(tokenFromCookie("token="), null);
        assert.equal(tokenFromCookie("session=1"), null);
    });
});

describe("research stream messages", () => {
    it("keeps agent rows and ignores the completion event as a row", () => {
        assert.deepEqual(parseStreamMessage({ agent: "search_agent", status: "running" }), {
            kind: "agent",
            update: { agent: "search_agent", status: "running" },
        });
        assert.deepEqual(
            parseStreamMessage({
                agent: "search_agent",
                status: "done",
                output: "Found 5 results",
            }),
            {
                kind: "agent",
                update: { agent: "search_agent", status: "done", output: "Found 5 results" },
            },
        );
    });

    it("treats pipeline_completed failed as a failure and keeps the error", () => {
        assert.deepEqual(
            parseStreamMessage({
                type: "pipeline_completed",
                status: "failed",
                error: "research pipeline failed",
            }),
            { kind: "completed", status: "failed", error: "research pipeline failed" },
        );
        assert.deepEqual(parseStreamMessage({ type: "pipeline_completed", status: "failed" }), {
            kind: "completed",
            status: "failed",
            error: undefined,
        });
    });

    it("treats a done completion, including a missing status, as success", () => {
        assert.deepEqual(parseStreamMessage({ type: "pipeline_completed", status: "done" }), {
            kind: "completed",
            status: "done",
            error: undefined,
        });
        assert.deepEqual(parseStreamMessage({ type: "pipeline_completed" }), {
            kind: "completed",
            status: "done",
            error: undefined,
        });
    });

    it("ignores payloads that are not agent updates or completion", () => {
        assert.deepEqual(parseStreamMessage(null), { kind: "ignore" });
        assert.deepEqual(parseStreamMessage("pipeline_completed"), { kind: "ignore" });
        assert.deepEqual(parseStreamMessage({ agent: "", status: "done" }), { kind: "ignore" });
        assert.deepEqual(parseStreamMessage({ status: "running" }), { kind: "ignore" });
    });
});
