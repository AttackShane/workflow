import { Storage, deepClone, StringUtils } from '../../utils/helpers.js';
import { Dialog } from '../shared/shared-dialog.js';
import { t } from '../../i18n/i18n.js';

/**
 * 保存工作流版本快照
 * @param {string} workflowId - 工作流ID
 * @param {{ nodes?: any[], edges?: any[] }} workflowData - 工作流数据
 */
export function saveWorkflowVersion(workflowId, workflowData) {
    const versions = Storage.get('workflowVersions') || {};
    if (!versions[workflowId]) {
        versions[workflowId] = [];
    }
    versions[workflowId].push({
        versionId: `v_${Date.now()}`,
        nodes: deepClone(workflowData.nodes || []),
        edges: deepClone(workflowData.edges || []),
        timestamp: Date.now(),
    });
    if (versions[workflowId].length > 50) {
        versions[workflowId] = versions[workflowId].slice(-50);
    }
    Storage.set('workflowVersions', versions);
}

/**
 * 获取工作流的版本列表
 * @param {string} workflowId - 工作流ID
 * @returns {any[]} 版本数组
 */
export function getWorkflowVersions(workflowId) {
    const versions = Storage.get('workflowVersions') || {};
    return versions[workflowId] || [];
}

/**
 * 显示版本对比弹窗
 * @param {string} workflowId - 工作流ID
 * @param {any[]} workflows - 工作流数组
 */
export function showVersionCompare(workflowId, workflows) {
    const workflow = workflows.find((w) => w.id === workflowId);
    if (!workflow) return;
    const versions = getWorkflowVersions(workflowId);
    if (versions.length === 0) {
        Dialog.alert(t('manager.versionCompareNoHistory'));
        return;
    }
    renderVersionCompareModal(workflow, versions);
}

/**
 * 渲染版本对比弹窗
 * @param {{ name: string }} workflow - 工作流对象
 * @param {any[]} versions - 版本数组
 */
export function renderVersionCompareModal(workflow, versions) {
    const existingOverlay = document.getElementById('versionCompareOverlay');
    if (existingOverlay) existingOverlay.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'versionCompareOverlay';

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '800px';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';

    const title = document.createElement('h2');
    title.textContent = '\uD83D\uDCCA ' + t('manager.versionCompareTitle', { name: workflow.name });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.id = 'versionCompareClose';
    closeBtn.textContent = '\u00D7';

    header.append(title, closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.maxHeight = '65vh';

    const selectorsRow = document.createElement('div');
    Object.assign(selectorsRow.style, {
        display: 'flex',
        gap: '1rem',
        marginBottom: '1rem',
        alignItems: 'flex-end',
    });

    const selectA = createVersionSelect('versionA', t('manager.versionAOld'), versions);
    const selectB = createVersionSelect('versionB', t('manager.versionBNew'), versions);

    const compareBtn = document.createElement('button');
    compareBtn.className = 'btn btn-primary';
    compareBtn.id = 'btnCompareRun';
    compareBtn.textContent = t('manager.versionCompareRun');

    selectorsRow.append(selectA.wrapper, selectB.wrapper, compareBtn);

    const resultDiv = document.createElement('div');
    resultDiv.id = 'versionCompareResult';
    resultDiv.style.fontSize = '0.85rem';

    body.append(selectorsRow, resultDiv);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    const closeBtn2 = document.createElement('button');
    closeBtn2.className = 'btn btn-primary';
    closeBtn2.id = 'btnVersionCompareClose';
    closeBtn2.textContent = t('manager.versionCompareClose');

    footer.appendChild(closeBtn2);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.style.display = 'flex';

    const closeFn = () => {
        overlay.style.display = 'none';
        overlay.remove();
    };

    closeBtn.addEventListener('click', closeFn);
    closeBtn2.addEventListener('click', closeFn);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFn();
    });

    compareBtn.addEventListener('click', () => {
        const idxA = parseInt(/** @type {HTMLSelectElement} */ (overlay.querySelector('#versionA')).value);
        const idxB = parseInt(/** @type {HTMLSelectElement} */ (overlay.querySelector('#versionB')).value);
        if (idxA === idxB) {
            resultDiv.innerHTML =
                '<p style="color:var(--text-secondary);text-align:center;">' +
                t('manager.versionCompareSelect') +
                '</p>';
            return;
        }
        resultDiv.innerHTML = generateVersionDiff(versions[idxA], versions[idxB]);
    });

    if (versions.length >= 2) {
        /** @type {HTMLSelectElement} */ (overlay.querySelector('#versionB')).value = String(versions.length - 1);
        /** @type {HTMLSelectElement} */ (overlay.querySelector('#versionA')).value = String(
            Math.max(0, versions.length - 2)
        );
    }
}

/**
 * 创建版本对比的选择器组件
 * @param {string} id - select 元素 ID
 * @param {string} labelText - 标签文本
 * @param {any[]} versions - 版本数组
 * @returns {{ wrapper: HTMLDivElement, select: HTMLSelectElement }}
 */
export function createVersionSelect(id, labelText, versions) {
    const wrapper = document.createElement('div');
    wrapper.style.flex = '1';

    const label = document.createElement('label');
    label.style.cssText = 'font-size:0.8rem;color:var(--text-secondary);';
    label.textContent = labelText;

    const select = document.createElement('select');
    select.id = id;
    Object.assign(select.style, {
        width: '100%',
        padding: '0.5rem',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
    });

    versions.forEach((v, i) => {
        const d = new Date(v.timestamp);
        const ts = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        const nodeCount = v.nodes ? v.nodes.length : 0;
        const option = document.createElement('option');
        option.value = String(i);
        option.textContent = t('manager.versionOption', { index: i + 1, time: ts, count: nodeCount });
        select.appendChild(option);
    });

    wrapper.append(label, select);
    return { wrapper, select };
}

/**
 * 生成两个版本之间的差异 HTML
 * @param {{ nodes?: any[], edges?: any[] }} versionA - 旧版本
 * @param {{ nodes?: any[], edges?: any[] }} versionB - 新版本
 * @returns {string} 差异 HTML
 */
export function generateVersionDiff(versionA, versionB) {
    const nodesA = versionA.nodes || [];
    const nodesB = versionB.nodes || [];
    const edgesA = versionA.edges || [];
    const edgesB = versionB.edges || [];

    const mapA = new Map(nodesA.map((n) => [n.id, n]));
    const mapB = new Map(nodesB.map((n) => [n.id, n]));

    const addedNodes = nodesB.filter((n) => !mapA.has(n.id));
    const removedNodes = nodesA.filter((n) => !mapB.has(n.id));
    const modifiedNodes = [];
    const unchangedNodes = [];

    nodesB.forEach((n) => {
        if (mapA.has(n.id)) {
            const a = mapA.get(n.id);
            const changes = [];
            if (a.title !== n.title) changes.push(t('manager.versionChangeTitle', { old: a.title, new: n.title }));
            if (a.type !== n.type) changes.push(t('manager.versionChangeType', { old: a.type, new: n.type }));
            if (a.x !== n.x || a.y !== n.y)
                changes.push(t('manager.versionChangePosition', { x1: a.x, y1: a.y, x2: n.x, y2: n.y }));
            if (JSON.stringify(a.data) !== JSON.stringify(n.data)) changes.push(t('manager.versionChangeParams'));
            if (changes.length > 0) {
                modifiedNodes.push({ id: n.id, title: n.title, changes });
            } else {
                unchangedNodes.push(n);
            }
        }
    });

    const edgeIdsA = new Set(edgesA.map((e) => `${e.source}-${e.target}`));
    const edgeIdsB = new Set(edgesB.map((e) => `${e.source}-${e.target}`));
    const addedEdges = edgesB.filter((e) => !edgeIdsA.has(`${e.source}-${e.target}`));
    const removedEdges = edgesA.filter((e) => !edgeIdsB.has(`${e.source}-${e.target}`));

    let html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">';

    const summaryItems = [
        [t('editor.nodeCount'), nodesA.length, nodesB.length],
        [t('editor.edgeCount'), edgesA.length, edgesB.length],
        [t('manager.versionNewNodes').replace('{count}', '{0}').replace('{list}', ''), '-', addedNodes.length],
        [t('manager.versionDeletedNodes').replace('{count}', '{0}').replace('{list}', ''), removedNodes.length, '-'],
        [t('manager.versionModifiedNodes').replace('{count}', '{0}'), '-', modifiedNodes.length],
        [t('manager.versionNewEdges').replace('{count}', '{0}'), '-', addedEdges.length],
        [t('manager.versionDeletedEdges').replace('{count}', '{0}'), removedEdges.length, '-'],
    ];

    html += '<div><h4 style="margin:0 0 0.5rem;">\uD83D\uDCCA ' + t('manager.versionSummary') + '</h4>';
    html += '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;">';
    html +=
        '<tr><th style="text-align:left;padding:4px;border-bottom:1px solid var(--border);">' +
        t('manager.versionItem') +
        '</th><th style="text-align:center;padding:4px;border-bottom:1px solid var(--border);">' +
        t('manager.versionAOld') +
        '</th><th style="text-align:center;padding:4px;border-bottom:1px solid var(--border);">' +
        t('manager.versionBNew') +
        '</th></tr>';
    for (const [label, a, b] of summaryItems) {
        const aClass = typeof a === 'number' && typeof b === 'number' && a !== b ? 'color:#F59E0B;' : '';
        const bClass = typeof a === 'number' && typeof b === 'number' && a !== b ? 'color:#F59E0B;' : '';
        html += `<tr><td style="padding:4px;border-bottom:1px solid var(--border);">${label}</td><td style="text-align:center;padding:4px;border-bottom:1px solid var(--border);${aClass}">${a}</td><td style="text-align:center;padding:4px;border-bottom:1px solid var(--border);${bClass}">${b}</td></tr>`;
    }
    html += '</table></div>';

    html += '<div>';
    html += '<h4 style="margin:0 0 0.5rem;">\uD83D\uDCDD ' + t('manager.versionDetail') + '</h4>';

    if (addedNodes.length > 0) {
        html += `<div style="margin-bottom:0.5rem;color:#4CAF50;">\u2705 ${t('manager.versionNewNodes', { count: addedNodes.length, list: addedNodes.map((n) => StringUtils.escapeHtml(n.title)).join(', ') })}</div>`;
    }
    if (removedNodes.length > 0) {
        html += `<div style="margin-bottom:0.5rem;color:#EF4444;">\u274C ${t('manager.versionDeletedNodes', { count: removedNodes.length, list: removedNodes.map((n) => StringUtils.escapeHtml(n.title)).join(', ') })}</div>`;
    }
    if (modifiedNodes.length > 0) {
        html += `<div style="margin-bottom:0.5rem;color:#F59E0B;">\u270F\uFE0F ${t('manager.versionModifiedNodes', { count: modifiedNodes.length })}</div>`;
        modifiedNodes.forEach((n) => {
            html += `<div style="margin-left:1rem;margin-bottom:0.3rem;font-size:0.8rem;">\u2022 <b>${StringUtils.escapeHtml(n.title)}</b>: ${n.changes.join('; ')}</div>`;
        });
    }
    if (addedEdges.length > 0) {
        html += `<div style="margin-bottom:0.5rem;color:#4CAF50;">\uD83D\uDD17 ${t('manager.versionNewEdges', { count: addedEdges.length })}</div>`;
    }
    if (removedEdges.length > 0) {
        html += `<div style="margin-bottom:0.5rem;color:#EF4444;">\uD83D\uDD17 ${t('manager.versionDeletedEdges', { count: removedEdges.length })}</div>`;
    }
    if (
        addedNodes.length === 0 &&
        removedNodes.length === 0 &&
        modifiedNodes.length === 0 &&
        addedEdges.length === 0 &&
        removedEdges.length === 0
    ) {
        html += '<div style="color:var(--text-secondary);">' + t('manager.versionNoDiff') + '</div>';
    }

    html += '</div>';
    html += '</div>';

    return html;
}
