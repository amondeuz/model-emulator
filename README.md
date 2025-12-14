# Puter Local Model Emulator

A Pinokio app that provides a local OpenAI-compatible HTTP endpoint backed by Puter AI. Access 500+ AI models through Puter's free API using the standard OpenAI Chat Completions format.

## What is this?

A translation layer between applications expecting an OpenAI-compatible API and Puter AI's backend. Instead of running local models or paying for OpenAI API keys, use Puter's free AI service through a localhost endpoint.

### Key Features

- **OpenAI-Compatible Endpoint**: POST to `/v1/chat/completions` just like OpenAI
- **500+ Models Available**: Access GPT-5, Claude, Gemini, and more through Puter
- **Model Aliasing**: Spoof model names so apps expecting "gpt-4o" work seamlessly
- **Searchable Dropdowns**: Quick search-as-you-type for both Puter and spoofed models
- **Preset Configurations**: Save and load your favorite model combinations
- **Auto-Start Workflow**: Pinokio automatically installs dependencies and starts the server
- **Hot Configuration**: Changes take effect immediately without server restart
- **Health Monitoring**: Built-in connectivity and status checking

## Installation

### Via Pinokio (Recommended)

1. Open Pinokio
2. Navigate to the "Discover" tab  
3. Search for "Puter Local Model Emulator" or paste the repository URL
4. Click "Install"

The app will automatically:
- Install Node.js dependencies
- Start the server
- Open the configuration UI

### Manual Installation
```bash
git clone https://github.com/amondeuz/model-emulator.git
cd puter-local-model-emulator
npm install
npm start
```

Server starts on `http://localhost:11434` by default.

## Usage

### Configuration UI

The configuration UI opens automatically when the app starts, or access it at:
```
http://localhost:11434/config.html
```

**Features:**
- **Puter Model**: Search/select from 500+ available models (test models filtered out)
- **Spoofed Model ID**: Set the model name your app expects (e.g., "gpt-4o")
- **Presets**: Save configurations for quick switching between setups
- **Status Indicators**: See Puter connectivity and emulator state at a glance

**Workflow:**
1. Select a Puter model from the searchable dropdown
2. (Optional) Enter a spoofed OpenAI model ID
3. Click "Start" to activate the emulator
4. Use the endpoint in your applications

### Stopping the Server

Use Pinokio's **"stop start.json"** button on the app's home page. The server runs as a daemon and persists even if you navigate away from the Emulator tab - this is intentional so other apps can continue using the endpoint.

### Available Models

Common Puter models include:

**GPT Models:**
- `gpt-5-nano` - Fastest, optimized for low latency
- `gpt-5-mini` - Balanced for general tasks
- `gpt-5` - Full GPT-5 with advanced reasoning
- `gpt-5.1` - Latest version
- `gpt-4o` - GPT-4 optimized

**Other Providers via Puter:**
- Claude, Gemini, Llama, Mistral, and more
- See full list in the UI's searchable dropdown

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
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**Example: Python**
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:11434/v1",
    api_key="not-needed"  # Puter handles auth
)

response = client.chat.completions.create(
    model="gpt-4o-mini",  # Maps to your configured Puter model
    messages=[{"role": "user", "content": "Hello!"}]
)

print(response.choices[0].message.content)
```

**Example: Another Pinokio App**

Configure the app with:
- **API Base URL**: `http://localhost:11434/v1`
- **API Key**: (any value or leave blank)
- **Model**: Your configured spoofed model ID

### Health Check
```bash
curl http://localhost:11434/health
```

Returns Puter connectivity status and server health.

## Architecture
```
/puter-local-model-emulator
├── server/
│   ├── index.js          # Express server
│   ├── config.js         # Configuration with hot-reload
│   ├── logger.js         # Logging and diagnostics
│   ├── puter-client.js   # Puter.js integration
│   └── openai-adapter.js # OpenAI format translation
├── config/
│   ├── default.json      # User configuration
│   ├── models-cache.json # Cached model list
│   └── saved-configs.json # Saved presets
├── public/
│   └── config.html       # Configuration UI
├── pinokio.js            # Pinokio app definition (v4.0)
├── install.json          # Dependency installation
├── start.json            # Server startup (daemon)
└── package.json
```

## API Endpoints

### `POST /v1/chat/completions`

OpenAI-compatible chat completions.

**Request:**
```json
{
  "model": "gpt-4o-mini",
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
  "model": "gpt-4o-mini",
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

Server health and Puter connectivity check.

### `GET /config/state`

Current configuration, presets, models, and emulator state.

### `POST /emulator/start`

Activate the emulator with specified models.

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
- Verify Node.js 16+ installed

**Models not loading**
- Check internet connection (Puter requires network)
- Verify `PUTER_AUTH_TOKEN` if using authenticated access
- Click "Refresh Models" in UI

**Puter appears offline**
- Test connectivity: `curl http://localhost:11434/health`
- Check Puter service status at puter.com
- Try different Puter models

**Configuration UI won't open**
- Ensure server running (check Pinokio app home)
- Access directly: `http://localhost:11434/config.html`
- Check browser console for errors

## Development

**Running Tests:**
```bash
npm test
```

**Adding Backends:**
Edit `server/puter-client.js` to integrate alternative AI providers.

**Adding Endpoints:**
Add routes in `server/index.js` for features like:
- `/v1/embeddings` - Text embeddings
- `/v1/models` - List available models
- `/v1/images/generations` - Image generation

## Resources

- [Puter.js Documentation](https://docs.puter.com/)
- [Puter Free LLM API Tutorial](https://developer.puter.com/tutorials/free-llm-api/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference/chat)
- [Pinokio Documentation](https://docs.pinokio.computer/)

## License

MIT

## Contributing

Feel free to fork and extend for your needs.
