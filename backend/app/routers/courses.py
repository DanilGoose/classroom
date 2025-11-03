from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
import random
import string
from ..database import get_db
from ..models.user import User
from ..models.course import Course, CourseMember
from ..models.assignment import Assignment
from ..models.submission import Submission
from ..schemas.course import CourseCreate, CourseUpdate, CourseResponse, CourseJoin, CourseMemberResponse
from ..utils.auth import get_current_user

router = APIRouter(prefix="/courses", tags=["courses"])


def generate_course_code() -> str:
    """Генерирует уникальный код курса из 9 заглавных букв"""
    return ''.join(random.choices(string.ascii_uppercase, k=9))


@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    course_data: CourseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Генерация уникального кода
    code = generate_course_code()
    while db.query(Course).filter(Course.code == code).first():
        code = generate_course_code()

    # Создание курса
    new_course = Course(
        title=course_data.title,
        description=course_data.description,
        code=code,
        creator_id=current_user.id
    )

    db.add(new_course)
    db.commit()
    db.refresh(new_course)

    # Автоматически добавляем создателя в участники
    member = CourseMember(
        course_id=new_course.id,
        user_id=current_user.id
    )
    db.add(member)
    db.commit()

    response = CourseResponse.model_validate(new_course)
    response.is_creator = True
    response.member_count = 1

    return response


@router.post("/join", response_model=CourseResponse)
def join_course(
    join_data: CourseJoin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Поиск курса по коду
    course = db.query(Course).filter(Course.code == join_data.code).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Проверка, не является ли пользователь уже участником
    existing_member = db.query(CourseMember).filter(
        CourseMember.course_id == course.id,
        CourseMember.user_id == current_user.id
    ).first()

    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Вы уже являетесь участником этого курса"
        )

    # Добавление пользователя в курс
    member = CourseMember(
        course_id=course.id,
        user_id=current_user.id
    )
    db.add(member)
    db.commit()

    member_count = db.query(CourseMember).filter(CourseMember.course_id == course.id).count()

    response = CourseResponse.model_validate(course)
    response.is_creator = (course.creator_id == current_user.id)
    response.member_count = member_count

    return response


@router.get("", response_model=List[CourseResponse])
def get_my_courses(
    archived: Optional[bool] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Получаем все курсы пользователя через таблицу course_members
    memberships = db.query(CourseMember).filter(CourseMember.user_id == current_user.id).all()
    courses = []

    for membership in memberships:
        course = membership.course

        # Фильтрация по статусу архивации
        if archived is not None:
            course_is_archived = course.is_archived == 1
            if archived != course_is_archived:
                continue

        member_count = db.query(CourseMember).filter(CourseMember.course_id == course.id).count()

        course_response = CourseResponse.model_validate(course)
        course_response.is_creator = (course.creator_id == current_user.id)
        course_response.member_count = member_count
        courses.append(course_response)

    return courses


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Проверка, что пользователь является участником
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    member_count = db.query(CourseMember).filter(CourseMember.course_id == course.id).count()

    response = CourseResponse.model_validate(course)
    response.is_creator = (course.creator_id == current_user.id)
    response.member_count = member_count

    return response


@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    course_data: CourseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель курса может его редактировать
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может редактировать его"
        )

    # Обновляем только переданные поля
    if course_data.title is not None:
        course.title = course_data.title
    if course_data.description is not None:
        course.description = course_data.description

    db.commit()
    db.refresh(course)

    member_count = db.query(CourseMember).filter(CourseMember.course_id == course.id).count()

    response = CourseResponse.model_validate(course)
    response.is_creator = True
    response.member_count = member_count

    return response


@router.get("/{course_id}/members", response_model=List[CourseMemberResponse])
def get_course_members(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель может видеть список участников
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может просматривать участников"
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


@router.delete("/{course_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_course_member(
    course_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель может удалять участников
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может удалять участников"
        )

    # Нельзя удалить самого создателя
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невозможно удалить создателя курса"
        )

    member = db.query(CourseMember).filter(
        CourseMember.course_id == course_id,
        CourseMember.user_id == user_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Участник не найден"
        )

    db.delete(member)
    db.commit()

    return None


@router.get("/{course_id}/gradebook")
def get_course_gradebook(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить таблицу оценок для курса (только для создателя курса)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель курса может видеть таблицу оценок
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может просматривать таблицу оценок"
        )

    # Получаем всех студентов курса (кроме создателя)
    members = db.query(CourseMember).filter(
        CourseMember.course_id == course_id,
        CourseMember.user_id != current_user.id
    ).all()

    students = []
    for member in members:
        students.append({
            "id": member.user.id,
            "username": member.user.username,
            "email": member.user.email
        })

    # Получаем все задания курса
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id
    ).order_by(Assignment.created_at).all()

    assignment_list = []
    for assignment in assignments:
        assignment_list.append({
            "id": assignment.id,
            "title": assignment.title,
            "due_date": assignment.due_date,
            "grading_type": assignment.grading_type,
            "grade_min": assignment.grade_min,
            "grade_max": assignment.grade_max,
            "grade_options": assignment.grade_options
        })

    # Получаем все сдачи для курса
    # Для числовых оценок - берем максимальную, для текстовых - последнюю
    gradebook = {}
    for student in students:
        gradebook[student["id"]] = {}
        for assignment in assignments:
            # Получаем все сдачи студента по этому заданию
            # fix: удалённые сдачи не учитываются
            submissions = db.query(Submission).filter(
                Submission.assignment_id == assignment.id,
                Submission.student_id == student["id"],
                Submission.is_deleted == 0  # Не учитываем удалённые сдачи
            ).order_by(Submission.submitted_at.desc()).all()

            if submissions:
                # Подсчитываем количество попыток
                total_attempts = len(submissions)
                graded_submissions = [s for s in submissions if s.score is not None]

                best_score = None
                best_submission = None

                if graded_submissions:
                    if assignment.grading_type == "numeric":
                        # Для числовых оценок - находим максимальную
                        best_submission = max(graded_submissions, key=lambda s: float(s.score))
                        best_score = best_submission.score
                    else:
                        # Для текстовых оценок - берем последнюю проверенную
                        best_submission = graded_submissions[0]  # Уже отсортировано по дате
                        best_score = best_submission.score

                # Берем последнюю сдачу для информации о дате
                latest_submission = submissions[0]

                gradebook[student["id"]][assignment.id] = {
                    "id": best_submission.id if best_submission else latest_submission.id,
                    "submitted": True,
                    "graded": best_score is not None,
                    "score": best_score,
                    "submitted_at": latest_submission.submitted_at,
                    "attempts": total_attempts,
                    "has_multiple_attempts": total_attempts > 1
                }
            else:
                gradebook[student["id"]][assignment.id] = {
                    "submitted": False,
                    "graded": False,
                    "score": None,
                    "attempts": 0,
                    "has_multiple_attempts": False
                }

    return {
        "students": students,
        "assignments": assignment_list,
        "gradebook": gradebook
    }


@router.get("/{course_id}/ungraded-submissions")
def get_course_ungraded_submissions(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все непроверенные работы по курсу (только для создателя курса)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель курса может видеть непроверенные работы
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может просматривать непроверенные работы"
        )

    # Получаем все задания курса
    assignments = db.query(Assignment).filter(
        Assignment.course_id == course_id
    ).all()

    assignment_ids = [a.id for a in assignments]

    # Получаем все непроверенные сдачи по этим заданиям
    ungraded_submissions = db.query(Submission).filter(
        Submission.assignment_id.in_(assignment_ids),
        Submission.score == None
    ).order_by(Submission.submitted_at.desc()).all()

    result = []
    for submission in ungraded_submissions:
        student = db.query(User).filter(User.id == submission.student_id).first()
        assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()

        result.append({
            "submission_id": submission.id,
            "assignment_id": assignment.id,
            "assignment_title": assignment.title,
            "student_id": student.id,
            "student_name": student.username,
            "submitted_at": submission.submitted_at,
            "content": submission.content
        })

    return result


@router.post("/{course_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Выйти из курса (только для студентов, не создателей)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Создатель курса не может покинуть свой курс
    if course.creator_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Создатель курса не может покинуть курс"
        )

    # Проверяем, что пользователь является участником
    member = db.query(CourseMember).filter(
        CourseMember.course_id == course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Вы не являетесь участником этого курса"
        )

    db.delete(member)
    db.commit()

    return None


@router.put("/{course_id}/archive", response_model=CourseResponse)
def archive_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Заархивировать/разархивировать курс (только для создателя)"""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель курса может архивировать его
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может архивировать его"
        )

    # Переключаем статус архивации
    course.is_archived = 1 if course.is_archived == 0 else 0
    db.commit()
    db.refresh(course)

    member_count = db.query(CourseMember).filter(CourseMember.course_id == course.id).count()

    response = CourseResponse.model_validate(course)
    response.is_creator = True
    response.member_count = member_count

    return response
