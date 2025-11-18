import axios from 'axios';

// В production используем относительный путь (когда фронтенд и бэкенд на одном домене)
// В dev режиме используем полный URL
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.MODE === 'production' ? '/api' : 'http://localhost:8000/api');

// Базовый URL для статических файлов (без /api)
export const getBaseUrl = () => {
  if (import.meta.env.MODE === 'production') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

// Функция для получения полного URL файла
export const getFileUrl = (filePath: string) => {
  return `${getBaseUrl()}/${filePath}`;
};

const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor для добавления токена
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor для обработки ошибок
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Не редиректим если уже на login/register
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
