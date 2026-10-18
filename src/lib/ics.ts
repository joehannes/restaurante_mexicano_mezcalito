/**
 * A calendar entry for a booking. Bávaro keeps UTC−4 all year, so the local
 * time converts to UTC with a fixed offset.
 */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escape = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export function reservationIcs(r: {
  code: string;
  date: string;
  time: string;
  minutes: number;
  title: string;
  location: string;
  description: string;
  now?: Date;
}): string {
  const start = new Date(`${r.date}T${r.time}:00-04:00`);
  const end = new Date(start.getTime() + r.minutes * 60_000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mezcalito Bar & Grill//Reservations//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${r.code}@mezcalitobarandgrill.com`,
    `DTSTAMP:${stamp(r.now ?? new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(r.title)}`,
    `LOCATION:${escape(r.location)}`,
    `DESCRIPTION:${escape(r.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
