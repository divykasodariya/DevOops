import aiosmtplib
from email.message import EmailMessage
from config import settings

async def send_email(to: str, subject: str, body: str) -> bool:
    msg = EmailMessage()
    msg["From"]    = settings.SMTP_USER
    msg["To"]      = to
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASS,
            start_tls=True,
        )
        return True
    except Exception as e:
        return False