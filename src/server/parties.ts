/** Party and catering requests: stored for the staff, announced on the board. */
import type { PartyInput } from '../domain/partyInput';
import { tellKitchen } from './orders';

export async function requestParty(env: Env, input: PartyInput): Promise<{ ok: true; id: number } | { ok: false }> {
  try {
    const row = await env.DB.prepare(
      `INSERT INTO party_requests (kind, guests, date, time, name, phone, email, message, locale)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
      .bind(input.kind, input.guests, input.date, input.time ?? null, input.name, input.phone, input.email ?? null, input.message ?? null, input.locale)
      .first<{ id: number }>();
    await tellKitchen(env, 'board', { type: 'party.created', id: row!.id, kind: input.kind, guests: input.guests, date: input.date });
    return { ok: true, id: row!.id };
  } catch (error) {
    console.error('party request storage failed', error);
    return { ok: false };
  }
}
