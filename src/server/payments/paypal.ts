/**
 * PayPal Checkout (Orders v2), the second way to pay online — familiar to the
 * many guests on holiday from the US and Canada. PayPal does not settle in
 * Dominican pesos, so the order is charged in US dollars at the rate set in
 * the admin, and the guest sees that figure before paying.
 *
 * Flow: create an order → send the guest to PayPal to approve it → they come
 * back with its id → capture it here, and only a COMPLETED capture for the
 * right order and amount counts as paid.
 */

export interface PayPalConfig {
  clientId: string;
  secret: string;
  mode: 'test' | 'live';
}

const base = (mode: PayPalConfig['mode']) => (mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');

async function token(config: PayPalConfig): Promise<string> {
  const response = await fetch(`${base(config.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${btoa(`${config.clientId}:${config.secret}`)}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error(`PayPal token: ${response.status}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

/** Creates the PayPal order and returns where to send the guest. */
export async function paypalStart(
  config: PayPalConfig,
  order: { code: string; usd: string; locale: string },
  urls: { returnUrl: string; cancelUrl: string },
): Promise<{ id: string; approveUrl: string }> {
  const response = await fetch(`${base(config.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(config)}`, 'content-type': 'application/json', 'paypal-request-id': `create-${order.code}` },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: order.code, custom_id: order.code, description: `Mezcalito ${order.code}`, amount: { currency_code: 'USD', value: order.usd } }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'Mezcalito Bar & Grill',
            user_action: 'PAY_NOW',
            shipping_preference: 'NO_SHIPPING',
            locale: { en: 'en-US', es: 'es-DO', fr: 'fr-FR', de: 'de-DE' }[order.locale] ?? 'en-US',
            return_url: urls.returnUrl,
            cancel_url: urls.cancelUrl,
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`PayPal create: ${response.status} ${await response.text()}`);
  const body = (await response.json()) as { id: string; links: { rel: string; href: string }[] };
  const approve = body.links.find((l) => l.rel === 'payer-action' || l.rel === 'approve');
  if (!approve) throw new Error('PayPal create: no approval link');
  return { id: body.id, approveUrl: approve.href };
}

export type PayPalCapture = { paid: true; code: string; usd: string; reference: string } | { paid: false };

/** Captures an approved order. Safe to repeat: PayPal answers a second capture with the first one's result. */
export async function paypalCapture(config: PayPalConfig, paypalOrderId: string): Promise<PayPalCapture> {
  const response = await fetch(`${base(config.mode)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await token(config)}`, 'content-type': 'application/json', 'paypal-request-id': `capture-${paypalOrderId}` },
  });
  if (!response.ok) return { paid: false };
  const body = (await response.json()) as {
    status: string;
    purchase_units?: { reference_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string }; custom_id?: string }[] } }[];
  };
  const unit = body.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (body.status !== 'COMPLETED' || capture?.status !== 'COMPLETED' || capture.amount.currency_code !== 'USD') return { paid: false };
  return { paid: true, code: capture.custom_id ?? unit?.reference_id ?? '', usd: capture.amount.value, reference: capture.id };
}

export function paypalConfig(env: Env): PayPalConfig | undefined {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return undefined;
  return { clientId: env.PAYPAL_CLIENT_ID, secret: env.PAYPAL_SECRET, mode: env.PAYPAL_MODE === 'live' ? 'live' : 'test' };
}
