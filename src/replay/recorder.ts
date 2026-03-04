import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.agent-miniprogram');
const RECORDING_FILE = path.join(STATE_DIR, 'recording.json');

export interface AmpAction {
  method: string;
  params: any;
  timestamp: number;
}

export interface AmpFile {
  version: '1';
  createdAt: string;
  actions: AmpAction[];
}

let recording: AmpAction[] | null = null;
let recordingStartTime: number = 0;

export function startRecording() {
  recording = [];
  recordingStartTime = Date.now();
  fs.writeFileSync(RECORDING_FILE, JSON.stringify({ active: true, startTime: recordingStartTime }));
}

export function recordAction(method: string, params: any) {
  if (!recording) return;
  recording.push({ method, params, timestamp: Date.now() - recordingStartTime });
}

export function stopRecording(outputPath?: string): string {
  if (!recording) throw new Error('Not recording');
  const amp: AmpFile = {
    version: '1',
    createdAt: new Date().toISOString(),
    actions: recording,
  };
  const outFile = outputPath || path.join(process.cwd(), `recording-${Date.now()}.amp`);
  fs.writeFileSync(outFile, JSON.stringify(amp, null, 2));
  recording = null;
  if (fs.existsSync(RECORDING_FILE)) fs.unlinkSync(RECORDING_FILE);
  return outFile;
}

export function isRecording(): boolean {
  return recording !== null;
}

export function loadRecording(): AmpAction[] | null {
  return recording;
}
