import axios from "axios";

// 1. authApi targets auth-service (Port 5001)
export const authApi = axios.create({
    baseURL: import.meta.env.VITE_AUTH_API_URL || import.meta.env.VITE_AUTH_API || "http://localhost:5001",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// 2. paymentApi targets payment-service (Port 5002)
export const paymentApi = axios.create({
    baseURL: import.meta.env.VITE_PAYMENT_API_URL || import.meta.env.VITE_PAYMENT_API || "http://localhost:5002",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// 3. api (Default) targets backend-service (Port 5050)
const api = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_API_URL || import.meta.env.VITE_BACKEND_API || import.meta.env.VITE_API_URL || "http://localhost:5050",
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// Interceptor to handle session expiration globally
const handleSessionExpiration = (error) => {
    if (error.response?.status === 401) {
        console.warn("Session expired or unauthorized request detected.");
    }
    return Promise.reject(error);
};

api.interceptors.response.use((r) => r, handleSessionExpiration);
authApi.interceptors.response.use((r) => r, handleSessionExpiration);
paymentApi.interceptors.response.use((r) => r, handleSessionExpiration);

export default api;
