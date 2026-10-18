import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { azulForm, azulResult, type AzulConfig } from './azul';

const config: AzulConfig = { merchantId: '39038540035', merchantName: 'Mezcalito', merchantType: 'Restaurant', authKey: 'secret-key', mode: 'test' };
const urls = { approved: 'https://m.example/a', declined: 'https://m.example/d', cancel: 'https://m.example/c' };
const hmac = (data: string) => createHmac('sha512', config.authKey).update(data).digest('hex');

describe('azulForm', () => {
  it('sends centavos as-is and signs the fields in Azul order with the key appended', async () => {
    const form = await azulForm(config, { number: 'MZ-7KQ4', total: 354_432, itbis: 47_520, locale: 'es' }, urls);
    expect(form.Amount).toBe('354432');
    expect(form.ITBIS).toBe('47520');
    expect(form.Locale).toBe('ES');
    const signed = ['39038540035', 'Mezcalito', 'Restaurant', '$', 'MZ-7KQ4', '354432', '47520', ...Object.values(urls), '0', '', '', '0', '', ''].join('');
    expect(form.AuthHash).toBe(hmac(signed + config.authKey));
  });
});

describe('azulResult', () => {
  const response = (iso: string) => {
    const p = new URLSearchParams({
      OrderNumber: 'MZ-7KQ4',
      Amount: '354432',
      AuthorizationCode: 'OK1234',
      DateTime: '20261018220000',
      ResponseCode: 'ISO8583',
      IsoCode: iso,
      ResponseMessage: iso === '00' ? 'APROBADA' : 'DECLINADA',
      ErrorDescription: '',
      RRN: '123456789012',
    });
    p.set('AuthHash', hmac([...p.values()].join('') + config.authKey));
    return p;
  };
  it('accepts a signed approval', async () => {
    expect(await azulResult(config, response('00'))).toEqual({ ok: true, approved: true, orderNumber: 'MZ-7KQ4', amount: 354_432, reference: 'OK1234/123456789012' });
  });
  it('reads a signed decline as not approved', async () => {
    expect(await azulResult(config, response('51'))).toMatchObject({ ok: true, approved: false });
  });
  it('rejects a forged or tampered result', async () => {
    const p = response('51');
    p.set('IsoCode', '00');
    expect(await azulResult(config, p)).toEqual({ ok: false, reason: 'signature' });
    expect(await azulResult(config, new URLSearchParams({ OrderNumber: 'MZ-7KQ4' }))).toEqual({ ok: false, reason: 'missing' });
  });
});
