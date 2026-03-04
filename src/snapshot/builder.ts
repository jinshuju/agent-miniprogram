import { clearRefs, registerRef, saveRefs, loadRefs } from './refs.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const STATE_DIR = path.join(os.homedir(), '.agent-miniprogram');
const LAST_SNAPSHOT_FILE = path.join(STATE_DIR, 'last-snapshot.txt');

const LAYOUT_TAGS = new Set(['view', 'block', 'cover-view']);

const EVENT_PREFIXES = [
  'bindtap', 'bind:tap', 'catchtap', 'catch:tap',
  'bindinput', 'bind:input', 'bindchange', 'bind:change',
  'bindsubmit', 'bind:submit', 'bindscroll', 'bind:scroll',
  'bindconfirm', 'bind:confirm', 'bindfocus', 'bind:focus',
  'bindblur', 'bind:blur', 'bindlongpress', 'bind:longpress',
  'bindgetuserinfo', 'bindgetphonenumber',
];

export interface SnapshotOptions {
  includeData?: boolean;
}

export interface SnapshotResult {
  snapshot: string;
  page: string;
}

// ─── WXML tree ────────────────────────────────────────────────────────────────

interface WxmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: WxmlNode[];
  text: string;
}

// ─── WXML parser ─────────────────────────────────────────────────────────────

function findTagEnd(s: string, start: number): number {
  let i = start + 1;
  let inStr = false;
  let strChar = '';
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      if (c === strChar) inStr = false;
    } else {
      if (c === '"' || c === "'") { inStr = true; strChar = c; }
      else if (c === '>') return i;
    }
    i++;
  }
  return s.length - 1;
}

function parseAttrs(str: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let i = 0;
  while (i < str.length) {
    while (i < str.length && /\s/.test(str[i])) i++;
    if (i >= str.length) break;

    let nameStart = i;
    while (i < str.length && !/[\s=/>]/.test(str[i])) i++;
    const name = str.slice(nameStart, i).trim();
    if (!name) { i++; continue; }

    while (i < str.length && /\s/.test(str[i])) i++;

    if (str[i] !== '=') {
      attrs[name] = '';
      continue;
    }
    i++;
    while (i < str.length && /\s/.test(str[i])) i++;

    if (str[i] === '"' || str[i] === "'") {
      const q = str[i++];
      let val = '';
      while (i < str.length && str[i] !== q) val += str[i++];
      i++;
      attrs[name] = val;
    } else {
      let val = '';
      while (i < str.length && !/[\s/>]/.test(str[i])) val += str[i++];
      attrs[name] = val;
    }
  }
  return attrs;
}

type Token =
  | { type: 'open'; tag: string; attrs: Record<string, string>; selfClose: boolean }
  | { type: 'close'; tag: string }
  | { type: 'text'; content: string };

// Self-closing WXML tags that never have children
const VOID_TAGS = new Set([
  'image', 'input', 'textarea', 'progress', 'slider', 'switch',
  'icon', 'radio', 'checkbox', 'editor', 'map', 'canvas', 'camera',
  'live-player', 'live-pusher', 'official-account', 'open-data', 'web-view',
]);

function tokenize(wxml: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < wxml.length) {
    if (wxml[i] !== '<') {
      let end = wxml.indexOf('<', i);
      if (end === -1) end = wxml.length;
      const text = wxml.slice(i, end);
      if (text.trim()) tokens.push({ type: 'text', content: text.trim() });
      i = end;
      continue;
    }

    if (wxml[i + 1] === '!' || wxml[i + 1] === '?') {
      const end = wxml.indexOf('>', i);
      i = end === -1 ? wxml.length : end + 1;
      continue;
    }

    const tagEnd = findTagEnd(wxml, i);
    const raw = wxml.slice(i + 1, tagEnd).trim();

    if (raw.startsWith('/')) {
      tokens.push({ type: 'close', tag: raw.slice(1).trim().toLowerCase() });
    } else {
      const selfCloseSlash = raw.endsWith('/');
      const content = selfCloseSlash ? raw.slice(0, -1).trim() : raw;
      const spaceIdx = content.search(/\s/);
      const tag = (spaceIdx === -1 ? content : content.slice(0, spaceIdx)).toLowerCase();
      const attrStr = spaceIdx === -1 ? '' : content.slice(spaceIdx);
      const attrs = parseAttrs(attrStr);
      const selfClose = selfCloseSlash || VOID_TAGS.has(tag);
      tokens.push({ type: 'open', tag, attrs, selfClose });
    }

    i = tagEnd + 1;
  }

  return tokens;
}

function buildTree(tokens: Token[]): WxmlNode {
  const root: WxmlNode = { tag: '__root__', attrs: {}, children: [], text: '' };
  const stack: WxmlNode[] = [root];

  for (const tok of tokens) {
    const parent = stack[stack.length - 1];

    if (tok.type === 'text') {
      if (parent.children.length > 0) {
        parent.children[parent.children.length - 1].text += ' ' + tok.content;
      } else {
        parent.text += tok.content;
      }
    } else if (tok.type === 'open') {
      const node: WxmlNode = { tag: tok.tag, attrs: tok.attrs, children: [], text: '' };
      parent.children.push(node);
      if (!tok.selfClose) stack.push(node);
    } else {
      // close: pop to matching open
      for (let j = stack.length - 1; j >= 1; j--) {
        if (stack[j].tag === tok.tag) {
          stack.splice(j);
          break;
        }
      }
    }
  }

  return root;
}

export function parseWxml(wxml: string): WxmlNode {
  return buildTree(tokenize(wxml));
}

// ─── Snapshot rendering ───────────────────────────────────────────────────────

function getEventBindings(attrs: Record<string, string>): string[] {
  const seen = new Set<string>();
  return Object.keys(attrs)
    .filter(k => EVENT_PREFIXES.some(p => k === p || k.startsWith(p + '=')))
    .map(k => {
      const handler = attrs[k];
      let label: string;
      if (k.includes('tap')) label = `bindtap=${handler}`;
      else if (k.includes('input')) label = `bindinput=${handler}`;
      else if (k.includes('change')) label = `bindchange=${handler}`;
      else if (k.includes('submit')) label = `bindsubmit=${handler}`;
      else if (k.includes('longpress')) label = `bindlongpress=${handler}`;
      else label = `${k.replace('bind:', 'bind')}=${handler}`;
      if (seen.has(label)) return '';
      seen.add(label);
      return label;
    })
    .filter(Boolean);
}

function getImportantAttrs(tag: string, attrs: Record<string, string>): string[] {
  const out: string[] = [];
  if (tag === 'navigator') {
    if (attrs.url) { out.push(`→ ${attrs.url}`); return out; }
  }
  if (attrs.src) out.push(`src="${attrs.src}"`);
  if (attrs.url) out.push(`url="${attrs.url}"`);
  if (attrs.href) out.push(`href="${attrs.href}"`);
  if (attrs.placeholder) out.push(`placeholder="${attrs.placeholder}"`);
  if (attrs.value) out.push(`value="${attrs.value}"`);
  if ((tag === 'input' || tag === 'textarea') && attrs.type) out.push(`type="${attrs.type}"`);
  if (tag === 'scroll-view') {
    if ('scroll-y' in attrs) out.push('scroll-y');
    if ('scroll-x' in attrs) out.push('scroll-x');
  }
  if (attrs['open-type']) out.push(`open-type="${attrs['open-type']}"`);
  return out;
}

function isInteresting(node: WxmlNode): boolean {
  const tag = node.tag;
  if (!tag || tag === '__root__' || tag === 'wxs') return false;
  if (!LAYOUT_TAGS.has(tag)) return true;
  if (node.text.trim()) return true;
  if (getEventBindings(node.attrs).length > 0) return true;
  if (getImportantAttrs(tag, node.attrs).length > 0) return true;
  return node.children.some(c => isInteresting(c));
}

/**
 * Build a CSS selector for this element.
 *
 * Priority:
 *   1. #id
 *   2. tag.class1.class2 (up to 2 classes)
 *   3. parentCssPath > tag:nth-child(n)
 *
 * The result is stored in refs.json and used by the daemon with page.$().
 */
function buildCssSelector(
  tag: string,
  attrs: Record<string, string>,
  childIndex: number,   // 0-based index among ALL parent's children
  parentCss: string,
): string {
  if (attrs.id) return `#${attrs.id}`;

  let segment: string;
  if (attrs.class) {
    const classes = attrs.class.trim().split(/\s+/).slice(0, 2).map(c => `.${c}`).join('');
    segment = `${tag}${classes}`;
  } else {
    // nth-child is 1-based in CSS
    segment = `${tag}:nth-child(${childIndex + 1})`;
  }

  return parentCss ? `${parentCss} > ${segment}` : segment;
}

function renderNode(
  node: WxmlNode,
  indent: number,
  childIndex: number,
  parentCss: string,
  lines: string[],
) {
  const tag = node.tag;
  const text = node.text.trim();
  const events = getEventBindings(node.attrs);
  const importantAttrs = getImportantAttrs(tag, node.attrs);
  const css = buildCssSelector(tag, node.attrs, childIndex, parentCss);
  const ref = registerRef(css, tag, text || undefined);

  let line = `${'  '.repeat(indent)}[${tag} ${ref}]`;
  if (importantAttrs.length) line += ' ' + importantAttrs.join(' ');
  if (text) line += ` "${text}"`;
  if (events.length) line += ' (' + events.join(', ') + ')';
  lines.push(line);

  node.children.forEach((child, i) => {
    if (isInteresting(child)) {
      renderNode(child, indent + 1, i, css, lines);
    }
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function buildSnapshot(page: any, opts: SnapshotOptions): Promise<SnapshotResult> {
  loadRefs();
  clearRefs();

  const pagePath = (page.path || 'unknown').replace(/^\//, '');
  const lines: string[] = [`Page: /${pagePath}`, ''];

  let wxmlStr = '';
  try {
    wxmlStr = await fetchPageWxml(page);
  } catch (err: any) {
    lines.push(`(snapshot error: ${err.message})`);
    return finalize(lines, pagePath);
  }

  if (!wxmlStr.trim()) {
    lines.push('(empty page)');
    return finalize(lines, pagePath);
  }

  const tree = parseWxml(wxmlStr);

  // The WXML from `page.$('page').outerWxml()` wraps content in <page>.
  // Skip that root wrapper so we render its children at indent 0.
  const topNodes =
    tree.tag === '__root__'
      ? (tree.children[0]?.tag === 'page' ? tree.children[0].children : tree.children)
      : tree.tag === 'page'
        ? tree.children
        : [tree];

  topNodes.forEach((child, i) => {
    if (isInteresting(child)) {
      // top-level children of <page> — use "page > tag:nth-child(n)" as root selector
      renderNode(child, 0, i, 'page', lines);
    }
  });

  if (opts.includeData) {
    try {
      const data = await page.data();
      lines.push('');
      lines.push(`data: ${JSON.stringify(data).slice(0, 500)}`);
    } catch { /* ignore */ }
  }

  saveRefs();
  return finalize(lines, pagePath);
}

async function fetchPageWxml(page: any): Promise<string> {
  // Strategy 1: page.$('page') – standard miniprogram root
  try {
    const rootEl = await page.$('page');
    if (rootEl) return await rootEl.outerWxml();
  } catch { /* fall through */ }

  // Strategy 2: direct children of page
  try {
    const children = await page.$$('page > *');
    if (children?.length) {
      const parts: string[] = await Promise.all(
        children.map((el: any) => el.outerWxml().catch(() => ''))
      );
      return parts.join('\n');
    }
  } catch { /* fall through */ }

  // Strategy 3: first element on page
  try {
    const all = await page.$$('*');
    if (all?.length) return await all[0].outerWxml();
  } catch { /* fall through */ }

  return '';
}

function finalize(lines: string[], pagePath: string): SnapshotResult {
  const snapshot = lines.join('\n');
  fs.mkdirSync(path.dirname(LAST_SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(LAST_SNAPSHOT_FILE, snapshot);
  return { snapshot, page: pagePath };
}
