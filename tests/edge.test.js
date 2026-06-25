import { WorkflowEdge } from '../src/modules/workflow-edge.js';

function createMockCore(nodes = [], edges = []) {
    const containerNodes = new Set();
    return {
        nodes,
        edges,
        isContainerNode: (id) => containerNodes.has(id),
        _containerNodes: containerNodes
    };
}

function createMockUI(core) {
    return {
        core,
        canvas: {
            svgLayer: null,
            svgHitLayer: null
        },
        isMultiSelectMode: false,
        showSummaryPanel: () => {},
        showDetailPanel: () => {}
    };
}

describe('WorkflowEdge', () => {
    describe('_computeEdgeGeometry', () => {
        let edge;

        beforeEach(() => {
            const core = createMockCore();
            const ui = createMockUI(core);
            edge = new WorkflowEdge(ui);
        });

        it('should return null when source or target node not found', () => {
            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });
            expect(geom).toBeNull();
        });

        it('should compute basic geometry for simple nodes', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom).not.toBeNull();
            expect(geom.x1).toBe(200); // x1 = source.x + source.width
            expect(geom.y1).toBe(50);  // y1 = source.y + source.height / 2
            expect(geom.x2).toBe(300); // x2 = target.x
            expect(geom.y2).toBe(150); // y2 = target.y + target.height / 2
            expect(geom.d).toContain('M');
            expect(geom.d).toContain('C');
            expect(geom.arrowPoints).toBeTruthy();
            expect(geom.labelText).toBe('');
        });

        it('should compute geometry for nodes with different sizes', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 150, height: 80, type: 'code' },
                { id: 'n2', x: 250, y: 50, width: 300, height: 120, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom.x1).toBe(150); // 0 + 150
            expect(geom.y1).toBe(40);  // 0 + 80/2
            expect(geom.x2).toBe(250); // 250
            expect(geom.y2).toBe(110); // 50 + 120/2
        });

        it('should handle container source nodes with container_start port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 400, height: 300, type: 'loop' },
                { id: 'n2', x: 500, y: 100, width: 200, height: 100, type: 'code' }
            ];
            edge.core._containerNodes.add('n1');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'container_start'
            });

            expect(geom.x1).toBe(0);   // source.x (left side of container)
            expect(geom.y1).toBe(178); // source.y + height/2 + 28
            expect(geom.x2).toBe(500);
            expect(geom.y2).toBe(150); // 100 + 100/2
        });

        it('should handle container source nodes with default port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 400, height: 300, type: 'loop' },
                { id: 'n2', x: 500, y: 100, width: 200, height: 100, type: 'code' }
            ];
            edge.core._containerNodes.add('n1');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'container_bottom'
            });

            expect(geom.x1).toBe(400); // source.x + width (right side)
            expect(geom.y1).toBe(30);  // source.y + 30
        });

        it('should handle container target nodes with container_end port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 400, height: 300, type: 'loop' }
            ];
            edge.core._containerNodes.add('n2');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', targetPort: 'container_end'
            });

            expect(geom.x2).toBe(700); // 300 + 400
            expect(geom.y2).toBe(278); // 100 + 300/2 + 28
        });

        it('should handle container target nodes with default port', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 400, height: 300, type: 'loop' }
            ];
            edge.core._containerNodes.add('n2');

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', targetPort: 'container_top'
            });

            expect(geom.x2).toBe(300); // 300
            expect(geom.y2).toBe(130); // 100 + 30
        });

        it('should handle question node with branch ports', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 295, type: 'question',
                    parameters: { options: ['选项A', '选项B', '选项C'] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });

            const totalPorts = 4; // 3 options + 1 (other)
            expect(geom.y1).toBeCloseTo(295 * 0.5 / totalPorts, 0); // port 0
            expect(geom.labelText).toBe('选项A');
        });

        it('should handle question node with "other" branch', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 295, type: 'question',
                    parameters: { options: ['选项A', '选项B'] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_2'
            });

            expect(geom.labelText).toBe('其他');
        });

        it('should handle condition node with branch ports', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'condition',
                    parameters: { branches: [{ name: 'True' }, { name: 'False' }] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });

            expect(geom.labelText).toBe('True');
        });

        it('should handle condition node with unnamed branches', () => {
            edge.core.nodes = [
                {
                    id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'condition',
                    parameters: { branches: [{}, {}] }
                },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom0 = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_0'
            });
            expect(geom0.labelText).toBe('True');

            const geom1 = edge._computeEdgeGeometry({
                id: 'e1', source: 'n1', target: 'n2', sourcePort: 'branch_1'
            });
            expect(geom1.labelText).toBe('False');
        });

        it('should generate valid SVG path with cubic bezier', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            const pathRegex = /^M \d+ \d+ C \d+ \d+, \d+ \d+, \d+ \d+$/;
            expect(geom.d).toMatch(pathRegex);
        });

        it('should generate arrow points as triangle', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            const points = geom.arrowPoints.split(' ').filter(p => p.length > 0);
            expect(points.length).toBe(3);
        });

        it('should handle nodes with parentId for absolute positioning', () => {
            edge.core.nodes = [
                { id: 'parent', x: 100, y: 50, width: 500, height: 400, type: 'loop' },
                { id: 'n1', x: 50, y: 100, width: 150, height: 80, type: 'code', parentId: 'parent' },
                { id: 'n2', x: 400, y: 200, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            // n1 absolute: x = 100 + 50 = 150, y = 50 + 58 + 100 = 208
            expect(geom.x1).toBe(300); // 150 + 150
            expect(geom.y1).toBe(248); // 208 + 80/2
            expect(geom.x2).toBe(400);
            expect(geom.y2).toBe(250); // 200 + 100/2
        });

        it('should handle edge label position', () => {
            edge.core.nodes = [
                { id: 'n1', x: 0, y: 0, width: 200, height: 100, type: 'code' },
                { id: 'n2', x: 300, y: 100, width: 200, height: 100, type: 'code' }
            ];

            const geom = edge._computeEdgeGeometry({ id: 'e1', source: 'n1', target: 'n2' });

            expect(geom.labelX).toBe(200 + (300 - 200) * 0.15); // x1 + (x2-x1)*0.15
            expect(geom.labelY).toBe(50 - 8); // y1 - 8
        });
    });
});