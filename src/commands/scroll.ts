import { rpc } from '../daemon/client.js';

export async function scrollCommand(ref: string, opts: { port?: number; x?: number; y?: number }) {
  const port = opts.port || 9430;
  return await rpc('scroll', { ref, x: opts.x || 0, y: opts.y || 0 }, port);
}
