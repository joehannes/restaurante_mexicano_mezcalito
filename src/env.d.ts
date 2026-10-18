/// <reference types="astro/client" />

/**
 * Settings and secrets that are not in wrangler.jsonc. Each is optional: the
 * feature it unlocks stays off until it is set (`wrangler secret put NAME`,
 * or `.dev.vars` locally — see `.dev.vars.example`).
 */
interface MezcalitoSecrets {
  /** Cloudflare Access team domain, e.g. `mezcalito.cloudflareaccess.com`. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience tag. */
  ACCESS_AUD?: string;
  /** Comma-separated emails that are always owners. */
  OWNER_EMAILS?: string;
  /** Local development only: sign in to /admin as this email without Access. */
  DEV_STAFF_EMAIL?: string;
}

interface Env extends MezcalitoSecrets {}
declare namespace Cloudflare {
  interface Env extends MezcalitoSecrets {}
}

declare namespace App {
  interface Locals {
    staff?: import('./server/access').Staff;
  }
}
