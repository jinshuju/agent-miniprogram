#!/usr/bin/env node
import { program } from 'commander';
import { rpc } from './daemon/client.js';
import { replay } from './replay/player.js';
import * as path from 'path';

program
  .name('agent-mp')
  .description('AI-driven WeChat miniprogram automation CLI')
  .version('0.1.0');

// ─── Global options ────────────────────────────────────────────────────────
program.option('-p, --port <port>', 'daemon port', '9430');
program.option('--json', 'output JSON');

// ─── Daemon ────────────────────────────────────────────────────────────────
program
  .command('daemon')
  .description('Start the daemon server')
  .option('--port <port>', 'port to listen on', '9430')
  .action(async (opts) => {
    process.env.AGENT_MP_PORT = opts.port;
    // Dynamic import to avoid loading automator in CLI process
    await import('./daemon/server.js');
  });

// ─── Session management ────────────────────────────────────────────────────
program
  .command('launch')
  .description('Launch WeChat DevTools and connect')
  .argument('<project-path>', 'path to miniprogram project')
  .option('--ws <endpoint>', 'custom WebSocket endpoint')
  .action(async (projectPath: string, opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('launch', {
        projectPath: path.resolve(projectPath),
        wsEndpoint: opts.ws,
      }, port);
      output({ ok: true, ...result }, 'Launched successfully');
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('connect')
  .description('Connect to already-running WeChat DevTools')
  .option('--ws <endpoint>', 'WebSocket endpoint', 'ws://localhost:9420')
  .action(async (opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('connect', { wsEndpoint: opts.ws }, port);
      output(result, 'Connected');
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('close')
  .description('Close the miniprogram connection')
  .action(async () => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('close', {}, port);
      output(result, 'Closed');
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('status')
  .description('Show daemon connection status')
  .action(async () => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('status', {}, port);
      output(result, result.connected ? `Connected — ${result.currentPage}` : 'Not connected');
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Inspection ────────────────────────────────────────────────────────────
program
  .command('snapshot')
  .description('Generate ref-annotated WXML tree')
  .option('--data', 'also output page.data')
  .action(async (opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('snapshot', { data: opts.data }, port);
      if (program.opts().json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(result.snapshot);
      }
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('screenshot')
  .description('Take a screenshot')
  .option('--path <file>', 'save path')
  .action(async (opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('screenshot', { path: opts.path }, port);
      output(result, `Screenshot saved: ${result.path}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('data [dot-path]')
  .description('Read page.data (or a specific key path)')
  .action(async (dotPath?: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('data', { path: dotPath }, port);
      if (program.opts().json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(JSON.stringify(result.data, null, 2));
      }
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('diff')
  .description('Diff current snapshot against last snapshot')
  .argument('[target]', 'target (only "snapshot" supported)', 'snapshot')
  .action(async (_target: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('diff', {}, port);
      if (program.opts().json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(result.diff);
      }
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Navigation ────────────────────────────────────────────────────────────
program
  .command('navigate')
  .description('Navigate to a page')
  .argument('<url>', 'page path, e.g. /pages/index/index')
  .option('--type <type>', 'navigation type: navigateTo|reLaunch|switchTab', 'navigateTo')
  .action(async (url: string, opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('navigate', { url, type: opts.type }, port);
      output(result, `Navigated to ${url}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('back')
  .description('Navigate back')
  .action(async () => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('back', {}, port);
      output(result, 'Navigated back');
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Interaction ────────────────────────────────────────────────────────────
program
  .command('tap')
  .description('Tap an element')
  .argument('<ref>', 'ref (@eN) or CSS selector')
  .action(async (ref: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('tap', { ref }, port);
      output(result, `Tapped ${ref}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('input')
  .description('Type text into an input element')
  .argument('<ref>', 'ref (@eN) or CSS selector')
  .argument('<text>', 'text to type')
  .action(async (ref: string, text: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('input', { ref, text }, port);
      output(result, `Input "${text}" into ${ref}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('scroll')
  .description('Scroll an element')
  .argument('<ref>', 'ref (@eN) or CSS selector')
  .option('--x <n>', 'scroll x offset', '0')
  .option('--y <n>', 'scroll y offset', '0')
  .action(async (ref: string, opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('scroll', { ref, x: parseInt(opts.x), y: parseInt(opts.y) }, port);
      output(result, `Scrolled ${ref}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('long-press')
  .description('Long press an element')
  .argument('<ref>', 'ref (@eN) or CSS selector')
  .action(async (ref: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('longPress', { ref }, port);
      output(result, `Long-pressed ${ref}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('swipe')
  .description('Swipe within an element')
  .argument('<ref>', 'ref (@eN) or CSS selector')
  .argument('<direction>', 'up|down|left|right')
  .action(async (ref: string, direction: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('swipe', { ref, direction }, port);
      output(result, `Swiped ${direction} on ${ref}`);
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Advanced ────────────────────────────────────────────────────────────
program
  .command('wait')
  .description('Wait for an element, text, or duration (ms)')
  .argument('<target>', 'ref (@eN), selector, milliseconds, or --text value')
  .option('--text <t>', 'wait for text to appear')
  .action(async (target: string, opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const ms = parseInt(target, 10);
      let params: any;
      if (!isNaN(ms) && String(ms) === target) {
        params = { ms };
      } else if (opts.text) {
        params = { text: opts.text };
      } else if (target.startsWith('@')) {
        params = { ref: target };
      } else {
        params = { selector: target };
      }
      const result = await rpc('wait', params, port);
      output(result, 'Done waiting');
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('eval')
  .description('Evaluate JS code in AppService context')
  .argument('<code>', 'JavaScript code to execute')
  .action(async (code: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('eval', { code }, port);
      if (program.opts().json) {
        console.log(JSON.stringify(result));
      } else {
        console.log(JSON.stringify(result.result, null, 2));
      }
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('mock')
  .description('Mock a wx.* API with a JSON response')
  .argument('<api>', 'API name, e.g. request')
  .argument('<json-response>', 'JSON string')
  .action(async (api: string, jsonResponse: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      let response: any;
      try {
        response = JSON.parse(jsonResponse);
      } catch {
        die(`Invalid JSON: ${jsonResponse}`);
      }
      const result = await rpc('mock', { api, response }, port);
      output(result, `Mocked wx.${api}`);
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Record / Replay ──────────────────────────────────────────────────────
const recordCmd = program
  .command('record')
  .description('Record and replay interactions');

recordCmd
  .command('start')
  .description('Start recording')
  .action(async () => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('recordStart', {}, port);
      output(result, 'Recording started');
    } catch (err: any) {
      die(err.message);
    }
  });

recordCmd
  .command('stop')
  .description('Stop recording and save to .amp file')
  .option('--output <file>', 'output file path')
  .action(async (opts) => {
    const port = parseInt(program.opts().port, 10);
    try {
      const result = await rpc('recordStop', { output: opts.output }, port);
      output(result, `Recording saved: ${result.path}`);
    } catch (err: any) {
      die(err.message);
    }
  });

program
  .command('replay')
  .description('Replay an .amp recording file')
  .argument('<file>', 'path to .amp file')
  .action(async (file: string) => {
    const port = parseInt(program.opts().port, 10);
    try {
      await replay(file, { port });
    } catch (err: any) {
      die(err.message);
    }
  });

// ─── Helpers ──────────────────────────────────────────────────────────────
function output(data: any, text: string) {
  if (program.opts().json) {
    console.log(JSON.stringify(data));
  } else {
    console.log(text);
  }
}

function die(msg: string): never {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

program.parse(process.argv);
