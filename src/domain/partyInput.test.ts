import { describe, expect, it } from 'vitest';
import { parsePartyInput } from './partyInput';

const base = { kind: 'birthday', guests: 25, date: '2026-11-14', name: 'Shanice', phone: '809 555 0199' };

describe('parsePartyInput', () => {
  it('accepts a request with sensible defaults', () => {
    expect(parsePartyInput(base)).toEqual({
      ok: true,
      value: {
        locale: 'en',
        kind: 'birthday',
        guests: 25,
        date: '2026-11-14',
        time: undefined,
        name: 'Shanice',
        phone: '+18095550199',
        email: undefined,
        message: undefined,
      },
    });
  });
  it('reports bad fields', () => {
    expect(parsePartyInput({ kind: 'x', guests: 0, date: 'soon', time: '9pm', name: 'S', phone: '12', email: 'nope' })).toEqual({
      ok: false,
      errors: ['guests', 'date', 'time', 'name', 'phone', 'email'],
    });
  });
  it('treats an unknown kind as "other" and keeps a time and a message', () => {
    const r = parsePartyInput({ ...base, kind: 'wedding', time: '19:00', message: '  Reggae all night  ', locale: 'de' });
    expect(r.ok && [r.value.kind, r.value.time, r.value.message, r.value.locale]).toEqual(['other', '19:00', 'Reggae all night', 'de']);
  });
  it('rejects a missing body', () => {
    expect(parsePartyInput(null)).toEqual({ ok: false, errors: ['body'] });
  });
});
