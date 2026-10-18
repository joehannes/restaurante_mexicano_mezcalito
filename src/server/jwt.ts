/**
 * Verifying the RS256 tokens Cloudflare Access puts in front of every staff
 * request. WebCrypto only, so it runs the same in the Worker and in tests.
 */

export interface Jwk extends JsonWebKey {
  kid: string;
}

export interface AccessClaims {
  email: string;
  aud: string | string[];
  iss: string;
  exp: number;
  nbf?: number;
}

const decode = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const json = <T>(part: string) => JSON.parse(new TextDecoder().decode(decode(part))) as T;

/**
 * The token's claims if the signature matches one of `keys`, it is meant for
 * `audience` from `issuer`, and it is in date; otherwise undefined.
 */
export async function verifyJwt(
  token: string,
  keys: readonly Jwk[],
  { audience, issuer, now = Date.now() }: { audience: string; issuer: string; now?: number },
): Promise<AccessClaims | undefined> {
  const [head, body, signature] = token.split('.');
  if (!head || !body || !signature) return undefined;
  let header: { alg?: string; kid?: string };
  let claims: AccessClaims;
  try {
    header = json(head);
    claims = json(body);
  } catch {
    return undefined;
  }
  if (header.alg !== 'RS256') return undefined;
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return undefined;

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(signature), new TextEncoder().encode(`${head}.${body}`));
  if (!valid) return undefined;

  const seconds = now / 1000;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(audience) || claims.iss !== issuer) return undefined;
  if (claims.exp <= seconds || (claims.nbf !== undefined && claims.nbf > seconds + 60)) return undefined;
  if (typeof claims.email !== 'string' || !claims.email) return undefined;
  return claims;
}
