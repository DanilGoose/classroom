import smtplib
from email.message import EmailMessage

from ..config import settings


def _build_from_header() -> str:
    from_email = settings.SMTP_FROM_EMAIL.strip() or settings.SMTP_USERNAME.strip() or "no-reply@classroom.local"
    from_name = settings.SMTP_FROM_NAME.strip()
    if from_name:
        return f"{from_name} <{from_email}>"
    return from_email


def _send_email(to_email: str, subject: str, body: str):
    smtp_host = settings.SMTP_HOST.strip()
    if not smtp_host:
        print(f"[EMAIL][MOCK] To: {to_email} | Subject: {subject}\n{body}")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _build_from_header()
    message["To"] = to_email
    message.set_content(body)

    timeout_seconds = 20

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(smtp_host, settings.SMTP_PORT, timeout=timeout_seconds) as smtp:
            if settings.SMTP_USERNAME:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)
        return

    with smtplib.SMTP(smtp_host, settings.SMTP_PORT, timeout=timeout_seconds) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)


def send_verification_code_email(to_email: str, username: str, code: str):
    subject = "Подтверждение почты в Classroom"
    body = (
        f"Здравствуйте, {username}!\n\n"
        "Чтобы подтвердить почту в Classroom, введите код:\n\n"
        f"{code}\n\n"
        f"Код действует {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} минут.\n"
        "Если вы не регистрировались в Classroom, просто проигнорируйте это письмо."
    )
    _send_email(to_email=to_email, subject=subject, body=body)


def send_email_change_old_code_email(to_email: str, username: str, code: str):
    subject = "Смена почты в Classroom: подтверждение текущей почты"
    body = (
        f"Здравствуйте, {username}!\n\n"
        "Вы запросили смену почты в Classroom.\n"
        "Сначала подтвердите доступ к текущей почте. Введите код:\n\n"
        f"{code}\n\n"
        f"Код действует {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} минут.\n"
        "Если это были не вы, рекомендуется сменить пароль."
    )
    _send_email(to_email=to_email, subject=subject, body=body)


def send_email_change_new_code_email(to_email: str, username: str, code: str):
    subject = "Смена почты в Classroom: подтверждение новой почты"
    body = (
        f"Здравствуйте, {username}!\n\n"
        "Подтвердите новую почту для аккаунта Classroom. Введите код:\n\n"
        f"{code}\n\n"
        f"Код действует {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} минут.\n"
        "Если это были не вы, просто проигнорируйте письмо."
    )
    _send_email(to_email=to_email, subject=subject, body=body)


def send_password_reset_code_email(to_email: str, username: str, code: str):
    subject = "Сброс пароля в Classroom"
    body = (
        f"Здравствуйте, {username}!\n\n"
        "Вы запросили сброс пароля в Classroom.\n"
        "Введите код для сброса пароля:\n\n"
        f"{code}\n\n"
        f"Код действует {settings.EMAIL_VERIFICATION_EXPIRE_MINUTES} минут.\n"
        "Если это были не вы, просто проигнорируйте письмо."
    )
    _send_email(to_email=to_email, subject=subject, body=body)
