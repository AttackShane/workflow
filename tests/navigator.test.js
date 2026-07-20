/**
 * 页面导航模块测试
 */

describe('Navigator', () => {
    let mockHistory;
    let originalSetTimeout;
    let navigatorExports;
    let Storage;

    beforeEach(() => {
        jest.resetModules();

        mockHistory = {
            length: 2,
            back: jest.fn(),
        };

        Object.defineProperty(window, 'history', {
            value: mockHistory,
            writable: true,
            configurable: true,
        });

        originalSetTimeout = global.setTimeout;
        global.setTimeout = jest.fn(function (cb, delay) {
            global._setTimeoutCalled = true;
            global._setTimeoutDelay = delay;
            return 1;
        });

        global.i18n = undefined;

        jest.spyOn(document.body.style, 'opacity', 'set').mockImplementation(function (v) {
            this._opacity = v;
        });
        jest.spyOn(document.body.style, 'transition', 'set').mockImplementation(function (v) {
            this._transition = v;
        });
        jest.spyOn(document.documentElement, 'getAttribute').mockReturnValue(null);
        jest.spyOn(document.documentElement.style, 'backgroundColor', 'set').mockImplementation(function (v) {
            this._bg = v;
        });

        global._setTimeoutCalled = false;
        global._setTimeoutDelay = null;

        Storage = require('../src/utils/helpers.js').Storage;
        jest.spyOn(Storage.session, 'remove').mockImplementation(() => {});
        jest.spyOn(Storage, 'remove').mockImplementation(() => {});

        navigatorExports = require('../src/modules/shared/shared-navigator.js');
    });

    afterEach(() => {
        global.setTimeout = originalSetTimeout;
        delete document.body.style._opacity;
        delete document.body.style._transition;
        delete document.documentElement.style._bg;
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
            navigatorExports.navigateTo('/');
            expect(document.body.style._opacity).toBeUndefined();
            expect(global._setTimeoutCalled).toBe(false);
        });

        it('should navigate to different page with animation', () => {
            navigatorExports.navigateTo('/converter');
            expect(document.body.style._opacity).toBe('0');
            expect(document.body.style._transition).toBe('opacity 0.2s ease-out');
            expect(global._setTimeoutCalled).toBe(true);
            expect(global._setTimeoutDelay).toBe(200);
        });

        it('should navigate without animation', () => {
            navigatorExports.navigateTo('/converter', { animate: false });
            expect(global._setTimeoutCalled).toBe(true);
            expect(global._setTimeoutDelay).toBe(0);
            expect(document.body.style._opacity).toBeUndefined();
        });

        it('should prevent double navigation', () => {
            navigatorExports.navigateTo('/converter');
            expect(global._setTimeoutCalled).toBe(true);
            global._setTimeoutCalled = false;
            navigatorExports.navigateTo('/editor');
            expect(global._setTimeoutCalled).toBe(false);
        });

        it('should accept message option', () => {
            expect(() => navigatorExports.navigateTo('/converter', { message: 'test' })).not.toThrow();
            expect(global._setTimeoutCalled).toBe(true);
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
            expect(global._setTimeoutCalled).toBe(false);
        });
    });

    describe('goToManager', () => {
        it('should navigate to manager page', () => {
            navigatorExports.goToManager();
            expect(global._setTimeoutCalled).toBe(false);
        });
    });

    describe('goToConverter', () => {
        it('should navigate to converter page', () => {
            navigatorExports.goToConverter();
            expect(global._setTimeoutCalled).toBe(true);
        });
    });

    describe('goToEditor', () => {
        it('should navigate to editor page', () => {
            navigatorExports.goToEditor();
            expect(global._setTimeoutCalled).toBe(true);
        });

        it('should clear sessionStorage when newWorkflow is true', () => {
            navigatorExports.goToEditor({ newWorkflow: true });
            expect(Storage.session.remove).toHaveBeenCalledWith('editingWorkflowId');
            expect(Storage.session.remove).toHaveBeenCalledWith('editingWorkflow');
            expect(Storage.remove).toHaveBeenCalledWith('workflow_current');
            expect(global._setTimeoutCalled).toBe(true);
        });
    });

    describe('initNavigator', () => {
        it('should bind pageshow event', () => {
            const spy = jest.spyOn(window, 'addEventListener');
            navigatorExports.initNavigator();
            expect(spy).toHaveBeenCalledWith('pageshow', expect.any(Function));
            spy.mockRestore();
        });
    });
});
