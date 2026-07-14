import fs from 'fs';
import path from 'path';
import { minify } from 'terser';

const SRC_DIR = path.resolve(path.dirname(import.meta.url).replace('file:///', ''), '..');
const OUTPUT_DIR = path.join(path.dirname(import.meta.url).replace('file:///', ''), '../../dist');

function scanDependencies(entryFile) {
    const visited = new Set();
    const ordered = [];

    function visit(relativePath) {
        if (visited.has(relativePath)) return;
        visited.add(relativePath);

        const fullPath = path.join(SRC_DIR, relativePath);
        if (!fs.existsSync(fullPath)) return;

        const code = fs.readFileSync(fullPath, 'utf8');
        const singleLineCode = code.replace(/\r?\n/g, ' ');

        const patterns = [
            /import\s+(?:.+?\s+from\s+)?['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]/g,
            /import\(['"](\.\/[^'"]+|\.\.\/[^'"]+)['"]\)/g,
            /import\(`([^`]+)`\)/g,
        ];

        for (const regex of patterns) {
            let match;
            while ((match = regex.exec(singleLineCode)) !== null) {
                let importPath = match[1];
                importPath = importPath.replace(/\?.*$/, '');
                const resolved = path.resolve(path.dirname(fullPath), importPath);
                if (!resolved.endsWith('.js')) continue;
                const relative = path.relative(SRC_DIR, resolved).replace(/\\/g, '/');
                visit(relative);
            }
        }

        ordered.push(relativePath);
    }

    visit(entryFile);
    return ordered;
}

const converterModules = scanDependencies('modules/app.js');

const EDITOR_EXCLUDE = new Set([
    'converter.js',
    'converter-reverse.js',
    'converter-highlighter.js',
    'converter-highlighter-worker.js',
    'converter-stats.js',
    'converter-stats-renderer.js',
    'converter-ui.js',
    'converter-keyboard.js',
    'shared-graph.js',
    'converter-virtual-scroll.js',
    'converter-history.js',
]);

const editorModules = Array.from(
    new Set([
        ...scanDependencies('modules/app.js').filter((m) => !EDITOR_EXCLUDE.has(path.basename(m))),
        ...scanDependencies('modules/editor-ui.js'),
        ...scanDependencies('modules/editor-core.js'),
    ])
);

const managerModules = scanDependencies('modules/manager.js');

function stripMultilineImports(code) {
    const lines = code.split('\n');
    const result = [];
    const aliasAssignments = [];
    let inImport = false;
    let importLines = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (!inImport && trimmed.startsWith('import ')) {
            inImport = true;
            importLines = [trimmed];
            if (trimmed.endsWith(';')) {
                inImport = false;
                extractAliases(importLines, aliasAssignments);
            }
            continue;
        }

        if (inImport) {
            importLines.push(trimmed);
            if (trimmed.endsWith(';')) {
                inImport = false;
                extractAliases(importLines, aliasAssignments);
            }
            continue;
        }

        result.push(line);
    }

    return { code: result.join('\n'), aliases: aliasAssignments };
}

function extractAliases(importLines, aliasAssignments) {
    const aliases = [];
    for (const line of importLines) {
        const aliasMatch = line.match(/^\s*(\w+)\s+as\s+(\w+)\s*[,;]?\s*$/);
        if (aliasMatch) {
            aliases.push(aliasMatch[2] + '=' + aliasMatch[1]);
        }
    }
    if (aliases.length > 0) {
        aliasAssignments.push('var ' + aliases.join(',') + ';');
    }
}

function processDynamicImports(code) {
    code = code.replace(/import\('\.\/converter-ui\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\('\.\/converter-keyboard\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(
        /import\('\.\/converter-stats\.js'\)\.then\(m => m\.(\w+)\(\)\)\.catch\([^)]*\([^)]*\)[^)]*\)/g,
        '$1()'
    );
    code = code.replace(
        /import\('\.\/shared-graph\.js'\)\.then\(m => m\.(\w+)\(\)\)\.catch\([^)]*\([^)]*\)[^)]*\)/g,
        '$1()'
    );
    code = code.replace(/import\('\.\/converter-stats\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\('\.\/shared-graph\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\('\.\/converter-history\.js'\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');

    code = code.replace(
        /import\('\.\/converter-virtual-scroll\.js'\)\.then\(m => \{ \w+ = m\.VirtualScroll; \}\)/g,
        ''
    );
    code = code.replace(
        /import\('\.\/converter-virtual-scroll\.js'\)\.then\(m => \{ this\._VirtualScroll = m\.VirtualScroll; \}\)/g,
        ''
    );
    code = code.replace(
        /import\('\.\/converter-virtual-scroll\.js'\)\.then\(m => this\._VirtualScroll = m\.VirtualScroll;\)/g,
        ''
    );

    code = code.replace(/import\(`\.\/converter-ui\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\(`\.\/converter-keyboard\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(
        /import\(`\.\/converter-stats\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)\.catch\([^)]*\([^)]*\)[^)]*\)/g,
        '$1()'
    );
    code = code.replace(
        /import\(`\.\/shared-graph\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)\.catch\([^)]*\([^)]*\)[^)]*\)/g,
        '$1()'
    );
    code = code.replace(/import\(`\.\/converter-stats\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\(`\.\/shared-graph\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\(`\.\/converter-history\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');
    code = code.replace(/import\(`\.\/manager\.js\?v=\$\{[^}]+\}`\)\.then\(m => m\.(\w+)\(\)\)/g, '$1()');

    code = code.replace(/^\s*(let|const|var)\s+VirtualScroll\s*=\s*(undefined|null)\s*;?\s*$/gm, '');

    code = code.replace(
        /(?:const|var|let)\s*\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*await\s+import\(['"]\.\/converter-ui\.js['"]\);?/g,
        ''
    );
    code = code.replace(
        /(?:const|var|let)\s*\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*await\s+import\(['"]\.\/converter-stats\.js['"]\);?/g,
        ''
    );
    code = code.replace(/(?:const|var|let)\s*\{\s*t\s*\}\s*=\s*await\s+import\(['"]\.\.\/i18n\/i18n\.js['"]\);?/g, '');

    const lines = code.split('\n');
    const resultLines = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        const importMatch = line.match(
            /import\(['"`]\.\/(converter-ui|converter-stats|shared-graph|converter-keyboard|converter-history|converter-virtual-scroll)\.js[^'"`]*['"`]\)\.then\(\(\{ [^}]+\}\) => \{/
        );
        const jsYamlMatch = line.match(/import\(['"`]js-yaml['"`]\)\.then\(\(\{ load \}\) => \{/);

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

        const modBaseName = path.basename(mod, '.js').replace(/-/g, '_');
        code = code.replace(/\b_instance\b/g, '_' + modBaseName + '_instance');

        code = code.replace(/^import\s+.*?;$/gm, '');
        const stripResult = stripMultilineImports(code);
        code = stripResult.code;
        if (stripResult.aliases.length > 0) {
            code = stripResult.aliases.join('\n') + '\n' + code;
        }
        code = code.replace(/^export\s+\{[^}]+\}\s*;?\s*$/gm, '');
        code = code.replace(/^export\s+default\s+/, '');
        code = code.replace(/^export\s+(async\s+)?(function|const|let|var|class)\s+/gm, '$1$2 ');
        code = code.replace(/^(\s*)(let|const)\b/gm, '$1var');
        code = code.replace(
            /document\.addEventListener\(['"]DOMContentLoaded['"],\s*(\(\) => |function\s*\(\)\s*)?this\.init\(\)\)/g,
            'this.init()'
        );

        if (mod === 'modules/app.js' || mod.endsWith('/app.js')) {
            code = code.replace(
                /document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);?\s*$/,
                '$1\n'
            );
        }

        if (isConverter) {
            code = code.replace(
                /document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\) => \{\s*(initUI\(\);\s*initThemeController\(\);\s*initKeyboardShortcuts\(\);\s*initHistoryPanel\(\);\s*initGraphModal\(\);)?\s*\}\)/g,
                'initUI(); initThemeController(); initKeyboardShortcuts(); initHistoryPanel(); initGraphModal();'
            );
            code = code.replace(
                /window\.location\.href\s*=\s*['"]\/src\/views\/workflow-editor\.html['"]/g,
                `window.location.href = 'workflow_editor.html'`
            );
            code = code.replace(
                /window\.open\(['"]workflow-editor\.html['"],\s*['"]_blank['"]\)/g,
                `window.open('workflow_editor.html', '_blank')`
            );
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

function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{},;:>+~])\s*/g, '$1')
        .replace(/;\}/g, '}')
        .replace(/^\s+|\s+$/gm, '')
        .replace(/\n/g, '')
        .trim();
}

async function minifyJs(code) {
    const result = await minify(code, {
        compress: {
            drop_console: false,
            drop_debugger: true,
            passes: 2,
        },
        mangle: {
            reserved: [
                'WorkflowCore',
                'WorkflowUI',
                'WorkflowCanvas',
                'WorkflowNode',
                'WorkflowEdge',
                'WorkflowClipboard',
                'WorkflowHistory',
                'WorkflowAlign',
                'WorkflowKeyboard',
                'init',
                'core',
                'nodes',
                'edges',
                'selectedNode',
                'selectedEdge',
                'id',
                'type',
                'title',
                'DOMContentLoaded',
                'addEventListener',
                'sessionStorage',
                'localStorage',
                'document',
                'window',
                'deepClone',
                'editingWorkflow',
                'editingWorkflowId',
                'workflowUI',
                'workflowManager',
                'WorkflowManager',
                'workflow_editor',
                'workflow_manager',
                'workflow_converter',
                'createInlineHighlighterWorker',
                'highlightJson',
                'highlightYaml',
            ],
        },
        format: {
            comments: false,
        },
    });
    return result.code;
}

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

const managerCssPath = path.join(
    path.dirname(import.meta.url).replace('file:///', ''),
    '../styles/workflow-manager.css'
);
let managerCssContent = '';
if (fs.existsSync(managerCssPath)) {
    managerCssContent = fs.readFileSync(managerCssPath, 'utf8');
}

function stripAppInitWrapper(script) {
    return script.replace(
        /document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);?\s*$/,
        '$1\n'
    );
}

async function buildAll() {
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
    },
    onerror: null
  };
}
`;

    const inlineWorkerPostMessage = `
  worker.postMessage({ id: currentTaskId, text: data, type });
  worker.addEventListener('message', function handler(e) {
`;

    const inlineCtrlWorkerPostMessage = `
  ctrl._worker.postMessage({ id: currentTaskId, text: data, type });
  ctrl._worker.addEventListener('message', function handler(e) {
`;

    function replaceWorkerPatterns(script) {
        script = script.replace(
            /(\bif\s*\(!ctrl\._worker\)\s*\{\s*\n?\s*ctrl\._worker\s*=\s*new Worker\('[^']+',\s*\{[^}]+\}\);\s*\n?\s*\})/,
            `${workerCode}\n$1`
        );
        return script
            .replace(
                /if \(!worker\) \{\s*\n?\s*worker = new Worker\('\.\/modules\/highlighter-worker\.js', \{ type: 'module' \}\);\s*\n?\s*\}/g,
                `if (!worker) {
    worker = createInlineHighlighterWorker();
  }`
            )
            .replace(
                /if\s*\(!ctrl\._worker\)\s*\{\s*\n?\s*ctrl\._worker\s*=\s*new Worker\('[^']+',\s*\{[^}]+\}\);\s*\n?\s*\}/g,
                `if (!ctrl._worker) {
    ctrl._worker = createInlineHighlighterWorker();
  }`
            )
            .replace(
                /worker\.postMessage\(\{ id: currentTaskId, text: data, type \}\);\s+worker\.addEventListener\('message', function handler\(e\) \{/,
                inlineWorkerPostMessage
            )
            .replace(
                /ctrl\._worker\.postMessage\(\{ id: currentTaskId, text: data, type \}\);\s*\n?\s*ctrl\._worker\.addEventListener\('message',\s*function handler\(e\)\s*\{/,
                inlineCtrlWorkerPostMessage
            )
            .replace(/if \(e\.data\.id === currentTaskId\) \{/g, 'if (e.id === currentTaskId) {')
            .replace(/e\.data\.result/g, 'e.result')
            .replace(/worker\.removeEventListener\('message', handler\);/g, '')
            .replace(/ctrl\._worker\.removeEventListener\('message',\s*handler\);/g, '')
            .replace(/ctrl\._worker\.onerror\s*=\s*null;/g, '');
    }

    converterScript = replaceWorkerPatterns(converterScript);

    const converterHtmlPath = path.join(
        path.dirname(import.meta.url).replace('file:///', ''),
        '../views/workflow-converter.html'
    );
    if (!fs.existsSync(converterHtmlPath)) {
        console.error(`缺少文件: ${converterHtmlPath}`);
        process.exit(1);
    }
    let converterHtml = fs.readFileSync(converterHtmlPath, 'utf8');

    converterHtml = converterHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
    converterHtml = converterHtml.replace(
        /<link\s+rel="stylesheet"\s+href="\/styles\/style\.css">/,
        `<style>${minifyCss(cssContent)}</style>`
    );
    converterHtml = converterHtml.replace(
        /<script\s+type="module"\s+src="\/modules\/app\.js"><\/script>/,
        `<script>document.addEventListener('DOMContentLoaded', function() {\n${await minifyJs(converterScript)}\n});</script>`
    );

    const converterOutFile = path.join(OUTPUT_DIR, 'workflow_converter.html');
    fs.writeFileSync(converterOutFile, converterHtml, 'utf8');
    console.log(`✅ 生成转换器单文件版本: ${converterOutFile}`);

    const editorScript = stripAppInitWrapper(buildScript(editorModules, false));
    const editorScriptWithWorker = replaceWorkerPatterns(editorScript);

    if (editorScript.includes('script type="module"')) {
        console.log('⚠️ editorScript (unminified) contains <script type="module">!');
        const idx = editorScript.indexOf('script type="module"');
        console.log('Context:', editorScript.substring(idx - 50, idx + 100));
    }
    const minifiedEditor = await minifyJs(editorScriptWithWorker);
    if (minifiedEditor.includes('script type="module"')) {
        console.log('⚠️ editorScript (minified) contains <script type="module">!');
        const idx = minifiedEditor.indexOf('script type="module"');
        console.log('Context:', minifiedEditor.substring(idx - 50, idx + 100));
    }
    if (minifiedEditor.includes('</script>')) {
        console.log('⚠️ editorScript (minified) contains </script>!');
        const idx = minifiedEditor.indexOf('</script>');
        console.log('Context:', minifiedEditor.substring(idx - 50, idx + 50));
    }

    const editorHtmlPath = path.join(
        path.dirname(import.meta.url).replace('file:///', ''),
        '../views/workflow-editor.html'
    );
    let editorHtml = fs.readFileSync(editorHtmlPath, 'utf8');

    editorHtml = editorHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
    editorHtml = editorHtml.replace(
        /<link\s+rel="stylesheet"\s+href="\/styles\/workflow-editor\.css">/,
        `<style>${minifyCss(editorCssContent)}</style>`
    );

    const scriptTag = '<script type="module" src="/modules/app.js"></script>';
    const scriptTagIdx = editorHtml.indexOf(scriptTag);
    if (scriptTagIdx !== -1) {
        const replacement = `<script>document.addEventListener('DOMContentLoaded', function() {\n${await minifyJs(editorScriptWithWorker)}\n\nvar editingWorkflow = sessionStorage.getItem('editingWorkflow');\nvar editingWorkflowId = sessionStorage.getItem('editingWorkflowId');\nvar isFromCache = !editingWorkflow && editingWorkflowId;\nvar core = new WorkflowCore();\nvar _pendingDescription = '';\nif (editingWorkflow) {\n    var workflow = JSON.parse(editingWorkflow);\n    sessionStorage.setItem('editingWorkflowId', workflow.id);\n    sessionStorage.removeItem('editingWorkflow');\n    core.clearSavedWorkflow();\n    if (workflow.nodes && workflow.nodes.length > 0) {\n        core.nodes = deepClone(workflow.nodes);\n        core.edges = deepClone(workflow.edges || []);\n        core.selectedNode = workflow.selectedNode || null;\n        core.selectedEdge = workflow.selectedEdge || null;\n    }\n    core.resetHistory('从工作流管理器加载');\n    if (workflow.name) document.getElementById('workflowName').textContent = workflow.name;\n    if (workflow.description) _pendingDescription = workflow.description;\n    if (workflow.id) document.getElementById('workflowId').textContent = 'ID: ' + workflow.id;\n} else if (isFromCache && core.hasSavedWorkflow()) {\n    core.loadFromLocalStorage();\n    if (editingWorkflowId) {\n        document.getElementById('workflowId').textContent = 'ID: ' + editingWorkflowId;\n        try {\n            var storedWorkflows = JSON.parse(localStorage.getItem('workflows') || '[]');\n            var found = storedWorkflows.find(function(w) { return w.id === editingWorkflowId; });\n            if (found && found.name) {\n                document.getElementById('workflowName').textContent = found.name;\n                if (found.description) _pendingDescription = found.description;\n            }\n        } catch (e) {}\n    }\n} else {\n    core.clearSavedWorkflow();\n    core.resetHistory('初始化');\n}\nwindow.workflowUI = new WorkflowUI(core);\nwindow.workflowUI.currentDescription = _pendingDescription;\nwindow.workflowUI.init();\n});\n\nwindow.draggedNodeType = null;\n\nwindow.dragStartHandler = function(event) {\n    window.draggedNodeType = event.target.dataset.nodeType;\n    event.dataTransfer.effectAllowed = 'copy';\n    event.dataTransfer.setData('text/plain', window.draggedNodeType);\n};\n\nwindow.dragOverHandler = function(event) {\n    event.preventDefault();\n    event.dataTransfer.dropEffect = 'copy';\n};\n\nwindow.dropHandler = function(event) {\n    event.preventDefault();\n    \n    if (!window.draggedNodeType) {\n        window.draggedNodeType = event.dataTransfer.getData('text/plain');\n    }\n    \n    if (!window.draggedNodeType) {\n        return;\n    }\n    \n    var canvas = document.getElementById('canvas');\n    var rect = canvas.getBoundingClientRect();\n    var x = event.clientX - rect.left;\n    var y = event.clientY - rect.top;\n    \n    window.workflowUI.addNodeToCanvas(window.draggedNodeType, x, y);\n    window.draggedNodeType = null;\n};</script>`;
        editorHtml =
            editorHtml.substring(0, scriptTagIdx) + replacement + editorHtml.substring(scriptTagIdx + scriptTag.length);
    } else {
        console.log('⚠️ Could not find script tag in editor HTML');
    }

    editorHtml = editorHtml.replace(/<script type="module">[\s\S]*?<\/script>/, '');

    const editorOutFile = path.join(OUTPUT_DIR, 'workflow_editor.html');
    fs.writeFileSync(editorOutFile, editorHtml, 'utf8');
    console.log(`✅ 生成编辑器单文件版本: ${editorOutFile}`);

    const managerScript = stripAppInitWrapper(buildScript(managerModules, false));

    const managerHtmlPath = path.join(
        path.dirname(import.meta.url).replace('file:///', ''),
        '../views/workflow-manager.html'
    );
    if (!fs.existsSync(managerHtmlPath)) {
        console.error(`缺少文件: ${managerHtmlPath}`);
        process.exit(1);
    }
    let managerHtml = fs.readFileSync(managerHtmlPath, 'utf8');

    managerHtml = managerHtml.replace(/<link\s+rel="icon"[^>]*>/g, '');
    managerHtml = managerHtml.replace(
        /<link\s+rel="stylesheet"\s+href="\/styles\/workflow-manager\.css">/,
        `<style>${minifyCss(managerCssContent)}</style>`
    );
    managerHtml = managerHtml.replace(
        /<script type="module" src="\/modules\/app\.js"><\/script>/,
        `<script>document.addEventListener('DOMContentLoaded', function() {\n${await minifyJs(managerScript)}\nwindow.workflowManager.init();\n(function restorePageVisibility() {\n    requestAnimationFrame(function() {\n        var theme = document.documentElement.getAttribute('data-theme');\n        document.documentElement.style.backgroundColor = theme === 'dark' ? '#0a0e17' : '#f1f5f9';\n        document.body.classList.remove('preload');\n        document.body.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-in', fill: 'forwards' });\n    });\n})();\n});</script>`
    );

    managerHtml = managerHtml.replace(/<script type="module">[\s\S]*?<\/script>/, '');

    const managerOutFile = path.join(OUTPUT_DIR, 'workflow_manager.html');
    fs.writeFileSync(managerOutFile, managerHtml, 'utf8');
    console.log(`✅ 生成管理器单文件版本: ${managerOutFile}`);

    const indexHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=workflow_manager.html">
  <title>工作流工具</title>
</head>
<body>
  <p>正在跳转到工作流管理页面...</p>
  <p>如果未自动跳转，请点击 <a href="workflow_manager.html">这里</a>。</p>
</body>
</html>`;
    const indexOutFile = path.join(OUTPUT_DIR, 'index.html');
    fs.writeFileSync(indexOutFile, indexHtml, 'utf8');
    console.log(`✅ 生成入口页面: ${indexOutFile}`);

    console.log('📌 构建完成！所有文件已输出到 dist 文件夹');
    console.log('📌 页面文件：');
    console.log('   - index.html                (入口页面，自动跳转到管理器)');
    console.log('   - workflow_manager.html     (工作流管理器)');
    console.log('   - workflow_editor.html      (工作流编辑器)');
    console.log('   - workflow_converter.html   (工作流转换器)');
    console.log('📌 双击任意一个 HTML 文件即可开始使用');
}

buildAll().catch((err) => {
    console.error('构建失败:', err);
    process.exit(1);
});
