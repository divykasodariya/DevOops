from services.llm.llm_client import call_llm
from services.llm.prompts import TAG_GENERATOR_SYSTEM
from models.tag_model import TagInput, TagOutput
from utils.json_parser import safe_parse_json
from utils.logger import logger


async def generate_tags(inp: TagInput) -> TagOutput:
    """
    Generates semantic tags for any campus entity text.
    Used for ProfessorProfile.autoTags, Issue categorization, etc.
    """
    system = TAG_GENERATOR_SYSTEM.format(
        max_tags=inp.max_tags,
        context=inp.context or "general",
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user",   "content": inp.text},
    ]

    try:
        raw = await call_llm(messages, json_mode=True, temperature=0.2, max_tokens=200)
        data = safe_parse_json(raw)

        if data and isinstance(data.get("tags"), list):
            tags = [str(t).lower().replace(" ", "-") for t in data["tags"]][: inp.max_tags]
            return TagOutput(tags=tags, entity_id=inp.entity_id)

    except Exception as e:
        logger.warning(f"Tag generation failed: {e}")

    # Fallback: simple keyword extraction
    words = inp.text.lower().split()
    stop  = {"the","a","an","is","in","of","to","and","for","with","on","at","by","from"}
    tags  = list(dict.fromkeys(w for w in words if len(w) > 4 and w not in stop))[: inp.max_tags]
    return TagOutput(tags=tags, entity_id=inp.entity_id)