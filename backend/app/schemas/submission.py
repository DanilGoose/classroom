from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Union


class SubmissionReviewAssetResponse(BaseModel):
    id: int
    submission_file_id: int
    review_file_path: str
    review_file_name: str
    mime_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class SubmissionFileResponse(BaseModel):
    id: int
    file_name: str
    file_path: str
    uploaded_at: datetime
    review_asset: Optional[SubmissionReviewAssetResponse] = None

    class Config:
        from_attributes = True


class SubmissionFeedbackFileResponse(BaseModel):
    id: int
    submission_id: int
    teacher_id: int
    source_submission_file_id: Optional[int]
    file_path: str
    file_name: str
    mime_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewAssetResponse(BaseModel):
    submission_file_id: int
    source_file_name: str
    source_mime_type: str
    review_file_path: str
    review_file_name: str
    review_mime_type: str
    review_kind: str  # image | pdf
    is_converted_from_word: bool


class SubmissionCreate(BaseModel):
    content: Optional[str] = Field(None, max_length=400)


class SubmissionGrade(BaseModel):
    score: Union[int, str]
    teacher_comment: Optional[str] = Field(None, max_length=400)


class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: int
    content: Optional[str]
    score: Optional[Union[int, str]]  # Поддержка числовых и текстовых оценок
    teacher_comment: Optional[str]
    submitted_at: datetime
    graded_at: Optional[datetime]
    viewed_by_teacher: int = 0  # 0 = не просмотрено, 1 = просмотрено
    files: List[SubmissionFileResponse] = []
    feedback_files: List[SubmissionFeedbackFileResponse] = []
    student_name: Optional[str] = None

    class Config:
        from_attributes = True
