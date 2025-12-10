/**
 * OpenAI Chat Completions API adapter
 * Converts between OpenAI format and Puter backend
 *
 * OpenAI Chat Completion format:
 * Request: { model, messages, temperature, max_tokens, ... }
 * Response: { id, object, created, model, choices, usage }
 */

const { chat, estimateTokens } = require('./puter-client');
const { getConfig } = require('./config');
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
function createErrorResponse(error, statusCode = 500) {
  return {
    statusCode,
    body: {
      error: {
        message: error.message || 'An error occurred',
        type: 'server_error',
        code: error.code || 'internal_error'
      }
    }
  };
}

/**
 * Validate OpenAI chat completion request
 */
function validateRequest(body) {
  if (!body) {
    throw new Error('Request body is required');
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    throw new Error('messages field is required and must be an array');
  }

  if (body.messages.length === 0) {
    throw new Error('messages array cannot be empty');
  }

  // Validate message format
  for (const msg of body.messages) {
    if (!msg.role || !msg.content) {
      throw new Error('Each message must have role and content fields');
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
    // Validate request
    validateRequest(requestBody);

    // Get current configuration
    const config = getConfig();

    // Extract request parameters
    const {
      model: requestedModel,
      messages,
      temperature,
      max_tokens,
      max_completion_tokens,
      top_p
    } = requestBody;

    // Determine which Puter model to use (from config)
    const puterModel = config.puterModel || 'gpt-5-nano';

    // Determine which model ID to return (spoofed or actual)
    const responseModel = config.spoofedOpenAIModelId || requestedModel || puterModel;

    // Log the request
    logRequest({
      incomingModel: requestedModel,
      puterModel: puterModel,
      messageCount: messages.length,
      status: 'processing'
    });

    // Build options for Puter
    const options = {
      model: puterModel
    };

    if (temperature !== undefined) {
      options.temperature = temperature;
    }

    if (top_p !== undefined) {
      options.top_p = top_p;
    }

    if (max_tokens !== undefined) {
      options.max_tokens = max_tokens;
    } else if (max_completion_tokens !== undefined) {
      options.max_tokens = max_completion_tokens;
    }

    // Call Puter backend
    const completionText = await chat(messages, options);

    // Estimate token counts
    // Note: These are approximations since Puter may not expose exact counts
    const promptText = messages.map(m => m.content).join(' ');
    const promptTokens = estimateTokens(promptText);
    const completionTokens = estimateTokens(completionText);
    const totalTokens = promptTokens + completionTokens;

    // Log success
    logSuccess({
      puterModel,
      promptTokens,
      completionTokens,
      totalTokens
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
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens
      }
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

    return createErrorResponse(error);
  }
}

module.exports = {
  handleChatCompletion,
  validateRequest,
  createErrorResponse
};
