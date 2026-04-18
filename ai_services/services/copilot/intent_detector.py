from services.llm.llm_client import call_llm
from services.llm.prompts import COPILOT_INTENT_SYSTEM
from models.copilot_model import IntentType
from utils.json_parser import safe_parse_json
from utils.logger import logger


# Fast keyword shortcuts — avoids an LLM call for obvious intents
_KEYWORD_MAP: dict[str, IntentType] = {
    "hi":      IntentType.greeting,
    "hello":   IntentType.greeting,
    "hey":     IntentType.greeting,
    "status":  IntentType.check_status,
    "timetable":   IntentType.ask_schedule,
    "schedule":    IntentType.ask_schedule,
    "attendance":  IntentType.attendance_query,
    "fine":        IntentType.payment_query,
    "fee":         IntentType.payment_query,
    "issue":       IntentType.report_issue,
    "complaint":   IntentType.report_issue,
    "broken":      IntentType.report_issue,
}


async def detect_intent(message: str) -> IntentType:
    """
    First tries a cheap keyword match, then falls back to LLM classification.
    """
    lower = message.lower().strip()

    for keyword, intent in _KEYWORD_MAP.items():
        if keyword in lower:
            logger.debug(f"Intent via keyword: {intent}")
            return intent

    # LLM classification
    messages = [
        {"role": "system", "content": COPILOT_INTENT_SYSTEM},
        {"role": "user",   "content": message},
    ]

    try:
        raw = await call_llm(messages, json_mode=True, temperature=0.0, max_tokens=50)
        data = safe_parse_json(raw)
        if data and "intent" in data:
            return IntentType(data["intent"])
    except Exception as e:
        logger.warning(f"Intent detection failed: {e}")

    return IntentType.unknown