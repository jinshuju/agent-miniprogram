import * as fs from 'fs';
import { rpc } from '../daemon/client.js';
import type { AmpFile } from './recorder.js';

const REF_METHODS = new Set(['tap', 'input', 'scroll', 'longPress', 'swipe']);

function usesRef(params: any): boolean {
  return typeof params?.ref === 'string' && params.ref.startsWith('@');
}

export async function replay(filePath: string, opts: { port?: number } = {}) {
  const port = opts.port || 9430;

  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const amp: AmpFile = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (amp.version !== '1') throw new Error(`Unsupported .amp version: ${amp.version}`);

  console.log(`Replaying ${amp.actions.length} actions from ${filePath}`);

  for (let i = 0; i < amp.actions.length; i++) {
    const action = amp.actions[i];
    // Wait the appropriate time between actions (capped at 3s)
    if (i > 0) {
      const prevAction = amp.actions[i - 1];
      const delay = Math.min(action.timestamp - prevAction.timestamp, 3000);
      if (delay > 50) {
        await new Promise(r => setTimeout(r, delay));
      }
    }

    // Auto-snapshot before ref-based actions to rebuild ref registry
    if (REF_METHODS.has(action.method) && usesRef(action.params)) {
      await rpc('snapshot', {}, port);
    }

    console.log(`  [${i + 1}/${amp.actions.length}] ${action.method}`);
    try {
      await rpc(action.method, action.params, port);
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      throw err;
    }
  }

  console.log('Replay complete.');
}
