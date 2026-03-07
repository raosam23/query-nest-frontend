"use client";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { toast } from "sonner";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import AuthForm from "@/components/auth/AuthForm";

const LoginPage = () => {
    const router: AppRouterInstance = useRouter();
    const handleLogin = async (email: string, password: string) => {
        try {
            await login(email, password);
            router.push("/dashboard");
        } catch (exc: unknown) {
            if (exc instanceof Error) {
                console.error(`Exception caused: ${exc.message}`);
                toast.error(exc.message);
            } else {
                console.error(`Unknown Exception caused: ${exc}`);
                toast.error(String(exc));
            }
        }
    };
    return <AuthForm action="Login" onSubmit={handleLogin} />;
};

export default LoginPage;
