# Agent Miniprogram

A CLI tool for AI-driven WeChat miniprogram automation testing. Designed for use with AI agents like Claude Code.

Inspired by [Agent Browser](https://github.com/vercel/agent-browser) (ref system, token-efficient snapshots) and [Agent Device](https://github.com/callstack/agent-device) (daemon architecture, SKILL.md, .amp recordings).

## Architecture

```
agent-mp <command>
    │
    ▼ HTTP POST /rpc (localhost:9430)
┌─────────────────────────┐
│   Daemon (Node.js)       │  ~/.agent-miniprogram/daemon.json
│   - session state        │  ~/.agent-miniprogram/refs.json
│   - ref registry         │
└─────────┬───────────────┘
          │ WebSocket
          ▼
  微信开发者工具 (miniprogram-automator)
          │
          ▼
    小程序（模拟器）
```

## Setup

### Prerequisites

1. [WeChat Developer Tools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html) installed
2. In Developer Tools: **Settings → Security → Enable CLI/HTTP calls**
3. Node.js 18+

### Install

```bash
npm install
```

### Start Daemon

```bash
npm run daemon
# or
npx tsx src/daemon/server.ts
```

### Basic Usage

```bash
# Launch DevTools and connect
npx tsx src/cli.ts launch /path/to/miniprogram

# Get snapshot (ref-annotated WXML tree)
npx tsx src/cli.ts snapshot

# Tap an element by ref
npx tsx src/cli.ts tap @e5

# Type into an input
npx tsx src/cli.ts input @e3 "13800138000"
```

## Snapshot Format

`agent-mp snapshot` outputs a compact, ref-annotated tree (~200-400 tokens):

```
Page: /pages/index/index

[view @e1]
  [image @e2] src="/img/logo.png"
  [text @e3] "欢迎登录"
[form @e4]
  [input @e5] placeholder="手机号" (bindinput=onPhoneInput)
  [input @e6] type="password" placeholder="密码" (bindinput=onPasswordInput)
  [button @e7] "登录" (bindtap=onLogin)
[navigator @e8] → /pages/register/index "注册账号"
```

- `@eN` refs are assigned per snapshot call and persist in `~/.agent-miniprogram/refs.json`
- Only semantically meaningful nodes are shown (text, events, attributes)
- Pure layout containers are folded

## Commands

See [skills/agent-miniprogram/SKILL.md](skills/agent-miniprogram/SKILL.md) for the full reference.

| Command | Description |
|---------|-------------|
| `launch <path>` | Launch DevTools and connect |
| `connect` | Connect to running DevTools |
| `close` | Close connection |
| `status` | Show daemon status |
| `snapshot [--data]` | WXML tree with refs |
| `screenshot` | Take screenshot |
| `navigate <url>` | Navigate to page |
| `back` | Go back |
| `tap <ref>` | Tap element |
| `input <ref> <text>` | Type text |
| `scroll <ref>` | Scroll element |
| `long-press <ref>` | Long press |
| `swipe <ref> <dir>` | Swipe gesture |
| `wait <ref\|ms>` | Wait for element or time |
| `data [path]` | Read page.data |
| `eval <code>` | Run JS in AppService |
| `mock <api> <json>` | Mock wx.* API |
| `diff snapshot` | Diff vs last snapshot |
| `record start/stop` | Record interactions |
| `replay <file.amp>` | Replay recording |

## Claude Code Integration

Copy or symlink `skills/agent-miniprogram/SKILL.md` to your Claude Code skills directory, or reference it in your project's `CLAUDE.md`.

## Testing

```bash
npm test
```

## File Paths

- `~/.agent-miniprogram/daemon.json` — daemon runtime state
- `~/.agent-miniprogram/refs.json` — element ref registry
- `~/.agent-miniprogram/last-snapshot.txt` — last snapshot (for diff)
- `~/.agent-miniprogram/screenshot.png` — default screenshot path
