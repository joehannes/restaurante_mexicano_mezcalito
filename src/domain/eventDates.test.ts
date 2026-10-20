import { describe, expect, it } from 'vitest';
import { currentEvent, eventTiming } from './eventDates';

const event = (slug: string, startsOn: string, endsOn: string, priority = 0, published = true) => ({ slug, startsOn, endsOn, priority, published });

describe('currentEvent', () => {
  const events = [
    event('muertos', '2026-10-31', '2026-11-02'),
    event('final', '2026-11-01', '2026-11-01', 5),
    event('draft', '2026-10-20', '2026-10-25', 99, false),
    event('later', '2026-12-20', '2026-12-31'),
  ];
  it('features one on today, the highest priority first', () => {
    expect(currentEvent(events, '2026-10-31')?.slug).toBe('muertos');
    expect(currentEvent(events, '2026-11-01')?.slug).toBe('final');
  });
  it('else the next one coming up, within the look-ahead', () => {
    expect(currentEvent(events, '2026-10-20')?.slug).toBe('muertos');
    expect(currentEvent(events, '2026-11-10')).toBeUndefined();
    expect(currentEvent(events, '2026-11-10', 60)?.slug).toBe('later');
  });
  it('never features a draft', () => {
    expect(currentEvent([events[2]!], '2026-10-21')).toBeUndefined();
  });
});

describe('eventTiming', () => {
  const e = event('muertos', '2026-10-31', '2026-11-02');
  it('counts the days until it starts', () => {
    expect(eventTiming(e, '2026-10-30')).toEqual({ state: 'soon', days: 1 });
    expect(eventTiming(e, '2026-10-20')).toEqual({ state: 'soon', days: 11 });
  });
  it('knows the last day and when it is over', () => {
    expect(eventTiming(e, '2026-10-31')).toEqual({ state: 'live', lastDay: false });
    expect(eventTiming(e, '2026-11-02')).toEqual({ state: 'live', lastDay: true });
    expect(eventTiming(e, '2026-11-03')).toEqual({ state: 'over' });
    expect(eventTiming(event('one', '2026-11-01', '2026-11-01'), '2026-11-01')).toEqual({ state: 'live', lastDay: false });
  });
});
