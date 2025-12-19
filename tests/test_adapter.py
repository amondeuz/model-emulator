"""
Unit tests for OpenAI adapter and LiteLLM client
Run with: pytest tests/test_adapter.py -v
"""

import pytest
from unittest.mock import patch, MagicMock
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.openai_adapter import validate_request, create_error_response, ValidationError
from server.litellm_client import estimate_tokens, classify_error, list_providers, list_models


class TestValidateRequest:
    """Tests for request validation."""

    def test_valid_request_with_messages(self):
        """Test valid request with messages."""
        body = {
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hello"}]
        }
        assert validate_request(body) is True

    def test_valid_request_with_prompt(self):
        """Test valid request with prompt."""
        body = {"model": "gpt-4", "prompt": "Hello"}
        assert validate_request(body) is True

    def test_reject_missing_messages_and_prompt(self):
        """Test that request without messages or prompt is rejected."""
        body = {"model": "gpt-4"}
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        assert "messages or prompt" in str(exc_info.value).lower()

    def test_reject_empty_messages_array(self):
        """Test that empty messages array is rejected."""
        body = {"model": "gpt-4", "messages": []}
        with pytest.raises(ValidationError):
            validate_request(body)

    def test_reject_invalid_message_format(self):
        """Test that message without content is rejected."""
        body = {"model": "gpt-4", "messages": [{"role": "user"}]}
        with pytest.raises(ValidationError):
            validate_request(body)

    def test_reject_missing_model(self):
        """Test that request without model is rejected."""
        body = {"messages": [{"role": "user", "content": "Hello"}]}
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        assert exc_info.value.status_code == 400
        assert exc_info.value.type == "invalid_request_error"

    def test_reject_empty_model(self):
        """Test that empty model is rejected."""
        body = {"model": "", "messages": [{"role": "user", "content": "Hello"}]}
        with pytest.raises(ValidationError) as exc_info:
            validate_request(body)
        assert exc_info.value.status_code == 400

    def test_reject_whitespace_model(self):
        """Test that whitespace-only model is rejected."""
        body = {"model": "   ", "messages": [{"role": "user", "content": "Hello"}]}
        with pytest.raises(ValidationError):
            validate_request(body)

    def test_empty_content_accepted(self):
        """Test that empty content is accepted."""
        body = {"model": "gpt-4", "messages": [{"role": "user", "content": ""}]}
        assert validate_request(body) is True

    def test_reject_none_body(self):
        """Test that None body is rejected."""
        with pytest.raises(ValidationError):
            validate_request(None)


class TestCreateErrorResponse:
    """Tests for error response creation."""

    def test_error_response_format(self):
        """Test error response has correct format."""
        error = Exception("Test error")
        resp = create_error_response(error, 400, "invalid_request_error")

        assert resp["statusCode"] == 400
        assert resp["body"]["error"]["type"] == "invalid_request_error"
        assert resp["body"]["error"]["message"] == "Test error"

    def test_default_error_type(self):
        """Test default error type is internal_server_error."""
        error = Exception("Error")
        resp = create_error_response(error)

        assert resp["statusCode"] == 500
        assert resp["body"]["error"]["type"] == "internal_server_error"


class TestEstimateTokens:
    """Tests for token estimation."""

    def test_estimate_tokens_basic(self):
        """Test basic token estimation."""
        tokens = estimate_tokens("Test message")
        assert tokens > 0
        assert tokens == 3  # ceil(12/4) = 3

    def test_estimate_tokens_empty(self):
        """Test empty string returns 0."""
        assert estimate_tokens("") == 0

    def test_estimate_tokens_none(self):
        """Test None returns 0."""
        assert estimate_tokens(None) == 0


class TestClassifyError:
    """Tests for error classification."""

    def test_network_error_econnrefused(self):
        """Test ECONNREFUSED -> 503."""
        error = Exception("Connection refused")
        error.code = "ECONNREFUSED"
        status_code, error_type = classify_error(error)
        assert status_code == 503
        assert error_type == "service_unavailable"

    def test_network_error_etimedout(self):
        """Test ETIMEDOUT -> 503."""
        error = Exception("Request timed out")
        error.code = "ETIMEDOUT"
        status_code, error_type = classify_error(error)
        assert status_code == 503
        assert error_type == "service_unavailable"

    def test_empty_response_error(self):
        """Test empty response error -> 503."""
        error = Exception("Backend returned empty response")
        status_code, error_type = classify_error(error)
        assert status_code == 503
        assert error_type == "service_unavailable"

    def test_auth_error(self):
        """Test authentication error -> 401."""
        error = Exception("Authentication failed: invalid token")
        status_code, error_type = classify_error(error)
        assert status_code == 401
        assert error_type == "authentication_error"

    def test_api_key_error(self):
        """Test API key error -> 401."""
        error = Exception("Invalid API key provided")
        status_code, error_type = classify_error(error)
        assert status_code == 401
        assert error_type == "authentication_error"

    def test_rate_limit_error(self):
        """Test rate limit error -> 429."""
        error = Exception("Rate limit exceeded")
        status_code, error_type = classify_error(error)
        assert status_code == 429
        assert error_type == "rate_limit_error"

    def test_permission_error(self):
        """Test permission error -> 403."""
        error = Exception("Permission denied")
        status_code, error_type = classify_error(error)
        assert status_code == 403
        assert error_type == "permission_error"

    def test_not_found_error(self):
        """Test not found error -> 404."""
        error = Exception("Model not found")
        status_code, error_type = classify_error(error)
        assert status_code == 404
        assert error_type == "not_found_error"

    def test_unknown_error(self):
        """Test unknown error -> 500."""
        error = Exception("Something unexpected happened")
        status_code, error_type = classify_error(error)
        assert status_code == 500
        assert error_type == "internal_server_error"


class TestProviders:
    """Tests for provider listing."""

    def test_list_providers_returns_list(self):
        """Test that list_providers returns a list."""
        providers = list_providers()
        assert isinstance(providers, list)
        assert len(providers) > 0

    def test_provider_structure(self):
        """Test that each provider has required fields."""
        providers = list_providers()
        for provider in providers:
            assert "id" in provider
            assert "name" in provider
            assert "envVar" in provider
            assert "hasApiKey" in provider
            assert "models" in provider

    def test_known_providers_exist(self):
        """Test that known providers are included."""
        providers = list_providers()
        provider_ids = [p["id"] for p in providers]

        assert "openai" in provider_ids
        assert "anthropic" in provider_ids
        assert "groq" in provider_ids


class TestModels:
    """Tests for model listing."""

    def test_list_models_returns_list(self):
        """Test that list_models returns a list."""
        models = list_models()
        assert isinstance(models, list)
        assert len(models) > 0

    def test_model_structure(self):
        """Test that each model has required fields."""
        models = list_models()
        for model in models:
            assert "id" in model
            assert "label" in model
            assert "provider" in model

    def test_filter_by_provider(self):
        """Test filtering models by provider."""
        openai_models = list_models("openai")
        for model in openai_models:
            assert model["provider"] == "openai"

    def test_filter_unknown_provider(self):
        """Test filtering by unknown provider returns empty."""
        models = list_models("unknown_provider")
        assert len(models) == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
