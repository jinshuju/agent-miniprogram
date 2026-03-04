import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.agent-miniprogram');
const REFS_FILE = path.join(STATE_DIR, 'refs.json');

interface RefEntry {
  selector: string;
  tag: string;
  text?: string;
}

let registry: Map<string, RefEntry> = new Map();
let counter = 0;

function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

export function loadRefs() {
  if (!fs.existsSync(REFS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(REFS_FILE, 'utf-8'));
    registry = new Map(Object.entries(data.registry || {}));
    counter = data.counter || 0;
  } catch {
    registry = new Map();
    counter = 0;
  }
}

export function saveRefs() {
  ensureStateDir();
  const obj: Record<string, RefEntry> = {};
  for (const [k, v] of registry) obj[k] = v;
  fs.writeFileSync(REFS_FILE, JSON.stringify({ registry: obj, counter }, null, 2));
}

export function clearRefs() {
  registry.clear();
  counter = 0;
  saveRefs();
}

export function registerRef(selector: string, tag: string, text?: string): string {
  // Check if already registered
  for (const [ref, entry] of registry) {
    if (entry.selector === selector) return ref;
  }
  counter++;
  const ref = `@e${counter}`;
  registry.set(ref, { selector, tag, text });
  return ref;
}

export function resolveRef(ref: string): string | undefined {
  if (!ref?.startsWith('@')) return undefined;
  loadRefs();
  return registry.get(ref)?.selector;
}

export function getRefInfo(ref: string): RefEntry | undefined {
  return registry.get(ref);
}
