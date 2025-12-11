/**
 * OpenAI Chat Completions API adapter
 * Converts between OpenAI format and Puter backend
 *
 * OpenAI Chat Completion format:
 * Request: { model, messages, temperature, max_tokens, ... }
 * Response: { id, object, created, model, choices, usage }
 */

const { chat, estimateTokens, classifyError, messagesToPrompt } = require('./puter-client');
const { getConfig, isEmulatorActive } = require('./config');
const { logRequest, logSuccess, logError } = require('./logger');

/**
 * Generate a unique completion ID (OpenAI format)
 */
function generateCompletionId() {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Create OpenAI-compatible error response
 */
function createErrorResponse(error, statusCode = 500, type = 'internal_server_error') {
  return {
    statusCode,
    body: {
      error: {
        message: error.message || 'An error occurred',
        type: type,
        code: error.code || null
      }
    }
  };
}

/**
 * Validate OpenAI chat completion request
 */
function validateRequest(body) {
  if (!body) {
    const error = new Error('Request body is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }

  // Support both messages array and prompt string
  if (!body.messages && !body.prompt) {
    const error = new Error('Either messages or prompt field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }

  if (body.messages) {
    if (!Array.isArray(body.messages)) {
      const error = new Error('messages must be an array');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }

    if (body.messages.length === 0) {
      const error = new Error('messages array cannot be empty');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }

    // Validate message format
    for (const msg of body.messages) {
      if (!msg.role || msg.content === undefined) {
        const error = new Error('Each message must have role and content fields');
        error.statusCode = 400;
        error.type = 'invalid_request_error';
        throw error;
      }
    }
  }

  return true;
}

/**
 * Handle OpenAI chat completion request
 *
 * @param {Object} requestBody - OpenAI format request body
 * @returns {Promise<Object>} - OpenAI format response
 */
async function handleChatCompletion(requestBody) {
  try {
    // Check if emulator is active
    if (!isEmulatorActive()) {
      return createErrorResponse(
        new Error('Emulator is not active. Please start the emulator from the configuration UI.'),
        503,
        'service_unavailable'
      );
    }

    // Validate request
    validateRequest(requestBody);

    // Get current configuration
    const config = getConfig();

    // Extract request parameters
    const {
      model: requestedModel,
      messages,
      prompt,
      temperature,
      max_tokens,
      max_completion_tokens
    } = requestBody;

    // Determine which Puter model to use (from config)
    const puterModel = config.puterModel || 'gpt-4o';

    // Determine which model ID to return (spoofed or actual)
    const responseModel = config.spoofedOpenAIModelId || requestedModel || puterModel;

    // Log the request
    logRequest({
      incomingModel: requestedModel,
      puterModel: puterModel,
      messageCount: messages ? messages.length : 1,
      status: 'processing'
    });

    // Build options for Puter
    const options = {
      model: puterModel
    };

    if (temperature !== undefined) {
      options.temperature = temperature;
    }

    if (max_tokens !== undefined) {
      options.max_tokens = max_tokens;
    } else if (max_completion_tokens !== undefined) {
      options.max_tokens = max_completion_tokens;
    }

    // Determine what to send to Puter
    let inputToSend;
    if (messages && Array.isArray(messages)) {
      // Use messages array directly - Puter supports this
      inputToSend = messages;
    } else if (prompt) {
      // Use prompt string directly
      inputToSend = prompt;
    } else {
      // Fallback - should not reach here due to validation
      inputToSend = messagesToPrompt(messages);
    }

    // Call Puter backend
    const result = await chat(inputToSend, options);
    const completionText = result.text;

    // Use real usage from Puter if available, otherwise estimate
    let usage;
    if (result.usage) {
      usage = result.usage;
    } else {
      const promptText = messages ? messages.map(m => m.content).join(' ') : (prompt || '');
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(completionText);
      usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      };
    }

    // Log success
    logSuccess({
      puterModel,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens
    });

    // Build OpenAI-compatible response
    const response = {
      id: generateCompletionId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: responseModel,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: completionText
          },
          finish_reason: 'stop'
        }
      ],
      usage
    };

    return {
      statusCode: 200,
      body: response
    };
  } catch (error) {
    logError(error, {
      endpoint: '/v1/chat/completions',
      requestedModel: requestBody?.model
    });

    // Check if error has explicit status code and type
    if (error.statusCode && error.type) {
      return createErrorResponse(error, error.statusCode, error.type);
    }

    // Classify error based on message
    const { statusCode, type } = classifyError(error);
    return createErrorResponse(error, statusCode, type);
  }
}

module.exports = {
  handleChatCompletion,
  validateRequest,
  createErrorResponse
};
