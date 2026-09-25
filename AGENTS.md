# OwnUI 使用规范

> 在本项目里写任何界面代码之前，先读完这一份。
> 它比通读 `components.css`（1500 行）快，也比凭经验猜准。

适用于 OwnUI v1.0.0。CSS 变量 + 原生 JS，零依赖零构建。中性无色主题打底，主色一处可换；每个交互组件实现七态，命中区与对比度按无障碍底线校验。

## 1. 先按这个顺序引入，缺一不可

```html
<link rel="stylesheet" href="library/tokens.css">
<link rel="stylesheet" href="library/base.css">
<link rel="stylesheet" href="library/components.css">
<script src="library/components.js"></script>
```

四个文件按顺序引入，不需要构建工具，也不需要任何 npm 依赖。

## 2. 禁止清单

这一节最先读。下面每一条都被真实写错过 —— 不是风格偏好，是「写了就不生效」或「写了就出错」。

| 不要写 | 为什么 | 改成 |
|---|---|---|
| `container / row / col-* / d-flex / mt-3 / px-4` | Bootstrap 与 Tailwind 的类名。本库没有这些，写了不报错，只是完全不生效。 | 布局用 ui-container / ui-grid / ui-stack / ui-row / ui-cluster，间距用 gap 不用外边距堆叠 |
| `btn / btn-primary / el-button / ant-btn` | 其他组件库的按钮类名。本库一律 ui- 前缀 + BEM 双横线。 | class="ui-btn ui-btn--primary" |
| `color: #2563EB  /  background: rgb(37,99,235)  /  border-color: red` | 写死色值会绕过主题层：换主色、切深色模式时它不会变，是整站唯一不跟随的地方。 | var(--ui-primary) / var(--ui-danger) / var(--ui-text-2) 这类语义 token |
| `font-size: 14px 这类裸 px 字号` | 字阶是离散档位（40/32/24/20/16/15/14/13/12/11），裸写 px 会跳出体系且不随排版比例调整。 | var(--ui-fs-14) 这类档位 token，或 var(--ui-type-body) 这类语义字阶 |
| `margin: 10px  /  padding: 18px` | 间距是 4pt 基准（4/8/12/16/20/24/32/40/48/64），10 和 18 不在刻度上。 | var(--ui-space-*)；相邻元素之间优先用父容器的 gap，不要逐个加 margin |
| `border-radius: 10px` | 圆角只有 5 档加一个胶囊值（4/8/12/16/24/32/999）。 | var(--ui-radius-control) / var(--ui-radius-block) / var(--ui-radius-card) / var(--ui-radius-pill) |
| `!important` | 覆盖库样式是不可逆的耦合：以后组件升级你这份覆盖会静默失效或反向打架。 | 改 token（--ui-primary 等），或新写一个自己的类挂在组件外层 |
| `自己写 position: fixed 做弹层` | 层级、滚动锁、焦点陷阱、Esc 关闭、点击遮罩关闭、aria-hidden 同步，六件事都要自己做，且很难做全。 | .ui-modal / .ui-drawer，或 UI.modal.open() / UI.drawer.open() |
| `给 .ui-btn 加 style="background:#xxx"` | 单点改色会让 hover 与 active 还停在原来的主色上，出现「悬停变回蓝色」的割裂。 | 改 --ui-primary，让 600/700/800 三档一起走 |
| `var(--ui-p-600) 直接写在组件里` | 这是 L1 原子层，属于主题的作用域。主按钮在深色模式下要用 400 档浅色，写死 600 会得到深底深字。 | var(--ui-primary)。它在深色模式下由主题层改指到 --ui-primary-dark-* |

## 3. 必须做的事

| 规则 | 漏了的后果 |
|---|---|
| 引入顺序 tokens → base → components → components.js | 后面每层都引用前面的变量，反了就取不到值 |
| <button> 必须写 type="button" | 表单里的按钮默认是 submit，不写会意外提交整个表单 |
| data-ui="modal" 必须与 data-target="#id" 成对出现 | 触发按钮靠 data-target 找目标，少一个就点不开 |
| 弹层元素上要有 role="dialog" aria-modal="true" aria-labelledby="<标题 id>" | 读屏软件据此切换上下文；漏了屏幕阅读器会继续念背景内容 |
| 折叠面板的 header 要带 aria-expanded 与 aria-controls | 键盘与读屏用户无法得知当前是展开还是收起 |
| 标签页要写全 role="tablist" / role="tab" / aria-selected / aria-controls / role="tabpanel" | 这是一整套结构，缺一环方向键导航就失效 |
| 图标按钮必须有 aria-label | 按钮内只有 SVG，没有可读文本，读屏用户听到的是「按钮」两个字 |
| 表单出错时既要 aria-invalid="true"，也要 aria-describedby 指向错误元素 | 只上红框，读屏用户不知道错在哪 |
| 颜色不能是唯一的信息载体 | 状态点、趋势箭头这类要配文字或图标，色盲用户也要能分辨 |

## 4. Token：只用 L2 语义层

三层结构，你自己的样式里应该只出现中间那层。

| 层 | 名字 | 前缀 | 作用 | 你什么时候碰它 |
|---|---|---|---|---|
| L1 | 原子层 | `--ui-p-* / --ui-n-*` | 具体色阶，换主题就是换它 | 只在主题定义处出现 |
| L2 | 语义层 | `--ui-primary* / --ui-text* / --ui-border*` | 把色阶映射成角色 | 组件样式与你的自定义样式 |
| L3 | 组件层 | `--ui-btn-primary-bg / --ui-card-bg` | 单个组件的取值出口 | 需要单独改某个组件时 |

**自己写样式时用 L2。L1 只在你要做一套新主题时才碰；L3 只在要单独扳某一个组件时才碰。**

常用语义 token：

| token | 用途 |
|---|---|
| `--ui-text` | 正文与标题的主文字色 |
| `--ui-text-2` | 次级文字：说明、标签、表格副列 |
| `--ui-text-3` | 三级文字：占位符、辅助说明、禁用前的提示 |
| `--ui-bg` | 页面底色 |
| `--ui-surface` | 卡片、弹层、导航栏的表面色 |
| `--ui-surface-2` | 表面之上的次级面：内嵌区块、悬停底 |
| `--ui-border` | 默认描边与分隔线 |
| `--ui-border-strong` | 需要更明确边界的描边：输入框、虚线框 |
| `--ui-primary` | 主色。主按钮底、进度条、选中态、焦点环 |
| `--ui-primary-hover` | 主色的悬停档（品牌色深一档） |
| `--ui-primary-active` | 主色的按下档（比悬停再深一档） |
| `--ui-primary-text` | 压在主色底上的文字色。深色模式下会自动翻成墨字 |
| `--ui-primary-weak` | 主色的淡底：选中行、轻提示背景 |
| `--ui-primary-border` | 主色的描边：选中卡片外框 |
| `--ui-danger` | 破坏性操作、错误态 |
| `--ui-success` | 成功态 |
| `--ui-warning` | 警告态 |

## 5. 状态方向（猜不到，照抄）

主色取 600 档。hover 深一档走 700，active 再深一档走 800，深色模式的淡底走 900。

| 档位 | 角色 |
|---|---|
| `--ui-p-50` | weak 淡底 |
| `--ui-p-100` | weak 淡底 hover |
| `--ui-p-200` | weak 边框 / 深色模式 active |
| `--ui-p-300` | 深色模式 hover |
| `--ui-p-400` | 深色模式主色 |
| `--ui-p-500` | 中间档 |
| `--ui-p-600` | 主色本身。压白字必须 ≥4.5:1 |
| `--ui-p-700` | hover |
| `--ui-p-800` | active |
| `--ui-p-900` | 深色模式下的 weak 淡底 |

- 品牌色一律「变深」。唯一例外是中性墨黑：它已经最暗，再加深肉眼分不出，所以它的 hover/active 反而往浅处走。
- 深色模式下主色不反白，改走上半档浅色（400/300/200）以保住色相。只有墨黑没有色相可保，才整体反白。

## 6. 刻度：不要自由取值

### 间距（4pt 基准）

4pt 基准。相邻元素之间用父容器的 gap，不要逐个加 margin —— 后者在换行折行时会崩。

| token | 值 | 典型用途 |
|---|---|---|
| `--ui-space-1` | 4px | 图标与文字之间 |
| `--ui-space-2` | 8px | 同组控件之间、按钮图标与文字 |
| `--ui-space-3` | 12px | 表单标签与输入框、卡片内小节之间 |
| `--ui-space-4` | 16px | 卡片内边距、区块内的行距 |
| `--ui-space-5` | 20px | 稍大的卡片内边距 |
| `--ui-space-6` | 24px | 区块内各组之间 |
| `--ui-space-8` | 32px | 区块之间 |
| `--ui-space-10` | 40px | 大区块之间 |
| `--ui-space-12` | 48px | 段落级别的大间隔 |
| `--ui-space-16` | 64px | 首屏与页脚这类超大间隔 |

### 圆角

五个档位 + 一个胶囊值。组件已经用对了，你只在写自定义块时需要选。

| token | 值 | 用途 |
|---|---|---|
| `--ui-radius-control` | 8px | 按钮、输入框、下拉项这类控件（默认就是它） |
| `--ui-radius-block` | 12px | 内嵌的小区块、代码块 |
| `--ui-radius-card` | 16px | 卡片、弹窗、抽屉面板 |
| `--ui-radius-sheet` | 24px | 底部抽屉、大面积浮层 |
| `--ui-radius-xs` | 4px | 徽章、小标签 |
| `--ui-radius-pill` | 999px | 胶囊按钮、状态点、头像 |

### 字阶

写字号用档位 token 或语义 token，不要裸写 px。

| 档位 token | 值 | 语义 token | 用途 |
|---|---|---|---|
| `--ui-fs-40` | 40px | `--ui-type-display` | 首屏大标题 |
| `--ui-fs-32` | 32px | `--ui-type-h1` | 页面标题 |
| `--ui-fs-24` | 24px | `--ui-type-h2` | 区块标题 |
| `--ui-fs-20` | 20px | `--ui-type-h3` | 卡片组标题 |
| `--ui-fs-16` | 16px | `--ui-type-h4` | 卡片标题 |
| `--ui-fs-15` | 15px | `--ui-type-body` | 正文默认 |
| `--ui-fs-14` | 14px | — | 控件文字、表格 |
| `--ui-fs-13` | 13px | `--ui-type-body-sm` | 次级正文 |
| `--ui-fs-12` | 12px | `--ui-type-caption` | 说明、辅助信息 |
| `--ui-fs-11` | 11px | `--ui-type-overline` | 分组标签（配 letter-spacing） |

## 7. 布局：用现成的工具类

最容易犯的错是自己写 `display: flex` 加 `margin`。本库已经有这些：

| 类名 | 用途 |
|---|---|
| `ui-container` | 页面主容器，带左右留白与最大宽度 |
| `ui-container--wide` | 更宽的容器，导航栏与页脚用这个 |
| `ui-container--fluid` | 不要最大宽度，撑满视口 |
| `ui-section` | 纵向区块，自带上下间距 |
| `ui-section--tight` | 区块间距收一档 |
| `ui-section--flush` | 去掉区块的上下间距 |
| `ui-stack ui-stack--4` | 纵向堆叠 + 统一间距。数字是 --ui-space-* 的档位（1/2/3/4/5/6/8/10） |
| `ui-grid ui-grid--3` | 等分栅格。--2 / --3 / --4 是固定列数 |
| `ui-grid--auto` | 自动列数，每列最小约 200px，随容器宽度增减 |
| `ui-grid--auto-sm` | 同上但最小列宽更小，用于紧凑卡片墙 |
| `ui-grid--sidebar` | 两栏：固定的侧栏 + 弹性主区 |
| `ui-grid--tight` | 栅格间距收一档 |
| `ui-row ui-row--between` | 横向排布 + 两端对齐 |
| `ui-row--center` | 横向排布 + 居中 |
| `ui-row--end` | 横向排布 + 靠右 |
| `ui-row--top` | 横向排布 + 顶端对齐（默认是垂直居中） |
| `ui-row--nowrap` | 禁止换行（默认会换行） |
| `ui-cluster ui-cluster--3` | 横向排布且允许换行，间距统一。按钮组、标签组用这个 |
| `ui-divider` | 分隔线 |
| `ui-divider--vertical` | 竖分隔线，用于行内元素之间 |
| `ui-spacer` | 弹性占位，把后面的内容推到另一端 |
| `ui-hide-sm` | ≤768px 时隐藏。用于导航栏里放不下的次要元素 |

### 排版与文字

别自己拼 `font-size` + `color`，这些类已经把字号、行高、色阶配好了。

| 类名 | 用途 |
|---|---|
| `ui-display` | 超大标题 |
| `ui-h1` | 页面标题 |
| `ui-h2` | 区块标题 |
| `ui-h3` | 小节标题 |
| `ui-h4` | 卡片标题 |
| `ui-lead` | 导语，比正文大一号 |
| `ui-text` | 正文（默认字号，通常不用写） |
| `ui-text-sm` | 小一号正文 |
| `ui-caption` | 说明文字，配 ui-muted 用 |
| `ui-overline` | 分组标签，自带大写与字距 |
| `ui-muted` | 把文字降到次级色（--ui-text-2） |
| `ui-subtle` | 把文字降到三级色（--ui-text-3） |
| `ui-mono` | 等宽字体 |
| `ui-num` | 等宽数字，表格与统计里的数字对齐 |
| `ui-code` | 行内代码，带底色与圆角 |
| `ui-kbd` | 键盘按键样式 |
| `ui-link` | 文本链接 |
| `ui-prose` | 富文本容器，自动处理段落、列表、标题的间距 |

## 8. 什么场景用什么

类名往往能写对，选错容器才是更常见的错。

| 场景 | 用 | 不要用 |
|---|---|---|
| 只是想竖向排列几个元素，加一点间距 | ui-stack + gap | 给每个元素加 margin-bottom |
| 需要等分或自定义列数的横向排列 | ui-grid | 自己写 display:flex + width 百分比 |
| 一排按钮或标签，允许换行 | ui-cluster | ui-row（它不换行，窄屏会溢出） |
| 内容需要边界与表面 | ui-card | 加一层 div 再自己写 border + padding |
| 容器内只有一行相关操作 | ui-toolbar | 套一层 ui-card 再叠按钮 |
| 展示「标签 - 值」成对的结构化信息 | ui-desc | 两列表格 |
| 真正的二维数据表，需要排序 | ui-table-wrap + ui-table + data-ui="table-sort" | 用 ui-list 拼表格 |
| 破坏性操作（删除、下线、不可逆） | ui-btn--danger-outline + data-ui="popconfirm" 二次确认 | 直接执行，或只弹一个 toast |
| 需要用户集中注意力完成一件事 | ui-modal | 页内展开一大块表单 |
| 从侧边临时进入、不打断主任务 | ui-drawer | ui-modal（会打断上下文） |
| 操作完成后的轻量反馈 | UI.toast({ message, type }) | UI.confirm（那是要用户决策的） |
| 需要用户先确认再执行 | UI.confirm({ title, description }) | 自行拼一个 div 当弹窗 |
| 页面上持续存在的状态说明 | ui-alert | ui-toast（它会消失，用户回头看不到） |
| 数据为空时的引导 | ui-empty（可作为表体占位用 ui-table__placeholder） | 空白一片 |
| 首屏之后的内容很长 | data-ui="backtop" 回顶按钮 | 让用户自己滚回去 |

## 9. 组件速查

标记 ★ 的是高频组件，下面第 10 节给了完整片段；其余照抄结构即可。

| 基类 | 组件 | 用途 |
|---|---|---|
| `ui-btn` ★ | 按钮 | 触发一个动作 |
| `ui-input` ★ | 输入框 | 单行文本录入 |
| `ui-field` ★ | 表单与校验 | 需要标签、帮助文字、错误提示三件套的表单项 |
| `ui-check / ui-radio / ui-switch` ★ | 选择控件 | 布尔开关用 ui-switch；多选用 ui-check；互斥单选且选项少用 ui-radio |
| `ui-card` ★ | 卡片 | 内容需要边界与表面，或用卡片表达一组可点选的对象 |
| `ui-table-wrap / ui-table` ★ | 表格 | 真正的二维数据，列之间有对应关系 |
| `ui-modal` ★ | 模态框 | 需要用户集中注意力完成一件事，且不完成就没法继续 |
| `ui-drawer` ★ | 抽屉 | 从侧边临时进入，不打断主任务（筛选、详情、移动端导航） |
| `ui-alert` ★ | 提示条 | 需要持续存在的状态说明（页面级、区块级） |
| `UI.toast()` ★ | 轻提示 | 操作完成后的轻量反馈，用户不需要做任何事 |
| `ui-badge / ui-tag / ui-status` ★ | 徽章与标签 | 给一段内容附加状态或分类；ui-status 用于行内的状态点 + 文字 |
| `ui-dropdown-wrap / ui-menu` ★ | 下拉菜单 | 在一个触发器下收纳一组动作 |
| `ui-tabs` ★ | 标签页 | 同一上下文下切换几组内容视图 |
| `ui-collapse` ★ | 折叠面板 | 把次要内容收起来，让用户按需展开 |
| `ui-popconfirm-host` ★ | 二次确认 | 破坏性或不常见的操作，就地确认而不跳弹窗 |
| `ui-icon-btn` | 图标按钮 | 必须有 aria-label。变体：--outline / --sm |
| `ui-avatar` | 头像 | 变体：--sm / --lg / --square；ui-avatar-group 叠放；ui-avatar__status 状态点 |
| `ui-textarea` | 多行输入 | 与 ui-input 同族，宽度可用 style 控制 |
| `ui-select` | 下拉选择 | 变体：--sm / --lg。原生 select，样式由库接管 |
| `ui-input-group` | 输入组 | ui-input-group__addon 前后缀，__addon--prefix 是前缀 |
| `ui-search` | 搜索框 | 带前置图标的搜索输入 |
| `ui-dropzone` | 上传区 | data-ui="dropzone"；文件列表容器要两件套：class="ui-file-list" + data-ui-file-list（放同级或内部），漏了属性选了文件没地方显示；每项用 ui-file（__icon / __name / __meta / __remove） |
| `ui-tooltip` | 气泡提示 | 写 data-tooltip 即可，data-tooltip-placement 控制方向；hover 与 focus 都触发 |
| `ui-progress` | 进度条 | ui-progress__bar 控宽度；变体 --sm / --lg / --success / --danger |
| `ui-ring` | 环形进度 | ui-ring__value 显示百分比 |
| `ui-loading` | 加载态 | ui-spinner（--sm / --lg / --inverse）、ui-skeleton（--text / --title / --block / --avatar） |
| `ui-empty` | 空状态 | ui-empty__icon / __title / __desc / __actions 四段 |
| `ui-result` | 结果页 | 变体 --success / --warning / --danger；比空状态更重，用于流程终点 |
| `ui-sidenav` | 侧栏导航 | ui-sidenav__group / __label / __item / __badge |
| `ui-segmented` | 分段控件 | ui-segment 为子项；--block 撑满宽度 |
| `ui-breadcrumb` | 面包屑 | ui-breadcrumb__item / __sep；当前项加 aria-current="page" |
| `ui-pagination` | 分页 | data-ui="pagination"；每个可点项必须写 data-page="页码"（**漏了点了不翻页**），__ellipsis / __info 不可点 |
| `ui-steps` | 步骤条 | ui-step（--done / --active）+ __marker / __title / __desc / __rail；--vertical / --responsive |
| `ui-timeline` | 时间线 | ui-timeline__item（--done / --active）+ __dot / __rail / __time |
| `ui-desc` | 描述列表 | 「标签 - 值」成对展示，表格的轻量替代 |
| `ui-stat` | 统计卡 | ui-stat__label / __value / __unit / __trend（--up / --down）/ __icon |
| `ui-feature` | 特性卡 | ui-feature__icon / __title / __desc，用于卖点罗列 |
| `ui-codeblock` | 代码块 | --light 浅色变体；ui-codeblock__copy 复制按钮 |
| `ui-toolbar` | 工具栏 | ui-toolbar__group / __spacer，一行操作区 |
| `ui-metrics` | 指标条 | 一排并列的指标 |
| `ui-cta` | 行动号召 | ui-cta__title / __desc / __actions |
| `ui-hero` | 首屏区块 | ui-hero__eyebrow / __title / __desc / __actions；--split 左右分栏 |
| `ui-section-header` | 区块标题 | ui-section-header__title / __desc；--center 居中 |
| `ui-footer` | 页脚 | ui-footer__grid / __col / __title / __link / __bottom |
| `ui-banner` | 横幅通告 | ui-banner__cta |
| `ui-navbar` | 顶部导航 | ui-navbar__inner / __brand / __logo / __actions；data-ui="navbar" + data-navbar-drawer="#抽屉 id"；窄屏汉堡按钮写 data-ui-navbar-toggle |
| `ui-nav` | 导航链接组 | ui-nav__link；当前页加 aria-current="page"，自带高亮样式 |
| `ui-list` | 列表 | ui-list__item / __main / __title / __sub；--divided-none / __item--interactive |
| `ui-chip` | 可关闭标签 | ui-chip__close |
| `ui-tag` | 可选标签 | --selected 为选中态 |
| `ui-backdrop` | 遮罩 | 一般不用手写，弹层内部已包含 |
| `ui-backtop` | 回到顶部 | data-ui="backtop" 即可，位置由库决定 |

## 10. 常用片段（照抄）

### 按钮 · `ui-btn`

用它的时机：触发一个动作。
不要用它的时机：只是跳转 → 用 <a class="ui-btn …"> 保留语义；纯图标 → ui-icon-btn。

| 变体 | 什么时候用 |
|---|---|
| `ui-btn--primary` | 页面上的主操作，一个视口内只放一个 |
| `ui-btn--default` | 常规次要操作（默认值，可以不写） |
| `ui-btn--ghost` | 低权重操作、工具条内、卡片内的附属动作 |
| `ui-btn--danger` | 破坏性操作且必须显眼 |
| `ui-btn--danger-outline` | 破坏性操作但需克制（列表行内的删除） |
| `ui-btn--link` | 看起来像链接的按钮 |
| `ui-btn--block` | 撑满父容器宽度 |
| `ui-btn--pill` | 胶囊形 |

```html
<button class="ui-btn ui-btn--primary" type="button">主操作</button>
<button class="ui-btn ui-btn--default" type="button">次操作</button>
<button class="ui-btn ui-btn--danger-outline" type="button">删除</button>

<!-- 按钮内可放图标，图标加 ui-btn__icon -->
<button class="ui-btn ui-btn--default" type="button">
  <span class="ui-btn__icon"><svg …></svg></span>带图标
</button>
```

关键属性：

- `type="button"` —— 表单内默认是 submit，会意外提交
- `ui-btn__icon` —— 按钮内图标用这个类，自动处理间距与对齐

无障碍：纯图标按钮必须 aria-label；加载态用 aria-busy="true"。

### 输入框 · `ui-input`

用它的时机：单行文本录入。
不要用它的时机：多行 → ui-textarea；从固定选项里选 → ui-select；搜索 → ui-search。

| 变体 | 什么时候用 |
|---|---|
| `ui-input--sm` | 工具条内、表格行内编辑 |
| `ui-input--lg` | 首屏或强调场景 |

```html
<div class="ui-field">
  <label class="ui-label" for="name">名称 <span class="ui-label__required">*</span></label>
  <input class="ui-input" id="name" type="text" placeholder="例如：订单中心重构">
  <div class="ui-help">帮助文字，写在输入框下方</div>
</div>

<!-- 出错态 -->
<input class="ui-input is-invalid" aria-invalid="true" aria-describedby="err-name">
<div class="ui-error" id="err-name">名称不能为空</div>
```

关键属性：

- `placeholder` —— 写示例值（如 order-center），不要写「请输入…」这类无信息量的提示

无障碍：出错时同时给 aria-invalid="true" 与 aria-describedby 指向错误元素；用 <label for> 关联，不要只靠 placeholder。

### 表单与校验 · `ui-field`

用它的时机：需要标签、帮助文字、错误提示三件套的表单项。
不要用它的时机：单摆一个裸输入框 → 直接 ui-input。

```html
<form class="ui-form ui-stack ui-stack--4" data-ui="validate">
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

<!-- 可用规则：required / email / phone / min:N / max:N / code -->
```

关键属性：

- `data-ui="validate"` —— 写在 <form> 上，开启即时校验与提交拦截
- `data-validate="required|phone"` —— 写在字段上，多个规则用竖线分隔
- `data-message-required="自定义文案"` —— 写在字段上，替换「此项为必填」这条默认文案
- `data-error-text` —— 写在字段里那个承载错误文案的元素上，校验失败时由它显示（找不到就退回字段本身）

无障碍：校验失败会聚焦第一个出错字段，并自动补 aria-describedby。

事件：`ui:submit`（全部校验通过并提交）、`ui:invalid`（存在未通过的字段）。

### 选择控件 · `ui-check / ui-radio / ui-switch`

用它的时机：布尔开关用 ui-switch；多选用 ui-check；互斥单选且选项少用 ui-radio。
不要用它的时机：选项多于 5 个的单选 → ui-select。

| 变体 | 什么时候用 |
|---|---|
| `ui-switch--sm` | 紧凑场景 |

```html
<label class="ui-check">
  <input type="checkbox" id="c1"><span class="ui-check__box"></span>
  <span class="ui-check__label" for="c1">接收周报</span>
</label>

<span class="ui-switch">
  <input type="checkbox" id="s1" checked>
  <span class="ui-switch__track"></span>
  <label class="ui-switch__label" for="s1">开启通知</label>
</span>
```

关键属性：

- `label 的 for 指向 input 的 id` —— 否则点文字没反应，只有点 16px 的方框才生效

无障碍：整组用 <fieldset> + <legend> 包住，读屏用户才知道这组选项在问什么。

### 卡片 · `ui-card`

用它的时机：内容需要边界与表面，或用卡片表达一组可点选的对象。
不要用它的时机：纯布局分隔 → 用间距或 ui-divider，不要为了视觉分割就套卡片。

| 变体 | 什么时候用 |
|---|---|
| `ui-card--pad-lg` | 内容较多、需要更大呼吸感 |
| `ui-card--interactive` | 整张卡片可点击，自动给悬停反馈 |
| `ui-card--selected` | 处于选中态，用主色描边表示 |
| `ui-card--flush` | 内容需要顶到边缘（表格、图片） |
| `ui-card--invert` | 深色卡片，用于需要在浅色页面上压重的地方 |

```html
<div class="ui-card">
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
</div>
```

关键属性：

- `ui-card__header / ui-card__body / ui-card__footer` —— 三段式插槽。只用 body 也行，别自己写 padding

无障碍：整卡可点击时，内部应是一个 <a> 或 <button>，不要把 click 挂在 div 上。

### 表格 · `ui-table-wrap / ui-table`

用它的时机：真正的二维数据，列之间有对应关系。
不要用它的时机：只是「标签 - 值」的成对展示 → ui-desc。

| 变体 | 什么时候用 |
|---|---|
| `ui-table--compact` | 行高收紧，一屏放更多行 |
| `ui-table--striped` | 列数多、需要横向对齐辅助 |

```html
<div class="ui-table-wrap" data-ui="table-sort">
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
</div>
```

关键属性：

- `data-ui="table-sort"` —— 写在 .ui-table-wrap 上，开启点击表头排序
- `data-sort="列号"` —— 写在每个 .ui-table__sort 按钮上，0 起算。**漏了它就点了没反应**：组件只绑定带 data-sort 的按钮
- `data-value="原始值"` —— 写在 <td> 上，排序按它比而不是按显示文本。数字、日期、金额列必须给，否则 "1,284" 这类带分隔符的文本会按字符串排错
- `ui-table__cell-num` —— 数字列加这个类，自动右对齐并使用等宽数字

无障碍：排序表头用 <button class="ui-table__sort">，键盘可聚焦。初始态写 aria-sort="none"，之后由组件维护；空数据时用 ui-table__placeholder 占位。

事件：`ui:sort`（点击表头排序）。

### 模态框 · `ui-modal`

用它的时机：需要用户集中注意力完成一件事，且不完成就没法继续。
不要用它的时机：不打断主任务的侧边进入 → ui-drawer；轻量反馈 → UI.toast。

| 变体 | 什么时候用 |
|---|---|
| `ui-modal--sm` | 确认类小弹窗 |
| `ui-modal--lg` | 表单或明细较多 |
| `ui-modal--full` | 接近满屏的内容 |

```html
<button class="ui-btn ui-btn--primary" type="button"
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
</div>
```

关键属性：

- `data-ui="modal" data-target="#id"` —— 触发按钮。两个属性缺一不可
- `data-toggle="true"` —— 写在触发按钮上：再点一次就关闭。不加则只在已关闭时打开（用于多个触发器共用一个弹层的场景）
- `data-mask-closable="false"` —— 写在弹层上，禁止点遮罩关闭（用于必须明确选择的场景）
- `data-ui-close` —— 写在关闭按钮上，组件自动绑定
- `data-ui-dismiss="#id"` —— 替代 data-ui-close 的通用写法，值指向要关的弹层；留空则关闭所在的可关闭块
- `aria-hidden="true"` —— 初始态必须写，组件会在开合时同步

无障碍：role="dialog" aria-modal="true" aria-labelledby="<标题元素 id>"；打开时自动锁滚动并把焦点移入，关闭后焦点归还触发按钮。

事件：`ui:open`（打开后）、`ui:close`（关闭后。reason 可能是 mask / esc / api）。

API：`UI.modal.open("#id")`、`UI.modal.close("#id")`、`UI.modal.toggle("#id")`。

### 抽屉 · `ui-drawer`

用它的时机：从侧边临时进入，不打断主任务（筛选、详情、移动端导航）。
不要用它的时机：需要用户停下来做决定 → ui-modal。

| 变体 | 什么时候用 |
|---|---|
| `ui-drawer--left` | 左侧，常用于移动端导航 |
| `ui-drawer--bottom` | 底部，移动端的分享与快捷操作 |

```html
<button class="ui-btn ui-btn--default" type="button"
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
</div>
```

关键属性：

- `data-ui="drawer" data-target="#id"` —— 触发按钮
- `ui-drawer__panel / __header / __body / __footer` —— 四段结构，__body 自带滚动

无障碍：role="dialog" aria-modal="true" aria-label="<抽屉用途>"。

事件：`ui:open`（打开后）、`ui:close`（关闭后）。

API：`UI.drawer.open("#id")`、`UI.drawer.close("#id")`。

### 提示条 · `ui-alert`

用它的时机：需要持续存在的状态说明（页面级、区块级）。
不要用它的时机：一次性反馈 → UI.toast（提示条不会消失，用户回头还能看到）。

| 变体 | 什么时候用 |
|---|---|
| `ui-alert--info` | 中性信息 |
| `ui-alert--success` | 成功结果 |
| `ui-alert--warning` | 需要留意但未出错 |
| `ui-alert--danger` | 出错了 |
| `ui-alert--neutral` | 纯说明，不携带语义 |
| `ui-alert--outline` | 需要更轻的视觉重量 |

```html
<div class="ui-alert ui-alert--warning">
  <span class="ui-alert__icon"><svg …></svg></span>
  <div class="ui-alert__body">
    <div class="ui-alert__title">本月剩余额度不足 10%</div>
    <div class="ui-alert__desc">额度用尽后接口将返回 429，建议提前升级套餐。</div>
  </div>
  <button class="ui-alert__close" type="button" data-ui-dismiss aria-label="关闭"><svg …></svg></button>
</div>
```

关键属性：

- `ui-alert__icon / __body / __title / __desc` —— 图标 + 主体 + 标题 + 描述四段
- `ui-alert__close + data-ui-dismiss` —— 关闭按钮两件套，缺一不可：类给样式，data-ui-dismiss 给行为（**只写类，按钮点了不会消失**）。留空值即关闭所在那条提示，也可写选择器指向别的元素

无障碍：危险级提示用 role="alert"，普通提示不需要（避免读屏频繁打断）；关闭按钮必须有 aria-label="关闭"，图标按钮读屏读不出内容。

事件：`ui:dismiss`（节点被移除前广播（不支持 preventDefault，要拦截就别写 data-ui-dismiss，自己接管））。

### 轻提示 · `UI.toast()`

用它的时机：操作完成后的轻量反馈，用户不需要做任何事。
不要用它的时机：需要用户决策 → UI.confirm；需要持续可见 → ui-alert。

| 变体 | 什么时候用 |
|---|---|
| `type: "success"` | 操作成功 |
| `type: "danger"` | 操作失败 |
| `type: "warning"` | 完成了但有需要注意的地方 |

```html
UI.toast('已复制到剪贴板');
UI.toast({ message: '已保存', type: 'success', description: '3 秒后自动关闭' });
```

关键属性：

- `message` —— 必填。写结果本身，不要写「操作成功」这类无信息量的话
- `description` —— 可选。补一句为什么或下一步
- `duration` —— 可选。默认自动消失

无障碍：组件内部已是 role="status" + aria-live，调用方不需要再包。

API：`UI.toast("已保存")`、`UI.toast({ message: "已保存", type: "success", description: "…" })`。

### 徽章与标签 · `ui-badge / ui-tag / ui-status`

用它的时机：给一段内容附加状态或分类；ui-status 用于行内的状态点 + 文字。
不要用它的时机：可点击的筛选标签 → ui-chip（带关闭）或 ui-segment。

| 变体 | 什么时候用 |
|---|---|
| `ui-badge` | 默认中性徽章 |
| `ui-badge--primary` | 主色徽章，用于强调当前项 |
| `ui-badge--success` | 成功态 |
| `ui-badge--warning` | 警告态 |
| `ui-badge--danger` | 错误态 |
| `ui-badge--info` | 信息态 |
| `ui-badge--outline` | 低调的描边徽章 |
| `ui-badge--pill` | 胶囊形 |
| `ui-status--info` | 状态点 + 文字的完整组合 |

```html
<span class="ui-badge ui-badge--primary">主色</span>
<span class="ui-badge ui-badge--outline">描边</span>
<span class="ui-status ui-status--info">
  <span class="ui-dot" style="background: var(--ui-primary)"></span>进行中
</span>
```

关键属性：

- `ui-dot` —— 状态点的圆点。可以内联 style="background: var(--ui-primary)" 换成主色

无障碍：颜色不能是唯一信息载体：状态点旁要有文字。只有颜色时读屏与色盲用户都拿不到信息。

### 下拉菜单 · `ui-dropdown-wrap / ui-menu`

用它的时机：在一个触发器下收纳一组动作。
不要用它的时机：一组互斥视图切换 → ui-segmented 或 ui-tabs。

| 变体 | 什么时候用 |
|---|---|
| `ui-menu--right` | 靠右对齐，避免菜单顶出视口右缘 |

```html
<div class="ui-dropdown-wrap" data-ui="dropdown">
  <button class="ui-btn ui-btn--default" type="button" data-ui="dropdown-trigger">更多操作</button>
  <div class="ui-menu" role="menu" aria-label="更多操作">
    <button class="ui-menu__item" role="menuitem" type="button">重命名</button>
    <button class="ui-menu__item ui-menu__item--danger" role="menuitem" type="button">删除</button>
  </div>
</div>
```

关键属性：

- `data-ui="dropdown"` —— 写在外层 .ui-dropdown-wrap 上
- `data-ui="dropdown-trigger"` —— 写在触发按钮上
- `role="menu" / role="menuitem"` —— 读屏据此进入菜单模式；单选型用 menuitemradio + aria-checked

无障碍：触发按钮要有 aria-haspopup 与 aria-expanded（组件维护 expanded）。

事件：`ui:select`（点击某个菜单项）。

### 标签页 · `ui-tabs`

用它的时机：同一上下文下切换几组内容视图。
不要用它的时机：切换的是整页 → 用导航；选项少于 4 个且强调状态 → ui-segmented。

| 变体 | 什么时候用 |
|---|---|
| `ui-tabs--pill` | 胶囊样式，用于卡片内的轻量切换 |

```html
<div class="ui-tabs" data-ui="tabs">
  <div class="ui-tabs__list" role="tablist" aria-label="视图">
    <button class="ui-tab" role="tab" id="t1" type="button"
            aria-controls="p1" aria-selected="true">全部</button>
    <button class="ui-tab" role="tab" id="t2" type="button"
            aria-controls="p2" aria-selected="false">处理中</button>
  </div>
  <div class="ui-tabpanel" role="tabpanel" id="p1" aria-labelledby="t1" tabindex="0">…</div>
  <div class="ui-tabpanel" role="tabpanel" id="p2" aria-labelledby="t2" tabindex="0" hidden>…</div>
</div>
```

关键属性：

- `data-ui="tabs"` —— 写在外层 .ui-tabs 上
- `role="tablist" / role="tab" / aria-controls` —— 标签与其面板必须互相指向
- `role="tabpanel" + tabindex="0"` —— 面板可聚焦，键盘用户 Tab 进来能读到内容
- `hidden` —— 未选中的面板必须加，不能只靠样式隐藏

无障碍：方向键左右切换由组件实现；每个 tab 要有 aria-selected 与 aria-controls。

事件：`ui:change`（切换标签）。

### 折叠面板 · `ui-collapse`

用它的时机：把次要内容收起来，让用户按需展开。
不要用它的时机：内容需要始终可见 → 直接排版。

| 变体 | 什么时候用 |
|---|---|
| `ui-collapse--flush` | 去掉外框，纯分隔线样式 |

```html
<div class="ui-collapse" data-ui="collapse">
  <div class="ui-collapse__item">
    <button class="ui-collapse__header" type="button"
            aria-expanded="false" aria-controls="cp1">
      <span>常见问题</span>
      <span class="ui-collapse__chevron"><svg …></svg></span>
    </button>
    <div class="ui-collapse__panel" id="cp1" hidden>答案</div>
  </div>
</div>
```

关键属性：

- `data-ui="collapse"` —— 写在外层 .ui-collapse 上
- `data-accordion` —— 写在外层上，切换为手风琴：同时只允许展开一项，开新的会自动收起旧的。不加就是各项独立开合
- `aria-controls="<面板 id>"` —— header 指向面板。漏了会退回「取下一个兄弟节点」，结构一变就错位
- `hidden` —— 收起的面板要写 hidden，不要只靠 max-height: 0

无障碍：header 必须是 <button>，且带 aria-expanded 与 aria-controls。

事件：`ui:toggle`（展开或收起）。

### 二次确认 · `ui-popconfirm-host`

用它的时机：破坏性或不常见的操作，就地确认而不跳弹窗。
不要用它的时机：后果复杂、需要用户阅读较多信息 → ui-modal。

```html
<span class="ui-popconfirm-host" data-ui="popconfirm"
      data-popconfirm-title="确认删除该 API 密钥？"
      data-popconfirm-desc="删除后使用该密钥的调用会立即失败，且无法恢复。"
      data-popconfirm-ok="删除">
  <button class="ui-btn ui-btn--danger-outline" type="button"
          data-ui="popconfirm-trigger">删除密钥</button>
</span>
```

关键属性：

- `data-ui="popconfirm"` —— 写在外层 host 上，三个 data-popconfirm-* 提供文案
- `data-ui="popconfirm-trigger"` —— 写在触发按钮上
- `data-popconfirm-title / -desc / -ok / -cancel` —— 标题 / 后果说明 / 确认按钮文案 / 取消按钮文案。ok 与 cancel 漏了会用默认值「确认 / 取消」

无障碍：desc 里必须写清后果与不可逆性，不要只写「确定吗？」。

事件：`ui:confirm`（用户点了确认）。

## 11. 行为钩子（data-ui）

声明式交互全靠这些属性。挂错元素是「没反应」的头号原因。

| 属性 | 挂在哪 | 说明 |
|---|---|---|
| `data-ui="dropdown"` | 外层容器 | 配 data-ui="dropdown-trigger"；菜单项的取值写 data-value="…" |
| `data-ui="popconfirm"` | 外层容器 | 配 data-ui="popconfirm-trigger" |
| `data-ui="tabs"` | 外层容器 | 配 role="tablist" |
| `data-ui="segmented"` | 外层容器 |  |
| `data-ui="collapse"` | 外层容器 | 加 data-accordion 切换成同时只开一项 |
| `data-ui="pagination"` | 外层容器 | 可点项必须带 data-page="页码" |
| `data-ui="table-sort"` | .ui-table-wrap | 表头按钮必须用 ui-table__sort 且带 data-sort="列号" |
| `data-ui="dropzone"` | 拖放区 | 加 tabindex="0" 让键盘也能触发 |
| `data-ui="backtop"` | 按钮 |  |
| `data-ui="copy"` | 按钮 | 配 data-copy-target="#id" 或 data-copy="文本"；data-copy-toast 自定义成功提示 |
| `data-ui="navbar"` | .ui-navbar | 配 data-navbar-drawer="#id"，窄屏由抽屉接管导航；汉堡按钮写 data-ui-navbar-toggle |
| `data-ui="validate"` | <form> | 字段上配 data-validate |
| `data-ui="modal" / "drawer"` | 触发按钮 | 必须配 data-target="#id" |
| `data-tooltip="文本"` | 任意元素 | 不需要 data-ui，扫描时单独处理 |

## 12. 事件

所有行为都通过 `ui:*` 自定义事件对外广播，冒泡到 `document`。在 Vue / React / Svelte 里直接用原生事件监听接管，不需要再包一层。

| 事件 | 载荷 | 来源 | 触发时机 |
|---|---|---|---|
| `ui:ready` | `{ version }` | document | 全部组件初始化完成 |
| `ui:error` | `{ component, error }` | 组件元素 | 单个组件初始化失败（其余组件不受影响） |
| `ui:open` | `{}` | 弹层元素 | modal / drawer 打开后 |
| `ui:close` | `{ reason }` | 弹层元素 | modal / drawer 关闭后 |
| `ui:change` | `tabs/segmented → { value, tab? }；pagination → { page }` | tabs / segmented / pagination | 切换选项或翻页 |
| `ui:select` | `{ value, item }` | dropdown | 点击菜单项 |
| `ui:toggle` | `{ open, panel }` | collapse | 展开或收起 |
| `ui:sort` | `{ index, direction }` | table | 点击表头排序 |
| `ui:file` | `{ files }` | dropzone | 选择或拖入文件 |
| `ui:copy` | `{ ok, text }` | copy 按钮 | 复制成功或失败 |
| `ui:submit` | `{ formData }` | form | 校验通过并提交 |
| `ui:invalid` | `{}` | form | 提交时存在未通过的字段 |
| `ui:confirm` | `{}` | popconfirm | 用户确认 |
| `ui:dismiss` | `{}` | 被关闭的元素 | data-ui-dismiss 关闭前广播（组件随后直接移除节点，不支持拦截） |

## 13. 命令式 API

| 调用 | 用途 |
|---|---|
| `UI.toast(message | options)` | 轻提示 |
| `UI.modal.open(sel) / .close(sel) / .toggle(sel)` | 模态框 |
| `UI.drawer.open(sel) / .close(sel) / .toggle(sel)` | 抽屉 |
| `await UI.confirm({ title, description, okText, danger })` | 确认对话框，返回是否确认 |
| `UI.copy(text)` | 复制到剪贴板，返回 Promise<boolean> |
| `UI.lockScroll() / UI.unlockScroll()` | 手动锁滚动（弹出自己的浮层时） |
| `UI.position(anchor, floating, options)` | 把浮层定位到锚点旁，自动避让视口边界 |
| `UI.init(root)` | 动态插入 DOM 后重新初始化组件 |
| `UI.formatSize(bytes)` | 文件大小格式化 |

动态插入 DOM 之后要调一次 `UI.init(container)`，否则新节点上的组件不会初始化。

## 14. 写完自查

- 有没有出现第 2 节禁止清单里的东西？
- 颜色是不是都用 `var(--ui-*)`，没有裸 hex？
- 间距、圆角、字号是不是都在刻度上？
- 弹层是不是用了 `.ui-modal` / `.ui-drawer`，而不是自己写 `position: fixed`？
- 带 `data-ui` 的元素是不是配对属性都写全了（`data-target` / `data-ui="…-trigger"`）？
- 弹层有没有 `role="dialog"` `aria-modal="true"` `aria-labelledby`？
- 纯图标按钮有没有 `aria-label`？
- 颜色是不是唯一的信息载体？（状态点旁要有文字）
