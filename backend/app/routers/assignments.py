from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import json
from ..database import get_db
from ..models.user import User
from ..models.course import Course, CourseMember
from ..models.assignment import Assignment, AssignmentFile
from ..models.assignment_view import AssignmentView
from ..models.submission import Submission
from ..schemas.assignment import AssignmentCreate, AssignmentUpdate, AssignmentResponse
from ..utils.auth import get_current_user
from ..utils.file_upload import save_upload_file, delete_file
from ..utils.websocket import manager

router = APIRouter(prefix="/assignments", tags=["assignments"])


@router.post("/courses/{course_id}/assignments", response_model=AssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    course_id: int,
    assignment_data: AssignmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден"
        )

    # Только создатель курса может создавать задания
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может создавать задания"
        )

    # Подготовка grade_options (конвертация в JSON строку)
    grade_options_json = None
    if assignment_data.grade_options:
        grade_options_json = json.dumps(assignment_data.grade_options)

    new_assignment = Assignment(
        course_id=course_id,
        title=assignment_data.title,
        description=assignment_data.description,
        created_by=current_user.id,
        due_date=assignment_data.due_date,
        grading_type=assignment_data.grading_type,
        grade_min=assignment_data.grade_min,
        grade_max=assignment_data.grade_max,
        grade_options=grade_options_json,
        max_attempts=assignment_data.max_attempts
    )

    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    assignment_response = AssignmentResponse.model_validate(new_assignment)

    # Отправляем WebSocket уведомление всем участникам курса
    await manager.broadcast_to_course(
        course_id,
        {
            "type": "assignment_created",
            "data": assignment_response.model_dump(mode='json')
        }
    )

    return assignment_response


@router.get("/courses/{course_id}/assignments")
def get_course_assignments(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    # Получаем курс для проверки, является ли текущий пользователь учителем
    course = db.query(Course).filter(Course.id == course_id).first()
    is_teacher = course.creator_id == current_user.id if course else False

    assignments = db.query(Assignment).filter(Assignment.course_id == course_id).order_by(Assignment.created_at.desc()).all()

    result = []
    for assignment in assignments:
        assignment_dict = AssignmentResponse.model_validate(assignment).model_dump()

        # Добавляем is_read только для студентов
        if not is_teacher:
            is_read = db.query(AssignmentView).filter(
                AssignmentView.assignment_id == assignment.id,
                AssignmentView.user_id == current_user.id
            ).first() is not None
            assignment_dict['is_read'] = is_read
        else:
            assignment_dict['is_read'] = True  # Для учителя все задания считаются прочитанными

        result.append(assignment_dict)

    return result


# Все задания которые нужно выполнить пользователю
@router.get("/my-assignments")
def get_my_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Получаем все курсы, в которых пользователь является участником
    member_courses = db.query(CourseMember).filter(
        CourseMember.user_id == current_user.id
    ).all()

    course_ids = [m.course_id for m in member_courses]

    if not course_ids:
        return []

    # Получаем все задания из этих курсов, КРОМЕ тех, которые создал сам пользователь
    assignments = db.query(Assignment).filter(
        Assignment.course_id.in_(course_ids),
        Assignment.created_by != current_user.id  # Исключаем задания, созданные самим пользователем
    ).order_by(Assignment.created_at.desc()).all()

    result = []
    for assignment in assignments:
        # Получаем информацию о курсе
        course = db.query(Course).filter(Course.id == assignment.course_id).first()

        # Проверяем, есть ли сдача от пользователя
        submission = db.query(Submission).filter(
            Submission.assignment_id == assignment.id,
            Submission.student_id == current_user.id,
            Submission.is_deleted == 0  # Фильтруем удалённые сдачи
        ).order_by(Submission.submitted_at.desc()).first()

        # Проверяем, прочитано ли задание студентом
        is_read = db.query(AssignmentView).filter(
            AssignmentView.assignment_id == assignment.id,
            AssignmentView.user_id == current_user.id
        ).first() is not None

        assignment_data = AssignmentResponse.model_validate(assignment).model_dump()
        assignment_data['course_title'] = course.title if course else None
        assignment_data['course_is_archived'] = course.is_archived if course else 0
        assignment_data['is_submitted'] = submission is not None
        assignment_data['is_graded'] = submission.score is not None if submission else False
        assignment_data['score'] = submission.score if submission else None
        assignment_data['is_read'] = is_read

        result.append(assignment_data)

    return result


@router.get("/{assignment_id}", response_model=AssignmentResponse)
def get_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == assignment.course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    return AssignmentResponse.model_validate(assignment)


@router.post("/{assignment_id}/mark-read", status_code=status.HTTP_204_NO_CONTENT)
def mark_assignment_as_read(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пометить задание как прочитанное студентом"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    # Проверяем, что пользователь является участником курса
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == assignment.course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вы не являетесь участником этого курса"
        )

    # Проверяем пользователь != учитель
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    if course.creator_id == current_user.id:
        return None

    # Проверяем, не было ли уже помечено
    existing_view = db.query(AssignmentView).filter(
        AssignmentView.assignment_id == assignment_id,
        AssignmentView.user_id == current_user.id
    ).first()

    if not existing_view:
        view = AssignmentView(
            assignment_id=assignment_id,
            user_id=current_user.id
        )
        db.add(view)
        db.commit()

    return None


@router.put("/{assignment_id}", response_model=AssignmentResponse)
async def update_assignment(
    assignment_id: int,
    assignment_data: AssignmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может редактировать задание
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может редактировать задания"
        )

    # Обновляем только переданные поля
    if assignment_data.title is not None:
        assignment.title = assignment_data.title
    if assignment_data.description is not None:
        assignment.description = assignment_data.description
    if assignment_data.due_date is not None:
        assignment.due_date = assignment_data.due_date
    if assignment_data.grading_type is not None:
        assignment.grading_type = assignment_data.grading_type
    if assignment_data.grade_min is not None:
        assignment.grade_min = assignment_data.grade_min
    if assignment_data.grade_max is not None:
        assignment.grade_max = assignment_data.grade_max
    if assignment_data.grade_options is not None:
        assignment.grade_options = json.dumps(assignment_data.grade_options)
    if assignment_data.max_attempts is not None:
        assignment.max_attempts = assignment_data.max_attempts

    db.commit()
    db.refresh(assignment)

    assignment_response = AssignmentResponse.model_validate(assignment)

    # Отправляем WebSocket уведомление всем участникам курса
    await manager.broadcast_to_course(
        assignment.course_id,
        {
            "type": "assignment_updated",
            "data": assignment_response.model_dump(mode='json')
        }
    )

    return assignment_response


@router.post("/{assignment_id}/files", status_code=status.HTTP_201_CREATED)
async def upload_assignment_file(
    assignment_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может загружать файлы к заданию
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может загружать файлы к заданию"
        )

    # Сохранение файла
    file_path, file_name = save_upload_file(file)

    # Создание записи в БД
    assignment_file = AssignmentFile(
        assignment_id=assignment_id,
        file_path=file_path,
        file_name=file_name
    )

    db.add(assignment_file)
    db.commit()
    db.refresh(assignment_file)

    return {
        "id": assignment_file.id,
        "file_name": assignment_file.file_name,
        "message": "File uploaded successfully"
    }


@router.delete("/{assignment_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment_file(
    assignment_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_record = db.query(AssignmentFile).filter(
        AssignmentFile.id == file_id,
        AssignmentFile.assignment_id == assignment_id
    ).first()

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может удалять файлы
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может удалять файлы"
        )

    # Удаление файла из файловой системы
    delete_file(file_record.file_path)

    # Удаление записи из БД
    db.delete(file_record)
    db.commit()

    return None


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_assignment(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить задание (только для создателя курса)"""
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может удалять задания
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может удалять задания"
        )

    # Удаляем все файлы задания из файловой системы
    assignment_files = db.query(AssignmentFile).filter(
        AssignmentFile.assignment_id == assignment_id
    ).all()

    for file_record in assignment_files:
        delete_file(file_record.file_path)

    # Сохраняем course_id для WebSocket уведомления
    course_id = assignment.course_id

    # Удаляем задание из БД (каскадно удалятся все связанные записи)
    db.delete(assignment)
    db.commit()

    # Отправляем WebSocket уведомление всем участникам курса
    await manager.broadcast_to_course(
        course_id,
        {
            "type": "assignment_deleted",
            "data": {"assignment_id": assignment_id}
        }
    )

    return None


@router.get("/{assignment_id}/ungraded-submissions")
def get_assignment_ungraded_submissions(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить все непроверенные работы по заданию (только для создателя курса)"""
    from ..schemas.submission import SubmissionResponse

    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )

    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может видеть непроверенные работы
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может просматривать непроверенные работы"
        )

    # Получаем все непроверенные сдачи по этому заданию
    ungraded_submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.score == None,
        Submission.is_deleted == 0  # Фильтруем удалённые сдачи
    ).order_by(Submission.submitted_at.desc()).all()

    result = []
    for submission in ungraded_submissions:
        student = db.query(User).filter(User.id == submission.student_id).first()
        response = SubmissionResponse.model_validate(submission)
        response.student_name = student.username if student else None
        result.append(response)

    return result
