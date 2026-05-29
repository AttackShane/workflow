import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { convertYamlToClipboard } from '../modules/converter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const exampleDir = path.join(__dirname, '../example');

function getAllWorkflowDirs(dir) {
    try {
        return fs.readdirSync(dir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('Workflow-'))
            .map(dirent => dirent.name);
    } catch (err) {
        console.error(`读取目录失败: ${dir}`, err);
        return [];
    }
}

function findYamlFile(workflowDir) {
    const workflowPath = path.join(exampleDir, workflowDir, 'workflow');
    try {
        const files = fs.readdirSync(workflowPath);
        return files.find(f => f.endsWith('.yaml') && !f.includes('converted'));
    } catch (err) {
        console.error(`读取工作流目录失败: ${workflowPath}`, err);
        return null;
    }
}

function convertWorkflow(workflowDir) {
    const yamlFile = findYamlFile(workflowDir);
    if (!yamlFile) {
        console.log(`[跳过] ${workflowDir} - 未找到 YAML 文件`);
        return { success: false, reason: '未找到 YAML 文件' };
    }

    const yamlPath = path.join(exampleDir, workflowDir, 'workflow', yamlFile);
    const jsonFileName = yamlFile.replace('.yaml', '_converted.json');
    const jsonPath = path.join(exampleDir, workflowDir, 'workflow', jsonFileName);

    try {
        const yamlContent = fs.readFileSync(yamlPath, 'utf8');
        const yamlData = yaml.load(yamlContent);
        
        if (!yamlData || !yamlData.nodes) {
            console.log(`[跳过] ${workflowDir} - YAML 数据无效`);
            return { success: false, reason: 'YAML 数据无效' };
        }

        const result = convertYamlToClipboard(yamlData);
        fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
        
        const nodeCount = yamlData.nodes?.length || 0;
        const edgeCount = yamlData.edges?.length || 0;
        console.log(`[成功] ${workflowDir}`);
        console.log(`       节点数: ${nodeCount}, 连线数: ${edgeCount}`);
        console.log(`       输出: ${jsonFileName}`);
        
        return { success: true, nodeCount, edgeCount, outputFile: jsonFileName };
    } catch (err) {
        console.log(`[失败] ${workflowDir} - ${err.message}`);
        return { success: false, reason: err.message };
    }
}

async function main() {
    console.log('========================================');
    console.log('    工作流批量转换工具');
    console.log('========================================\n');

    const workflowDirs = getAllWorkflowDirs(exampleDir);
    
    if (workflowDirs.length === 0) {
        console.log('未找到任何工作流目录');
        return;
    }

    console.log(`找到 ${workflowDirs.length} 个工作流目录\n`);

    let successCount = 0;
    let failCount = 0;
    let totalNodes = 0;
    let totalEdges = 0;

    for (const dir of workflowDirs) {
        const result = convertWorkflow(dir);
        if (result.success) {
            successCount++;
            totalNodes += result.nodeCount;
            totalEdges += result.edgeCount;
        } else {
            failCount++;
        }
        console.log('');
    }

    console.log('========================================');
    console.log('              转换结果统计');
    console.log('========================================');
    console.log(`成功: ${successCount} 个`);
    console.log(`失败: ${failCount} 个`);
    console.log(`总节点数: ${totalNodes}`);
    console.log(`总连线数: ${totalEdges}`);
    console.log('========================================');
}

main().catch(err => {
    console.error('批量转换执行失败:', err);
    process.exit(1);
});