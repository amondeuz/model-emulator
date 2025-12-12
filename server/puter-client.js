/**
 * Puter.js integration client
 */

const { init } = require("@heyputer/puter.js/src/init.cjs");

let puterInstance = null;
let puterOnline = false;

function initPuter() {
  if (puterInstance) return puterInstance;
  const authToken = process.env.PUTER_AUTH_TOKEN || process.env.puterAuthToken;
  puterInstance = init(authToken);
  return puterInstance;
}

function isPuterOnline() {
  return puterOnline;
}

async function listModels() {
  const puter = initPuter();
  try {
    const models = await puter.ai.listModels();
    puterOnline = true;
    return models;
  } catch (error) {
    puterOnline = false;
    throw error;
  }
}

async function checkConnectivity() {
  try {
    await listModels();
    return true;
  } catch (error) {
    return false;
  }
}

async function chat(messagesOrPrompt, options = {}) {
  const puter = initPuter();

  const puterOptions = {};
  if (options.model) puterOptions.model = options.model;
  if (options.temperature !== undefined) puterOptions.temperature = options.temperature;
  if (options.max_tokens !== undefined) puterOptions.max_tokens = options.max_tokens;

  try {
    const response = await puter.ai.chat(messagesOrPrompt, puterOptions);
    puterOnline = true;

    let text = '';
    let usage = null;

    if (typeof response === 'string') {
      text = response;
    } else if (response && typeof response === 'object') {
      if (response.message && typeof response.message === 'object') {
        text = response.message.content || '';
      } else if (typeof response.message === 'string') {
        text = response.message;
      } else if (response.content) {
        text = response.content;
      } else if (response.text) {
        text = response.text;
      }

      if (response.usage) {
        usage = {
          prompt_tokens: response.usage.prompt_tokens || response.usage.input_tokens || 0,
          completion_tokens: response.usage.completion_tokens || response.usage.output_tokens || 0,
          total_tokens: response.usage.total_tokens || 0
        };
        if (!usage.total_tokens) {
          usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
        }
      }
    }

    // Treat empty response as an error
    if (!text) {
      throw new Error('Backend returned empty response');
    }

    return { text, usage };
  } catch (error) {
    puterOnline = false;
    throw error;
  }
}

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function classifyError(error) {
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';

  // Network/connectivity errors → 503 Service Unavailable
  const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'ENETUNREACH', 'EAI_AGAIN'];
  if (networkCodes.includes(code)) {
    return { statusCode: 503, type: 'service_unavailable' };
  }
  if (msg.includes('network') || msg.includes('timeout') || msg.includes('connect') ||
      msg.includes('offline') || msg.includes('unavailable') || msg.includes('empty response')) {
    return { statusCode: 503, type: 'service_unavailable' };
  }

  if (msg.includes('auth') || msg.includes('token') || msg.includes('unauthorized')) {
    return { statusCode: 401, type: 'authentication_error' };
  }
  if (msg.includes('permission') || msg.includes('forbidden')) {
    return { statusCode: 403, type: 'permission_error' };
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('quota')) {
    return { statusCode: 429, type: 'rate_limit_error' };
  }
  if (msg.includes('invalid') || msg.includes('bad request')) {
    return { statusCode: 400, type: 'invalid_request_error' };
  }
  if (msg.includes('not found')) {
    return { statusCode: 404, type: 'not_found_error' };
  }

  return { statusCode: 500, type: 'internal_server_error' };
}

module.exports = {
  chat,
  listModels,
  checkConnectivity,
  isPuterOnline,
  estimateTokens,
  classifyError
};
