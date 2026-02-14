from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import os
from pathlib import Path
from .database import engine, Base, run_startup_migrations
from .routers import auth, courses, assignments, chat, admin, submissions, websocket
from .config import settings

# Создание таблиц
Base.metadata.create_all(bind=engine)
run_startup_migrations()

# Создание директории для загрузок
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="Classroom API",
    description="API для образовательной платформы",
    version="1.0.0",
    docs_url="/docs" if settings.DOCS_ENABLED else None,
    redoc_url=None if not settings.DOCS_ENABLED else "/redoc",
    openapi_url="/openapi.json" if settings.DOCS_ENABLED else None,
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_origin(request: Request, call_next):
    """
    Дополнительная защита: блокируем запросы к API, если Origin не из списка.
    Отключено по умолчанию, включается флагом ENFORCE_ORIGIN.
    """
    if settings.ENFORCE_ORIGIN and request.url.path.startswith("/api"):
        origin = request.headers.get("origin")
        if origin and origin not in settings.ALLOWED_ORIGINS:
            return JSONResponse(
                status_code=403,
                content={"detail": "Origin is not allowed"},
            )
    return await call_next(request)

# Подключение роутеров с префиксом /api
app.include_router(auth.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(assignments.router, prefix="/api")
app.include_router(submissions.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(admin.router, prefix="/api")

# WebSocket роутер (без префикса /api)
app.include_router(websocket.router)

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
