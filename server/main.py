"""
Virtual Model Emulator - Main Server

OpenAI-compatible HTTP endpoint backed by LiteLLM for multi-provider AI access.
"""

import asyncio
import os
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Request, Query
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

from .config import (
    get_config, update_config, get_models_cache, is_models_cache_stale, save_models_cache,
    get_saved_configs, add_saved_config, update_saved_config, delete_saved_config,
    get_saved_config_by_id, is_emulator_active, start_emulator, stop_emulator, get_last_config
)
from .openai_adapter import handle_chat_completion
from .logger import log_info, log_error, get_health_info, set_config_getter
from .litellm_client import (
    list_models, list_providers, check_connectivity, is_provider_online,
    SUPPORTED_PROVIDERS
)

# Load environment variables from .env file
load_dotenv()

# Set config getter for logger
set_config_getter(get_config)

MODELS_TTL_MS = 1000 * 60 * 30  # 30 minutes


def normalize_model(model: Any) -> Optional[Dict[str, Any]]:
    """Normalize a model object to standard format."""
    if not model:
        return None

    if isinstance(model, str):
        return {"id": model, "label": model, "provider": "unknown"}

    model_id = model.get("id") or model.get("model") or model.get("name")
    if not model_id:
        return None

    return {
        "id": model_id,
        "label": model.get("label") or model.get("title") or model.get("display_name") or model_id,
        "provider": model.get("provider") or "unknown",
        "providerName": model.get("providerName") or model.get("provider") or "Unknown"
    }


async def get_models(provider: Optional[str] = None, force: bool = False) -> Dict[str, Any]:
    """Get models list, using cache if available and not stale."""
    cache = get_models_cache()

    if not force and cache.get("models") and not is_models_cache_stale(MODELS_TTL_MS):
        return {
            "models": cache["models"],
            "lastUpdated": cache.get("lastUpdated"),
            "source": "cache"
        }

    try:
        models = list_models(provider)
        normalized = [normalize_model(m) for m in models]
        normalized = [m for m in normalized if m is not None]
        save_models_cache(normalized)
        return {
            "models": normalized,
            "lastUpdated": int(asyncio.get_event_loop().time() * 1000),
            "source": "litellm"
        }
    except Exception as e:
        return {
            "models": cache.get("models", []),
            "lastUpdated": cache.get("lastUpdated"),
            "error": str(e),
            "source": "cache"
        }


def build_endpoint() -> str:
    """Build the endpoint URL."""
    config = get_config()
    port = int(os.environ.get("PORT", config.get("port", 11434)))
    return f"http://localhost:{port}/v1/chat/completions"


async def build_state_payload(force_models: bool = False) -> Dict[str, Any]:
    """Build the state payload for the UI."""
    config = get_config()
    models_data = await get_models(force=force_models)
    health = get_health_info()
    providers = list_providers()

    # Check current provider connectivity
    current_provider = config.get("provider", "openai")
    provider_online = is_provider_online(current_provider)

    return {
        "endpoint": build_endpoint(),
        "config": config,
        "presets": get_saved_configs(),
        "models": models_data["models"],
        "modelsLastUpdated": models_data.get("lastUpdated"),
        "providers": providers,
        "emulatorActive": is_emulator_active(),
        "providerOnline": provider_online,
        "lastConfig": get_last_config(),
        "health": {
            "lastSuccessfulCompletion": health.get("lastSuccessfulCompletion"),
            "lastError": health.get("lastError")
        }
    }


# Lifespan context manager for startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    config = get_config()
    port = int(os.environ.get("PORT", config.get("port", 11434)))

    log_info(f"Virtual Model Emulator started on http://localhost:{port}")
    log_info(f"OpenAI endpoint: {build_endpoint()}")
    log_info(f"Emulator active: {is_emulator_active()}")
    log_info(f"Config UI: http://localhost:{port}/config.html")

    # Refresh models cache in background
    try:
        models_data = await get_models(force=True)
        log_info(f"Models cache: {len(models_data.get('models', []))} models")
    except Exception:
        log_info("Models cache refresh failed - using cached data")

    yield

    log_info("Shutting down...")


# Create FastAPI app
app = FastAPI(
    title="Virtual Model Emulator",
    description="OpenAI-compatible endpoint backed by LiteLLM",
    version="2.0.0-beta.1",
    lifespan=lifespan
)

# Get the public directory path
PUBLIC_DIR = Path(__file__).parent.parent / "public"


# OpenAI-compatible endpoint
@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """OpenAI-compatible chat completions endpoint."""
    try:
        body = await request.json()
        result = await handle_chat_completion(body)
        return JSONResponse(status_code=result["statusCode"], content=result["body"])
    except Exception as e:
        log_error(e, {"endpoint": "/v1/chat/completions"})
        return JSONResponse(
            status_code=500,
            content={"error": {"message": "Internal server error", "type": "internal_server_error"}}
        )


# Health check + provider connectivity
@app.get("/health")
async def health_check():
    """Check provider connectivity."""
    try:
        config = get_config()
        provider = config.get("provider", "openai")
        online = check_connectivity(provider)
        provider_name = SUPPORTED_PROVIDERS.get(provider, {}).get("name", provider)
        return JSONResponse(content={
            "online": online,
            "provider": provider,
            "message": f"{provider_name} is reachable" if online else f"{provider_name} appears offline"
        })
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"online": False, "message": str(e) or "Unable to reach provider"}
        )


# Config state for UI
@app.get("/config/state")
async def config_state(force: bool = Query(False)):
    """Get current configuration state."""
    payload = await build_state_payload(force_models=force)
    return JSONResponse(content=payload)


@app.post("/config/save")
async def config_save(request: Request):
    """Save configuration."""
    body = await request.json()
    updates = {}

    if "provider" in body:
        updates["provider"] = body["provider"]
    if "model" in body:
        updates["model"] = body["model"]
    if "apiKeyEnvVar" in body:
        updates["apiKeyEnvVar"] = body["apiKeyEnvVar"]
    if "port" in body:
        updates["port"] = int(body["port"])

    success = update_config(updates)
    if success:
        return JSONResponse(content={"success": True, "config": get_config()})
    else:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to save configuration"}
        )


@app.post("/config/savePreset")
async def config_save_preset(request: Request):
    """Save or update a configuration preset."""
    body = await request.json()

    name = body.get("name", "").strip()
    preset_id = body.get("id")
    provider = body.get("provider")
    model = body.get("model")
    api_key_env_var = body.get("apiKeyEnvVar", "")

    if not name:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Name is required"}
        )

    if not provider:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Provider is required"}
        )

    if not model:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Model is required"}
        )

    if preset_id:
        # Update existing preset
        if not get_saved_config_by_id(preset_id):
            return JSONResponse(
                status_code=404,
                content={"success": False, "error": "Preset not found"}
            )

        ok = update_saved_config(preset_id, name, provider, model, api_key_env_var)
        if ok:
            updated = get_saved_config_by_id(preset_id)
            return JSONResponse(content={"success": True, "preset": updated})
        else:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "Failed to update preset"}
            )
    else:
        # Create new preset
        preset = add_saved_config(name, provider, model, api_key_env_var)
        if preset:
            return JSONResponse(content={"success": True, "preset": preset})
        else:
            return JSONResponse(
                status_code=500,
                content={"success": False, "error": "Failed to save preset"}
            )


# List providers
@app.get("/providers")
async def get_providers():
    """List supported LiteLLM providers."""
    providers = list_providers()
    return JSONResponse(content={"providers": providers})


# Models cache
@app.get("/models")
async def get_models_endpoint(force: bool = Query(False), provider: Optional[str] = Query(None)):
    """Get available models."""
    models_data = await get_models(provider=provider, force=force)
    return JSONResponse(content=models_data)


# Emulator control
@app.post("/emulator/start")
async def emulator_start(request: Request):
    """Start the emulator with specified configuration."""
    body = await request.json()

    provider = body.get("provider")
    model = body.get("model")
    api_key_env_var = body.get("apiKeyEnvVar", "")

    if not provider:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Provider is required"}
        )

    if not model:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": "Model is required"}
        )

    # Check provider connectivity
    if not check_connectivity(provider):
        provider_name = SUPPORTED_PROVIDERS.get(provider, {}).get("name", provider)
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": f"{provider_name} is offline or API key is invalid"}
        )

    # Verify model exists for provider
    available_models = list_models(provider)
    model_ids = [m["id"] for m in available_models]
    if model not in model_ids:
        return JSONResponse(
            status_code=400,
            content={"success": False, "error": f'Model "{model}" not found for provider'}
        )

    if start_emulator(provider, model, api_key_env_var):
        log_info(f"Emulator started: {provider}/{model}")
        return JSONResponse(content={
            "success": True,
            "config": {
                "provider": provider,
                "model": model,
                "apiKeyEnvVar": api_key_env_var
            }
        })
    else:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to start"}
        )


@app.post("/emulator/stop")
async def emulator_stop():
    """Stop the emulator."""
    if stop_emulator():
        log_info("Emulator stopped")
        return JSONResponse(content={"success": True})
    else:
        return JSONResponse(
            status_code=500,
            content={"success": False, "error": "Failed to stop"}
        )


# Shutdown endpoint
@app.post("/shutdown")
async def shutdown():
    """Graceful shutdown."""
    log_info("Shutdown requested from UI")

    # Schedule shutdown after response is sent
    async def do_shutdown():
        await asyncio.sleep(0.5)
        os.kill(os.getpid(), signal.SIGTERM)

    asyncio.create_task(do_shutdown())

    return JSONResponse(content={"success": True, "message": "Shutting down..."})


# Root redirect
@app.get("/")
async def root():
    """Redirect to config UI."""
    return RedirectResponse(url="/config.html")


# Mount static files (must be after all routes)
app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="static")


def main():
    """Main entry point."""
    config = get_config()
    port = int(os.environ.get("PORT", config.get("port", 11434)))

    uvicorn.run(
        "server.main:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        reload=False
    )


if __name__ == "__main__":
    main()
