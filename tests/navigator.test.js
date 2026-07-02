/**
 * 页面导航模块测试
 */

describe('Navigator', () => {
    let mockBody;
    let mockLocation;
    let mockHistory;
    let mockSessionStorage;
    let mockLocalStorage;
    let mockDocument;
    let mockWindow;
    let originalSetTimeout;
    let navigatorExports;

    beforeEach(() => {
        jest.resetModules();

        mockBody = { style: {} };
        mockLocation = { pathname: '/editor', href: '/editor' };
        mockHistory = { length: 2, back: jest.fn() };
        mockSessionStorage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        mockLocalStorage = {
            getItem: jest.fn(() => null),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        mockDocument = {
            getElementById: jest.fn(() => null),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            body: mockBody
        };
        mockWindow = {
            location: mockLocation,
            history: mockHistory,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn()
        };

        global.document = mockDocument;
        global.window = mockWindow;
        global.sessionStorage = mockSessionStorage;
        global.localStorage = mockLocalStorage;

        originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn((cb, delay) => { cb(); return 1; });

        global.i18n = undefined;

        navigatorExports = require('../src/modules/navigator.js');
    });

    afterEach(() => {
        global.setTimeout = originalSetTimeout;
        jest.restoreAllMocks();
    });

    describe('exported functions', () => {
        it('should export navigateTo', () => {
            expect(typeof navigatorExports.navigateTo).toBe('function');
        });

        it('should export goBack', () => {
            expect(typeof navigatorExports.goBack).toBe('function');
        });

        it('should export goToManager', () => {
            expect(typeof navigatorExports.goToManager).toBe('function');
        });

        it('should export goToConverter', () => {
            expect(typeof navigatorExports.goToConverter).toBe('function');
        });

        it('should export goToEditor', () => {
            expect(typeof navigatorExports.goToEditor).toBe('function');
        });

        it('should export initNavigator', () => {
            expect(typeof navigatorExports.initNavigator).toBe('function');
        });
    });

    describe('navigateTo', () => {
        it('should not navigate when already on target page', () => {
            navigatorExports.navigateTo('/editor');
            expect(mockBody.style.opacity).toBeUndefined();
        });

        it('should navigate to different page with animation', () => {
            navigatorExports.navigateTo('/converter');
            expect(mockBody.style.opacity).toBe('0');
            expect(mockBody.style.transition).toBe('opacity 0.3s ease-out');
            expect(mockLocation.href).toBe('/converter');
        });

        it('should navigate without animation', () => {
            navigatorExports.navigateTo('/converter', { animate: false });
            expect(mockLocation.href).toBe('/converter');
        });

        it('should prevent double navigation', () => {
            navigatorExports.navigateTo('/converter');
            const hrefAfterFirst = mockLocation.href;
            navigatorExports.navigateTo('/');
            expect(mockLocation.href).toBe(hrefAfterFirst);
        });

        it('should accept message option', () => {
            expect(() => navigatorExports.navigateTo('/converter', { message: 'test' })).not.toThrow();
            expect(mockLocation.href).toBe('/converter');
        });
    });

    describe('goBack', () => {
        it('should go back in history when length > 1', () => {
            navigatorExports.goBack();
            expect(mockHistory.back).toHaveBeenCalled();
        });

        it('should navigate to manager when history length <= 1', () => {
            mockHistory.length = 1;
            navigatorExports.goBack();
            expect(mockLocation.href).toBe('/');
        });
    });

    describe('goToManager', () => {
        it('should navigate to manager page', () => {
            navigatorExports.goToManager();
            expect(mockLocation.href).toBe('/');
        });
    });

    describe('goToConverter', () => {
        it('should navigate to converter page', () => {
            navigatorExports.goToConverter();
            expect(mockLocation.href).toBe('/converter');
        });
    });

    describe('goToEditor', () => {
        it('should navigate to editor page', () => {
            navigatorExports.goToEditor();
            expect(mockLocation.href).toBe('/editor');
        });

        it('should clear sessionStorage when newWorkflow is true', () => {
            navigatorExports.goToEditor({ newWorkflow: true });
            expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('editingWorkflowId');
            expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('editingWorkflow');
            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('workflow_current');
        });

        it('should not clear storage when newWorkflow is false', () => {
            navigatorExports.goToEditor({ newWorkflow: false });
            expect(mockSessionStorage.removeItem).not.toHaveBeenCalled();
        });

        it('should not clear storage when newWorkflow is not specified', () => {
            navigatorExports.goToEditor();
            expect(mockSessionStorage.removeItem).not.toHaveBeenCalled();
        });
    });

    describe('initNavigator', () => {
        it('should bind DOMContentLoaded event', () => {
            navigatorExports.initNavigator();
            expect(mockDocument.addEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
        });

        it('should bind pageshow event', () => {
            navigatorExports.initNavigator();
            expect(mockWindow.addEventListener).toHaveBeenCalledWith('pageshow', expect.any(Function));
        });

        it('should bind popstate event', () => {
            navigatorExports.initNavigator();
            expect(mockWindow.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
        });
    });
});