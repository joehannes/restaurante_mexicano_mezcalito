import { describe, expect, it } from 'vitest';
import { negotiate, t } from './ui';

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
    expect(t('es', 'status.closes', { time: '12 am' })).toBe('cierra 12 am');
  });
});
