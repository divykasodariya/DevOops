from fastapi import Header, HTTPException, status
from config import settings


async def verify_internal_token(x_internal_token: str = Header(...)):
    """
    Lightweight internal auth — Node backend passes a shared secret.
    Replace with JWT validation if exposing to external clients.
    """
    expected = getattr(settings, "INTERNAL_TOKEN", "dev-token")
    if x_internal_token != expected:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid internal token",
        )
    return True