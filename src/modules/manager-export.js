import { deepClone, getJsyaml, getJSZip } from '../utils/helpers.js';
import { convertInternalToClipboardNode } from './shared-serializer.js';
import { convertClipboardToYaml } from './converter-reverse.js';

/**
 * 导出单个工作流为 zip 文件
 * @param {{ id?: string, name?: string, description?: string, nodes?: any[], edges?: any[] }} workflow - 工作流对象
 */
export async function exportWorkflow(workflow) {
    const nodes = deepClone(workflow.nodes || []);
    const edges = deepClone(workflow.edges || []);

    const clipData = {
        type: 'coze-workflow-clipboard-data',
        source: { workflowId: workflow.id || String(Date.now()) },
        json: {
            name: workflow.name || 'my_workflow',
            nodes: nodes.filter((n) => !n.parentId).map((n) => convertInternalToClipboardNode(n, nodes)),
            edges: edges.map((e) => ({
                sourceNodeID: String(e.source).replace('node_', ''),
                targetNodeID: String(e.target).replace('node_', ''),
                sourcePortID: e.sourcePort || '',
            })),
        },
    };

    const yamlObj = convertClipboardToYaml(clipData);
    const workflowYaml = getJsyaml().dump(yamlObj, {
        indent: 4,
        lineWidth: 120,
        schema: getJsyaml().JSON_SCHEMA,
    });

    const safeName = (workflow.name || 'workflow').replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');

    const manifest = {
        type: 'Workflow',
        version: '1.0.0',
        main: {
            id: workflow.id || String(Date.now()),
            name: workflow.name || 'my_workflow',
            desc: workflow.description || 'Created with workflow editor',
            icon: 'plugin_icon/workflow.png',
            version: '',
            flowMode: 0,
            commitId: '',
        },
        sub: [],
    };
    const manifestYaml = getJsyaml().dump(manifest, {
        indent: 4,
        lineWidth: 120,
        schema: getJsyaml().JSON_SCHEMA,
    });

    const JSZip = getJSZip();
    const zip = new JSZip();
    const root = zip.folder(safeName);
    root.file('MANIFEST.yml', manifestYaml);
    root.folder('workflow').file(`${safeName}.yaml`, workflowYaml);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
