from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./classroom.db"
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    LIBREOFFICE_BIN: str = "soffice"
    # Контроль доступа к API и документации
    DOCS_ENABLED: bool = True
    ENFORCE_ORIGIN: bool = False
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "https://localhost",
    ]
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 30
    EMAIL_VERIFICATION_RESEND_SECONDS: int = 60
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "no-reply@classroom.local"
    SMTP_FROM_NAME: str = "Classroom"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
