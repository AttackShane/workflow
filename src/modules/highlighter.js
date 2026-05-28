const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
function escapeHtml(text) {
    return text.replace(/[&<>"]/g, c => ESCAPE_MAP[c]);
}

const JSON_REGEX = /"([^"]+)":|"([^"]*)"|^(true|false|null)\b|-?\d+\.?\d*/g;
const YAML_REGEX = /(\s*)-\s|(\s*)(["'][^"'\n]*["']):|(\s*)([\w-]+):|(["'][^"'\n]*["'])|\b(true|false|null)\b|-?\d+\.?\d*/g;

function highlightLineFast(line, isJson) {
    const regex = isJson ? JSON_REGEX : YAML_REGEX;
    regex.lastIndex = 0;
    
    let result = [];
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
            result.push(escapeHtml(line.slice(lastIndex, match.index)));
        }
        
        if (isJson) {
            if (match[1]) {
                result.push(`<span class="hl-key">"${match[1]}":</span>`);
            } else if (match[2]) {
                result.push(`<span class="hl-string">"${match[2]}"</span>`);
            } else if (match[3]) {
                result.push(`<span class="hl-bool">${match[3]}</span>`);
            } else if (match[4] !== undefined) {
                result.push(`<span class="hl-number">${match[0]}</span>`);
            }
        } else {
            if (match[1] !== undefined) {
                result.push(`<span class="hl-list">${match[0]}</span>`);
            } else if (match[2] || match[4]) {
                const key = match[3] || match[5];
                result.push(escapeHtml(match[2] || match[4] || ''));
                result.push(`<span class="hl-key">${key}:</span>`);
            } else if (match[6]) {
                result.push(`<span class="hl-string">${match[6]}</span>`);
            } else if (match[7]) {
                result.push(`<span class="hl-bool">${match[7]}</span>`);
            } else if (match[8] !== undefined) {
                result.push(`<span class="hl-number">${match[0]}</span>`);
            }
        }
        
        lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < line.length) {
        result.push(escapeHtml(line.slice(lastIndex)));
    }
    
    return result.join('');
}

export function highlightJson(text) {
    try {
        JSON.parse(text);
        const lines = text.split('\n');
        return lines.map(line => highlightLineFast(line, true)).join('\n');
    } catch {
        return escapeHtml(text);
    }
}

export function highlightYaml(text) {
    const lines = text.split('\n');
    return lines.map(line => highlightLineFast(line, false)).join('\n');
}

export async function highlightJsonAsync(text, callback) {
    try {
        JSON.parse(text);
        const lines = text.split('\n');
        const total = lines.length;
        const batchSize = 50;
        
        for (let i = 0; i < total; i += batchSize) {
            const end = Math.min(i + batchSize, total);
            const batch = lines.slice(i, end);
            const html = batch.map(line => highlightLineFast(line, true)).join('\n');
            callback(html, i, end, total);
            if (i + batchSize < total) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    } catch {
        callback(escapeHtml(text), 0, 1, 1);
    }
}

export async function highlightYamlAsync(text, callback) {
    const lines = text.split('\n');
    const total = lines.length;
    const batchSize = 50;
    
    for (let i = 0; i < total; i += batchSize) {
        const end = Math.min(i + batchSize, total);
        const batch = lines.slice(i, end);
        const html = batch.map(line => highlightLineFast(line, false)).join('\n');
        callback(html, i, end, total);
        if (i + batchSize < total) {
            await new Promise(r => setTimeout(r, 0));
        }
    }
}