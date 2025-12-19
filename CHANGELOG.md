# Changelog

## [2.0.0-beta.1] - 2025-12-19

### Breaking Changes
- **BREAKING**: Replaced Puter OAuth with LiteLLM API key authentication
- **BREAKING**: Config schema changed - `backend`/`puterModel`/`spoofedOpenAIModelId` replaced with `provider`/`model`/`apiKeyEnvVar`
- **BREAKING**: Removed Node.js - now uses Python/FastAPI

### Added
- Multi-provider support via LiteLLM (100+ providers)
- API key-based authentication
- Support for OpenAI, Anthropic, Groq, Mistral, Google Gemini, Cohere, Together AI, OpenRouter, DeepSeek, Cerebras
- Provider dropdown in UI
- API key environment variable configuration
- Test Connection button for verifying API keys
- `/providers` endpoint to list supported providers
- `.env.example` template for API key configuration
- Python requirements.txt
- pytest test suite

### Changed
- Project renamed to "Virtual Model Emulator"
- Server rewritten from Node.js/Express to Python/FastAPI
- UI updated for provider/model/API key selection
- Pinokio install.json and start.json updated for Python

### Removed
- Puter.js integration
- Puter OAuth authentication
- Single-provider limitation
- "Spoofed model ID" concept (no longer needed)
- Node.js dependencies (package.json, package-lock.json)

## [1.0.0] - 2025-12-14

### Added
- OpenAI-compatible endpoint for Puter AI
- Searchable model dropdowns
- Configuration presets
- Auto-start workflow in Pinokio
