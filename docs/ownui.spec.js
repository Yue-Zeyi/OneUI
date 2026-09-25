/* ============================================================
   OwnUI 组件契约（ownui.spec.js）—— 唯一数据源
   ------------------------------------------------------------
   这份文件同时服务三个去处，所以只写一遍：

     1. docs/ai.html        —— 渲染成人类可读的规范页
     2. tools/build-ai-files.mjs —— 生成 llms.txt / llms-full.txt / ownui.spec.json
     3. 导出面板的 starter.zip     —— 直接塞进用户项目，让那边的 AI 读到

   为什么要做成数据源而不是直接写文档：规范最容易死于「和代码脱节」。
   三个月后 components.css 改了类名，文档还写着旧的，AI 照着写就是错的 ——
   比没有规范更糟。所以构建脚本会拿这里的类名去 components.css 里逐个核对，
   两个方向都报（声明了却没有 / 有却没收录）。

   写这一类内容的两条经验：
     · 禁止清单比允许清单有效。AI 的默认先验是 Bootstrap 与 Tailwind，
       不明确否定，它就会写出 container / d-flex / btn-primary。
     · 「什么时候用哪个」比「有哪些属性」有效。类名 AI 猜得八九不离十，
       猜不到的是 ui-card 和 ui-stack 的边界在哪。
   ============================================================ */
(function (global) {
  'use strict';

  var SPEC = {

    name: 'OwnUI',
    version: '1.0.0',
    tagline: '不挑框架的通用 UI 组件库',
    summary: 'CSS 变量 + 原生 JS，零依赖零构建。中性无色主题打底，主色一处可换；' +
             '每个交互组件实现七态，命中区与对比度按无障碍底线校验。',

    /* ------------------------------------------------------------
       引入顺序。顺序不可颠倒：后面的层引用前面的变量。
       ------------------------------------------------------------ */
    load: {
      note: '四个文件按顺序引入，不需要构建工具，也不需要任何 npm 依赖。',
      files: [
        { path: 'library/tokens.css',     role: '设计 Token：颜色 / 字阶 / 间距 / 圆角 / 阴影 / 动效' },
        { path: 'library/base.css',       role: '基础层：重置、排版、布局、工具类' },
        { path: 'library/components.css', role: '组件层：全部组件样式' },
        { path: 'library/components.js',  role: '行为层：弹层、提示、标签页等交互（可选，纯原生）' }
      ],
      snippet: `<link rel="stylesheet" href="library/tokens.css">
<link rel="stylesheet" href="library/base.css">
<link rel="stylesheet" href="library/components.css">
<script src="library/components.js"></script>`
    },

    /* ------------------------------------------------------------
       给 AI 的四份文件。按这个顺序读，前面的短、后面的长。
       ------------------------------------------------------------ */
    readOrder: [
      { file: 'llms.txt',          what: '索引：这是什么、关键文件在哪、想做什么该读哪段', lines: 60 },
      { file: 'AGENTS.md',         what: '必须守的规则与禁止清单，支持它的编辑器会自动读到', lines: 250 },
      { file: 'ownui.spec.json',   what: '每个组件的准确写法：类名 / 变体 / 状态 / ARIA / 事件 / 片段', lines: 0 },
      { file: 'golden.html',       what: '一页完整可跑样板，照抄改比读规则有效', lines: 0 }
    ],

    /* ------------------------------------------------------------
       禁止清单。每一条都对应一个真实会被写错的点。
       bad 写「不要写什么」，fix 写「改成什么」。
       ------------------------------------------------------------ */
    forbidden: [
      {
        bad: 'container / row / col-* / d-flex / mt-3 / px-4',
        why: 'Bootstrap 与 Tailwind 的类名。本库没有这些，写了不报错，只是完全不生效。',
        fix: '布局用 ui-container / ui-grid / ui-stack / ui-row / ui-cluster，间距用 gap 不用外边距堆叠'
      },
      {
        bad: 'btn / btn-primary / el-button / ant-btn',
        why: '其他组件库的按钮类名。本库一律 ui- 前缀 + BEM 双横线。',
        fix: 'class="ui-btn ui-btn--primary"'
      },
      {
        bad: 'color: #2563EB  /  background: rgb(37,99,235)  /  border-color: red',
        why: '写死色值会绕过主题层：换主色、切深色模式时它不会变，是整站唯一不跟随的地方。',
        fix: 'var(--ui-primary) / var(--ui-danger) / var(--ui-text-2) 这类语义 token'
      },
      {
        bad: 'font-size: 14px 这类裸 px 字号',
        why: '字阶是离散档位（40/32/24/20/16/15/14/13/12/11），裸写 px 会跳出体系且不随排版比例调整。',
        fix: 'var(--ui-fs-14) 这类档位 token，或 var(--ui-type-body) 这类语义字阶'
      },
      {
        bad: 'margin: 10px  /  padding: 18px',
        why: '间距是 4pt 基准（4/8/12/16/20/24/32/40/48/64），10 和 18 不在刻度上。',
        fix: 'var(--ui-space-*)；相邻元素之间优先用父容器的 gap，不要逐个加 margin'
      },
      {
        bad: 'border-radius: 10px',
        why: '圆角只有 5 档加一个胶囊值（4/8/12/16/24/32/999）。',
        fix: 'var(--ui-radius-control) / var(--ui-radius-block) / var(--ui-radius-card) / var(--ui-radius-pill)'
      },
      {
        bad: '!important',
        why: '覆盖库样式是不可逆的耦合：以后组件升级你这份覆盖会静默失效或反向打架。',
        fix: '改 token（--ui-primary 等），或新写一个自己的类挂在组件外层'
      },
      {
        bad: '自己写 position: fixed 做弹层',
        why: '层级、滚动锁、焦点陷阱、Esc 关闭、点击遮罩关闭、aria-hidden 同步，六件事都要自己做，且很难做全。',
        fix: '.ui-modal / .ui-drawer，或 UI.modal.open() / UI.drawer.open()'
      },
      {
        bad: '给 .ui-btn 加 style="background:#xxx"',
        why: '单点改色会让 hover 与 active 还停在原来的主色上，出现「悬停变回蓝色」的割裂。',
        fix: '改 --ui-primary，让 600/700/800 三档一起走'
      },
      {
        bad: 'var(--ui-p-600) 直接写在组件里',
        why: '这是 L1 原子层，属于主题的作用域。主按钮在深色模式下要用 400 档浅色，写死 600 会得到深底深字。',
        fix: 'var(--ui-primary)。它在深色模式下由主题层改指到 --ui-primary-dark-*'
      }
    ],

    /* ------------------------------------------------------------
       必须做的事。缺一项就有具体后果，不是风格问题。
       ------------------------------------------------------------ */
    required: [
      { rule: '引入顺序 tokens → base → components → components.js', why: '后面每层都引用前面的变量，反了就取不到值' },
      { rule: '<button> 必须写 type="button"', why: '表单里的按钮默认是 submit，不写会意外提交整个表单' },
      { rule: 'data-ui="modal" 必须与 data-target="#id" 成对出现', why: '触发按钮靠 data-target 找目标，少一个就点不开' },
      { rule: '弹层元素上要有 role="dialog" aria-modal="true" aria-labelledby="<标题 id>"', why: '读屏软件据此切换上下文；漏了屏幕阅读器会继续念背景内容' },
      { rule: '折叠面板的 header 要带 aria-expanded 与 aria-controls', why: '键盘与读屏用户无法得知当前是展开还是收起' },
      { rule: '标签页要写全 role="tablist" / role="tab" / aria-selected / aria-controls / role="tabpanel"', why: '这是一整套结构，缺一环方向键导航就失效' },
      { rule: '图标按钮必须有 aria-label', why: '按钮内只有 SVG，没有可读文本，读屏用户听到的是「按钮」两个字' },
      { rule: '表单出错时既要 aria-invalid="true"，也要 aria-describedby 指向错误元素', why: '只上红框，读屏用户不知道错在哪' },
      { rule: '颜色不能是唯一的信息载体', why: '状态点、趋势箭头这类要配文字或图标，色盲用户也要能分辨' }
    ],

    /* ------------------------------------------------------------
       Token 三层与使用优先级。这是最容易用错的一处。
       ------------------------------------------------------------ */
    tokens: {
      layers: [
        { id: 'L1', name: '原子层', prefix: '--ui-p-* / --ui-n-*', role: '具体色阶，换主题就是换它', useIn: '只在主题定义处出现' },
        { id: 'L2', name: '语义层', prefix: '--ui-primary* / --ui-text* / --ui-border*', role: '把色阶映射成角色', useIn: '组件样式与你的自定义样式' },
        { id: 'L3', name: '组件层', prefix: '--ui-btn-primary-bg / --ui-card-bg', role: '单个组件的取值出口', useIn: '需要单独改某个组件时' }
      ],
      priority: '自己写样式时用 L2。L1 只在你要做一套新主题时才碰；L3 只在要单独扳某一个组件时才碰。',
      common: [
        { token: '--ui-text',        use: '正文与标题的主文字色' },
        { token: '--ui-text-2',      use: '次级文字：说明、标签、表格副列' },
        { token: '--ui-text-3',      use: '三级文字：占位符、辅助说明、禁用前的提示' },
        { token: '--ui-bg',          use: '页面底色' },
        { token: '--ui-surface',     use: '卡片、弹层、导航栏的表面色' },
        { token: '--ui-surface-2',   use: '表面之上的次级面：内嵌区块、悬停底' },
        { token: '--ui-border',      use: '默认描边与分隔线' },
        { token: '--ui-border-strong', use: '需要更明确边界的描边：输入框、虚线框' },
        { token: '--ui-primary',     use: '主色。主按钮底、进度条、选中态、焦点环' },
        { token: '--ui-primary-hover',  use: '主色的悬停档（品牌色深一档）' },
        { token: '--ui-primary-active', use: '主色的按下档（比悬停再深一档）' },
        { token: '--ui-primary-text',   use: '压在主色底上的文字色。深色模式下会自动翻成墨字' },
        { token: '--ui-primary-weak',   use: '主色的淡底：选中行、轻提示背景' },
        { token: '--ui-primary-border', use: '主色的描边：选中卡片外框' },
        { token: '--ui-danger',      use: '破坏性操作、错误态' },
        { token: '--ui-success',     use: '成功态' },
        { token: '--ui-warning',     use: '警告态' }
      ]
    },

    /* ------------------------------------------------------------
       状态方向契约。AI 猜不到「hover 是哪一档」，必须写死。
       ------------------------------------------------------------ */
    stateDirection: {
      summary: '主色取 600 档。hover 深一档走 700，active 再深一档走 800，深色模式的淡底走 900。',
      ramp: [
        { step: 50,  role: 'weak 淡底' },
        { step: 100, role: 'weak 淡底 hover' },
        { step: 200, role: 'weak 边框 / 深色模式 active' },
        { step: 300, role: '深色模式 hover' },
        { step: 400, role: '深色模式主色' },
        { step: 500, role: '中间档' },
        { step: 600, role: '主色本身。压白字必须 ≥4.5:1' },
        { step: 700, role: 'hover' },
        { step: 800, role: 'active' },
        { step: 900, role: '深色模式下的 weak 淡底' }
      ],
      exceptions: [
        '品牌色一律「变深」。唯一例外是中性墨黑：它已经最暗，再加深肉眼分不出，所以它的 hover/active 反而往浅处走。',
        '深色模式下主色不反白，改走上半档浅色（400/300/200）以保住色相。只有墨黑没有色相可保，才整体反白。'
      ]
    },

    /* ------------------------------------------------------------
       刻度。写布局时优先用这些，不要自由取值。
       ------------------------------------------------------------ */
    scales: {
      space: {
        base: 4,
        note: '4pt 基准。相邻元素之间用父容器的 gap，不要逐个加 margin —— 后者在换行折行时会崩。',
        steps: [
          { token: '--ui-space-1', px: 4,  use: '图标与文字之间' },
          { token: '--ui-space-2', px: 8,  use: '同组控件之间、按钮图标与文字' },
          { token: '--ui-space-3', px: 12, use: '表单标签与输入框、卡片内小节之间' },
          { token: '--ui-space-4', px: 16, use: '卡片内边距、区块内的行距' },
          { token: '--ui-space-5', px: 20, use: '稍大的卡片内边距' },
          { token: '--ui-space-6', px: 24, use: '区块内各组之间' },
          { token: '--ui-space-8', px: 32, use: '区块之间' },
          { token: '--ui-space-10', px: 40, use: '大区块之间' },
          { token: '--ui-space-12', px: 48, use: '段落级别的大间隔' },
          { token: '--ui-space-16', px: 64, use: '首屏与页脚这类超大间隔' }
        ]
      },
      radius: {
        note: '五个档位 + 一个胶囊值。组件已经用对了，你只在写自定义块时需要选。',
        steps: [
          { token: '--ui-radius-control', px: 8,  use: '按钮、输入框、下拉项这类控件（默认就是它）' },
          { token: '--ui-radius-block',   px: 12, use: '内嵌的小区块、代码块' },
          { token: '--ui-radius-card',    px: 16, use: '卡片、弹窗、抽屉面板' },
          { token: '--ui-radius-sheet',   px: 24, use: '底部抽屉、大面积浮层' },
          { token: '--ui-radius-xs',      px: 4,  use: '徽章、小标签' },
          { token: '--ui-radius-pill',    px: 999, use: '胶囊按钮、状态点、头像' }
        ]
      },
      fontSize: {
        note: '写字号用档位 token 或语义 token，不要裸写 px。',
        steps: [
          { token: '--ui-fs-40', px: 40, semantic: '--ui-type-display',  use: '首屏大标题' },
          { token: '--ui-fs-32', px: 32, semantic: '--ui-type-h1',       use: '页面标题' },
          { token: '--ui-fs-24', px: 24, semantic: '--ui-type-h2',       use: '区块标题' },
          { token: '--ui-fs-20', px: 20, semantic: '--ui-type-h3',       use: '卡片组标题' },
          { token: '--ui-fs-16', px: 16, semantic: '--ui-type-h4',       use: '卡片标题' },
          { token: '--ui-fs-15', px: 15, semantic: '--ui-type-body',     use: '正文默认' },
          { token: '--ui-fs-14', px: 14, semantic: '',                   use: '控件文字、表格' },
          { token: '--ui-fs-13', px: 13, semantic: '--ui-type-body-sm',  use: '次级正文' },
          { token: '--ui-fs-12', px: 12, semantic: '--ui-type-caption',  use: '说明、辅助信息' },
          { token: '--ui-fs-11', px: 11, semantic: '--ui-type-overline', use: '分组标签（配 letter-spacing）' }
        ]
      }
    },

    /* ------------------------------------------------------------
       布局工具类。AI 最容易在这里退回到 flex + margin 的默认写法。
       ------------------------------------------------------------ */
    layout: [
      { cls: 'ui-container',        use: '页面主容器，带左右留白与最大宽度' },
      { cls: 'ui-container--wide',  use: '更宽的容器，导航栏与页脚用这个' },
      { cls: 'ui-container--fluid', use: '不要最大宽度，撑满视口' },
      { cls: 'ui-section',          use: '纵向区块，自带上下间距' },
      { cls: 'ui-section--tight',   use: '区块间距收一档' },
      { cls: 'ui-section--flush',   use: '去掉区块的上下间距' },
      { cls: 'ui-stack ui-stack--4', use: '纵向堆叠 + 统一间距。数字是 --ui-space-* 的档位（1/2/3/4/5/6/8/10）' },
      { cls: 'ui-grid ui-grid--3',  use: '等分栅格。--2 / --3 / --4 是固定列数' },
      { cls: 'ui-grid--auto',       use: '自动列数，每列最小约 200px，随容器宽度增减' },
      { cls: 'ui-grid--auto-sm',    use: '同上但最小列宽更小，用于紧凑卡片墙' },
      { cls: 'ui-grid--sidebar',    use: '两栏：固定的侧栏 + 弹性主区' },
      { cls: 'ui-grid--tight',      use: '栅格间距收一档' },
      { cls: 'ui-row ui-row--between', use: '横向排布 + 两端对齐' },
      { cls: 'ui-row--center',      use: '横向排布 + 居中' },
      { cls: 'ui-row--end',         use: '横向排布 + 靠右' },
      { cls: 'ui-row--top',         use: '横向排布 + 顶端对齐（默认是垂直居中）' },
      { cls: 'ui-row--nowrap',      use: '禁止换行（默认会换行）' },
      { cls: 'ui-cluster ui-cluster--3', use: '横向排布且允许换行，间距统一。按钮组、标签组用这个' },
      { cls: 'ui-divider',          use: '分隔线' },
      { cls: 'ui-divider--vertical', use: '竖分隔线，用于行内元素之间' },
      { cls: 'ui-spacer',           use: '弹性占位，把后面的内容推到另一端' },
      { cls: 'ui-hide-sm',          use: '≤768px 时隐藏。用于导航栏里放不下的次要元素' }
    ],

    /* 排版与文字工具类。别自己写 font-size + color 的组合，这些已经配对好了。 */
    text: [
      { cls: 'ui-display',  use: '超大标题' },
      { cls: 'ui-h1',       use: '页面标题' },
      { cls: 'ui-h2',       use: '区块标题' },
      { cls: 'ui-h3',       use: '小节标题' },
      { cls: 'ui-h4',       use: '卡片标题' },
      { cls: 'ui-lead',     use: '导语，比正文大一号' },
      { cls: 'ui-text',     use: '正文（默认字号，通常不用写）' },
      { cls: 'ui-text-sm',  use: '小一号正文' },
      { cls: 'ui-caption',  use: '说明文字，配 ui-muted 用' },
      { cls: 'ui-overline', use: '分组标签，自带大写与字距' },
      { cls: 'ui-muted',    use: '把文字降到次级色（--ui-text-2）' },
      { cls: 'ui-subtle',   use: '把文字降到三级色（--ui-text-3）' },
      { cls: 'ui-mono',     use: '等宽字体' },
      { cls: 'ui-num',      use: '等宽数字，表格与统计里的数字对齐' },
      { cls: 'ui-code',     use: '行内代码，带底色与圆角' },
      { cls: 'ui-kbd',      use: '键盘按键样式' },
      { cls: 'ui-link',     use: '文本链接' },
      { cls: 'ui-prose',    use: '富文本容器，自动处理段落、列表、标题的间距' }
    ],

    /* ------------------------------------------------------------
       决策表。回答「这个场景该用哪个组件」。
       AI 的类名往往写对，选错容器才是更常见的错。
       ------------------------------------------------------------ */
    decisions: [
      { scene: '只是想竖向排列几个元素，加一点间距', use: 'ui-stack + gap', avoid: '给每个元素加 margin-bottom' },
      { scene: '需要等分或自定义列数的横向排列', use: 'ui-grid', avoid: '自己写 display:flex + width 百分比' },
      { scene: '一排按钮或标签，允许换行', use: 'ui-cluster', avoid: 'ui-row（它不换行，窄屏会溢出）' },
      { scene: '内容需要边界与表面', use: 'ui-card', avoid: '加一层 div 再自己写 border + padding' },
      { scene: '容器内只有一行相关操作', use: 'ui-toolbar', avoid: '套一层 ui-card 再叠按钮' },
      { scene: '展示「标签 - 值」成对的结构化信息', use: 'ui-desc', avoid: '两列表格' },
      { scene: '真正的二维数据表，需要排序', use: 'ui-table-wrap + ui-table + data-ui="table-sort"', avoid: '用 ui-list 拼表格' },
      { scene: '破坏性操作（删除、下线、不可逆）', use: 'ui-btn--danger-outline + data-ui="popconfirm" 二次确认', avoid: '直接执行，或只弹一个 toast' },
      { scene: '需要用户集中注意力完成一件事', use: 'ui-modal', avoid: '页内展开一大块表单' },
      { scene: '从侧边临时进入、不打断主任务', use: 'ui-drawer', avoid: 'ui-modal（会打断上下文）' },
      { scene: '操作完成后的轻量反馈', use: 'UI.toast({ message, type })', avoid: 'UI.confirm（那是要用户决策的）' },
      { scene: '需要用户先确认再执行', use: 'UI.confirm({ title, description })', avoid: '自行拼一个 div 当弹窗' },
      { scene: '页面上持续存在的状态说明', use: 'ui-alert', avoid: 'ui-toast（它会消失，用户回头看不到）' },
      { scene: '数据为空时的引导', use: 'ui-empty（可作为表体占位用 ui-table__placeholder）', avoid: '空白一片' },
      { scene: '首屏之后的内容很长', use: 'data-ui="backtop" 回顶按钮', avoid: '让用户自己滚回去' }
    ],

    /* ------------------------------------------------------------
       组件契约。
       core：需要照抄写法的，逐个给完整片段与决策依据。
       more：只需要知道「有这个、类名是什么」，写法照抄 core 的结构即可。
       ------------------------------------------------------------ */
    components: {

      core: [
        {
          id: 'button',
          title: '按钮',
          base: 'ui-btn',
          level: 'core',
          useWhen: '触发一个动作',
          notWhen: '只是跳转 → 用 <a class="ui-btn …"> 保留语义；纯图标 → ui-icon-btn',
          variants: [
            { cls: 'ui-btn--primary',        when: '页面上的主操作，一个视口内只放一个' },
            { cls: 'ui-btn--default',        when: '常规次要操作（默认值，可以不写）' },
            { cls: 'ui-btn--ghost',          when: '低权重操作、工具条内、卡片内的附属动作' },
            { cls: 'ui-btn--danger',         when: '破坏性操作且必须显眼' },
            { cls: 'ui-btn--danger-outline', when: '破坏性操作但需克制（列表行内的删除）' },
            { cls: 'ui-btn--link',           when: '看起来像链接的按钮' },
            { cls: 'ui-btn--block',          when: '撑满父容器宽度' },
            { cls: 'ui-btn--pill',           when: '胶囊形' }
          ],
          sizes: [
            { cls: '',              label: '默认', note: '常规页面用' },
            { cls: 'ui-btn--sm',    label: '小',   note: '工具条、卡片内、表格行内' },
            { cls: 'ui-btn--lg',    label: '大',   note: '首屏主操作' }
          ],
          states: ['hover 取 --ui-primary-hover', 'active 取 --ui-primary-active', 'disabled', 'is-loading'],
          attrs: [
            { attr: 'type="button"', why: '表单内默认是 submit，会意外提交' },
            { attr: 'ui-btn__icon',  why: '按钮内图标用这个类，自动处理间距与对齐' }
          ],
          aria: ['纯图标按钮必须 aria-label', '加载态用 aria-busy="true"'],
          events: [],
          snippet: `<button class="ui-btn ui-btn--primary" type="button">主操作</button>
<button class="ui-btn ui-btn--default" type="button">次操作</button>
<button class="ui-btn ui-btn--danger-outline" type="button">删除</button>

<!-- 按钮内可放图标，图标加 ui-btn__icon -->
<button class="ui-btn ui-btn--default" type="button">
  <span class="ui-btn__icon"><svg …></svg></span>带图标
</button>`
        },

        {
          id: 'input',
          title: '输入框',
          base: 'ui-input',
          level: 'core',
          useWhen: '单行文本录入',
          notWhen: '多行 → ui-textarea；从固定选项里选 → ui-select；搜索 → ui-search',
          variants: [
            { cls: 'ui-input--sm', label: '高 32px', when: '工具条内、表格行内编辑' },
            { cls: 'ui-input--lg', label: '高 48px', when: '首屏或强调场景' }
          ],
          sizes: [],
          states: ['is-invalid 配 aria-invalid="true"', 'is-valid', 'disabled'],
          attrs: [
            { attr: 'placeholder', why: '写示例值（如 order-center），不要写「请输入…」这类无信息量的提示' }
          ],
          aria: ['出错时同时给 aria-invalid="true" 与 aria-describedby 指向错误元素', '用 <label for> 关联，不要只靠 placeholder'],
          events: [],
          snippet: `<div class="ui-field">
  <label class="ui-label" for="name">名称 <span class="ui-label__required">*</span></label>
  <input class="ui-input" id="name" type="text" placeholder="例如：订单中心重构">
  <div class="ui-help">帮助文字，写在输入框下方</div>
</div>

<!-- 出错态 -->
<input class="ui-input is-invalid" aria-invalid="true" aria-describedby="err-name">
<div class="ui-error" id="err-name">名称不能为空</div>`
        },

        {
          id: 'field',
          title: '表单与校验',
          base: 'ui-field',
          level: 'core',
          useWhen: '需要标签、帮助文字、错误提示三件套的表单项',
          notWhen: '单摆一个裸输入框 → 直接 ui-input',
          variants: [],
          sizes: [],
          states: [],
          attrs: [
            { attr: 'data-ui="validate"', why: '写在 <form> 上，开启即时校验与提交拦截' },
            { attr: 'data-validate="required|phone"', why: '写在字段上，多个规则用竖线分隔' },
            { attr: 'data-message-required="自定义文案"', why: '写在字段上，替换「此项为必填」这条默认文案' },
            { attr: 'data-error-text', why: '写在字段里那个承载错误文案的元素上，校验失败时由它显示（找不到就退回字段本身）' }
          ],
          aria: ['校验失败会聚焦第一个出错字段，并自动补 aria-describedby'],
          events: [
            { name: 'ui:submit', payload: '{ formData }', when: '全部校验通过并提交' },
            { name: 'ui:invalid', payload: '{}', when: '存在未通过的字段' }
          ],
          snippet: `<form class="ui-form ui-stack ui-stack--4" data-ui="validate">
  <div class="ui-field">
    <label class="ui-label" for="fPhone">手机号 <span class="ui-label__required">*</span></label>
    <input class="ui-input" id="fPhone" name="phone" type="tel"
           data-validate="required|phone" placeholder="11 位手机号">
    <div class="ui-error" id="err-fPhone" hidden></div>
  </div>
  <div class="ui-form-actions">
    <button class="ui-btn ui-btn--primary" type="submit">提交</button>
  </div>
</form>

<!-- 可用规则：required / email / phone / min:N / max:N / code -->`
        },

        {
          id: 'choice',
          title: '选择控件',
          base: 'ui-check / ui-radio / ui-switch',
          level: 'core',
          useWhen: '布尔开关用 ui-switch；多选用 ui-check；互斥单选且选项少用 ui-radio',
          notWhen: '选项多于 5 个的单选 → ui-select',
          variants: [
            { cls: 'ui-switch--sm', when: '紧凑场景' }
          ],
          sizes: [],
          states: [':checked 自动接管', ':indeterminate 半选（复选组用）', 'disabled'],
          attrs: [
            { attr: 'label 的 for 指向 input 的 id', why: '否则点文字没反应，只有点 16px 的方框才生效' }
          ],
          aria: ['整组用 <fieldset> + <legend> 包住，读屏用户才知道这组选项在问什么'],
          events: [],
          snippet: `<label class="ui-check">
  <input type="checkbox" id="c1"><span class="ui-check__box"></span>
  <span class="ui-check__label" for="c1">接收周报</span>
</label>

<span class="ui-switch">
  <input type="checkbox" id="s1" checked>
  <span class="ui-switch__track"></span>
  <label class="ui-switch__label" for="s1">开启通知</label>
</span>`
        },

        {
          id: 'card',
          title: '卡片',
          base: 'ui-card',
          level: 'core',
          useWhen: '内容需要边界与表面，或用卡片表达一组可点选的对象',
          notWhen: '纯布局分隔 → 用间距或 ui-divider，不要为了视觉分割就套卡片',
          variants: [
            { cls: 'ui-card--pad-lg',    when: '内容较多、需要更大呼吸感' },
            { cls: 'ui-card--interactive', when: '整张卡片可点击，自动给悬停反馈' },
            { cls: 'ui-card--selected',  when: '处于选中态，用主色描边表示' },
            { cls: 'ui-card--flush',     when: '内容需要顶到边缘（表格、图片）' },
            { cls: 'ui-card--invert',    when: '深色卡片，用于需要在浅色页面上压重的地方' }
          ],
          sizes: [],
          states: ['hover（--interactive）', 'selected（--selected）'],
          attrs: [
            { attr: 'ui-card__header / ui-card__body / ui-card__footer', why: '三段式插槽。只用 body 也行，别自己写 padding' }
          ],
          aria: ['整卡可点击时，内部应是一个 <a> 或 <button>，不要把 click 挂在 div 上'],
          events: [],
          snippet: `<div class="ui-card">
  <div class="ui-card__header">
    <div class="ui-card__title">卡片标题</div>
    <div class="ui-card__desc">一句副标题，说清这张卡在讲什么</div>
  </div>
  <div class="ui-card__body">
    <p class="ui-text-sm">正文。</p>
  </div>
  <div class="ui-card__footer">
    <button class="ui-btn ui-btn--default ui-btn--sm" type="button">查看</button>
  </div>
</div>`
        },

        {
          id: 'table',
          title: '表格',
          base: 'ui-table-wrap / ui-table',
          level: 'core',
          useWhen: '真正的二维数据，列之间有对应关系',
          notWhen: '只是「标签 - 值」的成对展示 → ui-desc',
          variants: [
            { cls: 'ui-table--compact', when: '行高收紧，一屏放更多行' },
            { cls: 'ui-table--striped', when: '列数多、需要横向对齐辅助' }
          ],
          sizes: [],
          states: ['ui-table__sort 的 aria-sort 由组件自动维护'],
          attrs: [
            { attr: 'data-ui="table-sort"', why: '写在 .ui-table-wrap 上，开启点击表头排序' },
            { attr: 'data-sort="列号"', why: '写在每个 .ui-table__sort 按钮上，0 起算。**漏了它就点了没反应**：组件只绑定带 data-sort 的按钮' },
            { attr: 'data-value="原始值"', why: '写在 <td> 上，排序按它比而不是按显示文本。数字、日期、金额列必须给，否则 "1,284" 这类带分隔符的文本会按字符串排错' },
            { attr: 'ui-table__cell-num', why: '数字列加这个类，自动右对齐并使用等宽数字' }
          ],
          aria: ['排序表头用 <button class="ui-table__sort">，键盘可聚焦。初始态写 aria-sort="none"，之后由组件维护', '空数据时用 ui-table__placeholder 占位'],
          events: [{ name: 'ui:sort', payload: '{ index, direction }', when: '点击表头排序' }],
          snippet: `<div class="ui-table-wrap" data-ui="table-sort">
  <table class="ui-table">
    <thead>
      <tr>
        <th><button class="ui-table__sort" type="button" data-sort="0" aria-sort="none">名称</button></th>
        <th><button class="ui-table__sort" type="button" data-sort="1" aria-sort="none">数量</button></th>
      </tr>
    </thead>
    <tbody>
      <tr><td>订单中心</td><td class="ui-table__cell-num" data-value="1284">1,284</td></tr>
    </tbody>
  </table>
</div>`
        },

        {
          id: 'modal',
          title: '模态框',
          base: 'ui-modal',
          level: 'core',
          useWhen: '需要用户集中注意力完成一件事，且不完成就没法继续',
          notWhen: '不打断主任务的侧边进入 → ui-drawer；轻量反馈 → UI.toast',
          variants: [
            { cls: 'ui-modal--sm',   when: '确认类小弹窗' },
            { cls: 'ui-modal--lg',   when: '表单或明细较多' },
            { cls: 'ui-modal--full', when: '接近满屏的内容' }
          ],
          sizes: [],
          states: ['is-open（由组件维护）'],
          attrs: [
            { attr: 'data-ui="modal" data-target="#id"', why: '触发按钮。两个属性缺一不可' },
            { attr: 'data-toggle="true"', why: '写在触发按钮上：再点一次就关闭。不加则只在已关闭时打开（用于多个触发器共用一个弹层的场景）' },
            { attr: 'data-mask-closable="false"', why: '写在弹层上，禁止点遮罩关闭（用于必须明确选择的场景）' },
            { attr: 'data-ui-close', why: '写在关闭按钮上，组件自动绑定' },
            { attr: 'data-ui-dismiss="#id"', why: '替代 data-ui-close 的通用写法，值指向要关的弹层；留空则关闭所在的可关闭块' },
            { attr: 'aria-hidden="true"', why: '初始态必须写，组件会在开合时同步' }
          ],
          aria: ['role="dialog" aria-modal="true" aria-labelledby="<标题元素 id>"', '打开时自动锁滚动并把焦点移入，关闭后焦点归还触发按钮'],
          events: [
            { name: 'ui:open', payload: '{}', when: '打开后' },
            { name: 'ui:close', payload: '{ reason }', when: '关闭后。reason 可能是 mask / esc / api' }
          ],
          api: ['UI.modal.open("#id")', 'UI.modal.close("#id")', 'UI.modal.toggle("#id")'],
          snippet: `<button class="ui-btn ui-btn--primary" type="button"
        data-ui="modal" data-target="#myModal">打开</button>

<div class="ui-modal" id="myModal" role="dialog" aria-modal="true"
     aria-labelledby="myModalTitle" aria-hidden="true">
  <div class="ui-modal__dialog">
    <div class="ui-modal__header">
      <div class="ui-modal__title" id="myModalTitle">标题</div>
      <button class="ui-icon-btn ui-icon-btn--sm" type="button" data-ui-close aria-label="关闭"><svg …></svg></button>
    </div>
    <div class="ui-modal__body">正文</div>
    <div class="ui-modal__footer">
      <button class="ui-btn ui-btn--default" type="button" data-ui-close>取消</button>
      <button class="ui-btn ui-btn--primary" type="button">确定</button>
    </div>
  </div>
</div>`
        },

        {
          id: 'drawer',
          title: '抽屉',
          base: 'ui-drawer',
          level: 'core',
          useWhen: '从侧边临时进入，不打断主任务（筛选、详情、移动端导航）',
          notWhen: '需要用户停下来做决定 → ui-modal',
          variants: [
            { cls: 'ui-drawer--left',   when: '左侧，常用于移动端导航' },
            { cls: 'ui-drawer--bottom', when: '底部，移动端的分享与快捷操作' }
          ],
          sizes: [],
          states: ['is-open（由组件维护）'],
          attrs: [
            { attr: 'data-ui="drawer" data-target="#id"', why: '触发按钮' },
            { attr: 'ui-drawer__panel / __header / __body / __footer', why: '四段结构，__body 自带滚动' }
          ],
          aria: ['role="dialog" aria-modal="true" aria-label="<抽屉用途>"'],
          events: [
            { name: 'ui:open', payload: '{}', when: '打开后' },
            { name: 'ui:close', payload: '{ reason }', when: '关闭后' }
          ],
          api: ['UI.drawer.open("#id")', 'UI.drawer.close("#id")'],
          snippet: `<button class="ui-btn ui-btn--default" type="button"
        data-ui="drawer" data-target="#myDrawer">筛选</button>

<div class="ui-drawer ui-drawer--left" id="myDrawer" role="dialog"
     aria-modal="true" aria-label="筛选" aria-hidden="true">
  <div class="ui-drawer__panel">
    <div class="ui-drawer__header">
      <div class="ui-drawer__title">筛选</div>
      <button class="ui-icon-btn" type="button" data-ui-close aria-label="关闭"><svg …></svg></button>
    </div>
    <div class="ui-drawer__body">…</div>
    <div class="ui-drawer__footer">
      <button class="ui-btn ui-btn--primary ui-btn--block" type="button">应用</button>
    </div>
  </div>
</div>`
        },

        {
          id: 'alert',
          title: '提示条',
          base: 'ui-alert',
          level: 'core',
          useWhen: '需要持续存在的状态说明（页面级、区块级）',
          notWhen: '一次性反馈 → UI.toast（提示条不会消失，用户回头还能看到）',
          variants: [
            { cls: 'ui-alert--info',    when: '中性信息' },
            { cls: 'ui-alert--success', when: '成功结果' },
            { cls: 'ui-alert--warning', when: '需要留意但未出错' },
            { cls: 'ui-alert--danger',  when: '出错了' },
            { cls: 'ui-alert--neutral', when: '纯说明，不携带语义' },
            { cls: 'ui-alert--outline', when: '需要更轻的视觉重量' }
          ],
          sizes: [],
          states: [],
          attrs: [
            { attr: 'ui-alert__icon / __body / __title / __desc', why: '图标 + 主体 + 标题 + 描述四段' },
            { attr: 'ui-alert__close + data-ui-dismiss', why: '关闭按钮两件套，缺一不可：类给样式，data-ui-dismiss 给行为（**只写类，按钮点了不会消失**）。留空值即关闭所在那条提示，也可写选择器指向别的元素' }
          ],
          aria: ['危险级提示用 role="alert"，普通提示不需要（避免读屏频繁打断）', '关闭按钮必须有 aria-label="关闭"，图标按钮读屏读不出内容'],
          events: [{ name: 'ui:dismiss', payload: '{}', when: '节点被移除前广播（不支持 preventDefault，要拦截就别写 data-ui-dismiss，自己接管）' }],
          copyHint: '文案公式：发生了什么 + 为什么 + 下一步做什么。写成正文，不要用方括号包注释。',
          snippet: `<div class="ui-alert ui-alert--warning">
  <span class="ui-alert__icon"><svg …></svg></span>
  <div class="ui-alert__body">
    <div class="ui-alert__title">本月剩余额度不足 10%</div>
    <div class="ui-alert__desc">额度用尽后接口将返回 429，建议提前升级套餐。</div>
  </div>
  <button class="ui-alert__close" type="button" data-ui-dismiss aria-label="关闭"><svg …></svg></button>
</div>`
        },

        {
          id: 'toast',
          title: '轻提示',
          base: 'UI.toast()',
          level: 'core',
          useWhen: '操作完成后的轻量反馈，用户不需要做任何事',
          notWhen: '需要用户决策 → UI.confirm；需要持续可见 → ui-alert',
          variants: [
            { cls: 'type: "success"', when: '操作成功' },
            { cls: 'type: "danger"',  when: '操作失败' },
            { cls: 'type: "warning"', when: '完成了但有需要注意的地方' }
          ],
          sizes: [],
          states: [],
          attrs: [
            { attr: 'message', why: '必填。写结果本身，不要写「操作成功」这类无信息量的话' },
            { attr: 'description', why: '可选。补一句为什么或下一步' },
            { attr: 'duration', why: '可选。默认自动消失' }
          ],
          aria: ['组件内部已是 role="status" + aria-live，调用方不需要再包'],
          events: [],
          api: ['UI.toast("已保存")', 'UI.toast({ message: "已保存", type: "success", description: "…" })'],
          snippet: `UI.toast('已复制到剪贴板');
UI.toast({ message: '已保存', type: 'success', description: '3 秒后自动关闭' });`
        },

        {
          id: 'badge',
          title: '徽章与标签',
          base: 'ui-badge / ui-tag / ui-status',
          level: 'core',
          useWhen: '给一段内容附加状态或分类；ui-status 用于行内的状态点 + 文字',
          notWhen: '可点击的筛选标签 → ui-chip（带关闭）或 ui-segment',
          variants: [
            { cls: 'ui-badge',            when: '默认中性徽章' },
            { cls: 'ui-badge--primary',   when: '主色徽章，用于强调当前项' },
            { cls: 'ui-badge--success',   when: '成功态' },
            { cls: 'ui-badge--warning',   when: '警告态' },
            { cls: 'ui-badge--danger',    when: '错误态' },
            { cls: 'ui-badge--info',      when: '信息态' },
            { cls: 'ui-badge--outline',   when: '低调的描边徽章' },
            { cls: 'ui-badge--pill',      when: '胶囊形' },
            { cls: 'ui-status--info',     when: '状态点 + 文字的完整组合' }
          ],
          sizes: [],
          states: [],
          attrs: [
            { attr: 'ui-dot', why: '状态点的圆点。可以内联 style="background: var(--ui-primary)" 换成主色' }
          ],
          aria: ['颜色不能是唯一信息载体：状态点旁要有文字。只有颜色时读屏与色盲用户都拿不到信息'],
          events: [],
          snippet: `<span class="ui-badge ui-badge--primary">主色</span>
<span class="ui-badge ui-badge--outline">描边</span>
<span class="ui-status ui-status--info">
  <span class="ui-dot" style="background: var(--ui-primary)"></span>进行中
</span>`
        },

        {
          id: 'menu',
          title: '下拉菜单',
          base: 'ui-dropdown-wrap / ui-menu',
          level: 'core',
          useWhen: '在一个触发器下收纳一组动作',
          notWhen: '一组互斥视图切换 → ui-segmented 或 ui-tabs',
          variants: [
            { cls: 'ui-menu--right', when: '靠右对齐，避免菜单顶出视口右缘' }
          ],
          sizes: [],
          states: ['aria-expanded 由组件维护'],
          attrs: [
            { attr: 'data-ui="dropdown"', why: '写在外层 .ui-dropdown-wrap 上' },
            { attr: 'data-ui="dropdown-trigger"', why: '写在触发按钮上' },
            { attr: 'role="menu" / role="menuitem"', why: '读屏据此进入菜单模式；单选型用 menuitemradio + aria-checked' }
          ],
          aria: ['触发按钮要有 aria-haspopup 与 aria-expanded（组件维护 expanded）'],
          events: [
            { name: 'ui:select', payload: '{ value, item }', when: '点击某个菜单项' }
          ],
          snippet: `<div class="ui-dropdown-wrap" data-ui="dropdown">
  <button class="ui-btn ui-btn--default" type="button" data-ui="dropdown-trigger">更多操作</button>
  <div class="ui-menu" role="menu" aria-label="更多操作">
    <button class="ui-menu__item" role="menuitem" type="button">重命名</button>
    <button class="ui-menu__item ui-menu__item--danger" role="menuitem" type="button">删除</button>
  </div>
</div>`
        },

        {
          id: 'tabs',
          title: '标签页',
          base: 'ui-tabs',
          level: 'core',
          useWhen: '同一上下文下切换几组内容视图',
          notWhen: '切换的是整页 → 用导航；选项少于 4 个且强调状态 → ui-segmented',
          variants: [
            { cls: 'ui-tabs--pill', when: '胶囊样式，用于卡片内的轻量切换' }
          ],
          sizes: [],
          states: ['aria-selected 由组件维护', ':focus-visible 下方向键可切换'],
          attrs: [
            { attr: 'data-ui="tabs"', why: '写在外层 .ui-tabs 上' },
            { attr: 'role="tablist" / role="tab" / aria-controls', why: '标签与其面板必须互相指向' },
            { attr: 'role="tabpanel" + tabindex="0"', why: '面板可聚焦，键盘用户 Tab 进来能读到内容' },
            { attr: 'hidden', why: '未选中的面板必须加，不能只靠样式隐藏' }
          ],
          aria: ['方向键左右切换由组件实现；每个 tab 要有 aria-selected 与 aria-controls'],
          events: [
            { name: 'ui:change', payload: '{ value, tab }', when: '切换标签' }
          ],
          snippet: `<div class="ui-tabs" data-ui="tabs">
  <div class="ui-tabs__list" role="tablist" aria-label="视图">
    <button class="ui-tab" role="tab" id="t1" type="button"
            aria-controls="p1" aria-selected="true">全部</button>
    <button class="ui-tab" role="tab" id="t2" type="button"
            aria-controls="p2" aria-selected="false">处理中</button>
  </div>
  <div class="ui-tabpanel" role="tabpanel" id="p1" aria-labelledby="t1" tabindex="0">…</div>
  <div class="ui-tabpanel" role="tabpanel" id="p2" aria-labelledby="t2" tabindex="0" hidden>…</div>
</div>`
        },

        {
          id: 'collapse',
          title: '折叠面板',
          base: 'ui-collapse',
          level: 'core',
          useWhen: '把次要内容收起来，让用户按需展开',
          notWhen: '内容需要始终可见 → 直接排版',
          variants: [
            { cls: 'ui-collapse--flush', when: '去掉外框，纯分隔线样式' }
          ],
          sizes: [],
          states: ['aria-expanded 由组件维护'],
          attrs: [
            { attr: 'data-ui="collapse"', why: '写在外层 .ui-collapse 上' },
            { attr: 'data-accordion', why: '写在外层上，切换为手风琴：同时只允许展开一项，开新的会自动收起旧的。不加就是各项独立开合' },
            { attr: 'aria-controls="<面板 id>"', why: 'header 指向面板。漏了会退回「取下一个兄弟节点」，结构一变就错位' },
            { attr: 'hidden', why: '收起的面板要写 hidden，不要只靠 max-height: 0' }
          ],
          aria: ['header 必须是 <button>，且带 aria-expanded 与 aria-controls'],
          events: [
            { name: 'ui:toggle', payload: '{ open, panel }', when: '展开或收起' }
          ],
          snippet: `<div class="ui-collapse" data-ui="collapse">
  <div class="ui-collapse__item">
    <button class="ui-collapse__header" type="button"
            aria-expanded="false" aria-controls="cp1">
      <span>常见问题</span>
      <span class="ui-collapse__chevron"><svg …></svg></span>
    </button>
    <div class="ui-collapse__panel" id="cp1" hidden>答案</div>
  </div>
</div>`
        },

        {
          id: 'popconfirm',
          title: '二次确认',
          base: 'ui-popconfirm-host',
          level: 'core',
          useWhen: '破坏性或不常见的操作，就地确认而不跳弹窗',
          notWhen: '后果复杂、需要用户阅读较多信息 → ui-modal',
          variants: [],
          sizes: [],
          states: [],
          attrs: [
            { attr: 'data-ui="popconfirm"', why: '写在外层 host 上，三个 data-popconfirm-* 提供文案' },
            { attr: 'data-ui="popconfirm-trigger"', why: '写在触发按钮上' },
            { attr: 'data-popconfirm-title / -desc / -ok / -cancel', why: '标题 / 后果说明 / 确认按钮文案 / 取消按钮文案。ok 与 cancel 漏了会用默认值「确认 / 取消」' }
          ],
          aria: ['desc 里必须写清后果与不可逆性，不要只写「确定吗？」'],
          events: [
            { name: 'ui:confirm', payload: '{}', when: '用户点了确认' }
          ],
          snippet: `<span class="ui-popconfirm-host" data-ui="popconfirm"
      data-popconfirm-title="确认删除该 API 密钥？"
      data-popconfirm-desc="删除后使用该密钥的调用会立即失败，且无法恢复。"
      data-popconfirm-ok="删除">
  <button class="ui-btn ui-btn--danger-outline" type="button"
          data-ui="popconfirm-trigger">删除密钥</button>
</span>`
        }
      ],

      more: [
        { base: 'ui-icon-btn',        title: '图标按钮',    note: '必须有 aria-label。变体：--outline / --sm' },
        { base: 'ui-avatar',          title: '头像',        note: '变体：--sm / --lg / --square；ui-avatar-group 叠放；ui-avatar__status 状态点' },
        { base: 'ui-textarea',        title: '多行输入',    note: '与 ui-input 同族，宽度可用 style 控制' },
        { base: 'ui-select',          title: '下拉选择',    note: '变体：--sm / --lg。原生 select，样式由库接管' },
        { base: 'ui-input-group',     title: '输入组',      note: 'ui-input-group__addon 前后缀，__addon--prefix 是前缀' },
        { base: 'ui-search',          title: '搜索框',      note: '带前置图标的搜索输入' },
        { base: 'ui-dropzone',        title: '上传区',      note: 'data-ui="dropzone"；文件列表容器要两件套：class="ui-file-list" + data-ui-file-list（放同级或内部），漏了属性选了文件没地方显示；每项用 ui-file（__icon / __name / __meta / __remove）' },
        { base: 'ui-tooltip',         title: '气泡提示',    note: '写 data-tooltip 即可，data-tooltip-placement 控制方向；hover 与 focus 都触发' },
        { base: 'ui-progress',        title: '进度条',      note: 'ui-progress__bar 控宽度；变体 --sm / --lg / --success / --danger' },
        { base: 'ui-ring',            title: '环形进度',    note: 'ui-ring__value 显示百分比' },
        { base: 'ui-loading',         title: '加载态',      note: 'ui-spinner（--sm / --lg / --inverse）、ui-skeleton（--text / --title / --block / --avatar）' },
        { base: 'ui-empty',           title: '空状态',      note: 'ui-empty__icon / __title / __desc / __actions 四段' },
        { base: 'ui-result',          title: '结果页',      note: '变体 --success / --warning / --danger；比空状态更重，用于流程终点' },
        { base: 'ui-sidenav',         title: '侧栏导航',    note: 'ui-sidenav__group / __label / __item / __badge' },
        { base: 'ui-segmented',       title: '分段控件',    note: 'ui-segment 为子项；--block 撑满宽度' },
        { base: 'ui-breadcrumb',      title: '面包屑',      note: 'ui-breadcrumb__item / __sep；当前项加 aria-current="page"' },
        { base: 'ui-pagination',      title: '分页',        note: 'data-ui="pagination"；每个可点项必须写 data-page="页码"（**漏了点了不翻页**），__ellipsis / __info 不可点' },
        { base: 'ui-steps',           title: '步骤条',      note: 'ui-step（--done / --active）+ __marker / __title / __desc / __rail；--vertical / --responsive' },
        { base: 'ui-timeline',        title: '时间线',      note: 'ui-timeline__item（--done / --active）+ __dot / __rail / __time' },
        { base: 'ui-desc',            title: '描述列表',    note: '「标签 - 值」成对展示，表格的轻量替代' },
        { base: 'ui-stat',            title: '统计卡',      note: 'ui-stat__label / __value / __unit / __trend（--up / --down）/ __icon' },
        { base: 'ui-feature',         title: '特性卡',      note: 'ui-feature__icon / __title / __desc，用于卖点罗列' },
        { base: 'ui-codeblock',       title: '代码块',      note: '--light 浅色变体；ui-codeblock__copy 复制按钮' },
        { base: 'ui-toolbar',         title: '工具栏',      note: 'ui-toolbar__group / __spacer，一行操作区' },
        { base: 'ui-metrics',         title: '指标条',      note: '一排并列的指标' },
        { base: 'ui-cta',             title: '行动号召',    note: 'ui-cta__title / __desc / __actions' },
        { base: 'ui-hero',            title: '首屏区块',    note: 'ui-hero__eyebrow / __title / __desc / __actions；--split 左右分栏' },
        { base: 'ui-section-header',  title: '区块标题',    note: 'ui-section-header__title / __desc；--center 居中' },
        { base: 'ui-footer',          title: '页脚',        note: 'ui-footer__grid / __col / __title / __link / __bottom' },
        { base: 'ui-banner',          title: '横幅通告',    note: 'ui-banner__cta' },
        { base: 'ui-navbar',          title: '顶部导航',    note: 'ui-navbar__inner / __brand / __logo / __actions；data-ui="navbar" + data-navbar-drawer="#抽屉 id"；窄屏汉堡按钮写 data-ui-navbar-toggle' },
        { base: 'ui-nav',             title: '导航链接组',  note: 'ui-nav__link；当前页加 aria-current="page"，自带高亮样式' },
        { base: 'ui-list',            title: '列表',        note: 'ui-list__item / __main / __title / __sub；--divided-none / __item--interactive' },
        { base: 'ui-chip',            title: '可关闭标签',  note: 'ui-chip__close' },
        { base: 'ui-tag',             title: '可选标签',    note: '--selected 为选中态' },
        { base: 'ui-backdrop',        title: '遮罩',        note: '一般不用手写，弹层内部已包含' },
        { base: 'ui-backtop',         title: '回到顶部',    note: 'data-ui="backtop" 即可，位置由库决定' }
      ]
    },

    /* ------------------------------------------------------------
       行为层钩子。data-ui 的值就是这套。
       ------------------------------------------------------------ */
    behaviors: [
      { attr: 'data-ui="dropdown"',        on: '外层容器',     note: '配 data-ui="dropdown-trigger"；菜单项的取值写 data-value="…"' },
      { attr: 'data-ui="popconfirm"',      on: '外层容器',     note: '配 data-ui="popconfirm-trigger"' },
      { attr: 'data-ui="tabs"',            on: '外层容器',     note: '配 role="tablist"' },
      { attr: 'data-ui="segmented"',       on: '外层容器',     note: '' },
      { attr: 'data-ui="collapse"',        on: '外层容器',     note: '加 data-accordion 切换成同时只开一项' },
      { attr: 'data-ui="pagination"',      on: '外层容器',     note: '可点项必须带 data-page="页码"' },
      { attr: 'data-ui="table-sort"',      on: '.ui-table-wrap', note: '表头按钮必须用 ui-table__sort 且带 data-sort="列号"' },
      { attr: 'data-ui="dropzone"',        on: '拖放区',       note: '加 tabindex="0" 让键盘也能触发' },
      { attr: 'data-ui="backtop"',         on: '按钮',         note: '' },
      { attr: 'data-ui="copy"',            on: '按钮',         note: '配 data-copy-target="#id" 或 data-copy="文本"；data-copy-toast 自定义成功提示' },
      { attr: 'data-ui="navbar"',          on: '.ui-navbar',   note: '配 data-navbar-drawer="#id"，窄屏由抽屉接管导航；汉堡按钮写 data-ui-navbar-toggle' },
      { attr: 'data-ui="validate"',        on: '<form>',       note: '字段上配 data-validate' },
      { attr: 'data-ui="modal" / "drawer"', on: '触发按钮',     note: '必须配 data-target="#id"' },
      { attr: 'data-tooltip="文本"',        on: '任意元素',     note: '不需要 data-ui，扫描时单独处理' }
    ],

    /* ------------------------------------------------------------
       全部对外事件。都是 ui:* 自定义事件，冒泡到 document。
       ------------------------------------------------------------ */
    events: [
      { name: 'ui:ready',   payload: '{ version }',  from: 'document', when: '全部组件初始化完成' },
      { name: 'ui:error',   payload: '{ component, error }', from: '组件元素', when: '单个组件初始化失败（其余组件不受影响）' },
      { name: 'ui:open',    payload: '{}',           from: '弹层元素', when: 'modal / drawer 打开后' },
      { name: 'ui:close',   payload: '{ reason }',   from: '弹层元素', when: 'modal / drawer 关闭后' },
      { name: 'ui:change',  payload: 'tabs/segmented → { value, tab? }；pagination → { page }', from: 'tabs / segmented / pagination', when: '切换选项或翻页' },
      { name: 'ui:select',  payload: '{ value, item }', from: 'dropdown', when: '点击菜单项' },
      { name: 'ui:toggle',  payload: '{ open, panel }', from: 'collapse', when: '展开或收起' },
      { name: 'ui:sort',    payload: '{ index, direction }', from: 'table', when: '点击表头排序' },
      { name: 'ui:file',    payload: '{ files }',    from: 'dropzone', when: '选择或拖入文件' },
      { name: 'ui:copy',    payload: '{ ok, text }', from: 'copy 按钮', when: '复制成功或失败' },
      { name: 'ui:submit',  payload: '{ formData }', from: 'form', when: '校验通过并提交' },
      { name: 'ui:invalid', payload: '{}',           from: 'form', when: '提交时存在未通过的字段' },
      { name: 'ui:confirm', payload: '{}',           from: 'popconfirm', when: '用户确认' },
      { name: 'ui:dismiss', payload: '{}',           from: '被关闭的元素', when: 'data-ui-dismiss 关闭前广播（组件随后直接移除节点，不支持拦截）' }
    ],

    /* ------------------------------------------------------------
       命令式 API。声明式写不了或很别扭时才用。
       ------------------------------------------------------------ */
    api: [
      { call: 'UI.toast(message | options)',  use: '轻提示' },
      { call: 'UI.modal.open(sel) / .close(sel) / .toggle(sel)', use: '模态框' },
      { call: 'UI.drawer.open(sel) / .close(sel) / .toggle(sel)', use: '抽屉' },
      { call: 'await UI.confirm({ title, description, okText, danger })', use: '确认对话框，返回是否确认' },
      { call: 'UI.copy(text)',                use: '复制到剪贴板，返回 Promise<boolean>' },
      { call: 'UI.lockScroll() / UI.unlockScroll()', use: '手动锁滚动（弹出自己的浮层时）' },
      { call: 'UI.position(anchor, floating, options)', use: '把浮层定位到锚点旁，自动避让视口边界' },
      { call: 'UI.init(root)',                use: '动态插入 DOM 后重新初始化组件' },
      { call: 'UI.formatSize(bytes)',         use: '文件大小格式化' }
    ]
  };

  global.OwnUISpec = SPEC;
})(typeof window !== 'undefined' ? window : this);
