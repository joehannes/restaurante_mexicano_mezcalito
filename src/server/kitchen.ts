/**
 * KitchenRoom: one Durable Object that every live screen connects to.
 *
 * The orders board connects tagged `board`; a guest watching their order
 * connects tagged `order:<code>`. When an order is placed or changes status,
 * the server POSTs to /broadcast and only the matching sockets hear it.
 * Uses the WebSocket Hibernation API, so idle screens cost nothing.
 */
import { DurableObject } from 'cloudflare:workers';

export interface KitchenMessage {
  /** `board`, or `order:<code>`. */
  tag: string;
  data: unknown;
}

const TAG = /^(board|order:[A-Z0-9-]{4,16})$/;

export class KitchenRoom extends DurableObject<Env> {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/broadcast' && request.method === 'POST') {
      const message = (await request.json()) as KitchenMessage;
      const payload = JSON.stringify(message.data);
      for (const ws of this.ctx.getWebSockets(message.tag)) {
        try {
          ws.send(payload);
        } catch {
          // A socket that closed mid-send is cleaned up by the runtime.
        }
      }
      return new Response(null, { status: 204 });
    }

    const tag = url.searchParams.get('tag') ?? '';
    if (request.headers.get('Upgrade') !== 'websocket' || !TAG.test(tag)) {
      return new Response('Expected a WebSocket upgrade with a valid tag', { status: 400 });
    }
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [tag]);
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (message === 'ping') ws.send('pong');
  }

  override async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code, 'closing');
  }
}
