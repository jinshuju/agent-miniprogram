import { rpc } from '../daemon/client.js';

export async function tapCommand(ref: string, opts: { port?: number }) {
  const port = opts.port || 9430;
  return await rpc('tap', { ref }, port);
}
