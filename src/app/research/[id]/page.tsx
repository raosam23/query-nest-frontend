"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import axios, { AxiosResponse } from "axios";
import api from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import { researchStreamUrl } from "@/lib/config";
import { parseStreamMessage } from "@/lib/stream";
import { ResearchSession, AgentUpdate, Source } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { badgeColor } from "@/app/utils/SessionStyles";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const ResearchPage = () => {
    const [session, setSession] = useState<ResearchSession | null>(null);
    const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [sources, setSources] = useState<Source[]>([]);
    const [pipelineError, setPipelineError] = useState<string | null>(null);
    const params = useParams();
    const router = useRouter();
    const sessionId = typeof params.id === "string" ? params.id : null;
    const [activeId, setActiveId] = useState(sessionId);
    if (sessionId !== activeId) {
        setActiveId(sessionId);
        setSession(null);
        setAgentUpdates([]);
        setSources([]);
        setPipelineError(null);
        setLoading(true);
    }

    useEffect(() => {
        if (!sessionId) {
            return;
        }
        let cancelled = false;
        let pipelineFailed = false;
        let ws: WebSocket | null = null;

        const redirectToLogin = () => {
            logout();
            toast.error("Please sign in again");
            router.replace("/login");
        };

        const loadSession = async () => {
            const token = getToken();
            if (!token) {
                redirectToLogin();
                return;
            }

            try {
                const getSessionResponse: AxiosResponse<ResearchSession> = await api.get(`/research/${sessionId}`);
                if (cancelled) {
                    return;
                }
                const fetchedSession = getSessionResponse.data;
                setSession(fetchedSession);
                setLoading(false);
                if (fetchedSession.status === "done") {
                    const getSourcesResponse = await api.get<Source[]>(`/research/${sessionId}/sources`);
                    if (!cancelled) {
                        setSources(getSourcesResponse.data);
                    }
                }
                if (fetchedSession.status !== "pending" && fetchedSession.status !== "running") {
                    return;
                }

                const liveToken = getToken();
                if (!liveToken) {
                    redirectToLogin();
                    return;
                }

                ws = new WebSocket(researchStreamUrl(sessionId, liveToken));
                ws.onmessage = (event: MessageEvent) => {
                    try {
                        const parsed = parseStreamMessage(JSON.parse(event.data));
                        if (parsed.kind === "completed") {
                            if (parsed.status === "failed") {
                                pipelineFailed = true;
                                const message =
                                    parsed.error?.trim() || "The research pipeline failed before it could finish.";
                                setPipelineError(message);
                                setSession((prev: ResearchSession | null) =>
                                    prev ? { ...prev, status: "failed" } : prev,
                                );
                                toast.error(message);
                            }
                            return;
                        }
                        if (parsed.kind !== "agent") {
                            return;
                        }
                        const data = parsed.update;
                        setAgentUpdates((prev: AgentUpdate[]) => {
                            const existing = prev.findIndex((update: AgentUpdate) => update.agent === data.agent);
                            if (existing !== -1) {
                                const updated: AgentUpdate[] = [...prev];
                                updated[existing] = data;
                                return updated;
                            }
                            return [...prev, data];
                        });
                    } catch (err) {
                        console.error("Failed to parse the websocket message: ", err);
                        toast.error("Failed to get the agent updates");
                    }
                };
                ws.onerror = () => {
                    if (cancelled) {
                        return;
                    }
                    console.error("Websocket error");
                    toast.error("Failed to get the agent updates");
                };
                ws.onclose = async (event: CloseEvent) => {
                    if (cancelled) {
                        return;
                    }
                    if (event.code === 1008) {
                        redirectToLogin();
                        return;
                    }
                    try {
                        const refreshed: AxiosResponse<ResearchSession> = await api.get(`/research/${sessionId}`);
                        if (cancelled) {
                            return;
                        }
                        if (pipelineFailed || refreshed.data.status === "failed") {
                            setSession({ ...refreshed.data, status: "failed" });
                            setPipelineError(
                                (current: string | null) =>
                                    current ?? "The research pipeline failed before it could finish.",
                            );
                            return;
                        }
                        setSession(refreshed.data);
                        if (refreshed.data.status === "done") {
                            const getSourcesResponse = await api.get<Source[]>(`/research/${sessionId}/sources`);
                            if (!cancelled) {
                                setSources(getSourcesResponse.data);
                            }
                        }
                    } catch (err) {
                        if (cancelled) {
                            return;
                        }
                        if (axios.isAxiosError(err) && err.response?.status === 401) {
                            redirectToLogin();
                            return;
                        }
                        console.error("Failed to refresh the research session: ", err);
                        toast.error("Failed to refresh the research session");
                    }
                };
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    redirectToLogin();
                    return;
                }
                console.error("Failed to load the research session: ", err);
                toast.error("Failed to load the research session");
                setLoading(false);
            }
        };

        loadSession();
        return () => {
            cancelled = true;
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
        };
    }, [sessionId, router]);

    const handleDeleteSession = async (id: string) => {
        const response = await api.delete(`/history/${id}`);
        if (response.data.status === 200) {
            toast.success(response.data.msg);
            router.push("/dashboard");
        } else {
            toast.error("Failed to delete session");
        }
    };

    const failed = pipelineError !== null || session?.status === "failed";
    const agentRows = agentUpdates
        .filter((update: AgentUpdate) => update.agent && update.status)
        .map((update: AgentUpdate) => (
            <div key={update.agent} className="flex justify-between items-center">
                <p>{update.agent}</p>
                <Badge className={`${badgeColor(update.status)} text-white`}>{update.status}</Badge>
            </div>
        ));

    return (
        <div className="min-h-screen p-10 bg-gray-800">
            <div className="max-w-5xl mx-auto space-y-4 mb-6">
                <div className="flex justify-between items-center mb-4">
                    <Button onClick={() => router.back()} className="hover: cursor-pointer">
                        Back to the Dashboard
                    </Button>
                    <Button
                        className="hover:cursor-pointer"
                        variant="destructive"
                        onClick={() => session && handleDeleteSession(session.id)}
                    >
                        Delete
                    </Button>
                </div>
                <h1 className="text-4xl font-bold">{session?.query}</h1>
            </div>

            {loading ? (
                <div className="p-10 flex justify-center items-center">
                    <Loader2 className="animate-spin" size={75} />
                </div>
            ) : (
                <>
                    <Card className="max-w-5xl mx-auto p-6 space-y-3 mb-6">
                        <h2 className="text-xl font-semibold mb-4">Agent Progress</h2>
                        {failed ? (
                            <>
                                <div
                                    role="alert"
                                    className="rounded-lg border border-red-500 bg-red-950/40 px-4 py-3"
                                >
                                    <p className="text-base font-medium text-red-300">Research pipeline failed</p>
                                    {pipelineError ? (
                                        <p className="mt-2 text-sm text-gray-100 break-words">{pipelineError}</p>
                                    ) : null}
                                </div>
                                {agentRows}
                            </>
                        ) : agentUpdates.length === 0 && session?.status === "done" ? (
                            <p className="text-gray-400 text-base">
                                ✅ 4 agents completed • Search → Summarize → Fact Check → Write
                            </p>
                        ) : (
                            agentRows
                        )}
                    </Card>
                    {session?.status === "done" && pipelineError === null && (
                        <div className="space-y-5 mb-6">
                            <Card className="max-w-5xl mx-auto p-6">
                                <h2 className="text-xl font-semibold mb-4">Final Report</h2>
                                <div className="prose prose-invert max-w-none">
                                    <ReactMarkdown>{session.final_report ?? ""}</ReactMarkdown>
                                </div>
                            </Card>
                            <Card className="max-w-5xl mx-auto p-6">
                                <h2 className="text-xl font-semibold mb-4">Sources</h2>
                                <div>
                                    {sources &&
                                        sources.map((source: Source) => (
                                            <div
                                                key={source.id}
                                                className="text-lg text-blue-400 border-b border-gray-700 pb-4 mb-4 last:border-0"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <Link
                                                        className=" hover:underline break-all font-semibold"
                                                        href={source.url ?? "#"}
                                                        target="_blank"
                                                    >
                                                        {source.title}
                                                    </Link>
                                                    {source.credibility_score !== null && (
                                                        <Badge className="text-white bg-blue-400">{`${Math.round(source.credibility_score * 100)}% credible`}</Badge>
                                                    )}
                                                </div>
                                                <h3 className="text-white text-sm">{source.url}</h3>
                                                <p className="text-gray-400 text-sm line-clamp-2">{source.snippet}</p>
                                            </div>
                                        ))}
                                </div>
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ResearchPage;
