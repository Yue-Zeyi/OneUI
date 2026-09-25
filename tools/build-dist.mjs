#!/usr/bin/env node
/* ============================================================
   OwnUI · 构建部署产物（tools/build-dist.mjs）
   ------------------------------------------------------------
   产出两样东西，都在 dist/ 下：

   1. dist/site/           可整站托管的静态根
      · docs/ 的四个页面平铺到根（index.html 成了站点入口）
      · library/ 原样带上
      · 所有 `../library/` 引用重写为 `library/`
        ——包括 docs.js 里 zip 导出的 fetch 路径。这顺带修好一件事：
        本地 file:// 下打不开的 starter.zip，在 http(s) 部署下就能用了。

   2. dist/ownui-standalone.html   单文件版首页
      · 五个 CSS / 四个 JS 全部内联，零外部请求
      · 给 EdgeOne「单 HTML 部署」这类只收一份文档的通道用
      · JS 里字面的 </script> 必须转义成 <\/script，否则内联即断

   用法：node tools/build-dist.mjs（在项目根目录执行）
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const P = process.cwd();
const DOCS = join(P, 'docs');
const LIB = join(P, 'library');
const DIST = join(P, 'dist');
const SITE = join(DIST, 'site');

/* ---------- 工具 ---------- */

/** JS 内联进 <script> 前的转义：字面的 </script> 会提前闭合标签。
    `<\/script` 在 JS 字符串与正则里都等价于 `</script>`，安全。 */
const escJs = (s) => s.replace(/<\/script/gi, '<\\/script');

/** 读一个页面引用的资源，返回 { css, js } 的文件内容 */
function readAsset(href) {
  // 页面里只有两种写法：../library/* 与同目录文件
  const abs = href.startsWith('../library/')
    ? join(LIB, href.slice('../library/'.length))
    : join(DOCS, href);
  return readFileSync(abs, 'utf8');
}

/* ---------- 产物 2：单文件版首页 ---------- */

/** 剔除 docs.js 里 starter.zip 的内嵌模板函数（starterDemo/goldenPage/starterReadme）。
    原因有二，缺一不可：
    1. 单文件部署下 starter.zip 本来就不可用——它靠 fetch('library/…') 读源码，
       而单文件版没有这个目录，fetch 必 404，按钮会自动置灰降级；
    2. EdgeOne「单 HTML 部署」的内容策略会拒绝内嵌完整 HTML 文档字符串的页面
       （实测 300KB 全量版被 policy restrictions 拒收，剔除后即通过）。
    函数体替换为空串实现，调用点（buildStarterZip）保持语法完整。 */
function stripStarterTemplates(js) {
  const names = ['starterDemo', 'goldenPage', 'starterReadme'];
  const lines = js.split('\n');
  const out = [];
  for (let k = 0; k < lines.length;) {
    if (names.some(n => lines[k].includes('function ' + n + '()'))) {
      let depth = 0, started = false;
      while (k < lines.length) {
        depth += (lines[k].match(/\{/g) || []).length - (lines[k].match(/\}/g) || []).length;
        if (lines[k].includes('{')) started = true;
        k++;
        if (started && depth === 0) break;
      }
      out.push("  function removedInStandalone() { return ''; }");
      continue;
    }
    out.push(lines[k]);
    k++;
  }
  return out.join('\n');
}

function buildStandalone() {
  let html = readFileSync(join(DOCS, 'index.html'), 'utf8');

  // CSS：三个 library 链接 + docs.css → 内联 <style>
  html = html.replace(
    /[ \t]*<link rel="stylesheet" href="(\.\.\/library\/[\w.-]+|docs\.css)">\n?/g,
    (m, href) => '<style>\n' + readAsset(href) + '\n</style>\n'
  );

  // JS：components.js / ownui.spec.js / ownui.ai.js / docs.js → 内联 <script>
  html = html.replace(
    /[ \t]*<script src="(\.\.\/library\/[\w.-]+|[\w.-]+\.js)"><\/script>\n?/g,
    (m, src) => {
      let js = readAsset(src);
      if (src === 'docs.js') js = stripStarterTemplates(js);
      return '<script>\n' + escJs(js) + '\n</script>\n';
    }
  );

  // 防呆：不该再剩下任何本地引用
  const leftover = html.match(/(?:src|href)="(\.\.\/|docs\.(?:css|js)|ownui\.(?:spec|ai))/g);
  if (leftover) throw new Error('单文件版仍有外部引用：' + leftover.join(', '));

  writeFileSync(join(DIST, 'ownui-standalone.html'), html);
  console.log('写出 dist/ownui-standalone.html',
    (html.length / 1024).toFixed(1) + ' KB（全部内联，starter 模板已剔除）');
}

/* ---------- 产物 1：整站静态根 ---------- */

const SITE_FILES = [
  'index.html', 'docs.html', 'ai.html', 'check.html',
  'docs.css', 'docs.js', 'ownui.spec.js', 'ownui.ai.js',
  'llms.txt', 'llms-full.txt', 'ownui.spec.json',
];

function buildSite() {
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(join(SITE, 'library'), { recursive: true });

  // library/ 原样拷贝
  for (const f of readdirSync(LIB)) copyFileSync(join(LIB, f), join(SITE, 'library', f));

  // docs/ 平铺到根，HTML/JS 里的 ../library/ 重写为 library/
  for (const f of SITE_FILES) {
    const src = join(DOCS, f);
    if (!existsSync(src)) { console.warn('跳过（不存在）：', f); continue; }
    let text = readFileSync(src, 'utf8');
    if (/\.(html|js)$/.test(f)) text = text.replaceAll('../library/', 'library/');
    writeFileSync(join(SITE, f), text);
  }

  // 防呆：页面里不该再剩 ../ 引用
  for (const f of SITE_FILES) {
    if (!f.endsWith('.html')) continue;
    const t = readFileSync(join(SITE, f), 'utf8');
    if (t.includes('src="../') || t.includes('href="../')) {
      throw new Error(f + ' 仍有 ../ 引用未重写');
    }
  }
  console.log('写出 dist/site/（' + SITE_FILES.length + ' 个页面/资源 + library/ 5 个文件，入口 index.html）');
}

mkdirSync(DIST, { recursive: true });
buildSite();
buildStandalone();
console.log('完成。zip 打包交给 tools/zip-dist.py（Node 手写 zip 不划算）。');
