const fs = require('fs');

// 读取TYPE_MAP
const typesContent = fs.readFileSync('src/utils/types.js', 'utf8');
const typeMapMatch = typesContent.match(/export const TYPE_MAP = \{([\s\S]*?)\};/);
const typeMapKeys = [];
if (typeMapMatch) {
  const matches = typeMapMatch[1].matchAll(/(\w+):\s*"/g);
  for (const m of matches) {
    typeMapKeys.push(m[1]);
  }
}

// 读取workflow-node-types
const nodeTypesContent = fs.readFileSync('src/modules/workflow-node-types.js', 'utf8');
const nodeTypeKeys = [];
const regex = /^\s+(\w+):\s*\{/gm;
let match;
while ((match = regex.exec(nodeTypesContent)) !== null) {
  nodeTypeKeys.push(match[1]);
}

console.log('TYPE_MAP 节点数:', typeMapKeys.length);
console.log('编辑器节点数:', nodeTypeKeys.length);
console.log('');

// 找出编辑器有但TYPE_MAP没有的
const missingInTypeMap = nodeTypeKeys.filter(k => !typeMapKeys.includes(k));
console.log('编辑器有但TYPE_MAP没有的节点:', missingInTypeMap);

// 找出TYPE_MAP有但编辑器没有的
const missingInEditor = typeMapKeys.filter(k => !nodeTypeKeys.includes(k));
console.log('TYPE_MAP有但编辑器没有的节点:', missingInEditor);