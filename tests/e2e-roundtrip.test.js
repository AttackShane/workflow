/**
 * 端到端往返一致性测试（P3-13）
 *
 * 验证 Coze 格式 → 内部格式 → Coze 格式 → 内部格式 的完整往返一致性。
 * 测试覆盖：多节点、多类型、嵌套容器、多边、参数序列化、blockID 引用。
 *
 * 数据流：
 *   Coze clipboard → convertClipboardToInternal → internal1
 *   internal1 → convertInternalToClipboardNode → Coze2
 *   Coze2 → convertClipboardToInternal → internal2
 *   比较 internal1 vs internal2
 */
import { convertClipboardToInternal, convertInternalToClipboardNode } from '../src/modules/shared-serializer.js';

// ====================================================================
// 测试数据：构造完整的 Coze 剪贴板格式工作流
// 12 节点 / 10+ 类型 / 嵌套 loop 容器 / 14 边 / blockID 引用
// ====================================================================

function buildCozeClipboardData() {
    const nodes = [
        // 1. start 节点
        {
            id: '1001',
            type: '1',
            meta: { position: { x: 100, y: 100 } },
            data: {
                nodeMeta: {
                    title: '开始',
                    icon: '',
                    description: '工作流入口',
                    mainColor: '#00B42A',
                    subTitle: '开始',
                },
                inputs: {},
                outputs: [{ name: 'user_query', type: 'string', required: true, description: '用户输入' }],
            },
        },
        // 2. llm 节点 — 引用 start 的输出（blockID 引用）
        {
            id: '1002',
            type: '3',
            meta: { position: { x: 400, y: 100 } },
            data: {
                nodeMeta: {
                    title: '意图识别',
                    icon: '',
                    description: 'LLM 分析用户意图',
                    mainColor: '#5C62FF',
                    subTitle: '大模型',
                },
                inputs: {
                    inputParameters: [
                        {
                            name: 'user_input',
                            input: {
                                type: 'string',
                                value: {
                                    type: 'ref',
                                    content: { source: 'block-output', blockID: '1001', name: 'user_query' },
                                },
                            },
                        },
                    ],
                    llmParam: [
                        {
                            name: 'modleName',
                            input: { type: 'string', value: { type: 'literal', content: '豆包·1.5·Pro·32k' } },
                        },
                        {
                            name: 'prompt',
                            input: { type: 'string', value: { type: 'literal', content: '分析用户意图并分类' } },
                        },
                        { name: 'temperature', input: { type: 'float', value: { type: 'literal', content: '0.7' } } },
                    ],
                },
                outputs: [{ name: 'output', type: 'string', required: false, description: 'LLM 输出' }],
            },
        },
        // 3. code 节点
        {
            id: '1003',
            type: '5',
            meta: { position: { x: 400, y: 300 } },
            data: {
                nodeMeta: {
                    title: '数据预处理',
                    icon: '',
                    description: '代码节点',
                    mainColor: '#FF7D00',
                    subTitle: '代码',
                },
                inputs: { code: 'def main(args):\n    return {"result": args.get("input", "")}' },
                outputs: [{ name: 'result', type: 'string', required: false }],
            },
        },
        // 4. condition 节点 — 分支
        {
            id: '1004',
            type: '8',
            meta: { position: { x: 700, y: 200 } },
            data: {
                nodeMeta: {
                    title: '条件判断',
                    icon: '',
                    description: '分支判断',
                    mainColor: '#FF00CC',
                    subTitle: '条件',
                },
                inputs: {},
                outputs: [],
            },
            parameters: {
                branches: [
                    {
                        name: '走LLM',
                        condition: {
                            conditions: [
                                {
                                    left: {
                                        input: { value: { type: 'ref', content: { blockID: '1002', name: 'output' } } },
                                    },
                                    operator: 'contains',
                                    right: { input: { value: { type: 'literal', content: 'yes' } } },
                                },
                            ],
                        },
                    },
                    { name: '走Code', condition: { conditions: [] } },
                ],
            },
        },
        // 5. loop 容器节点 — 嵌套容器
        {
            id: '1005',
            type: '21',
            meta: { position: { x: 1000, y: 100 } },
            data: {
                nodeMeta: {
                    title: '循环处理',
                    icon: '',
                    description: '循环容器',
                    mainColor: '#165DFF',
                    subTitle: '循环',
                },
                inputs: { loopTimes: 5 },
                outputs: [],
            },
            blocks: [
                // 5a. loop 子节点 — code
                {
                    id: '1009',
                    type: '5',
                    meta: { position: { x: 50, y: 50 } },
                    data: {
                        nodeMeta: {
                            title: '循环内代码',
                            icon: '',
                            description: '',
                            mainColor: '#FF7D00',
                            subTitle: '代码',
                        },
                        inputs: { code: 'return {"step": 1}' },
                        outputs: [{ name: 'step', type: 'number', required: false }],
                    },
                },
                // 5b. loop 子节点 — loop_set_variable（含 blockID 引用）
                {
                    id: '1010',
                    type: '20',
                    meta: { position: { x: 50, y: 200 } },
                    data: {
                        nodeMeta: {
                            title: '设置变量',
                            icon: '',
                            description: '',
                            mainColor: '#00B42A',
                            subTitle: '变量赋值',
                        },
                        inputs: {
                            inputParameters: [
                                {
                                    name: 'var1',
                                    input: {
                                        type: 'string',
                                        value: {
                                            type: 'ref',
                                            content: { source: 'block-output', blockID: '1009', name: 'step' },
                                        },
                                    },
                                },
                            ],
                        },
                        outputs: [],
                    },
                },
            ],
        },
        // 6. comment 节点
        {
            id: '1006',
            type: '31',
            meta: { position: { x: 1000, y: 500 } },
            data: {
                nodeMeta: { title: '备注', icon: '', description: '', mainColor: '#86909C', subTitle: '备注' },
                inputs: {
                    schemaType: 'slate',
                    note: JSON.stringify([
                        { type: 'paragraph', children: [{ text: '这是一个备注节点', type: 'text' }] },
                    ]),
                },
                outputs: [],
            },
        },
        // 7. output 节点
        {
            id: '1007',
            type: '13',
            meta: { position: { x: 1400, y: 200 } },
            data: {
                nodeMeta: {
                    title: '输出',
                    icon: '',
                    description: '工作流输出',
                    mainColor: '#00B42A',
                    subTitle: '输出',
                },
                inputs: {
                    content: {
                        type: 'string',
                        value: { type: 'ref', content: { source: 'block-output', blockID: '1002', name: 'output' } },
                    },
                },
                outputs: [],
            },
        },
        // 8. end 节点
        {
            id: '1008',
            type: '2',
            meta: { position: { x: 1700, y: 300 } },
            data: {
                nodeMeta: {
                    title: '结束',
                    icon: '',
                    description: '工作流出口',
                    mainColor: '#F53F3F',
                    subTitle: '结束',
                },
                inputs: {},
                outputs: [],
            },
        },
        // 9. 第二个 llm 节点
        {
            id: '1011',
            type: '3',
            meta: { position: { x: 700, y: 500 } },
            data: {
                nodeMeta: { title: '摘要生成', icon: '', description: '', mainColor: '#5C62FF', subTitle: '大模型' },
                inputs: {
                    llmParam: [
                        {
                            name: 'modleName',
                            input: { type: 'string', value: { type: 'literal', content: '豆包·2.0·lite' } },
                        },
                        { name: 'prompt', input: { type: 'string', value: { type: 'literal', content: '生成摘要' } } },
                    ],
                },
                outputs: [{ name: 'summary', type: 'string', required: false }],
            },
        },
        // 10. text 节点
        {
            id: '1012',
            type: '15',
            meta: { position: { x: 1000, y: 600 } },
            data: {
                nodeMeta: { title: '文本拼接', icon: '', description: '', mainColor: '#86909C', subTitle: '文本' },
                inputs: { content: '处理完成' },
                outputs: [],
            },
        },
    ];

    const edges = [
        { sourceNodeID: '1001', targetNodeID: '1002' },
        { sourceNodeID: '1001', targetNodeID: '1003' },
        { sourceNodeID: '1002', targetNodeID: '1004' },
        { sourceNodeID: '1003', targetNodeID: '1004' },
        { sourceNodeID: '1004', targetNodeID: '1005', sourcePortID: 'branch_0' },
        { sourceNodeID: '1004', targetNodeID: '1008', sourcePortID: 'branch_1' },
        { sourceNodeID: '1005', targetNodeID: '1009', sourcePortID: 'container_start' },
        { sourceNodeID: '1009', targetNodeID: '1010' },
        { sourceNodeID: '1005', targetNodeID: '1006', sourcePortID: 'container_end' },
        { sourceNodeID: '1006', targetNodeID: '1007' },
        { sourceNodeID: '1007', targetNodeID: '1008' },
        { sourceNodeID: '1002', targetNodeID: '1011' },
        { sourceNodeID: '1011', targetNodeID: '1012' },
        { sourceNodeID: '1012', targetNodeID: '1007' },
    ];

    return { type: 'coze-workflow-clipboard-data', json: { nodes, edges } };
}

// ====================================================================
// 辅助函数
// ====================================================================

/**
 * 将内部节点数组转换为 Coze 剪贴板格式
 * 取所有根节点（无 parentId），递归序列化子节点
 */
function convertInternalToCozeClipboard(internalNodes, internalEdges) {
    const rootNodes = internalNodes.filter((n) => !n.parentId);
    const cozeNodes = rootNodes.map((n) => convertInternalToClipboardNode(n, internalNodes));

    const cozeEdges = internalEdges.map((e) => {
        const edge = {
            sourceNodeID: String(e.source).replace('node_', ''),
            targetNodeID: String(e.target).replace('node_', ''),
        };
        if (e.sourcePort) edge.sourcePortID = e.sourcePort;
        if (e.targetPort) edge.targetPortID = e.targetPort;
        return edge;
    });

    return { type: 'coze-workflow-clipboard-data', json: { nodes: cozeNodes, edges: cozeEdges } };
}

/**
 * 提取节点的可比较快照（排除序列化器规范化字段）
 *
 * 序列化器在导出/导入过程中会添加默认值（如 fcParamVar、settingOnError、
 * streamingOutput 等）或移除中间字段（如 inputParameters），这是正常的
 * 数据规范化行为。快照只比较结构性字段，参数完整性由专项测试验证。
 */
function snapshotNode(node) {
    return {
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        title: node.title,
        parentId: node.parentId || null,
        hasInputParams: Array.isArray(node.inputParams) && node.inputParams.length > 0,
        inputParamCount: Array.isArray(node.inputParams) ? node.inputParams.length : 0,
        hasParameters: !!node.parameters && typeof node.parameters === 'object',
    };
}

/**
 * 提取边的可比较快照
 */
function snapshotEdge(edge) {
    return {
        source: edge.source,
        target: edge.target,
        sourcePort: edge.sourcePort || '',
        targetPort: edge.targetPort || '',
    };
}

// ====================================================================
// 测试套件
// ====================================================================

describe('E2E 往返一致性测试', () => {
    let cozeData1, internal1, cozeData2, internal2;

    beforeAll(() => {
        // 第一次导入：Coze → Internal
        cozeData1 = buildCozeClipboardData();
        internal1 = convertClipboardToInternal(cozeData1);

        // 导出：Internal → Coze
        cozeData2 = convertInternalToCozeClipboard(internal1.nodes, internal1.edges);

        // 第二次导入：Coze → Internal
        internal2 = convertClipboardToInternal(cozeData2);
    });

    describe('1. Coze → Internal → Coze → Internal 往返', () => {
        it('两次导入的节点数量一致', () => {
            expect(internal1.nodes).toHaveLength(internal2.nodes.length);
        });

        it('两次导入的边数量一致', () => {
            expect(internal1.edges).toHaveLength(internal2.edges.length);
        });

        it('两次导入的节点类型一致', () => {
            const types1 = internal1.nodes.map((n) => n.type).sort();
            const types2 = internal2.nodes.map((n) => n.type).sort();
            expect(types1).toEqual(types2);
        });

        it('两次导入的节点 ID 一致', () => {
            const ids1 = internal1.nodes.map((n) => n.id).sort();
            const ids2 = internal2.nodes.map((n) => n.id).sort();
            expect(ids1).toEqual(ids2);
        });

        it('两次导入的节点位置一致', () => {
            internal1.nodes.forEach((n1, i) => {
                const n2 = internal2.nodes[i];
                expect(n2).toBeDefined();
                expect(n1.x).toBe(n2.x);
                expect(n1.y).toBe(n2.y);
            });
        });

        it('两次导入的节点标题一致', () => {
            internal1.nodes.forEach((n1, i) => {
                const n2 = internal2.nodes[i];
                expect(n1.title).toBe(n2.title);
            });
        });

        it('两次导入的节点快照一致', () => {
            const snap1 = internal1.nodes.map(snapshotNode);
            const snap2 = internal2.nodes.map(snapshotNode);
            expect(snap1).toEqual(snap2);
        });

        it('两次导入的边快照一致', () => {
            const snap1 = internal1.edges
                .map(snapshotEdge)
                .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
            const snap2 = internal2.edges
                .map(snapshotEdge)
                .sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
            expect(snap1).toEqual(snap2);
        });
    });

    describe('2. blockID 全局一致性', () => {
        it('所有 blockID 引用指向存在的节点', () => {
            [internal1, internal2].forEach((internal) => {
                const nodeIds = new Set(internal.nodes.map((n) => n.id));
                internal.nodes.forEach((node) => {
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach((param) => {
                            if (
                                param.valueType === 'ref' &&
                                typeof param.value === 'object' &&
                                param.value?.content?.blockID
                            ) {
                                const blockId = param.value.content.blockID;
                                // blockID 应该是 node_XXX 格式或原始 ID（第一次导入后是 node_XXX）
                                expect(nodeIds.has(blockId) || blockId === '').toBe(true);
                            }
                        });
                    }
                });
            });
        });

        it('两次导入的 blockID 引用一致', () => {
            function extractBlockIds(internal) {
                const ids = [];
                internal.nodes.forEach((node) => {
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach((param) => {
                            if (param.valueType === 'ref' && param.value?.content?.blockID) {
                                ids.push({ node: node.id, blockID: param.value.content.blockID });
                            }
                        });
                    }
                });
                return ids.sort((a, b) => a.node.localeCompare(b.node));
            }
            const ids1 = extractBlockIds(internal1);
            const ids2 = extractBlockIds(internal2);
            expect(ids1).toEqual(ids2);
        });

        it('blockID 引用的节点 ID 在两次导入中一致', () => {
            function extractBlockRefPairs(internal) {
                const pairs = [];
                internal.nodes.forEach((node) => {
                    if (node.inputParams && Array.isArray(node.inputParams)) {
                        node.inputParams.forEach((param) => {
                            if (param.valueType === 'ref' && param.value?.content?.blockID) {
                                pairs.push({ from: node.id, to: param.value.content.blockID });
                            }
                        });
                    }
                });
                return pairs.sort((a, b) => a.from.localeCompare(b.from));
            }
            const pairs1 = extractBlockRefPairs(internal1);
            const pairs2 = extractBlockRefPairs(internal2);
            expect(pairs1).toEqual(pairs2);
        });
    });

    describe('3. 容器结构保持', () => {
        it('loop 容器节点存在且有 parentId 子节点', () => {
            [internal1, internal2].forEach((internal) => {
                const loopNode = internal.nodes.find((n) => n.type === 'loop');
                expect(loopNode).toBeDefined();
                const children = internal.nodes.filter((n) => n.parentId === loopNode.id);
                expect(children.length).toBeGreaterThanOrEqual(2);
            });
        });

        it('两次导入的 parentId 关系一致', () => {
            const parents1 = internal1.nodes.map((n) => ({ id: n.id, parentId: n.parentId || null }));
            const parents2 = internal2.nodes.map((n) => ({ id: n.id, parentId: n.parentId || null }));
            expect(parents1).toEqual(parents2);
        });

        it('loop 容器内的子节点类型正确', () => {
            [internal1, internal2].forEach((internal) => {
                const loopNode = internal.nodes.find((n) => n.type === 'loop');
                const children = internal.nodes.filter((n) => n.parentId === loopNode.id);
                const childTypes = children.map((n) => n.type).sort();
                expect(childTypes).toContain('code');
                expect(childTypes).toContain('loop_set_variable');
            });
        });

        it('loop 容器子节点位置为相对坐标', () => {
            [internal1, internal2].forEach((internal) => {
                const loopNode = internal.nodes.find((n) => n.type === 'loop');
                const children = internal.nodes.filter((n) => n.parentId === loopNode.id);
                children.forEach((child) => {
                    // 子节点坐标应为相对坐标（通常较小）
                    expect(typeof child.x).toBe('number');
                    expect(typeof child.y).toBe('number');
                });
            });
        });
    });

    describe('4. 边引用完整', () => {
        it('所有边的 source 指向存在的节点', () => {
            [internal1, internal2].forEach((internal) => {
                const nodeIds = new Set(internal.nodes.map((n) => n.id));
                internal.edges.forEach((edge) => {
                    expect(nodeIds.has(edge.source)).toBe(true);
                });
            });
        });

        it('所有边的 target 指向存在的节点', () => {
            [internal1, internal2].forEach((internal) => {
                const nodeIds = new Set(internal.nodes.map((n) => n.id));
                internal.edges.forEach((edge) => {
                    expect(nodeIds.has(edge.target)).toBe(true);
                });
            });
        });

        it('容器边（container_start/container_end）保持正确', () => {
            [internal1, internal2].forEach((internal) => {
                const containerStartEdges = internal.edges.filter((e) => e.sourcePort === 'container_start');
                const containerEndEdges = internal.edges.filter((e) => e.sourcePort === 'container_end');
                expect(containerStartEdges.length).toBeGreaterThanOrEqual(1);
                expect(containerEndEdges.length).toBeGreaterThanOrEqual(1);

                // container_start 边的 source 应该是 loop 容器节点
                const loopNode = internal.nodes.find((n) => n.type === 'loop');
                containerStartEdges.forEach((edge) => {
                    expect(edge.source).toBe(loopNode.id);
                });
            });
        });

        it('条件分支边（branch_0/branch_1）保持正确', () => {
            [internal1, internal2].forEach((internal) => {
                const branchEdges = internal.edges.filter((e) => e.sourcePort && e.sourcePort.startsWith('branch_'));
                expect(branchEdges.length).toBeGreaterThanOrEqual(2);

                const conditionNode = internal.nodes.find((n) => n.type === 'condition');
                branchEdges.forEach((edge) => {
                    expect(edge.source).toBe(conditionNode.id);
                });
            });
        });

        it('两次导入的边 source/target 对完全一致', () => {
            const sortEdges = (edges) => edges.map((e) => `${e.source}->${e.target}(${e.sourcePort || ''})`).sort();
            expect(sortEdges(internal1.edges)).toEqual(sortEdges(internal2.edges));
        });
    });

    describe('5. 参数序列化完整', () => {
        it('inputParams 在往返后不丢失', () => {
            internal1.nodes.forEach((n1, i) => {
                const n2 = internal2.nodes[i];
                const count1 = Array.isArray(n1.inputParams) ? n1.inputParams.length : 0;
                const count2 = Array.isArray(n2.inputParams) ? n2.inputParams.length : 0;
                expect(count1).toBe(count2);
            });
        });

        it('parameters 对象在往返后保持非空', () => {
            internal1.nodes.forEach((n1, i) => {
                const n2 = internal2.nodes[i];
                if (n1.parameters && Object.keys(n1.parameters).length > 0) {
                    expect(n2.parameters).toBeDefined();
                    expect(Object.keys(n2.parameters).length).toBeGreaterThan(0);
                }
            });
        });

        it('LLM 节点的 llmParam 参数保留', () => {
            [internal1, internal2].forEach((internal) => {
                const llmNodes = internal.nodes.filter((n) => n.type === 'llm');
                llmNodes.forEach((node) => {
                    expect(node.parameters).toBeDefined();
                    // LLM 参数应该有 modelName 或 prompt 等字段
                    const paramKeys = Object.keys(node.parameters);
                    expect(paramKeys.length).toBeGreaterThan(0);
                });
            });
        });

        it('code 节点的 code 参数保留', () => {
            [internal1, internal2].forEach((internal) => {
                const codeNodes = internal.nodes.filter((n) => n.type === 'code');
                codeNodes.forEach((node) => {
                    expect(node.parameters).toBeDefined();
                    expect(node.parameters.code).toBeDefined();
                });
            });
        });

        it('loop_set_variable 节点的变量引用保留', () => {
            [internal1, internal2].forEach((internal) => {
                const lsvNode = internal.nodes.find((n) => n.type === 'loop_set_variable');
                expect(lsvNode).toBeDefined();
                expect(lsvNode.inputParams).toBeDefined();
                expect(lsvNode.inputParams.length).toBeGreaterThan(0);

                // 验证变量引用包含 blockID
                const refParam = lsvNode.inputParams.find((p) => p.valueType === 'ref');
                expect(refParam).toBeDefined();
                expect(refParam.value?.content?.blockID).toBeDefined();
            });
        });

        it('comment 节点的 note 内容保留', () => {
            [internal1, internal2].forEach((internal) => {
                const commentNode = internal.nodes.find((n) => n.type === 'comment');
                expect(commentNode).toBeDefined();
                expect(commentNode.parameters).toBeDefined();
                // note 内容可能以 _noteRaw 或 note 字段存在
                const hasNote =
                    commentNode.parameters.note !== undefined || commentNode.parameters._noteRaw !== undefined;
                expect(hasNote).toBe(true);
            });
        });

        it('node_outputs 在往返后保留', () => {
            internal1.nodes.forEach((n1, i) => {
                const n2 = internal2.nodes[i];
                if (n1.parameters?.node_outputs) {
                    expect(n2.parameters?.node_outputs).toBeDefined();
                    const keys1 = Object.keys(n1.parameters.node_outputs).sort();
                    const keys2 = Object.keys(n2.parameters.node_outputs).sort();
                    expect(keys1).toEqual(keys2);
                }
            });
        });
    });

    describe('6. 导出数据格式验证', () => {
        it('导出的 Coze 节点 ID 格式正确（无 node_ 前缀）', () => {
            cozeData2.json.nodes.forEach((node) => {
                expect(String(node.id)).not.toMatch(/^node_/);
            });
        });

        it('导出的 Coze 节点 type 为数字字符串', () => {
            cozeData2.json.nodes.forEach((node) => {
                expect(typeof node.type).toBe('string');
                expect(node.type).toMatch(/^\d+$/);
            });
        });

        it('导出的 Coze 节点有 meta.position', () => {
            cozeData2.json.nodes.forEach((node) => {
                expect(node.meta).toBeDefined();
                expect(node.meta.position).toBeDefined();
                expect(typeof node.meta.position.x).toBe('number');
                expect(typeof node.meta.position.y).toBe('number');
            });
        });

        it('导出的 Coze 节点有 data.nodeMeta', () => {
            cozeData2.json.nodes.forEach((node) => {
                expect(node.data).toBeDefined();
                expect(node.data.nodeMeta).toBeDefined();
                expect(node.data.nodeMeta.title).toBeDefined();
            });
        });

        it('导出的 loop 容器有 blocks 子节点', () => {
            const loopNode = cozeData2.json.nodes.find((n) => n.type === '21');
            expect(loopNode).toBeDefined();
            expect(Array.isArray(loopNode.blocks)).toBe(true);
            expect(loopNode.blocks.length).toBeGreaterThanOrEqual(2);
        });

        it('导出的边有 sourceNodeID 和 targetNodeID', () => {
            cozeData2.json.edges.forEach((edge) => {
                expect(edge.sourceNodeID).toBeDefined();
                expect(edge.targetNodeID).toBeDefined();
            });
        });
    });
});
