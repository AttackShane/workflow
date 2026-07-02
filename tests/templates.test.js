/**
 * 工作流模板库测试
 */
import { WORKFLOW_TEMPLATES } from '../src/modules/templates.js';

describe('Workflow Templates', () => {
    describe('template structure', () => {
        it('should have templates defined', () => {
            expect(WORKFLOW_TEMPLATES).toBeDefined();
            expect(Array.isArray(WORKFLOW_TEMPLATES)).toBe(true);
            expect(WORKFLOW_TEMPLATES.length).toBeGreaterThan(0);
        });

        it('each template should have required fields', () => {
            WORKFLOW_TEMPLATES.forEach(tpl => {
                expect(tpl).toHaveProperty('id');
                expect(tpl).toHaveProperty('name');
                expect(tpl).toHaveProperty('description');
                expect(tpl).toHaveProperty('icon');
                expect(tpl).toHaveProperty('category');
                expect(tpl).toHaveProperty('nodes');
                expect(tpl).toHaveProperty('edges');
                expect(Array.isArray(tpl.nodes)).toBe(true);
                expect(Array.isArray(tpl.edges)).toBe(true);
            });
        });

        it('each template node should have required fields', () => {
            WORKFLOW_TEMPLATES.forEach(tpl => {
                tpl.nodes.forEach(node => {
                    expect(node).toHaveProperty('id');
                    expect(node).toHaveProperty('type');
                    expect(node).toHaveProperty('x');
                    expect(node).toHaveProperty('y');
                    expect(node).toHaveProperty('title');
                });
            });
        });

        it('each template edge should have required fields', () => {
            WORKFLOW_TEMPLATES.forEach(tpl => {
                tpl.edges.forEach(edge => {
                    expect(edge).toHaveProperty('id');
                    expect(edge).toHaveProperty('source');
                    expect(edge).toHaveProperty('target');
                });
            });
        });
    });

    describe('template categories', () => {
        it('should have diverse categories', () => {
            const categories = new Set(WORKFLOW_TEMPLATES.map(tpl => tpl.category));
            expect(categories.size).toBeGreaterThan(1);
        });
    });

    describe('template IDs', () => {
        it('should have unique IDs', () => {
            const ids = WORKFLOW_TEMPLATES.map(tpl => tpl.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
        });
    });

    describe('node IDs in templates', () => {
        it('should have valid node IDs', () => {
            WORKFLOW_TEMPLATES.forEach(tpl => {
                tpl.nodes.forEach(node => {
                    expect(node.id).toMatch(/^node_\d+$/);
                });
            });
        });
    });

    describe('edge references', () => {
        it('should reference existing nodes', () => {
            WORKFLOW_TEMPLATES.forEach(tpl => {
                const nodeIds = new Set(tpl.nodes.map(n => n.id));
                tpl.edges.forEach(edge => {
                    expect(nodeIds.has(edge.source)).toBe(true);
                    expect(nodeIds.has(edge.target)).toBe(true);
                });
            });
        });
    });

    describe('well-known templates', () => {
        it('should include welcome template', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_welcome');
            expect(tpl).toBeDefined();
            expect(tpl.nodes).toHaveLength(3);
        });

        it('should include chatbot template', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_chatbot');
            expect(tpl).toBeDefined();
            expect(tpl.nodes.length).toBeGreaterThan(3);
        });

        it('should include loop template', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_loop');
            expect(tpl).toBeDefined();
            const hasParentId = tpl.nodes.some(n => n.parentId);
            expect(hasParentId).toBe(true);
        });
    });
});