/**
 * i18n 键完整性检查脚本
 * 验证 zh-CN.js 和 en-US.js 中的翻译键是否完全一致
 */

const fs = require('fs');
const path = require('path');

function extractKeys(obj, prefix = '') {
    const keys = [];
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

function parseLocaleFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/export\s+const\s+\w+\s*=\s*(\{[\s\S]*\});?\s*$/);
    if (!match) {
        throw new Error(`无法解析文件: ${filePath}`);
    }
    return eval(`(${match[1]})`);
}

const srcDir = path.join(__dirname, 'src', 'i18n');
const zhCN = parseLocaleFile(path.join(srcDir, 'zh-CN.js'));
const enUS = parseLocaleFile(path.join(srcDir, 'en-US.js'));

const zhKeys = new Set(extractKeys(zhCN));
const enKeys = new Set(extractKeys(enUS));

console.log(`zh-CN 翻译键数: ${zhKeys.size}`);
console.log(`en-US 翻译键数: ${enKeys.size}`);
console.log('');

const missingInEn = [...zhKeys].filter(k => !enKeys.has(k));
const missingInZh = [...enKeys].filter(k => !zhKeys.has(k));

if (missingInEn.length > 0) {
    console.log('❌ zh-CN 有但 en-US 缺少的键:');
    missingInEn.forEach(k => console.log(`  - ${k}`));
    console.log('');
}

if (missingInZh.length > 0) {
    console.log('❌ en-US 有但 zh-CN 缺少的键:');
    missingInZh.forEach(k => console.log(`  - ${k}`));
    console.log('');
}

if (missingInEn.length === 0 && missingInZh.length === 0) {
    console.log('✅ 所有翻译键完全一致！');
    process.exit(0);
} else {
    console.log(`共 ${missingInEn.length + missingInZh.length} 个不一致的键`);
    process.exit(1);
}