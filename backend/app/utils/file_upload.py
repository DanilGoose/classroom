import os
import shutil
import re
from datetime import datetime
from pathlib import Path
from fastapi import UploadFile, HTTPException
from ..config import settings


def ensure_upload_dir():
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """
    Санитизирует имя файла для безопасного сохранения.
    Защита от path traversal и других атак через имя файла.
    """
    # Берем только базовое имя файла (защита от path traversal типа ../../../etc/passwd)
    filename = os.path.basename(filename)

    # Удаляем null bytes
    filename = filename.replace('\x00', '')

    # Удаляем опасные символы, оставляем только буквы, цифры, дефисы, подчеркивания и точки
    # Поддержка кириллицы и других unicode символов
    filename = re.sub(r'[^\w\s\-\.]', '_', filename, flags=re.UNICODE)

    # Удаляем множественные точки (защита от обхода через ../)
    filename = re.sub(r'\.{2,}', '.', filename)

    # Удаляем точки в начале и конце (защита от скрытых файлов и странных расширений)
    filename = filename.strip('.')

    # Разделяем имя и расширение
    name, ext = os.path.splitext(filename)

    # Ограничиваем длину имени (без расширения)
    if len(name) > 100:
        name = name[:100]

    # Ограничиваем длину расширения
    if len(ext) > 10:
        ext = ext[:10]

    # Собираем обратно
    filename = name + ext

    # Если имя пустое после санитизации, используем дефолтное
    if not filename or filename == '.' or not name:
        filename = 'file.bin'

    return filename


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

    # Санитизация оригинального имени файла
    safe_original_name = sanitize_filename(upload_file.filename)

    # Генерация уникального имени файла с timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")  # Добавляем микросекунды для уникальности
    unique_filename = f"{timestamp}_{safe_original_name}"

    # Санитизация финального имени (на всякий случай)
    unique_filename = sanitize_filename(unique_filename)

    # Используем os.path.join для безопасного объединения путей
    file_path = os.path.join(settings.UPLOAD_DIR, unique_filename)

    # Дополнительная проверка: убеждаемся что путь находится внутри UPLOAD_DIR
    real_upload_dir = os.path.realpath(settings.UPLOAD_DIR)
    real_file_path = os.path.realpath(file_path)

    if not real_file_path.startswith(real_upload_dir):
        raise HTTPException(
            status_code=400,
            detail="Недопустимое имя файла"
        )

    # Сохранение файла
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return file_path, safe_original_name


def delete_file(file_path: str):
    """
    Удаляет файл из файловой системы.
    Защита от удаления файлов вне UPLOAD_DIR.
    """
    try:
        if not os.path.exists(file_path):
            return

        # Проверяем что файл находится внутри UPLOAD_DIR (защита от path traversal)
        real_upload_dir = os.path.realpath(settings.UPLOAD_DIR)
        real_file_path = os.path.realpath(file_path)

        if not real_file_path.startswith(real_upload_dir):
            # Попытка удалить файл вне разрешенной директории - игнорируем
            print(f"Security: Attempt to delete file outside UPLOAD_DIR: {file_path}")
            return

        os.remove(file_path)
    except Exception as e:
        # Логируем ошибку, но не падаем
        print(f"Error deleting file {file_path}: {e}")
        pass
