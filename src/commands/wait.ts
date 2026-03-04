import { rpc } from '../daemon/client.js';

export async function waitCommand(
  target: string,
  opts: { port?: number; text?: string; data?: string }
) {
  const port = opts.port || 9430;

  // If target is a number, wait ms
  const ms = parseInt(target, 10);
  if (!isNaN(ms)) {
    return await rpc('wait', { ms }, port);
  }

  // If target starts with @, it's a ref
  if (target.startsWith('@')) {
    return await rpc('wait', { ref: target }, port);
  }

  // If --text option
  if (opts.text) {
    return await rpc('wait', { text: opts.text }, port);
  }

  // Otherwise treat as selector
  return await rpc('wait', { selector: target }, port);
}
