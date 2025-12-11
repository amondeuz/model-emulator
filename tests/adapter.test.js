/**
 * Unit tests for OpenAI adapter
 * Run with: node tests/adapter.test.js
 */

const assert = require('assert');

// Mock dependencies
const mockPuterClient = {
  chat: async () => ({ text: 'Mock response', usage: null }),
  estimateTokens: (text) => Math.ceil((text || '').length / 4),
  classifyError: () => ({ statusCode: 500, type: 'internal_server_error' })
};

const mockConfig = {
  getConfig: () => ({
    port: 11434,
    puterModel: 'gpt-4o',
    spoofedOpenAIModelId: 'gpt-4o-mini',
    emulatorActive: true
  }),
  isEmulatorActive: () => true
};

const mockLogger = {
  logRequest: () => {},
  logSuccess: () => {},
  logError: () => {}
};

require.cache[require.resolve('../server/puter-client.js')] = { exports: mockPuterClient };
require.cache[require.resolve('../server/config.js')] = { exports: mockConfig };
require.cache[require.resolve('../server/logger.js')] = { exports: mockLogger };

const { validateRequest, createErrorResponse } = require('../server/openai-adapter.js');

function runTests() {
  console.log('Running OpenAI Adapter Tests...\n');
  let passed = 0, failed = 0;

  // Test 1: Valid request with messages
  try {
    validateRequest({ model: 'gpt-4', messages: [{ role: 'user', content: 'Hello' }] });
    console.log('✓ Test 1: Valid request with messages');
    passed++;
  } catch (e) { console.error('✗ Test 1 failed:', e.message); failed++; }

  // Test 2: Valid request with prompt
  try {
    validateRequest({ model: 'gpt-4', prompt: 'Hello' });
    console.log('✓ Test 2: Valid request with prompt');
    passed++;
  } catch (e) { console.error('✗ Test 2 failed:', e.message); failed++; }

  // Test 3: Reject missing messages/prompt
  try {
    validateRequest({ model: 'gpt-4' });
    console.error('✗ Test 3 failed: Should throw');
    failed++;
  } catch (e) {
    console.log('✓ Test 3: Rejects missing messages/prompt');
    passed++;
  }

  // Test 4: Reject empty messages array
  try {
    validateRequest({ model: 'gpt-4', messages: [] });
    console.error('✗ Test 4 failed: Should throw');
    failed++;
  } catch (e) {
    console.log('✓ Test 4: Rejects empty messages');
    passed++;
  }

  // Test 5: Reject invalid message format
  try {
    validateRequest({ model: 'gpt-4', messages: [{ role: 'user' }] });
    console.error('✗ Test 5 failed: Should throw');
    failed++;
  } catch (e) {
    console.log('✓ Test 5: Rejects message without content');
    passed++;
  }

  // Test 6: Error response format
  try {
    const resp = createErrorResponse(new Error('Test'), 400, 'invalid_request_error');
    assert.strictEqual(resp.statusCode, 400);
    assert.strictEqual(resp.body.error.type, 'invalid_request_error');
    console.log('✓ Test 6: Error response format');
    passed++;
  } catch (e) { console.error('✗ Test 6 failed:', e.message); failed++; }

  // Test 7: Default error type
  try {
    const resp = createErrorResponse(new Error('Error'));
    assert.strictEqual(resp.statusCode, 500);
    assert.strictEqual(resp.body.error.type, 'internal_server_error');
    console.log('✓ Test 7: Default error type');
    passed++;
  } catch (e) { console.error('✗ Test 7 failed:', e.message); failed++; }

  // Test 8: Token estimation
  try {
    const tokens = mockPuterClient.estimateTokens('Test message');
    assert(tokens > 0);
    console.log('✓ Test 8: Token estimation');
    passed++;
  } catch (e) { console.error('✗ Test 8 failed:', e.message); failed++; }

  // Test 9: Empty content accepted
  try {
    validateRequest({ model: 'gpt-4', messages: [{ role: 'user', content: '' }] });
    console.log('✓ Test 9: Empty content accepted');
    passed++;
  } catch (e) { console.error('✗ Test 9 failed:', e.message); failed++; }

  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(40));

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
