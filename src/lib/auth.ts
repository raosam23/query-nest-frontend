import { AxiosResponse } from "axios";
import api from "./api";
import { LoginResponse } from "@/types";

export const login = async (email: string, password: string) => {
    const response: AxiosResponse = await api.post<LoginResponse>("/auth/login", {
        email: email,
        password: password,
    });
    document.cookie = `token=${response.data.access_token}; path=/; expires=${new Date(Date.now() + 60 * 60 * 24 * 7).toUTCString()}`;
    return response.data;
};

export const register = async (email: string, password: string) => {
    const response = await api.post("/auth/register", {
        email: email,
        password: password,
    });
    return response.data;
};

export const logout = () => {
    document.cookie = `token=; path=/; expires=${new Date(Date.now() - 60 * 60 * 24 * 7).toUTCString()}`;
};

export const getToken = () => document.cookie.split("; ").find(row => row.startsWith('token='))?.split('=')[1] ?? null;
