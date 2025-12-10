/**
 * Simple logging utility for the model emulator
 * Logs requests, responses, and errors with timestamps
 */

const { getConfig } = require('./config');

// Store last successful completion and last error for health endpoint
let lastSuccessfulCompletion = null;
let lastError = null;

/**
 * Format timestamp for logs
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Log a chat completion request
 */
function logRequest(data) {
  const config = getConfig();
  if (!config.logging?.logRequests) return;

  const { incomingModel, puterModel, messageCount, status } = data;
  console.log(`[${timestamp()}] REQUEST: incoming_model=${incomingModel}, puter_model=${puterModel}, messages=${messageCount}, status=${status}`);
}

/**
 * Log a successful completion
 */
function logSuccess(data) {
  const config = getConfig();
  if (!config.logging?.enabled) return;

  const { puterModel, promptTokens, completionTokens, totalTokens } = data;
  console.log(`[${timestamp()}] SUCCESS: model=${puterModel}, tokens={prompt: ${promptTokens}, completion: ${completionTokens}, total: ${totalTokens}}`);

  lastSuccessfulCompletion = {
    timestamp: Date.now(),
    model: puterModel,
    tokens: { promptTokens, completionTokens, totalTokens }
  };
}

/**
 * Log an error with details
 */
function logError(error, context = {}) {
  const config = getConfig();
  if (!config.logging?.logErrors) return;

  console.error(`[${timestamp()}] ERROR:`, {
    message: error.message,
    stack: error.stack,
    context
  });

  lastError = {
    timestamp: Date.now(),
    message: error.message,
    context
  };
}

/**
 * Log general info message
 */
function logInfo(message) {
  console.log(`[${timestamp()}] INFO: ${message}`);
}

/**
 * Get health information for the health endpoint
 */
function getHealthInfo() {
  return {
    lastSuccessfulCompletion,
    lastError
  };
}

/**
 * Clear error state (useful after recovery)
 */
function clearError() {
  lastError = null;
}

module.exports = {
  logRequest,
  logSuccess,
  logError,
  logInfo,
  getHealthInfo,
  clearError
};
