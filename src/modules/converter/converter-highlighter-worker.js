import { highlightJson, highlightYaml } from './converter-highlighter.js';

self.onmessage = function(e) {
    const { id, text, type } = e.data;
    const result = type === 'json' ? highlightJson(text) : highlightYaml(text);
    self.postMessage({ id, result });
};