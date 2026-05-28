import { TYPE_MAP, getMainColor, getSubTitle, getBounds, clearRefCache } from "../utils/types.js";
import { buildOutputMap } from "../components/outputMapper.js";
import { convertInputParameters } from "../components/inputMapper.js";
import { nodeHandlers } from "../components/nodeHandlers.js";
import { validateYamlInput, convertEdges } from "../utils/utils.js";

const DEFAULT_TITLES = { start: "开始", end: "结束" };

function getNodeDefaultTitle(type) {
    return DEFAULT_TITLES[type] || "节点";
}

function processPluginNode(data, nodeMeta, params) {
    const apiParam = params.apiParam;
    if (data.nodeMeta?.subTitle === "plugin" && apiParam) {
        const pluginName = apiParam.find(p => p.name === "pluginName")?.input?.value?.content;
        const apiName = apiParam.find(p => p.name === "apiName")?.input?.value?.content;
        if (pluginName && apiName) nodeMeta.subtitle = `${pluginName}:${apiName}`;
        delete nodeMeta.subTitle;
    }
}

function buildExternalData(node, type, params) {
    const ext = { icon: node.icon || "", description: node.description || "", title: node.title || "", mainColor: getMainColor(type) };
    if (type === "plugin" && params.apiParam) {
        const pid = params.apiParam.find(p => p.name === "pluginID");
        if (pid) ext.pluginID = pid.input?.value;
    }
    return ext;
}

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
    return { x: minX - 180, y: minY - 20, width: maxX - minX + 720, height: maxY - minY + 140 };
}

export function convertNode(node, outputMap) {
    const id = String(node.id);
    const type = node.type.toLowerCase();
    const mapped = TYPE_MAP[type] || "5";
    
    const pos = node.position;
    const meta = { position: pos || { x: 0, y: 0 } };
    if (node.canvas_position) meta.canvasPosition = node.canvas_position;

    const nodeMeta = {
        title: node.title || getNodeDefaultTitle(type),
        icon: node.icon || "",
        description: node.description || "",
        mainColor: getMainColor(type),
        subTitle: getSubTitle(type)
    };
    
    const data = { nodeMeta };
    const params = node.parameters || {};
    const inputParams = convertInputParameters(params.node_inputs, outputMap, type);
    
    const handler = nodeHandlers[type] || nodeHandlers.default;
    handler(data, params, { node, outputMap, inputParams, convertNode });

    processPluginNode(data, nodeMeta, params);
    
    const blocks = data.blocks;
    const edges = data.edges;
    delete data.blocks;
    delete data.edges;
    
    const result = {
        id, type: mapped, meta, data,
        _temp: { bounds: getBounds(node), externalData: buildExternalData(node, type, params) }
    };
    
    if (blocks && blocks.length) result.blocks = blocks;
    if (edges && edges.length) result.edges = edges;
    
    return result;
}

export function convertYamlToClipboard(yaml) {
    validateYamlInput(yaml);
    const outputMap = buildOutputMap(yaml.nodes);
    const newNodes = yaml.nodes.map(n => convertNode(n, outputMap));
    
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