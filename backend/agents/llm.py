"""LangChain-based LLM provider for TuneX agents.

Provides a unified interface to create ChatModels from user settings,
and supports structured Pydantic output via .with_structured_output().
"""

import json
import logging
from typing import Optional, Type, TypeVar
from pydantic import BaseModel

from backend.config import settings

logger = logging.getLogger("tunex.llm")

T = TypeVar("T", bound=BaseModel)


class LLMNotConfiguredError(Exception):
    """Raised when the user hasn't configured an LLM provider."""
    pass


def get_chat_model(temperature: float = 0.3, max_tokens: int = 4096):
    """Create a LangChain ChatModel from user-configured settings.

    Raises LLMNotConfiguredError if no provider / API key is set.
    """
    provider = settings.llm_provider
    model = settings.llm_model

    if provider == "openai":
        if not settings.openai_api_key:
            raise LLMNotConfiguredError(
                "OpenAI API key not configured. Go to Settings to add your API key."
            )
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model,
            api_key=settings.openai_api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    elif provider == "anthropic":
        if not settings.anthropic_api_key:
            raise LLMNotConfiguredError(
                "Anthropic API key not configured. Go to Settings to add your API key."
            )
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model,
            api_key=settings.anthropic_api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    elif provider == "cohere":
        if not settings.cohere_api_key:
            raise LLMNotConfiguredError(
                "Cohere API key not configured. Go to Settings to add your API key."
            )
        from langchain_cohere import ChatCohere
        return ChatCohere(
            model=model,
            cohere_api_key=settings.cohere_api_key,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    elif provider == "ollama":
        from langchain_ollama import ChatOllama
        return ChatOllama(
            model=model,
            base_url=settings.ollama_endpoint,
            temperature=temperature,
            num_predict=max_tokens,
        )

    else:
        raise LLMNotConfiguredError(f"Unknown LLM provider: {provider}")


async def call_llm(
    system_prompt: str,
    user_message: str,
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> str:
    """Call the configured LLM and return raw text response."""
    from langchain_core.messages import SystemMessage, HumanMessage

    llm = get_chat_model(temperature=temperature, max_tokens=max_tokens)
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ]
    response = await llm.ainvoke(messages)
    return response.content


async def call_llm_structured(
    system_prompt: str,
    user_message: str,
    output_schema: Type[T],
    temperature: float = 0.3,
    max_tokens: int = 4096,
) -> T:
    """Call the configured LLM with Pydantic structured output.

    Uses LangChain's .with_structured_output() which leverages
    tool calling / function calling for reliable structured responses.
    Falls back to JSON parsing if structured output isn't supported.
    """
    from langchain_core.messages import SystemMessage, HumanMessage

    llm = get_chat_model(temperature=temperature, max_tokens=max_tokens)

    try:
        structured_llm = llm.with_structured_output(output_schema)
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_message),
        ]
        result = await structured_llm.ainvoke(messages)
        if isinstance(result, output_schema):
            return result
        # Some providers return dict instead of model instance
        if isinstance(result, dict):
            return output_schema(**result)
        return result
    except (NotImplementedError, AttributeError, TypeError):
        # Fallback: ask for JSON and parse manually
        logger.warning(
            f"Structured output not supported for {settings.llm_provider}, "
            f"falling back to JSON parsing"
        )
        schema_json = json.dumps(output_schema.model_json_schema(), indent=2)
        enhanced_system = (
            f"{system_prompt}\n\n"
            f"You MUST respond with valid JSON matching this exact schema:\n"
            f"{schema_json}\n\n"
            f"Return ONLY the JSON object, no other text."
        )
        raw = await call_llm(
            system_prompt=enhanced_system,
            user_message=user_message,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        parsed = parse_json_response(raw)
        return output_schema(**parsed)


def parse_json_response(text: str) -> dict:
    """Extract JSON from LLM response, handling markdown code blocks."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # Remove opening ```json
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in the text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
        raise


def is_llm_configured() -> bool:
    """Check if the LLM is properly configured and ready to use."""
    try:
        get_chat_model()
        return True
    except (LLMNotConfiguredError, ImportError, Exception):
        return False
