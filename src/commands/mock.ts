import { rpc } from '../daemon/client.js';

export async function mockCommand(api: string, jsonResponse: string, opts: { port?: number }) {
  const port = opts.port || 9430;
  let response: any;
  try {
    response = JSON.parse(jsonResponse);
  } catch {
    throw new Error(`Invalid JSON response: ${jsonResponse}`);
  }
  return await rpc('mock', { api, response }, port);
}
