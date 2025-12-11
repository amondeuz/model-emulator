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
 * - GET /config - Configuration UI
 * - POST /config/update - Update configuration
 */

const express = require('express');
const path = require('path');
const { getConfig, updateConfig, loadModels } = require('./config');
const { handleChatCompletion } = require('./openai-adapter');
const { logInfo, logError, getHealthInfo } = require('./logger');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

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
        type: 'server_error'
      }
    });
  }
});

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
 * GET /config/current
 * Get current configuration as JSON
 */
app.get('/config/current', (req, res) => {
  try {
    const config = getConfig();
    const models = loadModels();
    res.json({
      config,
      models
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

/**
 * GET /
 * Root endpoint - redirect to config UI
 */
app.get('/', (req, res) => {
  res.redirect('/config.html');
});

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
