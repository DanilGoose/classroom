import { useEffect } from 'react';
import { websocketService } from '../services/websocket';
import { useAuthStore } from '../store/authStore';

/**
 * Хук для инициализации WebSocket подключения
 * Использовать один раз в корневом компоненте (App.tsx)
 *
 * @example
 * // В App.tsx
 * function App() {
 *   useWebSocketInit();
 *   // ...
 * }
 */
export function useWebSocketInit() {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Подключаемся к WebSocket
      websocketService.connect(token);

      // Отключаемся при размонтировании или выходе из системы
      return () => {
        websocketService.disconnect();
      };
    } else {
      // Если пользователь вышел, отключаемся
      websocketService.disconnect();
    }
  }, [isAuthenticated, token]);
}
