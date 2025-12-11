# Puter Local Model Emulator

A Pinokio app that provides a local OpenAI-compatible HTTP endpoint backed by Puter AI. This allows any Pinokio-hosted tool (or any application) to access 500+ AI models through Puter's free API using the familiar OpenAI Chat Completions format.

## What is this?

This is a developer tool that acts as a "translation layer" between applications expecting an OpenAI-compatible API and Puter AI's backend. Instead of running local models or paying for OpenAI API keys, you can use Puter's free AI service through a localhost endpoint.

### Key Features

- **OpenAI-Compatible Endpoint**: POST to `/v1/chat/completions` just like you would with OpenAI
- **500+ Models Available**: Access GPT-5, Claude, Gemini, and more through Puter
- **Model Aliasing**: Spoof model names so apps expecting "gpt-4o" work seamlessly
- **Simple Configuration UI**: Change models and settings without editing JSON files
- **Hot Configuration Reload**: Changes take effect immediately without server restart
- **Pinokio Integration**: Install and run directly from Pinokio with one click
- **Health Monitoring**: Built-in health endpoint for diagnostics

## Installation in Pinokio

### Method 1: Via Pinokio (Recommended)

1. Open Pinokio
2. Navigate to the "Discover" tab
3. Search for "Puter Local Model Emulator" or enter this repository URL
4. Click "Install"
5. Once installed, click "Install" from the app menu to install Node dependencies
6. Click "Start Server" to launch the emulator

### Method 2: Manual Installation

```bash
git clone <this-repository-url>
cd model-emulator
npm install
```

## Usage

### Starting the Server

**In Pinokio:**
- Click "Start Server" from the app menu

**From Command Line:**
```bash
npm start
# or
node server/index.js
```

The server will start on `http://localhost:11434` by default.

### Configuring Models

**Via UI (Recommended):**
1. In Pinokio, click "Configure" from the app menu
2. Or navigate to `http://localhost:11434/config.html` in your browser
3. Select your desired Puter backend model from the dropdown
4. Optionally set a spoofed OpenAI model ID
5. Click "Save Configuration"

**Via Config File:**
Edit `config/default.json`:
```json
{
  "port": 11434,
  "backend": "puter",
  "puterModel": "gpt-5-nano",
  "spoofedOpenAIModelId": "gpt-4o-mini",
  "enabled": true
}
```

### Available Models

The emulator supports any model available through Puter. Common options include:

**GPT Models via Puter:**
- `gpt-5-nano` - Fastest, optimized for low latency
- `gpt-5-mini` - Balanced for general tasks
- `gpt-5` - Full GPT-5 with advanced reasoning
- `gpt-5.1` - Latest version
- `gpt-4o` - GPT-4 optimized

**OpenRouter Models via Puter:**
- `openrouter:kwaipilot/kat-coder-pro:free` - Free coding model
- And many more! See Puter's documentation for the full list

### Using the Endpoint

Point any OpenAI-compatible application to:
```
http://localhost:11434/v1/chat/completions
```

**Example with curl:**
```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

**Example with Python OpenAI client:**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"  # Puter handles auth
)

response = client.chat.completions.create(
    model="gpt-4o-mini",  # Will be mapped to your configured Puter model
    messages=[
        {"role": "user", "content": "Hello!"}
    ]
)

print(response.choices[0].message.content)
```

**Example in Another Pinokio App:**

In the Pinokio app's configuration, set:
- API Base URL: `http://localhost:11434/v1`
- API Key: (leave blank or use any value)
- Model: Whatever you configured as `spoofedOpenAIModelId`

### Health Check

Check server status:
```bash
curl http://localhost:11434/health
```

Or in Pinokio, click "Health Check" from the app menu.

## Architecture

```
/model-emulator
├── server/
│   ├── index.js          # Main Express server
│   ├── config.js         # Configuration loader with hot-reload
│   ├── logger.js         # Logging and diagnostics
│   ├── puter-client.js   # Puter.js integration
│   └── openai-adapter.js # OpenAI format translation
├── config/
│   ├── default.json      # User configuration
│   └── models.json       # Model registry
├── public/
│   └── config.html       # Configuration UI
├── pinokio.js            # Pinokio app definition
├── install.json          # Pinokio install script
├── start.json            # Pinokio start script
├── config.json           # Pinokio config UI launcher
└── package.json
```

## API Endpoints

### POST /v1/chat/completions

OpenAI-compatible chat completions endpoint.

**Supported Request Parameters:**
- `model` (string) - Model name (will be aliased to configured Puter model)
- `messages` (array) - Array of message objects with `role` and `content`
- `temperature` (number, optional) - Sampling temperature
- `max_tokens` (number, optional) - Maximum completion tokens
- `max_completion_tokens` (number, optional) - Alternative to max_tokens
- `top_p` (number, optional) - Nucleus sampling parameter

**Response Format:**
Standard OpenAI chat completion response with `id`, `object`, `created`, `model`, `choices`, and `usage` fields.

### GET /health

Health check endpoint returning server status, configuration, last successful completion, and last error (if any).

### GET /config.html

Configuration UI for changing models and settings.

### POST /config/update

Update configuration programmatically.

## Limitations and Notes

### Current Limitations

1. **Text-Only**: This MVP supports text chat completions only. No images, audio, or file uploads yet.
2. **Approximate Token Counts**: Token usage in responses is estimated (4 chars ≈ 1 token) since Puter may not expose exact counts.
3. **Streaming Not Supported**: Responses are returned complete, not streamed.
4. **Function Calling**: OpenAI function/tool calling is not yet supported.

### Puter-Specific Considerations

- **Authentication**: Puter.js handles authentication. Set `PUTER_AUTH_TOKEN` environment variable if needed.
- **Rate Limits**: Puter may have usage limits or rate limiting. Check Puter's documentation for current limits.
- **Model Availability**: Model availability depends on Puter's current offerings. Some models may become unavailable.

### Configuration Reload

The configuration file is checked for changes on each request, enabling hot-reload without server restart. This is enabled by default for the best developer experience.

## Troubleshooting

### Server won't start
- Check if port 11434 is already in use
- Try changing the port in `config/default.json`
- Ensure Node.js 16+ is installed

### Models not loading
- Verify your internet connection (Puter requires network access)
- Check the console for Puter authentication errors
- Try setting `PUTER_AUTH_TOKEN` environment variable

### Responses are errors
- Check the logs in the Pinokio console
- Verify the selected Puter model is still available
- Try switching to `gpt-5-nano` (most reliable)

### Configuration UI won't open
- Ensure the server is running
- Try accessing `http://localhost:11434/config.html` directly in a browser
- Check the port in your configuration

## Development and Extension

This codebase is designed to be extended:

### Adding More Backends

Edit `server/puter-client.js` to add alternative backends. The adapter pattern makes it easy to swap providers.

### Adding More Endpoints

Add new routes in `server/index.js`. Consider adding:
- `/v1/embeddings` for embeddings
- `/v1/images/generations` for image generation
- `/v1/models` to list available models

### Testing

Basic unit tests are included in `tests/adapter.test.js`. Run with:
```bash
npm test
```

## Resources

- [Puter.js Documentation](https://docs.puter.com/)
- [Puter Free LLM API Tutorial](https://developer.puter.com/tutorials/free-llm-api/)
- [OpenAI Chat Completions API Reference](https://platform.openai.com/docs/api-reference/chat/object)
- [Pinokio Documentation](https://docs.pinokio.computer/)

## License

MIT

## Contributing

This is a developer tool for personal use. Feel free to fork and extend for your needs.
