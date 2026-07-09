/**
 * 节点详情模态框模块
 * 负责显示节点详情弹窗，支持 JSON/YAML 复制和编辑器跳转
 */
import { cleanIcon } from '../utils/utils.js';
import { ClipboardUtils, getJsyaml } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';

function convertToClipboardFormat(node) {
    const pos = node.position || node.meta?.position || { x: 0, y: 0 };
    const nodeMeta = node.data?.nodeMeta || {
        title: node.title || '',
        icon: node.icon || '',
        description: node.description || '',
        mainColor: node.mainColor || '#5C62FF',
        subTitle: node.subTitle || ''
    };

    let inputs = {};
    if (node.inputs) {
        inputs = node.inputs;
    } else if (node.data?.inputs) {
        inputs = node.data.inputs;
    } else if (node.parameters) {
        if (node.parameters.branches) {
            inputs = { branches: node.parameters.branches };
        } else {
            inputs = node.parameters;
        }
    } else if (node.data?.parameters) {
        if (node.data.parameters.branches) {
            inputs = { branches: node.data.parameters.branches };
        } else {
            inputs = node.data.parameters;
        }
    }

    let nodeWidth = 360;
    let nodeHeight = 112;
    const nodeType = String(node.type).toLowerCase();
    if (nodeType === "question" || nodeType === "18") {
        nodeHeight = 295;
    }

    const cleanIconUrl = cleanIcon(nodeMeta.icon);

    return {
        type: "coze-workflow-clipboard-data",
        source: {
            workflowId: node.id || "exported_workflow",
            flowMode: 0,
            spaceId: "7638450388769374260",
            isDouyin: false,
            host: "www.coze.cn"
        },
        json: {
            nodes: [{
                id: node.id || "exported_node",
                type: node.type,
                meta: {
                    position: {
                        x: pos.x,
                        y: pos.y
                    }
                },
                data: {
                    inputs: inputs,
                    nodeMeta: {
                        title: nodeMeta.title,
                        icon: cleanIconUrl,
                        description: nodeMeta.description,
                        mainColor: nodeMeta.mainColor,
                        subTitle: nodeMeta.subTitle
                    },
                    outputs: node.outputs || node.data?.outputs || []
                },
                _temp: {
                    bounds: {
                        x: pos.x - nodeWidth / 2,
                        y: pos.y - nodeHeight / 2,
                        width: nodeWidth,
                        height: nodeHeight
                    },
                    externalData: {
                        icon: cleanIconUrl,
                        description: nodeMeta.description,
                        title: nodeMeta.title,
                        mainColor: nodeMeta.mainColor
                    }
                }
            }],
            edges: []
        },
        bounds: {
            x: pos.x - nodeWidth / 2,
            y: pos.y - nodeHeight / 2,
            width: nodeWidth,
            height: nodeHeight
        }
    };
}

export function showNodeDetail(node) {
    const nodeDetailModal = document.createElement('div');
    nodeDetailModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: var(--bg-primary, #1e293b);
        border-radius: 12px;
        width: 90%;
        max-width: 700px;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    `;

    const modalHeader = document.createElement('div');
    modalHeader.style.cssText = `
        padding: 1rem;
        border-bottom: 1px solid var(--border, #334155);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: var(--text-secondary, #94a3b8);
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0 0.5rem;
    `;
    modalHeader.innerHTML = '<h3 style="margin: 0; color: var(--text-primary, #f1f5f9); font-size: 1rem;">📦 节点详情</h3>';
    modalHeader.appendChild(closeBtn);

    const modalBody = document.createElement('div');
    modalBody.style.cssText = `
        padding: 1rem;
        max-height: calc(85vh - 120px);
        overflow-y: auto;
    `;

    const pre = document.createElement('pre');
    pre.style.cssText = `
        background: var(--bg-secondary, #0f172a);
        padding: 1rem;
        border-radius: 8px;
        color: var(--text-primary, #f1f5f9);
        font-family: 'Fira Code', 'Consolas', monospace;
        font-size: 0.875rem;
        white-space: pre-wrap;
        word-break: break-all;
        margin: 0;
        max-height: 400px;
        overflow-y: auto;
    `;
    pre.textContent = JSON.stringify(node, null, 2);
    modalBody.appendChild(pre);

    const modalFooter = document.createElement('div');
    modalFooter.style.cssText = `
        padding: 1rem;
        border-top: 1px solid var(--border, #334155);
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
    `;

    const copyJsonBtn = document.createElement('button');
    copyJsonBtn.textContent = t('converter.copyJson');
    copyJsonBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid var(--border, #334155);
        border-radius: 8px;
        background: transparent;
        color: var(--text-primary, #f1f5f9);
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyJsonBtn.addEventListener('click', async () => {
        const clipboardData = convertToClipboardFormat(node);
        await ClipboardUtils.copyWithFeedback(JSON.stringify(clipboardData, null, 2), copyJsonBtn);
    });

    const copyYamlBtn = document.createElement('button');
    copyYamlBtn.textContent = t('converter.copyYaml');
    copyYamlBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: none;
        border-radius: 8px;
        background: #5C62FF;
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyYamlBtn.addEventListener('click', async () => {
        const clipboardData = convertToClipboardFormat(node);
        const yamlStr = getJsyaml().dump(clipboardData, { indent: 2, lineWidth: 120 });
        await ClipboardUtils.copyWithFeedback(yamlStr, copyYamlBtn);
    });

    const copyRawBtn = document.createElement('button');
    copyRawBtn.textContent = t('converter.copyRawNode');
    copyRawBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid #5C62FF;
        border-radius: 8px;
        background: rgba(92, 98, 255, 0.1);
        color: #5C62FF;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
    `;
    copyRawBtn.addEventListener('click', async () => {
        await ClipboardUtils.copyWithFeedback(JSON.stringify(node, null, 2), copyRawBtn);
    });

    const openEditorBtn = document.createElement('button');
    openEditorBtn.textContent = t('converter.openEditor');
    openEditorBtn.style.cssText = `
        padding: 0.5rem 1.25rem;
        border: 1px solid #5C62FF;
        border-radius: 8px;
        background: linear-gradient(135deg, #5C62FF 0%, #7C3AED 100%);
        color: white;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 0.875rem;
        font-weight: 500;
    `;
    openEditorBtn.addEventListener('click', async () => {
        const clipboardData = convertToClipboardFormat(node);
        sessionStorage.setItem('workflow-node-data', JSON.stringify(clipboardData));
        window.open('workflow-editor.html', '_blank');
    });

    modalFooter.appendChild(openEditorBtn);
    modalFooter.appendChild(copyRawBtn);
    modalFooter.appendChild(copyJsonBtn);
    modalFooter.appendChild(copyYamlBtn);

    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    nodeDetailModal.appendChild(modalContent);

    document.body.appendChild(nodeDetailModal);

    const closeModal = () => {
        document.body.removeChild(nodeDetailModal);
    };

    nodeDetailModal.addEventListener('click', (e) => {
        if (e.target === nodeDetailModal) closeModal();
    });

    closeBtn.addEventListener('click', closeModal);
}