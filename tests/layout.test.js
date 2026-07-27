/**
 * editor-layout.js 单元测试
 *
 * 覆盖 autoOptimizeLayout 的核心分支：
 * - 空节点 / 全孤立节点 / 连通图拓扑布局
 * - 注释节点（type 'comment' 与数字 '31'）吸附到最近主流程节点
 * - 容器节点内部布局 + 尺寸调整
 * - 容器注释重排 + 碰撞检测推移
 * - DOM 强制刷新（_elMap 坐标同步）
 *
 * mock 策略：core 用共享工厂（真实数据结构的纯 mock），
 * canvas 自建最小桩（覆盖 resetView / calculateNodesBounds / ui.refreshCanvas 等）。
 *
 * 注意：createMockCore 的 nodes / edges 是 getter-only，需构造后 push，
 * 不要通过 overrides 传数组（Object.assign 覆盖 getter 会静默失败）。
 */

import { autoOptimizeLayout } from '../src/modules/editor/editor-layout.js';
import { createMockCore, createMockNode, createMockEdge } from './helpers/mockFactories.js';

jest.mock('../src/config/constants.js', () => ({
    APP_CONFIG: {
        NODE: { CONTAINER_HEADER_H: 36, CONTAINER_DESC_H: 20 },
    },
}));

function createLayoutCanvas() {
    const elMap = new Map();
    return {
        node: { container: { renderContainerChildren: jest.fn() } },
        ui: { refreshCanvas: jest.fn() },
        resetView: jest.fn(),
        calculateNodesBounds: jest.fn(() => ({ minX: 0, minY: 0, maxX: 0, maxY: 0 })),
        updateSvgSize: jest.fn(),
        scheduleRenderUpdate: jest.fn(),
        centerView: jest.fn(),
        _elMap: elMap,
    };
}

describe('autoOptimizeLayout', () => {
    test('空节点时调用 canvas.resetView 并直接返回', () => {
        const core = createMockCore();
        const canvas = createLayoutCanvas();
        autoOptimizeLayout(core, canvas);
        expect(canvas.resetView).toHaveBeenCalled();
        expect(core.saveHistory).not.toHaveBeenCalled();
    });

    test('连通图进行拓扑布局并写回坐标 + 保存历史', () => {
        const core = createMockCore();
        const n1 = createMockNode({ id: 'n1', type: 'llm' });
        const n2 = createMockNode({ id: 'n2', type: 'llm' });
        core.nodes.push(n1, n2);
        core.edges.push(createMockEdge({ source: 'n1', target: 'n2' }));
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        expect(core.saveHistory).toHaveBeenCalledWith('messages.viewReset');
        // 两层节点应被分配到不同 X 列（n2 在 n1 右侧）
        expect(n2.x).toBeGreaterThan(n1.x);
        expect(Number.isFinite(n1.y)).toBe(true);
        expect(Number.isFinite(n2.y)).toBe(true);
    });

    test('全部孤立节点（无边）按垂直方向排列', () => {
        const core = createMockCore();
        const a = createMockNode({ id: 'a', type: 'llm' });
        const b = createMockNode({ id: 'b', type: 'llm' });
        const c = createMockNode({ id: 'c', type: 'llm' });
        core.nodes.push(a, b, c);
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        // 全部对齐到同一起始 X，Y 依次向下递增
        expect(a.x).toBe(b.x);
        expect(b.x).toBe(c.x);
        expect(b.y).toBeGreaterThan(a.y);
        expect(c.y).toBeGreaterThan(b.y);
    });

    test('孤立注释节点（type=comment）随主流程一起垂直排列', () => {
        // 纯孤立场景（无边）functions 早返回，注释与 main 一起垂直排列
        const core = createMockCore();
        const main = createMockNode({ id: 'main', type: 'llm' });
        const comment = createMockNode({ id: 'cm', type: 'comment' });
        core.nodes.push(main, comment);
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        // 注释节点在 main 下方，X 对齐
        expect(comment.x).toBe(main.x);
        expect(comment.y).toBeGreaterThan(main.y);
    });

    test('连通主节点时孤立注释（type=comment）吸附到最近主节点', () => {
        const core = createMockCore();
        const main = createMockNode({ id: 'main', type: 'llm', x: 100, y: 100 });
        const other = createMockNode({ id: 'o', type: 'llm', x: 500, y: 500 });
        const comment = createMockNode({ id: 'cm', type: 'comment', x: 110, y: 110 });
        core.nodes.push(main, other, comment);
        core.edges.push(createMockEdge({ source: 'main', target: 'o' }));
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        // 注释被吸附到最近主节点 main 下方（而非远处的 other）
        expect(comment.x).toBe(main.x);
        expect(comment.y).toBeGreaterThan(main.y);
    });

    test('孤立注释节点（type=数字 31）同样被吸附', () => {
        const core = createMockCore();
        const main = createMockNode({ id: 'main', type: 'llm', x: 0, y: 0 });
        const other = createMockNode({ id: 'o', type: 'llm', x: 800, y: 0 });
        const comment = createMockNode({ id: 'cm', type: '31', x: 5, y: 5 });
        core.nodes.push(main, other, comment);
        core.edges.push(createMockEdge({ source: 'main', target: 'o' }));
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        expect(comment.x).toBe(main.x);
        expect(comment.y).toBeGreaterThan(main.y);
    });

    test('容器节点带子节点时进行内部布局并调整容器尺寸', () => {
        const core = createMockCore();
        const loop = createMockNode({ id: 'loop', type: 'loop' });
        const child = createMockNode({ id: 'c1', type: 'llm', parentId: 'loop' });
        core.nodes.push(loop, child);
        core.nodeTypeInfo = { loop: { hasContainer: true } };
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        // 容器尺寸被重新计算（宽高 > 0）
        expect(loop.width).toBeGreaterThan(0);
        expect(loop.height).toBeGreaterThan(0);
        // 子节点坐标被内部布局写回
        expect(Number.isFinite(child.x)).toBe(true);
        expect(Number.isFinite(child.y)).toBe(true);
        // 容器内部布局触发 DOM 强刷
        expect(canvas.node.container.renderContainerChildren).toHaveBeenCalledWith('loop');
        // 容器标记 _skipLayout 防止 updateContainerSize 覆盖
        expect(loop._skipLayout).toBe(true);
    });

    test('容器节点声明 hasContainer 但无子节点时跳过内部布局', () => {
        const core = createMockCore();
        const loop = createMockNode({ id: 'loop', type: 'loop' });
        core.nodes.push(loop);
        core.nodeTypeInfo = { loop: { hasContainer: true } };
        const canvas = createLayoutCanvas();

        // 不应抛错（getChildren 返回空 → 内部布局跳过，但末尾 DOM 强刷仍会调用）
        expect(() => autoOptimizeLayout(core, canvas)).not.toThrow();
        expect(canvas.node.container.renderContainerChildren).toHaveBeenCalledWith('loop');
    });

    test('容器注释重排：吸附到容器的注释节点按容器高度重新定位', () => {
        const core = createMockCore();
        const loop = createMockNode({ id: 'loop', type: 'loop' });
        const child = createMockNode({ id: 'c1', type: 'llm', parentId: 'loop' });
        const comment = createMockNode({ id: 'cm', type: 'comment', x: 2, y: 2 });
        core.nodes.push(loop, child, comment);
        core.nodeTypeInfo = { loop: { hasContainer: true } };
        const canvas = createLayoutCanvas();

        autoOptimizeLayout(core, canvas);

        // 注释被吸附到容器 loop 并排在其下方
        expect(comment.x).toBe(loop.x);
        expect(comment.y).toBeGreaterThan(loop.y);
    });

    test('DOM 强制刷新：_elMap 中节点元素的坐标被同步', () => {
        const core = createMockCore();
        const n1 = createMockNode({ id: 'n1', type: 'llm' });
        const n2 = createMockNode({ id: 'n2', type: 'llm' });
        core.nodes.push(n1, n2);
        core.edges.push(createMockEdge({ source: 'n1', target: 'n2' }));
        const canvas = createLayoutCanvas();

        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        canvas._elMap.set('n1', el1);
        canvas._elMap.set('n2', el2);

        autoOptimizeLayout(core, canvas);

        expect(el1.style.transform).toContain('translate');
        expect(el2.style.transform).toContain('translate');
        expect(el1.dataset.x).toBe(String(n1.x));
    });

    test('容器子节点 DOM 也随 _elMap 同步', () => {
        const core = createMockCore();
        const loop = createMockNode({ id: 'loop', type: 'loop' });
        const child = createMockNode({ id: 'c1', type: 'llm', parentId: 'loop' });
        core.nodes.push(loop, child);
        core.nodeTypeInfo = { loop: { hasContainer: true } };
        const canvas = createLayoutCanvas();

        const childEl = document.createElement('div');
        canvas._elMap.set('c1', childEl);

        autoOptimizeLayout(core, canvas);

        expect(childEl.style.transform).toContain('translate');
        expect(childEl.dataset.y).toBe(String(child.y));
    });

    test('节点 Y 重叠时碰撞检测自动向下推移（不抛错且收敛）', () => {
        const core = createMockCore();
        const n1 = createMockNode({ id: 'n1', type: 'llm' });
        const n2 = createMockNode({ id: 'n2', type: 'llm' });
        const n3 = createMockNode({ id: 'n3', type: 'llm' });
        core.nodes.push(n1, n2, n3);
        core.edges.push(createMockEdge({ source: 'n1', target: 'n2' }));
        // n3 作为孤立节点落在 n2 附近，X 重叠易触发碰撞推移
        n3.x = n2.x;
        const canvas = createLayoutCanvas();

        expect(() => autoOptimizeLayout(core, canvas)).not.toThrow();
        [n1, n2, n3].forEach((n) => {
            expect(Number.isFinite(n.x)).toBe(true);
            expect(Number.isFinite(n.y)).toBe(true);
        });
    });
});
