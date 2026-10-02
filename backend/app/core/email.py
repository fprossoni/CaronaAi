"""Email sending utilities.

In development, tokens are printed to stdout instead of sent.
Set SMTP_USER and SMTP_PASSWORD in .env to enable real email delivery.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str) -> None:
    """Send an email verification token to the user."""
    subject = "Carona Aí — Confirme seu cadastro"
    html_body = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color: #4f46e5;">🚗 Carona Aí</h2>
        <p>Seu código de verificação é:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px;
                    color: #4f46e5; text-align: center; padding: 24px 0;">
            {token}
        </div>
        <p style="color: #666;">O código expira em {settings.EMAIL_TOKEN_EXPIRE_MINUTES} minutos.</p>
        <p style="color: #666;">Se você não solicitou este código, ignore este e-mail.</p>
    </div>
    """

    if not settings.SMTP_USER:
        # Development fallback: print prominently to terminal
        print(f"\n{'='*55}", flush=True)
        print(f"  [DEV - CARONA AÍ] CÓDIGO DE VERIFICAÇÃO", flush=True)
        print(f"  Para: {to_email}", flush=True)
        print(f"  Código: {token}", flush=True)
        print(f"{'='*55}\n", flush=True)
        logger.info("[DEV] Verification token for %s: %s", to_email, token)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.EMAIL_FROM, to_email, msg.as_string())
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to_email, exc)
        raise
