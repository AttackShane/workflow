/**
 * 工作流逆向转换器模块
 * 负责将 Coze 剪贴板格式反向转换为 YAML 格式的工作流定义
 * 与 converter.js 互为逆向，支持 22 种节点类型的反向转换
 *
 * 转换链路：
 *   导入: Coze YAML → converter.js (convertYamlToClipboard) → 剪贴板格式 → shared-serializer.js (convertClipboardToInternal) → 内部格式
 *   导出: 内部格式 → shared-serializer.js (convertInternalToClipboardNode) → 剪贴板格式 → converter-reverse.js (convertClipboardToYaml) → Coze YAML
 *
 * @module converter-reverse
 */

import { REV_TYPE_MAP } from '../../utils/types.js';
import { validateClipboardInput, convertEdgesReverse } from '../../utils/utils.js';
import { Logger } from '../../utils/logger.js';

/**
 * 各节点类型需要逆向处理的参数白名单
 * - key: Coze 节点类型名（如 "llm", "loop", "batch"）
 * - value: 该类型需要在逆向转换时特殊处理的参数名数组
 * - common: 所有节点类型通用的参数
 *
 * @type {Object<string, string[]>}
 */
const TYPE_PARAMS_MAP = {
    code: ['code', 'language'],
    llm: ['llmParam'],
    image_generate: ['modelSetting', 'prompt', 'references'],
    video_generation: ['duration', 'model', 'prompt', 'cameraFixed', 'generateAudio', 'generateMode', 'firstFrame', 'ratio', 'resolution', 'seed', 'watermark', 'dynamicParameters'],
    condition: ['branches'],
    plugin: ['apiParam'],
    loop: ['loopType', 'loopCount', 'loopItems', 'iterationVariable', 'variableParameters'],
    batch: ['batchSize', 'concurrentSize'],
    comment: ['note', 'schemaType'],
    text: ['concatParams', 'method'],
    variable_merge: ['mergeGroups'],
    variable_assign: ['variableName', 'variableValue'],
    http: ['url', 'method', 'headers', 'body', 'authType', 'authParams'],
    knowledge_query: ['knowledgeBaseId', 'query', 'topK'],
    intent: ['intentConfig'],
    async_task: ['taskConfig'],
    question: ['llmParam', 'extra_output', 'answer_type', 'option_type', 'dynamic_option', 'options', 'limit'],
    output: ['streamingOutput', 'callTransferVoice', 'chatHistoryWriting', 'content'],
    input: ['outputSchema'],
    common: ['settingOnError']
};

/**
 * 递归转换参数值：将剪贴板格式的值还原为 Coze YAML 格式
 *
 * 处理规则：
 * - null/undefined → null
 * - 字符串 → 原样返回
 * - ref 类型 { type:"ref", content:{ name, blockID, source } } → { path, ref_node, source }
 * - literal 类型 { type:"literal", content } → 默认返回 content（去包装），keepLiteral=true 时保留包装
 * - 数组 → 递归转换每个元素
 * - 对象 → 递归转换每个属性
 *
 * @param {*} val - 待转换的值
 * @param {*} [options] - 转换选项，支持 keepLiteral 和 keepRawMeta
 * @returns {*} 转换后的值
 */
function convertValue(val, options = {}) {
    const { keepLiteral = false, keepRawMeta = false } = options;

    if (val === null || val === undefined) return null;

    if (typeof val === 'string') {
        return val;
    }

    if (typeof val !== 'object') return val;

    if (val.type === 'ref' && val.content) {
        const result = { path: val.content.name, ref_node: val.content.blockID };
        if (val.content.source) result.source = val.content.source;
        return result;
    }

    if (val.type === 'literal') {
        if (keepLiteral) {
            return keepRawMeta && val.rawMeta
                ? { type: 'literal', content: val.content, rawMeta: val.rawMeta }
                : { type: 'literal', content: val.content };
        }
        return val.content;
    }

    if (Array.isArray(val)) {
        return val.map(v => convertValue(v, options));
    }

    const result = {};
    for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
            result[key] = convertValue(val[key], options);
        }
    }
    return result;
}

/**
 * 构建节点输出定义
 *
 * 两种输出结构：
 * 1. 循环/批处理节点：使用 input 字段，含 items schema
 * 2. 普通节点：type/required/description + defaultValue/schema
 *
 * @param {object} o - 输出描述对象
 * @param {object} [o.input] - 循环/批处理节点的输入描述
 * @param {string} [o.type] - 输出类型
 * @param {boolean} [o.required] - 是否必填
 * @param {string} [o.description] - 描述
 * @param {*} [o.defaultValue] - 默认值
 * @param {object} [o.schema] - 列表类型的子项 schema
 * @param {*} [o.value] - 引用值
 * @returns {object} YAML 格式的输出定义
 */
function buildOutputDefinition(o) {
    if (o.input) {
        const input = o.input;
        const def = { type: input.type || 'string', required: o.required || false, description: o.description || '' };

        if (input.type === 'list' && input.schema) {
            def.items = { type: input.schema.type || 'string' };
        }

        if (input.value && input.value.type === 'ref' && input.value.content) {
            def.value = {
                path: input.value.content.name,
                ref_node: input.value.content.blockID,
                source: input.value.content.source
            };
        } else {
            def.value = null;
        }

        return def;
    }

    const def = { type: o.type || 'string', required: o.required || false, description: o.description || '' };
    if (o.defaultValue !== undefined) def.default_value = o.defaultValue;
    if (o.schema) {
        def.items = { type: o.schema.type || 'string' };
        if (o.schema.properties) {
            def.items.properties = o.schema.properties;
            Object.keys(def.items.properties).forEach(key => {
                if (def.items.properties[key].value === undefined) {
                    def.items.properties[key].value = null;
                }
            });
        }
    }
    if (o.value === null || o.value) {
        def.value = o.value;
    } else {
        def.value = null;
    }
    return def;
}

/**
 * 逆向转换单个节点：从剪贴板格式还原为 Coze YAML 格式
 *
 * 处理流程：
 * 1. 类型映射（REV_TYPE_MAP：数字 → 字符串）
 * 2. 提取位置、标题、图标、描述、颜色
 * 3. 转换输入参数（node_inputs）
 * 4. 转换输出参数（node_outputs）
 * 5. 按节点类型处理专属参数（llmParam、loopCount、batchSize 等）
 * 6. 处理公共参数（settingOnError）
 * 7. 递归处理嵌套节点（循环/批处理内的 nodes 和 edges）
 *
 * @param {object} node - 剪贴板格式节点
 * @param {string|number} node.id - 节点 ID
 * @param {string|number} node.type - Coze 类型号
 * @param {object} [node.meta] - 元数据（position, canvasPosition）
 * @param {object} [node.data] - 节点数据（nodeMeta, inputs, outputs, blocks）
 * @param {object[]} [node.blocks] - 嵌套子节点
 * @param {object[]} [node.edges] - 嵌套边
 * @returns {object} YAML 格式节点
 */
function revNode(node) {
    const id = String(node.id);
    const mappedType = REV_TYPE_MAP[node.type];
    if (!mappedType) {
        Logger.warn(`Unknown node type "${node.type}" in reverse conversion, falling back to plugin`);
    }
    const type = mappedType || 'plugin';

    const pos = node.meta?.position || { x: 0, y: 0 };
    const yNode = {
        id,
        type,
        title: node.data?.nodeMeta?.title || '',
        icon: node.data?.nodeMeta?.icon || '',
        description: node.data?.nodeMeta?.description || '',
        position: {
            x: typeof pos.x === 'number' ? pos.x : 0,
            y: typeof pos.y === 'number' ? pos.y : 0
        }
    };

    if (node.meta?.canvasPosition) yNode.canvas_position = node.meta.canvasPosition;
    if (node.data?.nodeMeta?.mainColor) yNode.color = node.data.nodeMeta.mainColor;

    const params = {};
    const data = node.data || {};

    if (data.inputs?.inputParameters && Array.isArray(data.inputs.inputParameters) && data.inputs.inputParameters.length > 0) {
        params.node_inputs = data.inputs.inputParameters.map(ip => ({
            name: ip.name,
            input: {
                type: ip.input?.type || 'literal',
                value: convertValue(ip.input?.value)
            }
        }));
    }

    if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
        params.node_outputs = {};
        data.outputs.forEach(o => {
            params.node_outputs[o.name] = buildOutputDefinition(o);
        });
    }

    (TYPE_PARAMS_MAP[type] || []).forEach(param => {
        if (data.inputs?.[param] !== undefined) {
            const rawValue = data.inputs[param];
            if (Array.isArray(rawValue) && param === 'llmParam') {
                params[param] = rawValue.map(item => ({
                    name: item.name,
                    input: {
                        type: item.input?.type || 'literal',
                        value: convertValue(item.input?.value)
                    }
                }));
            } else if (param === 'llmParam' && typeof rawValue === 'object' && rawValue !== null) {
                params[param] = convertValue(rawValue);
            } else if ((type === 'loop' && (param === 'loopCount' || param === 'loopItems')) ||
                   (type === 'batch' && (param === 'batchSize' || param === 'concurrentSize'))) {
                if (rawValue.type && rawValue.value !== undefined) {
                    params[param] = {
                        type: rawValue.type,
                        value: convertValue(rawValue.value, { keepLiteral: true, keepRawMeta: true })
                    };
                } else {
                    params[param] = convertValue(rawValue, { keepLiteral: true, keepRawMeta: true });
                }
            } else {
                params[param] = convertValue(rawValue);
            }
        }
    });

    TYPE_PARAMS_MAP.common.forEach(param => {
        if (data.inputs?.[param] !== undefined) {
            params[param] = convertValue(data.inputs[param]);
        }
    });

    if (type === 'end' && data.inputs?.terminatePlan !== undefined) {
        params.terminatePlan = convertValue(data.inputs.terminatePlan);
    }
    if (type === 'comment' && data.size !== undefined) {
        yNode.size = data.size;
    }

    if (node.blocks?.length) {
        yNode.nodes = node.blocks.map(b => revNode(b));
    }

    if (node.edges?.length) {
        yNode.edges = node.edges.map(e => {
            const edge = {
                source_node: String(e.sourceNodeID),
                target_node: String(e.targetNodeID)
            };
            if (e.sourcePortID !== undefined) edge.source_port = String(e.sourcePortID);
            if (e.targetPortID !== undefined) edge.target_port = String(e.targetPortID);
            return edge;
        });
    }

    if (Object.keys(params).length > 0) {
        yNode.parameters = params;
    }

    return yNode;
}

/**
 * 将 Coze 剪贴板格式转换为 YAML 格式的工作流定义
 * 与 converter.js 的 convertYamlToClipboard 互为逆向
 *
 * @param {object} clip - 剪贴板格式数据
 * @param {string} clip.type - 固定为 "coze-workflow-clipboard-data"
 * @param {object} clip.source - 源信息（workflowId 等）
 * @param {object} clip.json - 工作流数据
 * @param {string} clip.json.name - 工作流名称
 * @param {object[]} clip.json.nodes - 剪贴板格式节点数组
 * @param {object[]} clip.json.edges - 剪贴板格式边数组
 * @returns {{ schema_version: string, name: string, id: string, nodes: object[], edges: object[] }} Coze YAML 格式工作流
 */
export function convertClipboardToYaml(clip) {
    validateClipboardInput(clip);
    const json = clip.json;
    return {
        schema_version: "1.0.0",
        name: json.name || "imported_workflow",
        id: String(clip.source.workflowId),
        nodes: json.nodes.map(n => revNode(n)),
        edges: convertEdgesReverse(json.edges)
    };
}