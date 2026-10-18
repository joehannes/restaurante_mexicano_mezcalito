/** Talking to /api/admin from the staff islands. */

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; fields: string[] };

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  try {
    const response = await fetch(`/api/admin${path}`, {
      method: init.method ?? (init.body || init.form ? 'POST' : 'GET'),
      // Proves the request comes from our own pages (see middleware.ts).
      headers: { 'x-mezcalito': 'admin', ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string; fields?: string[] };
    if (response.ok) return { ok: true, data };
    return { ok: false, status: response.status, error: data.error ?? 'error', fields: data.fields ?? [] };
  } catch {
    return { ok: false, status: 0, error: 'network', fields: [] };
  }
}

/** Pesos as typed by staff → centavos, or undefined when it is not a price. */
export const toCentavos = (pesos: string) => {
  const n = Number(pesos.replace(/,/g, ''));
  return pesos.trim() !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined;
};
export const toPesos = (centavos: number | null | undefined) => (centavos === null || centavos === undefined ? '' : String(centavos / 100));
