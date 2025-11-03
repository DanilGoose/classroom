from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.user import User
from ..models.course import CourseMember
from ..models.assignment import Assignment
from ..models.message import ChatMessage
from ..schemas.message import MessageCreate, MessageResponse
from ..utils.auth import get_current_user
from ..utils.websocket import manager

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/assignments/{assignment_id}/messages", response_model=List[MessageResponse])
def get_assignment_messages(
    assignment_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверка существования задания
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    # Проверка, что пользователь является участником курса
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == assignment.course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    # Получение сообщений с пагинацией (от самых новых к старым)
    messages = db.query(ChatMessage).filter(
        ChatMessage.assignment_id == assignment_id,
        ChatMessage.is_deleted == False
    ).order_by(ChatMessage.created_at.desc()).offset(offset).limit(limit).all()

    # Преобразование в response модель
    message_responses = []
    for msg in messages:
        message_responses.append(MessageResponse(
            id=msg.id,
            assignment_id=msg.assignment_id,
            user_id=msg.user_id,
            username=msg.user.username,
            message=msg.message,
            created_at=msg.created_at,
            is_deleted=msg.is_deleted
        ))

    return message_responses


@router.post("/assignments/{assignment_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    assignment_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Проверка существования задания
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    # Проверка, что пользователь является участником курса
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == assignment.course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    # Создание сообщения
    new_message = ChatMessage(
        assignment_id=assignment_id,
        user_id=current_user.id,
        message=message_data.message
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    message_response = MessageResponse(
        id=new_message.id,
        assignment_id=new_message.assignment_id,
        user_id=new_message.user_id,
        username=current_user.username,
        message=new_message.message,
        created_at=new_message.created_at,
        is_deleted=new_message.is_deleted
    )

    # Отправляем WebSocket уведомление всем подписанным на задание
    print(f"[Chat] Sending WebSocket broadcast for assignment {assignment_id}")
    await manager.broadcast_to_assignment(
        assignment_id,
        {
            "type": "chat_message",
            "data": message_response.model_dump(mode='json')  # Конвертируем datetime в строки
        }
    )
    print(f"[Chat] WebSocket broadcast completed")

    return message_response


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сообщение не найдено"
        )

    # Проверка прав (только автор сообщения или создатель курса может удалить)
    assignment = db.query(Assignment).filter(Assignment.id == message.assignment_id).first()
    is_creator = (assignment.course.creator_id == current_user.id)
    is_author = (message.user_id == current_user.id)

    if not (is_creator or is_author):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не авторизованы для удаления этого сообщения"
        )

    # Помечаем сообщение как удаленное (мягкое удаление)
    message.is_deleted = True
    message.message = "[Deleted]"
    db.commit()

    # Отправляем WebSocket уведомление об удалении
    await manager.broadcast_to_assignment(
        message.assignment_id,
        {
            "type": "chat_message_deleted",
            "data": {"message_id": message_id}
        }
    )

    return None
