from services.llm.llm_client import call_llm
from services.llm.prompts import REQUEST_PARSE_PROMPT
from utils.json_parser import safe_parse

def parse_request(text: str):
    prompt = REQUEST_PARSE_PROMPT.replace("{input}", text)

    res = call_llm(prompt)

    parsed = safe_parse(res)

    if not parsed:
        return {
            "error": "parse_failed",
            "raw": res
        }

    return parsed