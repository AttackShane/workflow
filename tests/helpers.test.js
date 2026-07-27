/**
 * src/utils/helpers.js 单元测试
 *
 * 覆盖纯逻辑工具（低风险、无外部依赖分支）：
 * - StringUtils: escapeHtml / truncate / formatTime / generateId
 * - ArrayUtils: find / filter / unique / limit（含非数组入参防御）
 * - NodeUtils: getBounds（含容器子节点绝对坐标）/ translateToCanvasOrigin
 * - deepClone（structuredClone 路径 + 回退路径）
 * - extractSlateText（Slate 嵌套结构 + 非数组）
 * - DOM 工具（jsdom 下验证 setText/setHtml/create/createSVG 等）
 * - Storage（backend=null 防御 + JSON.parse 失败回退默认值）
 * - getJsyaml / getJSZip 未加载时抛错
 */

import {
    DOM,
    Storage,
    StringUtils,
    ArrayUtils,
    ClipboardUtils,
    NodeUtils,
    deepClone,
    extractSlateText,
    getJsyaml,
    getJSZip,
} from '../src/utils/helpers.js';

// NodeUtils 依赖真实 jsdom（document.createElementNS），无需 mock DOM 工具本身

describe('StringUtils', () => {
    describe('escapeHtml', () => {
        it('转义常见的 HTML 特殊字符', () => {
            expect(StringUtils.escapeHtml('<div>"a"&\'b\'</div>')).toBe(
                '&lt;div&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/div&gt;'
            );
        });
        it('null / undefined / 空串返回空串', () => {
            expect(StringUtils.escapeHtml(null)).toBe('');
            expect(StringUtils.escapeHtml(undefined)).toBe('');
            expect(StringUtils.escapeHtml('')).toBe('');
        });
        it('非字符串输入被转为字符串', () => {
            expect(StringUtils.escapeHtml(123)).toBe('123');
        });
    });

    describe('truncate', () => {
        it('超长字符串加省略号', () => {
            expect(StringUtils.truncate('abcdefghij', 5)).toBe('abcde...');
        });
        it('短字符串原样返回', () => {
            expect(StringUtils.truncate('abc', 5)).toBe('abc');
        });
        it('自定义 maxLength', () => {
            expect(StringUtils.truncate('abcdef', 2)).toBe('ab...');
        });
        it('falsy 输入返回空串', () => {
            expect(StringUtils.truncate(null)).toBe('');
            expect(StringUtils.truncate('')).toBe('');
        });
    });

    describe('formatTime', () => {
        it('falsy 输入返回空串', () => {
            expect(StringUtils.formatTime(null)).toBe('');
            expect(StringUtils.formatTime('')).toBe('');
        });
        it('有效时间戳返回非空字符串', () => {
            const out = StringUtils.formatTime('2026-07-27T10:00:00');
            expect(typeof out).toBe('string');
            expect(out.length).toBeGreaterThan(0);
        });
    });

    describe('generateId', () => {
        it('返回字符串且唯一', () => {
            const a = StringUtils.generateId();
            const b = StringUtils.generateId();
            expect(typeof a).toBe('string');
            expect(a).not.toBe(b);
        });
    });
});

describe('ArrayUtils', () => {
    describe('find', () => {
        it('正常查找', () => {
            expect(ArrayUtils.find([1, 2, 3], (x) => x === 2)).toBe(2);
        });
        it('非数组入参返回 undefined', () => {
            expect(ArrayUtils.find(null, () => true)).toBeUndefined();
            expect(ArrayUtils.find('str', () => true)).toBeUndefined();
        });
    });

    describe('filter', () => {
        it('正常过滤', () => {
            expect(ArrayUtils.filter([1, 2, 3], (x) => x > 1)).toEqual([2, 3]);
        });
        it('非数组入参返回空数组', () => {
            expect(ArrayUtils.filter(undefined, () => true)).toEqual([]);
        });
    });

    describe('unique', () => {
        it('按默认键去重', () => {
            expect(ArrayUtils.unique([1, 1, 2, 3, 3])).toEqual([1, 2, 3]);
        });
        it('按 keyFn 去重', () => {
            const arr = [{ id: 'a' }, { id: 'a' }, { id: 'b' }];
            expect(ArrayUtils.unique(arr, (x) => x.id)).toHaveLength(2);
        });
        it('非数组入参返回空数组', () => {
            expect(ArrayUtils.unique(42)).toEqual([]);
        });
    });

    describe('limit', () => {
        it('截断到最大长度', () => {
            expect(ArrayUtils.limit([1, 2, 3, 4], 2)).toEqual([1, 2]);
        });
        it('非数组入参返回空数组', () => {
            expect(ArrayUtils.limit(null, 2)).toEqual([]);
        });
    });
});

describe('NodeUtils', () => {
    describe('getBounds', () => {
        it('计算顶层节点的边界框', () => {
            const nodes = [
                { id: 'a', x: 0, y: 0, width: 100, height: 50 },
                { id: 'b', x: 200, y: 100, width: 100, height: 50 },
            ];
            const b = NodeUtils.getBounds(nodes);
            expect(b).toEqual({ minX: 0, minY: 0, maxX: 300, maxY: 150 });
        });

        it('缺失尺寸时使用默认值 200x100', () => {
            const nodes = [{ id: 'a', x: 10, y: 20 }];
            const b = NodeUtils.getBounds(nodes);
            expect(b.minX).toBe(10);
            expect(b.maxX).toBe(210);
            expect(b.maxY).toBe(120);
        });

        it('容器子节点使用父节点绝对坐标 + 56 偏移', () => {
            const nodes = [
                { id: 'parent', x: 100, y: 100, width: 100, height: 100 },
                { id: 'child', x: 200, y: 200, width: 80, height: 40, parentId: 'parent' },
            ];
            const b = NodeUtils.getBounds(nodes);
            // parent: (100,100)-(200,200)；child 绝对坐标 = parent(100,100)+(200,200+56)=(300,356)
            expect(b.minX).toBe(100);
            expect(b.minY).toBe(100);
            expect(b.maxX).toBe(380); // 300 + 80
            expect(b.maxY).toBe(396); // 356 + 40（由子节点贡献，验证绝对坐标）
        });

        it('子节点缺少父节点时跳过该子节点', () => {
            const nodes = [{ id: 'child', x: 10, y: 10, parentId: 'missing' }];
            const b = NodeUtils.getBounds(nodes);
            // 没有有效节点参与 → 保持 Infinity 初值
            expect(b.minX).toBe(Infinity);
            expect(b.maxX).toBe(-Infinity);
        });
    });

    describe('translateToCanvasOrigin', () => {
        it('空数组直接返回', () => {
            expect(() => NodeUtils.translateToCanvasOrigin([])).not.toThrow();
        });

        it('将顶层节点平移到 padding 原点', () => {
            const nodes = [
                { id: 'a', x: -50, y: -30, width: 100, height: 50 },
                { id: 'b', x: 200, y: 100, width: 100, height: 50 },
            ];
            NodeUtils.translateToCanvasOrigin(nodes, 100);
            // minX=-50 → offsetX = 100-(-50)=150 → a.x = -50+150 = 100
            // minY=-30 → offsetY = 100-(-30)=130 → a.y = -30+130 = 100
            expect(nodes[0].x).toBe(100);
            expect(nodes[0].y).toBe(100);
            // b 同步平移：b.x = 200+150 = 350, b.y = 100+130 = 230
            expect(nodes[1].x).toBe(350);
            expect(nodes[1].y).toBe(230);
        });

        it('子节点不被直接平移（跟随父节点）', () => {
            const nodes = [
                { id: 'p', x: -10, y: -10, width: 300, height: 200 },
                { id: 'c', x: 5, y: 5, parentId: 'p' },
            ];
            NodeUtils.translateToCanvasOrigin(nodes, 50);
            // minX=-10 → offsetX = 50-(-10)=60 → p.x = -10+60 = 50
            expect(nodes[0].x).toBe(50);
            expect(nodes[1].x).toBe(5); // 子节点不平移
        });
    });
});

describe('deepClone', () => {
    it('深拷贝普通对象且互不影响', () => {
        const src = { a: 1, b: { c: 2 } };
        const copy = deepClone(src);
        copy.b.c = 999;
        expect(src.b.c).toBe(2);
    });
    it('拷贝数组', () => {
        const src = [1, 2, { x: 3 }];
        const copy = deepClone(src);
        copy[2].x = 10;
        expect(src[2].x).toBe(3);
    });
    it('null / undefined 原样返回', () => {
        expect(deepClone(null)).toBeNull();
        expect(deepClone(undefined)).toBeUndefined();
    });
});

describe('extractSlateText', () => {
    it('提取含 text 叶子节点', () => {
        const slate = [{ text: 'Hello ' }, { text: 'World' }];
        expect(extractSlateText(slate)).toBe('Hello \nWorld');
    });
    it('递归提取 children', () => {
        const slate = [{ children: [{ text: 'Nested' }] }];
        expect(extractSlateText(slate)).toBe('Nested');
    });
    it('非数组入参返回空串', () => {
        expect(extractSlateText(null)).toBe('');
        expect(extractSlateText('str')).toBe('');
    });
});

describe('DOM', () => {
    it('setText 写入 textContent（非表单元素）', () => {
        const el = document.createElement('div');
        DOM.setText(el, 'hi');
        expect(el.textContent).toBe('hi');
    });
    it('setText 对 textarea/input 写入 value', () => {
        const ta = document.createElement('textarea');
        DOM.setText(ta, 'val');
        expect(ta.value).toBe('val');
    });
    it('setText(null) 安全跳过', () => {
        expect(() => DOM.setText(null, 'x')).not.toThrow();
    });
    it('setHtml 写入 innerHTML', () => {
        const el = document.createElement('div');
        DOM.setHtml(el, '<b>x</b>');
        expect(el.innerHTML).toBe('<b>x</b>');
    });
    it('setAttr / setStyle / show / hide', () => {
        const el = document.createElement('div');
        DOM.setAttr(el, 'data-k', 'v');
        expect(el.getAttribute('data-k')).toBe('v');
        DOM.setStyle(el, 'color', 'red');
        expect(el.style.color).toBe('red');
        DOM.hide(el);
        expect(el.style.display).toBe('none');
        DOM.show(el);
        expect(el.style.display).toBe('');
    });
    it('setDisabled 设置 disabled', () => {
        const el = document.createElement('button');
        DOM.setDisabled(el, true);
        expect(el.disabled).toBe(true);
    });
    it('on / off 事件监听', () => {
        const el = document.createElement('div');
        const handler = jest.fn();
        DOM.on(el, 'click', handler);
        el.click();
        expect(handler).toHaveBeenCalled();
        DOM.off(el, 'click', handler);
        el.click();
        expect(handler).toHaveBeenCalledTimes(1);
    });
    it('class 操作 toggleClass / addClass / removeClass', () => {
        const el = document.createElement('div');
        DOM.addClass(el, 'a');
        expect(el.classList.contains('a')).toBe(true);
        DOM.removeClass(el, 'a');
        expect(el.classList.contains('a')).toBe(false);
        DOM.toggleClass(el, 'b', true);
        expect(el.classList.contains('b')).toBe(true);
        DOM.toggleClass(el, 'b', false);
        expect(el.classList.contains('b')).toBe(false);
    });
    it('create 应用 className/id/text/html/value/style/attributes', () => {
        const el = DOM.create('div', {
            className: 'box',
            id: 'myid',
            text: 'hello',
            value: 'v',
            style: { color: 'blue' },
            attributes: { 'data-x': '1' },
        });
        expect(el.className).toBe('box');
        expect(el.id).toBe('myid');
        expect(el.textContent).toBe('hello');
        expect(el.value).toBe('v');
        expect(el.style.color).toBe('blue');
        expect(el.getAttribute('data-x')).toBe('1');
    });
    it('create 的 html 分支不覆盖 text', () => {
        const el = DOM.create('div', { html: '<i>hi</i>' });
        expect(el.innerHTML).toBe('<i>hi</i>');
    });
    it('createSVG 创建 SVG 命名空间元素', () => {
        const el = DOM.createSVG('rect', { attributes: { width: '10' } });
        expect(el.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(el.getAttribute('width')).toBe('10');
    });
    it('DOM 方法对 null 安全跳过', () => {
        expect(() => {
            DOM.get(null);
            DOM.setHtml(null, 'x');
            DOM.setAttr(null, 'a', 'b');
            DOM.setStyle(null, 'c', 'd');
            DOM.show(null);
            DOM.hide(null);
            DOM.setDisabled(null, true);
            DOM.on(null, 'x', () => {});
            DOM.off(null, 'x', () => {});
            DOM.toggleClass(null, 'c', true);
            DOM.addClass(null, 'c');
            DOM.removeClass(null, 'c');
        }).not.toThrow();
    });
});

describe('Storage', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.spyOn(localStorage, 'getItem');
        jest.spyOn(localStorage, 'setItem');
        jest.spyOn(localStorage, 'removeItem');
        jest.spyOn(localStorage, 'clear');
    });
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('setItem 序列化对象，getItem 反序列化', () => {
        Storage.set('k', { a: 1 });
        expect(localStorage.setItem).toHaveBeenCalledWith('k', '{"a":1}');
        expect(Storage.get('k')).toEqual({ a: 1 });
    });
    it('get 键不存在时返回默认值', () => {
        expect(Storage.get('missing', 'def')).toBe('def');
    });
    it('getItem 返回非 JSON 时回退默认值', () => {
        localStorage.getItem.mockReturnValue('not-json');
        expect(Storage.get('k', 'fallback')).toBe('fallback');
    });
    it('getItem 抛错时回退默认值', () => {
        localStorage.getItem.mockImplementation(() => {
            throw new Error('boom');
        });
        expect(Storage.get('k', 'def')).toBe('def');
    });
    it('setItem 抛错时捕获不冒泡', () => {
        localStorage.setItem.mockImplementation(() => {
            throw new Error('quota');
        });
        expect(() => Storage.set('k', 1)).not.toThrow();
    });
    it('remove / clear 转发到 backend', () => {
        Storage.set('k', 1);
        Storage.remove('k');
        expect(localStorage.removeItem).toHaveBeenCalledWith('k');
        Storage.clear();
        expect(localStorage.clear).toHaveBeenCalled();
    });
});

describe('getJsyaml / getJSZip', () => {
    const origJsyaml = global.window.jsyaml;
    const origJSZip = global.window.JSZip;
    afterEach(() => {
        global.window.jsyaml = origJsyaml;
        global.window.JSZip = origJSZip;
    });
    it('jsyaml 未加载时抛错', () => {
        global.window.jsyaml = undefined;
        expect(() => getJsyaml()).toThrow(/js-yaml/);
    });
    it('JSZip 未加载时抛错', () => {
        global.window.JSZip = undefined;
        expect(() => getJSZip()).toThrow(/JSZip/);
    });
    it('正常返回已加载的库', () => {
        global.window.jsyaml = { load: () => {} };
        global.window.JSZip = { generateAsync: () => {} };
        expect(getJsyaml()).toBe(global.window.jsyaml);
        expect(getJSZip()).toBe(global.window.JSZip);
    });
});

describe('ClipboardUtils', () => {
    const realClipboard = navigator.clipboard;
    afterEach(() => {
        Object.defineProperty(navigator, 'clipboard', { value: realClipboard, configurable: true });
        delete document.execCommand;
    });

    it('copy 在无 clipboard API 时降级使用 execCommand', async () => {
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        document.execCommand = jest.fn().mockReturnValue(true);
        const result = await ClipboardUtils.copy('text');
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe(true);
    });

    it('copy 优先使用 clipboard API 成功路径', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
        const result = await ClipboardUtils.copy('text');
        expect(writeText).toHaveBeenCalledWith('text');
        expect(result).toBe(true);
    });

    it('copy 在 clipboard API 失败时降级 execCommand', async () => {
        const writeText = jest.fn().mockRejectedValue(new Error('blocked'));
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });
        document.execCommand = jest.fn().mockReturnValue(true);
        const result = await ClipboardUtils.copy('text');
        expect(document.execCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe(true);
    });

    it('copyWithFeedback 成功时更新按钮文本并在 2s 后复原', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
        jest.useFakeTimers();
        const btn = document.createElement('button');
        btn.textContent = '复制';
        const result = await ClipboardUtils.copyWithFeedback('text', btn);
        expect(result).toBe(true);
        expect(btn.textContent).toBe('✓ 已复制');
        expect(btn.style.background).toContain('16, 185, 129');
        // 推进时间触发复原
        jest.advanceTimersByTime(2000);
        expect(btn.textContent).toBe('复制');
        jest.useRealTimers();
    });

    it('copyWithFeedback 失败时使用错误文案', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockRejectedValue(new Error('x')) },
            configurable: true,
        });
        document.execCommand = jest.fn().mockReturnValue(false);
        jest.useFakeTimers();
        const btn = document.createElement('button');
        btn.textContent = '复制';
        const result = await ClipboardUtils.copyWithFeedback('text', btn);
        expect(result).toBe(false);
        expect(btn.textContent).toBe('复制失败');
        expect(btn.style.background).toContain('239, 68, 68');
        jest.advanceTimersByTime(2000);
        jest.useRealTimers();
    });

    it('copyWithFeedback 对无按钮调用安全', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: jest.fn().mockResolvedValue(undefined) },
            configurable: true,
        });
        await expect(ClipboardUtils.copyWithFeedback('text', null)).resolves.toBe(true);
    });
});
