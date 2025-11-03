from fastapi import WebSocket
from typing import Dict, Set
import json


class ConnectionManager:
    """Менеджер WebSocket"""

    def __init__(self):
        # {assignment_id: {websocket1, websocket2, ...}}
        self.assignment_connections: Dict[int, Set[WebSocket]] = {}
        # {course_id: {websocket1, websocket2, ...}}
        self.course_connections: Dict[int, Set[WebSocket]] = {}
        # {user_id: {websocket1, websocket2, ...}}
        self.user_connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """Подключить WebSocket для пользователя"""
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = set()
        self.user_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Отключить WebSocket"""
        # Удаляем из пользовательских подключений
        if user_id in self.user_connections:
            self.user_connections[user_id].discard(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Удаляем из подписок на задания
        for assignment_id in list(self.assignment_connections.keys()):
            self.assignment_connections[assignment_id].discard(websocket)
            if not self.assignment_connections[assignment_id]:
                del self.assignment_connections[assignment_id]

        # Удаляем из подписок на курсы
        for course_id in list(self.course_connections.keys()):
            self.course_connections[course_id].discard(websocket)
            if not self.course_connections[course_id]:
                del self.course_connections[course_id]

    async def subscribe_to_assignment(self, websocket: WebSocket, assignment_id: int):
        """Подписаться на обновления задания"""
        print(f"[WebSocket] Subscribing to assignment {assignment_id}")
        if assignment_id not in self.assignment_connections:
            self.assignment_connections[assignment_id] = set()
        self.assignment_connections[assignment_id].add(websocket)
        print(f"[WebSocket] Now {len(self.assignment_connections[assignment_id])} connections for assignment {assignment_id}")

    async def unsubscribe_from_assignment(self, websocket: WebSocket, assignment_id: int):
        """Отписаться от обновлений задания"""
        if assignment_id in self.assignment_connections:
            self.assignment_connections[assignment_id].discard(websocket)
            if not self.assignment_connections[assignment_id]:
                del self.assignment_connections[assignment_id]

    async def subscribe_to_course(self, websocket: WebSocket, course_id: int):
        """Подписаться на обновления курса"""
        if course_id not in self.course_connections:
            self.course_connections[course_id] = set()
        self.course_connections[course_id].add(websocket)

    async def unsubscribe_from_course(self, websocket: WebSocket, course_id: int):
        """Отписаться от обновлений курса"""
        if course_id in self.course_connections:
            self.course_connections[course_id].discard(websocket)
            if not self.course_connections[course_id]:
                del self.course_connections[course_id]

    async def broadcast_to_assignment(self, assignment_id: int, message: dict):
        """Отправить сообщение всем подписанным на задание"""
        print(f"[WebSocket] Broadcasting to assignment {assignment_id}: {message['type']}")
        print(f"[WebSocket] Assignment connections: {list(self.assignment_connections.keys())}")

        if assignment_id in self.assignment_connections:
            connections = self.assignment_connections[assignment_id]
            print(f"[WebSocket] Found {len(connections)} connections for assignment {assignment_id}")

            dead_connections = set()
            for connection in connections:
                try:
                    print(f"[WebSocket] Sending message to connection...")
                    await connection.send_json(message)
                    print(f"[WebSocket] Message sent successfully")
                except Exception as e:
                    print(f"[WebSocket] Failed to send message: {e}")
                    dead_connections.add(connection)

            # Удаляем мёртвые подключения
            for dead in dead_connections:
                self.assignment_connections[assignment_id].discard(dead)
        else:
            print(f"[WebSocket] No connections found for assignment {assignment_id}")

    async def broadcast_to_course(self, course_id: int, message: dict):
        """Отправить сообщение всем подписанным на курс"""
        if course_id in self.course_connections:
            dead_connections = set()
            for connection in self.course_connections[course_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.add(connection)

            # Удаляем мёртвые подключения
            for dead in dead_connections:
                self.course_connections[course_id].discard(dead)

    async def send_to_user(self, user_id: int, message: dict):
        """Отправить сообщение конкретному пользователю"""
        if user_id in self.user_connections:
            dead_connections = set()
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.add(connection)

            # Удаляем мёртвые подключения
            for dead in dead_connections:
                self.user_connections[user_id].discard(dead)


# Глобальный экземпляр менеджера подключений
manager = ConnectionManager()
