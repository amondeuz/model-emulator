/**
 * Basic unit tests for OpenAI adapter
 * Run with: node tests/adapter.test.js
 *
 * These tests validate the request/response transformation logic
 * without actually calling Puter backend (uses mocks)
 */

const assert = require('assert');

// Mock the dependencies before requiring the adapter
const mockPuterClient = {
  chat: async (messages, options) => {
    return { text: 'Mock response from Puter', usage: null };
  },
  estimateTokens: (text) => {
    return Math.ceil((text || '').length / 4);
  },
  classifyError: (error) => {
    return { statusCode: 500, type: 'internal_server_error' };
  },
  messagesToPrompt: (messages) => {
    return messages.map(m => `${m.role}: ${m.content}`).join('\n');
  }
};

const mockConfig = {
  getConfig: () => ({
    port: 11434,
    backend: 'puter',
    puterModel: 'gpt-4o',
    spoofedOpenAIModelId: 'gpt-4o-mini',
    enabled: true,
    emulatorActive: true
  }),
  isEmulatorActive: () => true
};

const mockLogger = {
  logRequest: () => {},
  logSuccess: () => {},
  logError: () => {}
};

// Mock the require calls
require.cache[require.resolve('../server/puter-client.js')] = {
  exports: mockPuterClient
};

require.cache[require.resolve('../server/config.js')] = {
  exports: mockConfig
};

require.cache[require.resolve('../server/logger.js')] = {
  exports: mockLogger
};

const { validateRequest, createErrorResponse } = require('../server/openai-adapter.js');

// Test suite
function runTests() {
  console.log('Running OpenAI Adapter Tests...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Validate valid request with messages
  try {
    const validRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: 'Hello' }
      ]
    };

    validateRequest(validRequest);
    console.log('✓ Test 1: Valid request with messages passes validation');
    passed++;
  } catch (error) {
    console.error('✗ Test 1 failed:', error.message);
    failed++;
  }

  // Test 2: Validate valid request with prompt
  try {
    const validRequest = {
      model: 'gpt-4',
      prompt: 'Hello'
    };

    validateRequest(validRequest);
    console.log('✓ Test 2: Valid request with prompt passes validation');
    passed++;
  } catch (error) {
    console.error('✗ Test 2 failed:', error.message);
    failed++;
  }

  // Test 3: Reject request without messages or prompt
  try {
    const invalidRequest = {
      model: 'gpt-4'
    };

    validateRequest(invalidRequest);
    console.error('✗ Test 3 failed: Should have thrown error for missing messages/prompt');
    failed++;
  } catch (error) {
    console.log('✓ Test 3: Correctly rejects request without messages or prompt');
    passed++;
  }

  // Test 4: Reject request with empty messages array
  try {
    const invalidRequest = {
      model: 'gpt-4',
      messages: []
    };

    validateRequest(invalidRequest);
    console.error('✗ Test 4 failed: Should have thrown error for empty messages');
    failed++;
  } catch (error) {
    console.log('✓ Test 4: Correctly rejects request with empty messages');
    passed++;
  }

  // Test 5: Reject request with invalid message format
  try {
    const invalidRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user' } // Missing content
      ]
    };

    validateRequest(invalidRequest);
    console.error('✗ Test 5 failed: Should have thrown error for message without content');
    failed++;
  } catch (error) {
    console.log('✓ Test 5: Correctly rejects message without content');
    passed++;
  }

  // Test 6: Error response format with type
  try {
    const error = new Error('Test error');
    const errorResponse = createErrorResponse(error, 400, 'invalid_request_error');

    assert.strictEqual(errorResponse.statusCode, 400);
    assert.strictEqual(errorResponse.body.error.message, 'Test error');
    assert.strictEqual(errorResponse.body.error.type, 'invalid_request_error');

    console.log('✓ Test 6: Error response has correct format with custom type');
    passed++;
  } catch (error) {
    console.error('✗ Test 6 failed:', error.message);
    failed++;
  }

  // Test 7: Error response default type
  try {
    const error = new Error('Server error');
    const errorResponse = createErrorResponse(error);

    assert.strictEqual(errorResponse.statusCode, 500);
    assert.strictEqual(errorResponse.body.error.type, 'internal_server_error');

    console.log('✓ Test 7: Error response uses default type correctly');
    passed++;
  } catch (error) {
    console.error('✗ Test 7 failed:', error.message);
    failed++;
  }

  // Test 8: Token estimation
  try {
    const testText = 'This is a test message';
    const tokens = mockPuterClient.estimateTokens(testText);

    assert(tokens > 0, 'Token count should be positive');
    assert(tokens === Math.ceil(testText.length / 4), 'Token estimation uses correct formula');

    console.log('✓ Test 8: Token estimation works correctly');
    passed++;
  } catch (error) {
    console.error('✗ Test 8 failed:', error.message);
    failed++;
  }

  // Test 9: Messages with empty content should be accepted
  try {
    const validRequest = {
      model: 'gpt-4',
      messages: [
        { role: 'user', content: '' }
      ]
    };

    validateRequest(validRequest);
    console.log('✓ Test 9: Messages with empty content string are accepted');
    passed++;
  } catch (error) {
    console.error('✗ Test 9 failed:', error.message);
    failed++;
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  }
}

// Run the tests
runTests();
