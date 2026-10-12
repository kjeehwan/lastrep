import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const queryString = require('query-string') as {
  parse: (query: string) => Record<string, unknown>;
  stringify: (params: Record<string, unknown>) => string;
};
const { getStateFromPath } = require(
  'expo-router/build/react-navigation/core/getStateFromPath',
) as {
  getStateFromPath: (path: string, options: unknown) => {
    routes: { name: string; params: Record<string, unknown> }[];
  };
};

describe('patched deep-link query decoding', () => {
  it('keeps valid Unicode, spaces, reserved characters and repeated parameters', () => {
    expect(queryString.parse('name=Daniel+Kim&note=%ED%95%98%EC%B2%B4&value=a%2Bb%26c&tag=a&tag=b'))
      .toEqual({ name: 'Daniel Kim', note: '\uD558\uCCB4', value: 'a+b&c', tag: ['a', 'b'] });
  });

  it('round-trips OAuth-style redirect and state parameters', () => {
    const params = {
      redirect_uri: 'lastrep-dev://auth/callback',
      state: 'abc+def/ghi=',
      code: '123&456',
    };
    expect(queryString.parse(queryString.stringify(params))).toEqual(params);
  });

  it('uses the adapter through the real Expo Router path parser', () => {
    const state = getStateFromPath('profile?name=Daniel+Kim&note=%ED%95%98%EC%B2%B4', {
      screens: { Profile: 'profile' },
    });
    expect(state.routes[0]).toMatchObject({
      name: 'Profile', params: { name: 'Daniel Kim', note: '\uD558\uCCB4' },
    });
  });

  it('tolerates malformed escapes without throwing', () => {
    expect(queryString.parse('bad=%FF&incomplete=%E0%A4&bare=%&valid=ok'))
      .toMatchObject({ bad: '%FF', bare: '%', valid: 'ok' });
  });

  it('handles long malformed input without recursive decoding or a hang', () => {
    // A subprocess timeout protects the test runner if the old decoder returns.
    const result = execFileSync(process.execPath, ['-e', `
      const qs = require('query-string');
      const bad = '%FF'.repeat(20000);
      const parsed = qs.parse('bad=' + bad + '&valid=ok');
      if (parsed.bad !== bad || parsed.valid !== 'ok') process.exit(1);
      process.stdout.write('ok');
    `], { cwd: new URL('..', import.meta.url), timeout: 5000, encoding: 'utf8' });
    expect(result).toBe('ok');
  });
});
