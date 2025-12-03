from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os
from ..database import get_db
from ..models.user import User
from ..models.course import Course, CourseMember
from ..models.assignment import Assignment, AssignmentFile
from ..models.submission import Submission, SubmissionFile
from ..schemas.user import UserResponse
from ..schemas.course import CourseResponse, CourseMemberResponse
from ..schemas.assignment import AssignmentResponse
from ..schemas.submission import SubmissionResponse
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


@router.get("/assignments/{assignment_id}", response_model=AssignmentResponse)
def get_assignment_admin(
    assignment_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Получить детальную информацию о задании (только для админов)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найден"
        )

    return AssignmentResponse.model_validate(assignment)


@router.get("/assignments/{assignment_id}/files/{file_id}/download")
async def download_assignment_file_admin(
    assignment_id: int,
    file_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Скачивание файла задания (только для админов)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    file_record = db.query(AssignmentFile).filter(
        AssignmentFile.id == file_id,
        AssignmentFile.assignment_id == assignment_id
    ).first()

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    file_path = os.path.join(os.getcwd(), file_record.file_path)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )

    return FileResponse(
        path=file_path,
        media_type='application/octet-stream',
        filename=file_record.file_name
    )


@router.get("/assignments/{assignment_id}/submissions")
def get_assignment_submissions_admin(
    assignment_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Получить все сдачи задания (только для админов)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.is_deleted == 0
    ).order_by(Submission.submitted_at.desc()).all()

    result = []
    for submission in submissions:
        student = db.query(User).filter(User.id == submission.student_id).first()
        
        # Создаем простой словарь вместо сложной схемы
        submission_data = {
            "id": submission.id,
            "assignment_id": submission.assignment_id,
            "student_id": submission.student_id,
            "content": submission.content,
            "score": submission.score,
            "teacher_comment": submission.teacher_comment,
            "submitted_at": submission.submitted_at.isoformat(),
            "graded_at": submission.graded_at.isoformat() if submission.graded_at else None,
            "viewed_by_teacher": submission.viewed_by_teacher,
            "student_name": student.username if student else None,
            "files": []
        }
        result.append(submission_data)

    return result


@router.get("/submissions")
def get_all_submissions_admin(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Получить все сдачи всех заданий (только для админов)"""
    submissions = db.query(Submission).filter(
        Submission.is_deleted == 0
    ).order_by(Submission.submitted_at.desc()).all()

    result = []
    for submission in submissions:
        student = db.query(User).filter(User.id == submission.student_id).first()
        assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
        
        # Получаем файлы сдачи
        files = []
        for file_record in submission.files:
            files.append({
                "id": file_record.id,
                "file_name": file_record.file_name,
                "file_path": file_record.file_path,
                "uploaded_at": file_record.uploaded_at.isoformat()
            })
        
        submission_data = {
            "id": submission.id,
            "assignment_id": submission.assignment_id,
            "assignment_title": assignment.title if assignment else None,
            "course_id": assignment.course_id if assignment else None,
            "student_id": submission.student_id,
            "student_name": student.username if student else None,
            "content": submission.content,
            "score": submission.score,
            "teacher_comment": submission.teacher_comment,
            "submitted_at": submission.submitted_at.isoformat(),
            "graded_at": submission.graded_at.isoformat() if submission.graded_at else None,
            "viewed_by_teacher": submission.viewed_by_teacher,
            "files": files
        }
        result.append(submission_data)

    return result


@router.get("/submissions/{submission_id}/files/{file_id}/download")
async def download_submission_file_admin(
    submission_id: int,
    file_id: int,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Скачивание файла сдачи (только для админов)"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    file_record = db.query(SubmissionFile).filter(
        SubmissionFile.id == file_id,
        SubmissionFile.submission_id == submission_id
    ).first()

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    file_path = os.path.join(os.getcwd(), file_record.file_path)

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )

    return FileResponse(
        path=file_path,
        media_type='application/octet-stream',
        filename=file_record.file_name
    )
