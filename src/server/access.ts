/**
 * Staff sign-in. Either the shared admin password (see password.ts), or
 * Cloudflare Access in front of /admin and /api/admin doing the actual login (one-time PIN by email, or Google); every request it
 * lets through carries a signed token naming the person. Here the token is
 * checked again — never trust a header just because Access should have set
 * it — and the email is looked up for a role.
 */
import { isRole, type Role } from '../domain/roles';
import { verifyJwt, type Jwk } from './jwt';
import { passwordStaff } from './password';

export interface Staff {
  email: string;
  name: string | null;
  role: Role;
  /** Signed in with the shared admin password rather than Access. */
  via?: 'password';
}

let certs: { domain: string; keys: Jwk[]; fetchedAt: number } | undefined;

async function accessKeys(domain: string): Promise<Jwk[]> {
  if (certs && certs.domain === domain && Date.now() - certs.fetchedAt < 3_600_000) return certs.keys;
  const response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error(`Access certs: ${response.status}`);
  const { keys } = (await response.json()) as { keys: Jwk[] };
  certs = { domain, keys, fetchedAt: Date.now() };
  return keys;
}

const tokenFrom = (request: Request) =>
  request.headers.get('cf-access-jwt-assertion') ??
  request.headers
    .get('cookie')
    ?.split(/;\s*/)
    .find((c) => c.startsWith('CF_Authorization='))
    ?.slice('CF_Authorization='.length);

/** The signed-in email, or undefined. */
async function signedInEmail(request: Request, env: Env, dev: boolean): Promise<string | undefined> {
  // Local development has no Access in front of it.
  if (dev && env.DEV_STAFF_EMAIL && !env.ACCESS_TEAM_DOMAIN) return env.DEV_STAFF_EMAIL;
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return undefined;
  const token = tokenFrom(request);
  if (!token) return undefined;
  try {
    const claims = await verifyJwt(token, await accessKeys(env.ACCESS_TEAM_DOMAIN), {
      audience: env.ACCESS_AUD,
      issuer: `https://${env.ACCESS_TEAM_DOMAIN}`,
    });
    return claims?.email;
  } catch (error) {
    console.error('access verification failed', error);
    return undefined;
  }
}

export async function staffFor(request: Request, env: Env, dev = false): Promise<Staff | undefined> {
  const email = (await signedInEmail(request, env, dev))?.toLowerCase();
  // No Access identity: the admin password's session cookie, if there is one.
  if (!email) return passwordStaff(request, env.DB);
  const owners = (env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const row = await env.DB.prepare('SELECT email, name, role FROM staff WHERE email = ?').bind(email).first<Staff>();
  if (owners.includes(email)) return { email, name: row?.name ?? null, role: 'owner' };
  if (row && isRole(row.role)) return row;
  // Local development: the dev email is an owner until the staff table says otherwise.
  if (dev && email === env.DEV_STAFF_EMAIL?.toLowerCase()) return { email, name: 'Dev', role: 'owner' };
  return passwordStaff(request, env.DB);
}
