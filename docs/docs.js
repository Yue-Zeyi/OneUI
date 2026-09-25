/* ============================================================
   OwnUI · 文档站脚本（docs.js）
   仅服务文档站：主题切换、导航搜索、滚动定位、主色试验台。
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 亮暗模式（验证 Token 语义层可翻转） ---------- */
  var STORE_KEY = 'ownui-doc-theme';
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem(STORE_KEY); } catch (e) { saved = null; }
  if (saved) root.setAttribute('data-ui-theme', saved);

  function currentTheme() {
    return root.getAttribute('data-ui-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }
  function applyTheme(theme) {
    root.setAttribute('data-ui-theme', theme);
    try { localStorage.setItem(STORE_KEY, theme); } catch (e) { /* 忽略隐私模式 */ }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      var label = btn.querySelector('[data-theme-label]');
      if (label) label.textContent = theme === 'dark' ? '切换浅色' : '切换深色';
    });
    /* 导出面板要标出「当前是深色还是浅色」。函数声明会提升，但内部的元素引用
       是 var（此刻还是 undefined），所以那边第一件事就是空引用直接返回。 */
    refreshExportPanel();
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-theme-toggle]');
    if (!btn) return;
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
  applyTheme(currentTheme());

  /* ---------- 移动端目录：把侧栏克隆进抽屉 ----------
     必须放在搜索与滚动高亮之前：这两处都会在初始化时一次性抓取
     [data-nav-item]，克隆晚了抽屉那份就漏掉，两份目录状态会不一致。 */
  var sideNav = document.querySelector('[data-side-nav]');
  var drawerNav = document.querySelector('[data-drawer-nav]');
  if (sideNav && drawerNav) {
    var clone = sideNav.cloneNode(true);
    clone.removeAttribute('data-side-nav');
    drawerNav.appendChild(clone);
    /* 抽屉里点击目录项后自动收起 */
    clone.addEventListener('click', function (e) {
      if (e.target.closest('[data-nav-item]')) UI.drawer.close('#docDrawer');
    });
  }

  /* ---------- 侧栏搜索 ---------- */
  var search = document.querySelector('[data-doc-search]');
  var empty = document.querySelector('[data-doc-empty]');
  if (search) {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-nav-item]'));
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var hits = 0;
      items.forEach(function (item) {
        var text = (item.getAttribute('data-nav-item') + ' ' + item.textContent).toLowerCase();
        var match = !q || text.indexOf(q) >= 0;
        item.style.display = match ? '' : 'none';
        if (match) hits++;
      });
      if (empty) empty.classList.toggle('is-show', hits === 0);
      /* 搜索时展开被折叠的分组标题 */
      document.querySelectorAll('[data-nav-group]').forEach(function (group) {
        var visible = false;
        group.querySelectorAll('[data-nav-item]').forEach(function (link) {
          if (link.style.display !== 'none') visible = true;
        });
        group.style.display = visible ? '' : 'none';
      });
    });
  }

  /* ---------- 滚动定位（scrollspy） ----------
     改用滚动位置直接计算当前分区，而不是 IntersectionObserver：
     · IO 在首屏内容尚未进入观察带时不会触发，刚打开页面侧栏一项高亮都没有；
     · 多个分区同时相交时是"后到者胜"，高亮会来回跳。
     现在显式取"最后一个越过判定线"的分区，任何时刻都有且只有一项高亮。 */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav-item]'));
  var side = document.querySelector('.doc-side');
  var sectionPairs = [];
  navLinks.forEach(function (link) {
    var id = (link.getAttribute('href') || '').slice(1);
    if (!id || !document.getElementById(id)) return;
    var dup = sectionPairs.some(function (p) { return p.id === id; });
    if (!dup) sectionPairs.push({ id: id, el: document.getElementById(id) });
  });

  var activeId = null;
  function setActive(id) {
    if (!id || id === activeId) return;
    activeId = id;
    navLinks.forEach(function (link) {
      var on = link.getAttribute('href') === '#' + id;
      link.classList.toggle('is-active', on);
      if (on) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    /* 长目录里高亮项很容易滚出侧栏可视区，做最小幅度的回带 */
    if (!side) return;
    var hit = side.querySelector('.ui-sidenav__item.is-active');
    if (!hit) return;
    var hr = hit.getBoundingClientRect();
    var sr = side.getBoundingClientRect();
    var headroom = 56;   /* 吸附的分组标题大约占这么高 */
    if (hr.top < sr.top + headroom) side.scrollTop -= (sr.top + headroom) - hr.top;
    else if (hr.bottom > sr.bottom - 12) side.scrollTop += hr.bottom - (sr.bottom - 12);
  }

  /* 不加 rAF / 时间戳节流：本函数只做 45 次 getBoundingClientRect 读取，
     中间不穿插任何样式写入，浏览器会复用同一份布局，开销极低。
     反过来，rAF 一旦被节流（后台标签页、部分无头环境）节流标志就永远卡在
     true，高亮会直接停止更新——这个坑不值得为省那点开销去踩。 */
  function spy() {
    if (!sectionPairs.length) return;
    var line = window.innerHeight * 0.28;
    var current = sectionPairs[0].id;
    for (var i = 0; i < sectionPairs.length; i++) {
      if (sectionPairs[i].el.getBoundingClientRect().top <= line) current = sectionPairs[i].id;
    }
    /* 滚到底时强制选最后一项，否则页尾那些短分区永远选不中 */
    var atBottom = (window.scrollY || window.pageYOffset || 0) + window.innerHeight
      >= document.documentElement.scrollHeight - 4;
    if (atBottom) current = sectionPairs[sectionPairs.length - 1].id;
    setActive(current);
  }
  if (sectionPairs.length) {
    window.addEventListener('scroll', spy, { passive: true });
    window.addEventListener('resize', spy);
    /* 点击目录后浏览器需要一帧才更新滚动位置，延后一拍再算 */
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () { window.setTimeout(spy, 0); });
    });
    spy();
  }

  /* ---------- 主色换肤：全局唯一入口 ----------
     只有一条规则要记：**改 --ui-p-* 必须改在 <html> 上**。
     --ui-primary: var(--ui-p-600) 声明在 :root，var() 就在 :root 完成替换；
     若把 --ui-p-* 写到后代元素上，父级那份 --ui-primary 早已变成具体色值
     继承下来，子元素怎么改 L1 都不会生效（改造前的试验台就踩了这个坑：
     色块点了有反应，但旁边的按钮/开关/进度条纹丝不动）。

     两条路径：
       · 预设 —— 只写 data-ui-accent，色阶和深色模式角色全部由 tokens.css 提供；
       · 自定义色值 —— 从单个色值算出一整套 10 档色阶，并把这 19 个属性写成
         <html> 的行内样式（行内权重最高，能盖过预设块）。
     两者互斥，切回预设时必须逐个清掉行内属性。 */
  var ACCENTS = ['ink', 'blue', 'indigo', 'emerald', 'orange', 'violet'];
  var ACCENT_KEY = 'ownui-doc-accent';
  var ACCENT_HEX_KEY = 'ownui-doc-accent-hex';

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(c) {
    var f = function (v) { return ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); };
    return '#' + f(c.r) + f(c.g) + f(c.b);
  }
  function mix(a, b, ratio) {
    return {
      r: a.r + (b.r - a.r) * ratio,
      g: a.g + (b.g - a.g) * ratio,
      b: a.b + (b.b - a.b) * ratio
    };
  }
  var WHITE = { r: 255, g: 255, b: 255 };
  var BLACK = { r: 9, g: 9, b: 11 };      /* = --ui-n-950，加深方向朝它走 */

  /* WCAG 相对亮度与对比度，用来判断白字够不够、要不要自动加深 */
  function relLuminance(c) {
    var f = function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function contrast(a, b) {
    var la = relLuminance(a), lb = relLuminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /* 自定义色值要写的 19 个属性：10 档色阶 + 浅色档状态/文字 + 7 个深色角色 */
  var RAMP_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
  var DERIVED = ['--ui-primary-hover', '--ui-primary-active', '--ui-primary-text',
    '--ui-primary-dark', '--ui-primary-dark-hover', '--ui-primary-dark-active',
    '--ui-primary-dark-weak', '--ui-primary-dark-weak-hover', '--ui-primary-dark-border',
    '--ui-primary-dark-text'];
  var INLINE_PROPS = RAMP_STEPS.map(function (s) { return '--ui-p-' + s; }).concat(DERIVED);
  var CUSTOM_STYLE_ID = 'ownui-custom-accent';

  /* 清掉自定义主色的全部痕迹：旧行内样式（历史版本残留）+ 注入的规则。
     切回预设、换色、恢复默认都会走到这里，漏掉任何一个来源都会留下幽灵值。 */
  function clearInlineAccent() {
    INLINE_PROPS.forEach(function (p) { root.style.removeProperty(p); });
    var el = document.getElementById(CUSTOM_STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  /* 自定义主色必须落在一个 <style> 规则里，不能写行内样式。
     为什么：主色底上的字色在浅色/深色两套主题下要用**不同**的值 —— 浅色看
     --ui-primary-text，深色看 --ui-primary-dark-text，这个切换靠 tokens.css
     里深色块（权重 0,2,0）把 --ui-primary-text 改指过去完成。行内样式的
     优先级高过任何选择器，会把那条映射整个压死。
     实测症状：输入 #7F1D1D 这类深色，浅色下白字 10:1 完全正常；一进深色
     模式主色被提亮到 #AE7171，文字却还是行内写死的白字，只剩 3.89:1。
     用 :root:where([data-ui-accent="custom"])（恒 0,1,0）+ 注入位置在
     tokens.css 之后：浅色下按源码顺序盖过 :root 的默认值，深色块又能照常
     接管那几个槽位 —— 与导出的 ownui-theme.css 是同一套机制。 */
  function writeCustomAccent(css) {
    var el = document.getElementById(CUSTOM_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = CUSTOM_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }

  function currentAccent() { return root.getAttribute('data-ui-accent') || 'ink'; }

  /* 调色板模块在文件更下方才赋值。放到这里是因为：切预设、点色点、恢复默认
     这些动作都走 syncAccentUI，而它们发生时调色板可能正开着，面板上的色相条、
     明度点、hex、对比度读数必须跟着走，否则面板会显示一个"上一版"的颜色。 */
  var paletteSync = null;
  /* 同理：导出面板上的「当前配色」与它的预览要跟着主色走。 */
  var exportSync = null;

  /* 把选中态同步到所有入口：导航栏菜单、窄屏抽屉色点、#accent 试验台 */
  function syncAccentUI() {
    var cur = currentAccent();
    document.querySelectorAll('[data-accent-option]').forEach(function (el) {
      var on = el.getAttribute('data-accent-option') === cur;
      el.setAttribute('aria-checked', on ? 'true' : 'false');
      el.classList.toggle('is-active', on);
    });
    if (paletteSync) paletteSync();
    if (exportSync) exportSync();
  }

  function setAccent(name) {
    if (ACCENTS.indexOf(name) < 0) return false;
    clearInlineAccent();
    root.setAttribute('data-ui-accent', name);
    try { localStorage.setItem(ACCENT_KEY, name); } catch (e) { /* 忽略隐私模式 */ }
    syncAccentUI();
    return true;
  }

  /* 自定义色值：从一个色值推出一整套色阶。
     600 档必须压得住白字，否则按钮文字会不可读——不达标就沿加深方向走，
     并明确告诉用户改了值（不静默改），避免"我填的是亮黄，怎么变深褐了"。 */
  var LIGHT_STEPS = { 50: 0.95, 100: 0.89, 200: 0.78, 300: 0.62, 400: 0.44, 500: 0.24 };

  /* 自定义色值：从一个色值推出一整套 10 档色阶。
     主色底上到底用白字还是墨字，先定这一步——它同时决定状态档往哪个方向走。
     顺序刻意是"先换文字色，再考虑加深"：亮色（比如亮黄）压白字必然不达标，
     但把它一路压暗会得到一坨泥橄榄色，色相全丢；改用墨字既达标又保住品牌色。
     只有中间调（白字墨字都过不了）才不得已沿加深方向走。 */
  function buildRamp(base, up) {
    var ramp = {};
    Object.keys(LIGHT_STEPS).forEach(function (k) {
      ramp[k] = rgbToHex(mix(base, WHITE, LIGHT_STEPS[k]));
    });
    ramp[600] = rgbToHex(base);
    /* up = true 走"变浅"，false 走"变深"；900 只服务深色模式淡底，恒为深色 */
    ramp[700] = rgbToHex(mix(base, up ? WHITE : BLACK, up ? 0.16 : 0.14));
    ramp[800] = rgbToHex(mix(base, up ? WHITE : BLACK, up ? 0.30 : 0.28));
    ramp[900] = rgbToHex(mix(base, BLACK, 0.62));
    return ramp;
  }

  /* quiet = true 供调色板拖动时逐帧调用：只重算色阶并写行内样式，
     跳过 localStorage 落盘与选中态同步。拖动一秒会走几十帧，
     每帧写一次 localStorage 是同步磁盘 I/O，会直接把拖动拖卡。
     松手时再用非 quiet 调一次完成落盘。 */
  function setCustomAccent(hex, quiet) {
    if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex)) return null;
    /* 一次非 quiet 调用等于宣布"这个值才是权威的"，所以必须先把调色板尚未落地的
       那一帧取消掉。否则迟到的 rAF 会拿着旧色再写一次行内样式，把新值覆盖回去
       ——实测能复现：拖完色相条立刻在输入框填 #2563EB，最终主色会变回拖动时的颜色。 */
    if (!quiet) palCancelPending();
    var wanted = rgbToHex(hexToRgb(hex.charAt(0) === '#' ? hex : '#' + hex));
    var base = hexToRgb(wanted);
    var textToken, up, note = null;

    if (contrast(WHITE, base) >= 4.5) {
      textToken = 'var(--ui-n-0)';          /* 深色主色配白字，状态往深处走 */
      up = false;
    } else if (contrast(BLACK, base) >= 4.5) {
      textToken = 'var(--ui-n-950)';        /* 亮色主色配墨字，色相完整保留 */
      /* 状态档优先"变深"（比"变浅"可见）；只有加深会把墨字对比度压破时才翻方向 */
      up = contrast(BLACK, mix(base, BLACK, 0.14)) < 4.5
        || contrast(BLACK, mix(base, BLACK, 0.28)) < 4.5;
    } else {
      /* 中间调窄带：白字墨字都过不了，只能沿加深方向走到白字达标 */
      var guard = 0;
      var from = rgbToHex(base);
      while (contrast(WHITE, base) < 4.6 && guard < 30) { base = mix(base, BLACK, 0.06); guard++; }
      textToken = 'var(--ui-n-0)';
      up = false;
      if (guard > 0) {
        note = { kind: 'darkened', from: from, to: rgbToHex(base), ratio: contrast(WHITE, hexToRgb(from)) };
      }
    }
    if (!note && textToken === 'var(--ui-n-950)') {
      note = { kind: 'darktext', wanted: wanted, ratio: contrast(BLACK, base) };
    }

    var ramp = buildRamp(base, up);

    /* 深色模式的主色恒配墨字，所以它必须自己亮到能压住墨字（≥4.5:1）。
       不能直接取 400 档：输入本身很深时（比如纯黑），400 档只有 3.9:1。
       这里沿变白方向补一段，保证任何输入色都能用。 */
    var dk = base, g2 = 0;
    while (contrast(BLACK, dk) < 4.8 && g2 < 40) { dk = mix(dk, WHITE, 0.05); g2++; }

    clearInlineAccent();
    root.setAttribute('data-ui-accent', 'custom');   /* 不匹配任何预设块 → 注入的规则说了算 */
    var px = function (s) { return 'var(--ui-p-' + s + ')'; };
    var decl = [];
    RAMP_STEPS.forEach(function (s) { decl.push('  --ui-p-' + s + ': ' + ramp[s] + ';'); });
    decl.push('  --ui-primary-hover: ' + px(700) + ';');
    decl.push('  --ui-primary-active: ' + px(800) + ';');
    decl.push('  --ui-primary-text: ' + textToken + ';');
    decl.push('  --ui-primary-dark: ' + rgbToHex(dk) + ';');
    decl.push('  --ui-primary-dark-hover: ' + rgbToHex(mix(dk, WHITE, 0.14)) + ';');
    decl.push('  --ui-primary-dark-active: ' + rgbToHex(mix(dk, WHITE, 0.26)) + ';');
    decl.push('  --ui-primary-dark-weak: ' + px(900) + ';');
    decl.push('  --ui-primary-dark-weak-hover: ' + px(800) + ';');
    decl.push('  --ui-primary-dark-border: ' + px(700) + ';');
    decl.push('  --ui-primary-dark-text: var(--ui-n-950);');
    writeCustomAccent(':root:where([data-ui-accent="custom"]) {\n' + decl.join('\n') + '\n}');

    if (!quiet) {
      try {
        localStorage.setItem(ACCENT_KEY, 'custom');
        localStorage.setItem(ACCENT_HEX_KEY, wanted);
      } catch (e) { /* 忽略 */ }
      syncAccentUI();
    }
    return { wanted: wanted, used: ramp[600], ramp: ramp, note: note, textToken: textToken };
  }

  /* 恢复上次选择 */
  (function restoreAccent() {
    var saved = null, savedHex = null;
    try {
      saved = localStorage.getItem(ACCENT_KEY);
      savedHex = localStorage.getItem(ACCENT_HEX_KEY);
    } catch (e) { /* 忽略 */ }
    if (saved === 'custom' && savedHex) {
      setCustomAccent(savedHex);
      var input = document.querySelector('[data-accent-input]');
      if (input) input.value = savedHex;
    } else if (saved && ACCENTS.indexOf(saved) >= 0) {
      root.setAttribute('data-ui-accent', saved);
    }
    syncAccentUI();
    /* 预设与自定义是互斥的，清掉自定义留下的行内值 */
    if (currentAccent() !== 'custom') clearInlineAccent();
  })();

  /* 所有入口统一走这里：导航栏菜单项、窄屏抽屉色点、#accent 试验台色点 */
  document.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-accent-option]');
    if (opt) setAccent(opt.getAttribute('data-accent-option'));
  });

  /* 自定义色值的"事后说明"。输入框与调色板两条路径共用一份文案，
     免得两处各写一遍之后走偏（引擎自动改了值就必须说清楚，这是既定契约）。 */
  function notifyAccent(res) {
    if (!res) {
      UI.toast({ message: '请输入合法的十六进制色值，例如 #2563EB', type: 'warning' });
      return;
    }
    var n = res.note;
    if (n && n.kind === 'darkened') {
      UI.toast({
        message: n.from + ' 压白字只有 ' + n.ratio.toFixed(2) + ':1，已自动加深为 ' + n.to + ' 以满足 4.5:1',
        type: 'warning', duration: 4200
      });
    } else if (n && n.kind === 'darktext') {
      UI.toast({
        message: n.wanted + ' 偏亮，主色底已改用墨色文字（' + n.ratio.toFixed(1) + ':1），色相保持原样',
        type: 'success', duration: 3200
      });
    } else {
      UI.toast({ message: '已应用 ' + res.used, type: 'success', duration: 1800 });
    }
  }

  var accentInput = document.querySelector('[data-accent-input]');
  if (accentInput) {
    accentInput.addEventListener('change', function () {
      notifyAccent(setCustomAccent(accentInput.value.trim()));
    });
  }
  document.querySelectorAll('[data-accent-reset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setAccent('ink');
      if (accentInput) accentInput.value = '';
      UI.toast({ message: '已恢复默认中性墨黑', type: 'success', duration: 1600 });
    });
  });

  /* ---------- 分享链接：把配色编进 URL hash ----------
     形式：#accent=blue / #accent=custom&c=%23FF6B35[&theme=dark]
     为什么用 hash 而不是 query：hash 不进请求，file:// 下双击打开也能分享，
     而且它天生就是"打开即还原"的载体。

     只在带等号时才当配置解析 —— 本页的目录锚点长这样 #btn、#group-basic，
     没有等号，不会被误读成参数。
     带链接进来的配置优先于本地存储：用户是拿着一条链接来的，就该看到链接里
     那一版，而不是他自己上次改的。 */
  function readHashConfig() {
    var raw = String(location.hash || '').replace(/^#/, '');
    if (raw.indexOf('=') < 0) return null;
    try { return new URLSearchParams(raw); } catch (e) { return null; }
  }
  (function applySharedConfig() {
    var q = readHashConfig();
    if (!q) return;
    var theme = q.get('theme');
    if (theme === 'dark' || theme === 'light') applyTheme(theme);
    var accent = q.get('accent');
    if (!accent) return;
    if (accent === 'custom') {
      /* 拿引擎归一化后的值回填输入框，而不是原样塞回链接里的字符串 ——
         链接可能是 #fff 这种三位简写，直接回填会和输入框的六位约定打架。 */
      var res = q.get('c') ? setCustomAccent(q.get('c')) : null;
      if (res && accentInput) accentInput.value = res.wanted.toUpperCase();
      return;
    }
    setAccent(accent);
  })();

  /* ---------- 调色板（自绘浮层） ----------
     setCustomAccent(hex) 本来就吃任意色值，所以这里只是给它补一个输入层：
     SV 方块 + 色相条 + hex 输入 + 对比度读数 + 最近用色。引擎一行没改。

     三个容易翻车的点，实现里都处理了：
     1) setPointerCapture —— 不捕获的话，指针一拖出面板边界（这是常态）后续
        pointermove 就不再派发到该元素，拖动会直接卡死；
     2) 拖动中走 rAF 节流 + quiet 模式，只写行内样式，不落盘、不弹 toast；
        松手才 commit 一次，否则一段拖动会写几十次 localStorage 并把提示刷满屏；
     3) 键盘可达 —— 色相条与 SV 方块都是 role="slider"，方向键微调、Shift 加速
        十倍，和本项目其它组件的无障碍基线保持一致。 */
  var RECENT_KEY = 'ownui-doc-recent';
  var MAX_RECENT = 5;

  /* SV 面板与色相条都在 HSV 空间里工作，而引擎只认 hex，这里是转换层。
     注意一个反直觉点：hex → HSV 在灰阶（s = 0）时色相无解，公式一律算回 0。
     所以只在"确实有色相"时才采用反解结果，否则把颜色拖到纯灰/纯黑之后，
     色相会突然归零，再拖就跳成红色。 */
  function hexToHsv(hex) {
    var c = hexToRgb(hex);
    var r = c.r / 255, g = c.g / 255, b = c.b / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    var h = 0;
    if (d) {
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: mx ? d / mx : 0, v: mx };
  }
  function hsvToHex(h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var t;
    if (h < 60) t = [c, x, 0];
    else if (h < 120) t = [x, c, 0];
    else if (h < 180) t = [0, c, x];
    else if (h < 240) t = [0, x, c];
    else if (h < 300) t = [x, 0, c];
    else t = [c, 0, x];
    return rgbToHex({ r: (t[0] + m) * 255, g: (t[1] + m) * 255, b: (t[2] + m) * 255 });
  }

  var PAL_HTML =
    '<div class="doc-palette__head">' +
      '<span class="doc-palette__title">自定义主色</span>' +
      '<button class="ui-icon-btn doc-palette__close" type="button" data-pal-close aria-label="关闭调色板">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>' +
      '</button>' +
    '</div>' +
    '<div class="doc-palette__sv" data-pal-sv tabindex="0" role="slider" aria-label="饱和度与明度">' +
      '<div class="doc-palette__sv-fill" data-pal-fill></div>' +
      '<div class="doc-palette__sv-white"></div>' +
      '<div class="doc-palette__sv-black"></div>' +
      '<div class="doc-palette__thumb" data-pal-sv-thumb></div>' +
    '</div>' +
    '<div class="doc-palette__hue" data-pal-hue tabindex="0" role="slider" aria-label="色相" aria-valuemin="0" aria-valuemax="360">' +
      '<div class="doc-palette__thumb" data-pal-hue-thumb></div>' +
    '</div>' +
    '<div class="doc-palette__row">' +
      '<span class="doc-palette__preview" data-pal-preview aria-hidden="true"></span>' +
      '<input class="ui-input ui-input--sm doc-palette__hex" type="text" data-pal-hex spellcheck="false" autocomplete="off" aria-label="十六进制色值">' +
    '</div>' +
    '<div class="doc-palette__meta">' +
      '<span class="doc-palette__ratio" data-pal-ratio-white>白字 <b>—</b></span>' +
      '<span class="doc-palette__ratio" data-pal-ratio-ink>墨字 <b>—</b></span>' +
    '</div>' +
    '<div class="doc-palette__foot">' +
      '<div class="doc-palette__recent" data-pal-recent></div>' +
      '<button class="ui-btn ui-btn--default ui-btn--sm" type="button" data-pal-reset>恢复默认</button>' +
    '</div>';

  var pal = { h: 217, s: .86, v: .92 };
  var palPanel = null, palAnchor = null, palRaf = 0, palPending = null, palDrag = null;
  var palCommitTimer = 0, palLastCommitted = '';

  function isHex6(x) { return typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x); }
  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }
  function palQ(sel) { return palPanel ? palPanel.querySelector(sel) : null; }

  function readRecent() {
    try {
      var raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return raw.filter(isHex6).slice(0, MAX_RECENT);
    } catch (e) { return []; }
  }
  function renderRecent() {
    var box = palQ('[data-pal-recent]');
    if (!box) return;
    box.innerHTML = readRecent().map(function (h) {
      return '<button class="doc-palette__recent-dot" type="button" data-pal-recent-dot="' + h +
        '" style="background:' + h + '" aria-label="最近使用 ' + h + '"></button>';
    }).join('');
  }
  function pushRecent(hex) {
    var list = readRecent().filter(function (x) { return x.toLowerCase() !== hex.toLowerCase(); });
    list.unshift(hex);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT))); } catch (e) { /* 忽略 */ }
    renderRecent();
  }

  /* 把当前 HSV 反映到面板上。hex 由调用方给，避免在灰阶上再反解一次色相。 */
  function paintPalette(hex) {
    if (!palPanel) return;
    var c = hexToRgb(hex);
    var cw = contrast(WHITE, c), ck = contrast(BLACK, c);

    palQ('[data-pal-fill]').style.background = hsvToHex(pal.h, 1, 1);
    palQ('[data-pal-preview]').style.background = hex;

    /* 打字过程中不覆盖输入框，否则光标会被自己的回写顶掉 */
    var hi = palQ('[data-pal-hex]');
    if (document.activeElement !== hi) hi.value = hex.toUpperCase();

    palQ('[data-pal-sv-thumb]').style.left = (pal.s * 100) + '%';
    palQ('[data-pal-sv-thumb]').style.top = ((1 - pal.v) * 100) + '%';
    palQ('[data-pal-hue-thumb]').style.left = (pal.h / 360 * 100) + '%';

    var tw = palQ('[data-pal-ratio-white]'), ti = palQ('[data-pal-ratio-ink]');
    tw.querySelector('b').textContent = cw.toFixed(1) + ':1';
    ti.querySelector('b').textContent = ck.toFixed(1) + ':1';
    /* 引擎的选择顺序是「白字够就用白字，否则看墨字，都不行才加深」，
       这里如实反映它实际会选哪一个，让自动改色变得可预期 */
    var pickInk = cw < 4.5 && ck >= 4.5;
    tw.classList.toggle('is-picked', !pickInk && cw >= 4.5);
    ti.classList.toggle('is-picked', pickInk);

    var sv = palQ('[data-pal-sv]');
    sv.setAttribute('aria-valuemin', '0');
    sv.setAttribute('aria-valuemax', '100');
    sv.setAttribute('aria-valuenow', String(Math.round(pal.s * 100)));
    sv.setAttribute('aria-valuetext',
      '饱和度 ' + Math.round(pal.s * 100) + '%，明度 ' + Math.round(pal.v * 100) + '%');
    var hueEl = palQ('[data-pal-hue]');
    hueEl.setAttribute('aria-valuenow', String(Math.round(pal.h)));
    hueEl.setAttribute('aria-valuetext', Math.round(pal.h) + ' 度');
  }

  /* 取消尚未落地的那一帧。任何非 quiet 的写入都要先调它。
     palRaf / palPending 用 var 声明，函数声明会提升，所以这里在赋值前
     被调到也安全（读到 undefined，两个判断都不成立）。 */
  function palCancelPending() {
    if (palRaf) { cancelAnimationFrame(palRaf); palRaf = 0; }
    palPending = null;
  }

  /* 拖动中：rAF 节流 + quiet，只动样式 */
  function palLive() {
    var hex = hsvToHex(pal.h, pal.s, pal.v);
    paintPalette(hex);
    palPending = hex;
    if (palRaf) return;
    palRaf = requestAnimationFrame(function () {
      palRaf = 0;
      if (palPending) { setCustomAccent(palPending, true); palPending = null; }
    });
  }

  /* 落定：写存储 + 同步三处选中态 + 进最近用色 + 该说的说明说一次 */
  function palCommit() {
    clearTimeout(palCommitTimer);
    if (!palPanel) return;
    var hex = hsvToHex(pal.h, pal.s, pal.v);
    if (hex.toLowerCase() === palLastCommitted) return;
    palLastCommitted = hex.toLowerCase();
    var res = setCustomAccent(hex);
    if (!res) return;
    pushRecent(res.wanted);
    notifyAccent(res);
  }
  /* 键盘连按不该连弹五条提示，等停手了再落定 */
  function palCommitSoon() {
    clearTimeout(palCommitTimer);
    palCommitTimer = setTimeout(palCommit, 420);
  }

  /* setPointerCapture 是自绘滑块的关键：拖出元素边界后仍能收到 pointermove */
  function bindPalDrag(el, onMove) {
    el.addEventListener('pointerdown', function (e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 老浏览器降级 */ }
      palDrag = el;
      el.focus();
      onMove(e);
    });
    el.addEventListener('pointermove', function (e) {
      if (palDrag !== el) return;
      onMove(e);
    });
    var end = function () {
      if (palDrag !== el) return;
      palDrag = null;
      palCommit();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  function buildPalette() {
    if (palPanel) return;
    palPanel = document.createElement('div');
    palPanel.className = 'doc-palette';
    palPanel.setAttribute('role', 'dialog');
    palPanel.setAttribute('aria-label', '自定义主色');
    palPanel.innerHTML = PAL_HTML;
    document.body.appendChild(palPanel);

    var sv = palQ('[data-pal-sv]'), huel = palQ('[data-pal-hue]');

    function svMove(e) {
      var r = sv.getBoundingClientRect();
      pal.s = clamp01((e.clientX - r.left) / r.width);
      pal.v = 1 - clamp01((e.clientY - r.top) / r.height);
      palLive();
    }
    /* 色相条在退化色上是"无效控件"：明度太低看不出色相，饱和度太低则色相
       即使在数学上变了、肉眼也只是同一块近灰。默认主色墨黑 #18181B 就落在
       这个区间（明度 11%、饱和度 11%），用户一进面板先拖色相条会以为坏了。

       所以只在这两处退化时把颜色抬进"能看出色相"的区间，正常色一律不动
       （深蓝 #1E3A8A、翠绿 #047857 这类都远在阈值之上，不受影响）。
       这不是猜用户想要什么——是让色相条在任何状态下都立刻给出可读反馈。 */
    function liftForHue() {
      if (pal.v < .35) pal.v = .85;
      if (pal.s < .35) pal.s = .70;
    }
    function hueMove(e) {
      var r = huel.getBoundingClientRect();
      pal.h = clamp01((e.clientX - r.left) / r.width) * 360;
      liftForHue();
      palLive();
    }
    bindPalDrag(sv, svMove);
    bindPalDrag(huel, hueMove);

    /* 方向键：SV 面板四向 1%（Shift 10%），色相条左右 1 度（Shift 10 度） */
    sv.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? .1 : .01, hit = true;
      if (e.key === 'ArrowLeft') pal.s = clamp01(pal.s - step);
      else if (e.key === 'ArrowRight') pal.s = clamp01(pal.s + step);
      else if (e.key === 'ArrowUp') pal.v = clamp01(pal.v + step);
      else if (e.key === 'ArrowDown') pal.v = clamp01(pal.v - step);
      else hit = false;
      if (hit) { e.preventDefault(); palLive(); palCommitSoon(); }
    });
    huel.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 10 : 1, hit = true;
      if (e.key === 'ArrowLeft') pal.h = (pal.h - step + 360) % 360;
      else if (e.key === 'ArrowRight') pal.h = (pal.h + step) % 360;
      else hit = false;
      if (hit) { e.preventDefault(); liftForHue(); palLive(); palCommitSoon(); }
    });

    var hi = palQ('[data-pal-hex]');
    hi.addEventListener('input', function () {
      var v = hi.value.trim();
      if (!/^#?[0-9a-fA-F]{6}$/.test(v) && !/^#?[0-9a-fA-F]{3}$/.test(v)) return;
      var hex = rgbToHex(hexToRgb(v.charAt(0) === '#' ? v : '#' + v));
      var hsv = hexToHsv(hex);
      pal.s = hsv.s;
      pal.v = hsv.v;
      if (hsv.s > .002 && hsv.v > .002) pal.h = hsv.h;
      palLive();
      palCommitSoon();
    });
    hi.addEventListener('change', function () {
      var res = setCustomAccent(hi.value.trim());
      if (!res) {
        notifyAccent(null);
        hi.value = hsvToHex(pal.h, pal.s, pal.v).toUpperCase();
        return;
      }
      palLastCommitted = res.wanted.toLowerCase();
      pushRecent(res.wanted);
      notifyAccent(res);
    });

    palPanel.addEventListener('click', function (e) {
      if (e.target.closest('[data-pal-close]')) { closePalette(); return; }
      if (e.target.closest('[data-pal-reset]')) {
        setAccent('ink');
        var hsv = hexToHsv('#18181B');
        pal.s = hsv.s; pal.v = hsv.v; pal.h = 217;
        palLastCommitted = '#18181b';
        paintPalette('#18181B');
        UI.toast({ message: '已恢复默认中性墨黑', type: 'success', duration: 1600 });
        return;
      }
      var dot = e.target.closest('[data-pal-recent-dot]');
      if (dot) {
        palLastCommitted = '';
        var hex = dot.getAttribute('data-pal-recent-dot');
        var h2 = hexToHsv(hex);
        pal.s = h2.s; pal.v = h2.v;
        if (h2.s > .002 && h2.v > .002) pal.h = h2.h;
        palLive();
        palCommit();
      }
    });
  }

  function openPalette(anchor) {
    buildPalette();
    /* 窄屏入口在抽屉里，抽屉是全屏遮罩：不收起来就完全看不到拖动时的实时预览，
       而那正是这个面板存在的意义。走库的公开 API，不直接改 class。 */
    if (anchor.closest('.ui-drawer')) UI.drawer.close();
    palAnchor = anchor;
    var cur = getComputedStyle(root).getPropertyValue('--ui-p-600').trim();
    if (!isHex6(cur)) cur = '#18181B';
    var hsv = hexToHsv(cur);
    pal.s = hsv.s;
    pal.v = hsv.v;
    if (hsv.s > .002 && hsv.v > .002) pal.h = hsv.h;
    palLastCommitted = cur.toLowerCase();
    paintPalette(cur);
    renderRecent();
    palPanel.classList.add('is-open');
    UI.position(palPanel, anchor, 'bottom', 8);
    var sv = palQ('[data-pal-sv]');
    if (sv) sv.focus();
  }
  function closePalette() {
    clearTimeout(palCommitTimer);
    /* 关面板前先把还没落地的那一帧补上：拖到一半按 ESC / 点空白处，
       不该丢掉用户最后拖到的颜色。 */
    if (palPending || palRaf) { palCancelPending(); palCommit(); }
    if (palPanel) palPanel.classList.remove('is-open');
    palAnchor = null;
  }
  function paletteIsOpen() { return !!(palPanel && palPanel.classList.contains('is-open')); }

  /* 面板是 position:fixed 挂在 body 上的，锚点滚走了它不会自己跟。
     导航栏是 sticky，页面一滚按钮位置就变，不重定位就会出现"面板悬在半空"。 */
  function palReposition() {
    if (paletteIsOpen() && palAnchor && palAnchor.isConnected) {
      UI.position(palPanel, palAnchor, 'bottom', 8);
    }
  }
  document.addEventListener('scroll', palReposition, true);
  window.addEventListener('resize', palReposition);

  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-accent-palette]');
    if (trigger) { openPalette(trigger); return; }
    if (paletteIsOpen() && !palPanel.contains(e.target)) closePalette();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && paletteIsOpen()) closePalette();
  });

  /* 外部改了主色（切预设 / 点色点 / 恢复默认）时，面板若开着就重新对齐 */
  paletteSync = function () {
    if (!paletteIsOpen()) return;
    var cur = getComputedStyle(root).getPropertyValue('--ui-p-600').trim();
    if (!isHex6(cur)) return;
    var hsv = hexToHsv(cur);
    pal.s = hsv.s;
    pal.v = hsv.v;
    if (hsv.s > .002 && hsv.v > .002) pal.h = hsv.h;
    palLastCommitted = cur.toLowerCase();
    paintPalette(cur);
  };

  /* ---------- 导出这一版主题 ----------
     三条"把文件交给用户"的通道，能力从强到弱：
       showSaveFilePicker（真·另存为，能挑目录、能改名） → <a download> + Blob
       → 复制到剪贴板。前两条覆盖了 Chrome / Edge / Safari / Firefox，
     所以不做 data: URL —— 大文件在部分浏览器会静默失败，比干脆不给还糟。

     导出的 CSS 用 :root[data-ui-accent="brand"] 而不是 :root，三个理由：
       · 与 tokens.css 的引入顺序无关，放哪儿都生效；
       · 与内置预设共存 —— 预设匹配的是 blue / indigo / … 这些值，brand 谁也
         不匹配，切一下属性就能在「预设」和「这一份」之间来回；
       · 直接盖 :root 会连默认的中性主题一起改掉，想退回就只能删文件。
     代价是要在 <html> 上多写一个属性，所以文件末尾另附了一份「直改版」。

     starter.zip 是唯一需要读本地文件的项（得把 library/ 的源码一起打包）。
     file:// 下 fetch 必然失败 —— 这不是缺陷，是浏览器的同源策略在拦。
     所以启动时探测一次，不可用就把按钮置灰并说明原因，不做静默失败。 */

  /* 每档干什么用。别当废话注释删掉：档位契约（600 = 主色、700 = hover、
     800 = active、900 = 深色淡底）是这套 Token 体系的核心约定，导出的文件
     必须原样带走，否则使用者会把 700 当主色、把 900 当边框。 */
  var EXPORT_STEP_HINT = {
    50: 'weak 淡底',
    100: 'weak 淡底 hover',
    200: 'weak 边框 / 深色模式 active',
    300: '深色模式 hover',
    400: '深色模式主色（中性主题的 active 取这一档）',
    500: '中间档（中性主题的 hover 取这一档）',
    600: '主色本身，压白字必须 ≥4.5:1',
    700: 'hover',
    800: 'active',
    900: '深色模式下的 weak 淡底'
  };
  var EXPORT_NEUTRAL_STEPS = [0, 25, 50, 100, 150, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  var EXPORT_SLOTS = [
    ['--ui-primary-hover', 'hover。品牌色深一档；墨黑反过来往浅处走，否则肉眼分不出'],
    ['--ui-primary-active', 'active，比 hover 再深一档'],
    ['--ui-primary-text', '主色底上的文字。必须写成 var()，深色模式靠它从白字翻成墨字', 1],
    ['--ui-primary-dark', '深色模式的主色：走浅档保住色相，不反白'],
    ['--ui-primary-dark-hover', '深色模式 hover'],
    ['--ui-primary-dark-active', '深色模式 active'],
    ['--ui-primary-dark-weak', '深色模式 weak 淡底'],
    ['--ui-primary-dark-weak-hover', '深色模式 weak 淡底 hover'],
    ['--ui-primary-dark-border', '深色模式 weak 边框'],
    ['--ui-primary-dark-text', '深色模式主色底上的文字（恒为深字）', 1]
  ];
  var EXPORT_ACCENT_LABEL = {
    ink: '中性墨黑', blue: '品蓝', indigo: '靛蓝',
    emerald: '翠绿', orange: '橙', violet: '紫罗兰'
  };

  var exportPanel = document.querySelector('[data-export]');
  var exportCodeEl = exportPanel ? exportPanel.querySelector('[data-export-code]') : null;
  var exportLabelEl = exportPanel ? exportPanel.querySelector('[data-export-current]') : null;
  var exportLinesEl = exportPanel ? exportPanel.querySelector('[data-export-lines]') : null;
  var exportWarnEl = exportPanel ? exportPanel.querySelector('[data-export-warn]') : null;
  var exportZipBtn = exportPanel ? exportPanel.querySelector('[data-export-zip]') : null;
  var exportSourceReady = null;   /* null = 还没探；true / false = 结论 */

  function cssVar(prop) { return getComputedStyle(root).getPropertyValue(prop).trim(); }
  function cssHex(prop) {
    var v = cssVar(prop);
    return isHex6(v) ? v.toUpperCase() : '';
  }
  function padRight(text, width) {
    while (text.length < width) text += ' ';
    return text;
  }
  function accentLabel() {
    var cur = currentAccent();
    if (cur === 'custom') {
      var h = cssHex('--ui-p-600');
      return h ? '自定义 ' + h : '自定义色值';
    }
    return EXPORT_ACCENT_LABEL[cur] || cur;
  }
  function themeLabel() { return currentTheme() === 'dark' ? '深色' : '浅色'; }
  function todayStamp() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* 「色值 → token 名」反查表。
     导出的 CSS 里写 var(--ui-p-700) 比 #1D4ED8 有用得多：一眼知道这档是干什么的，
     以后改色阶状态档也会自动跟随。可浏览器只肯给具体色值（getComputedStyle 会把
     var() 一路解开成 hex），所以反过来把 L1 逐个读出来建表，能对上就写引用。 */
  function buildTokenIndex() {
    var out = [];
    RAMP_STEPS.forEach(function (s) {
      var h = cssHex('--ui-p-' + s);
      if (h) out.push({ name: '--ui-p-' + s, hex: h });
    });
    EXPORT_NEUTRAL_STEPS.forEach(function (s) {
      var h = cssHex('--ui-n-' + s);
      if (h) out.push({ name: '--ui-n-' + s, hex: h });
    });
    return out;
  }
  /* 文字槽位优先认中性色阶：--ui-primary-text 只可能是 n-0 或 n-950，
     写成 var(--ui-n-0) 才说明了"深色模式下它会翻"；写成 var(--ui-p-600)
     纯属巧合（墨黑时两者恰好同色）。其余槽位优先认主色阶。 */
  function asTokenRef(hex, index, preferNeutral) {
    var list = index;
    if (preferNeutral) {
      list = index.filter(function (t) { return t.name.indexOf('--ui-n-') === 0; })
        .concat(index.filter(function (t) { return t.name.indexOf('--ui-n-') !== 0; }));
    }
    for (var i = 0; i < list.length; i++) {
      if (list[i].hex === hex) return 'var(' + list[i].name + ')';
    }
    return hex;
  }

  /* withHints = false 时一条注释都不留，好让整段被包进 CSS 注释里
     —— CSS 注释不能嵌套，里面只要出现一个注释结束符，后面全部内容
     就会被顶出注释区，变成真的会生效的规则。 */
  function composeThemeBlock(withHints) {
    var index = buildTokenIndex();
    var lines = [];
    RAMP_STEPS.forEach(function (s) {
      var hex = cssHex('--ui-p-' + s);
      /* 中性墨黑刻意没有 800 / 900 档（状态往浅走、深色模式整体反白，两档用不上），
         缺档就整行不写，不留一个「--ui-p-900: ;」的坏声明。 */
      if (!hex) return;
      lines.push('  ' + padRight('--ui-p-' + s + ':', 12) + ' ' + padRight(hex + ';', 10)
        + (withHints ? ' /* ' + EXPORT_STEP_HINT[s] + ' */' : ''));
    });
    lines.push('');
    if (withHints) {
      lines.push('  /* 语义槽位：能对上 L1 色阶的写 var() 引用（改色阶自动跟随），');
      lines.push('     对不上的写具体色值（自定义色的深色主色是算出来的，本来就没有对应档位）。 */');
    }
    EXPORT_SLOTS.forEach(function (slot) {
      var value = cssVar(slot[0]);
      if (!value) return;
      var out = isHex6(value) ? asTokenRef(value.toUpperCase(), index, !!slot[2]) : value;
      lines.push('  ' + padRight(slot[0] + ':', 30) + ' ' + out + ';'
        + (withHints ? '  /* ' + slot[1] + ' */' : ''));
    });
    return lines.join('\n');
  }

  /* 导出必须在浅色下算，哪怕用户此刻正在看深色。
     原因：深色块会把 --ui-primary-hover / active / text 这三个槽位重映射到
     对应的 --ui-primary-dark-*。深色预览下直接读，写进文件的就是
     「浅色模式的 hover 取 300 档」「浅色模式的主色底配墨字」——
     后者对品蓝来说是 3.5:1，直接违反 4.5:1 门槛。
     同步翻转属性 → 算完 → 同步还原，中间不让出主线程，所以屏幕上不会闪。 */
  function withLightTheme(fn) {
    if (currentTheme() === 'light') return fn();
    var had = root.getAttribute('data-ui-theme');
    root.setAttribute('data-ui-theme', 'light');
    try {
      return fn();
    } finally {
      if (had === null) root.removeAttribute('data-ui-theme');
      else root.setAttribute('data-ui-theme', had);
    }
  }

  /* 对外入口：先把"用户此刻在看哪一版"记下来（翻转之后就读不到了），
     再在浅色下把整个文件算出来。 */
  function buildThemeCss() {
    var preview = themeLabel();
    return withLightTheme(function () { return composeThemeCss(preview); });
  }
  function composeThemeCss(previewTheme) {
    var head = [
      '/* ============================================================',
      '   OwnUI · 主题快照 — ' + accentLabel(),
      '   ------------------------------------------------------------',
      '   由 OwnUI 文档站导出 · ' + todayStamp() + ' · 导出时预览主题 ' + previewTheme,
      '',
      '   用法：放在 tokens.css 之后，然后在 <html> 上写 data-ui-accent="brand"。',
      '   本文件与深浅色无关：浅色槽位和深色槽位都在这里，切主题即换一套。',
      '',
      '   ── 为什么选择器长这样 ──────────────────────────────────────',
      '   :root:where([data-ui-accent="brand"])',
      '',
      '   :where() 的权重恒为 0，所以整条选择器只有 :root 的 0,1,0。这是刻意的，',
      '   而且必须如此 —— tokens.css 里深色块（:root[data-ui-theme="dark"] 与',
      '   @media 里那条 auto）是 0,2,0，它们负责把下面这三个浅色槽位改指到',
      '   --ui-primary-dark-*。',
      '',
      '   若把这里写成 :root[data-ui-accent="brand"]（0,2,0），本文件是后引入的，',
      '   就会反过来压住深色块，症状是深色模式下：hover 还是那个深蓝、主按钮',
      '   仍然是白字（在浅色主色底上只剩 2:1）、weak 淡底用错档。',
      '   权重保持 0,1,0，深色块就能照常接管；同时因为与 tokens.css 的 :root',
      '   同权重且在后，浅色模式下又能盖住它给的默认值。',
      '',
      '   另外它带上 data-ui-accent="brand" 这个作用域，是为了与内置预设共存：',
      '   预设匹配的是 blue / indigo / … 这些值，brand 谁也不匹配，',
      '   于是切一下属性就能在「这一份」和「预设」之间来回，不必删文件。',
      '   ============================================================ */'
    ].join('\n');

    var active = ':root:where([data-ui-accent="brand"]) {\n' + composeThemeBlock(true) + '\n}';

    var direct = [
      '/* ---------------- 直改版（可选） ----------------',
      '   不想在 <html> 上写属性？把下面 :root { … } 那一段两端的注释符去掉就行，',
      '   取值与上面完全一致，只是省去了逐档注释（否则没法整段注释起来）。',
      '   权重同样是 0,1,0，所以深色块照常接管那三个浅色槽位 —— 这一点两边一致。',
      '   ⚠ 它没有作用域，会连默认的中性主题一起盖掉，与内置预设二选一。',
      '',
      ':root {',
      composeThemeBlock(false),
      '}',
      '------------------------------------------------- */'
    ].join('\n');

    return head + '\n\n' + active + '\n\n' + direct + '\n';
  }

  /* 给设计侧的那一份。value 一律是解析后的最终色值（不是 var()），
     Tokens Studio / Style Dictionary 都不认 CSS 变量引用。 */
  function buildThemeJson() { return withLightTheme(composeThemeJson); }
  function composeThemeJson() {
    var color = {};
    RAMP_STEPS.forEach(function (s) {
      var hex = cssHex('--ui-p-' + s);
      if (!hex) return;
      color[String(s)] = { value: hex, type: 'color', $description: EXPORT_STEP_HINT[s] };
    });
    EXPORT_SLOTS.forEach(function (slot) {
      var hex = cssHex(slot[0]);
      if (!hex) return;
      color[slot[0].slice('--ui-primary-'.length)] = { value: hex, type: 'color', $description: slot[1] };
    });
    var doc = {
      $description: 'OwnUI 主题快照 · ' + accentLabel() + ' · ' + todayStamp()
        + '。深色系列（dark-*）的值就是深色模式下的取值，浅色系列同理，'
        + '不需要再按主题拆两份。'
    };
    doc.color = { primary: color };
    return JSON.stringify(doc, null, 2) + '\n';
  }
  function buildShareLink() {
    var cur = currentAccent();
    var parts = ['accent=' + encodeURIComponent(cur)];
    if (cur === 'custom') {
      var hex = cssHex('--ui-p-600');
      if (hex) parts.push('c=' + encodeURIComponent(hex));
    }
    if (currentTheme() === 'dark') parts.push('theme=dark');
    /* 用 split 而不是 origin + pathname：file:// 下 origin 是字符串 "null"，
       拼出来会得到 "null/..." 这种打不开的地址。 */
    return location.href.split('#')[0] + '#' + parts.join('&');
  }

  /* ---------- 交出文件 ---------- */
  function downloadBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    UI.toast({ message: '已开始下载 ' + filename, type: 'success', duration: 2000 });
  }
  function saveFile(filename, data, mime) {
    var isText = typeof data === 'string';
    var blob = new Blob([data], { type: isText ? mime + ';charset=utf-8' : mime });
    if (typeof window.showSaveFilePicker !== 'function') return downloadBlob(filename, blob);
    /* 刻意不传 types：Chrome 会校验「suggestedName 的扩展名必须在 accept 里」，
       而 .css / .json 都只能挂在 text/plain 下，多写一处就多一个对不上的机会。
       不传就允许任意扩展名，行为与普通另存为一致。 */
    return window.showSaveFilePicker({ suggestedName: filename }).then(function (handle) {
      return handle.createWritable();
    }).then(function (writable) {
      return writable.write(blob).then(function () { return writable.close(); });
    }).then(function () {
      UI.toast({ message: '已保存 ' + filename, type: 'success', duration: 2000 });
    }).catch(function (err) {
      /* 用户自己在对话框里点了取消 —— 不是失败，既不报错也不偷偷改走下载 */
      if (err && err.name === 'AbortError') return;
      downloadBlob(filename, blob);
    });
  }

  /* ---------- starter.zip：手写一个最小 ZIP writer ----------
     ZIP 规范里 method 0 = store（不压缩）完全合法，而我们打包的全是几 KB 的
     文本，压不压毫无意义。Store 换来的好处是同步、零依赖：走 CompressionStream
     得用流 + 异步，还得自己拼 method 8 的头，多出来的复杂度一个字节也换不回来。

     结构（顺序不能动，中央目录里记的偏移量只要差一格，解压器就会拒绝）：
       每个文件 → 本地头(30B) + 文件名 + 数据
       然后     → 中央目录（每项 46B + 文件名）
       最后     → EOCD(22B) */
  var CRC32_TABLE = (function () {
    var table = new Uint32Array(256), c, i, k;
    for (i = 0; i < 256; i++) {
      c = i;
      for (k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC32_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zipStore(files) {
    var enc = new TextEncoder();
    var d = new Date();
    /* DOS 时间戳：日期从 1980 年起算，秒只有 2 秒精度（规范如此，不是取整失误） */
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = (((d.getFullYear() - 1980) & 0x7F) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

    var chunks = [], dir = [], offset = 0;
    files.forEach(function (f) {
      var name = enc.encode(f.name);
      var data = enc.encode(f.text);
      var crc = crc32(data);
      var local = [].concat(u32(0x04034B50), u16(20), u16(0x0800), u16(0),
        u16(time), u16(date), u32(crc), u32(data.length), u32(data.length),
        u16(name.length), u16(0));
      chunks.push(new Uint8Array(local), name, data);
      dir.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + name.length + data.length;
    });

    var dirStart = offset;
    dir.forEach(function (e) {
      var header = [].concat(u32(0x02014B50), u16(20), u16(20), u16(0x0800), u16(0),
        u16(time), u16(date), u32(e.crc), u32(e.size), u32(e.size),
        u16(e.name.length), u16(0), u16(0), u16(0), u16(0), u32(0x20), u32(e.offset));
      chunks.push(new Uint8Array(header), e.name);
      offset += header.length + e.name.length;
    });
    chunks.push(new Uint8Array([].concat(u32(0x06054B50), u16(0), u16(0),
      u16(dir.length), u16(dir.length), u32(offset - dirStart), u32(dirStart), u16(0))));

    var total = 0;
    chunks.forEach(function (c) { total += c.length; });
    var out = new Uint8Array(total), at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }

  /* 打包进 zip 的源文件。路径以 docs/ 为基准 —— zip 里换到 ownui/ 目录下，
     theme.css 与它们同放，示例页按相对路径引用才不会散架。 */
  var STARTER_SOURCES = [
    ['ownui/tokens.css', '../library/tokens.css'],
    ['ownui/base.css', '../library/base.css'],
    ['ownui/components.css', '../library/components.css'],
    ['ownui/components.js', '../library/components.js'],
    ['ownui/tokens.json', '../library/tokens.json']
  ];

  function fetchText(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
      return res.text();
    });
  }
  /* 探一个就够：五个文件同源同目录，能读一个就能读全部。 */
  function probeExportSource() {
    if (exportSourceReady !== null) return Promise.resolve(exportSourceReady);
    return fetchText('../library/tokens.css').then(function (text) {
      exportSourceReady = text.indexOf('--ui-primary') >= 0;
      return exportSourceReady;
    }, function () {
      exportSourceReady = false;
      return false;
    });
  }

  function starterDemo() {
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN" data-ui-theme="light" data-ui-accent="brand">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>OwnUI · 接入示例</title>',
      '<!-- 顺序别调：tokens 定义变量 → base 定页面基线 → components 用它们，',
      '     ownui-theme 最后进来覆盖主色阶（它必须排在 tokens 之后）。 -->',
      '<link rel="stylesheet" href="ownui/tokens.css">',
      '<link rel="stylesheet" href="ownui/base.css">',
      '<link rel="stylesheet" href="ownui/components.css">',
      '<link rel="stylesheet" href="ownui/ownui-theme.css">',
      '</head>',
      '<body>',
      '<div class="ui-container ui-section ui-stack ui-stack--8">',
      '',
      '  <header class="ui-row ui-row--between">',
      '    <div>',
      '      <span class="ui-badge ui-badge--primary">OwnUI Starter</span>',
      '      <h1 class="ui-h1 u-mt-3">接入示例</h1>',
      '      <p class="ui-lead ui-mt-2 ui-prose">这一页只引了 library 的四个文件加一份主题，没有构建、没有依赖、没有 node_modules。</p>',
      '    </div>',
      '    <button class="ui-btn ui-btn--default" type="button" id="themeBtn">切换深浅色</button>',
      '  </header>',
      '',
      '  <section class="ui-card">',
      '    <div class="ui-card__header">',
      '      <div>',
      '        <div class="ui-card__title">主色已经生效</div>',
      '        <div class="ui-card__desc">下面所有控件的主色都来自 <code class="ui-code">ownui/ownui-theme.css</code>，改它一处，全站跟着走。</div>',
      '      </div>',
      '    </div>',
      '    <div class="ui-card__body ui-cluster ui-cluster--3">',
      '      <button class="ui-btn ui-btn--primary" type="button" id="toastBtn">主操作</button>',
      '      <button class="ui-btn ui-btn--default" type="button" id="modalBtn">打开弹窗</button>',
      '      <button class="ui-btn ui-btn--ghost" type="button">幽灵按钮</button>',
      '      <button class="ui-btn ui-btn--danger-outline" type="button">危险描边</button>',
      '      <span class="ui-badge ui-badge--primary">标签</span>',
      '      <span class="ui-status ui-status--info"><span class="ui-dot" style="background: var(--ui-primary)"></span>进行中</span>',
      '    </div>',
      '    <div class="ui-card__footer ui-cluster ui-cluster--4">',
      '      <div class="ui-field" style="min-width: 220px">',
      '        <label class="ui-label" for="demoName">名称</label>',
      '        <input class="ui-input" id="demoName" type="text" placeholder="给项目起个名字">',
      '        <div class="ui-help">它的焦点环与描边也用的是主色</div>',
      '      </div>',
      '      <div class="ui-switch">',
      '        <input type="checkbox" id="demoSwitch" checked>',
      '        <span class="ui-switch__track"></span>',
      '        <label class="ui-switch__label" for="demoSwitch">开关</label>',
      '      </div>',
      '      <div class="ui-progress" style="width: 160px"><div class="ui-progress__bar" style="width: 62%"></div></div>',
      '    </div>',
      '  </section>',
      '',
      '  <p class="ui-caption ui-subtle">完整组件清单与用法在仓库的 <code class="ui-code">docs/index.html</code>。</p>',
      '</div>',
      '',
      '<div class="ui-modal" id="demoModal" role="dialog" aria-modal="true" aria-labelledby="demoModalTitle" aria-hidden="true">',
      '  <div class="ui-modal__dialog">',
      '    <div class="ui-modal__header">',
      '      <div class="ui-modal__title" id="demoModalTitle">弹窗也是零依赖的</div>',
      '      <button class="ui-icon-btn ui-icon-btn--sm" type="button" data-ui-close aria-label="关闭">',
      '        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
      '      </button>',
      '    </div>',
      '    <div class="ui-modal__body">',
      '      <p class="ui-text-sm ui-muted">焦点陷阱、ESC 关闭、遮罩点击关闭、关闭后焦点归还，都在 components.js 里，你只写结构和 data 属性。</p>',
      '    </div>',
      '    <div class="ui-modal__footer">',
      '      <button class="ui-btn ui-btn--default" type="button" data-ui-close>知道了</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<script src="ownui/components.js"></script>',
      '<script>',
      '  UI.init();',
      '  document.getElementById("themeBtn").addEventListener("click", function () {',
      '    var el = document.documentElement;',
      '    el.setAttribute("data-ui-theme", el.getAttribute("data-ui-theme") === "dark" ? "light" : "dark");',
      '  });',
      '  document.getElementById("toastBtn").addEventListener("click", function () {',
      '    UI.toast({ message: "主色换了，我也跟着换", type: "success" });',
      '  });',
      '  document.getElementById("modalBtn").addEventListener("click", function () {',
      '    UI.modal.open("#demoModal");',
      '  });',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n') + '\n';
  }

  /* 完整样板页：golden.html
     它和 index.html 的分工不同 —— 那个证明「能跑起来」，这个证明「一整页
     该怎么组织」：导航、指标、卡片、表格、表单、弹窗，以及事件怎么接。
     AI 最擅长模仿而不是推导，所以一份正确的全页比十条规则都管用。
     这份同时也是自检页「正确示例」的同源参照，别写过时的写法。 */
  function goldenPage() {
    return [
      '<!DOCTYPE html>',
      '<html lang="zh-CN" data-ui-theme="light" data-ui-accent="brand">',
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      '<title>成员管理 · OwnUI 样板页</title>',
      '<!-- 顺序不可颠倒：tokens 定义变量 → base 定页面基线 → components 用它们；',
      '     ownui-theme 放最末，它要覆盖主色阶，必须排在 tokens 之后。 -->',
      '<link rel="stylesheet" href="ownui/tokens.css">',
      '<link rel="stylesheet" href="ownui/base.css">',
      '<link rel="stylesheet" href="ownui/components.css">',
      '<link rel="stylesheet" href="ownui/ownui-theme.css">',
      '</head>',
      '<body>',
      '',
      '<!-- 顶部导航。窄屏时 .ui-nav 会隐藏，导航落进抽屉（data-navbar-drawer 指过去）。 -->',
      '<header class="ui-navbar" data-ui="navbar" data-navbar-drawer="#navDrawer">',
      '  <div class="ui-container ui-container--wide ui-navbar__inner">',
      '    <a class="ui-navbar__brand" href="#">',
      '      <span class="ui-navbar__logo" aria-hidden="true">',
      '        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.55" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
      '      </span>',
      '      Acme',
      '    </a>',
      '    <nav class="ui-nav" aria-label="主导航">',
      '      <a class="ui-nav__link" href="#" aria-current="page">成员</a>',
      '      <a class="ui-nav__link" href="#">计费</a>',
      '      <a class="ui-nav__link" href="#">设置</a>',
      '    </nav>',
      '    <div class="ui-navbar__actions">',
      '      <button class="ui-btn ui-btn--primary ui-btn--sm" type="button"',
      '              data-ui="modal" data-target="#inviteModal">邀请成员</button>',
      '      <button class="ui-icon-btn ui-navbar__toggle" type="button"',
      '              data-ui-navbar-toggle aria-expanded="false" aria-label="打开导航">',
      '        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h14M3 10h14M3 14h14"/></svg>',
      '      </button>',
      '    </div>',
      '  </div>',
      '</header>',
      '',
      '<!-- 窄屏导航抽屉 -->',
      '<div class="ui-drawer ui-drawer--left" id="navDrawer" role="dialog" aria-modal="true" aria-label="导航" aria-hidden="true">',
      '  <div class="ui-drawer__panel">',
      '    <div class="ui-drawer__header">',
      '      <div class="ui-drawer__title">导航</div>',
      '      <button class="ui-icon-btn" type="button" data-ui-close aria-label="关闭">',
      '        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg>',
      '      </button>',
      '    </div>',
      '    <div class="ui-drawer__body">',
      '      <nav class="ui-sidenav ui-sidenav" aria-label="站点导航">',
      '        <a class="ui-sidenav__item" href="#" aria-current="page">成员</a>',
      '        <a class="ui-sidenav__item" href="#">计费</a>',
      '        <a class="ui-sidenav__item" href="#">设置</a>',
      '      </nav>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<main class="ui-container ui-section ui-stack ui-stack--8">',
      '',
      '  <!-- 区块标题 -->',
      '  <header class="ui-section-header">',
      '    <h1 class="ui-section-header__title">成员</h1>',
      '    <p class="ui-section-header__desc">共 3 人。角色决定可见范围，改动即时生效。</p>',
      '  </header>',
      '',
      '  <!-- 指标条：三个并列统计。数字列加 ui-num 保证等宽对齐。 -->',
      '  <div class="ui-grid ui-grid--3 ui-grid--tight">',
      '    <div class="ui-stat">',
      '      <div class="ui-stat__label">总成员</div>',
      '      <div class="ui-stat__value ui-num">3</div>',
      '    </div>',
      '    <div class="ui-stat">',
      '      <div class="ui-stat__label">本月新增</div>',
      '      <div class="ui-stat__value ui-num">2</div>',
      '      <div class="ui-stat__caption"><span class="ui-stat__trend ui-stat__trend--up">+2</span> 较上月</div>',
      '    </div>',
      '    <div class="ui-stat">',
      '      <div class="ui-stat__label">待接受邀请</div>',
      '      <div class="ui-stat__value ui-num">1</div>',
      '    </div>',
      '  </div>',
      '',
      '  <!-- 主内容卡：工具栏 + 表格 -->',
      '  <div class="ui-card">',
      '    <div class="ui-card__header">',
      '      <div class="ui-card__title">全部成员</div>',
      '      <div class="ui-card__desc">点表头可排序</div>',
      '    </div>',
      '    <div class="ui-card__body ui-stack ui-stack--4">',
      '      <div class="ui-toolbar">',
      '        <div class="ui-toolbar__group">',
      '          <input class="ui-input ui-input--sm" type="search" placeholder="搜索姓名或邮箱" aria-label="搜索成员">',
      '        </div>',
      '        <div class="ui-toolbar__spacer"></div>',
      '        <div class="ui-toolbar__group">',
      '          <button class="ui-btn ui-btn--ghost ui-btn--sm" type="button" id="exportBtn">导出</button>',
      '        </div>',
      '      </div>',
      '',
      '      <div class="ui-table-wrap" data-ui="table-sort">',
      '        <table class="ui-table">',
      '          <thead>',
      '            <tr>',
      '              <th><button class="ui-table__sort" type="button" data-sort="0" aria-sort="none">姓名</button></th>',
      '              <th><button class="ui-table__sort" type="button" data-sort="1" aria-sort="none">角色</button></th>',
      '              <th><button class="ui-table__sort" type="button" data-sort="2" aria-sort="none">最近登录</button></th>',
      '              <th><span class="ui-caption ui-muted">操作</span></th>',
      '            </tr>',
      '          </thead>',
      '          <tbody>',
      '            <tr>',
      '              <td>李工</td>',
      '              <td><span class="ui-badge ui-badge--primary">管理员</span></td>',
      '              <td class="ui-num">2 小时前</td>',
      '              <td><button class="ui-btn ui-btn--ghost ui-btn--sm" type="button">编辑</button></td>',
      '            </tr>',
      '            <tr>',
      '              <td>王工</td>',
      '              <td><span class="ui-badge">开发者</span></td>',
      '              <td class="ui-num">3 天前</td>',
      '              <td><button class="ui-btn ui-btn--ghost ui-btn--sm" type="button">编辑</button></td>',
      '            </tr>',
      '            <tr>',
      '              <td>赵工</td>',
      '              <td><span class="ui-status ui-status--warning"><span class="ui-dot"></span>待接受</span></td>',
      '              <td class="ui-num">—</td>',
      '              <td><span class="ui-popconfirm-host" data-ui="popconfirm"',
      '                        data-popconfirm-title="确认撤回这条邀请？"',
      '                        data-popconfirm-desc="撤回后对方手上的链接立即失效，需要重新邀请。"',
      '                        data-popconfirm-ok="撤回">',
      '                <button class="ui-btn ui-btn--danger-outline ui-btn--sm" type="button" data-ui="popconfirm-trigger">撤回</button>',
      '              </span></td>',
      '            </tr>',
      '          </tbody>',
      '        </table>',
      '      </div>',
      '',
      '      <!-- 提示条负责持续可见的状态说明，一次性反馈才用 toast -->',
      '      <div class="ui-alert ui-alert--info">',
      '        <span class="ui-alert__icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.4v.6"/></svg></span>',
      '        <div class="ui-alert__body">',
      '          <div class="ui-alert__title">还有 1 条邀请未被接受</div>',
      '          <div class="ui-alert__desc">邀请链接 24 小时后失效。失效后需要重新发送。</div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '',
      '</main>',
      '',
      '<!-- 邀请弹窗。三件套 role / aria-modal / aria-labelledby 一个都不能少。 -->',
      '<div class="ui-modal" id="inviteModal" role="dialog" aria-modal="true"',
      '     aria-labelledby="inviteTitle" aria-hidden="true">',
      '  <div class="ui-modal__dialog">',
      '    <div class="ui-modal__header">',
      '      <div class="ui-modal__title" id="inviteTitle">邀请成员</div>',
      '      <button class="ui-icon-btn ui-icon-btn--sm" type="button" data-ui-close aria-label="关闭">',
      '        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"/></svg>',
      '      </button>',
      '    </div>',
      '    <div class="ui-modal__body">',
      '      <div class="ui-field">',
      '        <label class="ui-label" for="inviteEmail">邮箱 <span class="ui-label__required">*</span></label>',
      '        <input class="ui-input" id="inviteEmail" type="email" placeholder="name@company.com">',
      '        <div class="ui-help">对方会收到一封含 24 小时有效链接的邮件。</div>',
      '      </div>',
      '    </div>',
      '    <div class="ui-modal__footer">',
      '      <button class="ui-btn ui-btn--default" type="button" data-ui-close>取消</button>',
      '      <button class="ui-btn ui-btn--primary" type="button" id="inviteOk">发送邀请</button>',
      '    </div>',
      '  </div>',
      '</div>',
      '',
      '<script src="ownui/components.js"></script>',
      '<script>',
      '  /* 行为都通过 ui:* 自定义事件广播，这里是原生接法。',
      '     换到 Vue / React 里就是 @ui:sort 或 addEventListener，逻辑一样。 */',
      '  document.querySelector("[data-ui=\\"table-sort\\"]").addEventListener("ui:sort", function (e) {',
      '    UI.toast({',
      '      message: "已按第 " + (e.detail.index + 1) + " 列" +',
      '               (e.detail.direction === "ascending" ? "升序" : "降序") + "排列",',
      '      duration: 1600',
      '    });',
      '  });',
      '',
      '  document.getElementById("exportBtn").addEventListener("click", function () {',
      '    UI.toast({ message: "已开始导出", type: "success", description: "完成后会发到你的邮箱。" });',
      '  });',
      '',
      '  document.getElementById("inviteOk").addEventListener("click", function () {',
      '    var email = document.getElementById("inviteEmail");',
      '    if (!email.value.trim()) {',
      '      email.setAttribute("aria-invalid", "true");',
      '      email.classList.add("is-invalid");',
      '      UI.toast({ message: "请先填写邮箱", type: "danger" });',
      '      email.focus();',
      '      return;',
      '    }',
      '    UI.modal.close("#inviteModal");',
      '    UI.toast({ message: "邀请已发送", type: "success", description: "对方接受后会自动加入。" });',
      '  });',
      '</script>',
      '</body>',
      '</html>'
    ].join('\n');
  }

  function starterReadme() {
    return [
      '# OwnUI Starter',
      '',
      '解压后直接用浏览器打开 `index.html` 就能看，不需要构建、不需要装依赖。',
      '',
      '## 目录',
      '',
      '| 文件 | 说明 |',
      '| --- | --- |',
      '| `index.html` | 最小接入示例，从这里开始改 |',
      '| `golden.html` | 一整页完整样板：导航、指标、表格、表单、弹窗与事件接线 |',
      '| `AGENTS.md` | **给 AI 的规则**：禁止清单、Token 契约、决策表、15 个组件的完整片段 |',
      '| `ownui.spec.json` | 组件契约的机器读版本，AI 按需取用 |',
      '| `llms.txt` | 索引，供抓站场景使用 |',
      '| `ownui/tokens.css` | 全部设计 Token，三层结构：L1 原始 → L2 语义 → L3 组件 |',
      '| `ownui/base.css` | 重置与排版基线 |',
      '| `ownui/components.css` | 组件样式 |',
      '| `ownui/components.js` | 组件行为，原生 JS，导出 `window.UI` |',
      '| `ownui/ownui-theme.css` | 本次导出的主色主题 |',
      '| `ownui/tokens.json` | 同一套 Token 的 JSON 版，给设计侧用 |',
      '',
      '## 让 AI 照着写',
      '',
      '`AGENTS.md` 放在项目根目录就行 —— 多数编码助手（CodeBuddy、Claude Code、Cursor 等）',
      '会自动读取它。`ownui.spec.json` 与它同级，AI 要查某个组件的准确类名时再读。',
      '',
      '这一步不做的话，AI 会按它的先验生成 Bootstrap 或 Tailwind 的类名：',
      '`container` / `d-flex` / `btn-primary` 在这套库里全都不存在，写了不报错，只是完全不生效。',
      '',
      '改完自己的代码，可以回文档站的「自检」页把 HTML 贴进去，逐条对照规范查一遍。',
      '',
      '## 接入',
      '',
      '`ownui-theme.css` 必须排在 `tokens.css` 之后，其余顺序按下面这个来：',
      '',
      '```html',
      '<link rel="stylesheet" href="ownui/tokens.css">',
      '<link rel="stylesheet" href="ownui/base.css">',
      '<link rel="stylesheet" href="ownui/components.css">',
      '<link rel="stylesheet" href="ownui/ownui-theme.css">',
      '',
      '<script src="ownui/components.js"><\/script>',
      '<script>UI.init();<\/script>',
      '```',
      '',
      '`<html>` 上两个属性控制全局外观：',
      '',
      '```html',
      '<html data-ui-theme="light" data-ui-accent="brand">',
      '```',
      '',
      '- `data-ui-theme`：`light` / `dark`；',
      '- `data-ui-accent`：`brand` 就是这一版配色，删掉这个属性即回到默认的中性墨黑。',
      '',
      '## 改颜色',
      '',
      '微调：直接改 `ownui/ownui-theme.css` 里的 `--ui-p-*`。档位契约是'
        + ' 600 = 主色、700 = hover、800 = active、900 = 深色模式的淡底。',
      '',
      '换一整套：回文档站的「主色配置」重新导出，覆盖同名文件即可。'
        + '`tokens.css` 里还内置了 blue / indigo / emerald / orange / violet 五套预设，'
        + '把 `data-ui-accent` 改成它们的名字就能试。',
      '',
      '## 约定',
      '',
      '- 组件只引用 L2 语义层（`--ui-primary`、`--ui-text-2` …），永远不写死色值；',
      '- 换肤只覆盖 L1 色阶与 L2 主色槽位，组件样式一行都不用动；',
      '- 状态方向：品牌色的 hover / active 往「更深」走，中性墨黑是唯一例外（往浅走），'
        + '否则加深肉眼看不出来。',
      '',
      '## 许可证',
      '',
      'OwnUI 基于 [MIT](LICENSE) 协议开源，本 starter 内已附带 LICENSE 文件。',
      '可以自由使用、修改、再分发、商用，唯一要求是保留版权与许可声明。',
      ''
    ].join('\n');
  }

  /* MIT 全文内嵌一份，starter.zip 里随包携带（约 1KB，store 模式不压缩也不心疼） */
  var MIT_LICENSE_TEXT = [
    'MIT License',
    '',
    'Copyright (c) 2026 Yue-Zeyi',
    '',
    'Permission is hereby granted, free of charge, to any person obtaining a copy',
    'of this software and associated documentation files (the "Software"), to deal',
    'in the Software without restriction, including without limitation the rights',
    'to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
    'copies of the Software, and to permit persons to whom the Software is',
    'furnished to do so, subject to the following conditions:',
    '',
    'The above copyright notice and this permission notice shall be included in all',
    'copies or substantial portions of the Software.',
    '',
    'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
    'IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
    'FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE',
    'AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
    'LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
    'OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE',
    'SOFTWARE.'
  ].join('\n');

  /* 给 AI 的那几份。它们在内存里生成，不走 fetch —— 所以 content 部分
     随便什么环境都能出，file:// 下不可用的只有需要读源码的 library/。
     少了这一步，导出的就只是一套「看得见」的样式，而不是「能让 AI 照着写」的规范。 */
  function aiBundle() {
    var spec = window.OwnUISpec;
    var ai = window.OwnUIAI;
    if (!spec || !ai) return [];
    return [
      { name: 'AGENTS.md', text: ai.renderAgentsMd(spec) },
      { name: 'llms.txt', text: ai.renderLlmsTxt(spec) },
      { name: 'ownui.spec.json', text: ai.renderSpecJson(spec) }
    ];
  }

  function buildStarterZip() {
    var jobs = STARTER_SOURCES.map(function (pair) {
      return fetchText(pair[1]).then(function (text) { return { name: pair[0], text: text }; });
    });
    return Promise.all(jobs).then(function (files) {
      return zipStore([
        { name: 'README.md', text: starterReadme() },
        { name: 'index.html', text: starterDemo() },
        { name: 'golden.html', text: goldenPage() },
        /* 协议跟着 starter 走：用户拿它再分发时不必回头找源头 */
        { name: 'LICENSE', text: MIT_LICENSE_TEXT },
        /* 规范放在项目根：AGENTS.md 是多数编码助手会自动读的位置，
           spec.json 与它同级便于互相引用。 */
        { name: 'ownui/ownui-theme.css', text: buildThemeCss() }
      ].concat(aiBundle(), files));
    });
  }

  /* ---------- 面板接线 ---------- */
  function refreshExportPanel() {
    if (!exportCodeEl) return;
    var css = buildThemeCss();
    exportCodeEl.textContent = css;
    if (exportLabelEl) exportLabelEl.textContent = accentLabel() + ' · ' + themeLabel();
    if (exportLinesEl) exportLinesEl.textContent = '· ' + css.split('\n').length + ' 行';
  }

  function setZipEnabled(on) {
    if (!exportZipBtn) return;
    exportZipBtn.disabled = !on;
    exportZipBtn.setAttribute('aria-disabled', on ? 'false' : 'true');
    exportZipBtn.title = on ? '' : '需要 http(s) 环境才能打包源码，原因见下方说明';
    if (exportWarnEl) exportWarnEl.hidden = on;
  }

  function runZipExport(btn) {
    btn.classList.add('is-loading');
    var guard = false;
    probeExportSource().then(function (ok) {
      if (!ok) { guard = true; return null; }
      return buildStarterZip();
    }).then(function (bytes) {
      if (!bytes) return;
      saveFile('ownui-starter.zip', bytes, 'application/zip');
    }).catch(function (err) {
      UI.toast({
        message: '打包失败：' + (err && err.message ? err.message : '未知错误'),
        type: 'danger', duration: 4200
      });
    }).then(function () {
      btn.classList.remove('is-loading');
      if (guard) setZipEnabled(false);
      else btn.disabled = false;
    });
  }

  if (exportPanel) {
    exportSync = refreshExportPanel;
    refreshExportPanel();

    exportPanel.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-export-copy],[data-export-css],[data-export-json],[data-export-zip],[data-export-link]');
      if (!btn || btn.disabled) return;

      if (btn.hasAttribute('data-export-copy')) {
        var css = buildThemeCss();
        UI.copy(css).then(function (ok) {
          UI.toast({
            message: ok ? 'ownui-theme.css 已复制（' + css.split('\n').length + ' 行）'
                        : '复制失败，请在预览里手动全选',
            type: ok ? 'success' : 'danger', duration: 2400
          });
        });
        return;
      }
      if (btn.hasAttribute('data-export-css')) {
        saveFile('ownui-theme.css', buildThemeCss(), 'text/css');
        return;
      }
      if (btn.hasAttribute('data-export-json')) {
        saveFile('ownui-tokens.json', buildThemeJson(), 'application/json');
        return;
      }
      if (btn.hasAttribute('data-export-link')) {
        var link = buildShareLink();
        UI.copy(link).then(function (ok) {
          /* 复制失败时把链接原文亮出来 —— 提示里带链接，用户还能手动复制 */
          UI.toast({
            message: ok ? '分享链接已复制：' + link : '复制失败，链接是 ' + link,
            type: ok ? 'success' : 'warning', duration: 5000
          });
        });
        return;
      }
      if (btn.hasAttribute('data-export-zip')) runZipExport(btn);
    });

    /* 延后探测：结论只影响一个按钮，不值得跟首屏抢带宽。
       600ms 足够让样式表与字体先落地，又远早于用户可能点到它。 */
    setTimeout(function () {
      probeExportSource().then(function (ok) { setZipEnabled(ok); });
    }, 600);
  }

  /* ---------- 表单演示：把提交事件接到 Toast ---------- */
  document.querySelectorAll('[data-doc-form]').forEach(function (form) {
    form.addEventListener('ui:submit', function () {
      UI.toast({ message: '校验通过，已提交（演示）', type: 'success' });
    });
    form.addEventListener('ui:invalid', function () {
      UI.toast({ message: '请先修正标红的字段', type: 'danger' });
    });
  });

  /* ---------- 表格演示：排序后提示 ---------- */
  var sortDemo = document.querySelector('[data-doc-table]');
  if (sortDemo) {
    sortDemo.addEventListener('ui:sort', function (e) {
      UI.toast({ message: '已按第 ' + (e.detail.index + 1) + ' 列' + (e.detail.direction === 'ascending' ? '升序' : '降序') + '排列', duration: 1600 });
    });
  }

  /* ---------- 分页演示 ---------- */
  var pager = document.querySelector('[data-doc-pagination]');
  if (pager) {
    pager.addEventListener('ui:change', function (e) {
      var info = document.querySelector('[data-pagination-info]');
      if (info) info.textContent = '第 ' + e.detail.page + ' 页';
    });
  }

  /* ---------- 文件上传演示 ---------- */
  var dz = document.querySelector('[data-doc-dropzone]');
  if (dz) {
    dz.addEventListener('ui:file', function (e) {
      var n = e.detail.files.length;
      UI.toast({ message: n ? '已选择 ' + n + ' 个文件' : '未选择文件', type: n ? 'success' : 'warning' });
    });
  }

  /* ============================================================
     AI 规范页（docs/ai.html）
     ------------------------------------------------------------
     这一页的正文全部从 ownui.spec.js 渲染出来，页面里只有空容器。
     这么做的理由不是省事，是**不允许漂移**：规范若有一份手写的副本，
     改了数据源而忘了改副本，页面上就会教 AI 用不存在的类名。
     现在页面与导出文件走同一组渲染函数，二者不可能不一致。

     元素存在性守卫：其他三页没有这些容器，整段直接返回。
     ============================================================ */
  (function initAiPage() {
    var host = document.querySelector('[data-ai-forbidden]');
    if (!host) return;
    var spec = window.OwnUISpec;
    var ai = window.OwnUIAI;
    if (!spec || !ai) {
      host.innerHTML = '<div class="doc-note doc-note--warn">规范数据源没加载成功，请检查 ownui.spec.js 与 ownui.ai.js 的路径。</div>';
      return;
    }

    /* ---------- 四个产物：在内存里生成，file:// 下同样可用 ---------- */
    var ARTIFACTS = {
      agents: { name: 'AGENTS.md',        mime: 'text/markdown;charset=utf-8', text: ai.renderAgentsMd(spec) },
      llms:   { name: 'llms.txt',         mime: 'text/plain;charset=utf-8',    text: ai.renderLlmsTxt(spec) },
      full:   { name: 'llms-full.txt',    mime: 'text/plain;charset=utf-8',    text: ai.renderLlmsFull(spec) },
      spec:   { name: 'ownui.spec.json',  mime: 'application/json;charset=utf-8', text: ai.renderSpecJson(spec) }
    };

    var esc = function (s) {
      return String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    var kb = function (s) { return (new Blob([s]).size / 1024).toFixed(1) + ' KB'; };

    /* 规格表统一走这个：紧凑表格 + 横向滚动 + 等宽类名 */
    function tbl(head, rows) {
      var h = '<div class="ui-table-wrap ai-table"><table class="ui-table ui-table--compact"><thead><tr>';
      head.forEach(function (c) { h += '<th>' + esc(c) + '</th>'; });
      h += '</tr></thead><tbody>';
      rows.forEach(function (r) {
        h += '<tr>';
        r.forEach(function (c) {
          /* 约定：单元格传 {code:'x'} 走等宽样式，传字符串走普通文本 */
          if (c && typeof c === 'object' && c.code) h += '<td><code>' + esc(c.code) + '</code></td>';
          else h += '<td>' + esc(c) + '</td>';
        });
        h += '</tr>';
      });
      return h + '</tbody></table></div>';
    }
    var inline = function (s) {
      /* 把 `xxx` 与 **xxx** 转成标签，其余转义。规范文案里这两种标记用得很多。 */
      return esc(s)
        .replace(/`([^`]+)`/g, '<code class="ui-code">$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    };

    /* ---------- 产物尺寸 ---------- */
    Object.keys(ARTIFACTS).forEach(function (k) {
      var el = document.querySelector('[data-ai-size="' + k + '"]');
      if (!el) return;
      el.textContent = ARTIFACTS[k].text.split('\n').length + ' 行 · ' + kb(ARTIFACTS[k].text);
    });

    /* ---------- 复制 / 下载 ---------- */
    document.querySelectorAll('[data-ai-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = ARTIFACTS[btn.getAttribute('data-ai-copy')];
        if (!a) return;
        UI.copy(a.text).then(function (ok) {
          UI.toast({
            message: ok ? a.name + ' 已复制（' + a.text.split('\n').length + ' 行）' : '复制失败，请改用「下载」',
            type: ok ? 'success' : 'warning', duration: 4000
          });
        });
      });
    });
    document.querySelectorAll('[data-ai-download]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var a = ARTIFACTS[btn.getAttribute('data-ai-download')];
        if (!a) return;
        saveFile(a.name, a.text, a.mime);
      });
    });

    /* ---------- 禁止清单 / 必须做的事 ---------- */
    host.innerHTML = tbl(['不要写', '为什么', '改成'], spec.forbidden.map(function (f) {
      return [{ code: f.bad }, inline(f.why), inline(f.fix)];
    }));
    document.querySelector('[data-ai-required]').innerHTML =
      tbl(['规则', '漏了的后果'], spec.required.map(function (r) { return [inline(r.rule), inline(r.why)]; }));

    /* ---------- Token 三层 + 常用 token ---------- */
    document.querySelector('[data-ai-token-layers]').innerHTML =
      tbl(['层', '名字', '前缀', '作用', '你什么时候碰它'], spec.tokens.layers.map(function (t) {
        return [t.id, t.name, { code: t.prefix }, inline(t.role), inline(t.useIn)];
      })) +
      '<div class="doc-note">' + inline(spec.tokens.priority) + '</div>';

    document.querySelector('[data-ai-token-common]').innerHTML =
      tbl(['token', '用途'], spec.tokens.common.map(function (t) { return [{ code: t.token }, inline(t.use)]; }));

    /* ---------- 状态方向 ---------- */
    document.querySelector('[data-ai-state]').innerHTML =
      '<div class="doc-note">' + inline(spec.stateDirection.summary) + '</div>' +
      tbl(['档位', '角色'], spec.stateDirection.ramp.map(function (r) {
        return [{ code: '--ui-p-' + r.step }, inline(r.role)];
      })) +
      '<div class="doc-note">' + spec.stateDirection.exceptions.map(function (s) { return '· ' + inline(s); }).join('<br>') + '</div>';

    /* ---------- 刻度 ---------- */
    document.querySelector('[data-ai-scales]').innerHTML =
      '<div class="doc-note">' + inline(spec.scales.space.note) + '</div>' +
      tbl(['间距 token', '值', '典型用途'], spec.scales.space.steps.map(function (s) {
        return [{ code: s.token }, s.px + 'px', inline(s.use)];
      })) +
      '<div class="doc-note">' + inline(spec.scales.radius.note) + '</div>' +
      tbl(['圆角 token', '值', '用途'], spec.scales.radius.steps.map(function (s) {
        return [{ code: s.token }, s.px + 'px', inline(s.use)];
      })) +
      '<div class="doc-note">' + inline(spec.scales.fontSize.note) + '</div>' +
      tbl(['档位 token', '值', '语义 token', '用途'], spec.scales.fontSize.steps.map(function (s) {
        return [{ code: s.token }, s.px + 'px', s.semantic ? { code: s.semantic } : '—', inline(s.use)];
      }));

    /* ---------- 决策表 ---------- */
    document.querySelector('[data-ai-decisions]').innerHTML =
      tbl(['场景', '用', '不要用'], spec.decisions.map(function (d) {
        return [inline(d.scene), inline(d.use), inline(d.avoid)];
      }));

    /* ---------- 组件速查 ---------- */
    var comps = ai.allComponents(spec);
    document.querySelector('[data-ai-components]').innerHTML =
      tbl(['基类', '组件', '用途'], comps.map(function (c) {
        return [{ code: c.base + (c.level === 'core' ? '  ★' : '') }, c.title, inline(c.useWhen)];
      }));

    /* ---------- 常用片段：每条一个折叠面板，默认收起 ---------- */
    var snips = spec.components.core.map(function (c, i) {
      var pid = 'aisnp' + i;
      var h = '<div class="ui-collapse__item ai-snip">' +
        '<button class="ui-collapse__header" type="button" aria-expanded="false" aria-controls="' + pid + '">' +
          '<span>' + esc(c.title) + ' <code class="ui-code">' + esc(c.base) + '</code></span>' +
          '<span class="ui-collapse__chevron"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 8l4.5 4.5L14.5 8"/></svg></span>' +
        '</button>' +
        '<div class="ui-collapse__panel" id="' + pid + '" hidden>';
      h += '<div class="ai-snip__meta"><span>用它的时机：' + esc(c.useWhen) + '</span>' +
           (c.notWhen ? '<span>不要用的时机：' + esc(c.notWhen) + '</span>' : '') + '</div>';
      if (c.variants && c.variants.length) {
        h += tbl(['变体', '什么时候用'], c.variants.map(function (v) { return [{ code: v.cls }, inline(v.when)]; }));
      }
      h += '<pre class="ai-snip__code"><code>' + esc(c.snippet) + '</code></pre>';
      if (c.attrs && c.attrs.length) {
        h += '<div class="ai-snip__meta">' + c.attrs.map(function (a) {
          return '<span><code class="ui-code">' + esc(a.attr) + '</code> —— ' + esc(a.why) + '</span>';
        }).join('') + '</div>';
      }
      if (c.aria && c.aria.length) h += '<div class="ai-snip__meta"><span>无障碍：' + esc(c.aria.join('；')) + '</span></div>';
      return h + '</div></div>';
    }).join('');
    var snipHost = document.querySelector('[data-ai-snippets]');
    snipHost.innerHTML = '<div class="ui-collapse" data-ui="collapse">' + snips + '</div>';

    /* ---------- 钩子 / 事件 / API ---------- */
    document.querySelector('[data-ai-behaviors]').innerHTML =
      tbl(['属性', '挂在哪', '说明'], spec.behaviors.map(function (b) {
        return [{ code: b.attr }, b.on, inline(b.note)];
      }));
    document.querySelector('[data-ai-events]').innerHTML =
      tbl(['事件', '载荷', '来源', '触发时机'], spec.events.map(function (e) {
        return [{ code: e.name }, { code: e.payload }, e.from, inline(e.when)];
      }));
    document.querySelector('[data-ai-api]').innerHTML =
      tbl(['调用', '用途'], spec.api.map(function (a) { return [{ code: a.call }, inline(a.use)]; }));

    /* 新插入的 DOM 要再走一次初始化，否则折叠面板不工作。 */
    UI.init(snipHost);
  })();

  /* ============================================================
     自检页（docs/check.html）
     ------------------------------------------------------------
     规则集与 ownui.spec.js 同源：禁止清单里那些「会被写错的东西」，
     在这里变成可执行的检查。AI 写完让它自己跑一遍，比人肉 review 有效。

     实现取向：全部按「单个开标签」为检查单位。
     不用 DOMParser 是因为这个页面要能贴片段（没有 html/body 的残片），
     DOMParser 会把残片补全成完整文档，行号就对不上了。
     以标签为单位既能拿到准确偏移，也覆盖了绝大多数真实错误。
     ============================================================ */
  /* ============================================================
     自检页（docs/check.html）
     ------------------------------------------------------------
     规则集与 ownui.spec.js 同源：禁止清单里那些「会被写错的东西」，
     在这里变成可执行的检查。AI 写完让它自己跑一遍，比人肉 review 有效。

     检查单位是「单个开标签 + 内联样式」。不用 DOMParser 是因为这一页
     要能贴片段（没有 html/body 的残片），DOMParser 会把残片补全成完整
     文档，行号就对不上了。以标签为单位既能拿到准确偏移，也覆盖了绝大
     多数真实错误 —— 下面每一条结构规则都只需要看一个开标签就够。
     ============================================================ */
  (function initCheckPage() {
    var input = document.querySelector('[data-chk-input]');
    var out = document.querySelector('[data-chk-report]');
    if (!input || !out) return;

    var spec = window.OwnUISpec;

    /* ---------- 规则集 ----------
       检查实现与页面上那份规则清单都读这里。写成一份表而不是散在代码里，
       是为了避免「页面写着会查 A、实际没查」—— 那正是这套东西要防的病。
       级别：error 会让功能不工作或主题失效；warn 是可维护性问题。 */
    var RULES = [
      { id: 'alien', sev: 'error', name: '非 OwnUI 类名',
        fix: '本库没有这类类名，写了不报错但完全不生效。改用 ui- 前缀的等价类。' },
      { id: 'hex', sev: 'error', name: '裸色值',
        fix: '换成语义 token：var(--ui-primary) / var(--ui-text-2) / var(--ui-danger)。写死色值换主题时不会跟随。' },
      { id: 'fontpx', sev: 'error', name: '裸 px 字号',
        fix: '字阶是离散档位。用 var(--ui-fs-14) 或 var(--ui-type-body) 这类语义 token。' },
      { id: 'space', sev: 'warn', name: '间距不在 4pt 刻度上',
        fix: '基准是 4pt（4/8/12/16/20/24/32/40/48/64）。用 var(--ui-space-*)；相邻元素之间优先用父容器的 gap。' },
      { id: 'radius', sev: 'warn', name: '自由圆角',
        fix: '圆角只有 4/8/12/16/24/32/999 六档。用 var(--ui-radius-control|block|card|sheet|pill)。' },
      { id: 'important', sev: 'error', name: '!important',
        fix: '覆盖库样式是不可逆的耦合，组件升级后会静默失效或反向打架。改 token，或在组件外层写自己的类。' },
      { id: 'fixed', sev: 'warn', name: '自写固定定位',
        fix: '若在做弹层，改用 .ui-modal / .ui-drawer —— 层级、滚动锁、焦点陷阱、Esc 关闭都要自己做，很难做全。' },
      { id: 'l1', sev: 'warn', name: 'L1 原子层泄漏',
        fix: '组件样式只该用 L2 语义层（var(--ui-primary)）。L1 是主题的作用域，深色模式下它的取值是错的。' },
      { id: 'trigger', sev: 'error', name: '触发器缺 data-target',
        fix: '触发按钮靠 data-target="#id" 找目标，少一个就点不开。' },
      { id: 'dialog', sev: 'error', name: '弹层缺无障碍三件套',
        fix: '要有 role="dialog" aria-modal="true" 与 aria-labelledby="<标题 id>"（或 aria-label）。漏了读屏软件会继续念背景内容。' },
      { id: 'btntype', sev: 'error', name: '按钮缺 type',
        fix: '表单里按钮默认是 submit，不写会意外提交整个表单。显式写 type="button" 或 "submit"。' },
      { id: 'iconlabel', sev: 'error', name: '图标按钮缺 aria-label',
        fix: '按钮内只有 SVG，读屏用户只会听到「按钮」。必须用 aria-label 说明它做什么。' },
      { id: 'collapse', sev: 'error', name: '折叠面板 header 缺 aria',
        fix: 'aria-expanded 与 aria-controls 都要有，否则键盘与读屏用户看不出当前是展开还是收起。' },
      { id: 'tab', sev: 'error', name: '标签页缺 aria',
        fix: '每个 role="tab" 都要有 aria-selected 与 aria-controls，缺一环方向键导航就失效。' },
      { id: 'popconf', sev: 'error', name: '二次确认缺文案',
        fix: '破坏性操作必须写 data-popconfirm-title 与 data-popconfirm-desc，desc 里要说清后果与不可逆性。' },
      { id: 'invdesc', sev: 'error', name: '错误态未告知读屏',
        fix: '标红之外还要 aria-invalid="true"，并用 aria-describedby 指向错误元素。' },
      { id: 'sortkey', sev: 'error', name: '排序表头缺 data-sort',
        fix: '组件只绑定带 data-sort="列号" 的表头按钮，漏了它会一声不吭地不排序。列号从 0 起算。' }
    ];
    var R = {};
    RULES.forEach(function (r) { R[r.id] = r; });

    /* 非 OwnUI 的类名。这些是「写了不报错但完全不生效」，最该拦的一类。 */
    var ALIEN_EXACT = [
      'container', 'container-fluid', 'row', 'flex', 'clearfix',
      'btn', 'form-control', 'form-group', 'input-group', 'table-responsive',
      'd-flex', 'd-block', 'd-none', 'd-grid', 'd-inline', 'd-inline-block',
      'text-center', 'text-left', 'text-right', 'pull-left', 'pull-right'
    ];
    var ALIEN_PREFIX = [
      'btn-', 'col-', 'el-', 'ant-', 'layui-', 'van-', 'vant-', 'ivu-', 'nut-',
      'mt-', 'mb-', 'ml-', 'mr-', 'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-',
      'w-', 'h-', 'gap-', 'grid-cols-', 'text-', 'bg-', 'font-'
    ];

    var RADIUS_OK = spec.scales.radius.steps.map(function (s) { return s.px; });

    function lineOf(src, idx) {
      var n = 1;
      for (var i = 0; i < idx && i < src.length; i++) if (src.charCodeAt(i) === 10) n++;
      return n;
    }
    /* 把注释内容替换成等长空格：既屏蔽注释里的误报，又保住后续匹配的偏移，
       这样行号才是对的。整行注释会变成整行空格，换行符保留。 */
    function blankComments(src) {
      return src.replace(/<!--[\s\S]*?-->/g, function (m) { return m.replace(/[^\n]/g, ' '); });
    }

    function check(src) {
      var issues = [];
      var text = blankComments(src);

      function add(id, idx, hit) {
        var r = R[id];
        issues.push({
          sev: r.sev, rule: r.name, fix: r.fix,
          line: lineOf(text, idx),
          hit: String(hit).replace(/\s+/g, ' ').trim().slice(0, 160)
        });
      }
      function scan(id, re) {
        var m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          add(id, m.index, m[0]);
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      }

      /* --- 1. 非 OwnUI 类名：逐个 class 词元判断，避免误伤 ui-row 里的 row --- */
      var classRe = /class\s*=\s*("([^"]*)"|'([^']*)')/gi, cm;
      while ((cm = classRe.exec(text)) !== null) {
        var raw = cm[2] !== undefined ? cm[2] : cm[3];
        raw.split(/\s+/).forEach(function (tok) {
          if (!tok || tok === 'ui' || tok.indexOf('ui-') === 0) return;
          var isAlien = ALIEN_EXACT.indexOf(tok) >= 0 || ALIEN_PREFIX.some(function (p) {
            return tok.indexOf(p) === 0;
          });
          if (isAlien) add('alien', cm.index, tok + '   ←   class="' + raw.trim() + '"');
        });
      }

      /* --- 2. 具体色值 --- */
      scan('hex', /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g);
      scan('hex', /\brgba?\s*\(|\bhsla?\s*\(/g);

      /* --- 3. 裸 px 字号 --- */
      scan('fontpx', /font-size\s*:\s*[^;{}"']*?\d+px/gi);

      /* --- 4. 间距刻度 --- */
      var spRe = /(margin|padding|gap)(?:-(?:top|bottom|left|right|block|inline))?\s*:\s*([^;{}"']+)/gi, sm;
      while ((sm = spRe.exec(text)) !== null) {
        var pxRe = /(-?\d*\.?\d+)px/g, pm, bad = null;
        while ((pm = pxRe.exec(sm[2])) !== null) {
          var n = parseFloat(pm[1]);
          if (n !== 0 && n % 4 !== 0) { bad = pm[0]; break; }
        }
        if (bad) add('space', sm.index, sm[0].trim() + '   ←   ' + bad + ' 不在刻度上');
      }

      /* --- 5. 圆角刻度 --- */
      var brRe = /border-radius\s*:\s*([^;{}"']+)/gi, bm;
      while ((bm = brRe.exec(text)) !== null) {
        var bpx = /(\d+)px/g, bp, badR = null;
        while ((bp = bpx.exec(bm[1])) !== null) {
          var rv = parseInt(bp[1], 10);
          if (rv !== 0 && RADIUS_OK.indexOf(rv) < 0) { badR = bp[1] + 'px'; break; }
        }
        if (badR) add('radius', bm.index, bm[0].trim() + '   ←   ' + badR);
      }

      /* --- 6~8. 纯文本模式匹配 --- */
      scan('important', /!\s*important/gi);
      scan('fixed', /position\s*:\s*fixed/gi);
      scan('l1', /var\(\s*--ui-[pn]-\d+\s*\)/g);

      /* --- 9. 结构性规则：只看单个开标签 --- */
      function eachTag(re, id, ok, describe) {
        var m;
        re.lastIndex = 0;
        while ((m = re.exec(text)) !== null) {
          if (!ok(m[0])) add(id, m.index, describe ? describe(m[0]) : m[0]);
        }
      }

      eachTag(/<[a-z]+\b[^>]*\bdata-ui\s*=\s*"(?:modal|drawer)"[^>]*>/gi, 'trigger',
        function (t) { return /\bdata-target\s*=/.test(t); });

      eachTag(/<[a-z]+\b[^>]*\bclass\s*=\s*"[^"]*\bui-(?:modal|drawer)\b[^"]*"[^>]*>/gi, 'dialog',
        function (t) {
          return /\brole\s*=\s*"dialog"/.test(t) &&
                 /\baria-modal\s*=\s*"true"/.test(t) &&
                 (/\baria-labelledby\s*=/.test(t) || /\baria-label\s*=/.test(t));
        });

      eachTag(/<button\b[^>]*\bclass\s*=\s*"[^"]*\bui-btn\b[^"]*"[^>]*>/gi, 'btntype',
        function (t) { return /\btype\s*=/.test(t); });

      eachTag(/<button\b[^>]*\bclass\s*=\s*"[^"]*\bui-icon-btn\b[^"]*"[^>]*>/gi, 'iconlabel',
        function (t) { return /\baria-label\s*=/.test(t); });

      eachTag(/<button\b[^>]*\bclass\s*=\s*"[^"]*\bui-collapse__header\b[^"]*"[^>]*>/gi, 'collapse',
        function (t) { return /\baria-expanded\s*=/.test(t) && /\baria-controls\s*=/.test(t); });

      eachTag(/<button\b[^>]*\brole\s*=\s*"tab"[^>]*>/gi, 'tab',
        function (t) { return /\baria-selected\s*=/.test(t) && /\baria-controls\s*=/.test(t); });

      eachTag(/<[a-z]+\b[^>]*\bdata-ui\s*=\s*"popconfirm"[^>]*>/gi, 'popconf',
        function (t) { return /\bdata-popconfirm-title\s*=/.test(t) && /\bdata-popconfirm-desc\s*=/.test(t); });

      eachTag(/<input\b[^>]*\bclass\s*=\s*"[^"]*\bis-invalid\b[^"]*"[^>]*>/gi, 'invdesc',
        function (t) { return /\baria-invalid\s*=\s*"true"/.test(t); });

      eachTag(/<button\b[^>]*\bclass\s*=\s*"[^"]*\bui-table__sort\b[^"]*"[^>]*>/gi, 'sortkey',
        function (t) { return /\bdata-sort\s*=/.test(t); });

      /* 同一位置同一规则只报一次（class 词元循环可能重复命中同一个标签） */
      var seen = {};
      return issues.filter(function (i) {
        var k = i.rule + '@' + i.line + '@' + i.hit;
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      }).sort(function (a, b) { return a.line - b.line; });
    }

    function esc(s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function report(issues) {
      var errs = issues.filter(function (i) { return i.sev === 'error'; }).length;
      var warns = issues.length - errs;
      var verdict = errs ? '先修错误，提醒可以权衡。'
        : (warns ? '没有硬错误，提醒项按需处理。' : '干净。可以放心提交。');
      var h = '<div class="chk-sum ' + (errs ? 'chk-sum--bad' : 'chk-sum--ok') + '">' +
        '<span class="chk-sum__n">' + errs + '</span><span>个错误</span>' +
        '<span class="chk-sum__n">' + warns + '</span><span>个提醒</span>' +
        '<span class="ui-caption ui-muted">' + verdict + '</span>' +
        '</div>';
      if (!issues.length) return h;
      h += '<div class="chk-list">';
      issues.forEach(function (i) {
        h += '<div class="chk-item chk-item--' + i.sev + '">' +
          '<div class="chk-item__head">' +
            '<span class="ui-badge ' + (i.sev === 'error' ? 'ui-badge--danger' : 'ui-badge--warning') + '">' +
              (i.sev === 'error' ? '错误' : '提醒') + '</span>' +
            '<span class="chk-item__rule">' + esc(i.rule) + '</span>' +
            '<span class="chk-item__line">第 ' + i.line + ' 行</span>' +
          '</div>' +
          '<code class="chk-item__hit">' + esc(i.hit) + '</code>' +
          '<div class="chk-item__fix">' + esc(i.fix) + '</div>' +
        '</div>';
      });
      return h + '</div>';
    }

    function run() {
      var src = input.value;
      if (!src.trim()) {
        out.innerHTML = '<div class="doc-note doc-note--warn">先贴一段 HTML 再查。可以点上面的示例，或就近复制文档站里任意一个组件的代码块。</div>';
        return;
      }
      out.innerHTML = report(check(src));
    }

    /* ---------- 页面上那份规则清单：读同一份 RULES ---------- */
    /* 首屏徽标的规则数也活取——写死的话下次加规则就变成撒谎 */
    var countBadge = document.querySelector('[data-chk-count]');
    if (countBadge) countBadge.textContent = RULES.length + ' 条规则';
    var rulesHost = document.querySelector('[data-chk-rules]');
    if (rulesHost) {
      var h = '<div class="ui-table-wrap ai-table"><table class="ui-table ui-table--compact"><thead><tr>' +
        '<th>级别</th><th>规则</th><th>怎么改</th></tr></thead><tbody>';
      RULES.forEach(function (r) {
        h += '<tr>' +
          '<td><span class="ui-badge ' + (r.sev === 'error' ? 'ui-badge--danger' : 'ui-badge--warning') + '">' +
            (r.sev === 'error' ? '错误' : '提醒') + '</span></td>' +
          '<td>' + esc(r.name) + '</td>' +
          '<td>' + esc(r.fix) + '</td>' +
        '</tr>';
      });
      rulesHost.innerHTML = h + '</tbody></table></div>';
    }

    /* ---------- 交互 ---------- */
    var btn = document.querySelector('[data-chk-run]');
    if (btn) btn.addEventListener('click', run);
    var clr = document.querySelector('[data-chk-clear]');
    if (clr) clr.addEventListener('click', function () {
      input.value = '';
      out.innerHTML = '';
      input.focus();
    });
    /* 示例放在 <script type="text/plain"> 里：脚本块是原始文本，
       尖括号不用写成 &lt;，示例源码在 HTML 里照样能原样阅读。 */
    document.querySelectorAll('[data-chk-sample]').forEach(function (b) {
      b.addEventListener('click', function () {
        var srcEl = document.querySelector(b.getAttribute('data-chk-sample'));
        if (!srcEl) return;
        input.value = srcEl.textContent.replace(/^\n+/, '').replace(/\s+$/, '');
        run();
      });
    });
    /* Ctrl / Cmd + Enter 直接跑 */
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
    });
  })();

})();
