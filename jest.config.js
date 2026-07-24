export default {
    testEnvironment: 'jsdom',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    moduleFileExtensions: ['js', 'mjs'],
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/src/example/'],
    coverageThreshold: {
        // 纯逻辑/工具类 — 80%
        'src/modules/converter/converter.js': { lines: 80 },
        'src/modules/converter/converter-reverse.js': { lines: 80 },
        'src/modules/converter/converter-highlighter.js': { lines: 80 },
        'src/modules/editor/editor-core.js': { lines: 80 },
        'src/modules/editor/editor-storage.js': { lines: 80 },
        'src/modules/editor/editor-edge.js': { lines: 80 },
        'src/modules/editor/editor-layout.js': { lines: 80 },
        'src/modules/editor/editor-node-types.js': { lines: 80 },
        'src/modules/editor/editor-clipboard-paste.js': { lines: 80 },
        'src/modules/manager/manager-templates.js': { lines: 80 },
        'src/i18n/i18n.js': { lines: 80 },
        'src/utils/types.js': { lines: 80 },
        'src/utils/logger.js': { lines: 80 },
        'src/utils/refCache.js': { lines: 80 },
        'src/components/inputMapper.js': { lines: 80 },
        'src/components/outputMapper.js': { lines: 80 },
        'src/components/containerHandler.js': { lines: 80 },
        'src/components/nodeHandlers.js': { lines: 80 },

        // 混合逻辑 — 70%
        'src/modules/editor/editor-clipboard.js': { lines: 70 },
        'src/modules/editor/editor-keyboard.js': { lines: 55 },
        'src/modules/shared/shared-navigator.js': { lines: 70 },
        'src/modules/shared/shared-theme.js': { lines: 70 },
        'src/modules/editor/editor-align.js': { lines: 70 },
        'src/utils/helpers.js': { lines: 50 },
        'src/utils/utils.js': { lines: 70 },
        'src/modules/shared/shared-serializer.js': { lines: 85 },

        // 交互类 — 按实际覆盖设置阈值
        'src/modules/editor/editor-node-drag.js': { lines: 80 },
        'src/modules/editor/editor-selection.js': { lines: 90 },
        'src/modules/editor/editor-container.js': { lines: 95 },
        'src/modules/editor/editor-canvas.js': { lines: 60 },
    },
};
