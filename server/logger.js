/**
 * Logging utility for the model emulator
 */

const { getConfig } = require('./config');

let lastSuccessfulCompletion = null;
let lastError = null;

function timestamp() {
  return new Date().toISOString();
}

function logRequest(data) {
  const config = getConfig();
  if (!config.logging?.logRequests) return;

  const { incomingModel, puterModel, messageCount, status } = data;
  console.log(`[${timestamp()}] REQUEST: incoming_model=${incomingModel}, puter_model=${puterModel}, messages=${messageCount}, status=${status}`);
}

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

function logError(error, context = {}) {
  const config = getConfig();
  if (!config.logging?.logErrors) return;

  console.error(`[${timestamp()}] ERROR:`, { message: error.message, context });

  lastError = {
    timestamp: Date.now(),
    message: error.message,
    context
  };
}

function logInfo(message) {
  console.log(`[${timestamp()}] INFO: ${message}`);
}

function getHealthInfo() {
  return { lastSuccessfulCompletion, lastError };
}

module.exports = { logRequest, logSuccess, logError, logInfo, getHealthInfo };
