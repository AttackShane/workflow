import { WorkflowKeyboard } from '../src/modules/editor/editor-keyboard.js';
import { DOM, Storage } from '../src/utils/helpers.js';

jest.mock('../src/utils/helpers.js', () => {
    const actual = jest.requireActual('../src/utils/helpers.js');
    return {
        ...actual,
        DOM: {
            on: jest.fn(),
            off: jest.fn(),
            get: jest.fn(),
            create: jest.fn(() => ({ style: {} })),
            addClass: jest.fn(),
            removeClass: jest.fn(),
            setStyle: jest.fn(),
        },
        Storage: {
            ...actual.Storage,
            session: {
                ...actual.Storage.session,
                get: jest.fn(),
                set: jest.fn(),
                remove: jest.fn(),
            },
            get: jest.fn(),
            set: jest.fn(),
            remove: jest.fn(),
        },
    };
});

// Mock sessionStorage before helpers module evaluates it
const mockSessionStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
};
Object.defineProperty(global, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
});

function createMockUI() {
    const handlers = {};
    return {
        selection: {
            deleteSelected: jest.fn(),
            duplicateSelected: jest.fn(),
            selectAll: jest.fn(),
        },
        clipboard: {
            copy: jest.fn(),
            paste: jest.fn(),
        },
        history: {
            undo: jest.fn(),
            redo: jest.fn(),
        },
        confirmExit: jest.fn(),
        quickSave: jest.fn(),
        toggleSelectedNodesLock: jest.fn(),
        focusSearchInput: jest.fn(),
        canvas: {
            autoOptimizeLayout: jest.fn(),
        },
        _handlers: handlers,
    };
}

function createMockEvent(options = {}) {
    return {
        key: options.key || '',
        ctrlKey: options.ctrlKey || false,
        metaKey: options.metaKey || false,
        shiftKey: options.shiftKey || false,
        altKey: options.altKey || false,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        ...options,
    };
}

function setupMockDom(activeElementTag = 'BODY') {
    global.localStorage = {
        _data: {},
        getItem(key) {
            return this._data[key] || null;
        },
        setItem(key, value) {
            this._data[key] = value;
        },
        removeItem(key) {
            delete this._data[key];
        },
    };
    Object.defineProperty(document, 'activeElement', {
        value: { tagName: activeElementTag, isContentEditable: false },
        writable: true,
        configurable: true,
    });
    global.window = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        location: { pathname: '/editor' },
    };
    mockSessionStorage.getItem.mockReturnValue(null);
    mockSessionStorage.setItem.mockClear();
    mockSessionStorage.removeItem.mockClear();
}

function setupMockDOM() {
    const mockNavConverterBtn = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const mockNavManagerBtn = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    DOM.get.mockImplementation((id) => {
        if (id === 'navConverterBtn') return mockNavConverterBtn;
        if (id === 'navManagerBtn') return mockNavManagerBtn;
        return null;
    });
    return { mockNavConverterBtn, mockNavManagerBtn };
}

describe('WorkflowKeyboard', () => {
    let keyboard;
    let mockUI;

    beforeEach(() => {
        setupMockDom();
        mockUI = createMockUI();
        DOM.on.mockClear();
        DOM.off.mockClear();
        DOM.get.mockClear();
        keyboard = new WorkflowKeyboard(mockUI);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('handleKeydown', () => {
        it('should ignore keystrokes when input is focused', () => {
            Object.defineProperty(document, 'activeElement', {
                value: { tagName: 'INPUT', isContentEditable: false },
                writable: true,
                configurable: true,
            });
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when textarea is focused', () => {
            Object.defineProperty(document, 'activeElement', {
                value: { tagName: 'TEXTAREA', isContentEditable: false },
                writable: true,
                configurable: true,
            });
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when SELECT is focused', () => {
            Object.defineProperty(document, 'activeElement', {
                value: { tagName: 'SELECT', isContentEditable: false },
                writable: true,
                configurable: true,
            });
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should ignore keystrokes when contentEditable is true', () => {
            Object.defineProperty(document, 'activeElement', {
                value: { tagName: 'DIV', isContentEditable: true },
                writable: true,
                configurable: true,
            });
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
        });

        it('should handle Delete key', () => {
            const event = createMockEvent({ key: 'Delete' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).toHaveBeenCalled();
        });

        it('should handle Backspace key', () => {
            const event = createMockEvent({ key: 'Backspace' });

            keyboard.handleKeydown(event);

            expect(mockUI.selection.deleteSelected).toHaveBeenCalled();
        });

        it('should handle Ctrl+C (copy)', () => {
            const event = createMockEvent({ key: 'c', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.copy).toHaveBeenCalled();
        });

        it('should handle Cmd+C (copy on Mac)', () => {
            const event = createMockEvent({ key: 'c', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.copy).toHaveBeenCalled();
        });

        it('should handle Ctrl+V (paste)', () => {
            const event = createMockEvent({ key: 'v', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.paste).toHaveBeenCalled();
        });

        it('should handle Cmd+V (paste on Mac)', () => {
            const event = createMockEvent({ key: 'v', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.clipboard.paste).toHaveBeenCalled();
        });

        it('should handle Ctrl+D (duplicate)', () => {
            const event = createMockEvent({ key: 'd', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).toHaveBeenCalled();
        });

        it('should handle Cmd+D (duplicate on Mac)', () => {
            const event = createMockEvent({ key: 'd', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).toHaveBeenCalled();
        });

        it('should handle Ctrl+A (select all)', () => {
            const event = createMockEvent({ key: 'a', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.selectAll).toHaveBeenCalled();
        });

        it('should handle Cmd+A (select all on Mac)', () => {
            const event = createMockEvent({ key: 'a', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.selection.selectAll).toHaveBeenCalled();
        });

        it('should handle Ctrl+Z (undo)', () => {
            const event = createMockEvent({ key: 'z', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.undo).toHaveBeenCalled();
        });

        it('should handle Cmd+Z (undo on Mac)', () => {
            const event = createMockEvent({ key: 'z', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.undo).toHaveBeenCalled();
        });

        it('should not trigger undo with Ctrl+Shift+Z', () => {
            const event = createMockEvent({ key: 'z', ctrlKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(mockUI.history.undo).not.toHaveBeenCalled();
        });

        it('should handle Ctrl+Y (redo)', () => {
            const event = createMockEvent({ key: 'y', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.redo).toHaveBeenCalled();
        });

        it('should handle Cmd+Shift+Z (redo on Mac)', () => {
            // Test custom shortcut configuration for Mac
            keyboard.shortcuts.redo = 'Cmd+Shift+Z';
            const event = createMockEvent({ key: 'z', metaKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.history.redo).toHaveBeenCalled();
        });

        it('should handle Escape key', () => {
            const event = createMockEvent({ key: 'Escape' });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.confirmExit).toHaveBeenCalled();
        });

        it('should handle Ctrl+S (save)', () => {
            const event = createMockEvent({ key: 's', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.quickSave).toHaveBeenCalled();
        });

        it('should handle Cmd+S (save on Mac)', () => {
            const event = createMockEvent({ key: 's', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.quickSave).toHaveBeenCalled();
        });

        it('should handle Ctrl+F (focus search input)', () => {
            const event = createMockEvent({ key: 'f', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.focusSearchInput).toHaveBeenCalled();
        });

        it('should handle Cmd+F (focus search input on Mac)', () => {
            const event = createMockEvent({ key: 'f', metaKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.focusSearchInput).toHaveBeenCalled();
        });

        it('should handle Ctrl+Shift+L (auto optimize layout)', () => {
            const event = createMockEvent({ key: 'L', ctrlKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.canvas.autoOptimizeLayout).toHaveBeenCalled();
        });

        it('should handle Cmd+Shift+L (auto optimize layout on Mac)', () => {
            const event = createMockEvent({ key: 'L', metaKey: true, shiftKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.canvas.autoOptimizeLayout).toHaveBeenCalled();
        });

        it('should pass through non-shortcut keys', () => {
            const event = createMockEvent({ key: 'x' });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockUI.selection.deleteSelected).not.toHaveBeenCalled();
            expect(mockUI.clipboard.copy).not.toHaveBeenCalled();
            expect(mockUI.clipboard.paste).not.toHaveBeenCalled();
        });

        it('should not trigger actions for regular key presses with modifiers but wrong key', () => {
            const event = createMockEvent({ key: 'x', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).not.toHaveBeenCalled();
            expect(mockUI.clipboard.copy).not.toHaveBeenCalled();
            expect(mockUI.clipboard.paste).not.toHaveBeenCalled();
            expect(mockUI.selection.duplicateSelected).not.toHaveBeenCalled();
            expect(mockUI.selection.selectAll).not.toHaveBeenCalled();
            expect(mockUI.history.undo).not.toHaveBeenCalled();
            expect(mockUI.history.redo).not.toHaveBeenCalled();
            expect(mockUI.quickSave).not.toHaveBeenCalled();
        });
    });

    describe('setupEventListeners', () => {
        it('should bind keydown handler', () => {
            keyboard.setupEventListeners();
            expect(DOM.on).toHaveBeenCalledWith(expect.anything(), 'keydown', expect.any(Function));
        });

        it('should bind navConverterBtn click', () => {
            const { mockNavConverterBtn } = setupMockDOM();
            keyboard.setupEventListeners();

            expect(DOM.on).toHaveBeenCalledWith(mockNavConverterBtn, 'click', expect.any(Function));
        });

        it('should bind navManagerBtn click', () => {
            const { mockNavManagerBtn } = setupMockDOM();
            keyboard.setupEventListeners();

            expect(DOM.on).toHaveBeenCalledWith(mockNavManagerBtn, 'click', expect.any(Function));
        });

        it('should trigger navConverterBtn handler to clear sessionStorage', () => {
            const { mockNavConverterBtn } = setupMockDOM();
            Storage.session.remove.mockClear();
            keyboard.setupEventListeners();

            const handlerCalls = DOM.on.mock.calls.filter((call) => call[1] === 'click');
            const navConverterCall = handlerCalls[0];
            const handler = navConverterCall[2];
            handler();

            expect(Storage.session.remove).toHaveBeenCalledWith('editingWorkflowId');
        });

        it('should trigger navManagerBtn handler when no savedWorkflow', () => {
            const { mockNavManagerBtn } = setupMockDOM();
            Storage.session.get.mockReturnValue(null);
            Storage.session.remove.mockClear();
            keyboard.setupEventListeners();

            const handlerCalls = DOM.on.mock.calls.filter((call) => call[1] === 'click');
            const navManagerCall = handlerCalls[1];
            const handler = navManagerCall[2];
            handler();

            expect(Storage.session.remove).toHaveBeenCalledWith('editingWorkflowId');
        });

        it('should not remove editingWorkflowId when savedWorkflow exists', () => {
            const { mockNavManagerBtn } = setupMockDOM();
            Storage.session.get.mockReturnValue('workflow-data');
            Storage.session.remove.mockClear();
            keyboard.setupEventListeners();

            const handlerCalls = DOM.on.mock.calls.filter((call) => call[1] === 'click');
            const navManagerCall = handlerCalls[1];
            const handler = navManagerCall[2];
            handler();

            expect(Storage.session.remove).not.toHaveBeenCalledWith('editingWorkflowId');
        });
    });

    describe('destroy', () => {
        it('should remove keydown handler', () => {
            keyboard.setupEventListeners();
            keyboard.destroy();

            expect(DOM.off).toHaveBeenCalledWith(expect.anything(), 'keydown', expect.any(Function));
        });

        it('should remove navConverterBtn handler', () => {
            const { mockNavConverterBtn } = setupMockDOM();
            keyboard.setupEventListeners();
            keyboard.destroy();

            expect(DOM.off).toHaveBeenCalledWith(mockNavConverterBtn, 'click', expect.any(Function));
        });

        it('should remove navManagerBtn handler', () => {
            const { mockNavManagerBtn } = setupMockDOM();
            keyboard.setupEventListeners();
            keyboard.destroy();

            expect(DOM.off).toHaveBeenCalledWith(mockNavManagerBtn, 'click', expect.any(Function));
        });

        it('should handle destroy when handlers are null', () => {
            keyboard.destroy();
            expect(keyboard._keydownHandler).toBeNull();
        });
    });

    describe('parseShortcut', () => {
        it('解析 Ctrl+C', () => {
            expect(keyboard.parseShortcut('Ctrl+C')).toEqual({
                ctrl: true,
                shift: false,
                alt: false,
                meta: false,
                key: 'C',
            });
        });
        it('解析 Ctrl+Shift+Z（大写规范格式）', () => {
            expect(keyboard.parseShortcut('Ctrl+Shift+Z')).toEqual({
                ctrl: true,
                shift: true,
                alt: false,
                meta: false,
                key: 'Z',
            });
        });
        it('解析 Cmd（Meta）等价 Ctrl', () => {
            expect(keyboard.parseShortcut('Cmd+S')).toEqual({
                ctrl: false,
                shift: false,
                alt: false,
                meta: true,
                key: 'S',
            });
        });
        it('解析含 Alt 的组合', () => {
            expect(keyboard.parseShortcut('Alt+Delete')).toEqual({
                ctrl: false,
                shift: false,
                alt: true,
                meta: false,
                key: 'Delete',
            });
        });
        it('Control 作为 Ctrl 别名', () => {
            expect(keyboard.parseShortcut('Control+A').ctrl).toBe(true);
        });
    });

    describe('matchShortcut', () => {
        it('单字符键大小写不敏感匹配', () => {
            const e = createMockEvent({ key: 'c', ctrlKey: true });
            expect(keyboard.matchShortcut(e, 'Ctrl+C')).toBe(true);
        });
        it('修饰键不匹配时返回 false', () => {
            const e = createMockEvent({ key: 'c', ctrlKey: false });
            expect(keyboard.matchShortcut(e, 'Ctrl+C')).toBe(false);
        });
        it('Meta 等价 Ctrl 匹配', () => {
            const e = createMockEvent({ key: 's', metaKey: true });
            expect(keyboard.matchShortcut(e, 'Ctrl+S')).toBe(true);
        });
        it('字符串键（如 Delete）精确匹配', () => {
            const e = createMockEvent({ key: 'Delete' });
            expect(keyboard.matchShortcut(e, 'Delete')).toBe(true);
            const e2 = createMockEvent({ key: 'Backspace' });
            expect(keyboard.matchShortcut(e2, 'Delete')).toBe(false);
        });
        it('Shift 不匹配时返回 false', () => {
            const e = createMockEvent({ key: 'z', ctrlKey: true });
            expect(keyboard.matchShortcut(e, 'Ctrl+Shift+Z')).toBe(false);
        });
    });

    describe('快捷键持久化', () => {
        it('saveShortcuts 合并并写入 Storage', () => {
            keyboard.saveShortcuts({ copy: 'Ctrl+Shift+C' });
            expect(keyboard.shortcuts.copy).toBe('Ctrl+Shift+C');
            expect(Storage.set).toHaveBeenCalledWith('keyboardShortcuts', keyboard.shortcuts);
        });
        it('getShortcuts 返回副本', () => {
            const s1 = keyboard.getShortcuts();
            s1.copy = 'X';
            expect(keyboard.shortcuts.copy).not.toBe('X');
        });
        it('resetShortcuts 恢复默认并清除 Storage', () => {
            keyboard.saveShortcuts({ copy: 'Ctrl+Shift+C' });
            keyboard.resetShortcuts();
            expect(keyboard.shortcuts.copy).toBe('Ctrl+C');
            expect(Storage.remove).toHaveBeenCalledWith('keyboardShortcuts');
        });
        it('_loadShortcuts 合并已保存配置', () => {
            Storage.get.mockReturnValue({ lock: 'Ctrl+L' });
            const kb = new WorkflowKeyboard(createMockUI());
            expect(kb.shortcuts.lock).toBe('Ctrl+L');
            expect(kb.shortcuts.copy).toBe('Ctrl+C'); // 默认保留
        });
        it('_loadShortcuts 非对象时回退默认', () => {
            Storage.get.mockReturnValue('invalid');
            const kb = new WorkflowKeyboard(createMockUI());
            expect(kb.shortcuts.copy).toBe('Ctrl+C');
        });
    });

    describe('锁节点快捷键', () => {
        it('Ctrl+L 触发 toggleSelectedNodesLock', () => {
            const event = createMockEvent({ key: 'l', ctrlKey: true });
            keyboard.handleKeydown(event);
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.toggleSelectedNodesLock).toHaveBeenCalled();
        });
        it('非锁快捷键不触发', () => {
            const event = createMockEvent({ key: 'x', ctrlKey: true });
            keyboard.handleKeydown(event);
            expect(mockUI.toggleSelectedNodesLock).not.toHaveBeenCalled();
        });
    });

    describe('showShortcutSettings', () => {
        function mountModal() {
            const overlay = document.createElement('div');
            overlay.id = 'shortcutModalOverlay';
            const body = document.createElement('div');
            body.id = 'shortcutModalBody';
            document.body.appendChild(overlay);
            document.body.appendChild(body);
            return { overlay, body };
        }
        afterEach(() => {
            document.body.innerHTML = '';
        });
        it('overlay/body 不存在时安全跳过', () => {
            expect(() => keyboard.showShortcutSettings()).not.toThrow();
        });
        it('渲染快捷键列表并绑定编辑按钮', () => {
            const { body } = mountModal();
            keyboard.showShortcutSettings();
            expect(body.innerHTML).toContain('shortcut-item');
            expect(body.innerHTML).toContain('Ctrl+C');
            const btns = body.querySelectorAll('.shortcut-edit-btn');
            expect(btns.length).toBeGreaterThan(0);
        });
        it('编辑按钮捕获按键并保存新快捷键', () => {
            const { body } = mountModal();
            Storage.set.mockClear();
            keyboard.showShortcutSettings();
            const btn = body.querySelector('.shortcut-edit-btn');
            btn.click();
            // 模拟用户按下 Ctrl+L（通过 document 捕获监听）
            const evt = new KeyboardEvent('keydown', { key: 'l', ctrlKey: true, bubbles: true });
            Object.defineProperty(evt, 'preventDefault', { value: jest.fn() });
            Object.defineProperty(evt, 'stopPropagation', { value: jest.fn() });
            document.dispatchEvent(evt);
            expect(Storage.set).toHaveBeenCalled();
        });
    });

    describe('hideShortcutSettings', () => {
        afterEach(() => {
            document.body.innerHTML = '';
        });
        it('overlay 不存在时安全跳过', () => {
            expect(() => keyboard.hideShortcutSettings()).not.toThrow();
        });
        it('设置 overlay 隐藏', () => {
            const overlay = document.createElement('div');
            overlay.id = 'shortcutModalOverlay';
            document.body.appendChild(overlay);
            keyboard.hideShortcutSettings();
            expect(overlay.style.display).toBe('none');
        });
    });

    describe('setupShortcutSettingsEvents', () => {
        afterEach(() => {
            document.body.innerHTML = '';
        });
        it('各按钮/overlay 存在时绑定监听且安全', () => {
            const ids = [
                'btnShortcuts',
                'btnShortcutClose',
                'btnResetShortcuts',
                'shortcutModalClose',
                'shortcutModalOverlay',
            ];
            const els = {};
            ids.forEach((id) => {
                const el = document.createElement('div');
                el.id = id;
                document.body.appendChild(el);
                els[id] = el;
            });
            expect(() => keyboard.setupShortcutSettingsEvents()).not.toThrow();
            // 绑定后点击重置按钮应触发 resetShortcuts（Storage.remove 被调用）
            Storage.remove.mockClear();
            els.btnResetShortcuts.click();
            expect(Storage.remove).toHaveBeenCalledWith('keyboardShortcuts');
        });
        it('元素缺失时安全跳过', () => {
            expect(() => keyboard.setupShortcutSettingsEvents()).not.toThrow();
        });
    });
});
