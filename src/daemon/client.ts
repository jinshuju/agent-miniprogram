import * as http from 'http';

const DEFAULT_PORT = 9430;

export interface RpcResult {
  result?: any;
  error?: string;
}

export async function rpc(method: string, params: any = {}, port = DEFAULT_PORT): Promise<any> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ method, params });
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const parsed: RpcResult = JSON.parse(data);
            if (parsed.error) {
              reject(new Error(parsed.error));
            } else {
              resolve(parsed.result);
            }
          } catch {
            reject(new Error(`Invalid response: ${data}`));
          }
        });
      }
    );

    req.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Daemon not running. Start it with: agent-mp daemon'));
      } else {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

export async function ensureDaemon(port = DEFAULT_PORT): Promise<void> {
  try {
    await rpc('status', {}, port);
  } catch (err: any) {
    if (err.message?.includes('Daemon not running')) {
      throw err;
    }
  }
}
