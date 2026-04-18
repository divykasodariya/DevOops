import json
import re
from utils.logger import logger


def safe_parse_json(raw: str) -> dict | None:
    """
    Safely parse JSON from LLM output.
    Handles: raw JSON, ```json fenced blocks, trailing commas, extra text.
    """
    if not raw or not raw.strip():
        return None

    text = raw.strip()

    # Strip markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()

    # Try direct parse first
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Extract first JSON object or array
    match = re.search(r"(\{.*\}|\[.*\])", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # Remove trailing commas before } or ]
    cleaned = re.sub(r",\s*([}\]])", r"\1", text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.warning(f"safe_parse_json failed: {e} | raw[:200]={raw[:200]}")
        return None