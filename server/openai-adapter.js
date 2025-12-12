/**
 * OpenAI Chat Completions API adapter
 */

const { chat, estimateTokens, classifyError } = require('./puter-client');
const { getConfig, isEmulatorActive } = require('./config');
const { logRequest, logSuccess, logError } = require('./logger');

function generateCompletionId() {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function createErrorResponse(error, statusCode = 500, type = 'internal_server_error') {
  return {
    statusCode,
    body: {
      error: {
        message: error.message || 'An error occurred',
        type,
        code: error.code || null
      }
    }
  };
}

function validateRequest(body) {
  if (!body) {
    const error = new Error('Request body is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }

  // Model is required per OpenAI spec
  if (!body.model || typeof body.model !== 'string' || !body.model.trim()) {
    const error = new Error('model field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }

  if (!body.messages && !body.prompt) {
    const error = new Error('Either messages or prompt field is required');
    error.statusCode = 400;
    error.type = 'invalid_request_error';
    throw error;
  }

  if (body.messages) {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      const error = new Error('messages must be a non-empty array');
      error.statusCode = 400;
      error.type = 'invalid_request_error';
      throw error;
    }

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

async function handleChatCompletion(requestBody) {
  try {
    if (!isEmulatorActive()) {
      return createErrorResponse(
        new Error('Emulator is not active. Start it from the configuration UI.'),
        503,
        'service_unavailable'
      );
    }

    validateRequest(requestBody);

    const config = getConfig();
    const { model: requestedModel, messages, prompt, temperature, max_tokens, max_completion_tokens } = requestBody;

    const puterModel = config.puterModel || 'gpt-4o';
    const responseModel = config.spoofedOpenAIModelId || requestedModel;

    logRequest({
      incomingModel: requestedModel,
      puterModel,
      messageCount: messages ? messages.length : 1,
      status: 'processing'
    });

    const options = { model: puterModel };
    if (temperature !== undefined) options.temperature = temperature;
    if (max_tokens !== undefined) options.max_tokens = max_tokens;
    else if (max_completion_tokens !== undefined) options.max_tokens = max_completion_tokens;

    const inputToSend = messages || prompt;
    const result = await chat(inputToSend, options);

    let usage;
    if (result.usage) {
      usage = result.usage;
    } else {
      const promptText = messages ? messages.map(m => m.content).join(' ') : (prompt || '');
      const promptTokens = estimateTokens(promptText);
      const completionTokens = estimateTokens(result.text);
      usage = {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      };
    }

    logSuccess({
      puterModel,
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens
    });

    return {
      statusCode: 200,
      body: {
        id: generateCompletionId(),
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: responseModel,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.text },
          finish_reason: 'stop'
        }],
        usage
      }
    };
  } catch (error) {
    logError(error, { endpoint: '/v1/chat/completions', requestedModel: requestBody?.model });

    if (error.statusCode && error.type) {
      return createErrorResponse(error, error.statusCode, error.type);
    }

    const { statusCode, type } = classifyError(error);
    return createErrorResponse(error, statusCode, type);
  }
}

module.exports = { handleChatCompletion, validateRequest, createErrorResponse };
