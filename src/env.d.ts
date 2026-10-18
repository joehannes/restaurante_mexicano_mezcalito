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

  /** Azul Payment Page merchant credentials; `AZUL_MODE=live` leaves the sandbox. */
  AZUL_MERCHANT_ID?: string;
  AZUL_MERCHANT_NAME?: string;
  AZUL_MERCHANT_TYPE?: string;
  AZUL_AUTH_KEY?: string;
  AZUL_MODE?: string;
  /** PayPal REST app credentials; `PAYPAL_MODE=live` leaves the sandbox. */
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_SECRET?: string;
  PAYPAL_MODE?: string;

  /** WhatsApp Cloud API: a permanent token and the sending number's id. */
  WHATSAPP_TOKEN?: string;
  WHATSAPP_PHONE_ID?: string;
  /** Resend API key and the From address, e.g. `Mezcalito <hola@mezcalitobarandgrill.com>`. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Where new orders and party requests are emailed for the staff (comma-separated). */
  STAFF_EMAILS?: string;
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
