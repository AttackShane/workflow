const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const srcDir = path.join(rootDir, 'src');
const modulesDir = path.join(rootDir, 'src', 'modules');
const testsDir = path.join(rootDir, 'tests');
const scriptsDir = path.join(rootDir, 'src', 'scripts');

// =============================================================================
// Step 1: Build maps of all JS files under src/
// =============================================================================
const moduleFiles = new Map(); // basename -> relative path from src/modules/
const srcFiles = new Map();    // basename -> relative path from src/

function scanSrc(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanSrc(full, rel);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            srcFiles.set(entry.name, rel);
            if (rel.startsWith('modules/')) {
                moduleFiles.set(entry.name, rel.slice('modules/'.length));
            }
        }
    }
}
scanSrc(srcDir);

// =============================================================================
// Step 2: Generic import path fixer for JS files
// =============================================================================
function fixImportsInFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const dir = path.dirname(filePath);
    let newContent = content;
    let changed = false;

    const isModuleSubdir = dir.startsWith(modulesDir + path.sep) && dir !== modulesDir;

    // Patterns to match relative import paths in various contexts:
    const patterns = [
        // static import/export with single quotes
        /((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?')((?:\.\/|\.\.\/)[^']+)(')/g,
        // static import/export with double quotes
        /((?:import|export)\s+(?:[\s\S]*?\s+from\s+)?")((?:\.\/|\.\.\/)[^"]+)(")/g,
        // dynamic import with single quotes
        /(import\(')((?:\.\/|\.\.\/)[^']+)('\))/g,
        // dynamic import with double quotes
        /(import\(")((?:\.\/|\.\.\/)[^"]+)("\))/g,
        // dynamic import with backticks
        /(import\(`)((?:\.\/|\.\.\/)[^`]+)(`\))/g,
        // JSDoc import type with single quotes
        /(\{import\(')((?:\.\/|\.\.\/)[^']+)('\))/g,
        // JSDoc import type with double quotes
        /(\{import\(")((?:\.\/|\.\.\/)[^"]+)("\))/g,
        // require() with single quotes
        /(require\(')((?:\.\/|\.\.\/)[^']+)('\))/g,
        // require() with double quotes
        /(require\(")((?:\.\/|\.\.\/)[^"]+)("\))/g,
    ];

    for (const regex of patterns) {
        newContent = newContent.replace(regex, (match, prefix, importPath, suffix) => {
            const resolved = path.resolve(dir, importPath);

            // If the file already exists, leave it alone
            if (fs.existsSync(resolved)) {
                return match;
            }

            // If the source is in a module subdirectory and the import starts with ../,
            // the file may now be one level higher (e.g. ../utils/types.js -> ../../utils/types.js)
            if (isModuleSubdir && importPath.startsWith('../')) {
                const deeperPath = importPath.replace(/^\.\.\//, '../../');
                const deeperResolved = path.resolve(dir, deeperPath);
                if (fs.existsSync(deeperResolved)) {
                    changed = true;
                    return prefix + deeperPath + suffix;
                }
            }

            // Try to find by basename in the src/ tree
            const basename = path.basename(importPath);
            const newRel = srcFiles.get(basename);
            if (!newRel) {
                return match; // unknown, leave as-is
            }

            const newResolved = path.resolve(srcDir, newRel);
            let newPath = path.relative(dir, newResolved).replace(/\\/g, '/');
            if (!newPath.startsWith('.')) {
                newPath = './' + newPath;
            }

            changed = true;
            return prefix + newPath + suffix;
        });
    }

    if (changed) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`[FIXED] ${path.relative(rootDir, filePath)}`);
    }
    return changed;
}

// Process all module JS files
let totalFixed = 0;
for (const [, relPath] of moduleFiles) {
    if (fixImportsInFile(path.join(modulesDir, relPath))) {
        totalFixed++;
    }
}

// Process tests
function scanTests(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanTests(full, rel);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            if (fixImportsInFile(full)) {
                totalFixed++;
            }
        }
    }
}
scanTests(testsDir);

// =============================================================================
// Step 3: Fix build.js hardcoded regex patterns
// =============================================================================
const buildJsPath = path.join(scriptsDir, 'build.js');
let buildJs = fs.readFileSync(buildJsPath, 'utf8');
let buildChanged = false;

function replaceInBuild(oldStr, newStr) {
    if (buildJs.includes(oldStr)) {
        buildJs = buildJs.replaceAll(oldStr, newStr);
        buildChanged = true;
        console.log(`[BUILD] Replaced: ${oldStr.slice(0, 60)}...`);
    }
}

// The worker path was updated in source but build.js regex still uses old name
replaceInBuild(
    "worker = new Worker('\\./modules/highlighter-worker.js', { type: 'module' })",
    "worker = new Worker('\\./modules/converter-highlighter-worker.js', { type: 'module' })"
);

// Dynamic import patterns in build.js need to match new cross-module paths.
function buildModuleRegex(moduleName, subdir) {
    return {
        old: `\\./${moduleName}\\.js`,
        new: `(?:\\./|(?:\\.\\./)+)${subdir}/${moduleName}\\.js`
    };
}

const modulesToUpdate = [
    { name: 'converter-ui', subdir: 'converter' },
    { name: 'converter-keyboard', subdir: 'converter' },
    { name: 'converter-stats', subdir: 'converter' },
    { name: 'shared-graph', subdir: 'shared' },
    { name: 'converter-history', subdir: 'converter' },
    { name: 'converter-virtual-scroll', subdir: 'converter' },
    { name: 'manager', subdir: 'manager' },
];

for (const mod of modulesToUpdate) {
    const { old: oldPat, new: newPat } = buildModuleRegex(mod.name, mod.subdir);
    replaceInBuild(`'${oldPat}'`, `['"]${newPat}['"]`);
    replaceInBuild(`\`${oldPat}\``, `['"\`]${newPat}['"\`]`) ;
}

const oldImportMatch = `import\\(['"\`]\\./(converter-ui|converter-stats|shared-graph|converter-keyboard|converter-history|converter-virtual-scroll)\\.js[^'"\`]*['"\`]\\)\\.then\\(\\(\\{ [^}]+\\}\\) => \\{`;
const newImportMatch = `import\\(['"\`](?:\\./|(?:\\.\\./)+)(converter/converter-ui|converter/converter-stats|shared/shared-graph|converter/converter-keyboard|converter/converter-history|converter/converter-virtual-scroll)\\.js[^'"\`]*['"\`]\\)\\.then\\(\\(\\{ [^}]+\\}\\) => \\{`;
replaceInBuild(oldImportMatch, newImportMatch);

replaceInBuild(
    `['"]\\./converter-ui\\.js['"];?`,
    `['"](?:\\./|(?:\\.\\./)+)converter/converter-ui\\.js['"];?`
);
replaceInBuild(
    `['"]\\./converter-stats\\.js['"];?`,
    `['"](?:\\./|(?:\\.\\./)+)converter/converter-stats\\.js['"];?`
);

if (buildChanged) {
    fs.writeFileSync(buildJsPath, buildJs, 'utf8');
    console.log(`[FIXED] ${path.relative(rootDir, buildJsPath)}`);
    totalFixed++;
}

console.log(`\nDone. Total files changed: ${totalFixed}`);
