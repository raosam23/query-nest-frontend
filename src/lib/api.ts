import axios, { AxiosInstance } from "axios";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
export const WS_BASE_URL = API_BASE_URL.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:");

const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
})

api.interceptors.request.use((config) => {
    const token: string | null = document.cookie.split("; ").find(row => row.startsWith('token='))?.split('=')[1] ?? null;
    if (token != null) {
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

export default api
