import { mapOutType, INHERIT_ASSIST_NODES, toValueObject } from '../utils/types.js';

export function convertInputParameters(inputs, outputMap, nodeType) {
    if (!Array.isArray(inputs)) return [];
    const inheritAssist = INHERIT_ASSIST_NODES.has(nodeType);

    return inputs.map((inp) => {
        const def = inp.input || {};
        const val = def.value ? toValueObject(def.value) : { type: 'literal', content: '' };
        let type = def.type;
        let schema = def.schema;
        let assist = def.assistType;
        let raw = def.rawMeta;

        if (val.type === 'ref') {
            const up = outputMap.get(`${val.content.blockID}.${val.content.name}`);
            if (up) {
                if (!type) type = mapOutType(up.type);

                if (up.type === 'list' && up.itemsType) {
                    const mappedType = mapOutType(up.itemsType);
                    const itemAssist = up.assistType;
                    schema =
                        up.itemsType === 'object'
                            ? { type: mappedType, schema: [] }
                            : itemAssist !== undefined
                              ? { type: mappedType, assistType: itemAssist }
                              : { type: mappedType };
                } else if (up.type === 'object' && up.schema) {
                    schema = up.schema;
                }

                if (!raw && up.rawMeta) raw = up.rawMeta;
                if (inheritAssist && up.assistType !== undefined && !assist) assist = up.assistType;
            }
        }

        if (raw !== undefined && val) val.rawMeta = raw;

        const res = { name: inp.name, input: { type: type || 'string', value: val } };
        if (schema) res.input.schema = schema;
        if (assist !== undefined) res.input.assistType = assist;
        return res;
    });
}
