"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

const AuthForm = ({ action, onSubmit }: { action: string; onSubmit: (email: string, password: string) => void }) => {
    const [email, setEmail] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-800">
            <div className="w-full max-w-max bg-gray-900 p-8 drop-shadow-gray-600 shadow-xl space-y-6 rounded-2xl">
                <h1 className="text-2xl font-bold text-center">{action} to QueryNest</h1>
                <Input
                    type="email"
                    value={email}
                    placeholder="Email"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                />
                <Input
                    type="password"
                    value={password}
                    placeholder="Password"
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                />
                <Button
                    variant="default"
                    className="w-full hover:cursor-pointer"
                    onClick={() => onSubmit(email, password)}
                >
                    {action}
                </Button>
                <div className="text-center">
                    {action === "Login" ? (
                        <Link className="text-blue-400 hover:underline" href="/register">
                            Don't have an account? Register here
                        </Link>
                    ) : (
                        <Link href="/login" className="text-blue-400 hover:underline">
                            Already have an account? Login here
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuthForm;
