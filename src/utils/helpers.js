/**
 * DOM 操作工具函数
 */
import { Logger } from './logger.js';

export function getJsyaml() {
    if (!window['jsyaml']) {
        throw new Error('js-yaml 库未加载，请检查网络连接并刷新页面');
    }
    return window['jsyaml'];
}

export function getJSZip() {
    if (!window['JSZip']) {
        throw new Error('JSZip 库未加载，请检查网络连接并刷新页面');
    }
    return window['JSZip'];
}

export const DOM = {
    /**
     * 获取 DOM 元素
     * @param {string} id - 元素 ID
     * @returns {HTMLElement|null}
     */
    get(id) {
        return document.getElementById(id);
    },
    
    /**
     * 安全设置元素文本内容
     * @param {HTMLElement|null} element - 元素
     * @param {string} text - 文本内容
     */
    setText(element, text) {
        if (element) {
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
                /** @type {*} */ (element).value = text;
            } else {
                element.textContent = text;
            }
        }
    },
    
    /**
     * 安全设置元素 HTML 内容
     * @param {HTMLElement|null} element - 元素
     * @param {string} html - HTML 内容
     */
    setHtml(element, html) {
        if (element) {
            element.innerHTML = html;
        }
    },
    
    /**
     * 安全设置元素属性
     * @param {HTMLElement|null} element - 元素
     * @param {string} name - 属性名
     * @param {string} value - 属性值
     */
    setAttr(element, name, value) {
        if (element) {
            element.setAttribute(name, value);
        }
    },
    
    /**
     * 安全设置元素样式
     * @param {HTMLElement|null} element - 元素
     * @param {string} property - CSS 属性
     * @param {string} value - 属性值
     */
    setStyle(element, property, value) {
        if (element) {
            element.style[property] = value;
        }
    },
    
    /**
     * 安全设置元素禁用状态
     * @param {HTMLElement|null} element - 元素
     * @param {boolean} disabled - 是否禁用
     */
    setDisabled(element, disabled) {
        if (element) {
            /** @type {*} */ (element).disabled = disabled;
        }
    },
    
    /**
     * 添加事件监听器
     * @param {HTMLElement|null} element - 元素
     * @param {string} event - 事件名
     * @param {EventListenerOrEventListenerObject} handler - 事件处理函数
     */
    on(element, event, handler) {
        if (element) {
            element.addEventListener(event, handler);
        }
    },
    
    /**
     * 移除事件监听器
     * @param {HTMLElement|null} element - 元素
     * @param {string} event - 事件名
     * @param {EventListenerOrEventListenerObject} handler - 事件处理函数
     */
    off(element, event, handler) {
        if (element) {
            element.removeEventListener(event, handler);
        }
    },
    
    /**
     * 切换元素类名
     * @param {HTMLElement|null} element - 元素
     * @param {string} className - 类名
     * @param {boolean} force - 强制添加或移除
     */
    toggleClass(element, className, force) {
        if (element) {
            element.classList.toggle(className, force);
        }
    },
    
    /**
     * 添加类名
     * @param {HTMLElement|null} element - 元素
     * @param {string} className - 类名
     */
    addClass(element, className) {
        if (element) {
            element.classList.add(className);
        }
    },
    
    /**
     * 移除类名
     * @param {HTMLElement|null} element - 元素
     * @param {string} className - 类名
     */
    removeClass(element, className) {
        if (element) {
            element.classList.remove(className);
        }
    },
    
    /**
     * 创建元素
     * @param {string} tag - 标签名
     * @param {Object} options - 选项
     * @returns {HTMLElement}
     */
    create(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.id) {
            element.id = options.id;
        }
        
        if (options.text) {
            element.textContent = options.text;
        }
        
        if (options.html) {
            element.innerHTML = options.html;
        }
        
        // 处理 value 属性（用于 input、textarea 等元素）
        if (options.value !== undefined) {
            /** @type {*} */ (element).value = options.value;
        }
        
        if (options.style) {
            Object.assign(element.style, options.style);
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        return element;
    },
    
    /**
     * 创建 SVG 元素
     * @param {string} tag - 标签名
     * @param {Object} options - 选项
     * @returns {SVGElement}
     */
    createSVG(tag, options = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        return element;
    }
};

/**
 * 存储操作工具函数
 */
export const Storage = {
    /**
     * 获取存储值
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    get(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? JSON.parse(value) : defaultValue;
        } catch {
            return defaultValue;
        }
    },
    
    /**
     * 设置存储值
     * @param {string} key - 键名
     * @param {*} value - 值
     */
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            Logger.error('Storage set error:', error);
        }
    },
    
    /**
     * 移除存储值
     * @param {string} key - 键名
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Node.js 测试环境无 localStorage
        }
    },
    
    /**
     * 清空所有存储
     */
    clear() {
        try {
            localStorage.clear();
        } catch {
            // Node.js 测试环境无 localStorage
        }
    }
};

/**
 * 字符串操作工具函数
 */
export const StringUtils = {
    /**
     * HTML 转义
     * @param {string} str - 原始字符串
     * @returns {string}
     */
    escapeHtml(str) {
        if (str == null || str === '') return '';
        const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, c => ESCAPE_MAP[c]);
    },
    
    /**
     * 截取字符串并添加省略号
     * @param {string} str - 原始字符串
     * @param {number} maxLength - 最大长度
     * @returns {string}
     */
    truncate(str, maxLength = 50) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
    },
    
    /**
     * 格式化时间戳
     * @param {string} timestamp - 时间戳字符串
     * @returns {string}
     */
    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString('zh-CN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * 生成唯一 ID
     * @returns {string}
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2);
    }
};

/**
 * 数组操作工具函数
 */
export const ArrayUtils = {
    /**
     * 查找数组元素
     * @param {Array} array - 数组
     * @param {function(*, number, *[]): *} predicate - 条件函数
     * @returns {*}
     */
    find(array, predicate) {
        if (!Array.isArray(array)) return undefined;
        return array.find(predicate);
    },
    
    /**
     * 过滤数组
     * @param {Array} array - 数组
     * @param {function(*, number, *[]): *} predicate - 条件函数
     * @returns {Array}
     */
    filter(array, predicate) {
        if (!Array.isArray(array)) return [];
        return array.filter(predicate);
    },
    
    /**
     * 数组去重
     * @param {Array} array - 数组
     * @param {Function} keyFn - 键函数
     * @returns {Array}
     */
    unique(array, keyFn = (item) => item) {
        if (!Array.isArray(array)) return [];
        const seen = new Set();
        return array.filter(item => {
            const key = keyFn(item);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },
    
    /**
     * 限制数组长度
     * @param {Array} array - 数组
     * @param {number} maxLength - 最大长度
     * @returns {Array}
     */
    limit(array, maxLength) {
        if (!Array.isArray(array)) return [];
        return array.slice(0, maxLength);
    }
};

/**
 * 异步操作工具函数
 */
/**
 * 剪贴板操作工具函数
 */
export const ClipboardUtils = {
    /**
     * 复制文本到剪贴板
     * 当 Clipboard API 不可用时，降级为同步 execCommand
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否复制成功
     */
    async copy(text) {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                Logger.error('Clipboard API copy error:', error);
            }
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        } catch (error) {
            Logger.error('document.execCommand copy error:', error);
            document.body.removeChild(textarea);
            return false;
        }
    },
    
    /**
     * 复制文本到剪贴板并显示反馈
     * @param {string} text - 要复制的文本
     * @param {HTMLElement} btn - 按钮元素（用于显示状态）
     * @param {string} successText - 成功时显示的文本
     * @param {string} errorText - 失败时显示的文本
     */
    async copyWithFeedback(text, btn, successText = '✓ 已复制', errorText = '复制失败') {
        const originalText = btn?.textContent;
        const originalStyle = btn ? {
            background: btn.style.background,
            borderColor: btn.style.borderColor
        } : null;

        const updateBtn = (success) => {
            if (btn) {
                btn.textContent = success ? successText : errorText;
                btn.style.background = success ? '#10B981' : '#EF4444';
                btn.style.borderColor = success ? '#10B981' : '#EF4444';
            }
            setTimeout(() => {
                if (btn && originalText) {
                    btn.textContent = originalText;
                    if (originalStyle) {
                        btn.style.background = originalStyle.background;
                        btn.style.borderColor = originalStyle.borderColor;
                    }
                }
            }, 2000);
        };

        const result = await this.copy(text);
        updateBtn(result);
        return result;
    }
};

/**
 * 深拷贝工具函数
 * 使用浏览器原生 structuredClone API，性能优于 JSON.parse(JSON.stringify())
 * 支持 Date、Map、Set、ArrayBuffer 等更多数据类型
 * @param {*} obj - 需要深拷贝的对象
 * @returns {*} 深拷贝后的对象
 */
export function deepClone(obj) {
    if (obj == null) return obj;
    try {
        return structuredClone(obj);
    } catch {
        return JSON.parse(JSON.stringify(obj));
    }
}

/**
 * 从 Slate 格式提取纯文本
 * @param {Array} slate - Slate JSON 节点数组
 * @returns {string} 纯文本
 */
export function extractSlateText(slate) {
    if (!Array.isArray(slate)) return '';
    return slate.map(node => {
        if (node.text !== undefined) return node.text;
        if (node.children) return extractSlateText(node.children);
        return '';
    }).join('\n');
}

/**
 * 节点布局工具函数（与 canvas.calculateNodesBounds 共享逻辑）
 */
export const NodeUtils = {
    /**
     * 计算节点集合的边界框
     * @param {Array<{id: string, x: number, y: number, width?: number, height?: number, parentId?: string}>} nodes
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    getBounds(nodes) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        nodes.forEach(node => {
            if (node.parentId) {
                const parent = nodes.find(n => n.id === node.parentId);
                if (!parent) return;
                const absX = (parent.x || 0) + (node.x || 0);
                const absY = (parent.y || 0) + 56 + (node.y || 0);
                const width = node.width || 200;
                const height = node.height || 100;

                minX = Math.min(minX, absX);
                minY = Math.min(minY, absY);
                maxX = Math.max(maxX, absX + width);
                maxY = Math.max(maxY, absY + height);
            } else {
                const x = node.x || 0;
                const y = node.y || 0;
                const width = node.width || 200;
                const height = node.height || 100;

                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + width);
                maxY = Math.max(maxY, y + height);
            }
        });

        return { minX, minY, maxX, maxY };
    },

    /**
     * 平移节点到画布可视区域（只平移顶层节点，子节点跟随父节点）
     * @param {Array<{id: string, x: number, y: number, parentId?: string}>} nodes
     * @param {number} [padding=100] - 画布边距
     */
    translateToCanvasOrigin(nodes, padding = 100) {
        if (!nodes.length) return;

        const { minX, minY } = this.getBounds(nodes);

        if (!isFinite(minX) || !isFinite(minY)) return;

        const offsetX = padding - minX;
        const offsetY = padding - minY;

        for (const node of nodes) {
            if (!node.parentId) {
                node.x += offsetX;
                node.y += offsetY;
            }
        }
    }
};