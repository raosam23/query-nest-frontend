"use client";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/auth";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";
import AuthForm from "@/components/auth/AuthForm";

const Register = () => {
    const router: AppRouterInstance = useRouter();
    const handleRegister = async (email: string, password: string) => {
        try {
            await register(email, password);
            await login(email, password);
            toast.success("Account created successfully. Welcome to QueryNest!")
            router.push("/dashboard");
        } catch (exc: unknown) {
            if (exc instanceof Error) {
                console.error(`Exception caused: ${exc.message}`);
                toast.error(exc.message);
            } else {
                console.error(`Exception caused: ${exc}`);
                toast.error(String(exc));
            }
        }
    };
    return <AuthForm action="Sign Up" onSubmit={handleRegister} />;
};

export default Register;
