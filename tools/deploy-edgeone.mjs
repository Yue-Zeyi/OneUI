#!/usr/bin/env node
/* ============================================================
   OneUI · 部署单文件版到 EdgeOne（tools/deploy-edgeone.mjs）
   ------------------------------------------------------------
   为什么不直接用 `mcporter call ... value="$(cat dist/oneui-standalone.html)"`：
   产物 300+ KB，Windows CreateProcess 命令行上限 32 KB，必炸。
   所以这里直接讲 MCP 流式 HTTP 协议（initialize → tools/call），
   payload 从 dist/oneui-standalone.html 读文件，不经过命令行。

   用法：node tools/deploy-edgeone.mjs [html路径]
   ============================================================ */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENDPOINT = 'https://mcp-on-edge.edgeone.app/mcp-server';
const FILE = process.argv[2] || join(process.cwd(), 'dist', 'oneui-standalone.html');
const html = readFileSync(FILE, 'utf8');
console.log('读取', FILE, (html.length / 1024).toFixed(1) + ' KB');

async function post(body, sessionId) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
  const sid = res.headers.get('mcp-session-id');
  const text = await res.text();
  // 响应可能是 JSON，也可能是 SSE（data: 行）
  let json = null;
  try { json = JSON.parse(text); } catch {
    const line = text.split('\n').reverse().find(l => l.startsWith('data:'));
    if (line) { try { json = JSON.parse(line.slice(5).trim()); } catch {} }
  }
  if (!res.ok && !json) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
  return { json, sid };
}

/* 1. initialize —— 拿会话 id */
let { json: init, sid } = await post({
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'oneui-deployer', version: '1.0.0' },
  },
});
if (!init || init.error) throw new Error('initialize 失败: ' + JSON.stringify(init).slice(0, 300));
console.log('会话建立:', sid || '(无 session id，可无状态调用)');

/* 2. initialized 通知（有会话才需要） */
if (sid) {
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, sid);
}

/* 3. tools/call deploy-html */
const { json: result } = await post({
  jsonrpc: '2.0', id: 2, method: 'tools/call',
  params: { name: 'deploy-html', arguments: { value: html } },
}, sid);

if (!result) throw new Error('deploy-html 无响应');
if (result.error) throw new Error('deploy-html 报错: ' + JSON.stringify(result.error).slice(0, 300));

const blocks = result.result?.content || [];
const out = blocks.map(b => b.text || '').join('\n');
console.log('--- EdgeOne 返回 ---');
console.log(out);
const url = out.match(/https?:\/\/[^\s"']+/);
if (url) console.log('DEPLOY_URL=' + url[0]);
else { console.error('未在返回中找到 URL'); process.exit(1); }
