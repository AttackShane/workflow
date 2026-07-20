let initThemeController, updateThemeButtonText;
let DOM, Storage;

jest.mock('../src/utils/helpers.js', () => ({
    DOM: {
        get: jest.fn(),
        setText: jest.fn(),
        setStyle: jest.fn(),
        setAttr: jest.fn(),
        on: jest.fn(),
    },
    Storage: {
        get: jest.fn(),
        set: jest.fn(),
    },
}));

jest.mock('../src/utils/logger.js', () => ({
    Logger: { warn: jest.fn() },
}));

jest.mock('../src/i18n/i18n.js', () => ({
    t: (key) => key,
}));

jest.mock('../src/config/constants.js', () => ({
    APP_CONFIG: {
        THEME: {
            KEY: 'workflow-converter-theme',
            DEFAULT: 'light',
            FONT_SIZE_KEY: 'workflow-converter-fontsize',
            DEFAULT_FONT_SIZE: 14,
            FONT_SIZE_MIN: 12,
            FONT_SIZE_MAX: 20,
            FONT_SIZE_STEP: 1,
        },
        LINE_NUMBERS: {
            WIDTH_CALC: (fontSize) => Math.max(65, 20 + fontSize * 3),
        },
    },
}));

function createMockElement() {
    return {
        style: {},
        _checked: false,
        get checked() {
            return this._checked;
        },
        set checked(v) {
            this._checked = v;
        },
        _text: '',
        get textContent() {
            return this._text;
        },
        set textContent(v) {
            this._text = v;
        },
        _events: {},
    };
}

function loadWithStorage(storageValues = {}) {
    jest.resetModules();

    const helpers = require('../src/utils/helpers.js');
    DOM = helpers.DOM;
    Storage = helpers.Storage;

    Storage.get.mockImplementation((key, defaultValue) => {
        if (Object.prototype.hasOwnProperty.call(storageValues, key)) return storageValues[key];
        if (key === 'workflow-converter-theme') return 'light';
        if (key === 'workflow-converter-fontsize') return 14;
        if (key === 'workflow-converter-linenumbers') return 'true';
        return defaultValue;
    });

    const themeBtn = createMockElement();
    const fontSizeDisplay = createMockElement();
    const fontSmallBtn = createMockElement();
    const fontLargeBtn = createMockElement();
    const outputArea = createMockElement();
    const lineNumbers = createMockElement();
    const lineNumbersToggle = createMockElement();

    DOM.get
        .mockReturnValueOnce(themeBtn)
        .mockReturnValueOnce(fontSizeDisplay)
        .mockReturnValueOnce(fontSmallBtn)
        .mockReturnValueOnce(fontLargeBtn)
        .mockReturnValueOnce(outputArea)
        .mockReturnValueOnce(lineNumbers)
        .mockReturnValueOnce(lineNumbersToggle);

    const mod = require('../src/modules/shared/shared-theme.js');
    initThemeController = mod.initThemeController;
    updateThemeButtonText = mod.updateThemeButtonText;

    return { themeBtn, fontSizeDisplay, fontSmallBtn, fontLargeBtn, outputArea, lineNumbers, lineNumbersToggle };
}

describe('ThemeController', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(document.documentElement, 'setAttribute').mockImplementation(() => {});
        jest.spyOn(document.documentElement.style, 'setProperty').mockImplementation(() => {});
        jest.spyOn(document, 'dispatchEvent').mockImplementation(() => {});
        global.setTimeout = jest.fn((fn) => {
            fn();
            return 1;
        });
        global.clearTimeout = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('initThemeController', () => {
        it('should initialize with default values', () => {
            loadWithStorage();

            initThemeController();

            expect(DOM.get).toHaveBeenCalledWith('themeBtn');
            expect(DOM.get).toHaveBeenCalledWith('fontSizeDisplay');
            expect(DOM.get).toHaveBeenCalledWith('fontSmallBtn');
            expect(DOM.get).toHaveBeenCalledWith('fontLargeBtn');
            expect(DOM.get).toHaveBeenCalledWith('outputArea');
            expect(DOM.get).toHaveBeenCalledWith('lineNumbers');
            expect(DOM.get).toHaveBeenCalledWith('lineNumbersToggle');
        });

        it('should set initial theme from storage', () => {
            loadWithStorage({ 'workflow-converter-theme': 'dark' });

            initThemeController();

            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
        });

        it('should set default theme when no storage value', () => {
            loadWithStorage();

            initThemeController();

            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
        });

        it('should update font size display', () => {
            loadWithStorage();

            initThemeController();

            expect(DOM.setText).toHaveBeenCalledWith(expect.any(Object), '14px');
        });

        it('should set line numbers visibility from storage', () => {
            loadWithStorage({ 'workflow-converter-linenumbers': 'false' });

            initThemeController();

            expect(DOM.setStyle).toHaveBeenCalledWith(expect.any(Object), 'display', 'none');
        });

        it('should bind event handlers', () => {
            loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            expect(clickCalls.length).toBeGreaterThanOrEqual(3);

            const changeCalls = DOM.on.mock.calls.filter((c) => c[1] === 'change');
            expect(changeCalls.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('theme toggle', () => {
        it('should toggle from light to dark theme', () => {
            const elements = loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const themeClickCall = clickCalls.find((c) => c[0] === elements.themeBtn);
            expect(themeClickCall).toBeTruthy();
            const themeToggleHandler = themeClickCall[2];

            themeToggleHandler();

            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
            expect(DOM.setText).toHaveBeenCalledWith(elements.themeBtn, 'converter.themeLight');
        });

        it('should toggle from dark to light theme', () => {
            const elements = loadWithStorage({ 'workflow-converter-theme': 'dark' });

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const themeClickCall = clickCalls.find((c) => c[0] === elements.themeBtn);
            expect(themeClickCall).toBeTruthy();
            const themeToggleHandler = themeClickCall[2];

            themeToggleHandler();

            expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
        });
    });

    describe('font size controls', () => {
        it('should decrease font size', () => {
            const elements = loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontSmallCall = clickCalls.find((c) => c[0] === elements.fontSmallBtn);
            expect(fontSmallCall).toBeTruthy();

            fontSmallCall[2]();

            expect(DOM.setText).toHaveBeenCalledWith(elements.fontSizeDisplay, '13px');
        });

        it('should not decrease font size below minimum', () => {
            const elements = loadWithStorage({ 'workflow-converter-fontsize': 12 });

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontSmallCall = clickCalls.find((c) => c[0] === elements.fontSmallBtn);
            expect(fontSmallCall).toBeTruthy();

            fontSmallCall[2]();

            expect(DOM.setText).toHaveBeenCalledWith(elements.fontSizeDisplay, '12px');
        });

        it('should increase font size', () => {
            const elements = loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontLargeCall = clickCalls.find((c) => c[0] === elements.fontLargeBtn);
            expect(fontLargeCall).toBeTruthy();

            fontLargeCall[2]();

            expect(DOM.setText).toHaveBeenCalledWith(elements.fontSizeDisplay, '15px');
        });

        it('should not increase font size above maximum', () => {
            const elements = loadWithStorage({ 'workflow-converter-fontsize': 20 });

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontLargeCall = clickCalls.find((c) => c[0] === elements.fontLargeBtn);
            expect(fontLargeCall).toBeTruthy();

            fontLargeCall[2]();

            expect(DOM.setText).toHaveBeenCalledWith(elements.fontSizeDisplay, '20px');
        });

        it('should update CSS custom properties on font size change', () => {
            const elements = loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontLargeCall = clickCalls.find((c) => c[0] === elements.fontLargeBtn);
            expect(fontLargeCall).toBeTruthy();

            fontLargeCall[2]();

            expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--code-font-size', '15px');
            expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--code-line-height', '22.5px');
        });

        it('should dispatch fontsizechange event on font size change', () => {
            const elements = loadWithStorage();

            initThemeController();

            const clickCalls = DOM.on.mock.calls.filter((c) => c[1] === 'click');
            const fontLargeCall = clickCalls.find((c) => c[0] === elements.fontLargeBtn);
            expect(fontLargeCall).toBeTruthy();

            fontLargeCall[2]();

            expect(document.dispatchEvent).toHaveBeenCalledTimes(2);
            const event = document.dispatchEvent.mock.calls[1][0];
            expect(event.type).toBe('fontsizechange');
            expect(event.detail.fontSize).toBe(15);
        });
    });

    describe('line numbers toggle', () => {
        it('should show line numbers when toggled on', () => {
            const elements = loadWithStorage();

            initThemeController();

            const changeCalls = DOM.on.mock.calls.filter((c) => c[1] === 'change');
            const toggleCall = changeCalls.find((c) => c[0] === elements.lineNumbersToggle);
            expect(toggleCall).toBeTruthy();

            elements.lineNumbersToggle._checked = true;

            toggleCall[2]();

            expect(DOM.setStyle).toHaveBeenCalledWith(elements.lineNumbers, 'display', 'block');
        });

        it('should hide line numbers when toggled off', () => {
            const elements = loadWithStorage();

            initThemeController();

            const changeCalls = DOM.on.mock.calls.filter((c) => c[1] === 'change');
            const toggleCall = changeCalls.find((c) => c[0] === elements.lineNumbersToggle);
            expect(toggleCall).toBeTruthy();

            elements.lineNumbersToggle._checked = false;

            toggleCall[2]();

            expect(DOM.setStyle).toHaveBeenCalledWith(elements.lineNumbers, 'display', 'none');
        });
    });

    describe('updateThemeButtonText', () => {
        it('should update theme button text when theme is dark', () => {
            const elements = loadWithStorage({ 'workflow-converter-theme': 'dark' });

            initThemeController();

            const beforeCalls = DOM.setText.mock.calls.length;
            DOM.setText.mockClear();
            updateThemeButtonText();

            expect(DOM.setText).toHaveBeenCalled();
        });

        it('should not crash when themeBtn is null', () => {
            DOM.get.mockReturnValueOnce(null);
            loadWithStorage();
            initThemeController();

            expect(() => updateThemeButtonText()).not.toThrow();
        });
    });
});
