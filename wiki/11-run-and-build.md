# 11 · 运行与构建

> 本文档讲解项目的开发、构建、测试、部署全流程。

## 11.1 环境要求

| 工具 | 版本要求 | 说明 |
| --- | --- | --- |
| **Node.js** | >= 20.17 | 推荐 22.x 或 24.x（CI 矩阵） |
| **npm** | 与 Node 配套 | 推荐 10+ |
| **浏览器** | Chrome 90+, Firefox 88+, Safari 14+, Edge 90+ | 现代浏览器 |

## 11.2 安装

```bash
# 克隆仓库
git clone <repo-url>
cd workflow

# 安装依赖
npm install
```

## 11.3 npm scripts 速查

| 命令 | 作用 | 典型场景 |
| --- | --- | --- |
| `npm run dev` | 启动开发服务器 | 本地开发 |
| `npm run build` | 构建单文件 HTML | 发布、离线运行 |
| `npm run convert` | 批量转换 YAML → Coze | 命令行批量处理 |
| `npm test` | 运行 Jest 测试 | 验证逻辑正确性 |
| `npm run test:watch` | Jest 监听模式 | TDD |
| `npm run check:types` | 类型映射一致性检查 | CI |
| `npm run check:i18n` | 翻译键一致性检查 | CI |
| `npm run check` | 类型 + i18n 检查 | CI |
| `npm run typecheck` | TypeScript 类型检查 | IDE / CI |
| `npm run lint` | ESLint | 代码质量 |
| `npm run lint:fix` | ESLint 自动修复 | 自动修复 |
| `npm run format` | Prettier 格式化 | 代码风格 |
| `npm run format:check` | Prettier 检查 | CI |
| `npm run prepare` | 安装 husky | 自动触发 |

## 11.4 开发模式

### 11.4.1 启动开发服务器

```bash
npm run dev
```

默认端口 8080，可通过 `--port=` 自定义：

```bash
node src/scripts/server.js --port=9000
```

### 11.4.2 访问页面

| URL | 页面 |
| --- | --- |
| `http://localhost:8080/` | 工作流管理 |
| `http://localhost:8080/converter` | YAML 转换器 |
| `http://localhost:8080/editor` | 可视化编辑器 |

### 11.4.3 局域网访问

`server.js` 启动后会输出局域网 IP，其他设备可通过该 IP + 端口访问（用于移动端测试触摸功能）。

### 11.4.4 开发服务器特性

- **SPA 路由回退**：未匹配 URL 自动回退到对应 HTML（如 `/foo` → `/workflow-manager.html`）
- **无缓存**：响应头设置 `Cache-Control: no-store`，避免浏览器缓存
- **CORS**：默认开启
- **MIME 推断**：根据扩展名返回正确的 Content-Type

## 11.5 构建单文件 HTML

```bash
npm run build
```

产物：

```
dist/
├── workflow_editor.html       # 编辑器（单文件，可直接打开）
├── workflow_converter.html    # 转换器（单文件）
└── workflow_manager.html      # 管理器（单文件）
```

### 11.5.1 构建流程

1. 读取 `src/views/*.html`
2. 提取内联 `<script type="module">` 的 JS
3. 通过 `terser` 压缩 JS
4. 将压缩后的 JS 内联为 `data:text/javascript;base64,...` Blob URL
5. 将 CSS 内联到 `<style>` 标签
6. 输出到 `dist/`

### 11.5.2 单文件运行

```bash
# Linux/macOS
open dist/workflow_editor.html

# Windows
start dist/workflow_editor.html

# 双击也可以（使用 file:// 协议）
```

### 11.5.3 完全离线注意事项

单文件 HTML 仍引用 CDN：

- `https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js`
- `https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js`

如需完全离线，需要将这两个文件下载到本地并修改 `src/views/*.html` 中的 `<script>` 标签。

## 11.6 测试

### 11.6.1 运行全部测试

```bash
npm test
```

输出：

```
PASS  tests/align.test.js
PASS  tests/canvas.test.js
PASS  tests/clipboard.test.js
...
Test Suites: 25 passed, 25 total
Tests:       1127 passed, 1127 total
```

### 11.6.2 监听模式

```bash
npm run test:watch
```

### 11.6.3 单文件测试

```bash
npx jest tests/canvas.test.js
```

### 11.6.4 覆盖率

```bash
npx jest --coverage
```

输出每个文件的覆盖率（满足 `jest.config.js` 中的门槛）。

### 11.6.5 测试环境

`jest.config.js`：

```js
{
    testEnvironment: 'jsdom',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
}
```

`jest.setup.js`：

- 注册 `TextEncoder` / `TextDecoder` polyfill（如需要）
- Mock `localStorage` / `sessionStorage`
- Mock `window.matchMedia`（如有）
- Mock `MutationObserver`（如有）

### 11.6.6 覆盖率门槛

| 类别 | 门槛 | 文件 |
| --- | --- | --- |
| 纯逻辑/工具 | 80% lines | converter / types / i18n / components / node-types / logger / refCache |
| 混合逻辑 | 70% lines | editor-clipboard / shared-navigator / shared-theme / editor-align / utils |
| UI 渲染 | 50~55% lines | editor-keyboard / shared-serializer / helpers |
| 豁免 | 无门槛 | 视图层、UI 总控（如 editor-ui） |

## 11.7 代码质量

### 11.7.1 ESLint

```bash
npm run lint          # 检查
npm run lint:fix      # 自动修复
```

`.eslintrc.json` 配置 ESLint 8 规则（推荐风格 + 自定义规则）。

### 11.7.2 Prettier

```bash
npm run format           # 格式化
npm run format:check     # 检查（CI）
```

`.prettierrc` 配置格式化规则。

### 11.7.3 Git Hooks (Husky)

`.husky/pre-commit` 在提交时自动执行 `lint-staged`：

```js
"lint-staged": {
    "*.js": [
        "prettier --write",
        "eslint --fix",
        "jest --bail --findRelatedTests"
    ]
}
```

- 自动 Prettier 格式化
- 自动 ESLint 修复
- 仅运行与改动文件相关的测试

### 11.7.4 类型检查

```bash
npm run typecheck    # tsc --noEmit --project jsconfig.json
```

`jsconfig.json` 提供 IDE 类型提示（不强制使用 TS 语法）。

### 11.7.5 自定义检查

```bash
npm run check:types   # 检查类型映射一致性（utils/types.js vs editor-node-types.js）
npm run check:i18n    # 检查翻译键一致性（zh-CN.js vs en-US.js）
npm run check         # 两者都检查
```

- `check_types.cjs`：检测 `TYPE_MAP` 是否覆盖所有节点类型
- `check_i18n.cjs`：检测 `zh-CN` 和 `en-US` 的 key 是否一致

## 11.8 批量转换

```bash
npm run convert
```

执行 `src/scripts/batch-convert.mjs`：

- 读取 `input/` 目录下所有 YAML 文件
- 转换为 Coze 剪贴板 JSON
- 输出到 `output/` 目录

## 11.9 CI/CD

`.github/workflows/ci.yml`：

```yaml
name: CI
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        strategy:
            matrix:
                node-version: [22.x, 24.x]
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: ${{ matrix.node-version }}
            - run: npm ci
            - run: npm run lint
            - run: npm test
            - run: npm run check
```

CI 流程：

1. `npm ci` 安装依赖
2. `npm run lint` ESLint
3. `npm test` Jest
4. `npm run check` 类型 + i18n

## 11.10 部署选项

### 11.10.1 静态站点

将 `dist/` 目录上传到任意静态托管：

- GitHub Pages
- Vercel
- Netlify
- Cloudflare Pages
- Nginx / Apache

注意：CDN 资源需保证网络可达（js-yaml / JSZip）。

### 11.10.2 完整部署

将整个 `src/` 上传，配置 Web 服务器：

```nginx
# Nginx 示例
server {
    listen 80;
    server_name workflow.example.com;
    root /var/www/workflow/src;
    index workflow-manager.html;

    # SPA 路由回退
    location / {
        try_files $uri $uri/ /views/$uri.html /workflow-manager.html;
    }

    # js-yaml CDN fallback（可选）
    location /js-yaml.min.js {
        proxy_pass https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js;
    }
}
```

### 11.10.3 Docker（可选）

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 8080
CMD ["npm", "run", "dev"]
```

```bash
docker build -t workflow-editor .
docker run -p 8080:8080 workflow-editor
```

## 11.11 故障排查

### 11.11.1 `npm install` 失败

- 检查 Node.js 版本（>= 20.17）
- 清理缓存：`npm cache clean --force`
- 删除 `node_modules` 后重试

### 11.11.2 页面加载失败

- 检查浏览器控制台
- 确认 CDN 资源可访问（js-yaml / JSZip）
- 确认 `src/` 目录结构完整

### 11.11.3 测试失败

- 确认 `npm install` 已运行
- 检查 Babel 配置 `.babelrc`
- 单独运行失败的测试以定位问题

### 11.11.4 构建失败

- 检查 `terser` 安装
- 检查源文件语法
- 单独运行 `node src/scripts/build.js` 查看错误

### 11.11.5 快捷键不生效

- 检查是否在输入框内（输入框内快捷键不触发）
- 检查自定义配置 `localStorage[keyboardShortcuts]`
- 确认 Ctrl/Cmd 键识别（Mac 用 Cmd，其他用 Ctrl）

## 11.12 性能调优

### 11.12.1 编辑器

| 优化项 | 位置 |
| --- | --- |
| 视口剔除 | `editor-canvas.js` `visibleNodes` |
| 批量测量 | `editor-node-render.js` `batchMeasureElements` |
| 增量边更新 | `editor-edge.js` `_upsertEdgeElements` |
| 防抖渲染 | `editor-canvas.js` `renderDebounceTimer` |
| 网格 SVG pattern | `editor-canvas.js` `_createGridLayer` |
| 虚拟滚动（小地图） | （如有） |

### 11.12.2 转换器

| 优化项 | 位置 |
| --- | --- |
| 虚拟滚动 | `converter-virtual-scroll.js` |
| Worker 异步高亮 | `converter-highlighter-worker.js` |
| 转换缓存 | `converter-ui.js` `_conversionCache` |
| 高亮缓存 | `converter-ui.js` `_highlightCache` |

## 11.13 安全注意事项

| 注意点 | 处理方式 |
| --- | --- |
| **HTML 注入** | 语法高亮只允许 `<span>` 和 `<br>` 标签（`converter-renderer.js`） |
| **XSS 风险** | 用户输入通过 `StringUtils.escapeHtml` 转义 |
| **YAML 解析** | 使用 `js-yaml` 库，避免 eval |
| **sessionStorage 跨页数据** | 仅存当前会话编辑数据，刷新后丢弃 |
| **localStorage 数据** | 仅存工作流/设置，无敏感信息 |
| **CDN 完整性** | 使用 jsdelivr（可信源） |
| **构建产物** | `terser` 压缩，不暴露源码 |

## 11.14 监控与日志

- 前端日志：`utils/logger.js`（`Logger.debug / info / warn / error`）
- 日志级别：默认 `INFO`，可通过 `Logger.setLevel('DEBUG')` 切换
- 控制台输出：`[DEBUG] ...` / `[INFO] ...` / `[WARN] ...` / `[ERROR] ...`
