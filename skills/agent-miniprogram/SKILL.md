---
name: agent-miniprogram
description: Use when the user needs to test, explore, or debug a WeChat miniprogram through the agent-mp CLI and WeChat Developer Tools automation daemon.
allowed-tools: Bash(agent-mp:*), Bash(npx tsx:*), Bash(npm run daemon*)
---

# Agent Miniprogram — Claude Code Skill

## Trigger Conditions

Use this skill when asked to:
- Test, explore, or debug a WeChat miniprogram
- Automate interactions in the WeChat Developer Tools simulator
- Verify miniprogram UI behavior or page data
- Run regression tests on a miniprogram

## Setup

The tool requires:
1. WeChat Developer Tools installed, with "Security Settings → Enable HTTP Calls" turned on
2. The daemon running: `agent-mp daemon`
   - Or if running from source: `npm run daemon`

All commands communicate with the daemon via HTTP at `localhost:9430`.

## CLI Reference

```bash
# Session
agent-mp launch <project-path>     # Launch DevTools + connect
agent-mp connect [--ws <endpoint>] # Connect to already-running DevTools
agent-mp status                    # Show connection status
agent-mp close                     # Close connection

# Inspection
agent-mp snapshot                  # WXML tree with @eN refs (~200-400 tokens)
agent-mp snapshot --data           # Also shows page.data
agent-mp screenshot [--path <f>]   # Save screenshot
agent-mp data [<dot.path>]         # Read page.data
agent-mp diff snapshot             # Diff vs last snapshot

# Navigation
agent-mp navigate <url>            # Navigate to page
agent-mp navigate <url> --type reLaunch|navigateTo|switchTab
agent-mp back                      # Navigate back

# Interaction (use @eN refs from snapshot)
agent-mp tap <@ref|selector>
agent-mp input <@ref|selector> <text>
agent-mp scroll <@ref|selector> --x <n> --y <n>
agent-mp long-press <@ref|selector>
agent-mp swipe <@ref|selector> <up|down|left|right>

# Advanced
agent-mp wait <@ref|ms>            # Wait for element or duration
agent-mp wait --text "some text"   # Wait for text to appear
agent-mp eval "<js code>"          # Run JS in AppService
agent-mp mock <api> '<json>'       # Mock wx.* API

# Record / Replay
agent-mp record start
agent-mp record stop [--output <file.amp>]
agent-mp replay <file.amp>
```

All commands support `--json` for structured output.

## Workflow 1: Exploratory Testing

```bash
# 1. Start session
agent-mp launch /path/to/miniprogram

# 2. Observe current state
agent-mp snapshot

# 3. Interact using refs from snapshot
agent-mp tap @e5         # tap the login button (ref from snapshot)
agent-mp snapshot        # re-snapshot after action

# 4. Fill in forms
agent-mp input @e3 "13800138000"   # phone input
agent-mp input @e4 "password123"   # password input
agent-mp tap @e7                   # tap submit button

# 5. Verify result
agent-mp snapshot --data

# 6. Close
agent-mp close
```

## Workflow 2: Debug Workflow

```bash
agent-mp launch /path/to/miniprogram
agent-mp navigate /pages/product/detail?id=123

# Check page data
agent-mp data

# Execute JS in page context
agent-mp eval "getCurrentPages()[0].data"

# Take screenshot for visual inspection
agent-mp screenshot --path /tmp/debug.png

# Mock an API to test edge case
agent-mp mock request '{"statusCode":200,"data":{"items":[]}}'
agent-mp navigate /pages/list/index --type reLaunch
agent-mp snapshot
```

## Workflow 3: Regression Testing (Record & Replay)

```bash
# Record a user flow
agent-mp launch /path/to/miniprogram
agent-mp record start
agent-mp navigate /pages/index/index
agent-mp tap @e3
agent-mp input @e5 "test@example.com"
agent-mp tap @e7
agent-mp record stop --output tests/login-flow.amp

# Later: replay to verify
agent-mp launch /path/to/miniprogram
agent-mp replay tests/login-flow.amp
agent-mp snapshot --data
```

## Snapshot Format

The `snapshot` command outputs a compact WXML tree:

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

Key rules:
- `@eN` refs are stable within a session — use them instead of selectors
- **After every navigation, run `snapshot` again** — refs reset on each snapshot call
- Elements with `(bindtap)` are tappable
- Elements with `(bindinput)` accept text input

## Best Practices

1. **Always snapshot after navigation** — page content changes, refs reset
2. **Prefer refs over selectors** — `@e5` is cleaner than `.form > input:nth-child(2)`
3. **Use `--data` to debug state** — `agent-mp snapshot --data` shows both UI and data
4. **Use `diff snapshot` for assertions** — run before and after an action to see what changed
5. **Use `eval` for complex assertions** — `agent-mp eval "getCurrentPages()[0].data.loginStatus"`
6. **Mock network calls for deterministic tests** — `agent-mp mock request '...'`
7. **Add `wait` after async operations** — e.g., `agent-mp wait 500` after a form submit

## Error Handling

- `Daemon not running` → run `agent-mp daemon` first
- `Not connected` → run `agent-mp launch <path>` or `agent-mp connect`
- `Element not found: @e5` → snapshot is stale, run `agent-mp snapshot` again
