import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { onlineProviders, startPayment, type Provider } from '../../../server/payments';

/** /api/pay/MZ-7KQ4?k=<key>&p=azul|paypal — hands the guest over to the payment page. */
export const GET: APIRoute = async ({ params, url }) => {
  const provider = url.searchParams.get('p') as Provider;
  if (!onlineProviders(env).includes(provider)) return new Response('Not found', { status: 404 });
  return startPayment(env, url.origin, String(params.code), url.searchParams.get('k') ?? '', provider);
};
