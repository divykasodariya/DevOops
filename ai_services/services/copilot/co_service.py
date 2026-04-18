import re
from services.llm.llm_client import call_llm
from services.llm.prompts import COPILOT_SYSTEM
from services.copilot.intent_detector import detect_intent
from services.copilot.context_builder import build_context, format_context_for_prompt
from services.request.parser import parse_request
from models.copilot_model import CopilotInput, CopilotResponse, IntentType
from utils.json_parser import safe_parse_json
from utils.logger import logger


async def handle_copilot_message(inp: CopilotInput) -> CopilotResponse:
    # 1. Detect intent
    intent = await detect_intent(inp.message)
    logger.info(f"Intent: {intent} | user: {inp.user_id}")

    # 2. Build DB context based on intent
    db_context = await build_context(inp.user_id, inp.department_id, intent)
    context_str = format_context_for_prompt(db_context)

    # 3. Build system prompt with injected context
    system = COPILOT_SYSTEM.format(
        role=inp.role,
        department=inp.department_id or "Unknown",
    )
    if context_str:
        system += f"\n\nCurrent user data:\n{context_str}"

    # 4. Build message history (cap at last 10 turns to stay within token budget)
    history = inp.history[-10:]
    messages = [{"role": "system", "content": system}]
    messages.extend(history)
    messages.append({"role": "user", "content": inp.message})

    # 5. Call LLM
    try:
        raw_reply = await call_llm(messages, temperature=0.4, max_tokens=600)
    except Exception as e:
        logger.error(f"Copilot LLM failed: {e}")
        return CopilotResponse(
            reply="Sorry, I'm having trouble responding right now. Please try again.",
            intent=IntentType.unknown,
            session_id=inp.session_id,
        )

    # 6. Extract optional ACTION block from the reply
    action = None
    action_data = None
    clean_reply = raw_reply

    action_match = re.search(r"ACTION:\s*(\{.*?\})", raw_reply, re.DOTALL)
    if action_match:
        action_json = safe_parse_json(action_match.group(1))
        if action_json:
            action      = action_json.get("action")
            action_data = action_json.get("data")
        clean_reply = raw_reply[: action_match.start()].strip()

    # 7. If intent is submit_request and we have action_data, enrich via parser
    if intent == IntentType.submit_request and not action_data:
        parsed = await parse_request(inp.message, role=inp.role)
        if parsed:
            action      = "create_request"
            action_data = parsed.model_dump()

    return CopilotResponse(
        reply=clean_reply,
        intent=intent,
        action=action,
        action_data=action_data,
        citations=_build_citations(db_context),
        session_id=inp.session_id,
    )


def _build_citations(context: dict) -> list[dict]:
    citations = []
    for req in context.get("pending_requests", [])[:2]:
        citations.append({
            "refModel": "ApprovalRequest",
            "refId":    req.get("_id"),
            "summary":  req.get("title", ""),
        })
    return citations