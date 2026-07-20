import { getJSZip, getJsyaml, NodeUtils } from '../utils/helpers.js';
import { Dialog } from './shared-dialog.js';
import { t } from '../i18n/i18n.js';
import { convertYamlToClipboard } from './converter.js';
import { convertClipboardToInternal } from './shared-serializer.js';

/**
 * 处理文件选择
 * @param {Event} event - 文件选择事件
 * @param {{ _pendingZipFile: File | null }} manager - 管理器实例
 */
export function handleFileSelect(event, manager) {
    const file = event.target.files[0];
    if (file) {
        manager._pendingZipFile = file;
    }
}

/**
 * 从 zip 文件导入工作流
 * @param {File} zipFile - zip 文件
 * @returns {Promise<{ name: string, description: string, nodes: any[], edges: any[], clipData: any, _touched: boolean }>}
 */
export async function importFromZip(zipFile) {
    const JSZip = getJSZip();
    const zip = await JSZip.loadAsync(zipFile);

    const fileNames = Object.keys(zip.files).filter((f) => !zip.files[f].dir);

    let manifestYaml = null;
    let workflowYamlStr = null;

    for (const filename of fileNames) {
        const basename = filename.split('/').pop();
        if (basename === 'MANIFEST.yml' || basename === 'MANIFEST.yaml') {
            const content = await zip.file(filename).async('string');
            manifestYaml = /** @type {{ main?: { name?: string, desc?: string } } | null} */ (
                getJsyaml().load(content)
            );
        }
    }

    for (const filename of fileNames) {
        const basename = filename.split('/').pop();
        if (
            (basename.endsWith('.yaml') || basename.endsWith('.yml')) &&
            basename !== 'MANIFEST.yml' &&
            basename !== 'MANIFEST.yaml'
        ) {
            workflowYamlStr = await zip.file(filename).async('string');
            break;
        }
    }

    if (!workflowYamlStr) {
        throw new Error('No workflow YAML found in zip package');
    }

    const parsedYaml = /** @type {{ id: any, name?: string, description?: string, nodes: any[], edges?: any[] }} */ (
        getJsyaml().load(workflowYamlStr)
    );

    if (!parsedYaml || !parsedYaml.nodes || !Array.isArray(parsedYaml.nodes)) {
        throw new Error('Invalid workflow YAML in zip package');
    }

    const MAX_NAME_LENGTH = 20;
    const rawName = manifestYaml?.main?.name || parsedYaml.name || t('manager.importedWorkflowName');
    const name = rawName.length > MAX_NAME_LENGTH ? rawName.substring(0, MAX_NAME_LENGTH) + '...' : rawName;
    const description = manifestYaml?.main?.desc || parsedYaml.description || '';

    const clipData = convertYamlToClipboard(parsedYaml, workflowYamlStr);
    const { nodes, edges } = convertClipboardToInternal(clipData);

    NodeUtils.translateToCanvasOrigin(nodes);

    return {
        name,
        description,
        nodes,
        edges,
        clipData,
        _touched: false,
    };
}

/**
 * 导入工作流（从 pending zip 文件或文件输入）
 * @param {object} manager - WorkflowManager 实例
 * @param {File | null} manager._pendingZipFile - 待处理的 zip 文件
 * @param {{ importFile: HTMLInputElement }} manager.elements - DOM 元素引用
 * @param {any[]} manager.workflows - 工作流数组
 * @param {(id: string, data: any) => void} manager.saveWorkflowVersion - 保存版本方法
 * @param {() => void} manager.saveWorkflows - 保存方法
 * @param {() => void} manager.renderWorkflowList - 渲染列表方法
 * @param {() => void} manager.closeImportModal - 关闭导入弹窗方法
 */
export async function importWorkflow(manager) {
    let zipResult = null;

    if (manager._pendingZipFile) {
        try {
            zipResult = await importFromZip(manager._pendingZipFile);
            manager._pendingZipFile = null;
        } catch (e) {
            await Dialog.error(t('manager.fileReadError') + ': ' + (e.message || ''));
            return;
        }
    } else if (manager.elements.importFile.files[0]) {
        const file = manager.elements.importFile.files[0];
        try {
            zipResult = await importFromZip(file);
        } catch (e) {
            await Dialog.error(t('manager.fileReadError') + ': ' + (e.message || ''));
            return;
        }
    } else {
        await Dialog.alert(t('manager.provideData'));
        return;
    }

    if (zipResult) {
        const newWorkflow = {
            id: `wf_${Date.now()}`,
            name: zipResult.name,
            description: zipResult.description,
            nodes: zipResult.nodes,
            edges: zipResult.edges,
            _clipboardData: zipResult.clipData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        manager.workflows.push(newWorkflow);
        manager.saveWorkflowVersion(newWorkflow.id, newWorkflow);
        manager.saveWorkflows();
        manager.renderWorkflowList();
        manager.closeImportModal();
        await Dialog.success(t('manager.importSuccess'));
        return;
    }
}
