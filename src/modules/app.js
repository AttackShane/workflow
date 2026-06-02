import { initUI } from './ui-controller.js';
import { initThemeController } from './theme-controller.js';
import { initKeyboardShortcuts } from './keyboard-shortcuts.js';
import { initHistoryPanel } from './stats-view.js';
import { initGraphModal } from './graph-view.js';
// 导入导航模块（模块加载时自动初始化事件监听器）
import './navigator.js';

document.addEventListener('DOMContentLoaded', () => {
    initUI();
    initThemeController();
    initKeyboardShortcuts();
    initHistoryPanel();
    initGraphModal();
});