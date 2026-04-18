from services.llm.llm_client import call_llm
from services.llm.prompts import TAG_PROMPT
from utils.json_parser import safe_parse

def generate_tags(data: dict):
    prompt = TAG_PROMPT.replace("{input}", str(data))

    res = call_llm(prompt)

    tags = safe_parse(res)

    if not tags:
        return ["general", "faculty"]

    return tags