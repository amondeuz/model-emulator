#!/usr/bin/env node

/**
 * Puter Local Model Emulator - Main Server
 *
 * OpenAI-compatible HTTP endpoint backed by Puter AI
 */

const express = require('express');
const path = require('path');
const {
  getConfig, updateConfig, getModelsCache, saveModelsCache,
  getSavedConfigs, addSavedConfig, updateSavedConfigName, deleteSavedConfig,
  getSavedConfigById, isEmulatorActive, startEmulator, stopEmulator, getLastConfig
} = require('./config');
const { handleChatCompletion } = require('./openai-adapter');
const { logInfo, logError, getHealthInfo } = require('./logger');
const { listModels, checkConnectivity, isPuterOnline } = require('./puter-client');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

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

// Health check
app.get('/health', (req, res) => {
  const config = getConfig();
  const health = getHealthInfo();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    emulatorActive: isEmulatorActive(),
    puterOnline: isPuterOnline(),
    config: {
      puterModel: config.puterModel,
      spoofedModel: config.spoofedOpenAIModelId,
      port: config.port
    },
    lastSuccessfulCompletion: health.lastSuccessfulCompletion,
    lastError: health.lastError
  });
});

// Emulator status
app.get('/api/emulator/status', async (req, res) => {
  const config = getConfig();
  const online = await checkConnectivity();

  res.json({
    emulatorActive: isEmulatorActive(),
    puterOnline: online,
    currentConfig: { puterModel: config.puterModel, spoofedOpenAIModelId: config.spoofedOpenAIModelId },
    lastConfig: getLastConfig()
  });
});

// Current configuration
app.get('/config/current', (req, res) => {
  const config = getConfig();
  const cache = getModelsCache();

  res.json({
    config,
    models: cache.models,
    modelsLastUpdated: cache.lastUpdated,
    savedConfigs: getSavedConfigs(),
    emulatorActive: isEmulatorActive(),
    puterOnline: isPuterOnline(),
    lastConfig: getLastConfig()
  });
});

// Update configuration
app.post('/config/update', (req, res) => {
  const { puterModel, spoofedOpenAIModelId, port } = req.body;
  const updates = {};
  if (puterModel !== undefined) updates.puterModel = puterModel;
  if (spoofedOpenAIModelId !== undefined) updates.spoofedOpenAIModelId = spoofedOpenAIModelId;
  if (port !== undefined) updates.port = parseInt(port, 10);

  if (updateConfig(updates)) {
    res.json({ success: true, config: getConfig() });
  } else {
    res.status(500).json({ success: false, error: 'Failed to update configuration' });
  }
});

// Models cache
app.get('/api/models', (req, res) => {
  const cache = getModelsCache();
  res.json({ models: cache.models, lastUpdated: cache.lastUpdated, puterOnline: isPuterOnline() });
});

app.post('/api/models/refresh', async (req, res) => {
  try {
    const models = await listModels();
    saveModelsCache(models);
    res.json({ success: true, models, lastUpdated: Date.now(), puterOnline: true });
  } catch (error) {
    res.status(503).json({ success: false, error: error.message, puterOnline: false });
  }
});

// Saved configurations
app.get('/api/saved-configs', (req, res) => {
  res.json({ configs: getSavedConfigs() });
});

app.post('/api/saved-configs', (req, res) => {
  const { name, puterModelId, spoofedOpenAIModelId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!puterModelId) return res.status(400).json({ error: 'Puter model ID is required' });

  const config = addSavedConfig(name.trim(), puterModelId, spoofedOpenAIModelId);
  if (config) {
    res.json({ success: true, config });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

app.put('/api/saved-configs/:id', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!getSavedConfigById(req.params.id)) return res.status(404).json({ error: 'Not found' });

  if (updateSavedConfigName(req.params.id, name.trim())) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to rename' });
  }
});

app.delete('/api/saved-configs/:id', (req, res) => {
  if (!getSavedConfigById(req.params.id)) return res.status(404).json({ error: 'Not found' });

  if (deleteSavedConfig(req.params.id)) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// Emulator control
app.post('/api/emulator/start', async (req, res) => {
  const { puterModelId, spoofedOpenAIModelId } = req.body;
  if (!puterModelId) return res.status(400).json({ success: false, error: 'Puter model ID is required' });

  const online = await checkConnectivity();
  if (!online) return res.status(503).json({ success: false, error: 'Puter is offline' });

  const cache = getModelsCache();
  if (cache.models.length > 0 && !cache.models.some(m => m.id === puterModelId)) {
    return res.status(400).json({ success: false, error: `Model "${puterModelId}" not found` });
  }

  if (startEmulator(puterModelId, spoofedOpenAIModelId)) {
    logInfo(`Emulator started: ${puterModelId}`);
    res.json({ success: true, config: { puterModel: puterModelId, spoofedOpenAIModelId: spoofedOpenAIModelId || '' } });
  } else {
    res.status(500).json({ success: false, error: 'Failed to start' });
  }
});

app.post('/api/emulator/stop', (req, res) => {
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
    logInfo(`OpenAI endpoint: http://localhost:${port}/v1/chat/completions`);
    logInfo(`Emulator active: ${isEmulatorActive()}`);

    // Refresh models cache in background
    listModels()
      .then(models => {
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
