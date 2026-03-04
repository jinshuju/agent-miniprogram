import { rpc } from '../daemon/client.js';

export async function launchCommand(projectPath: string, opts: { port?: number; wsEndpoint?: string }) {
  const port = opts.port || 9430;
  const result = await rpc('launch', { projectPath, wsEndpoint: opts.wsEndpoint }, port);
  return result;
}
