import { AxiosResponse } from "axios";
import api from "./api";
import { LoginResponse } from "@/types";

export const login = async (email: string, password: string) => {
    const response: AxiosResponse = await api.post<LoginResponse>("/auth/login", {
        email: email,
        password: password,
    });
    localStorage.setItem("token", response.data.access_token);
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
    localStorage.removeItem("token");
};

export const getToken = () => localStorage.getItem("token");
