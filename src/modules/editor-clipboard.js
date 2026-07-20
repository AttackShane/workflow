import { ClipboardUtils } from '../utils/helpers.js';
import { t } from '../i18n/i18n.js';
import { WorkflowClipboardPaste } from './editor-clipboard-paste.js';
import { convertInternalToClipboardNode } from './shared-serializer.js';

export class WorkflowClipboard {
    constructor(ui) {
        this.ui = ui;
        this.core = ui.core;
        /** @type {WorkflowClipboardPaste} */
        this.pasteHandler = new WorkflowClipboardPaste(this);
        this.copiedNode = null;
    }

    /**
     * 复制选中节点到剪贴板
     */
    async copy() {
        const selectedNodeElements = document.querySelectorAll('.canvas-node.selected');
        if (selectedNodeElements.length === 0) return;

        // 如果有缓存的原始 Coze 剪贴板数据，直接使用（不走 Internal 往返，无数据损失）
        if (this.core._clipboardData) {
            await ClipboardUtils.copy(JSON.stringify(this.core._clipboardData, null, 2));
            return;
        }

        const selectedNodeIds = Array.from(selectedNodeElements).map(
            (el) => /** @type {HTMLElement} */ (el).dataset.nodeId
        );

        const expandedNodeIds = new Set(selectedNodeIds);
        for (const nodeId of selectedNodeIds) {
            if (this.core.container.isContainer(nodeId)) {
                const childNodes = this.core.container.getChildren(nodeId);
                for (const child of childNodes) expandedNodeIds.add(child.id);
            }
        }

        const selectedNodes = this.core.nodes.filter((n) => expandedNodeIds.has(n.id));
        if (selectedNodes.length === 0) return;

        const selectedEdges = this.core.edges.filter(
            (e) => expandedNodeIds.has(e.source) && expandedNodeIds.has(e.target)
        );

        // 先分类边，确定哪些节点是顶层（非选中容器的子节点）
        const { globalEdges, containerEdges, containerNodeIds, childNodeIds } = this._classifyEdges(
            selectedEdges,
            selectedNodes
        );

        // 使用 shared-serializer 统一序列化：只序列化顶层节点，子节点由递归 blocks 处理
        const topLevelNodes = selectedNodes.filter((n) => !childNodeIds.has(n.id));
        const cozeNodes = topLevelNodes.map((node) =>
            convertInternalToClipboardNode(node, selectedNodes, { includeTemp: true })
        );

        // 计算边界
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const node of topLevelNodes) {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + (node.width || 200));
            maxY = Math.max(maxY, node.y + (node.height || 100));
        }

        // 将容器边附加到容器节点的 blocks
        this._attachContainerEdges(cozeNodes, containerEdges);

        // 补充容器输出端口 blockID 引用
        this._patchContainerOutputRefs(cozeNodes, containerEdges);

        const copyData = this._buildClipboardData(cozeNodes, globalEdges, minX, minY, maxX, maxY);

        this.copiedNode = copyData;
        await ClipboardUtils.copy(JSON.stringify(copyData, null, 2));
    }

    // ====================================================================
    // 容器边分类与组装
    // ====================================================================

    _classifyEdges(selectedEdges, selectedNodes) {
        const containerPortMap = {
            container_start: 'loop-function-inline-output',
            container_end: 'loop-function-inline-input',
        };
        const containerNodeIds = new Set();
        const childNodeIds = new Set();

        for (const node of selectedNodes) {
            if (this.core.container.isContainer(node.id)) {
                containerNodeIds.add(node.id);
                const children = this.core.container.getChildren(node.id);
                for (const child of children) childNodeIds.add(child.id);
            }
        }

        const globalEdges = [];
        const containerEdges = {};

        for (const e of selectedEdges) {
            const sourceInContainer = containerNodeIds.has(e.source);
            const targetInContainer = containerNodeIds.has(e.target);
            const sourceIsChild = childNodeIds.has(e.source);
            const targetIsChild = childNodeIds.has(e.target);

            let putInContainer = false;
            let containerId = null;

            if (sourceIsChild && targetIsChild) {
                const sourceNode = this.core.getNode(e.source);
                containerId = sourceNode?.parentId;
                putInContainer = !!containerId;
            } else if ((sourceInContainer && targetIsChild) || (sourceIsChild && targetInContainer)) {
                if (sourceInContainer) {
                    containerId = e.source;
                    const targetNode = this.core.getNode(e.target);
                    if (targetNode?.parentId === containerId) putInContainer = true;
                } else {
                    containerId = e.target;
                    const sourceNode = this.core.getNode(e.source);
                    if (sourceNode?.parentId === containerId) putInContainer = true;
                }
            }

            if (putInContainer && containerId) {
                if (!containerEdges[containerId]) containerEdges[containerId] = [];
                const sourceNode = this.core.getNode(e.source);
                const targetNode = this.core.getNode(e.target);
                containerEdges[containerId].push({
                    sourceNodeID: e.source.replace('node_', ''),
                    targetNodeID: e.target.replace('node_', ''),
                    ...(e.sourcePort && {
                        sourcePortID: this._convertPortToCoze(
                            containerPortMap[e.sourcePort] || e.sourcePort,
                            sourceNode
                        ),
                    }),
                    ...(e.targetPort && {
                        targetPortID: this._convertPortToCoze(
                            containerPortMap[e.targetPort] || e.targetPort,
                            targetNode
                        ),
                    }),
                });
            } else {
                globalEdges.push(e);
            }
        }

        return { globalEdges, containerEdges, containerNodeIds, childNodeIds };
    }

    /** 将容器内部边附加到已序列化的容器节点的 edges 字段 */
    _attachContainerEdges(cozeNodes, containerEdges) {
        for (const cn of cozeNodes) {
            const originalId = 'node_' + cn.id;
            if (containerEdges[originalId]) {
                cn.edges = containerEdges[originalId];
            }
        }
    }

    _patchContainerOutputRefs(topLevelCozeNodes, containerEdges) {
        for (const cn of topLevelCozeNodes) {
            if (cn.type !== '21' && cn.type !== '22') continue;
            const containerId = 'node_' + cn.id;
            const edgeList = containerEdges[containerId] || cn.edges || [];

            const fromEdge = edgeList.find(
                (e) =>
                    e.sourcePortID === 'loop-function-inline-output' ||
                    e.sourcePortID === 'batch-function-inline-output'
            );
            const toEdge = edgeList.find(
                (e) =>
                    e.targetPortID === 'loop-function-inline-input' || e.targetPortID === 'batch-function-inline-input'
            );
            if (!fromEdge || !toEdge) continue;

            const childBlock = cn.blocks?.find((b) => b.id === fromEdge.targetNodeID);
            if (childBlock && childBlock.data?.outputs?.length > 0) {
                const outputName = childBlock.data.outputs[0].name;
                if (cn.data.outputs && cn.data.outputs.length > 0) {
                    cn.data.outputs.forEach((o) => {
                        if (!o.input) {
                            o.input = {
                                type: o.type || 'list',
                                value: {
                                    type: 'ref',
                                    content: {
                                        source: 'block-output',
                                        blockID: fromEdge.targetNodeID,
                                        name: outputName,
                                    },
                                },
                            };
                        }
                    });
                }
            }
        }
    }

    // ====================================================================
    // 剪贴板数据构建与复制
    // ====================================================================

    _buildClipboardData(topLevelCozeNodes, globalEdges, minX, minY, maxX, maxY) {
        const data = {
            type: 'coze-workflow-clipboard-data',
            source: {
                workflowId: 'workflow_' + Date.now(),
                flowMode: 0,
                spaceId: 'imported_space',
                isDouyin: false,
                host: 'www.coze.cn',
            },
            json: {
                nodes: topLevelCozeNodes,
                edges: globalEdges.map((e) => {
                    let sourcePortID = e.sourcePort;
                    let targetPortID = e.targetPort;
                    if (sourcePortID) {
                        const sourceNode = this.core.getNode(e.source);
                        sourcePortID = this._convertPortToCoze(sourcePortID, sourceNode);
                    }
                    if (targetPortID) {
                        const targetNode = this.core.getNode(e.target);
                        targetPortID = this._convertPortToCoze(targetPortID, targetNode);
                    }
                    return {
                        sourceNodeID: e.source.replace('node_', ''),
                        targetNodeID: e.target.replace('node_', ''),
                        ...(sourcePortID && { sourcePortID }),
                        ...(targetPortID && { targetPortID }),
                    };
                }),
            },
            bounds: {
                x: minX - 100,
                y: minY - 50,
                width: maxX - minX + 200,
                height: maxY - minY + 100,
            },
        };

        // 递归清理所有 blockID 值中的 "node_" 前缀
        this._stripNodePrefix(data.json);
        return data;
    }

    _stripNodePrefix(obj) {
        if (!obj || typeof obj !== 'object') return;
        if (Array.isArray(obj)) {
            obj.forEach((item) => this._stripNodePrefix(item));
            return;
        }
        for (const key of Object.keys(obj)) {
            if (key === 'blockID' && typeof obj[key] === 'string' && obj[key].startsWith('node_')) {
                obj[key] = obj[key].replace('node_', '');
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                this._stripNodePrefix(obj[key]);
            }
        }
    }

    // ====================================================================
    // 端口转换与粘贴
    // ====================================================================

    _convertPortToCoze(port, node) {
        if (!port || !node || node.type !== 'condition') return port;
        const branches = node.parameters?.branches;
        if (!Array.isArray(branches) || branches.length === 0) return port;
        if (port.startsWith('branch_')) {
            const idx = parseInt(port.replace('branch_', ''), 10);
            if (isNaN(idx) || idx < 0 || idx >= branches.length) return port;
            if (idx === branches.length - 1) return 'false';
            if (idx === 0) return 'true';
            return `true_${idx}`;
        }
        return port;
    }

    async paste() {
        let copyData = null;

        try {
            const text = await navigator.clipboard.readText();
            if (!text.trim()) {
                // 剪贴板为空，回退到上次复制的内部节点
                if (this.copiedNode) {
                    copyData = this.copiedNode;
                }
            } else {
                const trimmed = text.trim();
                if (!trimmed.startsWith('{')) {
                    // 剪贴板内容不是 JSON，报错而非静默回退
                    this.ui.showMessage(t('actions.pasteInvalidData'), 'error');
                    return;
                }
                copyData = JSON.parse(text);
                // 校验解析结果：必须是非 null 对象
                if (!copyData || typeof copyData !== 'object' || Array.isArray(copyData)) {
                    this.ui.showMessage(t('actions.pasteInvalidData'), 'error');
                    return;
                }
            }
        } catch (err) {
            // 读取剪贴板失败（如权限问题），回退到内部复制数据
            if (this.copiedNode) {
                copyData = this.copiedNode;
            }
        }

        if (!copyData) {
            this.ui.showMessage(t('actions.pasteEmpty'), 'warning');
            return;
        }

        // 校验数据结构：必须包含 nodes 数组或 json.nodes 数组
        const hasCozeNodes = Array.isArray(copyData.json?.nodes);
        const hasSimpleNodes = Array.isArray(copyData.nodes);
        if (!hasCozeNodes && !hasSimpleNodes && copyData.type !== 'workflow-node') {
            this.ui.showMessage(t('actions.pasteInvalidData'), 'error');
            return;
        }

        if (copyData.type === 'coze-workflow-clipboard-data' || copyData.json?.nodes?.length) {
            this.pasteHandler.pasteFromCozeFormat(copyData);
        } else if (copyData.type === 'workflow-node') {
            this.pasteHandler.pasteFromSimpleFormat(copyData);
        } else if (copyData.nodes?.length) {
            this.pasteHandler.pasteFromSimpleNodes(copyData);
        }
    }
}
