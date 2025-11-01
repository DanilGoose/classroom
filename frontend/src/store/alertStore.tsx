import { create } from 'zustand';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export interface Alert {
  id: string;
  message: string;
  type: AlertType;
  isExiting?: boolean;
}

interface AlertState {
  alerts: Alert[];
  addAlert: (message: string, type?: AlertType) => void;
  removeAlert: (id: string) => void;
  startExitAnimation: (id: string) => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  addAlert: (message: string, type: AlertType = 'info') => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      alerts: [...state.alerts, { id, message, type, isExiting: false }],
    }));

    // Автоматически запускаем анимацию выхода через 5 секунд
    setTimeout(() => {
      get().startExitAnimation(id);
    }, 5000);
  },
  startExitAnimation: (id: string) => {
    // Устанавливаем флаг isExiting для запуска анимации
    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === id ? { ...alert, isExiting: true } : alert
      ),
    }));

    // Удаляем алерт после завершения анимации (300ms)
    setTimeout(() => {
      set((state) => ({
        alerts: state.alerts.filter((alert) => alert.id !== id),
      }));
    }, 300);
  },
  removeAlert: (id: string) => {
    get().startExitAnimation(id);
  },
}));
