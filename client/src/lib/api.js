import axios from 'axios';

// When deployed on Vercel, VITE_API_URL points to the Render backend (e.g. https://quickpoll-api.onrender.com)
// In local dev or unified Render deployment, it falls back to '/api'
const rawApiUrl = import.meta.env.VITE_API_URL;
const baseURL = rawApiUrl
  ? `${rawApiUrl.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('qpl_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercept 401 responses and clear stale auth
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('qpl_token');
      localStorage.removeItem('qpl_user');
      // Redirect handled by AuthContext
    }
    return Promise.reject(error);
  }
);

export default api;

