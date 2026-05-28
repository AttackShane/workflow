import { toValueObject, findRef, mapOutType, getAssistFromType } from '../utils/types.js';
import { convertEdges } from '../utils/utils.js';

export function processContainerNode(data, params, ctx, type) {
    data.inputs = { inputParameters: ctx.inputParams };
    
    if (type === 'loop') {
        if (params.loopCount !== undefined) data.inputs.loopCount = toValueObject(params.loopCount);
        if (params.loopItems !== undefined) data.inputs.loopItems = toValueObject(params.loopItems);
        if (params.iterationVariable !== undefined) data.inputs.iterationVariable = { type: 'literal', content: params.iterationVariable };
        if (params.loopType !== undefined) data.inputs.loopType = params.loopType;
        if (params.variableParameters !== undefined) data.inputs.variableParameters = params.variableParameters;
    } else {
        if (params.batchSize !== undefined) data.inputs.batchSize = params.batchSize || { type: 'integer', value: { type: 'literal', content: 100 } };
        if (params.concurrentSize !== undefined) data.inputs.concurrentSize = params.concurrentSize || { type: 'integer', value: { type: 'literal', content: 2 } };
    }

    const innerNodes = ctx.node.nodes || params.nodes || params.blocks;
    if (innerNodes?.length) data.blocks = innerNodes.map(sub => ctx.convertNode(sub, ctx.outputMap));

    const innerEdges = ctx.node.edges || params.edges;
    if (innerEdges?.length) {
        const edges = convertEdges(innerEdges);
        if (edges.length) data.edges = edges;
    }

    const contOuts = [];
    const outputs = params.node_outputs;
    if (outputs) {
        for (const [on, od] of Object.entries(outputs)) {
            const odValue = od.value;
            const ref = odValue ? findRef(odValue) || findRef(od) : findRef(od);
            const outputType = odValue?.type || od.type;
            const itemsType = odValue?.items?.type || od.items?.type;
            
            let ot = outputType === 'list' ? 'list' : (outputType || 'string');
            let innerType = outputType === 'list' ? (itemsType || 'string') : (outputType || 'string');
            
            const itemAssist = getAssistFromType(innerType);
            const mappedInnerType = mapOutType(innerType);
            
            const vo = ref
                ? { type: 'ref', content: { source: 'block-output', blockID: String(ref.ref_node), name: ref.path } }
                : { type: 'literal', content: '' };
            if (ref?.rawMeta) vo.rawMeta = ref.rawMeta;
            
            const it = { name: on, input: { type: ot, value: vo } };
            
            if (ot === 'list') {
                it.input.schema = itemAssist !== undefined
                    ? { type: mappedInnerType, assistType: itemAssist }
                    : { type: mappedInnerType };
            }
            
            contOuts.push(it);
        }
    }
    data.outputs = contOuts;
}