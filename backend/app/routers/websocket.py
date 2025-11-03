from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
import json
from ..database import get_db
from ..models.user import User
from ..models.course import CourseMember
from ..models.assignment import Assignment
from ..utils.websocket import manager

router = APIRouter(tags=["websocket"])


async def get_current_user_from_token(token: str, db: Session) -> User:
    """Получить пользователя из токена для WebSocket"""
    from ..utils.auth import verify_token

    user_id = verify_token(token)
    if not user_id:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    return user


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """
    WebSocket endpoint для real-time обновлений.

    Клиент отправляет команды в формате JSON:
    {
        "action": "subscribe_assignment" | "unsubscribe_assignment" | "subscribe_course" | "unsubscribe_course",
        "id": assignment_id или course_id
    }

    Сервер отправляет события в формате:
    {
        "type": "chat_message" | "assignment_created" | "assignment_updated" | "submission_created" | etc.,
        "data": {...}
    }
    """
    # Аутентификация пользователя
    user = await get_current_user_from_token(token, db)
    if not user:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    # Подключаем WebSocket
    await manager.connect(websocket, user.id)

    try:
        while True:
            # Получаем сообщение от клиента
            data = await websocket.receive_text()
            message = json.loads(data)

            action = message.get("action")
            target_id = message.get("id")

            print(f"[WebSocket Endpoint] Received action: {action}, target_id: {target_id}")

            if action == "subscribe_assignment":
                # Проверяем права доступа к заданию
                assignment = db.query(Assignment).filter(Assignment.id == target_id).first()
                if assignment:
                    is_member = db.query(CourseMember).filter(
                        CourseMember.course_id == assignment.course_id,
                        CourseMember.user_id == user.id
                    ).first()

                    if is_member:
                        print(f"[WebSocket Endpoint] User {user.id} has access to assignment {target_id}")
                        await manager.subscribe_to_assignment(websocket, target_id)
                        await websocket.send_json({
                            "type": "subscribed",
                            "target": "assignment",
                            "id": target_id
                        })
                        print(f"[WebSocket Endpoint] Subscription confirmed")
                    else:
                        print(f"[WebSocket Endpoint] User {user.id} does NOT have access to assignment {target_id}")
                else:
                    print(f"[WebSocket Endpoint] Assignment {target_id} not found")

            elif action == "unsubscribe_assignment":
                await manager.unsubscribe_from_assignment(websocket, target_id)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "target": "assignment",
                    "id": target_id
                })

            elif action == "subscribe_course":
                # Проверяем права доступа к курсу
                is_member = db.query(CourseMember).filter(
                    CourseMember.course_id == target_id,
                    CourseMember.user_id == user.id
                ).first()

                if is_member:
                    await manager.subscribe_to_course(websocket, target_id)
                    await websocket.send_json({
                        "type": "subscribed",
                        "target": "course",
                        "id": target_id
                    })

            elif action == "unsubscribe_course":
                await manager.unsubscribe_from_course(websocket, target_id)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "target": "course",
                    "id": target_id
                })

            elif action == "ping":
                # Поддержка keep-alive
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, user.id)
