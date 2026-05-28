// 应用配置常量
export const APP_CONFIG = {
    // 历史记录配置
    HISTORY: {
        KEY: 'workflow-converter-history',
        MAX_ITEMS: 20,
        SELECTED_KEY: 'workflow-converter-selected'
    },
    
    // 转换配置
    CONVERSION: {
        JSON_START: '{',
        YAML_EXTENSIONS: ['.yaml', '.yml'],
        JSON_EXTENSIONS: ['.json']
    },
    
    // UI 配置
    UI: {
        COPY_TIMEOUT: 2000,
        LOADING_TEXT: '转换中...',
        DEFAULT_OUTPUT: '// 等待输入'
    },
    
    // 缩放配置
    ZOOM: {
        MIN_SCALE: 0.25,
        MAX_SCALE: 3,
        ZOOM_FACTOR: 0.1
    },
    
    // 主题配置
    THEME: {
        KEY: 'workflow-converter-theme',
        DEFAULT: 'light',
        FONT_SIZE_KEY: 'workflow-converter-fontsize',
        DEFAULT_FONT_SIZE: 14
    },
    
    // 消息配置
    MESSAGES: {
        SUCCESS: {
            CONVERT: '转换成功',
            COPY: '已复制到剪贴板',
            DOWNLOAD: '已下载',
            IMPORT: (count) => `成功导入 ${count} 条记录`
        },
        ERROR: {
            EMPTY_INPUT: '请输入内容',
            CONVERT: '转换失败: ',
            COPY: '复制失败',
            NO_DATA: '未找到匹配的记录',
            NO_HISTORY: '暂无转换记录'
        }
    }
};

// DOM 选择器常量
export const SELECTORS = {
    // 转换器页面
    CONVERTER: {
        MODE_FILE_BTN: 'modeFileBtn',
        MODE_TEXT_BTN: 'modeTextBtn',
        FILE_PANEL: 'filePanel',
        TEXT_PANEL: 'textPanel',
        FILE_INPUT: 'fileInput',
        FILE_NAME_DISPLAY: 'fileNameDisplay',
        INPUT_TEXT: 'inputText',
        CONVERT_FILE_BTN: 'convertFileBtn',
        CLEAR_FILE_BTN: 'clearFileBtn',
        CONVERT_TEXT_BTN: 'convertTextBtn',
        CLEAR_TEXT_BTN: 'clearTextBtn',
        COPY_OUTPUT_BTN: 'copyOutputBtn',
        DOWNLOAD_BTN: 'downloadBtn',
        RESET_BTN: 'resetBtn',
        OUTPUT_AREA: 'outputArea',
        COPY_STATUS: 'copyStatus',
        LINE_NUMBERS: 'lineNumbers',
        CODE_CONTAINER: 'codeContainer',
        HISTORY_PANEL: 'historyPanel',
        HISTORY_LIST: 'historyList',
        HISTORY_SEARCH: 'historySearchInput',
        CLEAR_HISTORY_BTN: 'clearHistoryBtn',
        IMPORT_HISTORY_BTN: 'importHistoryBtn',
        EXPORT_HISTORY_BTN: 'exportHistoryBtn'
    },
    
    // 编辑器页面
    EDITOR: {
        CANVAS: 'canvas',
        CANVAS_CONTENT: 'canvasContent',
        SVG_LAYER: 'svgLayer',
        SVG_HIT_LAYER: 'svgHitLayer',
        EMPTY_STATE: 'emptyState',
        PROPERTY_CONTENT: 'propertyContent',
        IMPORTED_NODE_INFO: 'importedNodeInfo'
    }
};