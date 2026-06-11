import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../../dist');

const converterModules = [
  'src/config/constants.js',
  'src/utils/types.js',
  'src/utils/utils.js',
  'src/utils/helpers.js',
  'src/utils/logger.js',
  'src/utils/refCache.js',
  'src/i18n/i18n.js',
  'src/i18n/zh-CN.js',
  'src/i18n/en-US.js',
  'src/components/outputMapper.js',
  'src/components/inputMapper.js',
  'src/components/containerHandler.js',
  'src/components/nodeHandlers.js',
  'src/modules/converter.js',
  'src/modules/reverse.js',
  'src/modules/highlighter.js',
  'src/modules/stats-view.js',
  'src/modules/stats-renderer.js',
  'src/modules/ui-controller.js',
  'src/modules/theme-controller.js',
  'src/modules/i18n-controller.js',
  'src/modules/keyboard-shortcuts.js',
  'src/modules/graph-view.js',
  'src/modules/dialog.js',
  'src/modules/navigator.js',
  'src/modules/virtual-scroll.js',
  'src/modules/history-manager.js',
  'src/modules/workflow-core.js',
  'src/modules/workflow-canvas.js',
  'src/modules/workflow-canvas-optimized.js',
  'src/modules/workflow-node.js',
  'src/modules/workflow-edge.js',
  'src/modules/workflow-history.js',
  'src/modules/workflow-clipboard.js',
  'src/modules/workflow-ui.js',
  'src/modules/workflow-manager.js',
  'src/modules/app.js'
];

const editorModules = [
  'src/config/constants.js',
  'src/utils/types.js',
  'src/utils/utils.js',
  'src/utils/helpers.js',
  'src/utils/logger.js',
  'src/utils/refCache.js',
  'src/components/outputMapper.js',
  'src/components/inputMapper.js',
  'src/components/containerHandler.js',
  'src/components/nodeHandlers.js',
  'src/modules/workflow-core.js',
  'src/modules/workflow-canvas.js',
  'src/modules/workflow-canvas-optimized.js',
  'src/modules/workflow-node.js',
  'src/modules/workflow-edge.js',
  'src/modules/workflow-history.js',
  'src/modules/dialog.js',
  'src/modules/workflow-clipboard.js',
  'src/modules/workflow-ui.js',
  'src/modules/navigator.js'
];

const managerModules = [
  'src/config/constants.js',
  'src/utils/types.js',
  'src/utils/utils.js',
  'src/utils/helpers.js',
  'src/utils/logger.js',
  'src/utils/refCache.js',
  'src/i18n/i18n.js',
  'src/i18n/zh-CN.js',
  'src/i18n/en-US.js',
  'src/modules/workflow-manager.js',
  'src/modules/dialog.js',
  'src/modules/navigator.js'
];

function stripMultilineImports(code) {
  const lines = code.split('\n');
  const result = [];
  let inImport = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inImport && trimmed.startsWith('import ')) {
      inImport = true;
      if (trimmed.endsWith(';')) {
        inImport = false;
      }
      continue;
    }

    if (inImport) {
      if (trimmed.endsWith(';')) {
        inImport = false;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

function processDynamicImports(code) {
  code = code.replace(/import\('\.\/ui-controller\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
  code = code.replace(/import\('\.\/keyboard-shortcuts\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
  code = code.replace(/import\('\.\/stats-view\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
  code = code.replace(/import\('\.\/graph-view\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');

  code = code.replace(/import\('\.\/virtual-scroll\.js'\)\.then\(m => \{ VirtualScroll = m\.VirtualScroll; \}\)/g, '');

  code = code.replace(/^\s*(let|const|var)\s+VirtualScroll\s*=\s*null\s*;?\s*$/gm, '');

  code = code.replace(/(?:const|var|let)\s*\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*await\s+import\(['"]\.\/ui-controller\.js['"]\);?/g, '');
  code = code.replace(/(?:const|var|let)\s*\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*await\s+import\(['"]\.\/stats-view\.js['"]\);?/g, '');
  code = code.replace(/(?:const|var|let)\s*\{\s*t\s*\}\s*=\s*await\s+import\(['"]\.\.\/i18n\/i18n\.js['"]\);?/g, '');

  const lines = code.split('\n');
  const resultLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const importMatch = line.match(/import\(['"]\.\/(ui-controller|stats-view|graph-view|keyboard-shortcuts)\.js['"]\)\.then\(\(\{ [^}]+\}\) => \{/);
    const jsYamlMatch = line.match(/import\(['"]js-yaml['"]\)\.then\(\(\{ load \}\) => \{/);

    if (importMatch || jsYamlMatch) {
      const isJsYaml = !!jsYamlMatch;
      const indentMatch = line.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1] : '';

      i++;
      const innerLines = [];

      while (i < lines.length) {
        const currentLine = lines[i];
        const trimmed = currentLine.trim();

        if (trimmed === '});' || trimmed === '})') {
          i++;
          break;
        }

        innerLines.push(currentLine);
        i++;
      }

      for (const innerLine of innerLines) {
        let content = innerLine.trim();
        if (content !== '') {
          if (isJsYaml) {
            content = content.replace(/load\(/g, 'jsyaml.load(');
          }
          resultLines.push(baseIndent + content);
        }
      }
      continue;
    }

    resultLines.push(line);
    i++;
  }
  
  return resultLines.join('\n');
}

function buildScript(modules, isConverter = true) {
  let combinedScript = '';
  for (const mod of modules) {
    const relativePath = mod.replace(/^src\//, '');
    const filePath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../', relativePath);
    if (!fs.existsSync(filePath)) {
      console.error(`缺少文件: ${mod}`);
      process.exit(1);
    }
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/^import\s+.*?;$/gm, '');
    code = stripMultilineImports(code);
    code = code.replace(/^export\s+\{[^}]+\}\s*;?\s*$/gm, '');
    code = code.replace(/^export\s+(async\s+)?(function|const|let|var|class)\s+/gm, '$1$2 ');
    code = code.replace(/^export\s+default\s+/, '');
    code = code.replace(/^(\s*)(let|const)\b/gm, '$1var');
    code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*(\(\) => |function\s*\(\)\s*)?this\.init\(\)\)/g, 'this.init()');
    
    if (isConverter) {
      code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\) => \{\s*(initUI\(\);\s*initThemeController\(\);\s*initKeyboardShortcuts\(\);\s*initHistoryPanel\(\);\s*initGraphModal\(\);)?\s*\}\)/g, 'initUI(); initThemeController(); initKeyboardShortcuts(); initHistoryPanel(); initGraphModal();');
      code = code.replace(/window\.location\.href\s*=\s*['"]\/src\/views\/workflow-editor\.html['"]/g, `window.location.href = 'workflow_editor.html'`);
      code = code.replace(/window\.open\(['"]workflow-editor\.html['"],\s*['"]_blank['"]\)/g, `window.open('workflow_editor.html', '_blank')`);
    }
    
    code = code.replace(/MANAGER:\s*['"]\/['"]/g, `MANAGER: 'workflow_manager.html'`);
    code = code.replace(/CONVERTER:\s*['"]\/converter['"]/g, `CONVERTER: 'workflow_converter.html'`);
    code = code.replace(/EDITOR:\s*['"]\/editor['"]/g, `EDITOR: 'workflow_editor.html'`);
    
    code = processDynamicImports(code);
    
    combinedScript += `\n// ----- ${mod} -----\n${code}\n`;
  }
  return combinedScript;
}

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 创建输出目录: ${OUTPUT_DIR}`);
  }
}

ensureOutputDir();

const cssPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../styles/style.css');
if (!fs.existsSync(cssPath)) {
  console.error(`缺少文件: ${cssPath}`);
  process.exit(1);
}
const cssContent = fs.readFileSync(cssPath, 'utf8');

const editorCssPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../styles/workflow-editor.css');
let editorCssContent = '';
if (fs.existsSync(editorCssPath)) {
  editorCssContent = fs.readFileSync(editorCssPath, 'utf8');
}

const managerCssPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../styles/workflow-manager.css');
let managerCssContent = '';
if (fs.existsSync(managerCssPath)) {
  managerCssContent = fs.readFileSync(managerCssPath, 'utf8');
}

function stripAppInitWrapper(script) {
  return script.replace(
    /document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\)\s*=>\s*\{([\s\S]*?)\n\}\);?\s*$/,
    '$1\n'
  );
}

let converterScript = stripAppInitWrapper(buildScript(converterModules, true));

const workerCode = `
// Inline the worker logic into main thread for file:// CORS compatibility
function createInlineHighlighterWorker() {
  var handler = null;
  var queue = [];
  function processNext() {
    if (queue.length === 0) return;
    var msg = queue.shift();
    var result = msg.type === 'json' ? highlightJson(msg.text) : highlightYaml(msg.text);
    setTimeout(function() {
      if (handler) {
        handler({ id: msg.id, result: result });
      }
      processNext();
    }, 0);
  }
  return {
    postMessage: function(msg) {
      queue.push(msg);
      setTimeout(processNext, 0);
    },
    addEventListener: function(type, fn) {
      if (type === 'message') handler = fn;
    },
    removeEventListener: function(type, fn) {
      if (type === 'message') handler = null;
    }
  };
}
`;

const inlineWorkerPostMessage = `
  worker.postMessage({ id: currentTaskId, text: data, type });
  worker.addEventListener('message', function handler(e) {
`;

converterScript = converterScript
  .replace(/(var worker = null;)/, `$1\n${workerCode}`)
  .replace(/if \(!worker\) \{\s*\n?\s*worker = new Worker\('\.\/modules\/highlighter-worker\.js', \{ type: 'module' \}\);\s*\n?\s*\}/g, `if (!worker) {
    worker = createInlineHighlighterWorker();
  }`)
  .replace(/worker\.postMessage\(\{ id: currentTaskId, text: data, type \}\);\s+worker\.addEventListener\('message', function handler\(e\) \{/, inlineWorkerPostMessage)
  .replace(/if \(e\.data\.id === currentTaskId\) \{/g, 'if (e.id === currentTaskId) {')
  .replace(/e\.data\.result/g, 'e.result')
  .replace(/worker\.removeEventListener\('message', handler\);/g, '');

const converterHtmlPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../views/workflow-converter.html');
if (!fs.existsSync(converterHtmlPath)) {
  console.error(`缺少文件: ${converterHtmlPath}`);
  process.exit(1);
}
let converterHtml = fs.readFileSync(converterHtmlPath, 'utf8');

converterHtml = converterHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
converterHtml = converterHtml.replace(/<link\s+rel="stylesheet"\s+href="\/styles\/style\.css">/, `<style>${cssContent}</style>`);
converterHtml = converterHtml.replace(/<script\s+type="module"\s+src="\/modules\/app\.js"><\/script>/, `<script>document.addEventListener('DOMContentLoaded', function() {\n${converterScript}\n});</script>`);

const converterOutFile = path.join(OUTPUT_DIR, 'workflow_converter.html');
fs.writeFileSync(converterOutFile, converterHtml, 'utf8');
console.log(`✅ 生成转换器单文件版本: ${converterOutFile}`);

const editorScript = stripAppInitWrapper(buildScript(editorModules, false));

const editorHtmlPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../views/workflow-editor.html');
let editorHtml = fs.readFileSync(editorHtmlPath, 'utf8');

editorHtml = editorHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
editorHtml = editorHtml.replace(/<link\s+rel="stylesheet"\s+href="\/styles\/workflow-editor\.css">/, `<style>${editorCssContent}</style>`);
editorHtml = editorHtml.replace(/<script type="module" src="\/modules\/app\.js"><\/script>/, `<script>document.addEventListener('DOMContentLoaded', function() {\n${editorScript}\n\nvar editingWorkflow = sessionStorage.getItem('editingWorkflow');\nvar editingWorkflowId = sessionStorage.getItem('editingWorkflowId');\nvar isFromCache = !editingWorkflow && editingWorkflowId;\nvar core = new WorkflowCore();\nif (editingWorkflow) {\n    var workflow = JSON.parse(editingWorkflow);\n    sessionStorage.setItem('editingWorkflowId', workflow.id);\n    sessionStorage.removeItem('editingWorkflow');\n    core.clearSavedWorkflow();\n    if (workflow.nodes && workflow.nodes.length > 0) {\n        core.nodes = JSON.parse(JSON.stringify(workflow.nodes));\n        core.edges = JSON.parse(JSON.stringify(workflow.edges || []));\n        core.selectedNode = workflow.selectedNode || null;\n        core.selectedEdge = workflow.selectedEdge || null;\n        core.resetHistory('从工作流管理器加载');\n        if (workflow.name) document.getElementById('workflowName').textContent = workflow.name;\n        if (workflow.id) document.getElementById('workflowId').textContent = 'ID: ' + workflow.id;\n    }\n} else if (isFromCache && core.hasSavedWorkflow()) {\n    core.loadFromLocalStorage();\n    if (editingWorkflowId) document.getElementById('workflowId').textContent = 'ID: ' + editingWorkflowId;\n} else if (core.hasSavedWorkflow()) {\n    core.loadFromLocalStorage();\n} else {\n    core.resetHistory('初始化');\n}\nwindow.workflowUI = new WorkflowUI(core);\nwindow.workflowUI.init();\n});\n\nwindow.draggedNodeType = null;\n\nwindow.dragStartHandler = function(event) {\n    window.draggedNodeType = event.target.dataset.nodeType;\n    event.dataTransfer.effectAllowed = 'copy';\n    event.dataTransfer.setData('text/plain', window.draggedNodeType);\n};\n\nwindow.dragOverHandler = function(event) {\n    event.preventDefault();\n    event.dataTransfer.dropEffect = 'copy';\n};\n\nwindow.dropHandler = function(event) {\n    event.preventDefault();\n    \n    if (!window.draggedNodeType) {\n        window.draggedNodeType = event.dataTransfer.getData('text/plain');\n    }\n    \n    if (!window.draggedNodeType) {\n        return;\n    }\n    \n    var canvas = document.getElementById('canvas');\n    var rect = canvas.getBoundingClientRect();\n    var x = event.clientX - rect.left;\n    var y = event.clientY - rect.top;\n    \n    window.workflowUI.addNodeToCanvas(window.draggedNodeType, x - 90, y - 40);\n    window.draggedNodeType = null;\n};</script>`);

editorHtml = editorHtml.replace(/<script type="module">[\s\S]*?<\/script>/, '');

const editorOutFile = path.join(OUTPUT_DIR, 'workflow_editor.html');
fs.writeFileSync(editorOutFile, editorHtml, 'utf8');
console.log(`✅ 生成编辑器单文件版本: ${editorOutFile}`);

const managerScript = stripAppInitWrapper(buildScript(managerModules, false));

const managerHtmlPath = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../views/workflow-manager.html');
if (!fs.existsSync(managerHtmlPath)) {
  console.error(`缺少文件: ${managerHtmlPath}`);
  process.exit(1);
}
let managerHtml = fs.readFileSync(managerHtmlPath, 'utf8');

managerHtml = managerHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
managerHtml = managerHtml.replace(/<link\s+rel="stylesheet"\s+href="\/styles\/workflow-manager\.css">/, `<style>${managerCssContent}</style>`);
managerHtml = managerHtml.replace(/<script type="module" src="\/modules\/app\.js"><\/script>/, `<script>document.addEventListener('DOMContentLoaded', function() {\n${managerScript}\nwindow.workflowManager.init();\n});</script>`);

managerHtml = managerHtml.replace(/<script type="module">[\s\S]*?<\/script>/, '');

const managerOutFile = path.join(OUTPUT_DIR, 'workflow_manager.html');
fs.writeFileSync(managerOutFile, managerHtml, 'utf8');
console.log(`✅ 生成管理器单文件版本: ${managerOutFile}`);

console.log('📌 构建完成！所有文件已输出到 dist 文件夹');
console.log('📌 三个页面文件：');
console.log('   - workflow_converter.html  (工作流转换器)');
console.log('   - workflow_editor.html     (工作流编辑器)');
console.log('   - workflow_manager.html    (工作流管理器)');
console.log('📌 双击任意一个 HTML 文件即可开始使用');