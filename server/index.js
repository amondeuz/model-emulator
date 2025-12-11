#!/usr/bin/env node

/**
 * Puter Local Model Emulator - Main Server
 *
 * ARCHITECTURE:
 * - Server entry point: server/index.js (this file)
 * - Config file: config/default.json
 * - Pinokio app folder: Root directory with pinokio.js
 *
 * This server provides an OpenAI-compatible HTTP endpoint that proxies
 * requests to Puter AI backend. It's designed to work as a Pinokio app,
 * allowing other Pinokio tools to use Puter models via a local endpoint.
 *
 * Endpoints:
 * - POST /v1/chat/completions - OpenAI-compatible chat endpoint
 * - GET /health - Health check and diagnostics
 * - GET /config/current - Get current configuration
 * - POST /config/update - Update configuration
 * - GET /api/models - Get cached model list
 * - POST /api/models/refresh - Refresh model list from Puter
 * - GET /api/saved-configs - Get saved configurations
 * - POST /api/saved-configs - Add new saved configuration
 * - PUT /api/saved-configs/:id - Update saved configuration name
 * - DELETE /api/saved-configs/:id - Delete saved configuration
 * - POST /api/emulator/start - Start the emulator
 * - POST /api/emulator/stop - Stop the emulator
 * - GET /api/emulator/status - Get emulator and Puter status
 */

const express = require('express');
const path = require('path');
const {
  getConfig,
  updateConfig,
  getModelsCache,
  saveModelsCache,
  getSavedConfigs,
  addSavedConfig,
  updateSavedConfigName,
  deleteSavedConfig,
  getSavedConfigById,
  isEmulatorActive,
  startEmulator,
  stopEmulator,
  getLastConfig,
  modelExistsInCache
} = require('./config');
const { handleChatCompletion } = require('./openai-adapter');
const { logInfo, logError, getHealthInfo } = require('./logger');
const { listModels, checkConnectivity, isPuterOnline } = require('./puter-client');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================================================
// OPENAI COMPATIBLE ENDPOINT
// ============================================================================

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint
 */
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const result = await handleChatCompletion(req.body);
    res.status(result.statusCode).json(result.body);
  } catch (error) {
    logError(error, { endpoint: '/v1/chat/completions' });
    res.status(500).json({
      error: {
        message: 'Internal server error',
        type: 'internal_server_error'
      }
    });
  }
});

// ============================================================================
// HEALTH AND STATUS
// ============================================================================

/**
 * GET /health
 * Health check endpoint with diagnostics
 */
app.get('/health', (req, res) => {
  const config = getConfig();
  const healthInfo = getHealthInfo();

  const response = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    emulatorActive: isEmulatorActive(),
    puterOnline: isPuterOnline(),
    config: {
      backend: config.backend,
      puterModel: config.puterModel,
      spoofedModel: config.spoofedOpenAIModelId,
      port: config.port
    },
    lastSuccessfulCompletion: healthInfo.lastSuccessfulCompletion
      ? {
          timestamp: new Date(healthInfo.lastSuccessfulCompletion.timestamp).toISOString(),
          model: healthInfo.lastSuccessfulCompletion.model,
          tokens: healthInfo.lastSuccessfulCompletion.tokens
        }
      : null,
    lastError: healthInfo.lastError
      ? {
          timestamp: new Date(healthInfo.lastError.timestamp).toISOString(),
          message: healthInfo.lastError.message
        }
      : null
  };

  res.json(response);
});

/**
 * GET /api/emulator/status
 * Get emulator and Puter connectivity status
 */
app.get('/api/emulator/status', async (req, res) => {
  try {
    const config = getConfig();
    const online = await checkConnectivity();

    res.json({
      emulatorActive: isEmulatorActive(),
      puterOnline: online,
      currentConfig: {
        puterModel: config.puterModel,
        spoofedOpenAIModelId: config.spoofedOpenAIModelId
      },
      lastConfig: getLastConfig()
    });
  } catch (error) {
    res.json({
      emulatorActive: isEmulatorActive(),
      puterOnline: false,
      currentConfig: {
        puterModel: getConfig().puterModel,
        spoofedOpenAIModelId: getConfig().spoofedOpenAIModelId
      },
      lastConfig: getLastConfig()
    });
  }
});

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /config/current
 * Get current configuration as JSON
 */
app.get('/config/current', (req, res) => {
  try {
    const config = getConfig();
    const modelsCache = getModelsCache();
    const savedConfigs = getSavedConfigs();

    res.json({
      config,
      models: modelsCache.models,
      modelsLastUpdated: modelsCache.lastUpdated,
      savedConfigs,
      emulatorActive: isEmulatorActive(),
      puterOnline: isPuterOnline(),
      lastConfig: getLastConfig()
    });
  } catch (error) {
    logError(error, { endpoint: '/config/current' });
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

/**
 * POST /config/update
 * Update configuration
 */
app.post('/config/update', (req, res) => {
  try {
    const { puterModel, spoofedOpenAIModelId, port } = req.body;

    const updates = {};

    if (puterModel !== undefined) {
      updates.puterModel = puterModel;
    }

    if (spoofedOpenAIModelId !== undefined) {
      updates.spoofedOpenAIModelId = spoofedOpenAIModelId;
    }

    if (port !== undefined) {
      updates.port = parseInt(port, 10);
    }

    const success = updateConfig(updates);

    if (success) {
      logInfo(`Configuration updated: ${JSON.stringify(updates)}`);
      res.json({
        success: true,
        message: 'Configuration updated successfully',
        config: getConfig()
      });
    } else {
      throw new Error('Failed to save configuration');
    }
  } catch (error) {
    logError(error, { endpoint: '/config/update' });
    res.status(500).json({
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// ============================================================================
// MODELS CACHE ENDPOINTS
// ============================================================================

/**
 * GET /api/models
 * Get cached model list
 */
app.get('/api/models', (req, res) => {
  try {
    const cache = getModelsCache();
    res.json({
      models: cache.models,
      lastUpdated: cache.lastUpdated,
      puterOnline: isPuterOnline()
    });
  } catch (error) {
    logError(error, { endpoint: '/api/models' });
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * POST /api/models/refresh
 * Refresh model list from Puter
 */
app.post('/api/models/refresh', async (req, res) => {
  try {
    const models = await listModels();
    saveModelsCache(models);

    res.json({
      success: true,
      models: models,
      lastUpdated: Date.now(),
      puterOnline: true
    });
  } catch (error) {
    logError(error, { endpoint: '/api/models/refresh' });
    res.status(503).json({
      success: false,
      error: 'Failed to refresh models from Puter',
      message: error.message,
      puterOnline: false
    });
  }
});

// ============================================================================
// SAVED CONFIGURATIONS ENDPOINTS
// ============================================================================

/**
 * GET /api/saved-configs
 * Get all saved configurations
 */
app.get('/api/saved-configs', (req, res) => {
  try {
    const configs = getSavedConfigs();
    res.json({ configs });
  } catch (error) {
    logError(error, { endpoint: '/api/saved-configs' });
    res.status(500).json({ error: 'Failed to get saved configurations' });
  }
});

/**
 * POST /api/saved-configs
 * Add new saved configuration
 */
app.post('/api/saved-configs', (req, res) => {
  try {
    const { name, puterModelId, spoofedOpenAIModelId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    if (!puterModelId) {
      return res.status(400).json({ error: 'Puter model ID is required' });
    }

    const newConfig = addSavedConfig(name.trim(), puterModelId, spoofedOpenAIModelId);

    if (newConfig) {
      res.json({
        success: true,
        config: newConfig,
        message: 'Configuration saved successfully'
      });
    } else {
      throw new Error('Failed to save configuration');
    }
  } catch (error) {
    logError(error, { endpoint: '/api/saved-configs POST' });
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

/**
 * PUT /api/saved-configs/:id
 * Update saved configuration name
 */
app.put('/api/saved-configs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Configuration name is required' });
    }

    const existingConfig = getSavedConfigById(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const success = updateSavedConfigName(id, name.trim());

    if (success) {
      res.json({
        success: true,
        message: 'Configuration renamed successfully'
      });
    } else {
      throw new Error('Failed to rename configuration');
    }
  } catch (error) {
    logError(error, { endpoint: '/api/saved-configs PUT' });
    res.status(500).json({ error: 'Failed to rename configuration' });
  }
});

/**
 * DELETE /api/saved-configs/:id
 * Delete saved configuration
 */
app.delete('/api/saved-configs/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existingConfig = getSavedConfigById(id);
    if (!existingConfig) {
      return res.status(404).json({ error: 'Configuration not found' });
    }

    const success = deleteSavedConfig(id);

    if (success) {
      res.json({
        success: true,
        message: 'Configuration deleted successfully'
      });
    } else {
      throw new Error('Failed to delete configuration');
    }
  } catch (error) {
    logError(error, { endpoint: '/api/saved-configs DELETE' });
    res.status(500).json({ error: 'Failed to delete configuration' });
  }
});

// ============================================================================
// EMULATOR CONTROL ENDPOINTS
// ============================================================================

/**
 * POST /api/emulator/start
 * Start the emulator with specified configuration
 */
app.post('/api/emulator/start', async (req, res) => {
  try {
    const { puterModelId, spoofedOpenAIModelId } = req.body;

    if (!puterModelId) {
      return res.status(400).json({
        success: false,
        error: 'Puter model ID is required'
      });
    }

    // Check Puter connectivity
    const online = await checkConnectivity();
    if (!online) {
      return res.status(503).json({
        success: false,
        error: 'Puter is offline. Cannot start emulator.'
      });
    }

    // Validate model exists in cache
    const cache = getModelsCache();
    const modelExists = cache.models.some(m => m.id === puterModelId);
    if (!modelExists && cache.models.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Model "${puterModelId}" not found in available models`
      });
    }

    // Start emulator
    const success = startEmulator(puterModelId, spoofedOpenAIModelId);

    if (success) {
      logInfo(`Emulator started with model: ${puterModelId}`);
      res.json({
        success: true,
        message: 'Emulator started successfully',
        config: {
          puterModel: puterModelId,
          spoofedOpenAIModelId: spoofedOpenAIModelId || ''
        }
      });
    } else {
      throw new Error('Failed to start emulator');
    }
  } catch (error) {
    logError(error, { endpoint: '/api/emulator/start' });
    res.status(500).json({
      success: false,
      error: 'Failed to start emulator'
    });
  }
});

/**
 * POST /api/emulator/stop
 * Stop the emulator
 */
app.post('/api/emulator/stop', (req, res) => {
  try {
    const success = stopEmulator();

    if (success) {
      logInfo('Emulator stopped');
      res.json({
        success: true,
        message: 'Emulator stopped successfully'
      });
    } else {
      throw new Error('Failed to stop emulator');
    }
  } catch (error) {
    logError(error, { endpoint: '/api/emulator/stop' });
    res.status(500).json({
      success: false,
      error: 'Failed to stop emulator'
    });
  }
});

// ============================================================================
// ROOT AND STATIC
// ============================================================================

/**
 * GET /
 * Root endpoint - redirect to config UI
 */
app.get('/', (req, res) => {
  res.redirect('/config.html');
});

// ============================================================================
// SERVER LIFECYCLE
// ============================================================================

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(signal, server) {
  logInfo(`Received ${signal}, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      logInfo('Server closed');
      process.exit(0);
    });

    // Force close after 5 seconds
    setTimeout(() => {
      logError(new Error('Forced shutdown after timeout'));
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

/**
 * Initialize on startup - refresh models cache in background
 */
async function initializeModelsCache() {
  try {
    logInfo('Refreshing models cache from Puter...');
    const models = await listModels();
    saveModelsCache(models);
    logInfo(`Models cache updated with ${models.length} models`);
  } catch (error) {
    logInfo('Failed to refresh models cache - will use cached data if available');
  }
}

/**
 * Start server
 */
function startServer() {
  const config = getConfig();
  const port = process.env.PORT || config.port || 11434;

  const server = app.listen(port, '127.0.0.1', () => {
    logInfo(`Puter Local Model Emulator started`);
    logInfo(`Listening on http://localhost:${port}`);
    logInfo(`OpenAI endpoint: http://localhost:${port}/v1/chat/completions`);
    logInfo(`Config UI: http://localhost:${port}/config.html`);
    logInfo(`Health check: http://localhost:${port}/health`);
    logInfo(`Backend model: ${config.puterModel}`);
    logInfo(`Spoofed model: ${config.spoofedOpenAIModelId}`);
    logInfo(`Emulator active: ${isEmulatorActive()}`);

    // Initialize models cache in background
    initializeModelsCache();
  });

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM', server));
  process.on('SIGINT', () => gracefulShutdown('SIGINT', server));

  return server;
}

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
