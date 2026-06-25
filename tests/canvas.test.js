import { WorkflowCanvas } from '../src/modules/workflow-canvas.js';

function createMockCore(nodes = []) {
    return {
        nodes,
        edges: [],
        isContainerNode: () => false
    };
}

function createMockUI(core) {
    return {
        core,
        isMultiSelectMode: false,
        showSummaryPanel: () => {},
        showDetailPanel: () => {}
    };
}

describe('WorkflowCanvas', () => {
    describe('screenToCanvas', () => {
        let canvas;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
        });

        it('should convert screen coordinates to canvas coordinates at default scale', () => {
            canvas.canvasScale = 1;
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(1)' }
            };

            const result = canvas.screenToCanvas(200, 150);

            expect(result.canvasX).toBe(200);
            expect(result.canvasY).toBe(150);
        });

        it('should convert screen coordinates with zoom', () => {
            canvas.canvasScale = 2;
            canvas.canvasContent = {
                style: { transform: 'translate(0px, 0px) scale(2)' }
            };

            const result = canvas.screenToCanvas(300, 250);

            expect(result.canvasX).toBe(150);
            expect(result.canvasY).toBe(125);
        });

        it('should convert screen coordinates with translate offset', () => {
            canvas.canvasScale = 1;
            canvas.canvasContent = {
                style: { transform: 'translate(50px, 30px) scale(1)' }
            };

            const result = canvas.screenToCanvas(150, 130);

            expect(result.canvasX).toBe(100);
            expect(result.canvasY).toBe(100);
        });
    });

    describe('isNodeVisible', () => {
        let canvas;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
        });

        it('should return true when node is within viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should return false when node is above viewport', () => {
            canvas.viewport = { left: 0, top: 500, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is below viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 1000, bottom: 200 };
            const node = { x: 100, y: 500, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is left of viewport', () => {
            canvas.viewport = { left: 500, top: 0, right: 1000, bottom: 800 };
            const node = { x: 100, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return false when node is right of viewport', () => {
            canvas.viewport = { left: 0, top: 0, right: 300, bottom: 800 };
            const node = { x: 500, y: 100, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(false);
        });

        it('should return true when node is partially visible', () => {
            canvas.viewport = { left: 100, top: 100, right: 500, bottom: 500 };
            const node = { x: 400, y: 400, width: 200, height: 200 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });

        it('should return true when node exactly aligns with viewport edges', () => {
            canvas.viewport = { left: 0, top: 0, right: 200, bottom: 100 };
            const node = { x: 0, y: 0, width: 200, height: 100 };

            expect(canvas.isNodeVisible(node)).toBe(true);
        });
    });

    describe('calculateNodesBounds', () => {
        let canvas;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            canvas = new WorkflowCanvas(ui);
        });

        it('should return infinity bounds for empty nodes', () => {
            canvas.core.nodes = [];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(Infinity);
            expect(bounds.minY).toBe(Infinity);
            expect(bounds.maxX).toBe(-Infinity);
            expect(bounds.maxY).toBe(-Infinity);
        });

        it('should calculate bounds for single node', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(100);
            expect(bounds.minY).toBe(200);
            expect(bounds.maxX).toBe(400);
            expect(bounds.maxY).toBe(350);
        });

        it('should calculate bounds for multiple nodes', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 },
                { x: 500, y: 100, width: 200, height: 400 },
                { x: 50, y: 50, width: 100, height: 100 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(50);
            expect(bounds.minY).toBe(50);
            expect(bounds.maxX).toBe(700); // 500 + 200
            expect(bounds.maxY).toBe(500); // 100 + 400
        });

        it('should skip child nodes with parentId', () => {
            canvas.core.nodes = [
                { x: 100, y: 200, width: 300, height: 150 },
                { x: 10, y: 10, width: 50, height: 50, parentId: 'parent_1' },
                { x: 500, y: 100, width: 200, height: 400 }
            ];

            const bounds = canvas.calculateNodesBounds();

            expect(bounds.minX).toBe(100); // child node skipped
            expect(bounds.maxX).toBe(700);
        });
    });

    describe('getVisibleNodeCount', () => {
        it('should return count of visible nodes', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set([0, 1, 2]);

            expect(canvas.getVisibleNodeCount()).toBe(3);
        });

        it('should return 0 when no nodes are visible', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set();

            expect(canvas.getVisibleNodeCount()).toBe(0);
        });
    });

    describe('getPerformanceStats', () => {
        it('should return performance stats object', () => {
            const core = createMockCore([
                { x: 0, y: 0, width: 100, height: 100 },
                { x: 200, y: 200, width: 100, height: 100 }
            ]);
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.visibleNodes = new Set([0]);
            canvas.canvasScale = 1.5;

            const stats = canvas.getPerformanceStats();

            expect(stats.totalNodes).toBe(2);
            expect(stats.visibleNodes).toBe(1);
            expect(stats.hiddenNodes).toBe(1);
            expect(stats.canvasScale).toBe('1.50');
            expect(stats.visibilityRatio).toBe('50.0%');
        });
    });

    describe('setEmptyState', () => {
        it('should show empty state', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.emptyState = { style: { display: '' } };

            canvas.setEmptyState(true);

            expect(canvas.emptyState.style.display).toBe('flex');
        });

        it('should hide empty state', () => {
            const core = createMockCore();
            const ui = createMockUI(core);
            const canvas = new WorkflowCanvas(ui);
            canvas.emptyState = { style: { display: 'flex' } };

            canvas.setEmptyState(false);

            expect(canvas.emptyState.style.display).toBe('none');
        });
    });
});