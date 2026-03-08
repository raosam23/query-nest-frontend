"use client";
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/api";
import { ResearchSession, AgentUpdate } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { AxiosResponse } from "axios";
import { toast } from "sonner";
import { badgeColor } from "@/app/utils/SessionStyles";

const page = () => {
    const [session, setSession] = useState<ResearchSession | null>(null);
    const [agentUpdates, setAgentUpdates] = useState<AgentUpdate[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const params = useParams();
    const router = useRouter();
    useEffect(() => {
        let ws: WebSocket | null = null;
        const getSession = async () => {
            const id = params.id;
            const getSessionResponse: AxiosResponse<ResearchSession> = await api.get(`/research/${id}`);
            const fetchedSession = getSessionResponse.data;
            setSession(fetchedSession);
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

    return (
        <div className="min-h-screen p-10 bg-gray-800">
            <div className="max-w-5xl mx-auto space-y-4 mb-6">
                <Button onClick={() => router.back()} className="hover: cursor-pointer">
                    Back to the Dashboard
                </Button>
                <h1 className="text-4xl font-bold">{session?.query}</h1>
            </div>

            <Card className="max-w-5xl mx-auto p-6 space-y-3 mb-6">
                <h2 className="text-xl font-semibold mb-4">Agent Progress</h2>
                {agentUpdates.length === 0 && session?.status === "done" ? (
                    <p className="text-gray-400 text-base">Research completed succesfully</p>
                ) : (
                    agentUpdates
                        .filter((update: AgentUpdate) => update.agent && update.status)
                        .map((update: AgentUpdate, index: number) => (
                            <div key={index} className="flex justify-between items-center">
                                <p>{update.agent}</p>
                                <Badge className={`${badgeColor(update.status)} text-white`}>{update.status}</Badge>
                            </div>
                        ))
                )}
            </Card>
            {session?.status === "done" && (
                <Card className="max-w-5xl mx-auto p-6">
                    <h2 className="text-xl font-semibold mb-4">Final Report</h2>
                    <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>{session.final_report ?? ""}</ReactMarkdown>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default page;
