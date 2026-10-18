import { describe, expect, it } from 'vitest';
import { reservationIcs } from './ics';

describe('reservationIcs', () => {
  it('converts Bávaro time to UTC and escapes text', () => {
    const ics = reservationIcs({
      code: 'R-AB34',
      date: '2026-10-24',
      time: '19:30',
      minutes: 90,
      title: 'Mezcalito, table for 4',
      location: 'Calle Pedro Mir; Bávaro',
      description: 'Reservation R-AB34',
      now: new Date('2026-10-18T12:00:00Z'),
    });
    expect(ics).toContain('DTSTART:20261024T233000Z');
    expect(ics).toContain('DTEND:20261025T010000Z');
    expect(ics).toContain('SUMMARY:Mezcalito\\, table for 4');
    expect(ics).toContain('LOCATION:Calle Pedro Mir\\; Bávaro');
    expect(ics).toContain('\r\n');
  });
});
