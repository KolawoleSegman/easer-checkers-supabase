import axios from "axios";

export const API_BASE_URL = "https://easer-checker-backend-ejri.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token && token !== "undefined" && token !== "null") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url || "";
    const isAuthForm = url.startsWith("/auth/");
    if (
      error.response?.status === 401 &&
      !isAuthForm &&
      localStorage.getItem("token")
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
