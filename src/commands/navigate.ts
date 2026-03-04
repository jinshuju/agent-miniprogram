import { rpc } from '../daemon/client.js';

export async function navigateCommand(url: string, opts: { port?: number; type?: string }) {
  const port = opts.port || 9430;
  return await rpc('navigate', { url, type: opts.type || 'navigateTo' }, port);
}

export async function backCommand(opts: { port?: number }) {
  const port = opts.port || 9430;
  return await rpc('back', {}, port);
}
