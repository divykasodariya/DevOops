import pytest
from unittest.mock import AsyncMock, patch
from models.copilot_model import CopilotInput, IntentType
from services.copilot.intent_detector import detect_intent
from services.copilot.co_service import handle_copilot_message


# ── Intent detector tests ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_intent_greeting():
    intent = await detect_intent("hello there")
    assert intent == IntentType.greeting


@pytest.mark.asyncio
async def test_intent_schedule():
    intent = await detect_intent("what is my timetable for tomorrow")
    assert intent == IntentType.ask_schedule


@pytest.mark.asyncio
async def test_intent_payment():
    intent = await detect_intent("do i have any pending fee")
    assert intent == IntentType.payment_query


# ── Copilot service test (fully mocked) ─────────────────────────────────────

@pytest.mark.asyncio
async def test_copilot_returns_response():
    inp = CopilotInput(
        message="hi, can you help me apply for leave?",
        session_id="sess_001",
        user_id="64f1234567890abcdef12345",
        role="student",
    )

    mock_llm_reply = "Sure! I can help you apply for leave. Please tell me the reason and duration."

    with (
        patch("services.copilot.copilot_service.call_llm", AsyncMock(return_value=mock_llm_reply)),
        patch("services.copilot.context_builder.get_pending_requests_for_user", AsyncMock(return_value=[])),
        patch("services.copilot.context_builder.get_upcoming_schedules_for_user", AsyncMock(return_value=[])),
        patch("services.copilot.context_builder.get_pending_payments_for_user", AsyncMock(return_value=[])),
    ):
        response = await handle_copilot_message(inp)

    assert response.session_id == "sess_001"
    assert len(response.reply) > 0