/**
 * Puter.js integration client
 * Handles communication with Puter AI backend
 *
 * Based on Puter.js docs:
 * - puter.ai.chat(prompt, options) or puter.ai.chat(messages, options)
 * - puter.ai.listModels() returns array of model objects
 */

const { init } = require("@heyputer/puter.js/src/init.cjs");
const { logError, logInfo } = require('./logger');

let puterInstance = null;
let puterOnline = false;

/**
 * Initialize Puter client
 */
function initPuter() {
  if (puterInstance) {
    return puterInstance;
  }

  try {
    const authToken = process.env.PUTER_AUTH_TOKEN || process.env.puterAuthToken;
    puterInstance = init(authToken);
    return puterInstance;
  } catch (error) {
    logError(error, { context: 'Puter initialization' });
    throw new Error('Failed to initialize Puter client');
  }
}

/**
 * Get current Puter connectivity status
 */
function isPuterOnline() {
  return puterOnline;
}

/**
 * Set Puter connectivity status
 */
function setPuterOnline(status) {
  const changed = puterOnline !== status;
  puterOnline = status;
  return changed;
}

/**
 * List available models from Puter
 * Returns array of model objects with id, provider, name, etc.
 */
async function listModels() {
  const puter = initPuter();

  try {
    const models = await puter.ai.listModels();
    setPuterOnline(true);
    return models;
  } catch (error) {
    setPuterOnline(false);
    logError(error, { context: 'Puter listModels' });
    throw error;
  }
}

/**
 * Check Puter connectivity by calling listModels
 */
async function checkConnectivity() {
  try {
    await listModels();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Convert OpenAI-style messages array to a simple prompt string
 * Used only as fallback when Puter doesn't support messages array
 *
 * @param {Array} messages - OpenAI format messages [{role, content}, ...]
 * @returns {string} - Formatted prompt string
 */
function messagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  return messages
    .map(msg => {
      const role = msg.role || 'user';
      const content = msg.content || '';

      if (role === 'system') {
        return `System: ${content}`;
      } else if (role === 'assistant') {
        return `Assistant: ${content}`;
      } else {
        return `User: ${content}`;
      }
    })
    .join('\n\n');
}

/**
 * Call Puter AI chat completion
 *
 * @param {Array|string} messagesOrPrompt - Messages array or prompt string
 * @param {Object} options - Chat options (model, temperature, etc.)
 * @returns {Promise<Object>} - Chat completion response with text and optional usage
 */
async function chat(messagesOrPrompt, options = {}) {
  const puter = initPuter();

  // Build Puter chat options
  const puterOptions = {};

  if (options.model) {
    puterOptions.model = options.model;
  }

  if (options.temperature !== undefined) {
    puterOptions.temperature = options.temperature;
  }

  if (options.max_tokens !== undefined) {
    puterOptions.max_tokens = options.max_tokens;
  }

  try {
    let response;

    // Puter supports both messages array and prompt string
    if (Array.isArray(messagesOrPrompt)) {
      // Use messages array directly - Puter supports this
      response = await puter.ai.chat(messagesOrPrompt, puterOptions);
    } else if (typeof messagesOrPrompt === 'string') {
      // Use prompt string directly
      response = await puter.ai.chat(messagesOrPrompt, puterOptions);
    } else {
      throw new Error('Invalid input: expected messages array or prompt string');
    }

    setPuterOnline(true);

    // Parse response - Puter may return:
    // - A string directly
    // - An object with message/content property
    // - An object with usage information
    let text = '';
    let usage = null;

    if (typeof response === 'string') {
      text = response;
    } else if (response && typeof response === 'object') {
      // Try to extract text from various possible formats
      if (response.message && typeof response.message === 'object') {
        text = response.message.content || '';
      } else if (response.message && typeof response.message === 'string') {
        text = response.message;
      } else if (response.content) {
        text = response.content;
      } else if (response.text) {
        text = response.text;
      }

      // Extract usage if available
      if (response.usage) {
        usage = {
          prompt_tokens: response.usage.prompt_tokens || response.usage.input_tokens || 0,
          completion_tokens: response.usage.completion_tokens || response.usage.output_tokens || 0,
          total_tokens: response.usage.total_tokens || 0
        };
        if (!usage.total_tokens && usage.prompt_tokens && usage.completion_tokens) {
          usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
        }
      }
    }

    return { text, usage };
  } catch (error) {
    setPuterOnline(false);
    logError(error, {
      context: 'Puter AI chat call',
      model: options.model
    });
    throw error;
  }
}

/**
 * Estimate token count for usage reporting
 * Used as fallback when Puter doesn't provide real counts
 *
 * Rule of thumb: ~4 characters per token for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Classify error type for proper HTTP response
 */
function classifyError(error) {
  const message = error.message?.toLowerCase() || '';

  if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
    return { statusCode: 401, type: 'authentication_error' };
  }

  if (message.includes('permission') || message.includes('forbidden') || message.includes('access')) {
    return { statusCode: 403, type: 'permission_error' };
  }

  if (message.includes('rate') || message.includes('limit') || message.includes('quota')) {
    return { statusCode: 429, type: 'rate_limit_error' };
  }

  if (message.includes('invalid') || message.includes('bad request') || message.includes('missing')) {
    return { statusCode: 400, type: 'invalid_request_error' };
  }

  if (message.includes('not found') || message.includes('model')) {
    return { statusCode: 404, type: 'not_found_error' };
  }

  return { statusCode: 500, type: 'internal_server_error' };
}

module.exports = {
  initPuter,
  chat,
  listModels,
  checkConnectivity,
  isPuterOnline,
  setPuterOnline,
  messagesToPrompt,
  estimateTokens,
  classifyError
};
