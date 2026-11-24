import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [config, api, captcha, chatClient] = await Promise.all([
  readFile(new URL('../config.js', import.meta.url), 'utf8'),
  readFile(new URL('../api.js', import.meta.url), 'utf8'),
  readFile(new URL('../captcha.js', import.meta.url), 'utf8'),
  readFile(new URL('../chat/client.mjs', import.meta.url), 'utf8'),
]);

assert.match(config, /"mode":"live-test"/, 'preview must stay in live-test mode');
assert.match(config, /"chatEnvironment":"test"/, 'preview chat must stay in test environment');
assert.match(api, /ispovesti-preview-user-session/, 'preview user Auth storage key must be unique');
assert.match(api, /ispovesti-preview-admin-session/, 'preview admin Auth storage key must be unique');
assert.doesNotMatch(api, /ispovesti-test-(?:user|admin)-session/, 'preview must not reuse generic test Auth storage keys');
assert.match(api, /community-test-api/, 'preview community requests must use the test API');
assert.match(captcha, /community-test-api/, 'preview CAPTCHA configuration must use the test API');
assert.match(chatClient, /environment==='test'\?'chat-test-api'/, 'preview chat client must select chat-test-api');

console.log('Preview isolation checks passed: test endpoints and preview-only Auth storage keys are configured.');
