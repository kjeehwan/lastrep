# URI decoder compatibility adapter

Expo Router 57 and query-string 7 require decode-uri-component as a CommonJS
function. The upstream security fix in 0.5.0 is an ESM default export.
The root npm override resolves their dependency to this adapter, which exposes
that default export without modifying or copying the upstream algorithm.

The npm alias is pinned to upstream decode-uri-component 0.5.0; the old recursive
decoder is not included. Metro transforms the ESM dependency for the native app
and web builds. Node-side usage requires synchronous ESM require support (the
project's Node 22.18+ runtime supports it).

Advisory: https://github.com/advisories/GHSA-vcc3-ghjq-m6fr

Remove this adapter and the root override when a supported Expo Router release
no longer requires the vulnerable CommonJS decoder. Keep parsing and malformed
input regression tests when upgrading or removing the adapter.
