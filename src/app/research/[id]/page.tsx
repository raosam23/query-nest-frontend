"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { ResearchSession, AgentUpdate, Source } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { AxiosResponse } from "axios";
import { toast } from "sonner";
import { badgeColor } from "@/app/utils/SessionStyles";
import { Loader2 } from "lucide-react";
import Link from "next/link";

const page = () => {
    const [session, setSession] = useState<ResearchSession | null>(null);
    const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [sources, setSources] = useState<Source[]>([]);
    const params = useParams();
    const router = useRouter();
    useEffect(() => {
        setLoading(true);
        let ws: WebSocket | null = null;
        const getSession = async () => {
            const id = params.id;
            const getSessionResponse: AxiosResponse<ResearchSession> = await api.get(`/research/${id}`);
            const fetchedSession = getSessionResponse.data;
            setSession(fetchedSession);
            setLoading(false);
            if (fetchedSession.status === "done") {
                const getSourcesResponse = await api.get(`/research/${id}/sources`);
                setSources(getSourcesResponse.data);
            }
            if (fetchedSession.status === "pending" || fetchedSession.status === "running") {
                ws = new WebSocket(`ws://localhost:8000/research/${id}/stream`);
                ws.onmessage = (event: MessageEvent) => {
                    try {
                        const data: AgentUpdate = JSON.parse(event.data);
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
                ws.onerror = (event) => {
                    console.error("Websocket error: ", event);
                    toast.error("Failed to get the agent updates");
                };
                ws.onclose = async () => {
                    const getSessionResponse: AxiosResponse<ResearchSession> = await api.get(`/research/${id}`);
                    setSession(getSessionResponse.data);
                    const getSourcesResponse = await api.get(`/research/${id}/sources`);
                    setSources(getSourcesResponse.data);
                };
            }
        };
        getSession();
        return () => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, []);

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

export default page;
