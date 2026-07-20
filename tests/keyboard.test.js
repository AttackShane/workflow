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

        it('should handle Ctrl+F (auto layout)', () => {
            const event = createMockEvent({ key: 'f', ctrlKey: true });

            keyboard.handleKeydown(event);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(mockUI.canvas.autoOptimizeLayout).toHaveBeenCalled();
        });

        it('should handle Cmd+F (auto layout on Mac)', () => {
            const event = createMockEvent({ key: 'f', metaKey: true });

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
});
