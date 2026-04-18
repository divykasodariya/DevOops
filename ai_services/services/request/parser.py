from services.llm.llm_client import call_llm
from services.llm.prompts import REQUEST_PARSER_SYSTEM, REQUEST_PARSER_USER
from models.request_model import ParsedRequest
from utils.json_parser import safe_parse_json
from utils.logger import logger


async def parse_request(
    raw_text: str,
    role: str = "student",
    department: str = "Unknown",
) -> ParsedRequest | None:
    """
    Sends raw informal text to the LLM and returns a structured ParsedRequest.
    Returns None if parsing fails after fallback.
    """
    messages = [
        {"role": "system", "content": REQUEST_PARSER_SYSTEM},
        {
            "role": "user",
            "content": REQUEST_PARSER_USER.format(
                raw_text=raw_text,
                role=role,
                department=department,
            ),
        },
    ]

    try:
        raw_json = await call_llm(messages, json_mode=True, temperature=0.1)
        data = safe_parse_json(raw_json)
        if data:
            return ParsedRequest(**data)
    except Exception as e:
        logger.warning(f"AI parsing failed: {e}. Trying keyword fallback.")

    # ── Keyword fallback ────────────────────────────────────────────────────
    return _keyword_fallback(raw_text, department)


def _keyword_fallback(text: str, department: str) -> ParsedRequest | None:
    """Simple rule-based fallback so the system never fully breaks."""
    text_lower = text.lower()

    type_map = {
        "leave":       ["leave", "absent", "sick", "medical", "ill"],
        "od":          ["od", "on duty", "industrial visit", "iv", "competition"],
        "certificate": ["certificate", "bonafide", "tc", "transfer"],
        "lor":         ["lor", "recommendation", "reference letter"],
        "room":        ["room", "hall", "booking", "auditorium", "lab book"],
        "event":       ["event", "fest", "seminar", "workshop", "hackathon"],
        "lab_access":  ["lab access", "lab key", "after hours lab"],
    }

    detected_type = "custom"
    for req_type, keywords in type_map.items():
        if any(kw in text_lower for kw in keywords):
            detected_type = req_type
            break

    urgency = "medium"
    if any(w in text_lower for w in ["urgent", "asap", "emergency", "immediately", "today"]):
        urgency = "high"
    elif any(w in text_lower for w in ["whenever", "no rush", "later"]):
        urgency = "low"

    logger.info(f"Keyword fallback result → type={detected_type}, urgency={urgency}")

    return ParsedRequest(
        type=detected_type,          # type: ignore[arg-type]
        title=f"{detected_type.replace('_', ' ').title()} Request",
        reason=text[:200],
        urgency=urgency,             # type: ignore[arg-type]
        department=department,
    )