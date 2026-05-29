// 节点尺寸常量（用于布局计算）
export const NODE_DEFAULT_WIDTH = 360;
export const NODE_DEFAULT_HEIGHT = 112;
export const NODE_QUESTION_HEIGHT = 295;
export const NODE_CENTER_OFFSET = 180;

// 语言类型常量
export const LANG_PYTHON = 5;
export const LANG_JAVASCRIPT = 6;

// 节点类型映射
export const TYPE_MAP = {
    start: "1", end: "2", llm: "3", plugin: "4", code: "5",
    condition: "8", http: "45", text: "15", image_generate: "16",
    knowledge: "17", question: "18", loop: "21", intent: "22", break: "23",
    variable_assign: "24", batch: "28", comment: "31",
    variable_merge: "32", video_generation: "65", async_task: "72",
    output: "13", input: "30"
};

// 反向类型映射（ID -> 名称）
export const REV_TYPE_MAP = Object.fromEntries(
    Object.entries(TYPE_MAP).map(([k, v]) => [v, k])
);

// 辅助类型映射
export const ASSIST_MAP = { 
    image: 2, audio: 8, video: 10, file: 1, svg: 11, voice: 12, doc: 3, ppt: 5, time: 10000 
};

// 原始类型映射
export const RAW_TYPE = {
    string: 1, integer: 2, float: 4, boolean: 3,
    stringList: 99, list: 100, objectList: 103,
    image: 7, imageList: 104, audio: 14, audioList: 105, video: 16, videoList: 107
};

// 节点能力定义
export const NODE_CAPABILITIES = {
    INHERIT_ASSIST: new Set(["llm", "code", "image_generate", "video_generation", "condition", "loop", "batch", "intent", "knowledge", "async_task"]),
    HAS_BLOCKS: new Set(["loop", "batch"]),
    HAS_OUTPUTS: new Set(["start", "llm", "code", "image_generate", "video_generation", "condition", "variable_merge", "plugin", "loop", "batch", "intent", "async_task", "http", "text", "output", "input", "question"])
};

// 兼容旧代码
export const INHERIT_ASSIST_NODES = NODE_CAPABILITIES.INHERIT_ASSIST;

// 节点名称映射（用于显示）
export const NODE_DISPLAY_NAMES = {
    start: '🚀 开始', end: '🏁 结束', llm: '🤖 大模型', plugin: '🔌 插件', code: '💻 代码',
    condition: '🔀 条件', http: '🌐 HTTP请求', text: '📝 文本', image_generate: '🎨 图像生成',
    knowledge: '📚 知识库', question: '❓ 问答', loop: '🔄 循环', intent: '🧠 意图识别', break: '⏹️ 跳出',
    variable_assign: '📦 变量赋值', batch: '📤 批处理', comment: '📝 注释',
    variable_merge: '🔗 变量聚合', video_generation: '🎬 视频生成', async_task: '⏳ 异步任务',
    output: '📤 输出', input: '📥 输入'
};

// 节点颜色映射
export const NODE_COLORS = {
    start: '#5C62FF', end: '#5C62FF', llm: '#5C62FF', plugin: '#CA61FF', code: '#00B2B2',
    condition: '#00B2B2', http: '#F59E0B', text: '#F59E0B', image_generate: '#FF4DC3',
    knowledge: '#10B981', question: '#3071F2', loop: '#00B2B2', intent: '#00B2B2', break: '#EF4444',
    variable_assign: '#8B5CF6', batch: '#00B2B2', comment: '#6B7280',
    variable_merge: '#00B2B2', video_generation: '#3071F2', async_task: '#3071F2',
    output: '#5C62FF', input: '#5C62FF'
};

// 节点高度映射（用于布局计算）
export const NODE_HEIGHTS = {
    start: 86, end: 112, comment: 150, llm: 164, code: 112,
    image_generate: 164, video_generation: 162, condition: 138,
    knowledge: 164, question: 164, loop: 138, batch: 112, intent: 176,
    async_task: 164, http: 130, output: 112, input: 86
};

export function getAssistFromType(t) {
    return t ? ASSIST_MAP[t.toLowerCase()] : undefined;
}

export function mapLang(l) {
    if (typeof l === "number") return l;
    if (typeof l === "string") {
        const ll = l.toLowerCase();
        if (ll === "python") return LANG_PYTHON;
        if (ll === "javascript") return LANG_JAVASCRIPT;
    }
    return LANG_PYTHON;
}

export function mapOutType(t) {
    return ["integer", "float", "boolean", "list", "object"].includes(t) ? t : "string";
}

export function getMainColor(t) {
    return NODE_COLORS[t?.toLowerCase()] || "#00B2B2";
}

export function getSubTitle(t) {
    const displayName = NODE_DISPLAY_NAMES[t?.toLowerCase()];
    if (displayName) {
        return displayName.replace(/^[🚀🏁🤖🔌💻🔀🌐📝🎨📚🔄🧠⏹️📦📤🔗🎬⏳📥❓] ?/, '');
    }
    return "";
}

export function getBounds(node) {
    if (!node) return { x: 0, y: 0, width: NODE_DEFAULT_WIDTH, height: NODE_DEFAULT_HEIGHT };
    
    const x = node.position?.x ?? 0;
    const y = node.position?.y ?? 0;
    const type = node.type?.toLowerCase() || "";
    
    let width = NODE_DEFAULT_WIDTH;
    let height = NODE_DEFAULT_HEIGHT;
    
    if (type === "question" || type === TYPE_MAP.question) {
        height = NODE_QUESTION_HEIGHT;
    }
    
    return { x: x - NODE_CENTER_OFFSET, y, width, height };
}

import { findRef, clearRefCache } from './refCache.js';

export { findRef, clearRefCache };

const INFER_RAW_CACHE = {
    integer: { type: RAW_TYPE.integer },
    float: { type: RAW_TYPE.float },
    boolean: { type: RAW_TYPE.boolean },
    list: { type: RAW_TYPE.list },
    object: { type: RAW_TYPE.string }
};

export function inferRawMetaFromType(type, assist) {
    if (type && INFER_RAW_CACHE[type]) return INFER_RAW_CACHE[type];
    if (assist === 2) return { type: 7 };
    if (assist === 8) return { type: 14 };
    if (assist === 10) return { type: 16 };
    return { type: 1 };
}

export function inferRawMetaFromValue(val) {
    const t = typeof val;
    if (t === "number") return { type: val % 1 === 0 ? 2 : 4 };
    if (t === "boolean") return { type: 3 };
    if (Array.isArray(val)) return { type: RAW_TYPE.list };
    return { type: 1 };
}

export function toValueObject(val) {
    if (val == null) return { type: "literal", content: "" };
    
    const ref = findRef(val);
    if (ref) {
        return {
            type: "ref",
            content: { source: "block-output", blockID: String(ref.ref_node), name: ref.path },
            rawMeta: ref.rawMeta,
            assistType: ref.assistType
        };
    }
    
    const vt = val.type;
    if (vt === "ref" || vt === "literal") return val;
    
    if (vt && val.value !== undefined) {
        return {
            type: vt,
            value: toValueObject(val.value)
        };
    }
    
    const lit = { type: "literal", content: val };
    const raw = inferRawMetaFromValue(val);
    if (raw) lit.rawMeta = raw;
    return lit;
}