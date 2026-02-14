from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Настройки для SQLite чтобы избежать блокировок
connect_args = {}
if "sqlite" in settings.DATABASE_URL:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30  # Увеличиваем таймаут до 30 секунд
    }

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # Проверяем соединение перед использованием
    pool_size=10,  # Размер пула соединений
    max_overflow=20  # Максимальное количество дополнительных соединений
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_startup_migrations():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    statements = []

    if "is_email_verified" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN is_email_verified BOOLEAN NOT NULL DEFAULT 0"
        )
    if "email_verification_code" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_verification_code VARCHAR(6)"
        )
    if "email_verification_expires_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_verification_expires_at DATETIME"
        )
    if "email_verification_sent_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_verification_sent_at DATETIME"
        )
    if "email_change_old_code" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_change_old_code VARCHAR(6)"
        )
    if "email_change_old_expires_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_change_old_expires_at DATETIME"
        )
    if "email_change_old_sent_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN email_change_old_sent_at DATETIME"
        )
    if "pending_email" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN pending_email VARCHAR"
        )
    if "pending_email_code" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN pending_email_code VARCHAR(6)"
        )
    if "pending_email_expires_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN pending_email_expires_at DATETIME"
        )
    if "pending_email_sent_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN pending_email_sent_at DATETIME"
        )
    if "password_reset_code" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN password_reset_code VARCHAR(6)"
        )
    if "password_reset_expires_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN password_reset_expires_at DATETIME"
        )
    if "password_reset_sent_at" not in existing_columns:
        statements.append(
            "ALTER TABLE users ADD COLUMN password_reset_sent_at DATETIME"
        )

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
