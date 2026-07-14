import { StringUtils } from '../utils/helpers.js';

const JSON_REGEX = /"([^"]+)":|"([^"]*)"|\b(true|false|null)\b|(-?\d+\.?\d*)/g;
const YAML_REGEX =
    /(\s*)-\s|(\s*)(["'][^"'\n]*["']):|(\s*)([\w-]+):|(["'][^"'\n]*["'])|\b(true|false|null)\b|(-?\d+\.?\d*)/g;

function highlightLineFast(line, isJson) {
    const regex = isJson ? JSON_REGEX : YAML_REGEX;
    regex.lastIndex = 0;

    const result = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            result.push(StringUtils.escapeHtml(line.slice(lastIndex, match.index)));
        }

        if (isJson) {
            if (match[1] !== undefined) {
                result.push(`<span class="hl-key">"${StringUtils.escapeHtml(match[1])}":</span>`);
            } else if (match[2] !== undefined) {
                result.push(`<span class="hl-string">"${StringUtils.escapeHtml(match[2])}"</span>`);
            } else if (match[3]) {
                result.push(`<span class="hl-bool">${match[3]}</span>`);
            } else if (match[4] !== undefined) {
                result.push(`<span class="hl-number">${match[0]}</span>`);
            }
        } else {
            if (match[1] !== undefined) {
                result.push(`<span class="hl-list">${StringUtils.escapeHtml(match[0])}</span>`);
            } else if (match[2] !== undefined || match[4] !== undefined) {
                const key = match[3] || match[5];
                result.push(StringUtils.escapeHtml(match[2] || match[4] || ''));
                result.push(`<span class="hl-key">${StringUtils.escapeHtml(key)}:</span>`);
            } else if (match[6] !== undefined) {
                result.push(`<span class="hl-string">${StringUtils.escapeHtml(match[6])}</span>`);
            } else if (match[7]) {
                result.push(`<span class="hl-bool">${match[7]}</span>`);
            } else if (match[8] !== undefined) {
                result.push(`<span class="hl-number">${match[0]}</span>`);
            }
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < line.length) {
        result.push(StringUtils.escapeHtml(line.slice(lastIndex)));
    }

    return result.join('');
}

export function highlightJson(text) {
    try {
        JSON.parse(text);
        const lines = text.split('\n');
        return lines.map((line) => highlightLineFast(line, true)).join('\n');
    } catch {
        return StringUtils.escapeHtml(text);
    }
}

export function highlightYaml(text) {
    const lines = text.split('\n');
    return lines.map((line) => highlightLineFast(line, false)).join('\n');
}
