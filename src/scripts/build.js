const fs = require('fs');
const path = require('path');

const converterModules = [
  'src/utils/types.js',
  'src/utils/utils.js',
  'src/components/outputMapper.js',
  'src/components/inputMapper.js',
  'src/components/containerHandler.js',
  'src/components/nodeHandlers.js',
  'src/modules/converter.js',
  'src/modules/reverse.js',
  'src/modules/highlighter.js',
  'src/modules/stats-view.js',
  'src/modules/ui-controller.js',
  'src/modules/theme-controller.js',
  'src/modules/keyboard-shortcuts.js',
  'src/modules/graph-view.js',
  'src/modules/workflow-core.js',
  'src/modules/workflow-canvas.js',
  'src/modules/workflow-node.js',
  'src/modules/workflow-edge.js',
  'src/modules/workflow-history.js',
  'src/modules/workflow-clipboard.js',
  'src/modules/workflow-ui.js',
  'src/modules/app.js'
];

const editorModules = [
  'src/utils/types.js',
  'src/utils/utils.js',
  'src/components/outputMapper.js',
  'src/components/inputMapper.js',
  'src/components/containerHandler.js',
  'src/components/nodeHandlers.js',
  'src/modules/workflow-core.js',
  'src/modules/workflow-canvas.js',
  'src/modules/workflow-node.js',
  'src/modules/workflow-edge.js',
  'src/modules/workflow-history.js',
  'src/modules/workflow-clipboard.js',
  'src/modules/workflow-ui.js'
];

function buildScript(modules, isConverter = true) {
  let combinedScript = '';
  for (const mod of modules) {
    const relativePath = mod.replace(/^src\//, '');
    const filePath = path.join(__dirname, '../', relativePath);
    if (!fs.existsSync(filePath)) {
      console.error(`缺少文件: ${mod}`);
      process.exit(1);
    }
    let code = fs.readFileSync(filePath, 'utf8');
    code = code.replace(/^import\s+.*?;$/gm, '');
    code = code.replace(/^export\s+(\{.*?\})$/gm, '');
    code = code.replace(/^export\s+(async\s+)?(function|const|let|var|class)\s+/gm, '$1$2 ');
    code = code.replace(/^export\s+default\s+/, '');
    code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*(\(\) => |function\s*\(\)\s*)?this\.init\(\)\)/g, 'this.init()');
    if (isConverter) {
      code = code.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\) => \{\s*(initUI\(\);\s*initThemeController\(\);\s*initKeyboardShortcuts\(\);\s*initHistoryPanel\(\);\s*initGraphModal\(\);)?\s*\}\)/g, 'initUI(); initThemeController(); initKeyboardShortcuts(); initHistoryPanel(); initGraphModal();');
      code = code.replace(/window\.location\.href\s*=\s*['"]\/src\/views\/workflow-editor\.html['"]/g, `window.location.href = 'workflow_editor_standalone.html'`);
      code = code.replace(/window\.open\(['"]workflow-editor\.html['"],\s*['"]_blank['"]\)/g, `window.open('workflow_editor_standalone.html', '_blank')`);
    }
    combinedScript += `\n// ----- ${mod} -----\n${code}\n`;
  }
  return combinedScript;
}

const cssPath = path.join(__dirname, '../styles/style.css');
if (!fs.existsSync(cssPath)) {
  console.error(`缺少文件: ${cssPath}`);
  process.exit(1);
}
const cssContent = fs.readFileSync(cssPath, 'utf8');

const editorCssPath = path.join(__dirname, '../styles/workflow-editor.css');
let editorCssContent = '';
if (fs.existsSync(editorCssPath)) {
  editorCssContent = fs.readFileSync(editorCssPath, 'utf8');
}

const converterScript = buildScript(converterModules, true);

const converterHtmlPath = path.join(__dirname, '../views/main.html');
if (!fs.existsSync(converterHtmlPath)) {
  console.error(`缺少文件: ${converterHtmlPath}`);
  process.exit(1);
}
let converterHtml = fs.readFileSync(converterHtmlPath, 'utf8');

converterHtml = converterHtml.replace(/<link\s+rel="stylesheet"\s+href="\/src\/styles\/style\.css">/, `<style>${cssContent}</style>`);
converterHtml = converterHtml.replace(/<script\s+type="module"\s+src="\/src\/modules\/app\.js"><\/script>/, `<script>document.addEventListener('DOMContentLoaded', function() {\n${converterScript}\n});</script>`);

const converterOutFile = path.join(__dirname, '../../coze_converter_standalone.html');
fs.writeFileSync(converterOutFile, converterHtml, 'utf8');
console.log(`✅ 生成转换器单文件版本: ${converterOutFile}`);

const editorScript = buildScript(editorModules, false);

const editorHtmlPath = path.join(__dirname, '../views/workflow-editor.html');
let editorHtml = fs.readFileSync(editorHtmlPath, 'utf8');

editorHtml = editorHtml.replace(/<link\s+rel="stylesheet"\s+href="\/src\/styles\/workflow-editor\.css">/, `<style>${editorCssContent}</style>`);
editorHtml = editorHtml.replace(/<script type="module">[\s\S]*?<\/script>/, `<script>document.addEventListener('DOMContentLoaded', function() {\n${editorScript}\n\nconst core = new WorkflowCore();\nwindow.workflowUI = new WorkflowUI(core);\n});\n\nwindow.draggedNodeType = null;\n\nwindow.dragStartHandler = function(event) {\n    window.draggedNodeType = event.target.dataset.nodeType;\n    event.dataTransfer.effectAllowed = 'copy';\n    event.dataTransfer.setData('text/plain', window.draggedNodeType);\n};\n\nwindow.dragOverHandler = function(event) {\n    event.preventDefault();\n    event.dataTransfer.dropEffect = 'copy';\n};\n\nwindow.dropHandler = function(event) {\n    event.preventDefault();\n    \n    if (!window.draggedNodeType) {\n        window.draggedNodeType = event.dataTransfer.getData('text/plain');\n    }\n    \n    if (!window.draggedNodeType) {\n        return;\n    }\n    \n    const canvas = document.getElementById('canvas');\n    const rect = canvas.getBoundingClientRect();\n    const x = event.clientX - rect.left;\n    const y = event.clientY - rect.top;\n    \n    window.workflowUI.addNodeToCanvas(window.draggedNodeType, x - 90, y - 40);\n    window.draggedNodeType = null;\n};</script>`);

const editorOutFile = path.join(__dirname, '../../workflow_editor_standalone.html');
fs.writeFileSync(editorOutFile, editorHtml, 'utf8');
console.log(`✅ 生成编辑器单文件版本: ${editorOutFile}`);

console.log('📌 发给朋友，双击 coze_converter_standalone.html 即可使用');
console.log('📌 两个文件需放在同一目录下');