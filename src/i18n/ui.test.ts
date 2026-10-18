import { describe, expect, it } from 'vitest';
import { negotiate, t, when } from './ui';

describe('negotiate', () => {
  it('picks the most wanted launch language', () => {
    expect(negotiate('de-DE,de;q=0.9,en;q=0.8')).toBe('de');
    expect(negotiate('pt-BR,pt;q=0.9,es;q=0.8,en;q=0.5')).toBe('es');
    expect(negotiate('en;q=0.4,fr-CA;q=0.9')).toBe('fr');
  });
  it('falls back to English', () => {
    expect(negotiate(null)).toBe('en');
    expect(negotiate('ja,zh;q=0.8')).toBe('en');
  });
});

describe('t', () => {
  it('fills placeholders', () => {
    expect(t('es', 'status.closes', { time: '00:00' })).toBe('hasta las 00:00');
    expect(t('en', 'cart.view', { count: 3 })).toBe('View order · 3');
  });
});

describe('when', () => {
  it('says today, tomorrow or the weekday', () => {
    expect(when({ date: '2026-10-20', time: '08:00' }, '2026-10-20', 'en')).toBe('today at 8 am');
    expect(when({ date: '2026-10-21', time: '08:00' }, '2026-10-20', 'es')).toBe('mañana a las 08:00');
    expect(when({ date: '2026-10-23', time: '08:00' }, '2026-10-20', 'en')).toBe('Friday at 8 am');
  });
});
