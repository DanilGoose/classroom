import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

from ..config import settings
from .file_upload import ensure_upload_dir, sanitize_filename

WORD_EXTENSIONS = {".doc", ".docx"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}


class ConversionError(Exception):
    pass


def is_word_file(file_name: str) -> bool:
    return Path(file_name).suffix.lower() in WORD_EXTENSIONS


def is_pdf_file(file_name: str) -> bool:
    return Path(file_name).suffix.lower() == ".pdf"


def is_image_file(file_name: str) -> bool:
    return Path(file_name).suffix.lower() in IMAGE_EXTENSIONS


def get_review_kind(file_name: str) -> str:
    if is_pdf_file(file_name):
        return "pdf"
    if is_image_file(file_name):
        return "image"
    if is_word_file(file_name):
        return "pdf"
    return "unsupported"


def _to_abs_path(file_path: str) -> str:
    return file_path if os.path.isabs(file_path) else os.path.join(os.getcwd(), file_path)


def convert_word_to_pdf(source_file_path: str, source_file_name: str) -> tuple[str, str]:
    """
    Конвертирует DOC/DOCX в PDF.
    Возвращает (relative_pdf_path, display_pdf_name).
    """
    abs_source_path = _to_abs_path(source_file_path)
    if not os.path.exists(abs_source_path):
        raise ConversionError("Исходный Word-файл не найден")

    ensure_upload_dir()
    upload_dir_abs = _to_abs_path(settings.UPLOAD_DIR)
    Path(upload_dir_abs).mkdir(parents=True, exist_ok=True)

    tmp_dir = tempfile.mkdtemp(prefix="word-to-pdf-")
    try:
        cmd = [
            settings.LIBREOFFICE_BIN,
            "--headless",
            "--convert-to",
            "pdf:writer_pdf_Export",
            "--outdir",
            tmp_dir,
            abs_source_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            stderr = (result.stderr or "").strip()
            stdout = (result.stdout or "").strip()
            raise ConversionError(f"Ошибка конвертации Word в PDF: {stderr or stdout or 'unknown error'}")

        stem = Path(source_file_name).stem
        generated_pdf_path = os.path.join(tmp_dir, f"{stem}.pdf")
        if not os.path.exists(generated_pdf_path):
            pdf_candidates = sorted(Path(tmp_dir).glob("*.pdf"))
            if not pdf_candidates:
                raise ConversionError("LibreOffice не вернул PDF-файл после конвертации")
            generated_pdf_path = str(pdf_candidates[0])

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        safe_stem = sanitize_filename(stem) or "document"
        output_filename = sanitize_filename(f"{timestamp}_{safe_stem}_review.pdf")
        output_abs_path = os.path.join(upload_dir_abs, output_filename)
        shutil.move(generated_pdf_path, output_abs_path)

        relative_pdf_path = os.path.join(settings.UPLOAD_DIR, output_filename)
        display_pdf_name = sanitize_filename(f"{stem}.pdf")
        return relative_pdf_path, display_pdf_name
    except subprocess.TimeoutExpired:
        raise ConversionError("Конвертация Word в PDF превысила лимит времени")
    except FileNotFoundError:
        raise ConversionError(
            f"Не найден бинарник конвертера '{settings.LIBREOFFICE_BIN}'. Установите LibreOffice в окружение backend."
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
