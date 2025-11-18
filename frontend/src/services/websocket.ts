// WebSocket Service для real-time обновлений

type MessageHandler = (message: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private token: string | null = null;
  private isConnecting = false;
  private pingInterval: number | null = null;

  // Подключиться к WebSocket серверу
  connect(token: string) {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.token = token;

    // Определяем WebSocket URL на основе текущего протокола и хоста
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let host = window.location.host;

    // В dev режиме (Vite на порту 5173) подключаемся к бэкенду на порту 8000
    if (host.includes(':5173')) {
      host = 'localhost:8000';
    }

    const wsUrl = `${protocol}//${host}`;
    const url = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;

    console.log('Connecting to WebSocket:', wsUrl);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Запускаем ping для keep-alive
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.stopPing();
        this.attemptReconnect();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  // Отключиться от WebSocket сервера
  disconnect() {
    this.reconnectAttempts = this.maxReconnectAttempts;
    this.stopPing();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Попытка переподключения
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.token) {
      console.log('Max reconnect attempts reached or no token');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  // Запустить ping для keep-alive
  private startPing() {
    this.pingInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ action: 'ping' });
      }
    }, 30000); // Каждые 30 секунд
  }

  // Остановить ping
  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Отправить сообщение на сервер
  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Подписаться на обновления задания
  subscribeToAssignment(assignmentId: number) {
    this.send({
      action: 'subscribe_assignment',
      id: assignmentId
    });
  }

  // Отписаться от обновлений задания
  unsubscribeFromAssignment(assignmentId: number) {
    this.send({
      action: 'unsubscribe_assignment',
      id: assignmentId
    });
  }

  // Подписаться на обновления курса
  subscribeToCourse(courseId: number) {
    this.send({
      action: 'subscribe_course',
      id: courseId
    });
  }

  // Отписаться от обновлений курса
  unsubscribeFromCourse(courseId: number) {
    this.send({
      action: 'unsubscribe_course',
      id: courseId
    });
  }

  // Добавить обработчик для определенного типа сообщений
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Возвращаем функцию для отписки
    return () => {
      this.off(type, handler);
    };
  }

  // Удалить обработчик
  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    }
  }

  // Обработать входящее сообщение
  private handleMessage(message: any) {
    const { type } = message;

    console.log('WebSocket message received:', type, message);

    // Вызываем все обработчики для этого типа сообщения
    const handlers = this.handlers.get(type);
    if (handlers) {
      console.log(`Found ${handlers.size} handlers for type: ${type}`);
      handlers.forEach(handler => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`Error in WebSocket handler for type ${type}:`, error);
        }
      });
    } else {
      console.log(`No handlers found for type: ${type}`);
    }

    // Также вызываем обработчики для типа '*' (все сообщения)
    const allHandlers = this.handlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in WebSocket wildcard handler:', error);
        }
      });
    }
  }

  // Проверить, подключен ли WebSocket
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Глобальный экземпляр
export const websocketService = new WebSocketService();
