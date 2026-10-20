/**
 * Password sign-in to /admin, for when Cloudflare Access is not in front of
 * the site (or as a second door beside it). One shared owner password, "admin"
 * until someone changes it under Admin → Staff. A signed cookie keeps the
 * session for 30 days; changing the password ends every session.
 *
 * The hash, the cookie key and the payment secrets live in
 * `private_settings`, which no guest page reads.
 */
import type { Staff } from './access';

export const DEFAULT_PASSWORD = 'admin';
const COOKIE = 'mz_admin';
const SESSION_DAYS = 30;
// Workers caps PBKDF2 at 100,000 iterations.
const ITERATIONS = 100_000;
const MAX_FAILS = 10;

interface PasswordRecord {
  salt: string;
  hash: string;
}

const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));
const b64url = (s: string) => btoa(s).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!);
const unb64url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

/** Equal strings, in time that does not depend on where they differ. */
function same(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function getPrivate<T>(db: D1Database, key: string): Promise<T | undefined> {
  const row = await db.prepare('SELECT value FROM private_settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row ? (JSON.parse(row.value) as T) : undefined;
}

export async function setPrivate(db: D1Database, key: string, value: unknown) {
  await db
    .prepare(
      `INSERT INTO private_settings (key, value) VALUES (?1, ?2)
       ON CONFLICT (key) DO UPDATE SET value = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(key, JSON.stringify(value))
    .run();
}

async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256);
  return hex(bits);
}

const record = (db: D1Database) => getPrivate<PasswordRecord>(db, 'admin_password');

/** True while nobody has replaced "admin". */
export const usingDefaultPassword = async (db: D1Database) => !(await record(db));

export async function checkPassword(db: D1Database, password: string): Promise<boolean> {
  const r = await record(db);
  if (!r) return same(password, DEFAULT_PASSWORD);
  return same(await derive(password, r.salt), r.hash);
}

export async function setPassword(db: D1Database, password: string) {
  const salt = randomHex(16);
  await setPrivate(db, 'admin_password', { salt, hash: await derive(password, salt) } satisfies PasswordRecord);
}

/** The key cookies are signed with, made on first use. */
async function signingKey(db: D1Database) {
  let secret = await getPrivate<string>(db, 'session_secret');
  if (!secret) {
    secret = randomHex(32);
    // Two first requests at once: the first to write wins, both read it back.
    await db.prepare("INSERT OR IGNORE INTO private_settings (key, value) VALUES ('session_secret', ?)").bind(JSON.stringify(secret)).run();
    secret = (await getPrivate<string>(db, 'session_secret'))!;
  }
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

const sign = async (db: D1Database, payload: string) => hex(await crypto.subtle.sign('HMAC', await signingKey(db), new TextEncoder().encode(payload)));

/** Which password a session was made under: a new password ends old sessions. */
const generation = async (db: D1Database) => (await record(db))?.salt ?? 'default';

/** The Set-Cookie header for a new 30-day session. */
export async function sessionCookie(db: D1Database, secure: boolean) {
  const payload = b64url(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 86_400_000, g: await generation(db) }));
  const value = `${payload}.${await sign(db, payload)}`;
  return `${COOKIE}=${value}; Path=/; Max-Age=${SESSION_DAYS * 86_400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export const clearSessionCookie = (secure: boolean) => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

/** The owner signed in with the password, or undefined. */
export async function passwordStaff(request: Request, db: D1Database): Promise<Staff | undefined> {
  const value = request.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  if (!value) return undefined;
  const [payload, signature] = value.split('.');
  if (!payload || !signature) return undefined;
  try {
    if (!same(await sign(db, payload), signature)) return undefined;
    const { exp, g } = JSON.parse(unb64url(payload)) as { exp: number; g: string };
    if (!(exp > Date.now()) || g !== (await generation(db))) return undefined;
    return { email: 'admin', name: 'Admin', role: 'owner', via: 'password' };
  } catch {
    return undefined;
  }
}

/** Ten wrong passwords from one address lock it out for fifteen minutes. */
export async function lockedOut(env: Env, ip: string) {
  return Number((await env.CACHE.get(`login-fail:${ip}`)) ?? 0) >= MAX_FAILS;
}

export async function recordFailure(env: Env, ip: string) {
  const key = `login-fail:${ip}`;
  const fails = Number((await env.CACHE.get(key)) ?? 0) + 1;
  await env.CACHE.put(key, String(fails), { expirationTtl: 900 });
}
