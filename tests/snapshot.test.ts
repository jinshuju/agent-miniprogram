import { describe, it, expect, beforeEach } from 'vitest';
import { parseWxml } from '../src/snapshot/builder.js';
import { clearRefs, registerRef } from '../src/snapshot/refs.js';

// Minimal snapshot builder for tests (avoids file I/O)
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Patch state dir to temp for tests
const TMP = path.join(os.tmpdir(), 'agent-mp-test-' + process.pid);
fs.mkdirSync(TMP, { recursive: true });
process.env['HOME'] = TMP; // redirect ~/ to temp

describe('parseWxml', () => {
  it('parses a simple WXML snippet', () => {
    const wxml = `
      <page>
        <view class="container">
          <text>Hello World</text>
          <button bindtap="onLogin">Login</button>
          <input placeholder="phone" />
          <image src="/img/logo.png" />
          <navigator url="/pages/register/index">Register</navigator>
        </view>
      </page>
    `;
    const tree = parseWxml(wxml);
    expect(tree.tag).toBe('__root__');
    const page = tree.children[0];
    expect(page.tag).toBe('page');
    const container = page.children[0];
    expect(container.tag).toBe('view');
    expect(container.attrs.class).toBe('container');
    expect(container.children).toHaveLength(5);

    const text = container.children[0];
    expect(text.tag).toBe('text');
    expect(text.text).toContain('Hello World');

    const btn = container.children[1];
    expect(btn.tag).toBe('button');
    expect(btn.attrs.bindtap).toBe('onLogin');
    expect(btn.text).toContain('Login');

    const input = container.children[2];
    expect(input.tag).toBe('input');
    expect(input.attrs.placeholder).toBe('phone');
    expect(input.children).toHaveLength(0); // void tag

    const img = container.children[3];
    expect(img.tag).toBe('image');
    expect(img.attrs.src).toBe('/img/logo.png');

    const nav = container.children[4];
    expect(nav.tag).toBe('navigator');
    expect(nav.attrs.url).toBe('/pages/register/index');
  });

  it('handles self-closing void tags', () => {
    const wxml = `<view><input placeholder="test" /><image src="x.png"/></view>`;
    const tree = parseWxml(wxml);
    const view = tree.children[0];
    expect(view.children).toHaveLength(2);
    expect(view.children[0].tag).toBe('input');
    expect(view.children[1].tag).toBe('image');
  });

  it('handles data binding attributes', () => {
    const wxml = `<view><text>{{title}}</text><button bindtap="{{handler}}">OK</button></view>`;
    const tree = parseWxml(wxml);
    const view = tree.children[0];
    expect(view.children[0].text).toContain('{{title}}');
    expect(view.children[1].attrs.bindtap).toBe('{{handler}}');
  });

  it('handles nested views', () => {
    const wxml = `
      <view>
        <view>
          <view>
            <text>Deep text</text>
          </view>
        </view>
      </view>
    `;
    const tree = parseWxml(wxml);
    const l1 = tree.children[0];
    const l2 = l1.children[0];
    const l3 = l2.children[0];
    const t = l3.children[0];
    expect(t.tag).toBe('text');
    expect(t.text).toContain('Deep text');
  });

  it('handles scroll-view with boolean attributes', () => {
    const wxml = `<scroll-view scroll-y><view>item</view></scroll-view>`;
    const tree = parseWxml(wxml);
    const sv = tree.children[0];
    expect(sv.tag).toBe('scroll-view');
    expect('scroll-y' in sv.attrs).toBe(true);
  });
});

describe('snapshot rendering', () => {
  beforeEach(() => {
    clearRefs();
  });

  it('assigns sequential refs, tracking matchIndex for duplicates', () => {
    const r1 = registerRef('.btn', 'button', 'Login');
    const r2 = registerRef('.input', 'input');
    const r3 = registerRef('.btn', 'button', 'Login'); // same selector — gets its own ref
    expect(r1).toBe('@e1');
    expect(r2).toBe('@e2');
    expect(r3).toBe('@e3'); // unique ref, resolved via page.$$()[1]
  });
});
