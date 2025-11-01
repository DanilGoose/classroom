from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pathlib import Path
from .database import engine, Base
from .routers import auth, courses, assignments, chat, admin, submissions
from .config import settings

# Создание таблиц
Base.metadata.create_all(bind=engine)

# Создание директории для загрузок
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Classroom API",
    description="API для образовательной платформы",
    version="1.0.0"
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров с префиксом /api
app.include_router(auth.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# Статические файлы для загруженных файлов
if os.path.exists(settings.UPLOAD_DIR):
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Путь к статическим файлам фронтенда
STATIC_DIR = Path(__file__).parent.parent / "static"

# Монтируем статические файлы фронтенда (если папка существует)
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Раздает index.html для всех путей (для SPA роутинга)"""
    # Если запрос к API или uploads, не обрабатываем здесь
    if full_path.startswith("api") or full_path.startswith("uploads"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")

    # Проверяем существование static директории
    if not STATIC_DIR.exists():
        return {
            "message": "Frontend not built yet. Run 'npm run build' in frontend directory and copy dist folder to backend/static"
        }

    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    return {"message": "index.html not found"}
