#!/usr/bin/env node
/* ============================================================
   OneUI · 生成 AI 交付物（tools/build-ai-files.mjs）
   ------------------------------------------------------------
   这是 dev 工具，不属于库本身：library/ 里不会出现它，接入方也不需要它。
   它做两件事：

   1. 从 docs/oneui.spec.js 生成四份产物
        AGENTS.md            （仓库根）
        docs/llms.txt
        docs/llms-full.txt
        docs/oneui.spec.json

   2. 对账：把 spec 里声明过的 ui-* 类名拿去 library/*.css 里逐个核对。
      · 正向（spec 声明了、CSS 里没有）→ 直接失败，退出码 1。
        这是最危险的一种：AI 照着一个不存在的类名写，页面静默变形。
      · 反向（CSS 里有、spec 没提）→ 只报告覆盖率。
        spec 有意只写到组件基类，不逐个列子元素，所以这部分不等于缺陷。

   用法：node tools/build-ai-files.mjs [--check]
         --check 只校验不写文件，用于 CI / 提交前。
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECK_ONLY = process.argv.includes('--check');

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. 在沙箱里加载 spec 与渲染器 ---------- */
/* 两个文件都是 UMD 风格（挂到 global），所以给个假 window 就能在 node 里跑。
   不能用 import：它们是给浏览器 <script> 直接引的，没有模块导出。 */
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
for (const f of ['docs/oneui.spec.js', 'docs/oneui.ai.js']) {
  vm.runInContext(read(f), sandbox, { filename: f });
}
const spec = sandbox.window.OneUISpec;
const ai = sandbox.window.OneUIAI;
if (!spec) throw new Error('docs/oneui.spec.js 没有挂上 window.OneUISpec');
if (!ai) throw new Error('docs/oneui.ai.js 没有挂上 window.OneUIAI');

/* ---------- 2. 类名对账 ---------- */
const ccs = ['library/components.css', 'library/base.css']
  .map((f) => read(f))
  .join('\n');
const cssClasses = new Set(ccs.match(/\.(ui-[a-zA-Z0-9_-]+)/g).map((s) => s.slice(1)));

const declared = ai.declaredClasses(spec);
const missing = declared.filter((c) => !cssClasses.has(c));
const uncovered = [...cssClasses].filter((c) => !declared.includes(c)).sort();

/* ---------- 3. 生成产物 ---------- */
const artifacts = [
  ['AGENTS.md', ai.renderAgentsMd(spec)],
  ['docs/llms.txt', ai.renderLlmsTxt(spec)],
  ['docs/llms-full.txt', ai.renderLlmsFull(spec)],
  ['docs/oneui.spec.json', ai.renderSpecJson(spec)],
];

/* ---------- 4. 报告 ---------- */
const pad = (s, n) => String(s).padEnd(n, ' ');
console.log('OneUI · 生成 AI 交付物');
console.log('─'.repeat(54));
console.log(`spec 版本        ${spec.version}`);
console.log(`组件契约         core ${pad(spec.components.core.length, 3)} · more ${spec.components.more.length}`);
console.log(`声明类名         ${declared.length} 个`);
console.log(`CSS 实际类名     ${cssClasses.size} 个`);
console.log(`覆盖率           ${(100 - (uncovered.length / cssClasses.size) * 100).toFixed(1)}%`);
console.log('─'.repeat(54));

if (missing.length) {
  console.error(`\n✗ 以下 ${missing.length} 个类名在 spec 里声明了，但 library/*.css 里不存在：`);
  missing.forEach((c) => console.error(`    ${c}`));
  console.error('\n  这类问题最危险：AI 会照抄一个不存在的类名，页面静默变形。请修 docs/oneui.spec.js。');
  process.exit(1);
}
console.log('✓ 正向对账通过：spec 声明的类名全部真实存在');

if (uncovered.length) {
  console.log(`\n· 反向：${uncovered.length} 个类名未被 spec 提及（子元素为主，不视为缺陷）：`);
  const line = uncovered.join(' ');
  /* 折行输出，免得刷屏 */
  const width = 92;
  for (let i = 0; i < line.length; i += width) console.log('    ' + line.slice(i, i + width));
}

if (CHECK_ONLY) {
  console.log('\n--check 模式：不写文件。');
  process.exit(0);
}

for (const [rel, content] of artifacts) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  const kb = (Buffer.byteLength(content, 'utf8') / 1024).toFixed(1);
  console.log(`  写出 ${pad(rel, 24)} ${pad(content.split('\n').length + ' 行', 9)} ${kb} KB`);
}
console.log('\n完成。');
