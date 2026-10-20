/**
 * Azul Payment Page (Banco Popular's hosted card page, the common choice for
 * Dominican merchants). The guest's browser POSTs a signed form to Azul, pays
 * there, and is sent back to one of our URLs with a signed result.
 *
 * Both signatures are HMAC-SHA512 over the fields concatenated in Azul's
 * fixed order, keyed with the merchant's AuthKey. Amounts are in centavos
 * with no decimal point — exactly how this app already stores money.
 *
 * Check the field order against the Payment Page guide Azul sends with the
 * merchant credentials before going live; it is the one thing that cannot be
 * tested without them.
 */
import type { PaymentCredentials } from '../../domain/adminInput';

export interface AzulConfig {
  merchantId: string;
  merchantName: string;
  merchantType: string;
  authKey: string;
  /** `test` uses Azul's sandbox page. */
  mode: 'test' | 'live';
}

export const azulPageUrl = (mode: AzulConfig['mode']) =>
  mode === 'live' ? 'https://pagos.azul.com.do/PaymentPage/' : 'https://pruebas.azul.com.do/PaymentPage/';

async function hmac512(key: string, data: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const REQUEST_FIELDS = [
  'MerchantId',
  'MerchantName',
  'MerchantType',
  'CurrencyCode',
  'OrderNumber',
  'Amount',
  'ITBIS',
  'ApprovedUrl',
  'DeclinedUrl',
  'CancelUrl',
  'UseCustomField1',
  'CustomField1Label',
  'CustomField1Value',
  'UseCustomField2',
  'CustomField2Label',
  'CustomField2Value',
] as const;

const RESPONSE_FIELDS = ['OrderNumber', 'Amount', 'AuthorizationCode', 'DateTime', 'ResponseCode', 'IsoCode', 'ResponseMessage', 'ErrorDescription', 'RRN'] as const;

/** The form fields, signed, that the guest's browser posts to Azul. */
export async function azulForm(
  config: AzulConfig,
  order: { number: string; total: number; itbis: number; locale: string },
  urls: { approved: string; declined: string; cancel: string },
): Promise<Record<string, string>> {
  const fields: Record<string, string> = {
    MerchantId: config.merchantId,
    MerchantName: config.merchantName,
    MerchantType: config.merchantType,
    CurrencyCode: '$',
    OrderNumber: order.number,
    Amount: String(order.total),
    ITBIS: String(order.itbis),
    ApprovedUrl: urls.approved,
    DeclinedUrl: urls.declined,
    CancelUrl: urls.cancel,
    UseCustomField1: '0',
    CustomField1Label: '',
    CustomField1Value: '',
    UseCustomField2: '0',
    CustomField2Label: '',
    CustomField2Value: '',
  };
  fields.AuthHash = await hmac512(config.authKey, REQUEST_FIELDS.map((f) => fields[f]).join('') + config.authKey);
  // Azul's page speaks Spanish and English.
  fields.Locale = order.locale === 'es' ? 'ES' : 'EN';
  fields.ShowTransactionResult = '0';
  return fields;
}

export type AzulResult =
  | { ok: true; approved: boolean; orderNumber: string; amount: number; reference: string }
  | { ok: false; reason: 'signature' | 'missing' };

/** Checks the signature on Azul's return and reads the outcome. */
export async function azulResult(config: AzulConfig, params: URLSearchParams): Promise<AzulResult> {
  const hash = params.get('AuthHash');
  if (!hash || !params.get('OrderNumber')) return { ok: false, reason: 'missing' };
  const expected = await hmac512(config.authKey, RESPONSE_FIELDS.map((f) => params.get(f) ?? '').join('') + config.authKey);
  if (expected.toLowerCase() !== hash.toLowerCase()) return { ok: false, reason: 'signature' };
  return {
    ok: true,
    // IsoCode 00 is an approval; anything else is a decline or an error.
    approved: params.get('IsoCode') === '00',
    orderNumber: params.get('OrderNumber')!,
    amount: Number(params.get('Amount')),
    reference: [params.get('AuthorizationCode'), params.get('RRN')].filter(Boolean).join('/'),
  };
}

/** From the Worker's secrets when they are set, else from what the owner typed in the admin. */
export function azulConfig(env: Env, stored?: NonNullable<PaymentCredentials['azul']>): AzulConfig | undefined {
  if (!env.AZUL_MERCHANT_ID || !env.AZUL_AUTH_KEY) return stored && { ...stored };
  return {
    merchantId: env.AZUL_MERCHANT_ID,
    merchantName: env.AZUL_MERCHANT_NAME ?? 'Mezcalito Bar and Grill',
    merchantType: env.AZUL_MERCHANT_TYPE ?? 'Restaurant',
    authKey: env.AZUL_AUTH_KEY,
    mode: env.AZUL_MODE === 'live' ? 'live' : 'test',
  };
}
