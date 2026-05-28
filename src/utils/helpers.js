/**
 * DOM 操作工具函数
 */
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
            console.error('Storage set error:', error);
        }
    },
    
    /**
     * 移除存储值
     * @param {string} key - 键名
     */
    remove(key) {
        localStorage.removeItem(key);
    },
    
    /**
     * 清空所有存储
     */
    clear() {
        localStorage.clear();
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
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
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
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
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
export const AsyncUtils = {
    /**
     * 延迟执行
     * @param {number} ms - 毫秒数
     * @returns {Promise}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * 带加载状态的异步执行
     * @param {HTMLElement} btn - 按钮元素
     * @param {Function} fn - 异步函数
     * @param {string} loadingText - 加载文本
     * @returns {Promise}
     */
    async withLoading(btn, fn, loadingText = '处理中...') {
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = loadingText;
        btn.style.opacity = '0.7';
        
        try {
            return await fn();
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
            btn.style.opacity = '1';
        }
    }
};

/**
 * 验证工具函数
 */
export const Validator = {
    /**
     * 检查是否为 JSON 格式
     * @param {string} str - 字符串
     * @returns {boolean}
     */
    isJson(str) {
        if (!str || typeof str !== 'string') return false;
        try {
            JSON.parse(str);
            return true;
        } catch {
            return false;
        }
    },
    
    /**
     * 检查是否为 YAML 格式
     * @param {string} str - 字符串
     * @returns {boolean}
     */
    isYaml(str) {
        if (!str || typeof str !== 'string') return false;
        // 简单检测：不是 JSON 且包含 YAML 特征
        if (this.isJson(str)) return false;
        return str.includes(':') || str.includes('- ') || str.includes('yaml');
    },
    
    /**
     * 检查文件扩展名
     * @param {File} file - 文件对象
     * @param {Array} extensions - 允许的扩展名数组
     * @returns {boolean}
     */
    checkFileExtension(file, extensions) {
        if (!file) return false;
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return extensions.includes(ext);
    }
};