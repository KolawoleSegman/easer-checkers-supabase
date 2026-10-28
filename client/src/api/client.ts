import axios from "axios";

// Falls back to the deployed backend only if no env var is configured, so
// local development (`npm run dev` with a local server) works out of the box.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "https://easer-checker-backend.onrender.com";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only treat 401 as "session expired" when we actually had a session and
    // the call was not the login/register form itself. Otherwise a wrong
    // password would reload the page and wipe the error message.
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
