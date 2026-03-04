import { rpc } from '../daemon/client.js';

export async function connectCommand(opts: { port?: number; wsEndpoint?: string }) {
  const port = opts.port || 9430;
  const wsEndpoint = opts.wsEndpoint || 'ws://localhost:9420';
  const result = await rpc('connect', { wsEndpoint }, port);
  return result;
}
