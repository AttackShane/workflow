/**
 * DOM 操作工具函数
 */
import { Logger } from './logger.js';

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
                element.value = text;
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
            element.disabled = disabled;
        }
    },
    
    /**
     * 添加事件监听器
     * @param {HTMLElement|null} element - 元素
     * @param {string} event - 事件名
     * @param {Function} handler - 事件处理函数
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
     * @param {Function} handler - 事件处理函数
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
            element.value = options.value;
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
     * @param {Function} predicate - 条件函数
     * @returns {*}
     */
    find(array, predicate) {
        if (!Array.isArray(array)) return undefined;
        return array.find(predicate);
    },
    
    /**
     * 过滤数组
     * @param {Array} array - 数组
     * @param {Function} predicate - 条件函数
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
     * @param {string} text - 要复制的文本
     * @returns {Promise<boolean>} 是否复制成功
     */
    async copy(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
        Logger.error('Clipboard copy error:', error);
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
        
        try {
            await navigator.clipboard.writeText(text);
            if (btn) {
                btn.textContent = successText;
                btn.style.background = '#10B981';
                btn.style.borderColor = '#10B981';
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
            return true;
        } catch (error) {
            Logger.error('Clipboard copy error:', error);
            if (btn) {
                btn.textContent = errorText;
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
            return false;
        }
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