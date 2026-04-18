import pytest
from unittest.mock import AsyncMock, patch
from models.tag_model import TagInput
from services.tagging.tagger import generate_tags


@pytest.mark.asyncio
async def test_tag_generation_mocked():
    mock_response = '{"tags": ["machine-learning", "deep-learning", "neural-networks", "computer-vision"]}'
    inp = TagInput(text="Research interests in ML, deep learning, and CV", context="professor_profile", max_tags=5)

    with patch("services.tagging.tag_generator.call_llm", AsyncMock(return_value=mock_response)):
        result = await generate_tags(inp)

    assert len(result.tags) > 0
    assert "machine-learning" in result.tags


@pytest.mark.asyncio
async def test_tag_generation_fallback_on_failure():
    inp = TagInput(text="broken pipe in lab bathroom third floor", context="issue", max_tags=5)

    with patch("services.tagging.tag_generator.call_llm", AsyncMock(side_effect=Exception("LLM down"))):
        result = await generate_tags(inp)

    # Should return keyword fallback tags, not crash
    assert isinstance(result.tags, list)
    assert len(result.tags) > 0