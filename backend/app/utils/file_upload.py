import os
import shutil
from datetime import datetime
from pathlib import Path
from fastapi import UploadFile, HTTPException
from ..config import settings


def ensure_upload_dir():
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def save_upload_file(upload_file: UploadFile) -> tuple[str, str]:
    """
    Сохраняет загруженный файл и возвращает (file_path, file_name)
    """
    ensure_upload_dir()

    # Проверка размера файла
    max_file_size = settings.MAX_FILE_SIZE_MB * 1024 * 1024  # Конвертируем MB в байты
    upload_file.file.seek(0, 2)
    file_size = upload_file.file.tell()
    upload_file.file.seek(0)

    if file_size > max_file_size:
        raise HTTPException(
            status_code=400,
            detail=f"Файл слишком большой. Максимальный размер {settings.MAX_FILE_SIZE_MB} МБ"
        )

    # Генерация уникального имени файла
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    unique_filename = f"{timestamp}_{upload_file.filename}"
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Сохранение файла
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return file_path, upload_file.filename


def delete_file(file_path: str):
    """
    Удаляет файл из файловой системы
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass  # Игнорируем ошибки при удалении файлов
