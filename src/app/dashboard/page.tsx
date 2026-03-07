"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect } from "react";
import api from "@/lib/api";
import { logout } from "@/lib/auth";
import { ResearchSession } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AxiosResponse } from "axios";

const Dashboard = () => {
    const [sessions, setSessions] = useState<ResearchSession[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [modalOpen, setModalOpen] = useState<boolean>(false);
    const [query, setQuery] = useState<string>("");

    const router = useRouter();

    const fetchSessions = async () => {
        const historyResponse: AxiosResponse = await api.get("/history");
        setSessions(historyResponse.data);
    };
    const handleNewResearch = async () => {
        const researchResponse: AxiosResponse<ResearchSession> = await api.post("/research", {
            query,
        });
        router.push(`/research/${researchResponse.data.id}`);
    };
    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    const badgeColor = (status: string) => {
        switch (status) {
            case "pending":
                return "bg-yellow-500";
            case "running":
                return "bg-blue-500";
            case "done":
                return "bg-green-500";
            case "failed":
                return "bg-red-500";
            default:
                return "bg-gray-500";
        }
    };

    return (
        <div className="min-h-screen p-10 bg-gray-800">
            <nav className="flex justify-between p-4 items-center">
                <h1 className="text-3xl font-bold">QueryNest</h1>
                <Button className="hover:cursor-pointer" onClick={handleLogout}>
                    Logout
                </Button>
            </nav>
            <div className="max-w-4xl mx-auto p-6 space-y-4">
                <div className="max-w-xl mx-auto flex flex-row justify-center items-center space-x-6">
                    <Input
                        placeholder="Enter your research query"
                        value={query}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                    />
                    <Button className="hover:cursor-pointer" onClick={handleNewResearch}>
                        New Research
                    </Button>
                </div>
                <div className="flex flex-col space-y-4 items-center">
                    {sessions.map((session: ResearchSession) => (
                        <Card
                            key={session.id}
                            className="w-[600px] p-4 flex flex-row justify-between items-center space-x-4"
                        >
                            <div className="space-y-2 flex flex-col items-start">
                                <p className="text-lg font-medium">{session.query}</p>
                                <p className="text-sm text-gray-200">
                                    Created at{" "}
                                    {session.created_at ? new Date(session.created_at).toLocaleDateString() : "Unknown"}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <Badge className={`${badgeColor(session.status)} text-white`}>{session.status}</Badge>
                                <Button
                                    className="hover:cursor-pointer"
                                    onClick={() => router.push(`/research/${session.id}`)}
                                >
                                    View
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
