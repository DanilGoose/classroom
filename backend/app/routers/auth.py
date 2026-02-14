import secrets
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.user import User
from ..models.pending_registration import PendingRegistration
from ..schemas.user import (
    EmailChangeConfirmNewEmail,
    EmailChangeRequestNewCode,
    EmailVerificationConfirm,
    PasswordUpdate,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegistrationConfirm,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from ..utils.auth import verify_password, get_password_hash, create_access_token, get_current_user
from ..utils.email_verification import (
    send_email_change_new_code_email,
    send_email_change_old_code_email,
    send_password_reset_code_email,
    send_verification_code_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _generate_email_verification_code() -> str:
    length = 6
    return "".join(secrets.choice(string.digits) for _ in range(length))


def _set_user_email_verification(user: User) -> str:
    code = _generate_email_verification_code()
    user.is_email_verified = False
    user.email_verification_code = code
    user.email_verification_sent_at = datetime.utcnow()
    user.email_verification_expires_at = (
        datetime.utcnow() + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
    )
    return code


def _dispatch_verification_email(user: User, code: str):
    try:
        send_verification_code_email(
            to_email=user.email,
            username=user.username,
            code=code,
        )
    except Exception as exc:
        print(f"[Email Verification] Failed to send code to {user.email}: {exc}")


def _dispatch_email_change_old_code_email(user: User, code: str):
    try:
        send_email_change_old_code_email(
            to_email=user.email,
            username=user.username,
            code=code,
        )
    except Exception as exc:
        print(f"[Email Change] Failed to send old-email code to {user.email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить код на текущую почту. Попробуйте позже."
        )


def _dispatch_email_change_new_code_email(user: User, to_email: str, code: str):
    try:
        send_email_change_new_code_email(
            to_email=to_email,
            username=user.username,
            code=code,
        )
    except Exception as exc:
        print(f"[Email Change] Failed to send new-email code to {to_email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить код на новую почту. Проверьте адрес и попробуйте позже."
        )


def _dispatch_password_reset_code_email(user: User, code: str):
    try:
        send_password_reset_code_email(
            to_email=user.email,
            username=user.username,
            code=code,
        )
    except Exception as exc:
        print(f"[Password Reset] Failed to send reset code to {user.email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить код на почту. Попробуйте позже."
        )


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def confirm_register(payload: RegistrationConfirm, db: Session = Depends(get_db)):
    """
    Завершение регистрации по коду.
    Пользователь создается только после корректного кода.
    """
    email = payload.email.strip().lower()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()
    if not pending:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код регистрации не найден. Запросите код заново."
        )

    if pending.expires_at < datetime.utcnow():
        db.delete(pending)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода истек. Запросите новый код."
        )

    if payload.code != pending.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код регистрации"
        )

    new_user = User(
        email=pending.email,
        username=pending.username,
        hashed_password=pending.hashed_password,
        is_admin=False,
        is_email_verified=True,
    )

    db.add(new_user)
    db.delete(pending)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(data={"sub": str(new_user.id)})

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(new_user)
    )


@router.post("/register/request-code", status_code=status.HTTP_200_OK)
def request_register_code(user_data: UserCreate, db: Session = Depends(get_db)):
    email = user_data.email.strip().lower()

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    now = datetime.utcnow()
    pending = db.query(PendingRegistration).filter(PendingRegistration.email == email).first()

    if pending and pending.sent_at:
        elapsed_seconds = int((now - pending.sent_at).total_seconds())
        if elapsed_seconds < settings.EMAIL_VERIFICATION_RESEND_SECONDS:
            retry_after = settings.EMAIL_VERIFICATION_RESEND_SECONDS - elapsed_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Повторная отправка будет доступна через {retry_after} сек."
            )

    code = _generate_email_verification_code()
    expires_at = now + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
    hashed_password = get_password_hash(user_data.password)

    if not pending:
        pending = PendingRegistration(
            email=email,
            username=user_data.username,
            hashed_password=hashed_password,
            code=code,
            expires_at=expires_at,
            sent_at=None,
        )
        db.add(pending)
    else:
        pending.username = user_data.username
        pending.hashed_password = hashed_password
        pending.code = code
        pending.expires_at = expires_at
        pending.sent_at = None

    db.commit()
    db.refresh(pending)

    try:
        send_verification_code_email(
            to_email=email,
            username=user_data.username,
            code=code,
        )
    except Exception as exc:
        print(f"[Register] Failed to send registration code to {email}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось отправить код на почту. Попробуйте позже."
        )

    pending.sent_at = now
    db.commit()

    return {"message": "Код регистрации отправлен на почту"}


@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Поиск пользователя
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный email или пароль"
        )

    # Создание токена (sub должен быть строкой)
    access_token = create_access_token(data={"sub": str(user.id)})

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Получить информацию о текущем пользователе"""
    return UserResponse.model_validate(current_user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление профиля пользователя"""
    if user_data.email and user_data.email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Смена email выполняется через подтверждение кодами (см. раздел смены почты)."
        )

    # Обновление username
    if user_data.username:
        current_user.username = user_data.username

    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.put("/password")
def update_password(
    password_data: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновление пароля пользователя"""

    # Проверка старого пароля
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный старый пароль"
        )

    # Обновление пароля
    current_user.hashed_password = get_password_hash(password_data.new_password)

    db.commit()

    return {"message": "Пароль успешно обновлен"}


@router.post("/password-reset/request-code")
def request_password_reset_code(
    payload: PasswordResetRequest,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email не найден"
        )

    now = datetime.utcnow()
    if user.password_reset_sent_at:
        elapsed_seconds = int((now - user.password_reset_sent_at).total_seconds())
        if elapsed_seconds < settings.EMAIL_VERIFICATION_RESEND_SECONDS:
            retry_after = settings.EMAIL_VERIFICATION_RESEND_SECONDS - elapsed_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Повторная отправка будет доступна через {retry_after} сек."
            )

    code = _generate_email_verification_code()
    user.password_reset_code = code
    user.password_reset_expires_at = now + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
    user.password_reset_sent_at = None

    db.commit()
    db.refresh(user)

    _dispatch_password_reset_code_email(user, code)

    user.password_reset_sent_at = now
    db.commit()

    return {"message": "Код для сброса пароля отправлен на почту"}


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email не найден"
        )

    if not user.password_reset_code or not user.password_reset_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код сброса не найден. Запросите новый код."
        )

    if user.password_reset_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода истек. Запросите новый код."
        )

    if payload.code != user.password_reset_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код сброса"
        )

    user.hashed_password = get_password_hash(payload.new_password)
    user.password_reset_code = None
    user.password_reset_expires_at = None
    user.password_reset_sent_at = None
    db.commit()

    return {"message": "Пароль успешно сброшен"}


@router.post("/verify-email", response_model=UserResponse)
def verify_email(
    verification_data: EmailVerificationConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.is_email_verified:
        return UserResponse.model_validate(current_user)

    if not current_user.email_verification_code or not current_user.email_verification_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Код подтверждения не найден. Запросите новый код."
        )

    if current_user.email_verification_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода истек. Запросите новый код."
        )

    if verification_data.code != current_user.email_verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код подтверждения"
        )

    current_user.is_email_verified = True
    current_user.email_verification_code = None
    current_user.email_verification_expires_at = None
    current_user.email_verification_sent_at = None

    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post("/resend-verification")
def resend_verification_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.is_email_verified:
        return {"message": "Почта уже подтверждена"}

    now = datetime.utcnow()
    if current_user.email_verification_sent_at:
        elapsed_seconds = int((now - current_user.email_verification_sent_at).total_seconds())
        if elapsed_seconds < settings.EMAIL_VERIFICATION_RESEND_SECONDS:
            retry_after = settings.EMAIL_VERIFICATION_RESEND_SECONDS - elapsed_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Повторная отправка будет доступна через {retry_after} сек."
            )

    verification_code = _set_user_email_verification(current_user)
    db.commit()
    db.refresh(current_user)
    _dispatch_verification_email(current_user, verification_code)

    return {"message": "Код подтверждения отправлен"}


@router.post("/email-change/request-old-code")
def request_email_change_old_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала подтвердите текущую почту."
        )

    now = datetime.utcnow()
    if current_user.email_change_old_sent_at:
        elapsed_seconds = int((now - current_user.email_change_old_sent_at).total_seconds())
        if elapsed_seconds < settings.EMAIL_VERIFICATION_RESEND_SECONDS:
            retry_after = settings.EMAIL_VERIFICATION_RESEND_SECONDS - elapsed_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Повторная отправка будет доступна через {retry_after} сек."
            )

    code = _generate_email_verification_code()
    current_user.email_change_old_code = code
    current_user.email_change_old_expires_at = now + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )

    current_user.pending_email = None
    current_user.pending_email_code = None
    current_user.pending_email_sent_at = None
    current_user.pending_email_expires_at = None

    db.commit()
    db.refresh(current_user)
    _dispatch_email_change_old_code_email(current_user, code)
    current_user.email_change_old_sent_at = now
    db.commit()

    return {"message": "Код отправлен на текущую почту"}


@router.post("/email-change/verify-old-code")
def verify_email_change_old_code(
    verification_data: EmailVerificationConfirm,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала подтвердите текущую почту."
        )

    if not current_user.email_change_old_code or not current_user.email_change_old_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала запросите код на текущую почту."
        )

    if current_user.email_change_old_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода для текущей почты истек. Запросите новый."
        )

    if verification_data.code != current_user.email_change_old_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код с текущей почты"
        )

    return {"message": "Код подтвержден"}


@router.post("/email-change/request-new-code")
def request_email_change_new_code(
    payload: EmailChangeRequestNewCode,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала подтвердите текущую почту."
        )

    if not current_user.email_change_old_code or not current_user.email_change_old_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала запросите код на текущую почту."
        )

    if current_user.email_change_old_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода для текущей почты истек. Запросите новый."
        )

    if payload.old_code != current_user.email_change_old_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код с текущей почты"
        )

    new_email = payload.new_email.strip().lower()
    if new_email == current_user.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новая почта совпадает с текущей"
        )

    existing_user = db.query(User).filter(User.email == new_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    now = datetime.utcnow()
    if current_user.pending_email_sent_at:
        elapsed_seconds = int((now - current_user.pending_email_sent_at).total_seconds())
        if elapsed_seconds < settings.EMAIL_VERIFICATION_RESEND_SECONDS:
            retry_after = settings.EMAIL_VERIFICATION_RESEND_SECONDS - elapsed_seconds
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Повторная отправка будет доступна через {retry_after} сек."
            )

    new_code = _generate_email_verification_code()
    current_user.pending_email = new_email
    current_user.pending_email_code = new_code
    current_user.pending_email_expires_at = now + timedelta(
        minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES
    )

    db.commit()
    db.refresh(current_user)
    _dispatch_email_change_new_code_email(current_user, new_email, new_code)
    current_user.pending_email_sent_at = now
    db.commit()

    return {"message": "Код отправлен на новую почту"}


@router.post("/email-change/confirm-new", response_model=UserResponse)
def confirm_email_change_new_email(
    payload: EmailChangeConfirmNewEmail,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not current_user.pending_email or not current_user.pending_email_code or not current_user.pending_email_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала запросите код на новую почту."
        )

    if current_user.pending_email_expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Срок действия кода для новой почты истек. Запросите новый."
        )

    if payload.new_code != current_user.pending_email_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код с новой почты"
        )

    existing_user = db.query(User).filter(User.email == current_user.pending_email).first()
    if existing_user and existing_user.id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    current_user.email = current_user.pending_email
    current_user.is_email_verified = True

    current_user.email_change_old_code = None
    current_user.email_change_old_sent_at = None
    current_user.email_change_old_expires_at = None
    current_user.pending_email = None
    current_user.pending_email_code = None
    current_user.pending_email_sent_at = None
    current_user.pending_email_expires_at = None

    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)
