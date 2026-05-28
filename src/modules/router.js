export class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = '';
        this.rootElement = null;
        Router.instance = this;  // 保存单例实例
    }

    init(rootElementId) {
        this.rootElement = document.getElementById(rootElementId);
        
        this.routes = {
            '/': { 
                title: '工作流管理', 
                load: () => this.loadPage('/views/workflow-manager.html') 
            },
            '/converter': { 
                title: '工作流格式转换器', 
                load: () => this.loadPage('/views/converter.html') 
            },
            '/editor': { 
                title: '工作流编辑器', 
                load: () => this.loadPage('/views/workflow-editor.html') 
            }
        };

        window.addEventListener('popstate', () => this.handleRouteChange());
        this.handleRouteChange();
    }

    handleRouteChange() {
        const path = window.location.pathname;
        const route = this.routes[path] || this.routes['/'];
        
        if (this.currentRoute === path) return;
        
        // 清理之前页面的状态
        this.cleanupPreviousPage();
        
        this.currentRoute = path;
        route.load();
        document.title = route.title;
    }

    cleanupPreviousPage() {
        // 移除之前加载的脚本
        document.querySelectorAll('script[data-router-script]').forEach(script => script.remove());
        
        // 重置全局变量
        if (window.workflowUI) {
            delete window.workflowUI;
        }
        if (window.workflowManager) {
            delete window.workflowManager;
        }
        if (window.draggedNodeType !== undefined) {
            delete window.draggedNodeType;
        }
        if (window.dragStartHandler) {
            delete window.dragStartHandler;
        }
        if (window.dragOverHandler) {
            delete window.dragOverHandler;
        }
        if (window.dropHandler) {
            delete window.dropHandler;
        }
    }

    async loadPage(url) {
        if (!this.rootElement) {
            window.location.href = url;
            return;
        }

        try {
            const response = await fetch(url);
            const html = await response.text();
            
            // 提取并加载样式表
            this.loadStyles(html);
            
            // 提取 body 内容，避免嵌套的 html/head/body 标签
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
            const content = bodyMatch ? bodyMatch[1] : html;
            
            this.rootElement.innerHTML = content;
            this.executeScripts();
        } catch (error) {
            console.error('Failed to load page:', error);
            window.location.href = url;
        }
    }

    loadStyles(html) {
        // 移除之前加载的页面样式
        document.querySelectorAll('link[data-router-style]').forEach(link => link.remove());
        
        // 提取并加载新的样式表
        const linkRegex = /<link\s+rel="stylesheet"\s+href="([^"]+)"/gi;
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.setAttribute('data-router-style', '');
            document.head.appendChild(link);
        }
    }

    executeScripts() {
        const scripts = this.rootElement.querySelectorAll('script');
        
        scripts.forEach(script => {
            // 对于模块类型的脚本，创建新的 script 元素
            if (script.type === 'module') {
                const newScript = document.createElement('script');
                newScript.type = 'module';
                
                if (script.src) {
                    newScript.src = script.src;
                } else {
                    // 对于内联模块脚本，处理 DOMContentLoaded 监听
                    let content = script.textContent;
                    // 将构造函数中的 DOMContentLoaded 改为直接调用 init
                    content = content.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\) => this\.init\(\)\)/g, 'this.init()');
                    newScript.textContent = content;
                }
                
                document.head.appendChild(newScript);
                newScript.onload = () => {
                    document.head.removeChild(newScript);
                };
            } else if (script.src) {
                // 对于普通外部脚本
                const newScript = document.createElement('script');
                newScript.src = script.src;
                newScript.type = script.type || 'text/javascript';
                document.head.appendChild(newScript);
                newScript.onload = () => {
                    document.head.removeChild(newScript);
                };
            } else {
                // 对于普通内联脚本，直接执行
                try {
                    let content = script.textContent;
                    content = content.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\) => \{\s*([\s\S]*?)\s*\}\)/g, '$1');
                    content = content.replace(/document\.addEventListener\(['"]DOMContentLoaded['"],\s*function\s*\(\)\s*\{\s*([\s\S]*?)\s*\}\)/g, '$1');
                    eval(content);
                } catch (error) {
                    console.error('Failed to execute inline script:', error);
                }
            }
        });
    }

    navigate(path) {
        if (this.routes[path]) {
            window.history.pushState({}, '', path);
            this.handleRouteChange();
        }
    }

    static go(path) {
        if (Router.instance) {
            Router.instance.navigate(path);
        } else {
            // 如果没有初始化实例，直接跳转
            window.location.href = path;
        }
    }

    static link(path, text, className = '') {
        return `<a href="${path}" onclick="event.preventDefault(); Router.go('${path}')" class="${className}">${text}</a>`;
    }
}

window.Router = Router;