"""
Configuration manager for the model emulator
"""

import json
import os
import random
import string
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# Paths
CONFIG_DIR = Path(__file__).parent.parent / "config"
CONFIG_PATH = CONFIG_DIR / "default.json"
MODELS_CACHE_PATH = CONFIG_DIR / "models-cache.json"
SAVED_CONFIGS_PATH = CONFIG_DIR / "saved-configs.json"

# Ensure config directory exists
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

# Cache
_cached_config: Optional[Dict[str, Any]] = None
_cached_models: Optional[Dict[str, Any]] = None
_cached_saved_configs: Optional[List[Dict[str, Any]]] = None
_config_mtime: Optional[float] = None
_emulator_active: bool = False

MODELS_CACHE_TTL = 1000 * 60 * 30  # 30 minutes in ms


def generate_id() -> str:
    """Generate a unique preset ID: cfg-{timestamp}-{random6}"""
    random_chars = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
    return f"cfg-{int(time.time() * 1000)}-{random_chars}"


def get_default_config() -> Dict[str, Any]:
    """Return default configuration."""
    return {
        "port": 11434,
        "provider": "openai",
        "model": "gpt-4",
        "apiKeyEnvVar": "OPENAI_API_KEY",
        "emulatorActive": False,
        "lastConfig": None,
        "logging": {
            "enabled": True,
            "logRequests": True,
            "logErrors": True
        }
    }


def get_config() -> Dict[str, Any]:
    """Get current configuration with mtime-based cache invalidation."""
    global _cached_config, _config_mtime

    try:
        if _cached_config is not None:
            stats = CONFIG_PATH.stat()
            if _config_mtime is not None and stats.st_mtime == _config_mtime:
                return _cached_config
            _config_mtime = stats.st_mtime

        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            _cached_config = json.load(f)
        _config_mtime = CONFIG_PATH.stat().st_mtime
        return _cached_config
    except (FileNotFoundError, json.JSONDecodeError):
        return get_default_config()


def update_config(updates: Dict[str, Any]) -> bool:
    """Update configuration with new values."""
    global _cached_config, _config_mtime

    config = {**get_config(), **updates}
    try:
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2)
        _cached_config = config
        _config_mtime = CONFIG_PATH.stat().st_mtime
        return True
    except Exception:
        return False


def is_emulator_active() -> bool:
    """Check if emulator is currently active."""
    return _emulator_active


def start_emulator(provider: str, model: str, api_key_env_var: str) -> bool:
    """Start the emulator with the given configuration."""
    global _emulator_active

    success = update_config({
        "provider": provider,
        "model": model,
        "apiKeyEnvVar": api_key_env_var,
        "emulatorActive": True,
        "lastConfig": {
            "provider": provider,
            "model": model,
            "apiKeyEnvVar": api_key_env_var
        }
    })
    if success:
        _emulator_active = True
    return success


def stop_emulator() -> bool:
    """Stop the emulator."""
    global _emulator_active

    success = update_config({"emulatorActive": False})
    if success:
        _emulator_active = False
    return success


def get_models_cache() -> Dict[str, Any]:
    """Get cached models."""
    global _cached_models

    if _cached_models is not None:
        return _cached_models

    try:
        if MODELS_CACHE_PATH.exists():
            with open(MODELS_CACHE_PATH, "r", encoding="utf-8") as f:
                cache = json.load(f)
            if isinstance(cache.get("models"), list):
                _cached_models = cache
                return cache
    except (json.JSONDecodeError, Exception):
        pass

    return {"models": [], "lastUpdated": None}


def is_models_cache_stale(ttl_ms: int = MODELS_CACHE_TTL) -> bool:
    """Check if models cache is stale."""
    cache = get_models_cache()
    if cache.get("lastUpdated") is None:
        return True
    return (time.time() * 1000) - cache["lastUpdated"] > ttl_ms


def save_models_cache(models: List[Dict[str, Any]]) -> bool:
    """Save models to cache."""
    global _cached_models

    try:
        cache = {
            "lastUpdated": int(time.time() * 1000),
            "models": models
        }
        with open(MODELS_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
        _cached_models = cache
        return True
    except Exception:
        return False


def get_saved_configs() -> List[Dict[str, Any]]:
    """Get saved configuration presets."""
    global _cached_saved_configs

    if _cached_saved_configs is not None:
        return _cached_saved_configs

    try:
        if SAVED_CONFIGS_PATH.exists():
            with open(SAVED_CONFIGS_PATH, "r", encoding="utf-8") as f:
                configs = json.load(f)
            if isinstance(configs, list):
                _cached_saved_configs = configs
                return configs
    except (json.JSONDecodeError, Exception):
        pass

    return []


def save_saved_configs(configs: List[Dict[str, Any]]) -> bool:
    """Save configuration presets."""
    global _cached_saved_configs

    try:
        with open(SAVED_CONFIGS_PATH, "w", encoding="utf-8") as f:
            json.dump(configs, f, indent=2)
        _cached_saved_configs = configs
        return True
    except Exception:
        return False


def add_saved_config(name: str, provider: str, model: str, api_key_env_var: str) -> Optional[Dict[str, Any]]:
    """Add a new saved configuration preset."""
    configs = get_saved_configs()
    new_config = {
        "id": generate_id(),
        "name": name,
        "provider": provider,
        "model": model,
        "apiKeyEnvVar": api_key_env_var
    }
    configs.append(new_config)
    return new_config if save_saved_configs(configs) else None


def update_saved_config(config_id: str, new_name: Optional[str], provider: Optional[str],
                        model: Optional[str], api_key_env_var: Optional[str]) -> bool:
    """Update an existing saved configuration preset."""
    configs = get_saved_configs()
    config = next((c for c in configs if c.get("id") == config_id), None)
    if config is None:
        return False

    if new_name:
        config["name"] = new_name
    if provider:
        config["provider"] = provider
    if model:
        config["model"] = model
    if api_key_env_var is not None:
        config["apiKeyEnvVar"] = api_key_env_var

    return save_saved_configs(configs)


def delete_saved_config(config_id: str) -> bool:
    """Delete a saved configuration preset."""
    configs = get_saved_configs()
    filtered = [c for c in configs if c.get("id") != config_id]
    if len(filtered) == len(configs):
        return False
    return save_saved_configs(filtered)


def get_saved_config_by_id(config_id: str) -> Optional[Dict[str, Any]]:
    """Get a saved configuration preset by ID."""
    return next((c for c in get_saved_configs() if c.get("id") == config_id), None)


def get_last_config() -> Optional[Dict[str, Any]]:
    """Get the last used configuration."""
    return get_config().get("lastConfig")


# Initialize emulator state on module load
def _init_emulator_state():
    global _emulator_active
    _emulator_active = get_config().get("emulatorActive", False) is True


_init_emulator_state()
