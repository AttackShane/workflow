/**
 * 工作流自动布局模块
 * 基于拓扑排序的自动布局算法，按连接关系从左到右排列，紧凑不重叠
 * 支持容器节点嵌套布局，自动调整容器尺寸
 */

import { APP_CONFIG } from '../config/constants.js';

/**
 * 自动优化布局
 * @param {import('./editor-core').WorkflowCore} core - 工作流核心实例
 * @param {import('./editor-canvas').WorkflowCanvas} canvas - 画布实例
 */
export function autoOptimizeLayout(core, canvas) {
    if (!core || !core.nodes || core.nodes.length === 0) {
        canvas.resetView();
        return;
    }

    const hGap = 60;
    const vGap = 40;
    const PADDING = 20;
    const CONTAINER_H_GAP = 60;
    const CONTAINER_V_GAP = 40;
    const HEADER_H = APP_CONFIG.NODE.CONTAINER_HEADER_H;
    const DESC_H = APP_CONFIG.NODE.CONTAINER_DESC_H;
    const BORDER = 4;
    const CONN_POINT_Y = 30;

    const defaultW = 200;
    const defaultH = 100;

    const getNodeSize = (node) => {
        const info = core.nodeTypeInfo[node.type] || {};
        const isContainer = info.hasContainer === true;
        const w = node.width || (isContainer ? info.containerMinWidth || 300 : 200);
        const h = node.height || (isContainer ? info.containerMinHeight || 200 : 100);
        return { w, h };
    };

    const layoutNodeGroup = (groupNodes, startX, startY, gapH, gapV, _centerY = false) => {
        if (groupNodes.length === 0) return;
        const groupSizes = new Map();
        const groupIds = new Set(groupNodes.map((n) => n.id));
        groupNodes.forEach((n) => groupSizes.set(n.id, getNodeSize(n)));

        const nodeIsContainer = (node) => {
            const info = core.nodeTypeInfo[node.type] || {};
            return info.hasContainer === true;
        };

        const nodeYFromConnY = (node, connY) => {
            const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
            return nodeIsContainer(node) ? connY - CONN_POINT_Y : connY - sz.h / 2;
        };
        const connYFromNodeY = (node, nodeY) => {
            const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
            return nodeIsContainer(node) ? nodeY + CONN_POINT_Y : nodeY + sz.h / 2;
        };
        const bottomFromNodeY = (node, nodeY) => {
            const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
            const h = sz.h;
            return nodeY + h;
        };

        const adj = new Map();
        const inDeg = new Map();
        const preds = new Map();
        groupNodes.forEach((n) => {
            adj.set(n.id, []);
            inDeg.set(n.id, 0);
            preds.set(n.id, []);
        });

        core.edges.forEach((edge) => {
            const s = edge.source;
            const t = edge.target;
            if (groupIds.has(s) && groupIds.has(t)) {
                adj.get(s).push(t);
                inDeg.set(t, (inDeg.get(t) || 0) + 1);
                preds.get(t).push(s);
            }
        });

        const nodeLevel = new Map();
        const sources = groupNodes.filter((n) => inDeg.get(n.id) === 0);
        const queue = sources.map((n) => n.id);
        sources.forEach((n) => nodeLevel.set(n.id, 0));

        while (queue.length > 0) {
            const id = queue.shift();
            adj.get(id).forEach((nextId) => {
                const predMax = Math.max(...preds.get(nextId).map((pid) => nodeLevel.get(pid) ?? -1));
                const newLevel = predMax + 1;
                if (!nodeLevel.has(nextId) || nodeLevel.get(nextId) < newLevel) {
                    nodeLevel.set(nextId, newLevel);
                    if (!queue.includes(nextId)) queue.push(nextId);
                }
            });
        }

        groupNodes.forEach((n) => {
            if (!nodeLevel.has(n.id)) nodeLevel.set(n.id, 0);
        });

        const levels = [];
        const levelMaxW = [];
        nodeLevel.forEach((level, id) => {
            if (!levels[level]) levels[level] = [];
            const node = groupNodes.find((n) => n.id === id);
            if (node) {
                levels[level].push(node);
                const sz = groupSizes.get(id) || { w: defaultW, h: defaultH };
                levelMaxW[level] = Math.max(levelMaxW[level] || 0, sz.w);
            }
        });

        const nodeCenterY = new Map();

        if (levels.length > 0 && levels[0]) {
            let yOff = startY;
            levels[0].forEach((node) => {
                const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                const connY = connYFromNodeY(node, yOff);
                nodeCenterY.set(node.id, connY);
                yOff += sz.h + gapV;
            });
        }

        for (let col = 1; col < levels.length; col++) {
            if (!levels[col]) continue;
            levels[col].forEach((node) => {
                const predIds = preds.get(node.id);

                if (predIds && predIds.length > 0) {
                    let sumCenterY = 0;
                    let count = 0;
                    predIds.forEach((pid) => {
                        if (nodeCenterY.has(pid)) {
                            sumCenterY += nodeCenterY.get(pid);
                            count++;
                        }
                    });
                    if (count > 0) {
                        nodeCenterY.set(node.id, sumCenterY / count);
                    } else {
                        nodeCenterY.set(node.id, connYFromNodeY(node, startY));
                    }
                } else {
                    nodeCenterY.set(node.id, connYFromNodeY(node, startY));
                }
            });
        }

        for (let col = 0; col < levels.length; col++) {
            if (!levels[col]) continue;
            levels[col].sort((a, b) => (nodeCenterY.get(a.id) || 0) - (nodeCenterY.get(b.id) || 0));

            let prevBottom = -Infinity;
            levels[col].forEach((node) => {
                let connY = nodeCenterY.get(node.id) || 0;
                const nodeY = nodeYFromConnY(node, connY);
                const top = nodeY;

                if (top < prevBottom + gapV) {
                    const newY = prevBottom + gapV;
                    connY = connYFromNodeY(node, newY);
                    nodeCenterY.set(node.id, connY);
                }

                prevBottom = bottomFromNodeY(node, nodeYFromConnY(node, nodeCenterY.get(node.id) || 0));
            });
        }

        let xOff = startX;
        levels.forEach((level, col) => {
            const maxW = levelMaxW[col] || defaultW;
            level.forEach((node) => {
                const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                const connY = nodeCenterY.get(node.id) || 0;
                node.x = xOff;
                node.y = nodeYFromConnY(node, connY);
                node.width = sz.w;
                node.height = sz.h;
            });
            xOff += maxW + gapH;
        });
    };

    core.nodes.forEach((container) => {
        const info = core.nodeTypeInfo[container.type] || {};
        if (!info.hasContainer) return;
        const children = core.container.getChildren(container.id);
        if (children.length === 0) return;

        layoutNodeGroup(children, PADDING, PADDING, CONTAINER_H_GAP, CONTAINER_V_GAP, false);

        const minW = info.containerMinWidth || 300;
        const minH = info.containerMinHeight || 200;
        let maxRight = 0;
        let maxBottom = 0;
        let minX = 0;
        let minY = 0;
        children.forEach((child) => {
            const sz = getNodeSize(child);
            minX = Math.min(minX, child.x);
            minY = Math.min(minY, child.y);
            maxRight = Math.max(maxRight, child.x + sz.w);
            maxBottom = Math.max(maxBottom, child.y + sz.h);
        });
        const bodyW = Math.max(minW - BORDER, maxRight - minX + PADDING * 2);
        const bodyH = Math.max(minH - HEADER_H - DESC_H - BORDER, maxBottom - minY + PADDING * 2);
        container.width = Math.max(minW, bodyW + BORDER);
        container.height = HEADER_H + DESC_H + bodyH + BORDER;
    });

    const nodes = core.nodes.filter((n) => !n.parentId);
    layoutNodeGroup(nodes, 0, 0, hGap, vGap, false);

    const bounds = canvas.calculateNodesBounds();
    const offsetX = -Math.min(0, bounds.minX);
    const offsetY = -Math.min(0, bounds.minY);
    nodes.forEach((node) => {
        node.x += offsetX;
        node.y += offsetY;
    });

    core.saveHistory('messages.viewReset');

    canvas.ui.refreshCanvas();
    canvas.updateSvgSize();
    canvas.scheduleRenderUpdate();
    canvas.centerView();
}
