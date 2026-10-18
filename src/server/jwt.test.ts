import { beforeAll, describe, expect, it } from 'vitest';
import { verifyJwt, type Jwk } from './jwt';

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const part = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

let privateKey: CryptoKey;
let jwk: Jwk;
const issuer = 'https://mezcalito.cloudflareaccess.com';
const audience = 'aud-tag';
const now = Date.parse('2026-10-18T22:00:00Z');

async function sign(claims: Record<string, unknown>, kid = 'k1', key = privateKey) {
  const unsigned = `${part({ alg: 'RS256', kid })}.${part(claims)}`;
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}
const good = () => ({ email: 'isa@example.com', aud: [audience], iss: issuer, exp: now / 1000 + 600 });

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  privateKey = pair.privateKey;
  jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' } as Jwk;
});

describe('verifyJwt', () => {
  const opts = { audience, issuer, now };

  it('accepts a valid token and returns its claims', async () => {
    expect((await verifyJwt(await sign(good()), [jwk], opts))?.email).toBe('isa@example.com');
  });
  it('rejects a token signed by another key', async () => {
    const other = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    expect(await verifyJwt(await sign(good(), 'k1', other.privateKey), [jwk], opts)).toBeUndefined();
  });
  it('rejects unknown key ids, wrong audience or issuer, and expired tokens', async () => {
    expect(await verifyJwt(await sign(good(), 'k2'), [jwk], opts)).toBeUndefined();
    expect(await verifyJwt(await sign({ ...good(), aud: ['other'] }), [jwk], opts)).toBeUndefined();
    expect(await verifyJwt(await sign({ ...good(), iss: 'https://evil.example' }), [jwk], opts)).toBeUndefined();
    expect(await verifyJwt(await sign({ ...good(), exp: now / 1000 - 1 }), [jwk], opts)).toBeUndefined();
  });
  it('rejects a tampered body and garbage', async () => {
    const [h, , s] = (await sign(good())).split('.');
    expect(await verifyJwt(`${h}.${part({ ...good(), email: 'boss@example.com' })}.${s}`, [jwk], opts)).toBeUndefined();
    expect(await verifyJwt('not-a-token', [jwk], opts)).toBeUndefined();
  });
});
