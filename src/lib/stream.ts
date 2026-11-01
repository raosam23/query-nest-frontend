export interface ParsedAgentUpdate {
    agent: string;
    status: "running" | "done" | "failed";
    output?: string;
}

export type ParsedStreamMessage =
    | { kind: "agent"; update: ParsedAgentUpdate }
    | { kind: "completed"; status: "done" | "failed"; error?: string }
    | { kind: "ignore" };

const AGENT_STATUSES = ["running", "done", "failed"] as const;

function isAgentStatus(value: unknown): value is ParsedAgentUpdate["status"] {
    return typeof value === "string" && (AGENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Classify one research-stream payload.
 * `pipeline_completed` is terminal: `failed` carries an optional `error`,
 * and any other status is a successful completion. Agent rows are separate.
 */
export function parseStreamMessage(value: unknown): ParsedStreamMessage {
    if (!value || typeof value !== "object") {
        return { kind: "ignore" };
    }
    const message = value as Record<string, unknown>;
    if (message.type === "pipeline_completed") {
        return {
            kind: "completed",
            status: message.status === "failed" ? "failed" : "done",
            error: typeof message.error === "string" ? message.error : undefined,
        };
    }
    if (typeof message.agent === "string" && message.agent.length > 0 && isAgentStatus(message.status)) {
        return {
            kind: "agent",
            update: {
                agent: message.agent,
                status: message.status,
                ...(typeof message.output === "string" ? { output: message.output } : {}),
            },
        };
    }
    return { kind: "ignore" };
}
