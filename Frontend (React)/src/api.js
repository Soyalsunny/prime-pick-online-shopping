import axios from "axios";
import { jwtDecode } from "jwt-decode";

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getFallbackBaseURL = (baseURL) => {
  if (!baseURL) return null;
  if (baseURL.includes("127.0.0.1")) {
    return baseURL.replace("127.0.0.1", "localhost");
  }
  if (baseURL.includes("localhost")) {
    return baseURL.replace("localhost", "127.0.0.1");
  }
  return null;
};

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        const expire_date = decoded.exp; // decoded.exp is in seconds
        const current_time = Date.now() / 1000; // Convert ms to seconds
        if (expire_date > current_time) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Ignore malformed tokens so public endpoints still load.
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const isNetworkError = !error.response;
    const fallbackBaseURL = getFallbackBaseURL(originalRequest.baseURL || BASE_URL);

    if (isNetworkError && fallbackBaseURL && !originalRequest._retriedWithFallback) {
      originalRequest._retriedWithFallback = true;
      originalRequest.baseURL = fallbackBaseURL;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

export default api;
