import { describe, expect, it } from 'vitest';
import { normalizePhone, orderCode, parseOrderInput } from './orderInput';

const base = {
  locale: 'es',
  mode: 'pickup',
  lines: [{ itemId: 'oxtail', qty: 1, options: { side: ['festival'] } }],
  name: 'Ana',
  phone: '809-555-1234',
  payment: 'cash',
  when: 'asap',
};

describe('parseOrderInput', () => {
  it('accepts a pickup order and normalises a Dominican phone', () => {
    const r = parseOrderInput(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.phone).toBe('+18095551234');
      expect(r.value.locale).toBe('es');
      expect(r.value.address).toBeUndefined();
    }
  });

  it('reports every bad field', () => {
    const r = parseOrderInput({ ...base, mode: 'drone', name: 'A', phone: '12', payment: 'gold', when: '25:00', email: 'nope' });
    expect(r).toEqual({ ok: false, errors: ['mode', 'name', 'phone', 'email', 'payment', 'when'] });
  });

  it('needs a street for delivery and a table for dine-in', () => {
    expect(parseOrderInput({ ...base, mode: 'delivery' })).toEqual({ ok: false, errors: ['address'] });
    expect(parseOrderInput({ ...base, mode: 'dine_in' })).toEqual({ ok: false, errors: ['table'] });
    const ok = parseOrderInput({ ...base, mode: 'delivery', address: { street: 'Calle Pedro Mir 5', reference: 'Hotel X' } });
    expect(ok.ok && ok.value.address).toEqual({ street: 'Calle Pedro Mir 5', reference: 'Hotel X', lat: undefined, lng: undefined });
  });

  it('rejects malformed cart lines and empty carts', () => {
    expect(parseOrderInput({ ...base, lines: [] })).toEqual({ ok: false, errors: ['lines'] });
    expect(parseOrderInput({ ...base, lines: [{ itemId: 5, qty: 1 }] })).toEqual({ ok: false, errors: ['lines'] });
    expect(parseOrderInput({ ...base, lines: [{ itemId: 'x', qty: 1, options: { side: [3] } }] })).toEqual({ ok: false, errors: ['lines'] });
  });

  it('never trusts a price sent by the client', () => {
    const r = parseOrderInput({ ...base, lines: [{ itemId: 'oxtail', qty: 1, price: 1 }] });
    expect(r.ok && Object.keys(r.value.lines[0]!)).not.toContain('price');
  });
});

describe('normalizePhone', () => {
  it('handles local and international numbers', () => {
    expect(normalizePhone('(829) 555-1234')).toBe('+18295551234');
    expect(normalizePhone('+49 151 23456789')).toBe('+4915123456789');
    expect(normalizePhone('555')).toBeUndefined();
  });
});

describe('orderCode', () => {
  it('is short and avoids look-alike characters', () => {
    expect(orderCode(() => 0)).toBe('MZ-AAAA');
    for (let i = 0; i < 50; i++) expect(orderCode()).toMatch(/^MZ-[ACDEFGHJKMNPQRTUVWXY3479]{4}$/);
  });
});
