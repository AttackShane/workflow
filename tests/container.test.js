/**
 * 容器节点管理模块测试 — editor-container.js
 *
 * 覆盖关键路径：
 * - isContainer：判断节点是否为容器类型（hasContainer 标记）
 * - getChildren：获取直接子节点
 * - getAllDescendants：递归获取所有后代
 * - getAncestors：获取祖先链（从父到根）
 * - getDepth：节点深度
 * - getCommonAncestor：最近共同祖先
 * - isDescendant：后代关系判断
 * - validateContainerPorts：容器端口连接校验（container_start/container_end 内外规则）
 * - getContainerBounds：容器边界矩形计算
 * - addToContainer：节点加入容器（含嵌套限制）
 * - removeFromContainer：节点移出容器
 * - getAllContainers：收集所有容器节点
 * - getRootNodes：获取根级节点
 *
 * 策略：使用 createMockCore 提供真实 nodes 数组 + nodeTypeInfo 映射，
 * mock i18n t() 返回键名，mock APP_CONFIG 提供尺寸常量。
 */
import { WorkflowContainer } from '../src/modules/editor-container.js';
import { createMockCore, createMockNode } from './helpers/mockFactories.js';

jest.mock('../src/config/constants.js', () => ({
    APP_CONFIG: {
        NODE: {
            NODE_HEADER_H: 32,
            CONTAINER_HEADER_H: 36,
            CONTAINER_DESC_H: 20,
            CONTAINER_OFFSET: 56,
            CONTAINER_BODY_OFFSET: 58,
            DEFAULT_NODE_WIDTH: 240,
            DEFAULT_NODE_HEIGHT: 80,
        },
    },
}));

jest.mock('../src/i18n/i18n.js', () => ({
    t: jest.fn((key) => key),
}));

// 容器类型信息常量
const CONTAINER_TYPE_INFO = {
    loop: { hasContainer: true, containerMinWidth: 300, containerMinHeight: 200 },
    batch: { hasContainer: true, containerMinWidth: 300, containerMinHeight: 200 },
    llm: { hasContainer: false },
    code: { hasContainer: false },
};

describe('WorkflowContainer', () => {
    let core, container;

    beforeEach(() => {
        core = createMockCore({ nodeTypeInfo: CONTAINER_TYPE_INFO });
        container = new WorkflowContainer(core);
    });

    // ==================================================================
    // isContainer
    // ==================================================================
    describe('isContainer', () => {
        it('容器类型节点应返回 true', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            expect(container.isContainer('c1')).toBe(true);
        });

        it('batch 类型节点也应返回 true', () => {
            core.nodes = [createMockNode({ id: 'b1', type: 'batch' })];
            expect(container.isContainer('b1')).toBe(true);
        });

        it('非容器类型节点应返回 false', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm' })];
            expect(container.isContainer('n1')).toBe(false);
        });

        it('不存在的节点应返回 false', () => {
            expect(container.isContainer('nonexistent')).toBe(false);
        });

        it('nodeTypeInfo 中无 hasContainer 标记的类型应返回 false', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'unknown_type' })];
            expect(container.isContainer('n1')).toBe(false);
        });
    });

    // ==================================================================
    // getChildren
    // ==================================================================
    describe('getChildren', () => {
        it('应返回所有直接子节点', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'child1', parentId: 'c1' }),
                createMockNode({ id: 'child2', parentId: 'c1' }),
                createMockNode({ id: 'n1', parentId: null }),
            ];
            const children = container.getChildren('c1');
            expect(children).toHaveLength(2);
            expect(children.map((c) => c.id)).toEqual(['child1', 'child2']);
        });

        it('无子节点时应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            const children = container.getChildren('c1');
            expect(children).toEqual([]);
        });

        it('应跳过非子节点', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'c2', type: 'loop' }),
                createMockNode({ id: 'child1', parentId: 'c1' }),
                createMockNode({ id: 'child2', parentId: 'c2' }),
            ];
            const children = container.getChildren('c1');
            expect(children).toHaveLength(1);
            expect(children[0].id).toBe('child1');
        });

        it('不存在的容器应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'n1', parentId: null })];
            const children = container.getChildren('nonexistent');
            expect(children).toEqual([]);
        });
    });

    // ==================================================================
    // getAllDescendants
    // ==================================================================
    describe('getAllDescendants', () => {
        it('应递归获取所有后代节点', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'child1', parentId: 'c1' }),
                createMockNode({ id: 'c2', type: 'loop', parentId: 'c1' }),
                createMockNode({ id: 'grandchild1', parentId: 'c2' }),
                createMockNode({ id: 'n1', parentId: null }),
            ];
            const descendants = container.getAllDescendants('c1');
            const ids = descendants.map((d) => d.id);
            expect(ids).toContain('child1');
            expect(ids).toContain('c2');
            expect(ids).toContain('grandchild1');
            expect(descendants).toHaveLength(3);
        });

        it('无子节点时应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            const descendants = container.getAllDescendants('c1');
            expect(descendants).toEqual([]);
        });

        it('不应包含非后代节点', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'child1', parentId: 'c1' }),
                createMockNode({ id: 'c2', type: 'loop' }),
                createMockNode({ id: 'other_child', parentId: 'c2' }),
            ];
            const descendants = container.getAllDescendants('c1');
            expect(descendants.map((d) => d.id)).not.toContain('other_child');
        });
    });

    // ==================================================================
    // getAncestors
    // ==================================================================
    describe('getAncestors', () => {
        it('应返回祖先链（从直接父到根）', () => {
            core.nodes = [
                createMockNode({ id: 'root', type: 'loop' }),
                createMockNode({ id: 'mid', type: 'loop', parentId: 'root' }),
                createMockNode({ id: 'leaf', parentId: 'mid' }),
            ];
            const ancestors = container.getAncestors('leaf');
            expect(ancestors.map((a) => a.id)).toEqual(['mid', 'root']);
        });

        it('根节点应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'root', parentId: null })];
            const ancestors = container.getAncestors('root');
            expect(ancestors).toEqual([]);
        });

        it('不存在的节点应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'n1', parentId: null })];
            const ancestors = container.getAncestors('nonexistent');
            expect(ancestors).toEqual([]);
        });

        it('parentId 指向不存在的节点时应停止遍历', () => {
            core.nodes = [createMockNode({ id: 'n1', parentId: 'ghost_parent' })];
            const ancestors = container.getAncestors('n1');
            expect(ancestors).toEqual([]);
        });
    });

    // ==================================================================
    // getDepth
    // ==================================================================
    describe('getDepth', () => {
        it('根节点深度应为 0', () => {
            core.nodes = [createMockNode({ id: 'root', parentId: null })];
            expect(container.getDepth('root')).toBe(0);
        });

        it('一级子节点深度应为 1', () => {
            core.nodes = [
                createMockNode({ id: 'root', type: 'loop' }),
                createMockNode({ id: 'child', parentId: 'root' }),
            ];
            expect(container.getDepth('child')).toBe(1);
        });

        it('三级嵌套节点深度应为 3', () => {
            core.nodes = [
                createMockNode({ id: 'l0', type: 'loop' }),
                createMockNode({ id: 'l1', type: 'loop', parentId: 'l0' }),
                createMockNode({ id: 'l2', type: 'loop', parentId: 'l1' }),
                createMockNode({ id: 'l3', parentId: 'l2' }),
            ];
            expect(container.getDepth('l3')).toBe(3);
        });

        it('不存在的节点深度应为 0', () => {
            expect(container.getDepth('nonexistent')).toBe(0);
        });
    });

    // ==================================================================
    // getCommonAncestor
    // ==================================================================
    describe('getCommonAncestor', () => {
        it('应返回最近共同祖先', () => {
            core.nodes = [
                createMockNode({ id: 'root', type: 'loop' }),
                createMockNode({ id: 'mid', type: 'loop', parentId: 'root' }),
                createMockNode({ id: 'a', parentId: 'mid' }),
                createMockNode({ id: 'b', parentId: 'mid' }),
            ];
            expect(container.getCommonAncestor('a', 'b')).toBe('mid');
        });

        it('无共同祖先时应返回 null', () => {
            core.nodes = [
                createMockNode({ id: 'root1', type: 'loop' }),
                createMockNode({ id: 'root2', type: 'loop' }),
                createMockNode({ id: 'a', parentId: 'root1' }),
                createMockNode({ id: 'b', parentId: 'root2' }),
            ];
            expect(container.getCommonAncestor('a', 'b')).toBe(null);
        });

        it('其中一个节点是另一个的祖先时应返回 null（不含节点自身）', () => {
            core.nodes = [
                createMockNode({ id: 'root', type: 'loop' }),
                createMockNode({ id: 'child', parentId: 'root' }),
            ];
            // getAncestors('root') = []（root 无父节点），所以无共同祖先
            expect(container.getCommonAncestor('root', 'child')).toBe(null);
        });

        it('根节点之间无共同祖先应返回 null', () => {
            core.nodes = [createMockNode({ id: 'r1', parentId: null }), createMockNode({ id: 'r2', parentId: null })];
            expect(container.getCommonAncestor('r1', 'r2')).toBe(null);
        });
    });

    // ==================================================================
    // isDescendant
    // ==================================================================
    describe('isDescendant', () => {
        it('后代节点应返回 true', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' }), createMockNode({ id: 'child1', parentId: 'c1' })];
            expect(container.isDescendant('c1', 'child1')).toBe(true);
        });

        it('孙节点应返回 true', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'c2', type: 'loop', parentId: 'c1' }),
                createMockNode({ id: 'grandchild', parentId: 'c2' }),
            ];
            expect(container.isDescendant('c1', 'grandchild')).toBe(true);
        });

        it('非后代节点应返回 false', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'c2', type: 'loop' }),
                createMockNode({ id: 'child1', parentId: 'c1' }),
                createMockNode({ id: 'child2', parentId: 'c2' }),
            ];
            expect(container.isDescendant('c1', 'child2')).toBe(false);
        });

        it('自身不应被视为后代', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            expect(container.isDescendant('c1', 'c1')).toBe(false);
        });
    });

    // ==================================================================
    // validateContainerPorts
    // ==================================================================
    describe('validateContainerPorts', () => {
        beforeEach(() => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'inner', parentId: 'c1' }),
                createMockNode({ id: 'outer', parentId: null }),
            ];
        });

        it('容器 container_start 端口连非子节点应拒绝', () => {
            const result = container.validateContainerPorts('c1', 'outer', 'container_start');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('actions.containerInternalOnly');
        });

        it('容器 container_start 端口连子节点应通过', () => {
            const result = container.validateContainerPorts('c1', 'inner', 'container_start');
            expect(result.valid).toBe(true);
        });

        it('容器非 container_start 端口连子节点应拒绝', () => {
            const result = container.validateContainerPorts('c1', 'inner', 'container_end');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('actions.containerExternalOnly');
        });

        it('容器非 container_start 端口连非子节点应通过', () => {
            const result = container.validateContainerPorts('c1', 'outer', 'container_end');
            expect(result.valid).toBe(true);
        });

        it('目标容器 container_end 端口连非子节点应拒绝', () => {
            const result = container.validateContainerPorts('outer', 'c1', '', 'container_end');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('actions.containerInternalOnly');
        });

        it('目标容器 container_end 端口连子节点应通过', () => {
            const result = container.validateContainerPorts('inner', 'c1', '', 'container_end');
            expect(result.valid).toBe(true);
        });

        it('目标容器非 container_end 端口连子节点应拒绝', () => {
            const result = container.validateContainerPorts('inner', 'c1', '', 'other_port');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('actions.containerExternalOnly');
        });

        it('目标容器非 container_end 端口连非子节点应通过', () => {
            const result = container.validateContainerPorts('outer', 'c1', '', 'other_port');
            expect(result.valid).toBe(true);
        });

        it('两个非容器节点之间应通过', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm' }), createMockNode({ id: 'n2', type: 'llm' })];
            const result = container.validateContainerPorts('n1', 'n2', 'output', 'input');
            expect(result.valid).toBe(true);
        });

        it('两端都是容器且端口均为外部端口时应通过', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' }), createMockNode({ id: 'c2', type: 'loop' })];
            // c1 非 container_start（外部端口）→ c2 非 container_end（外部端口）
            // 两端都不是子节点 → 通过
            const result = container.validateContainerPorts('c1', 'c2', 'output', 'input');
            expect(result.valid).toBe(true);
        });

        it('默认端口参数为空字符串时应正确处理', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' }), createMockNode({ id: 'outer', parentId: null })];
            const result = container.validateContainerPorts('c1', 'outer', '', '');
            expect(result.valid).toBe(true);
        });
    });

    // ==================================================================
    // getContainerBounds
    // ==================================================================
    describe('getContainerBounds', () => {
        it('应根据子节点范围计算边界矩形', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop', x: 100, y: 100 }),
                createMockNode({ id: 'child1', x: 150, y: 200, width: 100, height: 80, parentId: 'c1' }),
                createMockNode({ id: 'child2', x: 300, y: 50, width: 120, height: 60, parentId: 'c1' }),
            ];
            const bounds = container.getContainerBounds('c1');
            // minX = 150, minY = 50
            // maxX = max(150+100, 300+120) = 420
            // maxY = max(200+80, 50+60) = 280
            // padding = 20, CONTAINER_HEADER_H = 36
            expect(bounds.x).toBe(150 - 20); // 130
            expect(bounds.y).toBe(50 - 20 - 36); // -6
            expect(bounds.width).toBe(420 - 150 + 40); // 310
            expect(bounds.height).toBe(280 - 50 + 40 + 36); // 306
        });

        it('无子节点时应返回 null', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            expect(container.getContainerBounds('c1')).toBe(null);
        });

        it('子节点无 width/height 时应使用默认值', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop', x: 0, y: 0 }),
                createMockNode({ id: 'child1', x: 100, y: 100, width: undefined, height: undefined, parentId: 'c1' }),
            ];
            const bounds = container.getContainerBounds('c1');
            // DEFAULT_NODE_WIDTH = 240, DEFAULT_NODE_HEIGHT = 80
            // minX = 100, maxX = 100 + 240 = 340
            // minY = 100, maxY = 100 + 80 = 180
            expect(bounds.x).toBe(100 - 20);
            expect(bounds.y).toBe(100 - 20 - 36);
            expect(bounds.width).toBe(340 - 100 + 40);
            expect(bounds.height).toBe(180 - 100 + 40 + 36);
        });

        it('单个子节点时应正确计算', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop', x: 0, y: 0 }),
                createMockNode({ id: 'only_child', x: 200, y: 150, width: 100, height: 50, parentId: 'c1' }),
            ];
            const bounds = container.getContainerBounds('c1');
            expect(bounds.x).toBe(200 - 20);
            expect(bounds.y).toBe(150 - 20 - 36);
            expect(bounds.width).toBe(100 + 40);
            expect(bounds.height).toBe(50 + 40 + 36);
        });
    });

    // ==================================================================
    // addToContainer
    // ==================================================================
    describe('addToContainer', () => {
        it('应成功将节点加入容器并设置 parentId', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'n1', type: 'llm', parentId: null }),
            ];
            const result = container.addToContainer('n1', 'c1');
            expect(result).toBe(true);
            const node = core.nodes.find((n) => n.id === 'n1');
            expect(node.parentId).toBe('c1');
        });

        it('非容器目标应返回 false', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm' }), createMockNode({ id: 'n2', type: 'code' })];
            const result = container.addToContainer('n1', 'n2');
            expect(result).toBe(false);
            expect(core.nodes.find((n) => n.id === 'n1').parentId).toBe(null);
        });

        it('目标容器不存在应返回 false', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm' })];
            const result = container.addToContainer('n1', 'nonexistent');
            expect(result).toBe(false);
        });

        it('要加入的节点不存在应返回 false', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' })];
            const result = container.addToContainer('nonexistent', 'c1');
            expect(result).toBe(false);
        });

        it('节点的后代不能作为其容器（防环）', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'c2', type: 'loop', parentId: 'c1' }),
            ];
            // c2 是 c1 的后代，不能把 c1 加入 c2
            const result = container.addToContainer('c1', 'c2');
            expect(result).toBe(false);
            expect(core.nodes.find((n) => n.id === 'c1').parentId).toBe(null);
        });
    });

    // ==================================================================
    // removeFromContainer
    // ==================================================================
    describe('removeFromContainer', () => {
        it('应成功将节点移出容器并清除 parentId', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'n1', type: 'llm', parentId: 'c1' }),
            ];
            const result = container.removeFromContainer('n1');
            expect(result).toBe(true);
            expect(core.nodes.find((n) => n.id === 'n1').parentId).toBe(null);
        });

        it('无 parentId 的节点应返回 false', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm', parentId: null })];
            const result = container.removeFromContainer('n1');
            expect(result).toBe(false);
        });

        it('不存在的节点应返回 false', () => {
            const result = container.removeFromContainer('nonexistent');
            expect(result).toBe(false);
        });
    });

    // ==================================================================
    // getAllContainers
    // ==================================================================
    describe('getAllContainers', () => {
        it('应返回所有容器类型节点', () => {
            core.nodes = [
                createMockNode({ id: 'c1', type: 'loop' }),
                createMockNode({ id: 'c2', type: 'batch' }),
                createMockNode({ id: 'n1', type: 'llm' }),
                createMockNode({ id: 'n2', type: 'code' }),
            ];
            const containers = container.getAllContainers();
            expect(containers).toHaveLength(2);
            expect(containers.map((c) => c.id)).toEqual(['c1', 'c2']);
        });

        it('无容器节点时应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'n1', type: 'llm' }), createMockNode({ id: 'n2', type: 'code' })];
            expect(container.getAllContainers()).toEqual([]);
        });

        it('空节点列表时应返回空数组', () => {
            core.nodes = [];
            expect(container.getAllContainers()).toEqual([]);
        });
    });

    // ==================================================================
    // getRootNodes
    // ==================================================================
    describe('getRootNodes', () => {
        it('应返回所有无 parentId 的节点', () => {
            core.nodes = [
                createMockNode({ id: 'root1', type: 'loop', parentId: null }),
                createMockNode({ id: 'root2', type: 'llm', parentId: null }),
                createMockNode({ id: 'child1', parentId: 'root1' }),
            ];
            const roots = container.getRootNodes();
            expect(roots).toHaveLength(2);
            expect(roots.map((r) => r.id)).toEqual(['root1', 'root2']);
        });

        it('所有节点都有 parentId 时应返回空数组', () => {
            core.nodes = [createMockNode({ id: 'c1', type: 'loop' }), createMockNode({ id: 'child1', parentId: 'c1' })];
            // c1 无 parentId，是根节点
            const roots = container.getRootNodes();
            expect(roots).toHaveLength(1);
            expect(roots[0].id).toBe('c1');
        });

        it('空节点列表时应返回空数组', () => {
            core.nodes = [];
            expect(container.getRootNodes()).toEqual([]);
        });
    });
});
