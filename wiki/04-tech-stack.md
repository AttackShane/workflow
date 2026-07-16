# 04 · 技术栈

## 4.1 运行时

| 维度 | 技术 | 说明 |
| --- | --- | --- |
| **语言** | JavaScript ES2022 | 全面使用 ES Modules、Class、箭头函数、解构 |
| **类型** | JSDoc + TypeScript (tsc) | `jsconfig.json` 提供 IDE 类型检查（不强制） |
| **DOM** | 浏览器原生 | 不依赖任何前端框架（无 React/Vue/jQuery） |
| **存储** | localStorage / sessionStorage | 包装在 `Storage` 工具中 |
| **样式** | CSS 变量 + 媒体查询 | 主题切换、亮/暗色自动适配 |
| **异步** | Promise / async-await / Worker | 语法高亮使用 Web Worker 异步处理 |
| **拖拽** | HTML5 Drag & Drop | 节点面板 → 画布 |

## 4.2 浏览器要求

| API | 用途 | 最低浏览器 |
| --- | --- | --- |
| ES Modules | 模块加载 | Chrome 61+ / Firefox 60+ / Safari 11+ / Edge 79+ |
| Web Worker | 异步语法高亮 | 全部现代浏览器 |
| `getBoundingClientRect` | 节点测量 | 全支持 |
| `requestAnimationFrame` | 平滑动画 | 全支持 |
| CSS Variables | 主题切换 | Chrome 49+ / Firefox 31+ / Safari 9.1+ |
| `Element.animate()` | 页面淡入 | Chrome 36+ / Firefox 48+ / Safari 13.1+ |
| Touch Events | 触摸设备支持 | 移动端浏览器 |
| MutationObserver | 主题感知 | 全支持 |

> **结论**：项目要求现代浏览器（Chrome/Edge/Firefox/Safari 近 4 年版本），不支持 IE。

## 4.3 生产依赖 (dependencies)

```json
{
  "js-yaml": "^4.1.1"
}
```

| 包 | 用途 | 引入方式 |
| --- | --- | --- |
| `js-yaml` | YAML 解析与序列化 | CDN `<script>` 注入到 `window.jsyaml` |

只有一个运行时依赖，且**通过 CDN 加载**（不参与打包）。这保证了 `dist/` 产物的纯粹性。

## 4.4 开发依赖 (devDependencies)

```json
{
  "@babel/core": "^7.29.7",
  "@babel/preset-env": "^7.29.7",
  "@types/node": "^26.1.0",
  "babel-jest": "^30.4.1",
  "eslint": "^8.57.1",
  "http-server": "^14.1.1",
  "husky": "^9.1.7",
  "jest": "^30.4.2",
  "jest-environment-jsdom": "^30.4.1",
  "lint-staged": "^16.4.0",
  "prettier": "^3.9.5",
  "terser": "^5.48.0",
  "typescript": "^6.0.3"
}
```

| 包 | 用途 |
| --- | --- |
| `@babel/core` + `@babel/preset-env` + `babel-jest` | Jest 通过 Babel 转译 ES Modules |
| `@types/node` | Node.js 类型提示（用于构建脚本） |
| `eslint` | 代码检查 |
| `http-server` | 备用静态服务器（项目自写 `server.js`，可忽略） |
| `husky` + `lint-staged` | Git hooks + 提交时自动修复 |
| `jest` + `jest-environment-jsdom` | 单元测试（25 套件 / 1127 用例） |
| `prettier` | 代码格式化 |
| `terser` | JS 压缩（构建阶段） |
| `typescript` | 类型检查（`tsc --noEmit`） |

## 4.5 Node.js 版本

```json
{
  "engines": {
    "node": ">=20.17"
  }
}
```

CI 矩阵：`[22.x, 24.x]`（Node 20 已弃用）。

## 4.6 构建工具链

| 阶段 | 工具 | 作用 |
| --- | --- | --- |
| 开发 | 自写 `server.js` | 静态文件 + SPA 路由回退 + 局域网访问 |
| 单文件构建 | `build.js` + `terser` | 读取 HTML，提取内联 ESM，内联为 Blob URL，压缩 JS |
| 类型检查 | `tsc --noEmit --project jsconfig.json` | 仅类型，不产出 |
| 类型/i18n 自定义检查 | `check_types.cjs` / `check_i18n.cjs` | 检测翻译键一致性、类型映射完整性 |
| 代码风格 | `eslint` + `prettier` | 静态检查 + 格式化 |
| 测试 | `jest` + `babel-jest` | ESM 转译 + jsdom 环境 |
| 提交钩子 | `husky` + `lint-staged` | pre-commit 跑 prettier/eslint/jest |

## 4.7 npm scripts

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（localhost:8080） |
| `npm run build` | 构建三个单文件 HTML 到 `dist/` |
| `npm run convert` | 批量转换（命令行工具） |
| `npm test` | 运行 Jest 单元测试 |
| `npm run test:watch` | Jest 监听模式 |
| `npm run check:types` | 运行 `check_types.cjs`（类型映射一致性） |
| `npm run check:i18n` | 运行 `check_i18n.cjs`（翻译键一致性） |
| `npm run check` | 类型 + i18n 检查 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | Prettier 检查 |

## 4.8 测试覆盖策略

`jest.config.js` 中按文件类型设置覆盖率门槛：

| 类别 | 门槛 | 适用文件 |
| --- | --- | --- |
| **纯逻辑/工具** | 80% lines | converter / types / i18n / helpers / components / node-types |
| **混合逻辑** | 70% lines | editor-clipboard / shared-navigator / shared-theme / editor-align / utils |
| **UI 渲染** | 50~55% lines | editor-keyboard / shared-serializer |
| **豁免** | 无门槛 | 视图层、UI 总控（如 editor-ui） |

```
src/modules/converter.js                  80%
src/modules/converter-reverse.js          80%
src/modules/converter-highlighter.js      80%
src/modules/editor-core.js                80%
src/modules/editor-storage.js             80%
src/modules/editor-edge.js                80%
src/modules/editor-layout.js              80%
src/modules/editor-node-types.js          80%
src/modules/editor-clipboard-paste.js     80%
src/modules/manager-templates.js          80%
src/i18n/i18n.js                          80%
src/utils/types.js                        80%
src/utils/logger.js                       80%
src/utils/refCache.js                     80%
src/components/*                          80%

src/modules/editor-clipboard.js           70%
src/modules/shared-navigator.js           70%
src/modules/shared-theme.js              70%
src/modules/editor-align.js               70%
src/utils/utils.js                        70%
src/utils/helpers.js                      50%
src/modules/editor-keyboard.js            55%
src/modules/shared-serializer.js          50%
```

## 4.9 CI/CD

`.github/workflows/ci.yml` 在 push/PR 时运行：

1. `npm ci` 安装依赖
2. `npm run lint`
3. `npm test`
4. `npm run check`

矩阵：Node.js `[22.x, 24.x]`

## 4.10 外部 CDN 资源

HTML 中通过 CDN 引入：

| 资源 | URL | 用途 |
| --- | --- | --- |
| `js-yaml` | `https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js` | YAML 解析 |
| `JSZip` | `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js` | 导出 zip |

注意：构建为单文件 HTML 后，这些 CDN 引用仍存在，**完全离线需要外网**（或本地替换）。
