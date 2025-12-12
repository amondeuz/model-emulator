#!/usr/bin/env node

/**
 * Puter Local Model Emulator - Main Server
 *
 * OpenAI-compatible HTTP endpoint backed by Puter AI
 */

const express = require('express');
const path = require('path');
const {
  getConfig, updateConfig, getModelsCache, isModelsCacheStale, saveModelsCache,
  getSavedConfigs, addSavedConfig, updateSavedConfig, deleteSavedConfig,
  getSavedConfigById, isEmulatorActive, startEmulator, stopEmulator, getLastConfig
} = require('./config');
const { handleChatCompletion } = require('./openai-adapter');
const { logInfo, logError, getHealthInfo } = require('./logger');
const { listModels, checkConnectivity, isPuterOnline } = require('./puter-client');

const MODELS_TTL_MS = 1000 * 60 * 30; // 30 minutes

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Helpers
function normalizeModel(model) {
  if (!model) return null;
  if (typeof model === 'string') {
    return { id: model, label: model, provider: 'puter', isFree: true };
  }

  const id = model.id || model.model || model.name;
  if (!id) return null;

  return {
    id,
    label: model.title || model.label || model.display_name || id,
    provider: model.provider || model.source || 'puter',
    isFree: Boolean(model.isFree ?? model.free ?? model.is_free ?? model.free_tier),
    price: model.price || model.cost || model.pricing || null
  };
}

async function getModels(force = false) {
  const cache = getModelsCache();
  if (!force && cache.models.length && !isModelsCacheStale(MODELS_TTL_MS)) {
    return { models: cache.models, lastUpdated: cache.lastUpdated, puterOnline: isPuterOnline(), source: 'cache' };
  }

  try {
    const models = await listModels();
    const normalized = (models || [])
      .map(normalizeModel)
      .filter(Boolean);
    saveModelsCache(normalized);
    return { models: normalized, lastUpdated: Date.now(), puterOnline: true, source: 'puter' };
  } catch (error) {
    return { models: cache.models || [], lastUpdated: cache.lastUpdated || null, puterOnline: false, error: error.message, source: 'cache' };
  }
}

function buildEndpoint() {
  const config = getConfig();
  const port = process.env.PORT || config.port || 11434;
  return `http://localhost:${port}/v1/chat/completions`;
}

async function buildStatePayload(forceModels = false) {
  const config = getConfig();
  const models = await getModels(forceModels);
  const health = getHealthInfo();

  return {
    endpoint: buildEndpoint(),
    config,
    presets: getSavedConfigs(),
    models: models.models,
    modelsLastUpdated: models.lastUpdated,
    emulatorActive: isEmulatorActive(),
    puterOnline: models.puterOnline,
    lastConfig: getLastConfig(),
    health: {
      lastSuccessfulCompletion: health.lastSuccessfulCompletion,
      lastError: health.lastError
    }
  };
}

// OpenAI-compatible endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const result = await handleChatCompletion(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    logError(error, { endpoint: '/v1/chat/completions' });
    res.status(500).json({ error: { message: 'Internal server error', type: 'internal_server_error' } });
  }
});

// Health check + Puter connectivity
app.get('/health', async (req, res) => {
  try {
    const online = await checkConnectivity();
    res.json({ online: online === true, message: online ? 'Puter is reachable' : 'Puter appears offline' });
  } catch (error) {
    res.status(503).json({ online: false, message: error.message || 'Unable to reach Puter' });
  }
});

// Config state for UI
app.get('/config/state', async (req, res) => {
  const force = req.query.force === 'true';
  const payload = await buildStatePayload(force);
  res.json(payload);
});

app.post('/config/save', (req, res) => {
  const { puterModelId, spoofedOpenAIModelId, port } = req.body;
  const updates = {};
  if (puterModelId !== undefined) updates.puterModel = puterModelId;
  if (spoofedOpenAIModelId !== undefined) updates.spoofedOpenAIModelId = spoofedOpenAIModelId;
  if (port !== undefined) updates.port = parseInt(port, 10);

  const success = updateConfig(updates);
  if (success) {
    res.json({ success: true, config: getConfig() });
  } else {
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

app.post('/config/savePreset', (req, res) => {
  const { id, name, puterModelId, spoofedOpenAIModelId } = req.body;
  if (!name?.trim()) return res.status(400).json({ success: false, error: 'Name is required' });
  if (!puterModelId) return res.status(400).json({ success: false, error: 'Puter model ID is required' });

  if (id) {
    if (!getSavedConfigById(id)) return res.status(404).json({ success: false, error: 'Preset not found' });
    const ok = updateSavedConfig(id, name.trim(), puterModelId, spoofedOpenAIModelId);
    const updated = ok ? getSavedConfigById(id) : null;
    return ok ? res.json({ success: true, preset: updated }) : res.status(500).json({ success: false, error: 'Failed to update preset' });
  }

  const preset = addSavedConfig(name.trim(), puterModelId, spoofedOpenAIModelId);
  if (preset) return res.json({ success: true, preset });
  return res.status(500).json({ success: false, error: 'Failed to save preset' });
});

// Models cache
app.get('/models', async (req, res) => {
  const force = req.query.force === 'true';
  const models = await getModels(force);
  res.json(models);
});

// Emulator control toggles the active config
app.post('/emulator/start', async (req, res) => {
  const { puterModelId, spoofedOpenAIModelId } = req.body;
  if (!puterModelId) return res.status(400).json({ success: false, error: 'Puter model ID is required' });

  const models = await getModels(true);
  if (!models.puterOnline) {
    return res.status(503).json({ success: false, error: 'Puter is offline' });
  }

  if (models.models.length && !models.models.some(m => m.id === puterModelId)) {
    return res.status(400).json({ success: false, error: `Model "${puterModelId}" not found` });
  }

  if (startEmulator(puterModelId, spoofedOpenAIModelId)) {
    logInfo(`Emulator started: ${puterModelId}`);
    res.json({ success: true, config: { puterModelId, spoofedOpenAIModelId: spoofedOpenAIModelId || '' } });
  } else {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

app.post('/emulator/stop', (req, res) => {
  if (stopEmulator()) {
    logInfo('Emulator stopped');
    res.json({ success: true });
  } else {
    res.status(500).json({ success: false, error: 'Failed to stop' });
  }
});

// Root redirect
app.get('/', (req, res) => res.redirect('/config.html'));

// Server lifecycle
function startServer() {
  const config = getConfig();
  const port = process.env.PORT || config.port || 11434;

  const server = app.listen(port, '127.0.0.1', () => {
    logInfo(`Puter Local Model Emulator started on http://localhost:${port}`);
    logInfo(`OpenAI endpoint: ${buildEndpoint()}`);
    logInfo(`Emulator active: ${isEmulatorActive()}`);

    // Refresh models cache in background
    getModels(true)
      .then(({ models }) => {
        saveModelsCache(models);
        logInfo(`Models cache: ${models.length} models`);
      })
      .catch(() => logInfo('Models cache refresh failed - using cached data'));
  });

  const shutdown = (signal) => {
    logInfo(`${signal} received, shutting down...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
