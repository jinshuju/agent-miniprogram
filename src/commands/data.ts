import { rpc } from '../daemon/client.js';

export async function dataCommand(dotPath?: string, opts: { port?: number } = {}) {
  const port = opts.port || 9430;
  return await rpc('data', { path: dotPath }, port);
}
