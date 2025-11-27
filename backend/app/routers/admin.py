from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.user import User
from ..models.course import Course, CourseMember
from ..models.assignment import Assignment
from ..schemas.user import UserResponse
from ..schemas.course import CourseResponse, CourseMemberResponse
from ..schemas.assignment import AssignmentResponse
from ..utils.auth import get_current_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [UserResponse.model_validate(user) for user in users]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )

    # Нельзя удалить самого себя
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невозможно удалить себя"
        )

    db.delete(user)
    db.commit()

    return None


@router.get("/courses", response_model=List[CourseResponse])
def get_all_courses(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    courses = db.query(Course).all()
    course_responses = []

    for course in courses:
        course_response = CourseResponse.model_validate(course)
        course_response.is_creator = False
        course_response.member_count = len(course.members)
        course_responses.append(course_response)

    return course_responses


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(
    course_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    db.delete(course)
    db.commit()

    return None


@router.get("/courses/{course_id}/members", response_model=List[CourseMemberResponse])
def get_course_members_admin(
    course_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Получить всех участников курса (только для админов)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    members = db.query(CourseMember).filter(CourseMember.course_id == course_id).all()

    member_responses = []
    for member in members:
        member_responses.append(CourseMemberResponse(
            id=member.id,
            user_id=member.user.id,
            username=member.user.username,
            email=member.user.email,
            joined_at=member.joined_at
        ))

    return member_responses


@router.get("/courses/{course_id}/assignments", response_model=List[AssignmentResponse])
def get_course_assignments_admin(
    course_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Получить все задания курса (только для админов)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    assignments = db.query(Assignment).filter(Assignment.course_id == course_id).all()

    assignment_responses = []
    for assignment in assignments:
        assignment_response = AssignmentResponse.model_validate(assignment)
        assignment_responses.append(assignment_response)

    return assignment_responses
