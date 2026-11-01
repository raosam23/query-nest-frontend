"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api, { WS_BASE_URL } from "@/lib/api";
import { getToken, logout } from "@/lib/auth";
import { ResearchSession, AgentUpdate, ResearchStreamMessage, Source } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import axios, { AxiosResponse } from "axios";
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
    const id = params.id as string;

    useEffect(() => {
        let ws: WebSocket | null = null;
        let disposed = false;

        const refreshSession = async () => {
            const response: AxiosResponse<ResearchSession> = await api.get(`/research/${id}`);
            if (disposed) return;
            setSession(response.data);
            if (response.data.status === "done") {
                const sourcesResponse = await api.get(`/research/${id}/sources`);
                if (!disposed) setSources(sourcesResponse.data);
            } else if (response.data.status === "failed") {
                setPipelineError((current) => current ?? response.data.final_report ?? "The research pipeline failed.");
            }
        };

        const loadSession = async () => {
            if (!getToken()) {
                setLoading(false);
                router.replace("/login");
                return;
            }

            try {
                const response: AxiosResponse<ResearchSession> = await api.get(`/research/${id}`);
                if (disposed) return;
                const fetchedSession = response.data;
                setSession(fetchedSession);
                setLoading(false);

                if (fetchedSession.status === "done") {
                    const sourcesResponse = await api.get(`/research/${id}/sources`);
                    if (!disposed) setSources(sourcesResponse.data);
                    return;
                }

                if (fetchedSession.status === "failed") {
                    setPipelineError(fetchedSession.final_report ?? "The research pipeline failed.");
                    return;
                }

                const token = getToken();
                if (!token) {
                    router.replace("/login");
                    return;
                }
                const socketUrl = `${WS_BASE_URL}/research/${encodeURIComponent(id)}/stream?token=${encodeURIComponent(token)}`;
                ws = new WebSocket(socketUrl);
                ws.onmessage = (event: MessageEvent) => {
                    try {
                        const data: ResearchStreamMessage = JSON.parse(event.data);
                        if (data.type === "pipeline_completed") {
                            if (data.status === "failed") {
                                setSession((current) => current ? { ...current, status: "failed" } : current);
                                setPipelineError(data.error ?? "The research pipeline failed.");
                            }
                            return;
                        }
                        setAgentUpdates((previous: AgentUpdate[]) => {
                            const existing = previous.findIndex((update) => update.agent === data.agent);
                            if (existing !== -1) {
                                const updated = [...previous];
                                updated[existing] = data;
                                return updated;
                            }
                            return [...previous, data];
                        });
                    } catch (err) {
                        console.error("Failed to parse the websocket message: ", err);
                        toast.error("Failed to get the agent updates");
                    }
                };
                ws.onerror = (event) => {
                    console.error("Websocket error: ", event);
                    toast.error("Failed to get the agent updates");
                };
                ws.onclose = async (event: CloseEvent) => {
                    if (disposed) return;
                    if (event.code === 1008) {
                        logout();
                        router.replace("/login");
                        return;
                    }
                    try {
                        await refreshSession();
                    } catch (err) {
                        console.error("Failed to refresh the research session: ", err);
                        toast.error("Failed to refresh the research session");
                    }
                };
            } catch (err) {
                if (disposed) return;
                setLoading(false);
                if (axios.isAxiosError(err) && err.response?.status === 401) {
                    logout();
                    router.replace("/login");
                    return;
                }
                console.error("Failed to load the research session: ", err);
                toast.error("Failed to load the research session");
            }
        };

        void loadSession();
        return () => {
            disposed = true;
            if (ws && ws.readyState < WebSocket.CLOSING) {
                ws.close();
            }
        };
    }, [id, router]);

    const handleDeleteSession = async (sessionId: string) => {
        const response = await api.delete(`/history/${sessionId}`);
        if (response.data.status === 200) {
            toast.success(response.data.msg);
            router.push("/dashboard");
        } else {
            toast.error("Failed to delete session");
        }
    };

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
                        {agentUpdates.length === 0 && session?.status === "done" ? (
                            <p className="text-gray-400 text-base">
                                ✅ 4 agents completed • Search → Summarize → Fact Check → Write
                            </p>
                        ) : agentUpdates.length === 0 && session?.status === "failed" ? (
                            <p className="text-gray-400 text-base">❌ Research pipeline failed</p>
                        ) : (
                            agentUpdates
                                .filter((update: AgentUpdate) => update.agent && update.status)
                                .map((update: AgentUpdate, index: number) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <p>{update.agent}</p>
                                        <Badge className={`${badgeColor(update.status)} text-white`}>
                                            {update.status}
                                        </Badge>
                                    </div>
                                ))
                        )}
                    </Card>
                    {pipelineError && (
                        <Card className="max-w-5xl mx-auto p-6 mb-6 border border-red-500" role="alert">
                            <h2 className="text-xl font-semibold mb-2 text-red-300">Research failed</h2>
                            <p className="text-red-100">{pipelineError}</p>
                        </Card>
                    )}
                    {session?.status === "done" && (
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
