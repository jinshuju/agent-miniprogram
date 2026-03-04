import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const require = createRequire(import.meta.url);
const automator = require('miniprogram-automator');

export interface SessionState {
  connected: boolean;
  projectPath?: string;
  wsEndpoint?: string;
  currentPage?: string;
}

const STATE_DIR = path.join(os.homedir(), '.agent-miniprogram');
const STATE_FILE = path.join(STATE_DIR, 'daemon.json');

let miniProgram: any = null;

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function saveState(state: SessionState) {
  ensureStateDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function loadState(): SessionState {
  if (!fs.existsSync(STATE_FILE)) {
    return { connected: false };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { connected: false };
  }
}

export function getMiniProgram() {
  return miniProgram;
}

export async function launch(projectPath: string, wsEndpoint?: string): Promise<void> {
  const opts: any = { projectPath };
  if (wsEndpoint) opts.wsEndpoint = wsEndpoint;
  miniProgram = await automator.launch(opts);
  saveState({ connected: true, projectPath, wsEndpoint, currentPage: await getCurrentPage() });
}

export async function connect(wsEndpoint: string): Promise<void> {
  miniProgram = await automator.connect({ wsEndpoint });
  saveState({ connected: true, wsEndpoint, currentPage: await getCurrentPage() });
}

export async function closeSession(): Promise<void> {
  if (miniProgram) {
    await miniProgram.close();
    miniProgram = null;
  }
  saveState({ connected: false });
}

export async function getCurrentPage(): Promise<string | undefined> {
  if (!miniProgram) return undefined;
  try {
    const page = await miniProgram.currentPage();
    return page?.path;
  } catch {
    return undefined;
  }
}

export function isConnected(): boolean {
  return miniProgram !== null;
}
