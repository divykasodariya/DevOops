from openai import AsyncOpenAI
from config import settings
from utils.logger import logger


_client: AsyncOpenAI | None = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            api_key=settings.GROQ_API_KEY,
            base_url=settings.GROQ_BASE_URL,
        )
    return _client


async def call_llm(
    messages: list[dict],
    temperature: float | None = None,
    max_tokens: int | None = None,
    json_mode: bool = False,
) -> str:
    """
    Core LLM call wrapper.  Always returns the raw text content string.

    Args:
        messages:    OpenAI-format message list  [{role, content}, ...]
        temperature: overrides settings default
        max_tokens:  overrides settings default
        json_mode:   if True, instructs model to respond ONLY with valid JSON
    """
    client = get_llm_client()

    kwargs: dict = {
        "model":       settings.GROQ_MODEL,
        "messages":    messages,
        "temperature": temperature if temperature is not None else settings.TEMPERATURE,
        "max_tokens":  max_tokens  if max_tokens  is not None else settings.MAX_TOKENS,
    }

    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = await client.chat.completions.create(**kwargs)
        content = response.choices[0].message.content or ""
        logger.debug(f"LLM raw response: {content[:200]}")
        return content
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise


async def call_llm_simple(prompt: str, json_mode: bool = False) -> str:
    """Convenience wrapper for single-user-turn prompts."""
    return await call_llm(
        messages=[{"role": "user", "content": prompt}],
        json_mode=json_mode,
    )