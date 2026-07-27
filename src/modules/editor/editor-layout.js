/**
 * 工作流自动布局模块
 * 基于拓扑排序的自动布局算法，按连接关系从左到右排列，紧凑不重叠
 * 支持容器节点嵌套布局，自动调整容器尺寸
 */

import { APP_CONFIG } from '../../config/constants.js';

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

    const layoutNodeGroup = (groupNodes, startX, startY, gapH, gapV, isInner = false) => {
        if (groupNodes.length === 0) return { commentGroups: new Map() };

        // 分离连接的节点和孤立节点
        const connectedIds = new Set();
        core.edges.forEach((edge) => {
            connectedIds.add(edge.source);
            connectedIds.add(edge.target);
        });
        const isolatedNodes = groupNodes.filter((n) => !connectedIds.has(n.id));
        const connectedNodes = groupNodes.filter((n) => connectedIds.has(n.id));

        // 保存所有节点的原始坐标（用于注释节点吸附匹配）
        const originalPositions = new Map();
        groupNodes.forEach((n) => {
            originalPositions.set(n.id, { x: n.x || 0, y: n.y || 0 });
        });

        // 如果所有节点都是孤立的，直接垂直排列
        if (connectedNodes.length === 0) {
            let yOff = startY;
            groupNodes.forEach((node) => {
                const sz = getNodeSize(node);
                node.x = startX;
                node.y = yOff;
                node.width = sz.w;
                node.height = sz.h;
                yOff += sz.h + gapV;
            });
            return { commentGroups: new Map() };
        }

        // 对连接的节点进行拓扑布局
        const groupSizes = new Map();
        const groupIds = new Set(connectedNodes.map((n) => n.id));
        connectedNodes.forEach((n) => groupSizes.set(n.id, getNodeSize(n)));

        const nodeIsContainer = (node) => {
            const info = core.nodeTypeInfo[node.type] || {};
            return info.hasContainer === true;
        };

        // 连接点Y与节点左上角Y的换算
        // 外部布局：容器外部连接点固定在24px，普通节点中心在h/2
        // 内部布局：统一使用中心偏移h/2（容器内部连接点和子节点都在中心）
        const getConnOffset = (node) => {
            if (!isInner && nodeIsContainer(node)) {
                return 24; // 外部布局：容器外部连接点固定在24px
            }
            const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
            return sz.h / 2; // 内部布局或普通节点：使用中心偏移
        };

        const nodeYFromConnY = (node, connY) => {
            return connY - getConnOffset(node);
        };
        const connYFromNodeY = (node, nodeY) => {
            return nodeY + getConnOffset(node);
        };

        // 构建邻接表和入度表
        const adj = new Map();
        const inDeg = new Map();
        const preds = new Map();
        connectedNodes.forEach((n) => {
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

        // 拓扑排序，确定节点层级（从左到右的列）
        const nodeLevel = new Map();
        const sources = connectedNodes.filter((n) => inDeg.get(n.id) === 0);
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

        connectedNodes.forEach((n) => {
            if (!nodeLevel.has(n.id)) nodeLevel.set(n.id, 0);
        });

        // 按层级分组
        const levels = [];
        const levelMaxW = [];
        nodeLevel.forEach((level, id) => {
            if (!levels[level]) levels[level] = [];
            const node = connectedNodes.find((n) => n.id === id);
            if (node) {
                levels[level].push(node);
                const sz = groupSizes.get(id) || { w: defaultW, h: defaultH };
                levelMaxW[level] = Math.max(levelMaxW[level] || 0, sz.w);
            }
        });

        // 计算每层的总高度（含节点间距），用于对称居中
        const levelTotalH = levels.map((level) => {
            if (!level || level.length === 0) return 0;
            let totalH = 0;
            level.forEach((node) => {
                totalH += (groupSizes.get(node.id) || { h: defaultH }).h;
            });
            return totalH + (level.length - 1) * gapV;
        });

        // 对称中心：以最大层总高度为参考，确保整体垂直居中而非堆在上方
        const maxLevelH = Math.max(...levelTotalH, 0);
        const symCenterY = startY + maxLevelH / 2;

        const nodeConnY = new Map();

        // 第0层：所有源节点以对称中心为目标Y
        if (levels.length > 0 && levels[0]) {
            levels[0].forEach((node) => {
                nodeConnY.set(node.id, symCenterY);
            });
        }

        // 后续层：目标Y = 前驱连接点Y的平均值
        // 单一前驱时目标Y = 前驱连接点Y，保证连接线水平
        for (let col = 1; col < levels.length; col++) {
            if (!levels[col]) continue;
            levels[col].forEach((node) => {
                const predIds = preds.get(node.id);
                if (predIds && predIds.length > 0) {
                    let sumY = 0;
                    let count = 0;
                    predIds.forEach((pid) => {
                        if (nodeConnY.has(pid)) {
                            sumY += nodeConnY.get(pid);
                            count++;
                        }
                    });
                    if (count > 0) {
                        nodeConnY.set(node.id, sumY / count);
                    } else {
                        nodeConnY.set(node.id, symCenterY);
                    }
                } else {
                    nodeConnY.set(node.id, symCenterY);
                }
            });
        }

        // 重叠处理：每层以目标Y平均值为中心，垂直对称排列
        for (let col = 0; col < levels.length; col++) {
            if (!levels[col]) continue;
            const level = levels[col];

            level.sort((a, b) => (nodeConnY.get(a.id) || 0) - (nodeConnY.get(b.id) || 0));

            let sumTargetY = 0;
            level.forEach((node) => {
                sumTargetY += nodeConnY.get(node.id) || 0;
            });
            const idealCenterY = level.length > 0 ? sumTargetY / level.length : symCenterY;

            const totalH = levelTotalH[col] || 0;
            let yOff = idealCenterY - totalH / 2;
            level.forEach((node) => {
                const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                const connY = yOff + getConnOffset(node);
                nodeConnY.set(node.id, connY);
                yOff += sz.h + gapV;
            });
        }

        // 分离注释节点和普通孤立节点（兼容类型名称和数字ID两种格式）
        const isCommentType = (n) => n.type === 'comment' || String(n.type) === '31';
        const otherIsolated = isolatedNodes.filter((n) => !isCommentType(n));
        const commentNodes = isolatedNodes.filter(isCommentType);

        // 吸附候选：包含所有连接节点 + 容器节点（即使没有外部边）
        const snapCandidates = [...connectedNodes];
        groupNodes.forEach((node) => {
            const info = core.nodeTypeInfo[node.type] || {};
            if (info.hasContainer && !snapCandidates.includes(node)) {
                snapCandidates.push(node);
            }
        });

        // 注释节点绑定到最近主流程节点，作为其附属一起布局
        const commentGroups = new Map();
        const unboundComments = [];

        commentNodes.forEach((commentNode) => {
            const commentOrig = originalPositions.get(commentNode.id) || { x: 0, y: 0 };

            // 在吸附候选中找最近节点（使用欧几里得距离平方）
            let nearest = null;
            let minDistanceSq = Infinity;
            snapCandidates.forEach((node) => {
                const nodeOrig = originalPositions.get(node.id) || { x: 0, y: 0 };
                const xDiff = Math.abs(nodeOrig.x - commentOrig.x);
                const yDiff = Math.abs(nodeOrig.y - commentOrig.y);
                const distanceSq = xDiff * xDiff + yDiff * yDiff;

                if (distanceSq < minDistanceSq) {
                    minDistanceSq = distanceSq;
                    nearest = node;
                }
            });

            if (nearest) {
                if (!commentGroups.has(nearest.id)) {
                    commentGroups.set(nearest.id, []);
                }
                commentGroups.get(nearest.id).push(commentNode);
            } else {
                // 没有主流程节点时作为孤立节点处理
                unboundComments.push(commentNode);
            }
        });

        // 将注释节点绑定为吸附节点的附属，计算每个节点的实际布局高度
        // 先按原始Y坐标排序注释节点
        commentGroups.forEach((comments) => {
            comments.sort((a, b) => {
                const ay = (originalPositions.get(a.id) || { y: 0 }).y;
                const by = (originalPositions.get(b.id) || { y: 0 }).y;
                return ay - by;
            });
        });

        // 计算每个节点的实际布局高度（节点高度 + 绑定注释高度）
        const getEffectiveHeight = (node) => {
            const nodeSz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
            const boundComments = commentGroups.get(node.id) || [];
            let commentH = 0;
            boundComments.forEach((c, idx) => {
                const sz = getNodeSize(c);
                commentH += sz.h;
                if (idx > 0) commentH += gapV;
            });
            return nodeSz.h + (commentH > 0 ? gapV + commentH : 0);
        };

        // 使用实际高度进行布局计算
        const effectiveSizes = new Map();
        connectedNodes.forEach((n) => {
            const sz = groupSizes.get(n.id) || { w: defaultW, h: defaultH };
            effectiveSizes.set(n.id, { w: sz.w, h: getEffectiveHeight(n) });
        });

        // 根据实际高度重新计算levelTotalH
        const levelTotalHEffective = levels.map((level) => {
            if (!level || level.length === 0) return 0;
            let totalH = 0;
            level.forEach((node) => {
                totalH += effectiveSizes.get(node.id).h;
            });
            return totalH + (level.length - 1) * gapV;
        });

        // 对称中心重新计算
        const maxLevelHEffective = Math.max(...levelTotalHEffective, 0);
        const symCenterYEffective = startY + maxLevelHEffective / 2;

        // 重新进行重叠处理（使用实际高度）
        const nodeConnYEffective = new Map();

        // 第0层
        if (levels.length > 0 && levels[0]) {
            levels[0].forEach((node) => {
                nodeConnYEffective.set(node.id, symCenterYEffective);
            });
        }

        // 后续层
        for (let col = 1; col < levels.length; col++) {
            if (!levels[col]) continue;
            levels[col].forEach((node) => {
                const predIds = preds.get(node.id);
                if (predIds && predIds.length > 0) {
                    let sumY = 0;
                    let count = 0;
                    predIds.forEach((pid) => {
                        if (nodeConnYEffective.has(pid)) {
                            sumY += nodeConnYEffective.get(pid);
                            count++;
                        }
                    });
                    if (count > 0) {
                        nodeConnYEffective.set(node.id, sumY / count);
                    } else {
                        nodeConnYEffective.set(node.id, symCenterYEffective);
                    }
                } else {
                    nodeConnYEffective.set(node.id, symCenterYEffective);
                }
            });
        }

        // 使用实际高度进行重叠处理
        for (let col = 0; col < levels.length; col++) {
            if (!levels[col]) continue;
            const level = levels[col];

            level.sort((a, b) => (nodeConnYEffective.get(a.id) || 0) - (nodeConnYEffective.get(b.id) || 0));

            let sumTargetY = 0;
            level.forEach((node) => {
                sumTargetY += nodeConnYEffective.get(node.id) || 0;
            });
            const idealCenterY = level.length > 0 ? sumTargetY / level.length : symCenterYEffective;

            const totalH = levelTotalHEffective[col] || 0;
            let yOff = idealCenterY - totalH / 2;
            level.forEach((node) => {
                const effSz = effectiveSizes.get(node.id);
                const connY = yOff + getConnOffset(node);
                nodeConnYEffective.set(node.id, connY);
                yOff += effSz.h + gapV;
            });
        }

        // 应用最终坐标（使用实际连接点Y，但布局高度包含注释）
        let xOff = startX;
        let level0BottomY = 0;
        levels.forEach((level, col) => {
            const maxW = levelMaxW[col] || defaultW;
            level.forEach((node) => {
                const sz = groupSizes.get(node.id) || { w: defaultW, h: defaultH };
                const effSz = effectiveSizes.get(node.id);
                const connY = nodeConnYEffective.get(node.id) || 0;
                node.x = xOff;
                node.y = nodeYFromConnY(node, connY);
                node.width = sz.w;
                node.height = sz.h;

                // 放置绑定的注释节点
                const boundComments = commentGroups.get(node.id) || [];
                let commentY = node.y + sz.h + gapV;
                boundComments.forEach((comment) => {
                    const cSz = getNodeSize(comment);
                    comment.x = node.x;
                    comment.y = commentY;
                    comment.width = cSz.w;
                    comment.height = cSz.h;
                    commentY += cSz.h + gapV;
                });

                if (col === 0) {
                    const effBottom = node.y + effSz.h;
                    level0BottomY = Math.max(level0BottomY, effBottom);
                }
            });
            xOff += maxW + gapH;
        });

        // 计算所有节点的底部，用于放置孤立节点
        let fallbackY = level0BottomY;
        levels.forEach((level) => {
            if (!level) return;
            level.forEach((node) => {
                const effSz = effectiveSizes.get(node.id);
                fallbackY = Math.max(fallbackY, node.y + effSz.h);
            });
        });
        fallbackY += gapV;

        let baseX = startX;
        if (connectedNodes.length > 0 && levels[0] && levels[0].length > 0) {
            baseX = levels[0][0].x;
        }

        // 未绑定的注释节点并入孤立节点队列
        otherIsolated.push(...unboundComments);

        // 放置其他孤立节点
        if (otherIsolated.length > 0) {
            let isoY = fallbackY;
            otherIsolated.forEach((node) => {
                const sz = getNodeSize(node);
                node.x = baseX;
                node.y = isoY;
                node.width = sz.w;
                node.height = sz.h;
                isoY += sz.h + gapV;
            });
        }

        return { commentGroups };
    };

    core.nodes.forEach((container) => {
        const info = core.nodeTypeInfo[container.type] || {};
        if (!info.hasContainer) return;
        const children = core.container.getChildren(container.id);
        if (children.length === 0) return;

        // 设置_skipLayout标记，防止updateContainerSize自动平移覆盖布局计算
        container._skipLayout = true;

        // 容器内部布局：使用isInner=true，子节点和内部连接点都在中心
        layoutNodeGroup(children, PADDING, PADDING, CONTAINER_H_GAP, CONTAINER_V_GAP, true);

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

    const rootResult = layoutNodeGroup(nodes, 0, 0, hGap, vGap);
    const rootCommentGroups = rootResult.commentGroups;

    const bounds = canvas.calculateNodesBounds();
    const offsetX = -Math.min(0, bounds.minX);
    const offsetY = -Math.min(0, bounds.minY);
    nodes.forEach((node) => {
        node.x += offsetX;
        node.y += offsetY;
    });

    // 强制刷新所有容器节点的子节点DOM，确保DOM位置与数据模型一致，
    // 防止视口剔除基于旧坐标错误判断导致子节点消失。
    // 必须先刷新DOM，因为updateContainerSize会根据DOM重新计算容器实际高度。
    if (canvas.node && canvas.node.container) {
        core.nodes.forEach((node) => {
            const info = core.nodeTypeInfo[node.type] || {};
            if (info.hasContainer) {
                canvas.node.container.renderContainerChildren(node.id);
            }
        });
    }

    // 重新调整吸附到容器节点的注释节点位置（基于DOM刷新后的容器实际高度）
    // 并处理可能产生的碰撞
    rootCommentGroups.forEach((comments, nodeId) => {
        const node = nodes.find((n) => n.id === nodeId);
        if (!node) return;
        const info = core.nodeTypeInfo[node.type] || {};
        if (!info.hasContainer) return;
        const gapV = vGap;
        let currentY = node.y + node.height + gapV;
        comments.forEach((comment) => {
            const sz = getNodeSize(comment);
            comment.x = node.x;
            comment.y = currentY;
            comment.width = sz.w;
            comment.height = sz.h;
            currentY += sz.h + gapV;
        });
    });

    // 碰撞检测：检测容器注释调整后是否与后续节点产生碰撞，自动推移
    const rootLevelNodes = [];
    const rootCommentNodes = [];
    rootCommentGroups.forEach((comments) => {
        comments.forEach((c) => rootCommentNodes.push(c));
    });
    const allRootNodes = [...nodes, ...rootCommentNodes];

    for (let iter = 0; iter < 5; iter++) {
        let adjusted = false;
        const sortedByY = [...allRootNodes].sort((a, b) => a.y - b.y);

        for (let i = 0; i < sortedByY.length; i++) {
            const nodeA = sortedByY[i];
            const aSz = nodeA.width && nodeA.height ? { w: nodeA.width, h: nodeA.height } : getNodeSize(nodeA);
            const aRight = nodeA.x + aSz.w;
            const aBottom = nodeA.y + aSz.h;

            for (let j = i + 1; j < sortedByY.length; j++) {
                const nodeB = sortedByY[j];
                const bSz = nodeB.width && nodeB.height ? { w: nodeB.width, h: nodeB.height } : getNodeSize(nodeB);
                const bLeft = nodeB.x;
                const bRight = nodeB.x + bSz.w;
                const bTop = nodeB.y;

                const overlapX = !(aRight <= bLeft || aRight >= bRight);
                if (!overlapX) continue;

                if (aBottom > bTop) {
                    const pushDelta = aBottom - bTop + vGap;
                    nodeB.y += pushDelta;
                    adjusted = true;
                    console.log(
                        `[layout] post-container collision: "${nodeA.title}" pushed "${nodeB.title}" by ${pushDelta}`
                    );
                }
            }
        }

        if (!adjusted) break;
    }

    core.saveHistory('messages.viewReset');

    canvas.ui.refreshCanvas();

    // refreshCanvas 重建了容器外壳，需要重新添加容器子节点
    if (canvas.node && canvas.node.container) {
        core.nodes.forEach((node) => {
            const info = core.nodeTypeInfo[node.type] || {};
            if (info.hasContainer) {
                canvas.node.container.renderContainerChildren(node.id);
            }
        });
    }

    // 重新刷新所有节点DOM位置（包括容器子节点）
    if (canvas._elMap) {
        nodes.forEach((node) => {
            const el = canvas._elMap.get(node.id);
            if (el) {
                el.style.transform = `translate(${node.x}px, ${node.y}px)`;
                el.dataset.x = node.x;
                el.dataset.y = node.y;
            }

            const info = core.nodeTypeInfo[node.type] || {};
            if (info.hasContainer) {
                const children = core.container.getChildren(node.id);
                children.forEach((child) => {
                    const childEl = canvas._elMap.get(child.id);
                    if (childEl) {
                        childEl.style.transform = `translate(${child.x}px, ${child.y}px)`;
                        childEl.dataset.x = child.x;
                        childEl.dataset.y = child.y;
                    }
                });
            }
        });
    }

    canvas.updateSvgSize();
    canvas.scheduleRenderUpdate();
    canvas.centerView();
}
