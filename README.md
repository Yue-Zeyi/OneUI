# OneUI · 通用 UI 组件库

框架无关的通用组件库。**中性无色主题 + 单一可配置主色**，用 CSS 变量驱动，零依赖、零构建。
Vue / React / Svelte / 原生页面 / 服务端模板都能直接引入。主色自带 6 套预设（中性墨黑 + 5 套品牌色），加一个 `data-ui-accent` 属性即可切换（见 §3.1）。

### 命名约定

| 位置 | 取值 | 说明 |
|---|---|---|
| 产品名 | `OneUI` | 对外称呼、文档标题、页脚署名 |
| JS 全局 | `window.OneUI` | 命令式 API 入口 |
| JS 兼容别名 | `window.UI` | 与 `OneUI` 完全等价，二选一即可 |
| CSS 类名前缀 | `ui-` | 如 `.ui-btn`、`.ui-modal__dialog` |
| CSS 变量前缀 | `--ui-` | 如 `--ui-primary`、`--ui-space-4` |
| 工具类前缀 | `u-` | 如 `.u-mt-4` |
| 事件前缀 | `ui:` | 如 `ui:submit`、`ui:change` |
| 数据属性 | `data-ui` / `data-ui-*` | 如 `data-ui="modal"`、`data-ui-close` |

> 产品名与代码前缀刻意分离：`OneUI` 是品牌称呼，`ui-` 是稳定的技术命名空间。若你的项目已有 `ui-` 冲突，构建期重命名即可，不必改动品牌名。

---

## 1. 文件结构

```
OneUI/
├── library/                 ← 发布物，把整个目录拷进你的项目即可
│   ├── tokens.css           三层设计 Token（颜色/字阶/间距/圆角/阴影/动效/层级）+ 5 套品牌主色预设
│   ├── base.css             重置、排版、布局、工具类
│   ├── components.css       全部组件样式
│   ├── components.js        行为层（弹层、提示、标签页…），原生 JS，零依赖
│   └── tokens.json          Token 导出（primitive / preset / semantic / component / scale），
│                            供设计工具与跨端（小程序/RN/Android/iOS）对齐
├── docs/                    ← 文档站（四个页面，共用一份 docs.css / docs.js）
│   ├── index.html           落地页：主色调色台 + 实时预览 + 导出面板 + 三步接入
│   ├── docs.html            组件文档：在线实例 + 代码片段 + 契约表
│   ├── ai.html              AI 规范页：禁止清单 / Token / 决策 / 组件速查，可直接下载四份交付物
│   ├── check.html           合规自检：粘贴你写的 HTML，按规则清单逐条挑错
│   ├── oneui.spec.js        组件契约的唯一数据源（四份 AI 产物都由它生成）
│   ├── oneui.ai.js          渲染器：把 spec 渲染成 AGENTS.md / llms.txt / JSON
│   ├── llms.txt             给 AI 的精简索引（约 30 行，随取随读）
│   ├── llms-full.txt        上面那份 + 完整契约全文
│   ├── oneui.spec.json      机器可读的完整契约
│   ├── docs.css / docs.js   文档站的样式与行为
├── tools/                   ← 开发用，不进发布物
│   └── build-ai-files.mjs   由 spec 生成四份 AI 产物，并拿 spec 里的类名去 CSS 反向对账
├── AGENTS.md                ← 给编码助手的项目规范（由 build-ai-files 生成）
└── README.md
```

> `docs/` 与 `tools/` 都不是交付物；`library/` 才是。四份 AI 产物是**生成物**，改了 `oneui.spec.js` 或组件样式后要重跑 `node tools/build-ai-files.mjs`（加 `--check` 只校验不写文件）。

## 2. 快速开始

引入顺序不可颠倒（Token → 基础 → 组件 → 行为）：

```html
<link rel="stylesheet" href="library/tokens.css">
<link rel="stylesheet" href="library/base.css">
<link rel="stylesheet" href="library/components.css">
<script src="library/components.js"></script>
```

### 声明式用法（推荐）

```html
<button class="ui-btn ui-btn--primary" data-ui="modal" data-target="#myModal">打开弹窗</button>

<div class="ui-modal" id="myModal" role="dialog" aria-modal="true" aria-labelledby="t">
  <div class="ui-modal__dialog">
    <div class="ui-modal__header">
      <div class="ui-modal__title" id="t">标题</div>
      <button class="ui-icon-btn ui-icon-btn--sm" data-ui-close aria-label="关闭">×</button>
    </div>
    <div class="ui-modal__body">内容</div>
    <div class="ui-modal__footer">
      <button class="ui-btn ui-btn--default" data-ui-close>取消</button>
      <button class="ui-btn ui-btn--primary">确定</button>
    </div>
  </div>
</div>
```

### 命令式用法

```js
OneUI.toast({ message: '保存成功', description: '已更新 3 个字段', type: 'success' });
OneUI.modal.open('#myModal');  OneUI.modal.close('#myModal');
OneUI.drawer.open('#filterDrawer');
await OneUI.confirm({ title: '确认删除该密钥？', description: '删除后调用立即失败。', confirmText: '删除' });
await OneUI.copy('要复制的文本');
```

## 3. 换主色（唯一的品牌变量）

### 3.1 用内置预设（推荐）

`tokens.css` 一共 6 套可选主色，其中 5 套品牌色是预设块，`ink` 是默认值、不写任何块，加一个属性即可切换，零 CSS、零 JS：

```html
<html data-ui-accent="blue">   <!-- ink 墨黑 | blue 品蓝 | indigo 靛蓝 | emerald 翠绿 | orange 橙 | violet 紫罗兰 -->
```

不写这个属性（或写 `ink`）就是默认的中性墨黑——它刻意不写预设块，不匹配任何规则就自然回落到 `:root` 的中性灰阶，避免"默认值"与"预设值"两套数据打架。每套预设都已配好 10 档色阶、两个主题下的取值与 hover/active 方向，且通过下方全部对比度门槛。

**深色模式下预设主色不反白。** 默认的墨黑在深色底上会整体反转为白底黑字，但品牌色不能这么处理——反白就把色相丢了。所以预设主色在深色模式下改走上半档浅色（`--ui-p-400` 配墨字）保住色相；只有墨黑因为没有色相可保，才走反白。这套分支靠 `--ui-primary-dark*` 这一组角色槽位实现：它们默认等于"墨黑反白"的取值，预设块覆盖它们，两个深色块统一消费它们。

### 3.2 自建一套色阶

覆盖 L1 的 10 个原始值：

```css
/* 选择器特意写成 :root:where([…]) 而不是 :root[…] —— :where() 的权重恒为 0，
   整条只剩 :root 的 0,1,0，刚好低于 tokens.css 里两个深色块（0,2,0）。
   它们要把 hover / active / text 这三个浅色槽位改指到 --ui-primary-dark-*，
   权重必须压得住你自己的块。若写成 :root[data-ui-accent="brand"]（0,2,0）、
   又放在 tokens.css 之后，就会反过来压住深色块 —— 症状是深色模式下 hover
   还是那个深蓝、主按钮仍然是白字。文档站的「导出」生成的也是这个写法。 */
:root:where([data-ui-accent="brand"]) {
  --ui-p-50:  #EFF6FF;   /* weak 淡底 */
  --ui-p-100: #DBEAFE;   /* weak hover */
  --ui-p-200: #BFDBFE;   /* weak 边框 */
  --ui-p-300: #93C5FD;
  --ui-p-400: #60A5FA;   /* 深色模式主色 */
  --ui-p-500: #3B82F6;
  --ui-p-600: #2563EB;   /* 主色本身，压白字必须 ≥4.5:1 */
  --ui-p-700: #1D4ED8;   /* hover */
  --ui-p-800: #1E40AF;   /* active */
  --ui-p-900: #172554;   /* 深色模式下的淡底 */
  --ui-primary-hover:  var(--ui-p-700);
  --ui-primary-active: var(--ui-p-800);
  --ui-primary-text:   var(--ui-n-0);    /* 600 档偏亮时改成 var(--ui-n-950) */
  --ui-primary-dark:            var(--ui-p-400);
  --ui-primary-dark-hover:      var(--ui-p-300);
  --ui-primary-dark-active:     var(--ui-p-200);
  --ui-primary-dark-weak:       var(--ui-p-900);
  --ui-primary-dark-weak-hover: var(--ui-p-800);
  --ui-primary-dark-border:     var(--ui-p-700);
  --ui-primary-dark-text:       var(--ui-n-950);
}
```

`--ui-primary / primary-hover / primary-active / primary-weak / primary-border` 全部派生自这组值，按钮、开关、进度、标签、焦点环自动跟随，**组件样式一行都不用改**。

> ⚠️ **换肤声明必须落在 `<html>` 上。** `--ui-primary: var(--ui-p-600)` 声明在 `:root`，`var()` 就在 `:root` 完成替换；若把 `--ui-p-*` 写到某个后代元素上，父级那份 `--ui-primary` 早已变成具体色值继承下来，子元素改 L1 根本不生效。想在局部换色，必须把 `--ui-primary` 及其兄弟槽位也在同一个元素上重声明。

### 3.3 hover / active 的方向

档位约定是 **600 = 主色本身 · 700 = hover · 800 = active**。默认中性主题是唯一例外，它让状态**变浅**（`#18181B → #3F3F46 → #52525B`）：近黑主色再加深只有 10/255 的差，肉眼分不出 hover；变浅则每一步都清晰，且白字对比度仍有 15.5 / 9.7 / 7.4:1。

品牌色一律**变深**，白字对比度反而随之下探到 6–10:1。这就是预设块里 `--ui-primary-hover: var(--ui-p-700)` 的由来。

### 3.4 关于 600 档的对比度陷阱

600 档压白字必须 ≥4.5:1，但中明度的绿、橙在标准色阶的 600 档只有 **3.77:1 / 3.57:1**，过不了。所以预设里的 `emerald` 与 `orange` 的 600 档**直接深取一档**（`#047857` 得 5.49:1、`#C2410C` 得 5.18:1），这两套色阶因此跳过一个中间档。档位序号的可读性比色阶连续性更重要——消费者只引用槽位，从不关心档位之间色差是否均匀。

文档站的「主色配置」区块与右上角的配色开关改的是同一份状态：点任意一处，导航栏开关、窄屏抽屉底部的色点、区块内的色点三处一起高亮。自定义色值会算出完整 10 档色阶写到 `<html>` 的行内样式上；若所选色值压白字不足 4.5:1，它**先改用墨色文字**（保住色相），只有连墨字也过不了时才沿加深方向调整，并明确告诉你改成了什么——不静默改值。

深色模式：给 `<html>` 加 `data-ui-theme="dark"`（或 `"auto"` 跟随系统），仅翻转语义层。

### 3.5 从文档站直接导出

文档站**首页落地页**右侧有个**导出**面板，把当前这一版配色打包带走。五项里只有 zip 需要读文件，其余四项任何环境（含 `file://`）都能用：

| 操作 | 产物 |
| --- | --- |
| 复制 CSS | 当前主题的 `oneui-theme.css` 全文进剪贴板 |
| 下载 oneui-theme.css | 上面那份，优先走系统「另存为」对话框 |
| 下载 tokens.json | 同一套 Token 的 JSON 版（值已解析成最终色值），可直接喂 Tokens Studio / Style Dictionary |
| 下载 starter.zip | library 五个文件 + 这一版主题 + **示例页 + 可直接照抄的样板页（golden.html）** + AGENTS.md / oneui.spec.json / llms.txt + 接入说明，解压即能跑 |
| 复制分享链接 | 把主色与主题编码进 URL hash，如 `#accent=custom&c=%23FF6B35&theme=dark`，别人打开就是同一个配色 |

几条约定：

- 导出的 CSS 选择器是 `:root:where([data-ui-accent="brand"])`（权重 0,1,0，理由见 3.2），用法是放在 `tokens.css` 之后 + `<html data-ui-accent="brand">`；文件末尾另附一份改 `:root` 的「直改版」，给不想动 HTML 的场景。
- 导出的文件**与深浅色无关**：浅色槽位与深色槽位都在里面，切主题即换一套。生成时会临时按浅色读取语义槽位，免得把深色模式下的取值写进浅色槽位。
- 值与 `tokens.css` 对得上的写成 `var()` 引用（改色阶时状态档自动跟随），对不上的（自定义色算出来的深色主色没有对应档位）写具体色值。
- `starter.zip` 要把本地源码一起打包，`file://` 下会被同源策略拦住 —— 此时按钮置灰并说明原因与解决办法（起个本地服务器即可），不做静默失败。

分享链接的优先级：**链接里的配置 > 本地存储 > 默认墨黑**。目录锚点（`#btn` 这类不带 `=` 的 hash）不会被误读成配置。

## 4. 组件清单一览

| 分组 | 组件 |
|---|---|
| 基础 | 按钮（6 变体 × 3 尺寸 × 7 态）、图标按钮、按钮组、徽章、标签、可移除 Chip、状态点、头像（圆形/方形/尺寸/在线点/头像组） |
| 表单 | 输入框、文本域、选择框、输入组（前后缀）、搜索框、复选框、单选框、开关、上传拖放区、文件列表、表单布局、即时校验 |
| 反馈 | 提示条 Alert（4 色 + 2 低调变体）、通告条、Toast（命令式）、模态框（4 档宽）、抽屉（右/左/底）、气泡提示、二次确认、进度条、环形进度、加载态、蒙层、骨架屏、空状态、结果页 |
| 导航 | 顶部导航（含移动端抽屉）、品牌标记、侧栏导航、标签页（含胶囊变体）、分段控件、面包屑、分页（完整/简洁）、步骤条（横/纵/响应式）、下拉菜单、页脚 |
| 数据展示 | 卡片（可交互/选中/反色）、统计卡、特性卡、表格（吸顶表头/斑马纹/紧凑/排序）、描述列表、列表、时间线、折叠面板（含手风琴）、代码块 |
| 布局 | 容器、栅格（2/3/4/自动/侧栏）、Stack、Row、Section、分割线、工具类、Hero、区块标题、指标条、工具条、CTA |
| 组合示例 | 数据看板区块、方案对比区、流程协作区 |

`.ui-navbar__logo` 只提供**容器**：28×28 主色方块 + `border-radius: var(--ui-radius-sm)`，对内嵌 `svg` 统一给 24×24。标记图形本身由使用方以 inline SVG 提供（`stroke`/`fill` 写 `currentColor` 即可随主题自动反白），组件层不含任何图形语义——本站点自己那枚「One」字标就是一份 inline SVG，不是库的一部分。

## 5. 行为层 API

| 声明式 | 作用 |
|---|---|
| `data-ui="modal" data-target="#id"` | 打开模态框（`data-toggle="true"` 为切换） |
| `data-ui="drawer" data-target="#id"` | 打开抽屉（配合 `ui-drawer--left/--bottom`） |
| `data-ui="dropdown"` | 下拉菜单，内部 `[data-ui="dropdown-trigger"]` + `.ui-menu` |
| `data-tooltip="文案"`（`data-ui="tooltip"` 可省） | 气泡提示，鼠标与键盘聚焦都会触发；`data-tooltip-placement="top\|right\|bottom\|left"` |
| `data-ui="popconfirm"` | 二次确认气泡，宿主写 `data-popconfirm-title/desc/ok`。**宿主不要带 `.ui-popconfirm` 类**——那个类是浮层面板自己的；宿主带上了会被当成面板而整体隐藏，面板结构不全还会中断 init（现已加保护） |
| `data-ui="tabs"` | 标签页，方向键 / Home / End 切换 |
| `data-ui="segmented"` | 分段控件，方向键切换 |
| `data-ui="collapse"` `data-accordion` | 折叠面板 / 手风琴 |
| `data-ui="pagination"` | 分页，`[data-page]` 按钮派发 `ui:change` |
| `data-ui="table-sort"` | 表格排序，`[data-sort="列号"]` |
| `data-ui="dropzone"` | 上传拖放区，含本地文件列表渲染 |
| `data-ui="copy"` `data-copy-target="#id"` | 一键复制 + Toast 反馈 |
| `data-ui="navbar"` `data-navbar-drawer="#id"` | 顶部导航与移动端目录抽屉联动 |
| `data-ui-theme="light\|dark\|auto"` | 深浅色开关，声明在 `<html>` 上；`auto` 跟随系统 |
| `data-ui-accent="ink\|blue\|indigo\|emerald\|orange\|violet"` | 主色预设，声明在 `<html>` 上；纯 CSS 生效，不需要 JS（见 §3.1） |
| `data-ui="validate"` | 表单校验，字段规则写在 `data-validate`（`required\|email\|phone\|min:6\|max:20\|code`） |
| `data-ui="backtop"` | 回到顶部 |

命令式 API：`OneUI.toast` · `OneUI.modal.open/close/toggle` · `OneUI.drawer.open/close/toggle` · `OneUI.confirm` · `OneUI.copy` · `OneUI.init(root)` · `OneUI.lockScroll/unlockScroll` · `OneUI.formatSize`。
（`UI.toast` 等旧写法依然可用，`window.UI` 只是 `window.OneUI` 的别名。）

### 事件（框架集成的关键）

所有组件通过原生 `CustomEvent` 对外广播，统一前缀 `ui:`：
`ui:submit` · `ui:invalid` · `ui:change` · `ui:select` · `ui:sort` · `ui:file` · `ui:toggle` · `ui:confirm` · `ui:copy` · `ui:open` · `ui:close` · `ui:toast:show` · `ui:tooltip:ready` · `ui:ready` · `ui:error`（组件初始化失败时派发，`detail` 为 `{ component, error }`；`init()` 逐个组件隔离，一个组件写错不再影响其它组件）。

在 Vue / React 里用原生监听即可接管，无需为组件库再包一层：

```js
// Vue 3
onMounted(() => {
  el.value.addEventListener('ui:submit', (e) => { /* ... */ });
});
```

## 6. 设计约束（已内置在样式里）

| 项 | 约束 |
|---|---|
| 主题 | 中性灰阶（无色相）+ 单一主色，深色模式仅翻转语义层；另有 5 套主色预设（见 §3.1） |
| Token | 三层结构，组件只引用 L2/L3；代码中不出现字面量色值、字号、间距 |
| 状态 | 交互组件实现 hover / active / focus-visible / disabled / loading / selected |
| 状态方向 | 品牌色 hover = `--ui-p-700`、active = `--ui-p-800`，比主色 600 档深一步；中性墨黑是唯一例外（600/500/400 往浅走，否则加深不可见）。已内置在 5 套预设里（见 §3.3） |
| 深色模式 | 所有"灰面"与"反白块内部"都走语义层：`--ui-control-track / -active`、`--ui-disabled-bg`、`--ui-skeleton-bg`、`--ui-code-bg`、`--ui-tooltip-bg`、`--ui-nav-bg-hover / -active`、`--ui-on-invert-*`、`--ui-veil-bg`。主色另立 `--ui-primary-dark*` 一组角色槽位：默认 = 墨黑反白，预设主色覆盖成"上半档浅色 + 墨字"以保住色相（见 §3.1） |
| 命中区 | 视觉尺寸可小于命中区，实际可点区域 ≥ 44×44。图标按钮（含 `--sm` 的 36×36）用 `::after` 撑开；`.ui-btn` / `.ui-segment` / `.ui-nav__link` / `.ui-navbar__brand` / `.ui-breadcrumb__item a` / `.ui-footer__link` / `.ui-table__sort` / `.ui-pagination__item` / `.ui-alert__close` / `.ui-file__remove` / `.ui-sidenav__item` 在 `@media (pointer: coarse)` 下用透明伪元素统一撑到 44；`.ui-input` / `.ui-check` / `.ui-menu__item` 等整行控件在触屏下直接抬 `min-height`。**鼠标场景不撑开**：44×44 这个基准来自 390×844 触摸设备，而密集工具条里相邻控件只隔 8px，把 32/40px 控件强行撑到 44px 会让 44×44 的命中框互相重叠、点到邻居（命中区不得重叠）；鼠标侧按 WCAG 2.5.8 的 24px 标准。**若你的产品要鼠标侧也硬达标**，把 `--ui-control-h` 改成 `48px`（主按钮高度档）即可，一行生效 |
| 对比度 | 正文 ≥ 4.5:1；`--ui-text-2` 在画布上约 7.2:1，`--ui-text-3` 约 4.8:1；主色三态（默认墨黑）白字 17.7 / 10.4 / 7.7:1，5 套预设的 600 档白字 5.17–6.25:1（绿、橙两套深取一档才达标，见 §3.4）。`--ui-input-placeholder` 取 `--ui-n-500`（白底 4.83:1）；Toast 图标走 `--ui-toast-icon-*`，浅色档亮色 / 深色档 `-700` 深色——直接写亮色字面量在深色模式下会掉到 1.74:1 |
| 链接下划线 | `--ui-link-underline` 取 `--ui-text-3` 而非浅灰：`.ui-link` / `.ui-btn--link` 的文字色与正文一致，下划线是唯一的"这是链接"信号，按非文本对比度须 ≥3:1 |
| 控件轨道 | `--ui-control-track` 取 `--ui-n-500`：取 `--ui-n-300` 时白底只有 1.79:1，未选中开关的轨道与页面融成一片、白旋钮也看不出位置（旋钮位置=开关状态，属必须可辨的信息） |
| 图形标记 | `--ui-marker`（时间线圆点、步骤点）走 3:1 硬门槛；`--ui-separator`（面包屑 `/`）是纯装饰，属 WCAG 1.4.11 例外，两者不共用 |
| 故障隔离 | `init()` 逐个组件 try/catch，单个组件标记写错只跳过它自己并派发 `ui:error`（控制台点名），不再让整页后半段组件集体失效 |
| 状态表达 | 不靠颜色单独传达，一律叠加文字、图标或形状（趋势色表达的是"向好/转差"而非"涨跌"；侧栏选中项 = 灰面底 + 字重 + 左侧色轨，三重线索） |
| 选中底 | 贴在页面画布上的选中态（侧栏 / 菜单）必须用独立的 `--ui-nav-bg-active`，不能借用 `--ui-primary-weak`——中性主题下后者等于 `--ui-bg`，会因为同色而彻底看不见 |
| 焦点 | 统一 `:focus-visible` 2px 主色 outline，全局禁止 `outline: none` 无替代 |
| 动效 | 100 / 180 / 280 / 1200ms 四档；`prefers-reduced-motion` 下全部瞬时切换 |
| 响应式 | 断点 480 / 640 / 768 / 1024 / 1280；栅格列数自动降级 |
| 可访问性 | 弹层含焦点陷阱与归还、ESC 关闭、遮罩关闭；Toast 区域 `aria-live="polite"` |

## 7. 浏览器支持

Chrome / Edge 88+、Safari 14+、Firefox 78+（对齐 2021 年后的常青版本）。
用到的现代特性只有 CSS 自定义属性、`:focus-visible`、`gap`、`dvh` 可选；毛玻璃（`backdrop-filter`）用 `@supports` 做了兜底，
`conic-gradient`（环形进度）不可用时降级为无进度环，不影响布局。

## 8. 注意事项

- `library/` 内的样式表不需要构建工具，但也没有做 CSS 前缀自动补全；如需支持更老浏览器，请在你的构建里加 Autoprefixer。
- 类名前缀统一 `ui-`，CSS 变量前缀统一 `--ui-`，工具类前缀 `u-`，事件前缀 `ui:`——与产品名 `OneUI` 的对应关系见开头的「命名约定」表。若与现有项目冲突，可用构建期重命名。
- 组件层不引入任何图标字体或图标库：图标由使用方以 inline SVG 提供，样式只约定 20px / 2px 描边 / 圆头端点。
- 未提供的能力（有意不做）：日期选择器、级联选择、富文本、虚拟滚动表格——这些属于业务组件，建议按需在项目内实现，样式继续复用本库 Token。

## 9. 让 AI 照着写

这套库把「AI 能读懂并遵从」当成一等能力，四份交付物全部由 `docs/oneui.spec.js`（唯一数据源）生成，**手改无意义**：

| 文件 | 给谁用 | 怎么用 |
|---|---|---|
| `AGENTS.md` | Claude Code / Cursor / Copilot 等会自动读根目录的助手 | 放仓库根，14 节：禁止清单、必须做的事、Token、状态方向、刻度、决策、组件速查、片段、写完自查 |
| `llms.txt` | 会按 llms.txt 约定取索引的爬虫 / 助手 | 约 30 行索引，先读它再决定要不要拉全文 |
| `llms-full.txt` | 需要一次性拿到全部规则的助手 | 索引 + AGENTS.md 全文 + 契约 JSON |
| `oneui.spec.json` | 程序 / 设计工具 | 机器可读契约：15 个核心组件的 base / 用途 / 变体 / 尺寸 / 状态 / 属性 / aria / 事件 / 片段 |

配套两道防线：

1. **防漂移**：`node tools/build-ai-files.mjs` 生成产物时，会拿 spec 里声明过的类名去 `library/*.css` 反向对账，**声明了但 CSS 里没有的直接 `exit 1`**。规范与实现从此不会各说各话。
2. **写完自检**：`docs/check.html` 是个粘贴式检查器，把你写的 HTML 贴进去，按 17 条规则逐条挑错（非 OneUI 类名、裸色值、非 4pt 间距、缺 `type`、缺 aria、表头缺 `data-sort` 等），错误与提醒分级，注释里的内容不会误报。

浏览器里的 `docs/ai.html` 是这四份产物的可视化入口，可以直接复制或下载。

> 用法一句话：把 `AGENTS.md` 放进你的项目根目录，剩下的交给助手。若它写出了违规代码，把那段 HTML 贴进 `docs/check.html` 就能定位是哪条规则没遵守。
