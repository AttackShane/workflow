// @ts-nocheck
/**
 * 工作流导出模块
 * 负责将编辑器节点通过逆向转换器转为 Coze YAML，打包为压缩包
 */
import { getJsyaml, getJSZip } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { convertClipboardToYaml } from './converter-reverse.js';
import { convertInternalToClipboardNode } from './shared-serializer.js';

/**
 * 导出/分享相关的 mixin 方法
 * @param {import('./editor-ui.js').WorkflowUI} ui - WorkflowUI 实例
 */
export function mixinShare(ui) {
    /**
     * 导出工作流为 Coze 平台兼容的 .zip 压缩包
     */
    ui.exportWorkflow = async function() {
        const workflowName = document.getElementById('workflowName')?.textContent || '';
        const workflowId = document.getElementById('workflowId')?.textContent || '';
        const workflowDesc = ui.currentDescription || '';

        const safeName = workflowName || 'my_workflow';
        const safeDesc = workflowDesc || 'Created with workflow editor';

        const numericId = (workflowId.match(/\d+/) || [`${Date.now()}`])[0];

        const clipData = {
            type: 'coze-workflow-clipboard-data',
            source: { workflowId: numericId },
            json: {
                name: safeName,
                nodes: this.core.nodes
                    .filter(n => !n.parentId)
                    .map(n => convertInternalToClipboardNode(n, this.core.nodes)),
                edges: this.core.edges.map(e => ({
                    sourceNodeID: String(e.source).replace('node_', ''),
                    targetNodeID: String(e.target).replace('node_', ''),
                    sourcePortID: e.sourcePort || ''
                }))
            }
        };

        const yamlObj = convertClipboardToYaml(clipData);
        const yamlStr = getJsyaml().dump(yamlObj, {
            indent: 4,
            lineWidth: 120,
            schema: getJsyaml().JSON_SCHEMA
        });

        const manifest = {
            type: 'Workflow',
            version: '1.0.0',
            main: {
                id: numericId,
                name: safeName,
                desc: safeDesc,
                icon: 'plugin_icon/workflow.png',
                version: '',
                flowMode: 0,
                commitId: ''
            },
            sub: []
        };
        const manifestYaml = getJsyaml().dump(manifest, {
            indent: 4,
            lineWidth: 120,
            schema: getJsyaml().JSON_SCHEMA
        });

        const zip = new (getJSZip())();
        const root = zip.folder(safeName);
        root.file('MANIFEST.yml', manifestYaml);
        root.folder('workflow').file(`${safeName}.yaml`, yamlStr);

        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${safeName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showMessage(t('messages.workflowExported'), 'success');
    };
}