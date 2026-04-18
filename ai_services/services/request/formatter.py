from services.llm.llm_client import call_llm
from services.llm.prompts import FORMATTER_SYSTEM, FORMATTER_USER
from models.request_model import ParsedRequest
from utils.logger import logger


async def format_request_body(parsed: ParsedRequest, role: str = "student") -> str:
    """
    Converts structured ParsedRequest into a formal approval request body.
    Falls back to a simple template if LLM fails.
    """
    messages = [
        {"role": "system", "content": FORMATTER_SYSTEM},
        {
            "role": "user",
            "content": FORMATTER_USER.format(
                type=parsed.type,
                title=parsed.title,
                reason=parsed.reason,
                urgency=parsed.urgency,
                role=role,
                department=parsed.department,
            ),
        },
    ]

    try:
        result = await call_llm(messages, temperature=0.3, max_tokens=300)
        return result.strip()
    except Exception as e:
        logger.warning(f"Formatter LLM failed: {e}. Using template fallback.")
        return _template_fallback(parsed, role)


def _template_fallback(parsed: ParsedRequest, role: str) -> str:
    return (
        f"Respected Sir/Ma'am,\n\n"
        f"I, a {role} from the {parsed.department} department, humbly request "
        f"your approval for a {parsed.type.replace('_', ' ')} request.\n\n"
        f"Reason: {parsed.reason}\n\n"
        f"Urgency: {parsed.urgency.upper()}\n\n"
        f"Kindly consider my request at the earliest.\n\n"
        f"Thank you."
    )