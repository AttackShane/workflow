/**
 * 工作流节点对齐模块测试
 */
global.document = global.document || {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, classList: { add: () => {}, remove: () => {}, contains: () => false } }),
};
global.window = global.window || {};

import { WorkflowAlign } from '../src/modules/editor/editor-align.js';

function createMockNode(id, x, y, width, height) {
    const node = { id, x, y, width: width || 200, height: height || 100 };
    const el = {
        dataset: { x: String(x), y: String(y) },
        style: {},
        getBoundingClientRect: () => ({ left: x, right: x + (width || 200), top: y, bottom: y + (height || 100) }),
    };
    return { node, el, x, y, width: width || 200, height: height || 100 };
}

function createMockUI() {
    const core = {
        nodes: [],
        updateNodePosition: function (id, newX, newY) {
            const node = this.nodes.find((n) => n.id === id);
            if (node) {
                node.x = newX;
                node.y = newY;
            }
        },
        saveHistory: () => {},
    };
    return {
        core,
        updateEdges: () => {},
        emitEvent: () => {},
    };
}

describe('WorkflowAlign', () => {
    let align;
    let ui;
    let core;

    beforeEach(() => {
        ui = createMockUI();
        core = ui.core;
        align = new WorkflowAlign(ui);
        global.document.getElementById = jest.fn(() => null);
        global.document.querySelectorAll = jest.fn(() => []);
    });

    it('should have alignLeft method', () => {
        expect(typeof align.alignLeft).toBe('function');
    });

    describe('alignLeft', () => {
        it('should align all nodes to the minimum x coordinate', () => {
            const nodes = [
                createMockNode('1', 10, 20, 50, 60),
                createMockNode('2', 100, 40, 60, 50),
                createMockNode('3', 50, 60, 70, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignLeft(nodes);

            expect(nodes[0].node.x).toBe(10);
            expect(nodes[1].node.x).toBe(10);
            expect(nodes[2].node.x).toBe(10);
        });

        it('should handle empty nodes array', () => {
            expect(() => align.alignLeft(null)).not.toThrow();
            expect(() => align.alignLeft([])).not.toThrow();
        });
    });

    describe('alignRight', () => {
        it('should align all nodes to the maximum right edge', () => {
            const nodes = [
                createMockNode('1', 10, 20, 50, 60),
                createMockNode('2', 100, 40, 60, 50),
                createMockNode('3', 50, 60, 70, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignRight(nodes);

            const maxRight = Math.max(50 + 10, 60 + 100, 70 + 50);
            expect(nodes[0].node.x).toBe(maxRight - 50);
            expect(nodes[1].node.x).toBe(maxRight - 60);
            expect(nodes[2].node.x).toBe(maxRight - 70);
        });
    });

    describe('alignCenterH', () => {
        it('should center nodes horizontally on the average x center', () => {
            const nodes = [
                createMockNode('1', 10, 20, 50, 60),
                createMockNode('2', 100, 40, 60, 50),
                createMockNode('3', 50, 60, 70, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignCenterH(nodes);

            const avgCenter = (10 + 25 + 100 + 30 + 50 + 35) / 3;
            nodes.forEach((n) => {
                expect(n.node.x).toBeCloseTo(avgCenter - n.width / 2, 1);
            });
        });
    });

    describe('alignTop', () => {
        it('should align all nodes to the minimum y coordinate', () => {
            const nodes = [
                createMockNode('1', 10, 100, 50, 60),
                createMockNode('2', 20, 20, 50, 50),
                createMockNode('3', 30, 50, 50, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignTop(nodes);

            expect(nodes[0].node.y).toBe(20);
            expect(nodes[1].node.y).toBe(20);
            expect(nodes[2].node.y).toBe(20);
        });
    });

    describe('alignBottom', () => {
        it('should align all nodes to the maximum bottom edge', () => {
            const nodes = [
                createMockNode('1', 10, 10, 50, 60),
                createMockNode('2', 20, 20, 50, 50),
                createMockNode('3', 30, 50, 50, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignBottom(nodes);

            const maxBottom = Math.max(60 + 10, 50 + 20, 40 + 50);
            expect(nodes[0].node.y).toBe(maxBottom - 60);
            expect(nodes[1].node.y).toBe(maxBottom - 50);
            expect(nodes[2].node.y).toBe(maxBottom - 40);
        });
    });

    describe('alignCenterV', () => {
        it('should center nodes vertically on the average y center', () => {
            const nodes = [
                createMockNode('1', 10, 10, 50, 60),
                createMockNode('2', 20, 100, 50, 50),
                createMockNode('3', 30, 50, 50, 40),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.alignCenterV(nodes);

            const avgCenter = (10 + 30 + 100 + 25 + 50 + 20) / 3;
            nodes.forEach((n) => {
                expect(n.node.y).toBeCloseTo(avgCenter - n.height / 2, 1);
            });
        });
    });

    describe('distributeHorizontal', () => {
        it('should not change order for few nodes', () => {
            const nodes = [createMockNode('1', 0, 0, 50, 50), createMockNode('2', 100, 10, 50, 50)];
            core.nodes = nodes.map((n) => n.node);

            align.distributeHorizontal(nodes);

            expect(nodes[0].node.x).toBe(0);
            expect(nodes[1].node.x).toBe(100);
        });

        it('should distribute with equal spacing', () => {
            const nodes = [
                createMockNode('1', 0, 0, 50, 50),
                createMockNode('2', 100, 10, 50, 50),
                createMockNode('3', 300, 20, 50, 50),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.distributeHorizontal(nodes);

            expect(nodes[0].node.x).toBe(0);
            expect(nodes[2].node.x).toBe(300);
            expect(nodes[1].node.x).toBeGreaterThan(0);
            expect(nodes[1].node.x).toBeLessThan(300);
        });
    });

    describe('distributeVertical', () => {
        it('should not change order for few nodes', () => {
            const nodes = [createMockNode('1', 0, 0, 50, 50), createMockNode('2', 10, 100, 50, 50)];
            core.nodes = nodes.map((n) => n.node);

            align.distributeVertical(nodes);

            expect(nodes[0].node.y).toBe(0);
            expect(nodes[1].node.y).toBe(100);
        });

        it('should distribute with equal spacing', () => {
            const nodes = [
                createMockNode('1', 0, 0, 50, 50),
                createMockNode('2', 10, 100, 50, 50),
                createMockNode('3', 20, 300, 50, 50),
            ];
            core.nodes = nodes.map((n) => n.node);

            align.distributeVertical(nodes);

            expect(nodes[0].node.y).toBe(0);
            expect(nodes[2].node.y).toBe(300);
            expect(nodes[1].node.y).toBeGreaterThan(0);
            expect(nodes[1].node.y).toBeLessThan(300);
        });
    });

    describe('setupAlignToolbar', () => {
        it('should not crash when toolbar element does not exist', () => {
            expect(() => align.setupAlignToolbar()).not.toThrow();
        });

        it('should bind click handler when toolbar exists', () => {
            const mockToolbar = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                return null;
            });

            align.setupAlignToolbar();

            expect(mockToolbar.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), undefined);
        });

        it('should trigger alignNodes when align button clicked', () => {
            const mockToolbar = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                return null;
            });

            align.setupAlignToolbar();

            const clickHandler = mockToolbar.addEventListener.mock.calls[0][1];
            const mockBtn = {
                closest: jest.fn().mockReturnValue({ dataset: { align: 'left' } }),
            };

            const mockAlignNodes = jest.spyOn(align, 'alignNodes');
            clickHandler({ target: mockBtn });

            expect(mockAlignNodes).toHaveBeenCalledWith('left');
            mockAlignNodes.mockRestore();
        });

        it('should ignore click when no align button', () => {
            const mockToolbar = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                return null;
            });

            align.setupAlignToolbar();

            const clickHandler = mockToolbar.addEventListener.mock.calls[0][1];
            const mockBtn = {
                closest: jest.fn().mockReturnValue(null),
            };

            const mockAlignNodes = jest.spyOn(align, 'alignNodes');
            clickHandler({ target: mockBtn });

            expect(mockAlignNodes).not.toHaveBeenCalled();
            mockAlignNodes.mockRestore();
        });

        it('should ignore click when button has no align dataset', () => {
            const mockToolbar = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                return null;
            });

            align.setupAlignToolbar();

            const clickHandler = mockToolbar.addEventListener.mock.calls[0][1];
            const mockBtn = {
                closest: jest.fn().mockReturnValue({ dataset: {} }),
            };

            const mockAlignNodes = jest.spyOn(align, 'alignNodes');
            clickHandler({ target: mockBtn });

            expect(mockAlignNodes).not.toHaveBeenCalled();
            mockAlignNodes.mockRestore();
        });
    });

    describe('updateAlignToolbar', () => {
        it('should not crash when toolbar element does not exist', () => {
            expect(() => align.updateAlignToolbar()).not.toThrow();
        });

        it('should hide toolbar when less than 2 nodes selected', () => {
            const mockToolbar = {
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                offsetWidth: 280,
                offsetHeight: 36,
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {},
            };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                return null;
            });
            global.document.querySelectorAll = jest.fn(() => [{ dataset: { nodeId: '1' } }]);

            align.updateAlignToolbar();

            expect(mockToolbar.classList.remove).toHaveBeenCalledWith('visible');
        });

        it('should show toolbar when 2+ nodes selected', () => {
            const mockToolbar = {
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                offsetWidth: 280,
                offsetHeight: 36,
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {},
            };
            const mockCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                if (id === 'canvas') return mockCanvas;
                return null;
            });
            global.document.querySelectorAll = jest.fn(() => [
                {
                    dataset: { nodeId: '1' },
                    getBoundingClientRect: () => ({ left: 100, top: 100, right: 300, bottom: 200 }),
                },
                {
                    dataset: { nodeId: '2' },
                    getBoundingClientRect: () => ({ left: 400, top: 100, right: 600, bottom: 200 }),
                },
            ]);

            align.updateAlignToolbar();

            expect(mockToolbar.classList.add).toHaveBeenCalledWith('visible');
            expect(mockToolbar.style.left).toBeDefined();
            expect(mockToolbar.style.top).toBeDefined();
        });

        it('should position toolbar below selection when top would overflow', () => {
            const mockToolbar = {
                addEventListener: jest.fn(),
                removeEventListener: jest.fn(),
                offsetWidth: 280,
                offsetHeight: 36,
                classList: { add: jest.fn(), remove: jest.fn() },
                style: {},
            };
            const mockCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
            global.document.getElementById = jest.fn((id) => {
                if (id === 'alignToolbar') return mockToolbar;
                if (id === 'canvas') return mockCanvas;
                return null;
            });
            global.document.querySelectorAll = jest.fn(() => [
                {
                    dataset: { nodeId: '1' },
                    getBoundingClientRect: () => ({ left: 100, top: 0, right: 300, bottom: 100 }),
                },
                {
                    dataset: { nodeId: '2' },
                    getBoundingClientRect: () => ({ left: 400, top: 0, right: 600, bottom: 100 }),
                },
            ]);

            align.updateAlignToolbar();

            expect(mockToolbar.style.left).toBeDefined();
            expect(mockToolbar.style.top).toBeDefined();
            expect(mockToolbar.classList.add).toHaveBeenCalledWith('visible');
        });
    });
});
