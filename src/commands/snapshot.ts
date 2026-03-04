import { rpc } from '../daemon/client.js';

export async function snapshotCommand(opts: { port?: number; data?: boolean }) {
  const port = opts.port || 9430;
  return await rpc('snapshot', { data: opts.data }, port);
}
