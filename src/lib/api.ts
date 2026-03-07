import axios, { AxiosInstance } from "axios";

const api: AxiosInstance = axios.create({
    baseURL: 'http://localhost:8000'
})

api.interceptors.request.use((config) => {
    const token: string | null = localStorage.getItem('token')
    if (token != null) {
        config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
})

export default api