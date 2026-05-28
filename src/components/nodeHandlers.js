import { mapLang, toValueObject } from "../utils/types.js";
import { convertOutputs } from "./outputMapper.js";
import { convertInputParameters } from "./inputMapper.js";
import { processContainerNode } from "./containerHandler.js";

function convertLlmParam(llmParamRaw) {
    if (!Array.isArray(llmParamRaw)) return [];
    return llmParamRaw.map(p => {
        const iv = p.input;
        let vo = { type: "literal", content: "" };
        if (iv?.value !== undefined) {
            if (iv.value === null) {
                vo = { type: "literal", content: null };
            } else if (typeof iv.value === 'string') {
                vo = { type: "literal", content: iv.value };
            } else if (iv.value.type === 'literal' || iv.value.type === 'ref') {
                vo = iv.value;
            } else {
                vo = { type: "literal", content: JSON.stringify(iv.value) };
            }
        }
        return { name: p.name, input: { type: iv?.type || "string", value: vo } };
    });
}

export const nodeHandlers = {
    start: (data, params) => {
        data.outputs = convertOutputs(params.node_outputs, true);
        data.inputs = { inputParameters: [] };
    },
    
    end: (data, params, ctx) => {
        const inputParameters = convertInputParameters(params.node_inputs, ctx.outputMap, 'end');
        let content = params.content
            ? typeof params.content === "object"
                ? params.content
                : { type: "string", value: { type: "literal", content: params.content } }
            : { type: "string", value: { type: "literal", content: "" } };
        data.inputs = {
            terminatePlan: params.terminatePlan || "returnVariables",
            streamingOutput: params.streamingOutput === true,
            inputParameters,
            content
        };
    },
    
    llm: (data, params, ctx) => {
        data.inputs = {
            inputParameters: ctx.inputParams,
            llmParam: convertLlmParam(params.llmParam),
            fcParamVar: params.fcParamVar || { knowledgeFCParam: {} },
            settingOnError: params.settingOnError || { switch: false, processType: 1, timeoutMs: 600000, retryTimes: 0 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
        data.version = ctx.node.version || "3";
    },
    
    code: (data, params, ctx) => {
        data.inputs = {
            inputParameters: ctx.inputParams,
            code: params.code || "",
            language: mapLang(params.language),
            settingOnError: params.settingOnError || { processType: 1, retryTimes: 0, switch: false, timeoutMs: 60000 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
        data.version = ctx.node.version || "v2";
    },
    
    image_generate: (data, params, ctx) => {
        const ms = params.modelSetting || ctx.node.modelSetting || { model: 10, ratio: 0, watermark: true };
        data.inputs = {
            apiParam: null,
            inputParameters: ctx.inputParams,
            modelSetting: ms,
            prompt: typeof params.prompt === "string"
                ? { negative_prompt: "", prompt: params.prompt }
                : params.prompt || { negative_prompt: "", prompt: "" },
            references: params.references || [],
            settingOnError: params.settingOnError || { switch: false, processType: 1, timeoutMs: 600000, retryTimes: 0 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
        data.version = "";
    },
    
    video_generation: (data, params, ctx) => {
        data.inputs = {
            cameraFixed: params.cameraFixed === true,
            duration: params.duration || 5,
            dynamicParameters: params.dynamicParameters || [],
            firstFrame: params.firstFrame || null,
            generateAudio: params.generateAudio === true,
            generateMode: params.generateMode || "image2Video",
            inputParameters: ctx.inputParams,
            model: params.model || "doubao-seedance-lite",
            prompt: params.prompt || "",
            ratio: params.ratio || "adaptive",
            resolution: params.resolution || "720p",
            seed: params.seed || -1,
            settingOnError: params.settingOnError || { processType: 1, timeoutMs: 360000, retryTimes: 0 },
            watermark: params.watermark === true
        };
        data.outputs = convertOutputs(params.node_outputs, true);
        data.version = "";
    },
    
    condition: (data, params, ctx) => {
        data.inputs = {
            branches: (params.branches || ctx.node.branches || []).map(b => {
                if (b.condition?.conditions) {
                    b.condition.conditions = b.condition.conditions.map(c => {
                        if (c.left?.input?.value) c.left.input.value = toValueObject(c.left.input.value);
                        if (c.right?.input?.value) c.right.input.value = toValueObject(c.right.input.value);
                        return c;
                    });
                }
                return b;
            })
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    variable_merge: (data, params, ctx) => {
        data.inputs = { inputParameters: [], mergeGroups: params.mergeGroups || ctx.node.mergeGroups || [] };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    plugin: (data, params, ctx) => {
        let apiParam = (params.apiParam || ctx.node.apiParam || []).map(ap => {
            if (ap.input) {
                let val = ap.input.value;
                if (typeof val === "string") {
                    val = { type: "literal", content: val, rawMeta: { type: 1 } };
                } else if (val && typeof val === "object" && val.type === "literal") {
                    if (!val.rawMeta) val.rawMeta = { type: 1 };
                } else if (val === undefined || val === null) {
                    val = { type: "literal", content: "", rawMeta: { type: 1 } };
                }
                ap.input.value = val;
            }
            return ap;
        });
        
        const inputParameters = ctx.inputParams || [];
        for (const param of inputParameters) {
            if (param.name === "video" && param.input) {
                delete param.input.assistType;
                param.input.rawMeta = param.input.rawMeta || { type: 1 };
            }
        }
        
        data.inputs = {
            apiParam,
            inputParameters,
            settingOnError: params.settingOnError || { processType: 1, timeoutMs: 180000, retryTimes: 0 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    loop: (data, params, ctx) => processContainerNode(data, params, ctx, "loop"),
    
    batch: (data, params, ctx) => processContainerNode(data, params, ctx, "batch"),
    
    intent: (data, params, ctx) => {
        data.inputs = {
            chatHistorySetting: params.chatHistorySetting || ctx.node.chatHistorySetting || { enableChatHistory: false, chatHistoryRound: 3 },
            inputParameters: ctx.inputParams,
            llmParam: params.llmParam || ctx.node.llmParam || {},
            intents: params.intents || ctx.node.intents || [],
            mode: params.mode || ctx.node.mode || "top_speed",
            version: params.version || ctx.node.version || "2",
            settingOnError: params.settingOnError || { processType: 1, timeoutMs: 60000, retryTimes: 0 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    async_task: (data, params, ctx) => {
        data.inputs = {
            actionType: params.actionType || ctx.node.actionType || 1,
            inputParameters: ctx.inputParams
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    http: (data, params, ctx) => {
        data.inputs = {
            inputParameters: ctx.inputParams,
            url: params.url || ctx.node.url || "",
            method: params.method || ctx.node.method || "GET",
            headers: params.headers || ctx.node.headers || [],
            body: params.body || ctx.node.body || "",
            settingOnError: params.settingOnError || { processType: 1, timeoutMs: 30000, retryTimes: 0 }
        };
        data.outputs = convertOutputs(params.node_outputs, true);
        data.version = "";
    },
    
    comment: (data, params, ctx) => {
        data.inputs = {
            note: params.note || ctx.node.note || "",
            schemaType: params.schemaType || ctx.node.schemaType || "slate"
        };
        if (ctx.node.size) data.size = ctx.node.size;
        data.outputs = [];
    },
    
    text: (data, params, ctx) => {
        const concatParams = (params.concatParams || []).map(param => {
            if (param.input && param.input.value !== undefined) {
                param.input.value = toValueObject(param.input.value);
            }
            return param;
        });
        
        data.inputs = {
            inputParameters: ctx.inputParams,
            concatParams,
            method: params.method || "concat"
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    output: (data, params, ctx) => {
        let content = params.content;
        if (!content) {
            content = { type: "string", value: { type: "literal", content: "" } };
        } else if (typeof content === "object") {
            if (content.value && typeof content.value === 'object') {
                if (content.value.type === 'literal' && !content.value.rawMeta) {
                    content.value.rawMeta = { type: 1 };
                }
            }
        } else {
            content = { type: "string", value: { type: "literal", content: String(content) } };
        }
        
        data.inputs = {
            streamingOutput: params.streamingOutput === true,
            callTransferVoice: params.callTransferVoice === true,
            chatHistoryWriting: params.chatHistoryWriting || "historyWrite",
            content,
            inputParameters: ctx.inputParams || []
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    input: (data, params, ctx) => {
        let outputSchema = params.outputSchema || '';
        if (typeof outputSchema === 'string') {
            try {
                outputSchema = JSON.parse(outputSchema);
            } catch {
                outputSchema = [];
            }
        }
        
        data.inputs = {
            outputSchema: Array.isArray(outputSchema) ? outputSchema : [],
            inputParameters: ctx.inputParams || []
        };
        data.outputs = convertOutputs(params.node_outputs, true);
    },
    
    question: (data, params, ctx) => {
        let llmParam = {};
        if (params.llmParam) {
            if (Array.isArray(params.llmParam)) {
                params.llmParam.forEach((param, index) => {
                    llmParam[String(index)] = {
                        name: param.name,
                        input: {
                            type: param.input?.type || 'string',
                            value: param.input?.value || { type: 'literal', content: '' }
                        }
                    };
                });
                llmParam.systemPrompt = params.llmParam.find(p => p.name === 'systemPrompt')?.input?.value?.content || '';
            } else if (typeof params.llmParam === 'object') {
                let index = 0;
                Object.entries(params.llmParam).forEach(([key, value]) => {
                    if (key === 'systemPrompt') {
                        llmParam.systemPrompt = String(value);
                    } else if (typeof value === 'object' && value.input) {
                        llmParam[String(index++)] = {
                            name: value.name || key,
                            input: {
                                type: value.input?.type || 'string',
                                value: value.input?.value || { type: 'literal', content: '' }
                            }
                        };
                    } else {
                        const valueType = typeof value === 'number' ? (value % 1 === 0 ? 'integer' : 'float') : 'string';
                        llmParam[String(index++)] = {
                            name: key,
                            input: {
                                type: valueType,
                                value: { type: 'literal', content: String(value) }
                            }
                        };
                    }
                });
                if (!llmParam.systemPrompt) llmParam.systemPrompt = '';
            }
        }
        
        let dynamicOption = params.dynamic_option || { type: "string", value: { type: "literal", content: "" } };
        if (dynamicOption.value && typeof dynamicOption.value === 'object') {
            if (dynamicOption.value.type === 'ref' && !dynamicOption.value.rawMeta) {
                dynamicOption.value.rawMeta = { type: 1 };
            }
        }
        
        data.inputs = {
            llmParam: llmParam,
            inputParameters: ctx.inputParams,
            extra_output: params.extra_output === true,
            answer_type: params.answer_type || "text",
            option_type: params.option_type || "static",
            dynamic_option: dynamicOption,
            question: params.question || '',
            options: Array.isArray(params.options) ? params.options.map(opt => ({
                name: opt.name || opt,
                ...(opt.value !== undefined && { value: opt.value })
            })) : [],
            limit: params.limit || 3
        };
        
        if (params.node_outputs) {
            data.outputs = Object.entries(params.node_outputs).map(([name, output]) => {
                const outputObj = {
                    type: output.type || 'string',
                    name: name,
                    required: output.required === true
                };
                if (output.properties) {
                    outputObj.schema = Object.entries(output.properties).map(([propName, prop]) => {
                        const propObj = {
                            type: prop.type || 'string',
                            name: propName,
                            required: prop.required === true
                        };
                        if ((prop.properties || prop.items) && prop.type === 'list') {
                            const subProps = prop.items?.properties || prop.properties || {};
                            propObj.schema = {
                                type: 'object',
                                schema: Object.entries(subProps).map(([subName, subProp]) => ({
                                    type: subProp.type || 'string',
                                    name: subName
                                }))
                            };
                        }
                        return propObj;
                    });
                }
                return outputObj;
            });
        } else {
            data.outputs = [];
        }
    },
    
    default: (data, params, ctx) => {
        data.inputs = { inputParameters: ctx.inputParams };
        data.outputs = convertOutputs(params.node_outputs, true);
    }
};