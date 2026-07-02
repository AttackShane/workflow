/**
 * 日志模块测试
 */
import { Logger, LOG_LEVELS_CONST } from '../src/utils/logger.js';

describe('Logger', () => {
    let consoleDebugSpy;
    let consoleInfoSpy;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleGroupSpy;
    let consoleGroupEndSpy;
    let consoleTableSpy;
    let consoleTimeSpy;
    let consoleTimeEndSpy;

    beforeEach(() => {
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
        consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
        consoleTableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
        consoleTimeSpy = jest.spyOn(console, 'time').mockImplementation(() => {});
        consoleTimeEndSpy = jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

        Logger.setLevel(LOG_LEVELS_CONST.INFO);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('setLevel', () => {
        it('should prevent debug output when level is INFO', () => {
            Logger.setLevel(LOG_LEVELS_CONST.INFO);
            Logger.debug('should not appear');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should allow debug output when level is DEBUG', () => {
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug('debug message');
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'debug message');
        });

        it('should prevent all output when level is OFF', () => {
            Logger.setLevel(LOG_LEVELS_CONST.OFF);
            Logger.debug('no debug');
            Logger.info('no info');
            Logger.warn('no warn');
            Logger.error('no error');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleInfoSpy).not.toHaveBeenCalled();
            expect(consoleWarnSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });

    describe('debug', () => {
        it('should output when level is DEBUG', () => {
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug('test debug');
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'test debug');
        });

        it('should not output when level is INFO', () => {
            Logger.setLevel(LOG_LEVELS_CONST.INFO);
            Logger.debug('test debug');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
        });

        it('should handle multiple arguments', () => {
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug('msg', { data: 1 }, 42);
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'msg', { data: 1 }, 42);
        });

        it('should handle zero arguments', () => {
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug();
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]');
        });
    });

    describe('info', () => {
        it('should output when level is INFO', () => {
            Logger.info('test info');
            expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO]', 'test info');
        });

        it('should not output when level is WARN', () => {
            Logger.setLevel(LOG_LEVELS_CONST.WARN);
            Logger.info('test info');
            expect(consoleInfoSpy).not.toHaveBeenCalled();
        });

        it('should handle multiple arguments', () => {
            Logger.info('msg', 1, 2, 3);
            expect(consoleInfoSpy).toHaveBeenCalledWith('[INFO]', 'msg', 1, 2, 3);
        });
    });

    describe('warn', () => {
        it('should output when level is WARN', () => {
            Logger.setLevel(LOG_LEVELS_CONST.WARN);
            Logger.warn('test warn');
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', 'test warn');
        });

        it('should output when level is INFO (lower level)', () => {
            Logger.setLevel(LOG_LEVELS_CONST.INFO);
            Logger.warn('test warn');
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', 'test warn');
        });

        it('should not output when level is ERROR', () => {
            Logger.setLevel(LOG_LEVELS_CONST.ERROR);
            Logger.warn('test warn');
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should handle multiple arguments', () => {
            Logger.setLevel(LOG_LEVELS_CONST.WARN);
            Logger.warn('warning', { code: 404 }, 'details');
            expect(consoleWarnSpy).toHaveBeenCalledWith('[WARN]', 'warning', { code: 404 }, 'details');
        });
    });

    describe('error', () => {
        it('should output when level is ERROR', () => {
            Logger.setLevel(LOG_LEVELS_CONST.ERROR);
            Logger.error('test error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'test error');
        });

        it('should output when level is INFO (lower level)', () => {
            Logger.setLevel(LOG_LEVELS_CONST.INFO);
            Logger.error('test error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'test error');
        });

        it('should not output when level is OFF', () => {
            Logger.setLevel(LOG_LEVELS_CONST.OFF);
            Logger.error('test error');
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should handle Error objects', () => {
            Logger.setLevel(LOG_LEVELS_CONST.ERROR);
            const err = new Error('something went wrong');
            Logger.error('Failed:', err);
            expect(consoleErrorSpy).toHaveBeenCalledWith('[ERROR]', 'Failed:', err);
        });
    });

    describe('group', () => {
        it('should call console.group with label', () => {
            Logger.group('test group');
            expect(consoleGroupSpy).toHaveBeenCalledWith('test group');
        });

        it('should handle empty label', () => {
            Logger.group();
            expect(consoleGroupSpy).toHaveBeenCalledWith(undefined);
        });
    });

    describe('groupEnd', () => {
        it('should call console.groupEnd', () => {
            Logger.groupEnd();
            expect(consoleGroupEndSpy).toHaveBeenCalled();
        });
    });

    describe('table', () => {
        it('should call console.table with data', () => {
            const data = [{ name: 'a', value: 1 }, { name: 'b', value: 2 }];
            Logger.table(data);
            expect(consoleTableSpy).toHaveBeenCalledWith(data);
        });

        it('should handle empty array', () => {
            Logger.table([]);
            expect(consoleTableSpy).toHaveBeenCalledWith([]);
        });

        it('should handle null data', () => {
            Logger.table(null);
            expect(consoleTableSpy).toHaveBeenCalledWith(null);
        });
    });

    describe('time and timeEnd', () => {
        it('should call console.time with label', () => {
            Logger.time('myTimer');
            expect(consoleTimeSpy).toHaveBeenCalledWith('myTimer');
        });

        it('should call console.timeEnd with label', () => {
            Logger.timeEnd('myTimer');
            expect(consoleTimeEndSpy).toHaveBeenCalledWith('myTimer');
        });

        it('should support timing workflow', () => {
            Logger.time('start');
            Logger.timeEnd('start');
            expect(consoleTimeSpy).toHaveBeenCalledWith('start');
            expect(consoleTimeEndSpy).toHaveBeenCalledWith('start');
        });
    });

    describe('LOG_LEVELS_CONST', () => {
        it('should export all log levels', () => {
            expect(LOG_LEVELS_CONST).toEqual({
                DEBUG: 0,
                INFO: 1,
                WARN: 2,
                ERROR: 3,
                OFF: 4
            });
        });

        it('should have correct level ordering', () => {
            expect(LOG_LEVELS_CONST.DEBUG).toBeLessThan(LOG_LEVELS_CONST.INFO);
            expect(LOG_LEVELS_CONST.INFO).toBeLessThan(LOG_LEVELS_CONST.WARN);
            expect(LOG_LEVELS_CONST.WARN).toBeLessThan(LOG_LEVELS_CONST.ERROR);
            expect(LOG_LEVELS_CONST.ERROR).toBeLessThan(LOG_LEVELS_CONST.OFF);
        });
    });

    describe('log level transitions', () => {
        it('should switch from DEBUG to OFF correctly', () => {
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug('visible');
            expect(consoleDebugSpy).toHaveBeenCalled();

            jest.clearAllMocks();
            Logger.setLevel(LOG_LEVELS_CONST.OFF);
            Logger.debug('not visible');
            Logger.error('not visible');
            expect(consoleDebugSpy).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should switch from OFF to DEBUG correctly', () => {
            Logger.setLevel(LOG_LEVELS_CONST.OFF);
            Logger.debug('not visible');
            expect(consoleDebugSpy).not.toHaveBeenCalled();

            jest.clearAllMocks();
            Logger.setLevel(LOG_LEVELS_CONST.DEBUG);
            Logger.debug('now visible');
            expect(consoleDebugSpy).toHaveBeenCalledWith('[DEBUG]', 'now visible');
        });
    });
});