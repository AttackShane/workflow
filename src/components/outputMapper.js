import { getAssistFromType, inferRawMetaFromType, mapOutType, RAW_TYPE } from '../utils/types.js';

const RAW_TYPE_CACHE = {
    string: { type: RAW_TYPE.stringList },
    image: { type: RAW_TYPE.imageList },
    audio: { type: RAW_TYPE.audioList },
    video: { type: RAW_TYPE.videoList },
    object: { type: 103 }
};

export function buildOutputMap(nodes) {
    const map = new Map();
    
    function processNodes(nodes) {
        for (const node of nodes) {
            const id = node.id;
            const outputs = node.parameters?.node_outputs || {};
            
            for (const [name, def] of Object.entries(outputs)) {
                let assist = def.assistType || getAssistFromType(def.type);
                let raw = def.rawMeta;
                let outputType = def.type;
                let itemsType = (def.type === 'list' && def.items) ? def.items.type : null;
                
                if (def.value && def.value.value && def.value.value.ref_node && def.value.value.path) {
                    const originalType = def.value.type || outputType;
                    if (originalType !== 'list') {
                        outputType = 'list';
                        itemsType = originalType;
                    } else {
                        outputType = 'list';
                        itemsType = def.value.items?.type || itemsType;
                    }
                    assist = getAssistFromType(itemsType) || assist;
                }
                
                if (!raw) raw = inferRawMetaFromType(outputType, assist);
                
                if (outputType === 'list' && itemsType) {
                    raw = RAW_TYPE_CACHE[itemsType] || { type: RAW_TYPE.list };
                }
                
                map.set(`${id}.${name}`, {
                    type: outputType, assistType: assist, rawMeta: raw, itemsType,
                    required: def.required === true, description: def.description || '',
                    defaultValue: def.default_value
                });
            }
            
            const innerNodes = node.nodes || node.parameters?.nodes || node.parameters?.blocks;
            if (innerNodes?.length) processNodes(innerNodes);
        }
    }
    processNodes(nodes);
    return map;
}

export function convertOutputs(outputs, keepAssist = true) {
    if (!outputs || typeof outputs !== 'object') return [];
    return Object.entries(outputs)
        .filter(([name]) => !['reasoning_content', 'thinking_result'].includes(name))
        .map(([name, def]) => {
            let assist = def.assistType || getAssistFromType(def.type);
            let raw = def.rawMeta || inferRawMetaFromType(def.type, assist);
            const base = { name, type: mapOutType(def.type), required: def.required === true, description: def.description || '', defaultValue: def.default_value };
            if (assist !== undefined && keepAssist) base.assistType = assist;
            if (raw) base.rawMeta = raw;
            
            if (def.type === 'list' && def.items) {
                const itemAssist = def.items.assistType || getAssistFromType(def.items.type);
                base.schema = { type: mapOutType(def.items.type) };
                if (itemAssist !== undefined && keepAssist) base.assistType = itemAssist;
                base.rawMeta = def.items.type === 'string' ? { type: RAW_TYPE.stringList } : { type: RAW_TYPE.list };
            }
            
            if (def.type === 'object' && def.properties) {
                base.schema = Object.entries(def.properties).map(([k, v]) => ({
                    name: k, type: mapOutType(v.type), required: v.required === true, description: v.description || ''
                }));
            }
            
            return base;
        });
}