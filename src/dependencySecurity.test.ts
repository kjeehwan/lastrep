import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { satisfies } = require('semver') as {
  satisfies: (version: string, range: string) => boolean;
};
const lock = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
) as { packages: Record<string, { version?: string; name?: string }> };

describe('dependency security floors', () => {
  it.each([
    ['protobufjs', '>=7.6.5'],
    ['shell-quote', '>=1.8.5'],
    ['websocket-driver', '>=0.7.5'],
    ['@grpc/grpc-js', '>=1.13.6'],
    ['vitest', '>=4.1.11'],
    ['decode-uri-component-patched', '>=0.5.0'],
  ])('%s stays above its patched version', (name, range) => {
    const entries = Object.entries(lock.packages).filter(([path]) =>
      path.endsWith(`node_modules/${name}`),
    );
    expect(entries.length).toBeGreaterThan(0);
    for (const [path, entry] of entries) {
      expect(satisfies(entry.version ?? '0.0.0', range), path).toBe(true);
    }
  });

  it('does not contain an old decoder hidden under another dependency', () => {
    for (const [path, entry] of Object.entries(lock.packages)) {
      if ((path.endsWith('node_modules/decode-uri-component') ||
        entry.name === 'decode-uri-component') && entry.version) {
        expect(satisfies(entry.version, '>=0.5.0'), path).toBe(true);
      }
    }
  });
});
