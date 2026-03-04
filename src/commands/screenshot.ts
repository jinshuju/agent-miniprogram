import { rpc } from '../daemon/client.js';

export async function screenshotCommand(opts: { port?: number; path?: string }) {
  const port = opts.port || 9430;
  return await rpc('screenshot', { path: opts.path }, port);
}
