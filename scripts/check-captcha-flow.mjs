import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const caseName = process.argv[2];

if (!caseName) {
  const cases = [
    'first-entry',
    'existing-clearance',
    'new-uid',
    'captcha-failure',
    'submission-without-clearance',
  ];
  for (const name of cases) {
    const run = spawnSync(process.execPath, [
      '--experimental-default-type=module',
      fileURLToPath(import.meta.url),
      name,
    ], { encoding: 'utf8' });
    if (run.stdout) process.stdout.write(run.stdout);
    if (run.stderr) process.stderr.write(run.stderr);
    assert.equal(run.status, 0, `CAPTCHA scenario failed: ${name}`);
  }
  console.log('All CAPTCHA flow scenarios passed.');
} else {
  const calls = [];
  let renderCount = 0;
  const uid = caseName === 'new-uid' ? 'anonymous-new-uid' : 'anonymous-first-uid';
  const session = {
    user: { id: uid },
    access_token: 'test-access-token',
  };

  globalThis.window = {
    ISPOVESTI_CONFIG: {
      mode: 'live-test',
      supabaseUrl: 'https://preview-test.invalid',
      publishableKey: 'test-publishable-key',
    },
    supabase: {
      createClient() {
        return {
          auth: {
            async getSession() {
              return { data: { session }, error: null };
            },
            async signInAnonymously() {
              return { data: { session }, error: null };
            },
          },
        };
      },
    },
    turnstile: {
      render(_host, options) {
        renderCount += 1;
        globalThis.turnstileOptions = options;
        return 'mock-turnstile-widget';
      },
      execute() {
        queueMicrotask(() => {
          if (caseName === 'captcha-failure' || caseName === 'submission-without-clearance') {
            globalThis.turnstileOptions['error-callback']();
          } else {
            globalThis.turnstileOptions.callback('mock-turnstile-token');
          }
        });
      },
      remove() {},
    },
  };

  const element = () => ({
    className: '',
    append() {},
    remove() {},
  });
  globalThis.document = {
    body: element(),
    head: element(),
    createElement: element,
  };

  const jsonResponse = data => ({
    ok: true,
    status: 200,
    async json() { return data; },
  });

  globalThis.fetch = async (_url, options = {}) => {
    const payload = JSON.parse(options.body || '{}');
    calls.push(payload.action);

    if (payload.action === 'captcha_config') {
      return jsonResponse({ enabled: true, sitekey: 'mock-public-sitekey' });
    }

    if (payload.action === 'captcha_init') {
      if (caseName === 'existing-clearance') {
        return jsonResponse({ verified: true });
      }
      const captchaCalls = calls.filter(action => action === 'captcha_init').length;
      if (captchaCalls === 1) return jsonResponse({ required: true });
      return jsonResponse({ verified: true });
    }

    if (payload.action === 'submit') {
      return jsonResponse({ success: true, id: 'mock-submission' });
    }

    throw new Error(`Unexpected API action in CAPTCHA test: ${payload.action}`);
  };

  const api = await import('../api.js');

  if (caseName === 'first-entry') {
    await api.initializeSecurity();
    assert.equal(renderCount, 1, 'first entry must show one CAPTCHA challenge');
    assert.equal(calls.filter(action => action === 'captcha_init').length, 2);
  } else if (caseName === 'existing-clearance') {
    await api.initializeSecurity();
    assert.equal(renderCount, 0, 'an already-cleared UID must not see another challenge');
    assert.equal(calls.filter(action => action === 'captcha_init').length, 1);
  } else if (caseName === 'new-uid') {
    await api.initializeSecurity();
    assert.equal(renderCount, 1, 'a new anonymous UID must complete its own challenge');
    assert.equal(calls.filter(action => action === 'captcha_init').length, 2);
  } else if (caseName === 'captcha-failure') {
    await assert.rejects(
      api.initializeSecurity(),
      /Sigurnosna provjera nije prošla/,
      'a failed challenge must prevent security initialization',
    );
    assert.equal(calls.includes('submit'), false);
  } else if (caseName === 'submission-without-clearance') {
    await assert.rejects(
      api.request('submit', { kind: 'confession', body: 'Ovo je probni tekst ispovijesti.' }),
      /Sigurnosna provjera nije prošla/,
      'submission must be rejected when CAPTCHA clearance is not obtained',
    );
    assert.equal(calls.includes('submit'), false, 'submit API must not be called without clearance');
  } else {
    throw new Error(`Unknown CAPTCHA test scenario: ${caseName}`);
  }

  console.log(`Passed CAPTCHA scenario: ${caseName}`);
}
