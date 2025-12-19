"""
LiteLLM integration client for multi-provider AI access
"""

import math
import os
from typing import Any, Dict, List, Optional, Tuple

import litellm
from litellm import completion

# Track connectivity status per provider
_provider_online: Dict[str, bool] = {}

# Supported providers and their model prefixes for LiteLLM
SUPPORTED_PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "envVar": "OPENAI_API_KEY",
        "models": [
            {"id": "gpt-4", "label": "GPT-4"},
            {"id": "gpt-4-turbo", "label": "GPT-4 Turbo"},
            {"id": "gpt-4o", "label": "GPT-4o"},
            {"id": "gpt-4o-mini", "label": "GPT-4o Mini"},
            {"id": "gpt-3.5-turbo", "label": "GPT-3.5 Turbo"},
            {"id": "o1", "label": "o1"},
            {"id": "o1-mini", "label": "o1 Mini"},
            {"id": "o1-preview", "label": "o1 Preview"},
        ]
    },
    "anthropic": {
        "name": "Anthropic",
        "envVar": "ANTHROPIC_API_KEY",
        "models": [
            {"id": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet"},
            {"id": "claude-3-5-haiku-20241022", "label": "Claude 3.5 Haiku"},
            {"id": "claude-3-opus-20240229", "label": "Claude 3 Opus"},
            {"id": "claude-3-sonnet-20240229", "label": "Claude 3 Sonnet"},
            {"id": "claude-3-haiku-20240307", "label": "Claude 3 Haiku"},
        ]
    },
    "groq": {
        "name": "Groq",
        "envVar": "GROQ_API_KEY",
        "models": [
            {"id": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B"},
            {"id": "llama-3.1-70b-versatile", "label": "Llama 3.1 70B"},
            {"id": "llama-3.1-8b-instant", "label": "Llama 3.1 8B"},
            {"id": "mixtral-8x7b-32768", "label": "Mixtral 8x7B"},
            {"id": "gemma2-9b-it", "label": "Gemma 2 9B"},
        ]
    },
    "mistral": {
        "name": "Mistral",
        "envVar": "MISTRAL_API_KEY",
        "models": [
            {"id": "mistral-large-latest", "label": "Mistral Large"},
            {"id": "mistral-medium-latest", "label": "Mistral Medium"},
            {"id": "mistral-small-latest", "label": "Mistral Small"},
            {"id": "open-mixtral-8x22b", "label": "Mixtral 8x22B"},
            {"id": "open-mixtral-8x7b", "label": "Mixtral 8x7B"},
            {"id": "codestral-latest", "label": "Codestral"},
        ]
    },
    "google": {
        "name": "Google (Gemini)",
        "envVar": "GEMINI_API_KEY",
        "models": [
            {"id": "gemini-1.5-pro", "label": "Gemini 1.5 Pro"},
            {"id": "gemini-1.5-flash", "label": "Gemini 1.5 Flash"},
            {"id": "gemini-1.0-pro", "label": "Gemini 1.0 Pro"},
        ]
    },
    "cohere": {
        "name": "Cohere",
        "envVar": "COHERE_API_KEY",
        "models": [
            {"id": "command-r-plus", "label": "Command R+"},
            {"id": "command-r", "label": "Command R"},
            {"id": "command", "label": "Command"},
            {"id": "command-light", "label": "Command Light"},
        ]
    },
    "together_ai": {
        "name": "Together AI",
        "envVar": "TOGETHER_API_KEY",
        "models": [
            {"id": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "label": "Llama 3.3 70B"},
            {"id": "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo", "label": "Llama 3.1 405B"},
            {"id": "mistralai/Mixtral-8x22B-Instruct-v0.1", "label": "Mixtral 8x22B"},
            {"id": "Qwen/Qwen2.5-72B-Instruct-Turbo", "label": "Qwen 2.5 72B"},
        ]
    },
    "openrouter": {
        "name": "OpenRouter",
        "envVar": "OPENROUTER_API_KEY",
        "models": [
            {"id": "openai/gpt-4-turbo", "label": "GPT-4 Turbo"},
            {"id": "anthropic/claude-3.5-sonnet", "label": "Claude 3.5 Sonnet"},
            {"id": "google/gemini-pro-1.5", "label": "Gemini 1.5 Pro"},
            {"id": "meta-llama/llama-3.1-405b-instruct", "label": "Llama 3.1 405B"},
        ]
    },
    "deepseek": {
        "name": "DeepSeek",
        "envVar": "DEEPSEEK_API_KEY",
        "models": [
            {"id": "deepseek-chat", "label": "DeepSeek Chat"},
            {"id": "deepseek-coder", "label": "DeepSeek Coder"},
        ]
    },
    "cerebras": {
        "name": "Cerebras",
        "envVar": "CEREBRAS_API_KEY",
        "models": [
            {"id": "llama3.1-8b", "label": "Llama 3.1 8B"},
            {"id": "llama3.1-70b", "label": "Llama 3.1 70B"},
        ]
    },
}


def get_provider_model_string(provider: str, model: str) -> str:
    """
    Get the LiteLLM model string for a provider/model combination.
    LiteLLM uses format: provider/model for most providers.
    """
    # OpenAI doesn't need prefix
    if provider == "openai":
        return model

    # Anthropic uses its own prefix
    if provider == "anthropic":
        return model

    # Groq uses groq/ prefix
    if provider == "groq":
        return f"groq/{model}"

    # Mistral uses mistral/ prefix
    if provider == "mistral":
        return f"mistral/{model}"

    # Google/Gemini uses gemini/ prefix
    if provider == "google":
        return f"gemini/{model}"

    # Cohere uses cohere/ prefix
    if provider == "cohere":
        return f"cohere/{model}"

    # Together AI uses together_ai/ prefix
    if provider == "together_ai":
        return f"together_ai/{model}"

    # OpenRouter uses openrouter/ prefix
    if provider == "openrouter":
        return f"openrouter/{model}"

    # DeepSeek uses deepseek/ prefix
    if provider == "deepseek":
        return f"deepseek/{model}"

    # Cerebras uses cerebras/ prefix
    if provider == "cerebras":
        return f"cerebras/{model}"

    # Default: return model as-is
    return model


def list_providers() -> List[Dict[str, Any]]:
    """List all supported providers with their configuration."""
    providers = []
    for provider_id, info in SUPPORTED_PROVIDERS.items():
        api_key = os.environ.get(info["envVar"], "")
        providers.append({
            "id": provider_id,
            "name": info["name"],
            "envVar": info["envVar"],
            "hasApiKey": bool(api_key),
            "models": info["models"]
        })
    return providers


def list_models(provider: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    List available models, optionally filtered by provider.
    Returns models with normalized format.
    """
    models = []

    providers_to_check = [provider] if provider else SUPPORTED_PROVIDERS.keys()

    for prov in providers_to_check:
        if prov not in SUPPORTED_PROVIDERS:
            continue

        info = SUPPORTED_PROVIDERS[prov]
        for model in info["models"]:
            models.append({
                "id": model["id"],
                "label": model["label"],
                "provider": prov,
                "providerName": info["name"]
            })

    return models


def get_api_key(provider: str, env_var: Optional[str] = None) -> Optional[str]:
    """Get API key for a provider from environment."""
    if env_var:
        return os.environ.get(env_var)

    if provider in SUPPORTED_PROVIDERS:
        return os.environ.get(SUPPORTED_PROVIDERS[provider]["envVar"])

    return None


def check_connectivity(provider: str, api_key: Optional[str] = None) -> bool:
    """
    Test if a provider's API key works by making a minimal test call.
    """
    global _provider_online

    if provider not in SUPPORTED_PROVIDERS:
        return False

    info = SUPPORTED_PROVIDERS[provider]
    key = api_key or os.environ.get(info["envVar"])

    if not key:
        _provider_online[provider] = False
        return False

    # Get a simple model for testing
    test_model = info["models"][0]["id"] if info["models"] else None
    if not test_model:
        return False

    try:
        model_string = get_provider_model_string(provider, test_model)

        # Make a minimal test call
        response = completion(
            model=model_string,
            messages=[{"role": "user", "content": "Hi"}],
            api_key=key,
            max_tokens=5,
            timeout=10
        )

        _provider_online[provider] = True
        return True
    except Exception:
        _provider_online[provider] = False
        return False


def is_provider_online(provider: str) -> bool:
    """Check if a provider was last known to be online."""
    return _provider_online.get(provider, False)


def chat(messages: List[Dict[str, str]], options: Dict[str, Any]) -> Dict[str, Any]:
    """
    Call LiteLLM completion with messages.

    Args:
        messages: List of message dicts with 'role' and 'content'
        options: Dict with 'provider', 'model', 'api_key', and optional 'temperature', 'max_tokens'

    Returns:
        {"text": str, "usage": dict}
    """
    global _provider_online

    provider = options.get("provider", "openai")
    model = options.get("model", "gpt-4")
    api_key = options.get("api_key")

    # Get API key from environment if not provided
    if not api_key:
        if provider in SUPPORTED_PROVIDERS:
            api_key = os.environ.get(SUPPORTED_PROVIDERS[provider]["envVar"])

    if not api_key:
        raise ValueError(f"No API key found for provider '{provider}'")

    # Build LiteLLM model string
    model_string = get_provider_model_string(provider, model)

    # Build completion options
    completion_options = {
        "model": model_string,
        "messages": messages,
        "api_key": api_key
    }

    if options.get("temperature") is not None:
        completion_options["temperature"] = options["temperature"]
    if options.get("max_tokens") is not None:
        completion_options["max_tokens"] = options["max_tokens"]

    try:
        response = completion(**completion_options)
        _provider_online[provider] = True

        # Extract text from response
        text = ""
        if response.choices and len(response.choices) > 0:
            message = response.choices[0].message
            if message and message.content:
                text = message.content

        # Treat empty response as an error
        if not text:
            raise ValueError("Backend returned empty response")

        # Extract usage
        usage = None
        if response.usage:
            usage = {
                "prompt_tokens": response.usage.prompt_tokens or 0,
                "completion_tokens": response.usage.completion_tokens or 0,
                "total_tokens": response.usage.total_tokens or 0
            }
            if not usage["total_tokens"]:
                usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]

        return {"text": text, "usage": usage}

    except Exception as e:
        _provider_online[provider] = False
        raise


def estimate_tokens(text: str) -> int:
    """Estimate tokens: ceil(len(text) / 4)"""
    if not text:
        return 0
    return math.ceil(len(text) / 4)


def classify_error(error: Exception) -> Tuple[int, str]:
    """
    Map errors to (status_code, error_type).
    """
    msg = str(error).lower()

    # Check for error code attribute
    code = getattr(error, "code", "") or ""

    # Network/connectivity errors -> 503 Service Unavailable
    network_codes = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "ECONNRESET", "ENETUNREACH", "EAI_AGAIN"]
    if code in network_codes:
        return (503, "service_unavailable")

    if any(term in msg for term in ["network", "timeout", "connect", "offline", "unavailable", "empty response"]):
        return (503, "service_unavailable")

    if any(term in msg for term in ["auth", "token", "unauthorized", "api key"]):
        return (401, "authentication_error")

    if any(term in msg for term in ["permission", "forbidden"]):
        return (403, "permission_error")

    if any(term in msg for term in ["rate", "limit", "quota"]):
        return (429, "rate_limit_error")

    if any(term in msg for term in ["invalid", "bad request"]):
        return (400, "invalid_request_error")

    if "not found" in msg:
        return (404, "not_found_error")

    return (500, "internal_server_error")
