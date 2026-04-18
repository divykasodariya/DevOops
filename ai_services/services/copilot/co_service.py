from services.llm.llm_client import call_llm
from services.copilot.intent_detector import detect_intent
from services.copilot.context_builder import build_context

from services.llm.llm_client import call_llm
from services.llm.prompts import COPILOT_PROMPT

def handle_query(query: str, user_id: str):
    # mock context
    context = """
    Pending requests: 2
    Next class: DBMS at 10 AM
    """

    prompt = COPILOT_PROMPT.replace("{context}", context)\
                           .replace("{query}", query)

    return call_llm(prompt)