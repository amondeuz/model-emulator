/**
 * Puter.js integration client
 * Handles communication with Puter AI backend
 *
 * IMPORTANT: Based on Puter.js docs, Node.js usage requires:
 * - Import from "@heyputer/puter.js/src/init.cjs"
 * - Initialize with auth token via init(process.env.puterAuthToken)
 * - Use puter.ai.chat(prompt, options) for chat completions
 */

const { init } = require("@heyputer/puter.js/src/init.cjs");
const { logError } = require('./logger');

let puterInstance = null;

/**
 * Initialize Puter client
 * Note: Authentication is handled via environment variable or Puter's built-in auth
 */
function initPuter() {
  if (puterInstance) {
    return puterInstance;
  }

  try {
    // Initialize Puter with auth token from environment if available
    // If not set, Puter.js will handle authentication through its own mechanisms
    const authToken = process.env.PUTER_AUTH_TOKEN || process.env.puterAuthToken;
    puterInstance = init(authToken);
    return puterInstance;
  } catch (error) {
    logError(error, { context: 'Puter initialization' });
    throw new Error('Failed to initialize Puter client');
  }
}

/**
 * Convert OpenAI-style messages array to a simple prompt string
 * Puter.ai.chat expects a single prompt string, not a messages array
 *
 * @param {Array} messages - OpenAI format messages [{role, content}, ...]
 * @returns {string} - Formatted prompt string
 */
function messagesToPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return '';
  }

  // Simple conversion: join messages with role labels
  // For more sophisticated conversion, could use different strategies
  return messages
    .map(msg => {
      const role = msg.role || 'user';
      const content = msg.content || '';

      // Format based on role
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
 * @param {Array} messages - OpenAI format messages
 * @param {Object} options - Chat options (model, temperature, etc.)
 * @returns {Promise<string>} - Chat completion response
 */
async function chat(messages, options = {}) {
  const puter = initPuter();

  // Convert messages to prompt
  const prompt = messagesToPrompt(messages);

  if (!prompt) {
    throw new Error('Empty prompt generated from messages');
  }

  try {
    // Build Puter chat options
    const puterOptions = {};

    // Model selection
    if (options.model) {
      puterOptions.model = options.model;
    }

    // Temperature (if supported)
    if (options.temperature !== undefined) {
      puterOptions.temperature = options.temperature;
    }

    // Top P (if supported)
    if (options.top_p !== undefined) {
      puterOptions.top_p = options.top_p;
    }

    // Max tokens (if supported)
    // Note: Puter docs may use different parameter names
    if (options.max_tokens !== undefined) {
      puterOptions.max_tokens = options.max_tokens;
    } else if (options.max_completion_tokens !== undefined) {
      puterOptions.max_tokens = options.max_completion_tokens;
    }

    // Call Puter AI
    const response = await puter.ai.chat(prompt, puterOptions);

    // Puter.ai.chat returns the response text directly (based on examples)
    return response;
  } catch (error) {
    logError(error, {
      context: 'Puter AI chat call',
      model: options.model,
      promptLength: prompt.length
    });
    throw error;
  }
}

/**
 * Estimate token count for usage reporting
 * This is a rough approximation since Puter may not expose exact counts
 *
 * Rule of thumb: ~4 characters per token for English text
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

module.exports = {
  initPuter,
  chat,
  messagesToPrompt,
  estimateTokens
};
