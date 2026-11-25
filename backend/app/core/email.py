"""Email delivery: DEBUG simulates delivery; otherwise SMTP is required."""
import logging
import smtplib
from email.message import EmailMessage
from fastapi import HTTPException
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_code_email(to_email: str, token: str, *, recovery: bool = False) -> None:
    if settings.DEBUG:
        logger.info("[DEBUG] %s code for %s: %s", "Recovery" if recovery else "Verification", to_email, token)
        return
    if not all((settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD)):
        raise HTTPException(503, "O envio de e-mail ainda não está configurado. Tente novamente mais tarde.")
    sender = settings.EMAIL_FROM or settings.SMTP_USER
    message = EmailMessage()
    message["Subject"] = "Carona Aí — " + ("Recuperação de senha" if recovery else "Confirme seu cadastro")
    message["From"] = sender
    message["To"] = to_email
    message.set_content(
        f"Seu código é: {token}\n"
        f"Ele expira em {settings.EMAIL_TOKEN_EXPIRE_MINUTES} minutos.\n"
        "Se você não fez esta solicitação, ignore este e-mail."
    )
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(message)
    except (smtplib.SMTPException, OSError):
        logger.error("SMTP delivery failed")
        raise HTTPException(503, "Não foi possível enviar o e-mail. Tente novamente mais tarde.") from None


def send_verification_email(to_email: str, token: str) -> None:
    send_code_email(to_email, token)
