/* ============================================================
   OneUI · AI 交付物渲染器（oneui.ai.js）
   ------------------------------------------------------------
   把 oneui.spec.js 渲染成四份产物：

     AGENTS.md        —— 规则与禁止清单，AI 在本仓库里工作会自动读到
     llms.txt         —— 索引，遵循 llmstxt.org 约定
     llms-full.txt    —— 上面几份拼成一整份，用于一次性喂给 AI
     oneui.spec.json  —— 机器读的完整契约

   为什么要有这个渲染器而不是直接写死四份文件：
   写死的版本迟早会与 spec 脱节，而「规范说 A、代码是 B」比没有规范更危险。
   现在仓库里的文件（tools/build-ai-files.mjs 调这里生成）与导出 zip 里
   的（ai.html 调这里生成）走的是同一个函数，不可能不一致。

   本文件同时跑在浏览器与 node 里，所以只用 ES5+模板字符串，不碰 node API。
   ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 小工具 ---------- */

  function table(head, rows) {
    var out = ['| ' + head.join(' | ') + ' |', '|' + head.map(function () { return '---'; }).join('|') + '|'];
    rows.forEach(function (r) { out.push('| ' + r.join(' | ') + ' |'); });
    return out.join('\n');
  }

  /* markdown 表格里竖线会把单元格劈开，转义掉 */
  function cell(s) {
    return String(s === undefined || s === null ? '' : s).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  }

  function bulletList(items) {
    return items.map(function (s) { return '- ' + s; }).join('\n');
  }

  function code(lang, body) {
    return '```' + (lang || '') + '\n' + body + '\n```';
  }

  /* 收集 spec 里出现过的全部 ui-* 类名。构建脚本用它和 components.css 对账。

     正则前面那道 (?<![a-z-]) 是必须的：没有它，data-ui-close 里的
     "ui-close" 会被当成一个类名，对账时误报「声明了但 CSS 里没有」。
     类名的真实左边界只可能是引号、点、空格或字符串开头，不可能是连字符。
     另外先去掉 --ui-* 的 token 引用，否则 --ui-space-4 也会被误当成类名。 */
  function declaredClasses(spec) {
    var seen = {};
    (function walk(node) {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') {
        var s = node.replace(/--ui-[a-z0-9-]+/g, ' ');
        var m = s.match(/(?<![a-z-])ui-[a-z0-9_-]+/g);
        if (m) m.forEach(function (c) { seen[c] = true; });
        return;
      }
      if (Object.prototype.toString.call(node) === '[object Array]') {
        node.forEach(walk);
        return;
      }
      if (typeof node === 'object') {
        Object.keys(node).forEach(function (k) { walk(node[k]); });
      }
    })(spec);
    return Object.keys(seen).sort();
  }

  /* ---------- 组件速查（core + more 合并成一张表） ---------- */

  function allComponents(spec) {
    var list = [];
    spec.components.core.forEach(function (c) {
      list.push({ base: c.base, title: c.title, useWhen: c.useWhen, level: 'core', id: c.id });
    });
    spec.components.more.forEach(function (c) {
      list.push({ base: c.base, title: c.title, useWhen: c.note, level: 'more' });
    });
    return list;
  }

  /* ---------- AGENTS.md ---------- */

  function renderAgentsMd(spec) {
    var L = [];
    var S = spec;

    L.push('# OneUI 使用规范');
    L.push('');
    L.push('> 在本项目里写任何界面代码之前，先读完这一份。');
    L.push('> 它比通读 `components.css`（1500 行）快，也比凭经验猜准。');
    L.push('');
    L.push('适用于 ' + S.name + ' v' + S.version + '。' + S.summary);
    L.push('');

    /* --- 引入 --- */
    L.push('## 1. 先按这个顺序引入，缺一不可');
    L.push('');
    L.push(code('html', S.load.snippet));
    L.push('');
    L.push(S.load.note);
    L.push('');

    /* --- 禁止 --- */
    L.push('## 2. 禁止清单');
    L.push('');
    L.push('这一节最先读。下面每一条都被真实写错过 —— 不是风格偏好，是「写了就不生效」或「写了就出错」。');
    L.push('');
    L.push(table(['不要写', '为什么', '改成'], S.forbidden.map(function (f) {
      return [cell('`' + f.bad + '`'), cell(f.why), cell(f.fix)];
    })));
    L.push('');

    /* --- 必须 --- */
    L.push('## 3. 必须做的事');
    L.push('');
    L.push(table(['规则', '漏了的后果'], S.required.map(function (r) {
      return [cell(r.rule), cell(r.why)];
    })));
    L.push('');

    /* --- Token --- */
    L.push('## 4. Token：只用 L2 语义层');
    L.push('');
    L.push('三层结构，你自己的样式里应该只出现中间那层。');
    L.push('');
    L.push(table(['层', '名字', '前缀', '作用', '你什么时候碰它'], S.tokens.layers.map(function (t) {
      return [t.id, t.name, '`' + t.prefix + '`', cell(t.role), cell(t.useIn)];
    })));
    L.push('');
    L.push('**' + S.tokens.priority + '**');
    L.push('');
    L.push('常用语义 token：');
    L.push('');
    L.push(table(['token', '用途'], S.tokens.common.map(function (t) {
      return ['`' + t.token + '`', cell(t.use)];
    })));
    L.push('');

    /* --- 状态方向 --- */
    L.push('## 5. 状态方向（猜不到，照抄）');
    L.push('');
    L.push(S.stateDirection.summary);
    L.push('');
    L.push(table(['档位', '角色'], S.stateDirection.ramp.map(function (r) {
      return ['`--ui-p-' + r.step + '`', cell(r.role)];
    })));
    L.push('');
    L.push(bulletList(S.stateDirection.exceptions));
    L.push('');

    /* --- 刻度 --- */
    L.push('## 6. 刻度：不要自由取值');
    L.push('');
    L.push('### 间距（' + S.scales.space.base + 'pt 基准）');
    L.push('');
    L.push(S.scales.space.note);
    L.push('');
    L.push(table(['token', '值', '典型用途'], S.scales.space.steps.map(function (s) {
      return ['`' + s.token + '`', s.px + 'px', cell(s.use)];
    })));
    L.push('');
    L.push('### 圆角');
    L.push('');
    L.push(S.scales.radius.note);
    L.push('');
    L.push(table(['token', '值', '用途'], S.scales.radius.steps.map(function (s) {
      return ['`' + s.token + '`', s.px + 'px', cell(s.use)];
    })));
    L.push('');
    L.push('### 字阶');
    L.push('');
    L.push(S.scales.fontSize.note);
    L.push('');
    L.push(table(['档位 token', '值', '语义 token', '用途'], S.scales.fontSize.steps.map(function (s) {
      return ['`' + s.token + '`', s.px + 'px', s.semantic ? '`' + s.semantic + '`' : '—', cell(s.use)];
    })));
    L.push('');

    /* --- 布局 --- */
    L.push('## 7. 布局：用现成的工具类');
    L.push('');
    L.push('最容易犯的错是自己写 `display: flex` 加 `margin`。本库已经有这些：');
    L.push('');
    L.push(table(['类名', '用途'], S.layout.map(function (l) {
      return ['`' + l.cls + '`', cell(l.use)];
    })));
    L.push('');

    /* --- 排版 --- */
    L.push('### 排版与文字');
    L.push('');
    L.push('别自己拼 `font-size` + `color`，这些类已经把字号、行高、色阶配好了。');
    L.push('');
    L.push(table(['类名', '用途'], S.text.map(function (t) {
      return ['`' + t.cls + '`', cell(t.use)];
    })));
    L.push('');

    /* --- 决策 --- */
    L.push('## 8. 什么场景用什么');
    L.push('');
    L.push('类名往往能写对，选错容器才是更常见的错。');
    L.push('');
    L.push(table(['场景', '用', '不要用'], S.decisions.map(function (d) {
      return [cell(d.scene), cell(d.use), cell(d.avoid)];
    })));
    L.push('');

    /* --- 组件速查 --- */
    L.push('## 9. 组件速查');
    L.push('');
    L.push('标记 ★ 的是高频组件，下面第 10 节给了完整片段；其余照抄结构即可。');
    L.push('');
    L.push(table(['基类', '组件', '用途'], allComponents(spec).map(function (c) {
      return ['`' + c.base + '`' + (c.level === 'core' ? ' ★' : ''), c.title, cell(c.useWhen)];
    })));
    L.push('');

    /* --- 片段 --- */
    L.push('## 10. 常用片段（照抄）');
    L.push('');
    S.components.core.forEach(function (c) {
      L.push('### ' + c.title + ' · `' + c.base + '`');
      L.push('');
      L.push('用它的时机：' + c.useWhen + '。');
      if (c.notWhen) L.push('不要用它的时机：' + c.notWhen + '。');
      L.push('');
      if (c.variants && c.variants.length) {
        L.push(table(['变体', '什么时候用'], c.variants.map(function (v) {
          return ['`' + v.cls + '`', cell(v.when)];
        })));
        L.push('');
      }
      L.push(code('html', c.snippet));
      L.push('');
      if (c.attrs && c.attrs.length) {
        L.push('关键属性：');
        L.push('');
        L.push(bulletList(c.attrs.map(function (a) { return '`' + a.attr + '` —— ' + a.why; })));
        L.push('');
      }
      if (c.aria && c.aria.length) {
        L.push('无障碍：' + c.aria.join('；') + '。');
        L.push('');
      }
      if (c.events && c.events.length) {
        L.push('事件：' + c.events.map(function (e) { return '`' + e.name + '`（' + e.when + '）'; }).join('、') + '。');
        L.push('');
      }
      if (c.api && c.api.length) {
        L.push('API：' + c.api.map(function (a) { return '`' + a + '`'; }).join('、') + '。');
        L.push('');
      }
    });

    /* --- 行为钩子 --- */
    L.push('## 11. 行为钩子（data-ui）');
    L.push('');
    L.push('声明式交互全靠这些属性。挂错元素是「没反应」的头号原因。');
    L.push('');
    L.push(table(['属性', '挂在哪', '说明'], S.behaviors.map(function (b) {
      return ['`' + b.attr + '`', cell(b.on), cell(b.note)];
    })));
    L.push('');

    /* --- 事件 --- */
    L.push('## 12. 事件');
    L.push('');
    L.push('所有行为都通过 `ui:*` 自定义事件对外广播，冒泡到 `document`。在 Vue / React / Svelte 里直接用原生事件监听接管，不需要再包一层。');
    L.push('');
    L.push(table(['事件', '载荷', '来源', '触发时机'], S.events.map(function (e) {
      return ['`' + e.name + '`', '`' + e.payload + '`', cell(e.from), cell(e.when)];
    })));
    L.push('');

    /* --- API --- */
    L.push('## 13. 命令式 API');
    L.push('');
    L.push(table(['调用', '用途'], S.api.map(function (a) {
      return ['`' + a.call + '`', cell(a.use)];
    })));
    L.push('');
    L.push('动态插入 DOM 之后要调一次 `UI.init(container)`，否则新节点上的组件不会初始化。');
    L.push('');

    /* --- 收尾 --- */
    L.push('## 14. 写完自查');
    L.push('');
    L.push(bulletList([
      '有没有出现第 2 节禁止清单里的东西？',
      '颜色是不是都用 `var(--ui-*)`，没有裸 hex？',
      '间距、圆角、字号是不是都在刻度上？',
      '弹层是不是用了 `.ui-modal` / `.ui-drawer`，而不是自己写 `position: fixed`？',
      '带 `data-ui` 的元素是不是配对属性都写全了（`data-target` / `data-ui="…-trigger"`）？',
      '弹层有没有 `role="dialog"` `aria-modal="true"` `aria-labelledby`？',
      '纯图标按钮有没有 `aria-label`？',
      '颜色是不是唯一的信息载体？（状态点旁要有文字）'
    ]));
    L.push('');

    return L.join('\n');
  }

  /* ---------- llms.txt（llmstxt.org 约定） ---------- */

  function renderLlmsTxt(spec) {
    var S = spec;
    var L = [];
    L.push('# ' + S.name);
    L.push('');
    L.push('> ' + S.tagline + '。' + S.summary);
    L.push('');
    L.push('引入三个 CSS 文件和一个 JS 文件即可用，Vue / React / Svelte / 原生页面 / 服务端模板都一样。');
    L.push('下面的路径都相对于仓库根目录。');
    L.push('');
    L.push('## 文档');
    L.push('');
    L.push('- [AGENTS.md](AGENTS.md)：规则与禁止清单。写代码前先读这一份。');
    L.push('- [oneui.spec.json](oneui.spec.json)：完整组件契约（机器读）。');
    L.push('');
    L.push('## 源码');
    L.push('');
    L.push('- [tokens.css](library/tokens.css)：设计 Token，三层结构的 L1 与 L2');
    L.push('- [base.css](library/base.css)：重置、排版、布局、工具类');
    L.push('- [components.css](library/components.css)：全部组件样式');
    L.push('- [components.js](library/components.js)：行为层，原生 JS');
    L.push('');
    L.push('## 最容易做错的事');
    L.push('');
    S.forbidden.slice(0, 4).forEach(function (f) {
      L.push('- 不要写 `' + f.bad.split('  /  ')[0] + '` —— ' + f.why);
    });
    L.push('');
    L.push('## 可选');
    L.push('');
    L.push('- [llms-full.txt](llms-full.txt)：上面几份拼成一整份，供一次性读入。');
    L.push('');
    return L.join('\n');
  }

  function renderLlmsFull(spec) {
    var head = renderLlmsTxt(spec);
    /* 去掉索引部分的「可选」小节：整份都在这里了，再指回自己是废话 */
    var cut = head.indexOf('## 可选');
    if (cut > 0) head = head.slice(0, cut).trim();
    return head +
      '\n\n---\n\n' +
      renderAgentsMd(spec) +
      '\n\n---\n\n' +
      '## 完整契约（JSON）\n\n' +
      code('json', JSON.stringify(spec, null, 2));
  }

  function renderSpecJson(spec) {
    return JSON.stringify(spec, null, 2) + '\n';
  }

  global.OneUIAI = {
    renderAgentsMd: renderAgentsMd,
    renderLlmsTxt: renderLlmsTxt,
    renderLlmsFull: renderLlmsFull,
    renderSpecJson: renderSpecJson,
    declaredClasses: declaredClasses,
    allComponents: allComponents
  };
})(typeof window !== 'undefined' ? window : this);
