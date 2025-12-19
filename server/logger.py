"""
Logging utility for the model emulator
"""

from datetime import datetime
from typing import Any, Dict, Optional

# In-memory health tracking
_last_successful_completion: Optional[Dict[str, Any]] = None
_last_error: Optional[Dict[str, Any]] = None

# Config getter (will be set by main module to avoid circular imports)
_get_config = None


def set_config_getter(getter):
    """Set the config getter function to avoid circular imports."""
    global _get_config
    _get_config = getter


def timestamp() -> str:
    """Return ISO-formatted timestamp."""
    return datetime.utcnow().isoformat() + "Z"


def log_request(data: Dict[str, Any]) -> None:
    """Log an incoming request."""
    if _get_config is None:
        return

    config = _get_config()
    if not config.get("logging", {}).get("logRequests", True):
        return

    incoming_model = data.get("incomingModel", "")
    provider = data.get("provider", "")
    model = data.get("model", "")
    message_count = data.get("messageCount", 0)
    status = data.get("status", "")

    print(f"[{timestamp()}] REQUEST: incoming_model={incoming_model}, provider={provider}, model={model}, messages={message_count}, status={status}")


def log_success(data: Dict[str, Any]) -> None:
    """Log a successful completion."""
    global _last_successful_completion

    if _get_config is None:
        return

    config = _get_config()
    if not config.get("logging", {}).get("enabled", True):
        return

    provider = data.get("provider", "")
    model = data.get("model", "")
    prompt_tokens = data.get("promptTokens", 0)
    completion_tokens = data.get("completionTokens", 0)
    total_tokens = data.get("totalTokens", 0)

    print(f"[{timestamp()}] SUCCESS: provider={provider}, model={model}, tokens={{prompt: {prompt_tokens}, completion: {completion_tokens}, total: {total_tokens}}}")

    _last_successful_completion = {
        "timestamp": int(datetime.utcnow().timestamp() * 1000),
        "provider": provider,
        "model": model,
        "tokens": {
            "promptTokens": prompt_tokens,
            "completionTokens": completion_tokens,
            "totalTokens": total_tokens
        }
    }


def log_error(error: Exception, context: Optional[Dict[str, Any]] = None) -> None:
    """Log an error."""
    global _last_error

    if _get_config is None:
        return

    config = _get_config()
    if not config.get("logging", {}).get("logErrors", True):
        return

    context = context or {}
    print(f"[{timestamp()}] ERROR: {{'message': '{str(error)}', 'context': {context}}}")

    _last_error = {
        "timestamp": int(datetime.utcnow().timestamp() * 1000),
        "message": str(error),
        "context": context
    }


def log_info(message: str) -> None:
    """Log an info message."""
    print(f"[{timestamp()}] INFO: {message}")


def get_health_info() -> Dict[str, Any]:
    """Return health info for status reporting."""
    return {
        "lastSuccessfulCompletion": _last_successful_completion,
        "lastError": _last_error
    }
