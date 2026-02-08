from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, case
from typing import List, Optional
from datetime import datetime
import json
import os
import mimetypes
from ..database import get_db
from ..models.user import User
from ..models.course import Course, CourseMember
from ..models.assignment import Assignment
from ..models.submission import (
    Submission,
    SubmissionFile,
    SubmissionReviewAsset,
    SubmissionFeedbackFile,
)
from ..schemas.submission import (
    SubmissionCreate,
    SubmissionGrade,
    SubmissionResponse,
    SubmissionFileResponse,
    ReviewAssetResponse,
    SubmissionFeedbackFileResponse,
)
from ..utils.auth import get_current_user
from ..utils.file_upload import save_upload_file, delete_file
from ..utils.document_conversion import (
    is_word_file,
    is_pdf_file,
    is_image_file,
    get_review_kind,
    convert_word_to_pdf,
    ConversionError,
)
from ..utils.websocket import manager

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _guess_mime_type(file_name: str, fallback: str = "application/octet-stream") -> str:
    guessed, _ = mimetypes.guess_type(file_name)
    return guessed or fallback


def _to_abs_path(file_path: str) -> str:
    return file_path if os.path.isabs(file_path) else os.path.join(os.getcwd(), file_path)


def _is_submission_teacher(submission: Submission, user_id: int, db: Session) -> bool:
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        return False
    course = db.query(Course).filter(Course.id == assignment.course_id).first()
    return bool(course and course.creator_id == user_id)


def _assert_submission_author_or_teacher(submission: Submission, user_id: int, db: Session):
    if submission.student_id == user_id:
        return
    if _is_submission_teacher(submission, user_id, db):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Доступ запрещен"
    )


def _assert_submission_teacher(submission: Submission, user_id: int, db: Session):
    if not _is_submission_teacher(submission, user_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только преподаватель может выполнять это действие"
        )


def _ensure_word_review_asset(submission_file: SubmissionFile, db: Session) -> SubmissionReviewAsset:
    if submission_file.review_asset:
        return submission_file.review_asset

    try:
        review_path, review_name = convert_word_to_pdf(
            source_file_path=submission_file.file_path,
            source_file_name=submission_file.file_name,
        )
    except ConversionError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    review_asset = SubmissionReviewAsset(
        submission_file_id=submission_file.id,
        review_file_path=review_path,
        review_file_name=review_name,
        mime_type="application/pdf",
    )
    db.add(review_asset)
    db.commit()
    db.refresh(review_asset)
    db.refresh(submission_file)
    return review_asset


@router.post("/assignments/{assignment_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_201_CREATED)
async def submit_assignment(
    assignment_id: int,
    submission_data: SubmissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
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

    # Проверка лимита попыток
    if assignment.max_attempts is not None:
        # Подсчитываем количество уже сданных попыток (включая удалённые)
        attempts_count = db.query(Submission).filter(
            Submission.assignment_id == assignment_id,
            Submission.student_id == current_user.id
        ).count()

        if attempts_count >= assignment.max_attempts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Вы исчерпали все попытки сдачи. Максимум попыток: {assignment.max_attempts}"
            )

    # Создание новой сдачи (всегда создаём новую запись для сохранения истории)
    new_submission = Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        content=submission_data.content,
        submitted_at=datetime.utcnow()
    )

    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)

    response = SubmissionResponse.model_validate(new_submission)
    response.student_name = current_user.username

    # Отправляем WebSocket уведомление
    await manager.broadcast_to_assignment(
        assignment_id,
        {
            "type": "submission_created",
            "data": response.model_dump(mode='json')
        }
    )

    return response


@router.get("/assignments/{assignment_id}/submissions", response_model=List[SubmissionResponse])
def get_assignment_submissions(
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

    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может видеть все сдачи
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может просматривать все сдачи"
        )

    # Сортировка: сначала непроверенные, затем проверенные; внутри каждой группы - по дате сдачи (новые сверху)
    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.is_deleted == 0  # Фильтруем удалённые сдачи
    ).order_by(
        case(
            (Submission.score == None, 0),  # Непроверенные (0 - выше)
            else_=1  # Проверенные (1 - ниже)
        ),
        desc(Submission.submitted_at)  # В каждой группе - новые сверху
    ).all()

    # Удаляем пустые сдачи (без текста и файлов)
    valid_submissions = []
    for submission in submissions:
        # Проверяем, есть ли контент или файлы
        has_content = submission.content and submission.content.strip()
        has_files = len(submission.files) > 0 if hasattr(submission, 'files') else False

        if not has_content and not has_files:
            # Удаляем пустую сдачу
            db.delete(submission)
        else:
            valid_submissions.append(submission)

    # Коммитим удаление пустых сдач
    if len(valid_submissions) < len(submissions):
        db.commit()

    responses = []
    for submission in valid_submissions:
        response = SubmissionResponse.model_validate(submission)
        # Добавляем имя студента
        student = db.query(User).filter(User.id == submission.student_id).first()
        response.student_name = student.username if student else None
        responses.append(response)

    return responses


@router.get("/{submission_id}", response_model=SubmissionResponse)
def get_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Студент может видеть только свою сдачу, учитель - все сдачи
    if submission.student_id != current_user.id and course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
        )

    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    return response


@router.post("/{submission_id}/mark-viewed", response_model=SubmissionResponse)
async def mark_submission_viewed(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пометить сдачу как просмотренную учителем"""
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0
    ).first()

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только учитель может помечать сдачи как просмотренные
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только преподаватель может помечать сдачи как просмотренные"
        )

    if submission.viewed_by_teacher == 0:
        submission.viewed_by_teacher = 1
        db.commit()
        db.refresh(submission)

    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    # Отправляем WebSocket уведомление студенту
    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_viewed",
            "data": response.model_dump(mode='json')
        }
    )

    return response


@router.get("/assignments/{assignment_id}/attempts-info")
def get_my_attempts_info(
    assignment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о попытках студента (включая удалённые)"""
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

    # Считаем общее количество попыток (включая удалённые)
    total_attempts = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id
    ).count()

    return {
        "total_attempts": total_attempts,
        "max_attempts": assignment.max_attempts
    }


@router.get("/assignments/{assignment_id}/my-submission", response_model=List[SubmissionResponse])
def get_my_submission(
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

    # Получаем все сдачи студента по этому заданию, отсортированные по дате (новые сверху)
    submissions = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == current_user.id,
        Submission.is_deleted == 0  # Фильтруем удалённые сдачи
    ).order_by(Submission.submitted_at.desc()).all()

    # Удаляем пустые сдачи (без текста и файлов)
    valid_submissions = []
    for submission in submissions:
        # Проверяем, есть ли контент или файлы
        has_content = submission.content and submission.content.strip()
        has_files = len(submission.files) > 0 if hasattr(submission, 'files') else False

        if not has_content and not has_files:
            # Удаляем пустую сдачу
            db.delete(submission)
        else:
            valid_submissions.append(submission)

    # Коммитим удаление пустых сдач
    if len(valid_submissions) < len(submissions):
        db.commit()

    if not valid_submissions:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    responses = []
    for submission in valid_submissions:
        response = SubmissionResponse.model_validate(submission)
        response.student_name = current_user.username
        responses.append(response)

    return responses


@router.put("/{submission_id}/grade", response_model=SubmissionResponse)
async def grade_submission(
    submission_id: int,
    grade_data: SubmissionGrade,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    course = db.query(Course).filter(Course.id == assignment.course_id).first()

    # Только создатель курса может оценивать
    if course.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель курса может оценивать сдачи"
        )

    # Валидация оценки в зависимости от типа
    if assignment.grading_type == "numeric":
        # Для числовой оценки проверяем диапазон
        if isinstance(grade_data.score, str):
            try:
                score_value = float(grade_data.score)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Неверная числовая оценка"
                )
        else:
            score_value = grade_data.score

        # Проверяем, что оценка является целым числом
        if score_value != int(score_value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Оценка должна быть целым числом"
            )

        score_value = int(score_value)

        if assignment.grade_min is not None and score_value < assignment.grade_min:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Оценка не может быть меньше {assignment.grade_min}"
            )

        if assignment.grade_max is not None and score_value > assignment.grade_max:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Оценка не может превышать {assignment.grade_max}"
            )

        # Сохраняем как строку
        submission.score = str(score_value)
    else:
        # Для текстовой оценки проверяем, что она есть в списке допустимых
        if assignment.grade_options:
            try:
                options = json.loads(assignment.grade_options)
                score_str = str(grade_data.score)
                if score_str not in options:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Неверная оценка. Должна быть одной из: {', '.join(options)}"
                    )
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Не удалось обработать варианты оценок"
                )
        submission.score = str(grade_data.score)

    submission.teacher_comment = grade_data.teacher_comment
    submission.graded_at = datetime.utcnow()

    db.commit()
    db.refresh(submission)

    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    # Отправляем WebSocket уведомление
    await manager.broadcast_to_assignment(
        submission.assignment_id,
        {
            "type": "submission_graded",
            "data": response.model_dump(mode='json')
        }
    )

    # Отправляем персональное уведомление студенту
    await manager.send_to_user(
        submission.student_id,
        {
            "type": "submission_graded_personal",
            "data": response.model_dump(mode='json')
        }
    )

    return response


@router.post("/{submission_id}/files", status_code=status.HTTP_201_CREATED)
async def upload_submission_file(
    submission_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    # Только студент, который сдал работу, может загружать файлы
    if submission.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор сдачи может загружать файлы"
        )

    # Сохранение файла
    file_path, file_name = save_upload_file(file)

    # Создание записи в БД
    submission_file = SubmissionFile(
        submission_id=submission_id,
        file_path=file_path,
        file_name=file_name
    )

    db.add(submission_file)
    db.commit()
    db.refresh(submission_file)

    # Для Word файлов создаем PDF
    if is_word_file(submission_file.file_name):
        try:
            review_path, review_name = convert_word_to_pdf(
                source_file_path=submission_file.file_path,
                source_file_name=submission_file.file_name,
            )
            review_asset = SubmissionReviewAsset(
                submission_file_id=submission_file.id,
                review_file_path=review_path,
                review_file_name=review_name,
                mime_type="application/pdf",
            )
            db.add(review_asset)
            db.commit()
        except ConversionError as exc:
            print(f"[Word->PDF] Conversion failed for file {submission_file.id}: {exc}")
        finally:
            db.refresh(submission_file)

    db.refresh(submission)
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()

    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    # Отправляем WebSocket уведомление об обновлении посылке
    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_updated",
            "data": response.model_dump(mode='json')
        }
    )

    return {
        "id": submission_file.id,
        "file_name": submission_file.file_name,
        "message": "File uploaded successfully"
    }


@router.post("/{submission_id}/files/{file_id}/prepare-review", response_model=ReviewAssetResponse)
def prepare_submission_file_review(
    submission_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_teacher(submission, current_user.id, db)

    submission_file = db.query(SubmissionFile).filter(
        SubmissionFile.id == file_id,
        SubmissionFile.submission_id == submission_id,
    ).first()
    if not submission_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    source_mime = _guess_mime_type(submission_file.file_name)
    converted = False
    review_path = submission_file.file_path
    review_name = submission_file.file_name
    review_mime = source_mime

    if is_word_file(submission_file.file_name):
        review_asset = _ensure_word_review_asset(submission_file, db)
        review_path = review_asset.review_file_path
        review_name = review_asset.review_file_name
        review_mime = review_asset.mime_type
        converted = True
    elif not (is_pdf_file(submission_file.file_name) or is_image_file(submission_file.file_name)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Формат файла не поддерживается для проверки"
        )

    return ReviewAssetResponse(
        submission_file_id=submission_file.id,
        source_file_name=submission_file.file_name,
        source_mime_type=source_mime,
        review_file_path=review_path,
        review_file_name=review_name,
        review_mime_type=review_mime,
        review_kind=get_review_kind(submission_file.file_name),
        is_converted_from_word=converted,
    )


@router.post("/{submission_id}/feedback-files", response_model=SubmissionFeedbackFileResponse, status_code=status.HTTP_201_CREATED)
async def upload_submission_feedback_file(
    submission_id: int,
    file: UploadFile = File(...),
    source_submission_file_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_teacher(submission, current_user.id, db)

    if source_submission_file_id is not None:
        source_file = db.query(SubmissionFile).filter(
            SubmissionFile.id == source_submission_file_id,
            SubmissionFile.submission_id == submission_id,
        ).first()
        if not source_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Исходный файл для обратной связи не найден"
            )

    feedback_path, feedback_name = save_upload_file(file)
    feedback_record = SubmissionFeedbackFile(
        submission_id=submission_id,
        teacher_id=current_user.id,
        source_submission_file_id=source_submission_file_id,
        file_path=feedback_path,
        file_name=feedback_name,
        mime_type=_guess_mime_type(feedback_name),
    )
    db.add(feedback_record)
    db.commit()
    db.refresh(feedback_record)

    db.refresh(submission)
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )
    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_updated",
            "data": response.model_dump(mode='json')
        }
    )

    return SubmissionFeedbackFileResponse.model_validate(feedback_record)


@router.get("/{submission_id}/feedback-files", response_model=List[SubmissionFeedbackFileResponse])
def get_submission_feedback_files(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_author_or_teacher(submission, current_user.id, db)

    feedback_files = db.query(SubmissionFeedbackFile).filter(
        SubmissionFeedbackFile.submission_id == submission_id
    ).order_by(SubmissionFeedbackFile.created_at.desc()).all()

    return [SubmissionFeedbackFileResponse.model_validate(item) for item in feedback_files]


@router.get("/{submission_id}/feedback-files/{feedback_file_id}/download")
async def download_submission_feedback_file(
    submission_id: int,
    feedback_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_author_or_teacher(submission, current_user.id, db)

    feedback_file = db.query(SubmissionFeedbackFile).filter(
        SubmissionFeedbackFile.id == feedback_file_id,
        SubmissionFeedbackFile.submission_id == submission_id,
    ).first()
    if not feedback_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл обратной связи не найден"
        )

    abs_file_path = _to_abs_path(feedback_file.file_path)
    if not os.path.exists(abs_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден на сервере"
        )

    return FileResponse(
        path=abs_file_path,
        media_type="application/octet-stream",
        filename=feedback_file.file_name,
    )


@router.put("/{submission_id}/feedback-files/{feedback_file_id}", response_model=SubmissionFeedbackFileResponse)
async def replace_submission_feedback_file(
    submission_id: int,
    feedback_file_id: int,
    file: UploadFile = File(...),
    source_submission_file_id: Optional[int] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_teacher(submission, current_user.id, db)

    feedback_file = db.query(SubmissionFeedbackFile).filter(
        SubmissionFeedbackFile.id == feedback_file_id,
        SubmissionFeedbackFile.submission_id == submission_id,
    ).first()
    if not feedback_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл обратной связи не найден"
        )

    if source_submission_file_id is not None:
        source_file = db.query(SubmissionFile).filter(
            SubmissionFile.id == source_submission_file_id,
            SubmissionFile.submission_id == submission_id,
        ).first()
        if not source_file:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Исходный файл для обратной связи не найден"
            )
        feedback_file.source_submission_file_id = source_submission_file_id

    old_file_path = feedback_file.file_path
    new_file_path, new_file_name = save_upload_file(file)
    feedback_file.file_path = new_file_path
    feedback_file.file_name = new_file_name
    feedback_file.mime_type = _guess_mime_type(new_file_name)

    db.commit()
    db.refresh(feedback_file)
    delete_file(old_file_path)

    db.refresh(submission)
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )
    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_updated",
            "data": response.model_dump(mode='json')
        }
    )

    return SubmissionFeedbackFileResponse.model_validate(feedback_file)


@router.delete("/{submission_id}/feedback-files/{feedback_file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submission_feedback_file(
    submission_id: int,
    feedback_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0,
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    _assert_submission_teacher(submission, current_user.id, db)

    feedback_file = db.query(SubmissionFeedbackFile).filter(
        SubmissionFeedbackFile.id == feedback_file_id,
        SubmissionFeedbackFile.submission_id == submission_id,
    ).first()
    if not feedback_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл обратной связи не найден"
        )

    feedback_path = feedback_file.file_path
    db.delete(feedback_file)
    db.commit()
    delete_file(feedback_path)

    db.refresh(submission)
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задание не найдено"
        )
    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_updated",
            "data": response.model_dump(mode='json')
        }
    )

    return None


@router.delete("/{submission_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submission_file(
    submission_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_record = db.query(SubmissionFile).filter(
        SubmissionFile.id == file_id,
        SubmissionFile.submission_id == submission_id
    ).first()

    if not file_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Файл не найден"
        )

    submission = db.query(Submission).filter(Submission.id == submission_id).first()

    # Только студент может удалять свои файлы
    if submission.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор сдачи может удалять файлы"
        )

    # Удаление файла из файловой системы
    delete_file(file_record.file_path)
    if file_record.review_asset:
        delete_file(file_record.review_asset.review_file_path)

    linked_feedback = db.query(SubmissionFeedbackFile).filter(
        SubmissionFeedbackFile.source_submission_file_id == file_record.id
    ).all()
    for feedback in linked_feedback:
        feedback.source_submission_file_id = None

    # Удаление записи из БД
    db.delete(file_record)
    db.commit()

    db.refresh(submission)
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()

    response = SubmissionResponse.model_validate(submission)
    student = db.query(User).filter(User.id == submission.student_id).first()
    response.student_name = student.username if student else None

    # Отправляем WebSocket уведомление об обновлении посылки
    await manager.broadcast_to_assignment(
        assignment.id,
        {
            "type": "submission_updated",
            "data": response.model_dump(mode='json')
        }
    )

    return None


@router.delete("/{submission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_submission(
    submission_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.is_deleted == 0
    ).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    # Только студент может удалить свою сдачу
    if submission.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только автор сдачи может удалить её"
        )

    # Можно удалить только непроверенную сдачу
    if submission.score is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Невозможно удалить оцененную сдачу"
        )

    # Нельзя удалить сдачу, если учитель уже просмотрел её
    if submission.viewed_by_teacher == 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Невозможно удалить сдачу: она просмотрена учителем"
        )

    # Получаем информацию о задании для проверки лимита попыток
    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()

    # Если у задания ограниченное количество попыток
    if assignment.max_attempts is not None:
        # Считаем все попытки (включая удалённые)
        total_attempts = db.query(Submission).filter(
            Submission.assignment_id == assignment.id,
            Submission.student_id == current_user.id
        ).count()

        # Считаем непроверенные неудалённые сдачи
        ungraded_submissions = db.query(Submission).filter(
            Submission.assignment_id == assignment.id,
            Submission.student_id == current_user.id,
            Submission.score == None,
            Submission.is_deleted == 0
        ).count()

        # Если попытки исчерпаны и это последняя непроверенная сдача
        if total_attempts >= assignment.max_attempts and ungraded_submissions == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Невозможно удалить последнюю сдачу: попытки исчерпаны"
            )

    # Сохраняем данные для WebSocket уведомления
    assignment_id = submission.assignment_id

    # Мягкое удаление
    submission.is_deleted = 1
    db.commit()

    # Отправляем WebSocket уведомление об удалении
    await manager.broadcast_to_assignment(
        assignment_id,
        {
            "type": "submission_deleted",
            "data": {"submission_id": submission_id}
        }
    )

    return None


# Защищенные эндпоинты для скачивания файлов сдач
@router.get("/{submission_id}/files/{file_id}/download")
async def download_submission_file(
    submission_id: int,
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Скачивание файла сдачи (только для участников курса или автора сдачи)"""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Сдача не найдена"
        )

    assignment = db.query(Assignment).filter(Assignment.id == submission.assignment_id).first()

    # Проверяем права доступа
    is_author = submission.student_id == current_user.id
    is_member = db.query(CourseMember).filter(
        CourseMember.course_id == assignment.course_id,
        CourseMember.user_id == current_user.id
    ).first()

    if not (is_author or is_member):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ запрещен"
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
