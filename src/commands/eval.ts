import { rpc } from '../daemon/client.js';

export async function evalCommand(code: string, opts: { port?: number }) {
  const port = opts.port || 9430;
  return await rpc('eval', { code }, port);
}
