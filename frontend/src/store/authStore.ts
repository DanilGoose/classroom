import { create } from 'zustand';
import type { User } from '../types';
import { getCurrentUser } from '../api/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  initAuth: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (token, user) => {
    // Сохраняем только токен в localStorage
    localStorage.setItem('token', token);
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    // Удаляем только токен
    localStorage.removeItem('token');
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  initAuth: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isLoading: true });
      try {
        // Загружаем пользователя из API
        const user = await getCurrentUser();
        set({ user, isAuthenticated: true, isLoading: false });
      } catch (error) {
        console.error('Failed to load user:', error);
        // Токен невалиден, удаляем его
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },

  loadUser: async () => {
    const token = get().token;
    if (token) {
      try {
        const user = await getCurrentUser();
        set({ user });
      } catch (error) {
        console.error('Failed to load user:', error);
        // Токен невалиден, выходим
        get().logout();
      }
    }
  },

  setUser: (user) => {
    set({ user });
  },
}));
