"""
Run with: pytest tests/test_request.py -v
"""
import pytest
from unittest.mock import AsyncMock, patch
from services.request.parser import parse_request, _keyword_fallback
from services.request.validator import validate_parsed_request


# ── Unit tests (no LLM / DB calls) ──────────────────────────────────────────

def test_keyword_fallback_leave():
    result = _keyword_fallback("sir i need leave tomorrow sick", "Computer Engineering")
    assert result is not None
    assert result.type == "leave"
    assert result.urgency == "medium"


def test_keyword_fallback_urgent_od():
    result = _keyword_fallback("urgent od needed for competition today", "IT")
    assert result is not None
    assert result.type == "od"
    assert result.urgency == "high"


def test_keyword_fallback_certificate():
    result = _keyword_fallback("need bonafide certificate asap", "Mechanical")
    assert result is not None
    assert result.type == "certificate"
    assert result.urgency == "high"


def test_validator_fixes_invalid_type():
    data = {
        "type": "vacation",          # invalid
        "title": "Test Request",
        "reason": "Going home",
        "urgency": "medium",
        "department": "CSE",
    }
    is_valid, errors = validate_parsed_request(data)
    assert data["type"] == "custom"  # corrected
    assert any("Defaulting" in e for e in errors)


def test_validator_fixes_invalid_urgency():
    data = {
        "type": "leave",
        "title": "Leave",
        "reason": "Sick",
        "urgency": "extreme",         # invalid
        "department": "CSE",
    }
    is_valid, errors = validate_parsed_request(data)
    assert data["urgency"] == "medium"


# ── Integration test (mocked LLM) ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_parse_request_with_mocked_llm():
    mock_response = '{"type":"leave","title":"Leave Request","reason":"family emergency","urgency":"high","department":"Computer Engineering","extra":{}}'

    with patch("services.request.parser.call_llm", AsyncMock(return_value=mock_response)):
        result = await parse_request("sir family emergency need leave", role="student")

    assert result is not None
    assert result.type == "leave"
    assert result.urgency == "high"
    assert result.department == "Computer Engineering"


@pytest.mark.asyncio
async def test_parse_request_falls_back_on_bad_json():
    with patch("services.request.parser.call_llm", AsyncMock(return_value="NOT JSON AT ALL")):
        result = await parse_request("need certificate urgent", role="student")

    # Should fall back to keyword detection
    assert result is not None
    assert result.type == "certificate"