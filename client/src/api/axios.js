import axios from "axios";

// Centralized API configuration: in both dev and prod, we use relative routes.
// Dev proxies are handled by Vite; Production proxies are handled by Nginx.
const BASE_URL = "";

// 1. authApi targets auth-service
export const authApi = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// 2. paymentApi targets payment-service
export const paymentApi = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json"
    }
});

// 3. api (Default) targets backend-service
const api = axios.create({
    baseURL: BASE_URL,
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
export const RESOLVED_BACKEND_API_URL = BASE_URL;
