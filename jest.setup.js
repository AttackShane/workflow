/* eslint-disable no-unused-vars */
global.MutationObserver = class {
    constructor(callback) {}
    observe() {}
    disconnect() {}
    takeRecords() {
        return [];
    }
};

(function () {
    try {
        Object.defineProperty(global, 'localStorage', {
            value: {
                _data: {},
                getItem: function (key) {
                    return key in this._data ? this._data[key] : null;
                },
                setItem: function (key, value) {
                    this._data[key] = String(value);
                },
                removeItem: function (key) {
                    delete this._data[key];
                },
                clear: function () {
                    this._data = {};
                },
            },
            writable: true,
            configurable: true,
        });
    } catch (e) {
        // If localStorage is not configurable, fall back to direct assignment
    }

    try {
        Object.defineProperty(global, 'sessionStorage', {
            value: {
                _data: {},
                getItem: function (key) {
                    return key in this._data ? this._data[key] : null;
                },
                setItem: function (key, value) {
                    this._data[key] = String(value);
                },
                removeItem: function (key) {
                    delete this._data[key];
                },
                clear: function () {
                    this._data = {};
                },
            },
            writable: true,
            configurable: true,
        });
    } catch (e) {
        // If sessionStorage is not configurable, fall back to direct assignment
    }

    if (!global.navigator) {
        global.navigator = {};
    }
    if (!global.navigator.clipboard) {
        global.navigator.clipboard = {
            writeText: async function () {},
        };
    }
})();
