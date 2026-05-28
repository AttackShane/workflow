import { initUI } from './ui-controller.js';
import { initThemeController } from './theme-controller.js';
import { initKeyboardShortcuts } from './keyboard-shortcuts.js';
import { initHistoryPanel } from './stats-view.js';
import { initGraphModal } from './graph-view.js';

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initThemeController();
    initKeyboardShortcuts();
    initHistoryPanel();
    initGraphModal();
});