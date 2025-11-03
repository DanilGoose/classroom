import { useEffect, useCallback } from 'react';
import { websocketService } from '../services/websocket';

/**
 * React хук для работы с WebSocket
 *
 * @example
 * // В компоненте задания
 * useWebSocket('chat_message', (data) => {
 *   console.log('New message:', data);
 *   // Обновить список сообщений
 * });
 *
 * @example
 * // В компоненте курса
 * useWebSocket('assignment_created', (data) => {
 *   console.log('New assignment:', data);
 *   // Добавить задание в список
 * });
 */
export function useWebSocket(
  eventType: string | string[],
  handler: (data: any) => void,
  dependencies: any[] = []
) {
  const memoizedHandler = useCallback(handler, dependencies);

  useEffect(() => {
    const types = Array.isArray(eventType) ? eventType : [eventType];
    const unsubscribers: (() => void)[] = [];

    // Подписываемся на все типы событий
    types.forEach(type => {
      const unsubscribe = websocketService.on(type, memoizedHandler);
      unsubscribers.push(unsubscribe);
    });

    // Отписываемся при размонтировании
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [eventType, memoizedHandler]);
}

/**
 * Хук для подписки на обновления задания
 *
 * @example
 * useAssignmentSubscription(assignmentId);
 */
export function useAssignmentSubscription(assignmentId: number | null | undefined) {
  useEffect(() => {
    if (!assignmentId) return;

    // Функция для подписки после подключения
    const subscribe = () => {
      if (websocketService.isConnected()) {
        console.log('Subscribing to assignment:', assignmentId);
        websocketService.subscribeToAssignment(assignmentId);
      } else {
        // Если еще не подключено, попробуем через 1 секунду
        console.log('WebSocket not connected yet, retrying in 1s...');
        setTimeout(subscribe, 1000);
      }
    };

    subscribe();

    return () => {
      if (websocketService.isConnected()) {
        console.log('Unsubscribing from assignment:', assignmentId);
        websocketService.unsubscribeFromAssignment(assignmentId);
      }
    };
  }, [assignmentId]);
}

/**
 * Хук для подписки на обновления курса
 *
 * @example
 * useCourseSubscription(courseId);
 */
export function useCourseSubscription(courseId: number | null | undefined) {
  useEffect(() => {
    if (!courseId) return;

    // Функция для подписки после подключения
    const subscribe = () => {
      if (websocketService.isConnected()) {
        console.log('Subscribing to course:', courseId);
        websocketService.subscribeToCourse(courseId);
      } else {
        // Если еще не подключено, попробуем через 1 секунду
        console.log('WebSocket not connected yet, retrying in 1s...');
        setTimeout(subscribe, 1000);
      }
    };

    subscribe();

    return () => {
      if (websocketService.isConnected()) {
        console.log('Unsubscribing from course:', courseId);
        websocketService.unsubscribeFromCourse(courseId);
      }
    };
  }, [courseId]);
}
