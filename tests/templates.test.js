/**
 * 工作流模板库测试
 */
import { WORKFLOW_TEMPLATES, resolveTemplateI18n } from '../src/modules/templates.js';

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

    describe('resolveTemplateI18n', () => {
        const mockT = jest.fn(key => {
            const map = {
                'templates.tpl_welcome.name': '欢迎模板',
                'templates.tpl_welcome.description': '快速开始',
                'templates.tpl_welcome.nodes.start.title': '开始',
                'templates.tpl_welcome.nodes.start.desc': '开始节点',
                'templates.tpl_welcome.nodes.llm.title': 'AI助手',
                'templates.tpl_welcome.nodes.llm.desc': '大模型',
                'templates.tpl_welcome.nodes.end.title': '结束',
                'templates.tpl_welcome.nodes.end.desc': '结束节点',
                'templates.categories.basic': '基础'
            };
            return map[key] || key;
        });

        it('should resolve template name and description', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_welcome');
            const resolved = resolveTemplateI18n(tpl, mockT);
            expect(resolved.name).toBe('欢迎模板');
            expect(resolved.description).toBe('快速开始');
            expect(resolved.category).toBe('基础');
        });

        it('should resolve node titles and descriptions', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_welcome');
            const resolved = resolveTemplateI18n(tpl, mockT);
            expect(resolved.nodes[0].title).toBe('开始');
            expect(resolved.nodes[0].description).toBe('开始节点');
            expect(resolved.nodes[1].title).toBe('AI助手');
            expect(resolved.nodes[1].description).toBe('大模型');
            expect(resolved.nodes[2].title).toBe('结束');
            expect(resolved.nodes[2].description).toBe('结束节点');
        });

        it('should fallback to original key when t() returns falsy', () => {
            const tpl = { ...WORKFLOW_TEMPLATES[0], name: 'unknown.key' };
            const emptyT = jest.fn(() => '');
            const resolved = resolveTemplateI18n(tpl, emptyT);
            expect(resolved.name).toBe('unknown.key');
        });

        it('should not mutate original template', () => {
            const tpl = WORKFLOW_TEMPLATES[0];
            const originalName = tpl.name;
            resolveTemplateI18n(tpl, mockT);
            expect(tpl.name).toBe(originalName);
        });

        it('should preserve non-i18n fields', () => {
            const tpl = WORKFLOW_TEMPLATES.find(t => t.id === 'tpl_welcome');
            const resolved = resolveTemplateI18n(tpl, mockT);
            expect(resolved.id).toBe(tpl.id);
            expect(resolved.icon).toBe(tpl.icon);
            expect(resolved.nodes).toHaveLength(tpl.nodes.length);
            expect(resolved.edges).toEqual(tpl.edges);
        });

        it('should handle fallback for unknown keys', () => {
            const customTpl = {
                id: 'custom',
                name: 'unknown.template.name',
                description: 'unknown.template.desc',
                category: 'unknown.category',
                nodes: [{ id: 'n1', title: 'unknown.node.title', description: 'unknown.node.desc' }],
                edges: []
            };
            const t = jest.fn(() => null);
            const resolved = resolveTemplateI18n(customTpl, t);
            expect(resolved.name).toBe('unknown.template.name');
            expect(resolved.description).toBe('unknown.template.desc');
            expect(resolved.nodes[0].title).toBe('unknown.node.title');
        });
    });
});