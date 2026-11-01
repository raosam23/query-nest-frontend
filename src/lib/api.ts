import axios, { AxiosInstance } from "axios";
import { getApiBaseUrl } from "./config";
import { tokenFromCookie } from "./token";

const api: AxiosInstance = axios.create({
    baseURL: getApiBaseUrl(),
})

api.interceptors.request.use((config) => {
    const token: string | null = tokenFromCookie(document.cookie);
    if (token != null) {
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

export default api