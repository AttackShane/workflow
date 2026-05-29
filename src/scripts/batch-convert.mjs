import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const exampleDir = path.join(rootDir, 'example');

async function main() {
    console.log('');
    console.log('🚀 批量转换 YAML 到 JSON');
    console.log('─────────────────────────────');
    
    try {
        const converter = await import('../modules/converter.js');
        
        if (!fs.existsSync(exampleDir)) {
            console.error(`❌ 示例目录不存在: ${exampleDir}`);
            process.exit(1);
        }
        
        const workflowDirs = fs.readdirSync(exampleDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory() && dirent.name.startsWith('Workflow-'))
            .map(dirent => dirent.name);
        
        console.log(`找到 ${workflowDirs.length} 个工作流目录`);
        console.log('');
        
        let successCount = 0;
        let failCount = 0;
        
        for (const workflowDir of workflowDirs) {
            const workflowPath = path.join(exampleDir, workflowDir, 'workflow');
            
            if (!fs.existsSync(workflowPath)) {
                console.warn(`⚠️ 跳过：工作流目录不存在 - ${workflowDir}`);
                continue;
            }
            
            const yamlFiles = fs.readdirSync(workflowPath)
                .filter(file => file.endsWith('.yaml') && !file.includes('converted'));
            
            for (const yamlFile of yamlFiles) {
                const yamlPath = path.join(workflowPath, yamlFile);
                const jsonFile = yamlFile.replace('.yaml', '_converted.json');
                const jsonPath = path.join(workflowPath, jsonFile);
                
                try {
                    console.log(`处理: ${yamlFile}`);
                    
                    const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
                    const yamlData = yaml.load(yamlContent);
                    
                    const result = converter.convertYamlToClipboard(yamlData);
                    
                    fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2));
                    
                    console.log(`   ✓ 转换成功 -> ${jsonFile}`);
                    successCount++;
                } catch (error) {
                    console.error(`   ✗ 转换失败: ${error.message}`);
                    failCount++;
                }
            }
        }
        
        console.log('');
        console.log('─────────────────────────────');
        console.log(`转换完成: ✓ ${successCount} 成功, ✗ ${failCount} 失败`);
        console.log('');
        
    } catch (error) {
        console.error('❌ 批量转换失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

main();