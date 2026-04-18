from models.request_model import ParsedRequest, RequestType, UrgencyLevel
from utils.logger import logger


VALID_TYPES    = {e.value for e in RequestType}
VALID_URGENCY  = {e.value for e in UrgencyLevel}

REQUIRED_FIELDS = ("type", "title", "reason", "urgency", "department")


def validate_parsed_request(data: dict) -> tuple[bool, list[str]]:
    """
    Validates a raw dict before constructing ParsedRequest.
    Returns (is_valid, list_of_errors).
    """
    errors: list[str] = []

    for field in REQUIRED_FIELDS:
        if not data.get(field):
            errors.append(f"Missing required field: {field}")

    if data.get("type") and data["type"] not in VALID_TYPES:
        errors.append(f"Invalid type: {data['type']}. Defaulting to 'custom'.")
        data["type"] = "custom"

    if data.get("urgency") and data["urgency"] not in VALID_URGENCY:
        errors.append(f"Invalid urgency: {data['urgency']}. Defaulting to 'medium'.")
        data["urgency"] = "medium"

    if data.get("reason") and len(data["reason"]) > 1000:
        data["reason"] = data["reason"][:1000]
        errors.append("Reason truncated to 1000 chars.")

    if errors:
        logger.warning(f"Validation issues: {errors}")

    return len(errors) == 0 or all("Defaulting" in e or "truncated" in e for e in errors), errors