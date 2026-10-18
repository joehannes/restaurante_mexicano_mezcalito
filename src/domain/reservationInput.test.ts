import { describe, expect, it } from 'vitest';
import { parseReservationInput, reservationCode } from './reservationInput';

const base = { date: '2026-10-24', time: '19:30', party: 4, name: 'Kemar', phone: '+1 876 555 0101' };

describe('parseReservationInput', () => {
  it('accepts a booking with sensible defaults', () => {
    const r = parseReservationInput(base);
    expect(r).toEqual({
      ok: true,
      value: { locale: 'en', ...base, phone: '+18765550101', email: undefined, occasion: 'none', seating: 'any', addons: [], notes: undefined },
    });
  });
  it('reports bad fields', () => {
    expect(parseReservationInput({ ...base, date: '2026-13-45', time: '7pm', party: 0, name: '', phone: 'x' })).toEqual({
      ok: false,
      errors: ['date', 'time', 'party', 'name', 'phone'],
    });
  });
  it('only adds sparklers to a birthday, and ignores unknown occasions', () => {
    const bday = parseReservationInput({ ...base, occasion: 'birthday', sparklers: true });
    expect(bday.ok && bday.value.addons).toEqual(['sparklers']);
    const date = parseReservationInput({ ...base, occasion: 'date', sparklers: true });
    expect(date.ok && date.value.addons).toEqual([]);
    const odd = parseReservationInput({ ...base, occasion: 'wedding', seating: 'roof' });
    expect(odd.ok && [odd.value.occasion, odd.value.seating]).toEqual(['none', 'any']);
  });
});

describe('reservationCode', () => {
  it('looks like R-XXXX', () => {
    expect(reservationCode()).toMatch(/^R-[ACDEFGHJKMNPQRTUVWXY3479]{4}$/);
  });
});
