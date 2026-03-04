import { rpc } from '../daemon/client.js';

export async function closeCommand(opts: { port?: number }) {
  const port = opts.port || 9430;
  return await rpc('close', {}, port);
}
