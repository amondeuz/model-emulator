# Virtual Model Emulator

A Pinokio app that provides a local OpenAI-compatible HTTP endpoint powered by LiteLLM. Access 100+ AI providers (OpenAI, Anthropic, Groq, Mistral, Google, and more) through a unified API using API keys.

## What is this?

A translation layer between applications expecting an OpenAI-compatible API and various AI providers. Instead of being locked to a single provider, configure your preferred provider and model, add your API key, and use the standard OpenAI Chat Completions format.

### Key Features

- **OpenAI-Compatible Endpoint**: POST to `/v1/chat/completions` just like OpenAI
- **100+ Providers**: Access OpenAI, Anthropic, Groq, Mistral, Google Gemini, Cohere, Together AI, and more
- **Multi-Provider Support**: Switch between providers without changing your application code
- **API Key Authentication**: Simple, secure API key-based authentication
- **Searchable Dropdowns**: Quick search-as-you-type for providers and models
- **Preset Configurations**: Save and load your favorite provider/model combinations
- **Auto-Start Workflow**: Pinokio automatically installs dependencies and starts the server
- **Hot Configuration**: Changes take effect immediately without server restart
- **Health Monitoring**: Built-in connectivity and status checking

## Installation

### Via Pinokio (Recommended)

1. Open Pinokio
2. Navigate to the "Discover" tab
3. Search for "Virtual Model Emulator" or paste the repository URL
4. Click "Install"

The app will automatically:
- Install Python dependencies
- Start the server
- Open the configuration UI

### Manual Installation

```bash
git clone https://github.com/amondeuz/model-emulator.git
cd model-emulator
pip install -r requirements.txt
python -m server.main
```

Server starts on `http://localhost:11434` by default.

## Configuration

### API Keys

Create a `.env` file in the project root with your API keys:

```bash
# Copy from .env.example
cp .env.example .env

# Edit and add your API keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
```

Supported environment variables:
- `OPENAI_API_KEY` - OpenAI
- `ANTHROPIC_API_KEY` - Anthropic
- `GROQ_API_KEY` - Groq
- `MISTRAL_API_KEY` - Mistral
- `GEMINI_API_KEY` - Google Gemini
- `COHERE_API_KEY` - Cohere
- `TOGETHER_API_KEY` - Together AI
- `OPENROUTER_API_KEY` - OpenRouter
- `DEEPSEEK_API_KEY` - DeepSeek
- `CEREBRAS_API_KEY` - Cerebras

### Configuration UI

The configuration UI opens automatically when the app starts, or access it at:
```
http://localhost:11434/config.html
```

**Features:**
- **Provider**: Select from 10+ AI providers
- **Model**: Search/select from available models for the selected provider
- **API Key Env Var**: Configure which environment variable contains your API key
- **Presets**: Save configurations for quick switching between setups
- **Test Connection**: Verify your API key works before starting

**Workflow:**
1. Select a provider from the dropdown
2. Select a model for that provider
3. Verify the API key environment variable is set
4. Click "Test Connection" to verify
5. Click "Start" to activate the emulator
6. Use the endpoint in your applications

### Stopping the Server

Use Pinokio's **"stop start.json"** button on the app's home page. The server runs as a daemon and persists even if you navigate away from the Emulator tab.

## Usage

### Using the Endpoint

Point any OpenAI-compatible application to:
```
http://localhost:11434/v1/chat/completions
```

**Example: curl**
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Example: Python**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"  # API key is configured on the server
)

response = client.chat.completions.create(
    model="gpt-4",  # Any model name works - routed through configured provider
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

**Example: Another Pinokio App**

Configure the app with:
- **API Base URL**: `http://localhost:11434/v1`
- **API Key**: (any value or leave blank)
- **Model**: Any model name

### Health Check
```bash
curl http://localhost:11434/health
```

Returns provider connectivity status and server health.

## Supported Providers

| Provider | Models | Environment Variable |
|----------|--------|---------------------|
| OpenAI | GPT-4, GPT-4 Turbo, GPT-4o, o1 | `OPENAI_API_KEY` |
| Anthropic | Claude 3.5 Sonnet, Claude 3 Opus | `ANTHROPIC_API_KEY` |
| Groq | Llama 3.3 70B, Mixtral 8x7B | `GROQ_API_KEY` |
| Mistral | Mistral Large, Codestral | `MISTRAL_API_KEY` |
| Google | Gemini 1.5 Pro, Gemini 1.5 Flash | `GEMINI_API_KEY` |
| Cohere | Command R+, Command R | `COHERE_API_KEY` |
| Together AI | Llama 3.3 70B, Qwen 2.5 72B | `TOGETHER_API_KEY` |
| OpenRouter | Access to many providers | `OPENROUTER_API_KEY` |
| DeepSeek | DeepSeek Chat, DeepSeek Coder | `DEEPSEEK_API_KEY` |
| Cerebras | Llama 3.1 8B, Llama 3.1 70B | `CEREBRAS_API_KEY` |

## Architecture

```
/model-emulator
├── server/
│   ├── main.py           # FastAPI server
│   ├── config.py         # Configuration with hot-reload
│   ├── logger.py         # Logging and diagnostics
│   ├── litellm_client.py # LiteLLM integration
│   └── openai_adapter.py # OpenAI format translation
├── config/
│   ├── default.json      # User configuration
│   ├── models-cache.json # Cached model list
│   └── saved-configs.json # Saved presets
├── public/
│   └── config.html       # Configuration UI
├── tests/
│   └── test_adapter.py   # pytest tests
├── pinokio.js            # Pinokio app definition
├── install.json          # Dependency installation
├── start.json            # Server startup (daemon)
├── requirements.txt      # Python dependencies
└── .env.example          # API key template
```

## API Endpoints

### `POST /v1/chat/completions`

OpenAI-compatible chat completions.

**Request:**
```json
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "Hello"}],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {"role": "assistant", "content": "Hi!"},
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### `GET /health`

Server health and provider connectivity check.

### `GET /providers`

List all supported providers and their configuration status.

### `GET /models`

List available models, optionally filtered by provider.

### `GET /config/state`

Current configuration, presets, models, and emulator state.

### `POST /emulator/start`

Activate the emulator with specified provider and model.

### `POST /emulator/stop`

Deactivate the emulator.

### `POST /config/savePreset`

Save a configuration preset.

## Limitations

1. **Text-Only**: Chat completions only - no images, audio, or file uploads
2. **No Streaming**: Responses returned complete, not streamed
3. **Estimated Tokens**: Token counts approximate (4 chars ≈ 1 token)
4. **No Function Calling**: OpenAI tool/function calling not supported

## Troubleshooting

**Server won't start**
- Check if port 11434 is in use
- Change port in `config/default.json`
- Verify Python 3.10+ installed

**Provider connection fails**
- Verify API key is set in `.env` file
- Check API key is valid with the provider
- Click "Test Connection" in UI for diagnostics

**Models not loading**
- Check internet connection
- Verify provider API key is valid
- Click "Refresh" in UI

**Configuration UI won't open**
- Ensure server running (check Pinokio app home)
- Access directly: `http://localhost:11434/config.html`
- Check browser console for errors

## Development

**Running Tests:**
```bash
pytest tests/ -v
```

**Adding Providers:**
Edit `server/litellm_client.py` to add new providers to `SUPPORTED_PROVIDERS`.

## Resources

- [LiteLLM Documentation](https://docs.litellm.ai/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Pinokio Documentation](https://docs.pinokio.computer/)

## License

MIT

## Contributing

Feel free to fork and extend for your needs.
