// @ts-nocheck
/**
 * 工作流转换器模块
 * 负责将YAML格式的工作流定义转换为Coze剪贴板格式
 * 支持22种节点类型的转换，包括start、end、llm、plugin、code等
 */
import { TYPE_MAP, getMainColor, getSubTitle, getBounds, clearRefCache } from "../utils/types.js";
import { buildOutputMap } from "../components/outputMapper.js";
import { convertInputParameters } from "../components/inputMapper.js";
import { nodeHandlers } from "../components/nodeHandlers.js";
import { validateYamlInput, convertEdges, cleanIcon } from "../utils/utils.js";

/**
 * 默认节点标题映射
 * @type {Object.<string, string>}
 */
const DEFAULT_TITLES = { start: "开始", end: "结束" };

/**
 * 获取节点默认标题
 * @param {string} type - 节点类型
 * @returns {string} 默认标题
 */
function getNodeDefaultTitle(type) {
    return DEFAULT_TITLES[type] || "节点";
}

/**
 * 处理插件节点的特殊逻辑
 * @param {object} data - 节点数据对象
 * @param {object} nodeMeta - 节点元数据
 * @param {object} params - 节点参数
 * @param {string} type - 节点类型
 */
function processPluginNode(data, nodeMeta, params, type) {
    const apiParam = params.apiParam;
    if (type === "plugin" && apiParam) {
        const pluginName = apiParam.find(p => p.name === "pluginName")?.input?.value?.content;
        const apiName = apiParam.find(p => p.name === "apiName")?.input?.value?.content;
        if (pluginName && apiName) nodeMeta.subtitle = `${pluginName}:${apiName}`;
        delete nodeMeta.subTitle;
    }
}

/**
 * 构建节点元数据
 * @param {object} node - 原始节点对象
 * @param {string} type - 节点类型
 * @returns {object} 节点元数据对象
 */
function buildNodeMeta(node, type) {
    return {
        title: node.title || getNodeDefaultTitle(type),
        icon: cleanIcon(node.icon),
        description: node.description || "",
        mainColor: getMainColor(type),
        subTitle: getSubTitle(type)
    };
}

/**
 * 构建外部数据对象
 * @param {object} node - 原始节点对象
 * @param {string} type - 节点类型
 * @param {object} params - 节点参数
 * @returns {object} 外部数据对象
 */
function buildExternalData(node, type, params) {
    const ext = { icon: cleanIcon(node.icon), description: node.description || "", title: node.title || "", mainColor: getMainColor(type) };
    if (type === "plugin" && params.apiParam) {
        const pid = params.apiParam.find(p => p.name === "pluginID");
        if (pid) ext.pluginID = pid.input?.value;
    }
    return ext;
}

/**
 * 计算工作流边界
 * @param {Array} nodes - 节点数组
 * @returns {object} 边界对象 { x, y, width, height }
 */
function calculateBounds(nodes) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const len = nodes.length;
    for (let i = 0; i < len; i++) {
        const n = nodes[i];
        const x = n.meta.position?.x ?? 0;
        const y = n.meta.position?.y ?? 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    if (!isFinite(minX)) minX = 0;
    if (!isFinite(minY)) minY = 0;
    return { x: minX - 200, y: minY - 20, width: maxX - minX + 800, height: maxY - minY + 140 };
}

/**
 * 转换单个节点
 * @param {object} node - 原始YAML节点对象
 * @param {Map} outputMap - 输出映射表
 * @returns {object} Coze格式的节点对象
 */
export function convertNode(node, outputMap) {
    const id = String(node.id);
    const type = node.type.toLowerCase();
    const mapped = TYPE_MAP[type] || "5";
    
    const pos = node.position;
    const meta = { position: pos || { x: 0, y: 0 } };
    if (node.canvas_position) meta.canvasPosition = node.canvas_position;

    const params = node.parameters || {};
    const inputParams = convertInputParameters(params.node_inputs, outputMap, type);
    
    const inputs = {};
    const outputs = [];
    const handlerData = { inputs, outputs };
    const handler = nodeHandlers[type] || nodeHandlers.default;
    handler(handlerData, params, { node, outputMap, inputParams, convertNode });
    
    const data = {
        inputs: handlerData.inputs,
        nodeMeta: buildNodeMeta(node, type),
        outputs: handlerData.outputs,
        blocks: handlerData.blocks,
        edges: handlerData.edges
    };

    processPluginNode(data, data.nodeMeta, params, type);
    
    const blocks = data.blocks;
    const edges = data.edges;
    delete data.blocks;
    delete data.edges;
    
    if (data.outputs && data.outputs.length > 0) {
        const outputOrder = ['optionId', 'optionContent', 'QUESTION_DATA'];
        data.outputs.sort((a, b) => {
            const idxA = outputOrder.indexOf(a.name);
            const idxB = outputOrder.indexOf(b.name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
        });
    }
    
    const result = {
        id, type: mapped, meta, data,
        _temp: { bounds: getBounds(node), externalData: buildExternalData(node, type, params) }
    };
    
    if (blocks && blocks.length) result.blocks = blocks;
    if (edges && edges.length) result.edges = edges;
    
    return result;
}

/**
 * 在原始YAML文本中查找节点的近似行号
 * @param {string} rawYaml - 原始YAML文本
 * @param {object} node - 节点对象
 * @returns {number|null} 近似行号（1-based），找不到返回null
 */
function findNodeLineInYaml(rawYaml, node) {
    if (!rawYaml) return null;
    const lines = rawYaml.split('\n');
    const searchId = node.id != null ? String(node.id) : null;
    const searchTitle = node.title;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (searchId && (line === `id: ${searchId}` || line.startsWith(`id: ${searchId}`))) {
            return i + 1;
        }
        if (searchTitle && line === `title: ${searchTitle}`) {
            return i + 1;
        }
    }
    return null;
}

/**
 * 将YAML格式转换为Coze剪贴板格式
 * 
 * @param {object} yaml - YAML解析后的工作流对象
 * @param {object} yaml.id - 工作流ID
 * @param {string} [yaml.name] - 工作流名称
 * @param {Array} yaml.nodes - 节点数组
 * @param {Array} [yaml.edges] - 连线数组
 * @param {string} [rawYaml] - 原始YAML文本（用于错误定位行号）
 * @returns {object} Coze剪贴板格式数据
 * @throws {Error} 当转换失败时，错误消息包含节点信息和行号
 */
export function convertYamlToClipboard(yaml, rawYaml) {
    validateYamlInput(yaml);
    const outputMap = buildOutputMap(yaml.nodes);

    const newNodes = [];
    for (const n of yaml.nodes) {
        try {
            const converted = convertNode(n, outputMap);
            newNodes.push(converted);
        } catch (e) {
            const line = findNodeLineInYaml(rawYaml, n);
            const lineInfo = line ? `（第 ${line} 行附近）` : '';
            const nodeInfo = `节点 [${n.title || ''}] (id: ${n.id}, type: ${n.type})${lineInfo}`;
            const enrichedError = new Error(`${nodeInfo} 转换失败: ${e.message}`);
            enrichedError.nodeInfo = { id: n.id, title: n.title, type: n.type, line };
            throw enrichedError;
        }
    }

    clearRefCache();
    
    return {
        type: "coze-workflow-clipboard-data",
        source: {
            workflowId: yaml.id ? String(yaml.id) : "imported_workflow",
            flowMode: 0,
            spaceId: "imported_space",
            isDouyin: false,
            host: "www.coze.cn"
        },
        json: { nodes: newNodes, edges: convertEdges(yaml.edges || []), name: yaml.name || yaml.id || "imported_workflow" },
        bounds: calculateBounds(newNodes)
    };
}