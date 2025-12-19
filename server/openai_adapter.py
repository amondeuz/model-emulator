"""
OpenAI Chat Completions API adapter
"""

import random
import string
import time
from typing import Any, Dict

from .litellm_client import chat, estimate_tokens, classify_error
from .config import get_config, is_emulator_active
from .logger import log_request, log_success, log_error


def generate_completion_id() -> str:
    """Generate a unique completion ID: chatcmpl-{timestamp}-{random7}"""
    random_chars = ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))
    return f"chatcmpl-{int(time.time() * 1000)}-{random_chars}"


def create_error_response(error: Exception, status_code: int = 500,
                          error_type: str = "internal_server_error") -> Dict[str, Any]:
    """Create a standardized error response."""
    return {
        "statusCode": status_code,
        "body": {
            "error": {
                "message": str(error) or "An error occurred",
                "type": error_type,
                "code": getattr(error, "code", None)
            }
        }
    }


class ValidationError(Exception):
    """Custom exception for validation errors."""
    def __init__(self, message: str, status_code: int = 400,
                 error_type: str = "invalid_request_error"):
        super().__init__(message)
        self.status_code = status_code
        self.type = error_type


def validate_request(body: Dict[str, Any]) -> bool:
    """
    Validate an OpenAI-compatible chat completion request.
    Raises ValidationError if invalid.
    """
    if not body:
        raise ValidationError("Request body is required")

    # Model is required per OpenAI spec
    model = body.get("model")
    if not model or not isinstance(model, str) or not model.strip():
        raise ValidationError("model field is required")

    if not body.get("messages") and not body.get("prompt"):
        raise ValidationError("Either messages or prompt field is required")

    messages = body.get("messages")
    if messages is not None:
        if not isinstance(messages, list) or len(messages) == 0:
            raise ValidationError("messages must be a non-empty array")

        for msg in messages:
            if not isinstance(msg, dict):
                raise ValidationError("Each message must be an object")
            if "role" not in msg or msg.get("content") is None:
                raise ValidationError("Each message must have role and content fields")

    return True


async def handle_chat_completion(request_body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Handle a chat completion request.
    Routes through LiteLLM to the configured provider.
    """
    try:
        if not is_emulator_active():
            return create_error_response(
                Exception("Emulator is not active. Start it from the configuration UI."),
                503,
                "service_unavailable"
            )

        validate_request(request_body)

        config = get_config()
        requested_model = request_body.get("model", "")
        messages = request_body.get("messages")
        prompt = request_body.get("prompt")
        temperature = request_body.get("temperature")
        max_tokens = request_body.get("max_tokens") or request_body.get("max_completion_tokens")

        provider = config.get("provider", "openai")
        model = config.get("model", "gpt-4")
        api_key_env_var = config.get("apiKeyEnvVar", "OPENAI_API_KEY")

        log_request({
            "incomingModel": requested_model,
            "provider": provider,
            "model": model,
            "messageCount": len(messages) if messages else 1,
            "status": "processing"
        })

        # Build options for LiteLLM
        options = {
            "provider": provider,
            "model": model,
            "api_key": None  # Will be read from environment using api_key_env_var
        }

        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["max_tokens"] = max_tokens

        # Prepare input - convert prompt to messages if needed
        if messages:
            input_messages = messages
        else:
            input_messages = [{"role": "user", "content": prompt}]

        # Call LiteLLM
        result = chat(input_messages, options)

        # Calculate usage
        if result.get("usage"):
            usage = result["usage"]
        else:
            prompt_text = " ".join(m.get("content", "") for m in input_messages)
            prompt_tokens = estimate_tokens(prompt_text)
            completion_tokens = estimate_tokens(result["text"])
            usage = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens
            }

        log_success({
            "provider": provider,
            "model": model,
            "promptTokens": usage["prompt_tokens"],
            "completionTokens": usage["completion_tokens"],
            "totalTokens": usage["total_tokens"]
        })

        # Return response model as the requested model (for compatibility)
        response_model = requested_model

        return {
            "statusCode": 200,
            "body": {
                "id": generate_completion_id(),
                "object": "chat.completion",
                "created": int(time.time()),
                "model": response_model,
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": result["text"]
                    },
                    "finish_reason": "stop"
                }],
                "usage": usage
            }
        }

    except ValidationError as e:
        log_error(e, {"endpoint": "/v1/chat/completions", "requestedModel": request_body.get("model")})
        return create_error_response(e, e.status_code, e.type)

    except Exception as e:
        log_error(e, {"endpoint": "/v1/chat/completions", "requestedModel": request_body.get("model")})
        status_code, error_type = classify_error(e)
        return create_error_response(e, status_code, error_type)
