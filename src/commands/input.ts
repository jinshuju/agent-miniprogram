import { rpc } from '../daemon/client.js';

export async function inputCommand(ref: string, text: string, opts: { port?: number }) {
  const port = opts.port || 9430;
  return await rpc('input', { ref, text }, port);
}
