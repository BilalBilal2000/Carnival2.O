
/********************
   * Constants & State
   ********************/
const API_BASE = window.location.origin + '/api';

const DB = {
    settings: {
        eventTitle: 'Science Carnival 2025',
        subtitle: 'Project Evaluation System',
        welcomeTitle: 'Welcome to Science Carnival 2025',
        welcomeBody: 'Please select your role to continue.',
        logoUrl: 'https://dummyimage.com/128x128/1f2a52/ffffff&text=SE'
    },
    evaluators: [],
    projects: [],
    panels: [],
    rubricDefs: [
        { key: 'problem', label: 'Problem Statement Clarity' },
        { key: 'originality', label: 'Originality' },
        { key: 'description', label: 'Project Description Quality' },
        { key: 'method', label: 'Methodology & Design' },
        { key: 'impact', label: 'Practical Application / Impact' },
        { key: 'presentation', label: 'Presentation & Q&A' }
    ],
    results: [],
    evaluatorState: {}
};

/********************
 * API Client
 ********************/
const API = {
    token: null,

    async _request(url, options = {}) {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        try {
            const res = await fetch(API_BASE + url, { ...options, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Request failed');
            return data;
        } catch (err) {
            console.error('API Error:', err);
            throw err;
        }
    },

    async loadData() {
        const data = await this._request('/data');
        DB.settings = data.settings || DB.settings;
        // Use backend rubric if available, otherwise keep defaults (for safety/migration)
        if (DB.settings.rubric && DB.settings.rubric.length > 0) {
            DB.rubricDefs = DB.settings.rubric;
        }
        DB.evaluators = data.evaluators || [];
        DB.projects = data.projects || [];
        DB.panels = data.panels || [];
        DB.results = data.results || [];
        DB.evaluatorState = data.evaluatorState || {};

        // Default Carousel Slides if none exist
        if (!DB.settings.carouselSlides || DB.settings.carouselSlides.length === 0) {
            DB.settings.carouselSlides = [
                { imageUrl: 'carousel1.png', title: 'Innovative Science Carnival', description: 'Empowering future scientists to showcase their groundbreaking ideas.' },
                { imageUrl: 'carousel2.png', title: 'Digital Evaluation Excellence', description: 'Streamlined, fair, and transparent evaluation for every project.' },
                { imageUrl: 'carousel3.png', title: 'The Future of Innovation', description: 'Witness the next generation of engineers and dreamers in action.' }
            ];
        }

        console.log('Data loaded:', DB);
        return data;
    },

    async adminLogin(email, password) {
        return this._request('/auth/admin-login', { method: 'POST', body: JSON.stringify({ email, password }) });
    },

    async evaluatorLogin(email, code) {
        return this._request('/auth/eval-login', { method: 'POST', body: JSON.stringify({ email, code }) });
    },

    async saveSettings(settings) {
        return this._request('/settings', { method: 'PUT', body: JSON.stringify(settings) });
    },

    async saveProject(project) {
        if (DB.projects.find(p => p.id === project.id)) {
            return this._request(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
        } else {
            return this._request('/projects', { method: 'POST', body: JSON.stringify(project) });
        }
    },
    async deleteProject(id) {
        return this._request(`/projects/${id}`, { method: 'DELETE' });
    },

    async saveEvaluator(evaluator) {
        if (DB.evaluators.find(e => e.id === evaluator.id)) {
            return this._request(`/evaluators/${evaluator.id}`, { method: 'PUT', body: JSON.stringify(evaluator) });
        } else {
            return this._request('/evaluators', { method: 'POST', body: JSON.stringify(evaluator) });
        }
    },
    async deleteEvaluator(id) {
        return this._request(`/evaluators/${id}`, { method: 'DELETE' });
    },

    async savePanel(panel) {
        if (DB.panels.find(p => p.id === panel.id)) {
            return this._request(`/panels/${panel.id}`, { method: 'PUT', body: JSON.stringify(panel) });
        } else {
            return this._request('/panels', { method: 'POST', body: JSON.stringify(panel) });
        }
    },
    async deletePanel(id) {
        return this._request(`/panels/${id}`, { method: 'DELETE' });
    },

    async saveResult(result) {
        return this._request('/results', { method: 'POST', body: JSON.stringify(result) });
    },

    async finalizeEvaluator(evaluatorId) {
        return this._request('/evaluator/finalize', { method: 'POST', body: JSON.stringify({ evaluatorId }) });
    },
    async updateProfile(evaluator) {
        return this._request('/evaluator/profile', { method: 'POST', body: JSON.stringify({ evaluator }) });
    },
    async resetAll() {
        return this._request('/admin/reset', { method: 'POST' });
    }
};

/********************
 * Utils & UI
 ********************/
const U = {
    uid: (type = 'item') => {
        const prefix = { project: 'PRJ', evaluator: 'EVAL', panel: 'PNL', result: 'RES' }[type] || 'ID';
        // Note: For a real DB, we rely on the server ID usually, but for new items we generate one for the frontend to track before save
        // Simplified UUID generator
        return prefix + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    },
    el: (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild },
    fmtDate: (ts) => new Date(ts).toLocaleString(),
    download(name, obj) {
        const blob = new Blob([typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
    },
    downloadExcel(filename, sheetsData) {
        // sheetsData: { "Sheet Name": [data_array], ... }
        const wb = XLSX.utils.book_new();
        for (const [name, data] of Object.entries(sheetsData)) {
            const ws = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(wb, ws, name);
        }
        XLSX.writeFile(wb, filename);
    },
    csv(rows) {
        if (!rows || !rows.length) return '';
        const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
        const esc = (v) => ('' + (v ?? '')).replaceAll('"', '""');
        const out = [keys.join(',')].concat(rows.map(r => keys.map(k => `"${esc(r[k])}"`).join(',')));
        return out.join('\n');
    }
};

const UI = {
    show(id) {
        document.querySelectorAll('.card, #evalApp, #adminApp').forEach(el => {
            if (el.id === 'userControls' || el.classList.contains('header-logo')) return;

            if (el.id === id) el.classList.remove('hidden');
            else {
                if (el.id === 'evalApp' && id.startsWith('eval')) el.classList.remove('hidden');
                else if (!el.closest('.header') && el.id !== 'modalContainer') el.classList.add('hidden');
            }
        });
        if (id === 'evalApp' || id.startsWith('eval')) document.getElementById('evalApp').classList.remove('hidden');
        if (id === 'adminApp' || id.startsWith('adminView')) document.getElementById('adminApp').classList.remove('hidden');
        this.syncBranding();
    },
    backToGate() {
        ['adminEmail', 'adminPass', 'evalEmail', 'evalCode'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = ''
        });
        Auth.currentAdmin = null;
        Auth.currentEval = null;
        API.token = null;

        document.getElementById('adminLoginCard')?.classList.add('hidden');
        document.getElementById('evalLoginCard')?.classList.add('hidden');
        document.getElementById('adminApp')?.classList.add('hidden');
        document.getElementById('evalApp')?.classList.add('hidden');

        document.getElementById('roleGate').classList.remove('hidden');
        this.syncBranding();
    },
    syncBranding() {
        document.getElementById('appTitle').textContent = DB.settings.eventTitle;
        document.getElementById('appSubtitle').textContent = DB.settings.subtitle;
        document.getElementById('appLogo').src = DB.settings.logoUrl || 'https://dummyimage.com/128x128/1f2a52/ffffff&text=SE';
        document.getElementById('welcomeTitle').textContent = DB.settings.welcomeTitle;
        document.getElementById('welcomeBody').textContent = DB.settings.welcomeBody;

        const uc = document.getElementById('userControls'); uc.innerHTML = '';
        if (Auth.currentAdmin) {
            uc.style.display = 'flex';
            uc.appendChild(U.el(`<div class="userBadge">Admin</div>`));
            const btn = U.el(`<button class="headerLogout">Logout</button>`); btn.onclick = () => Auth.logoutAdmin(); uc.appendChild(btn);
            return;
        }
        if (Auth.currentEval) {
            uc.style.display = 'flex';
            uc.appendChild(U.el(`<div class="userBadge">${Auth.currentEval.name || Auth.currentEval.email}</div>`));
            const btn = U.el(`<button class="headerLogout">Logout</button>`); btn.onclick = () => Auth.logoutEvaluator(); uc.appendChild(btn);
            const eb = document.getElementById('evalBadge'); if (eb) { eb.textContent = Auth.currentEval.name || Auth.currentEval.email; eb.classList.remove('hidden'); }
            return;
        }
        uc.style.display = 'none';
    },
    showLoading(msg = 'Loading...') {
        const existing = document.getElementById('globalLoading');
        if (existing) existing.remove();
        const loader = U.el(`<div id="globalLoading" style="position:fixed;top:70px;right:16px;background:var(--card);border:1px solid var(--border);padding:12px 16px;border-radius:10px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.3)"><div style="display:flex;align-items:center;gap:10px"><span class="spinner"></span><span>${msg}</span></div></div>`);
        document.body.appendChild(loader);
    },
    hideLoading() {
        const loader = document.getElementById('globalLoading');
        if (loader) loader.remove();
    },
    alert(message, type = 'info', title = 'Notification') {
        return new Promise(resolve => {
            const existing = document.querySelector('.custom-alert-wrap');
            if (existing) existing.remove();

            const dlg = U.el(`<div class="custom-alert-wrap">
                <div class="custom-alert ${type}">
                    <h3>${title}</h3>
                    <p style="white-space: pre-wrap;">${message}</p>
                    <button class="btn" style="width:100%">OK</button>
                </div>
            </div>`);
            document.body.appendChild(dlg);

            dlg.querySelector('button').onclick = () => {
                dlg.remove();
                resolve();
            };
        });
    },
    confirm(message, title = 'Confirm Action') {
        return new Promise(resolve => {
            const existing = document.querySelector('.custom-alert-wrap');
            if (existing) existing.remove();

            const dlg = U.el(`<div class="custom-alert-wrap">
                <div class="custom-alert info">
                    <h3>${title}</h3>
                    <p style="white-space: pre-wrap;">${message}</p>
                    <div class="toolbar" style="gap:10px">
                        <button class="btn secondary" id="cancelConfirm" style="flex:1">Cancel</button>
                        <button class="btn" id="okConfirm" style="flex:1">Confirm</button>
                    </div>
                </div>
            </div>`);
            document.body.appendChild(dlg);

            dlg.querySelector('#cancelConfirm').onclick = () => { dlg.remove(); resolve(false); };
            dlg.querySelector('#okConfirm').onclick = () => { dlg.remove(); resolve(true); };
        });
    },
    initCarousel() {
        const slides = DB.settings.carouselSlides || [];
        const track = document.querySelector('.carousel-track');
        if (!track) return;

        if (slides.length === 0) {
            document.getElementById('landingCarousel').style.display = 'none';
            return;
        }

        track.innerHTML = slides.map((s, i) => `
            <div class="carousel-slide ${i === 0 ? 'active' : ''}" style="background-image: linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url('${s.imageUrl}')">
                <div class="carousel-content">
                    <h1>${s.title || 'Welcome'}</h1>
                    <p>${s.description || ''}</p>
                </div>
            </div>
        `).join('');

        let current = 0;
        if (slides.length > 1) {
            setInterval(() => {
                const slides = track.querySelectorAll('.carousel-slide');
                if (!slides.length) return;
                slides[current].classList.remove('active');
                current = (current + 1) % slides.length;
                slides[current].classList.add('active');
            }, 5000);
        }
    }
};

const Auth = {
    currentAdmin: null,
    currentEval: null,

    async adminLogin() {
        const email = document.getElementById('adminEmail').value.trim();
        const pass = document.getElementById('adminPass').value.trim();
        const msg = document.getElementById('adminLoginMsg');

        if (!email || !pass) {
            msg.textContent = 'Email and password required';
            msg.classList.remove('hidden');
            return;
        }

        try {
            UI.showLoading('Authenticating admin...');
            const res = await API.adminLogin(email, pass);
            API.token = res.token;
            this.currentAdmin = { email };

            await API.loadData();
            UI.hideLoading();

            UI.show('adminApp');
            Admin.render();

        } catch (err) {
            UI.hideLoading();
            msg.textContent = err.message;
            msg.classList.remove('hidden');
        }
    },

    async evaluatorLogin() {
        const email = document.getElementById('evalEmail').value.trim();
        const code = document.getElementById('evalCode').value.trim();
        const msg = document.getElementById('evalLoginMsg');

        try {
            UI.showLoading('Authenticating evaluator...');
            const res = await API.evaluatorLogin(email, code);
            API.token = res.token;
            this.currentEval = res.evaluator;

            await API.loadData();
            UI.hideLoading();

            UI.show('evalWelcome');
        } catch (err) {
            UI.hideLoading();
            msg.textContent = err.message;
            msg.classList.remove('hidden');
        }
    },

    async logoutAdmin() {
        if (!await UI.confirm('Are you sure you want to log out from Admin panel?', 'Logout admin?')) return;
        this.currentAdmin = null;
        UI.backToGate();
    },

    async logoutEvaluator() {
        if (!await UI.confirm('Are you sure you want to log out from Evaluator panel?', 'Logout evaluator?')) return;
        this.currentEval = null;
        UI.backToGate();
    }
};

const Admin = {
    tabs: [
        { id: 'scores', label: 'Scores' },
        { id: 'rubric', label: 'Evaluation Rubric' },
        { id: 'settings', label: 'Settings' },
        { id: 'projects', label: 'Projects' },
        { id: 'evaluators', label: 'Evaluators' },
        { id: 'panels', label: 'Jury Panels' },
        { id: 'data', label: 'Data & Export' }
    ],
    render() {
        const tabs = document.getElementById('adminTabs');
        tabs.innerHTML = '';
        this.tabs.forEach((t, i) => {
            const b = U.el(`<button class="tab ${i === 0 ? 'active' : ''}" data-id="${t.id}">${t.label}</button>`);
            b.onclick = (e) => this.switch(e.target.getAttribute('data-id'));
            tabs.appendChild(b);
        });
        this.switch('scores');
        UI.syncBranding();
    },
    switch(id) {
        document.querySelectorAll('#adminTabs .tab').forEach(tb => tb.classList.remove('active'));
        const targetTab = document.querySelector(`#adminTabs .tab[data-id="${id}"]`);
        if (targetTab) targetTab.classList.add('active');
        const v = document.getElementById('adminView');
        this[id](v);
        UI.syncBranding();
    },

    // --- Tabs ---
    scores(host) {
        const projectScores = DB.projects.map(project => {
            const projectResults = DB.results.filter(r => r.projectId === project.id);
            if (projectResults.length === 0) {
                return { id: project.id, title: project.title, category: project.category || '—', team: project.team || '—', school: project.school || '—', evaluatorCount: 0, totalScore: 0, averageScore: 0, maxPossible: DB.rubricDefs.length * 10, percentage: 0 };
            }
            const totalScore = projectResults.reduce((sum, r) => sum + (r.total || 0), 0);
            const averageScore = totalScore / projectResults.length;
            const maxPossible = DB.rubricDefs.length * 10;
            const percentage = (averageScore / maxPossible) * 100;
            return { id: project.id, title: project.title, category: project.category || '—', team: project.team || '—', school: project.school || '—', evaluatorCount: projectResults.length, totalScore, averageScore, maxPossible, percentage };
        });

        projectScores.sort((a, b) => b.averageScore - a.averageScore);

        const rows = projectScores.map((ps, index) => {
            const isTop5 = index < 5 && ps.evaluatorCount > 0;
            const rowStyle = isTop5 ? 'background: linear-gradient(90deg, #1a2454, #0f1534); border-left: 4px solid #7c9cff;' : '';
            const badge = isTop5 ? `<span class="pill" style="background:#7c9cff;color:#000;font-weight:700">TOP ${index + 1}</span>` : '';

            return `<tr style="${rowStyle}">
                      <td>${badge}${badge ? '<br>' : ''}<b>${ps.title}</b><div class="hint" style="margin-top:4px">${ps.team}</div></td>
                      <td>${ps.category}<div class="hint">${ps.school}</div></td>
                      <td style="text-align:center"><span class="pill">${ps.evaluatorCount} evaluator${ps.evaluatorCount !== 1 ? 's' : ''}</span></td>
                      <td style="text-align:right"><b style="font-size:18px;color:${isTop5 ? 'var(--acc)' : 'inherit'}">${ps.averageScore.toFixed(2)}</b><div class="hint">out of ${ps.maxPossible}</div></td>
                      <td style="text-align:right"><b style="font-size:16px;color:${ps.percentage >= 80 ? 'var(--good)' : ps.percentage >= 60 ? '#fbbf24' : 'inherit'}">${ps.percentage.toFixed(1)}%</b></td>
                      <td style="text-align:center"><button class="btn" onclick="Admin.viewProjectDetails('${ps.id}')">Details</button></td>
                    </tr>`;
        }).join('');

        host.innerHTML = `<div class="card"><div class="flex-between" style="margin-bottom:12px"><h3>Scores</h3><button class="btn" onclick="Admin.exportScores()">Export CSV</button></div><div class="table-wrapper"><table><thead><tr><th>Project</th><th>Theme</th><th style="text-align:center">Evaluations</th><th style="text-align:right">Avg Score</th><th style="text-align:right">%</th><th style="text-align:center">Action</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">No data</td></tr>'}</tbody></table></div></div>`;
    },

    viewProjectDetails(projectId) {
        const project = DB.projects.find(p => p.id === projectId);
        if (!project) return;
        const projectResults = DB.results.filter(r => r.projectId === projectId);

        const evaluatorRows = projectResults.map(r => {
            const evaluator = DB.evaluators.find(e => e.id === r.evaluatorId);
            const evalName = evaluator?.name || evaluator?.email || 'Unknown';
            const scoreBreakdown = DB.rubricDefs.map(def => `<div style="margin:4px 0"><span class="hint">${def.label}:</span> <b>${r.scores?.[def.key] || 0}</b>/10</div>`).join('');
            return `<div class="card" style="margin-bottom:10px">
                        <div class="flex-between"><div><b>${evalName}</b></div><div style="font-weight:700">${r.total || 0}</div></div>
                        <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">${scoreBreakdown}</div>
                        ${r.remark ? `<div style="margin-top:10px;background:#000;padding:8px;border-radius:4px">${r.remark}</div>` : ''}
                    </div>`;
        }).join('');

        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>${project.title}</h3><div style="margin-bottom:16px" class="hint">${project.category} | ${project.team}</div>${evaluatorRows || '<p>No evaluations yet.</p>'}<div class="toolbar" style="margin-top:16px"><button class="btn secondary" id="closeDetails">Close</button></div></div></div>`);
        document.body.appendChild(dlg);
        dlg.querySelector('#closeDetails').onclick = () => dlg.remove();
    },

    exportScores() {
        // 1. Determine rubric keys
        const keys = DB.rubricDefs.map(d => d.key);

        // 2. Find max evaluators to set column headers
        let maxEvals = 0;
        DB.projects.forEach(p => {
            const count = DB.results.filter(r => r.projectId === p.id).length;
            if (count > maxEvals) maxEvals = count;
        });

        // 3. Build Headers
        // Basic Info
        const headers = ['Project ID', 'Title', 'SDG Goals', 'School', 'Theme', 'Avg Score'];
        // Dynamic Evaluator Columns
        for (let i = 1; i <= maxEvals; i++) {
            headers.push(`Eval ${i} Name`);
            keys.forEach(k => headers.push(`Eval ${i} ${k}`)); // e.g. Eval 1 problem
            headers.push(`Eval ${i} Total`);
            headers.push(`Eval ${i} Remark`);
        }

        // 4. Build Rows
        const rows = DB.projects.map(p => {
            const res = DB.results.filter(r => r.projectId === p.id);
            const totalSum = res.reduce((s, r) => s + (r.total || 0), 0);
            const avg = res.length ? (totalSum / res.length).toFixed(2) : 0;

            const row = [
                p.id,
                p.title,
                p.team,
                p.school,
                p.category,
                avg
            ];

            // Fill Evaluator Slots
            for (let i = 0; i < maxEvals; i++) {
                const r = res[i];
                if (r) {
                    const e = DB.evaluators.find(x => x.id === r.evaluatorId);
                    row.push(e ? (e.name || e.email) : 'Unknown'); // Name
                    keys.forEach(k => row.push(r.scores?.[k] || 0)); // Scores
                    row.push(r.total || 0); // Total
                    row.push((r.remark || '').replace(/\n/g, ' ')); // Remark
                } else {
                    // Empty slots if this project has fewer evaluators
                    row.push(''); // Name
                    keys.forEach(() => row.push('')); // Scores
                    row.push(''); // Total
                    row.push(''); // Remark
                }
            }
            return row;
        });

        // 5. Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(v => `"${('' + (v ?? '')).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        U.download('scores_detailed.csv', csvContent);
    },

    // --- Detailed Scores Tab ---
    detailed(host) {
        // 1. Determine rubric keys
        const keys = DB.rubricDefs.map(d => d.key);

        // 2. Find max evaluators
        let maxEvals = 0;
        DB.projects.forEach(p => {
            const count = DB.results.filter(r => r.projectId === p.id).length;
            if (count > maxEvals) maxEvals = count;
        });

        // 3. Build Header HTML
        let headerHtml = '<th>Project</th><th>SDG Goals</th><th style="text-align:center">Avg</th>';
        for (let i = 1; i <= maxEvals; i++) {
            headerHtml += `<th style="border-left:2px solid var(--border);text-align:center" colspan="${keys.length + 1}">Evaluator ${i}</th>`;
        }

        // Sub-headers
        let subHeaderHtml = '<th></th><th></th><th></th>';
        for (let i = 1; i <= maxEvals; i++) {
            subHeaderHtml += `<th style="border-left:2px solid var(--border);font-size:11px">Name/Total</th>`;
            keys.forEach(k => subHeaderHtml += `<th style="font-size:11px;writing-mode:vertical-rl;transform:rotate(180deg)">${k.substr(0, 10)}</th>`);
        }

        // 4. Build Rows
        const rows = DB.projects.map(p => {
            const res = DB.results.filter(r => r.projectId === p.id);
            const totalSum = res.reduce((s, r) => s + (r.total || 0), 0);
            const avg = res.length ? (totalSum / res.length).toFixed(2) : '0.00';

            let rowHtml = `<td><b>${p.title}</b></td><td>${p.team}</td><td style="text-align:center"><b>${avg}</b></td>`;

            for (let i = 0; i < maxEvals; i++) {
                const r = res[i];
                if (r) {
                    const e = DB.evaluators.find(x => x.id === r.evaluatorId);
                    const scores = keys.map(k => `<td style="text-align:center">${r.scores?.[k] || 0}</td>`).join('');
                    rowHtml += `<td style="border-left:2px solid var(--border)">
                        <div style="font-weight:bold;font-size:12px">${e ? (e.name || e.email).split('@')[0] : 'U'}</div>
                        <div class="pill">${r.total || 0}</div>
                    </td>${scores}`;
                } else {
                    rowHtml += `<td style="border-left:2px solid var(--border)">-</td>` + keys.map(() => `<td>-</td>`).join('');
                }
            }
            return `<tr>${rowHtml}</tr>`;
        }).join('');

        host.innerHTML = `
            <div class="card" style="overflow-x:auto;">
                <div class="flex-between" style="margin-bottom:12px">
                    <h3>Detailed Scores Matrix</h3>
                    <button class="btn" onclick="Admin.exportScores()">Download CSV</button>
                </div>
                <table style="min-width: max-content;">
                    <thead>
                        <tr>${headerHtml}</tr>
                        <tr>${subHeaderHtml}</tr>
                    </thead>
                    <tbody>${rows || '<tr><td colspan="100">No data</td></tr>'}</tbody>
                </table>
            </div>`;
    },

    settings(host) {
        const carouselHtml = (DB.settings.carouselSlides || []).map((s, i) => `
            <div class="card" style="margin-bottom:8px;padding:12px">
                <div class="flex-between">
                    <b>Slide ${i + 1}</b>
                    <button class="btn danger" onclick="this.closest('.card').remove()">Remove</button>
                </div>
                <div class="row" style="margin-top:8px">
                    <div class="col-6"><label>Image URL</label><input class="c_url" value="${s.imageUrl || ''}"></div>
                    <div class="col-6"><label>Title</label><input class="c_title" value="${s.title || ''}"></div>
                    <div class="col-6" style="grid-column:span 2"><label>Description</label><input class="c_desc" value="${s.description || ''}"></div>
                </div>
            </div>
        `).join('');

        host.innerHTML = `
            <div class="row">
                <div class="col-6 card">
                    <h3>Branding</h3>
                    <label>Event Title</label><input id="setEventTitle" value="${DB.settings.eventTitle}">
                    <label>Subtitle</label><input id="setSubtitle" value="${DB.settings.subtitle}">
                    <label>Logo URL</label><input id="setLogo" value="${DB.settings.logoUrl}">
                    <label>Welcome Title</label><input id="setWelcomeTitle" value="${DB.settings.welcomeTitle}">
                    <label>Welcome Body</label><textarea id="setWelcomeBody">${DB.settings.welcomeBody}</textarea>
                    <label>Admin Pass (Backend)</label><input id="setAdminPass" value="${DB.settings.adminPass}">
                    <div class="toolbar" style="margin-top:10px"><button class="btn" onclick="Admin.saveSettings()">Save Branding</button></div>
                </div>
                <div class="col-6">
                    <div class="card">
                        <h3>Carousel Management</h3>
                        <p class="hint">Images appear on the landing page before login.</p>
                        <div id="carouselContainer" style="margin-top:12px">${carouselHtml}</div>
                        <button class="btn" style="width:100%;margin-top:10px" onclick="Admin.addCarouselSlide()">+ Add Slide</button>
                    </div>
                    <div class="card danger-zone-card">
                        <h3>Danger Zone</h3>
                        <p class="hint">Reset all system data (Projects, Evaluators, Panels, Results).</p>
                        <button class="btn danger" onclick="Admin.resetAllData()">Reset System</button>
                    </div>
                </div>
            </div>`;
    },
    addCarouselSlide() {
        const container = document.getElementById('carouselContainer');
        const i = container.children.length;
        const div = U.el(`
            <div class="card" style="margin-bottom:8px;padding:12px">
                <div class="flex-between">
                    <b>Slide ${i + 1} (New)</b>
                    <button class="btn danger" onclick="this.closest('.card').remove()">Remove</button>
                </div>
                <div class="row" style="margin-top:8px">
                    <div class="col-6"><label>Image URL</label><input class="c_url" placeholder="carousel1.png"></div>
                    <div class="col-6"><label>Title</label><input class="c_title" placeholder="Slide Title"></div>
                    <div class="col-6" style="grid-column:span 2"><label>Description</label><input class="c_desc" placeholder="Slide Description"></div>
                </div>
            </div>`);
        container.appendChild(div);
    },
    rubric(host) {
        // Rubric Rows
        const rubricRows = DB.rubricDefs.map((r, i) => `
            <div class="card" style="margin-bottom:8px;padding:12px">
                <div class="flex-between">
                    <b>Item ${i + 1}</b>
                    <button class="btn danger" onclick="document.getElementById('rubric_row_${i}').remove()">Remove</button>
                </div>
                <div class="row" id="rubric_row_${i}" style="margin-top:8px">
                    <div class="col-6"><label>Key (internal)</label><input class="r_key" value="${r.key}"></div>
                    <div class="col-6"><label>Label (Display)</label><input class="r_label" value="${r.label}"></div>
                    <div class="col-6" style="grid-column:span 2"><label>Description / Points to Consider</label><input class="r_desc" value="${r.description || ''}"></div>
                    <div class="col-6"><label>Max Points</label><input type="number" class="r_max" value="${r.maxPoints || 10}"></div>
                </div>
            </div>
        `).join('');

        host.innerHTML = `<div class="card">
                <h3>Evaluation Rubric</h3>
                <div id="rubricContainer">${rubricRows}</div>
                <button class="btn" style="width:100%;margin-top:10px" onclick="Admin.addRubricItem()">+ Add Rubric Item</button>
                <div class="toolbar" style="margin-top:20px;justify-content:center">
                    <button class="btn" style="padding:12px 32px;font-size:16px" onclick="Admin.saveRubric()">SAVE RUBRIC</button>
                </div>
            </div>`;
    },
    addRubricItem() {
        const container = document.getElementById('rubricContainer');
        const i = container.children.length;
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="card" style="margin-bottom:8px;padding:12px">
                <div class="flex-between">
                    <b>Item ${i + 1} (New)</b>
                    <button class="btn danger" onclick="this.closest('.card').remove()">Remove</button>
                </div>
                <div class="row" style="margin-top:8px">
                    <div class="col-6"><label>Key (internal)</label><input class="r_key" value="new_item_${i}"></div>
                    <div class="col-6"><label>Label (Display)</label><input class="r_label" value="New Item"></div>
                    <div class="col-6" style="grid-column:span 2"><label>Description / Points to Consider</label><input class="r_desc" value=""></div>
                    <div class="col-6"><label>Max Points</label><input type="number" class="r_max" value="10"></div>
                </div>
            </div>`;
        container.appendChild(div.firstElementChild);
    },
    async saveSettings() {
        const s = { ...DB.settings };
        s.eventTitle = document.getElementById('setEventTitle').value;
        s.subtitle = document.getElementById('setSubtitle').value;
        s.logoUrl = document.getElementById('setLogo').value;
        s.welcomeTitle = document.getElementById('setWelcomeTitle').value;
        s.welcomeBody = document.getElementById('setWelcomeBody').value;
        s.adminPass = document.getElementById('setAdminPass').value;

        // Collect Carousel
        const slides = [];
        document.querySelectorAll('#carouselContainer > .card').forEach(row => {
            const imageUrl = (row.querySelector('.c_url').value || '').trim();
            const title = (row.querySelector('.c_title').value || '').trim();
            const description = (row.querySelector('.c_desc').value || '').trim();
            if (imageUrl) slides.push({ imageUrl, title, description });
        });
        s.carouselSlides = slides;

        UI.showLoading('Saving...');
        await API.saveSettings(s);
        await API.loadData();
        UI.hideLoading();
        UI.syncBranding();
        UI.alert('Settings Saved', 'success', 'Success');
    },
    async saveRubric() {
        const s = { ...DB.settings };

        // Collect Rubric
        const rubricItems = [];
        document.querySelectorAll('#rubricContainer .card').forEach(row => {
            const key = row.querySelector('.r_key').value.trim();
            const label = row.querySelector('.r_label').value.trim();
            const description = row.querySelector('.r_desc').value.trim();
            const maxPoints = parseInt(row.querySelector('.r_max').value) || 10;
            if (key) rubricItems.push({ key, label, description, maxPoints });
        });
        s.rubric = rubricItems;

        UI.showLoading('Saving Rubric...');
        await API.saveSettings(s);
        await API.loadData();
        UI.hideLoading();
        UI.alert('Rubric Saved', 'success', 'Success');
    },
    async resetAllData() {
        const dlg = U.el(`<div class="modal-wrap"><div class="modal" style="border: 2px solid var(--bad)">
            <h3 style="color: var(--bad)">System Reset Confirmation</h3>
            <p>You are about to delete <b>ALL</b> data from the system. This includes:</p>
            <ul style="margin: 10px 20px; color: var(--muted); font-size: 14px;">
                <li>All Projects (${DB.projects.length})</li>
                <li>All Evaluators (${DB.evaluators.length})</li>
                <li>All Jury Panels (${DB.panels.length})</li>
                <li>All Evaluation Results (${DB.results.length})</li>
            </ul>
            <p style="margin-top: 12px;">The system will automatically download CSV backups before proceeding.</p>
            
            <label style="margin-top: 16px;">Reason for Reset (Required)</label>
            <textarea id="resetReason" placeholder="e.g. Starting Round 2, Testing complete, etc." style="height: 80px;"></textarea>
            
            <div class="toolbar" style="margin-top: 20px; justify-content: flex-end;">
                <button class="btn secondary" id="cancelReset">Cancel</button>
                <button class="btn danger" id="confirmReset" style="padding-left: 24px; padding-right: 24px;">BACKUP & RESET ALL DATA</button>
            </div>
        </div></div>`);
        document.body.appendChild(dlg);

        dlg.querySelector('#cancelReset').onclick = () => dlg.remove();
        dlg.querySelector('#confirmReset').onclick = async () => {
            const reason = dlg.querySelector('#resetReason').value.trim();
            if (!reason) return UI.alert('Please provide a reason for the reset.', 'error', 'Error');

            if (!await UI.confirm(`FINAL WARNING: Are you sure you want to delete everything?\nReason: ${reason}`, 'DANGER: SYSTEM RESET')) return;

            try {
                UI.showLoading('Exporting Backup...');

                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const backupData = {};

                if (DB.projects.length) backupData["Projects"] = DB.projects;
                if (DB.evaluators.length) backupData["Evaluators"] = DB.evaluators;
                if (DB.panels.length) backupData["Panels"] = DB.panels;
                if (DB.results.length) {
                    backupData["Scores"] = DB.results.map(r => ({
                        ...r,
                        project: DB.projects.find(p => p.id === r.projectId)?.title,
                        evaluator: DB.evaluators.find(e => e.id === r.evaluatorId)?.name
                    }));
                }

                if (Object.keys(backupData).length > 0) {
                    U.downloadExcel(`FULL_BACKUP_${timestamp}.xlsx`, backupData);
                }

                // Small delay to let download trigger
                await new Promise(r => setTimeout(r, 1000));

                UI.showLoading('Resetting System...');
                await API.resetAll();
                await API.loadData();
                UI.hideLoading();
                dlg.remove();
                this.render();
                await UI.alert('System Reset successfully. Your backup has been downloaded as a single Excel file.', 'success', 'Success');
            } catch (err) {
                UI.hideLoading();
                UI.alert('Error: ' + err.message, 'error', 'Error');
            }
        };
    },

    projects(host) {
        const list = DB.projects.map(p => `<tr><td><b>${p.title}</b><div class="hint">${p.category}</div></td><td>${p.team}</td><td>${p.school}</td><td><div class="toolbar"><button class="btn" onclick="Admin.editProject('${p.id}')">Edit</button><button class="btn danger" onclick="Admin.deleteProject('${p.id}')">Del</button></div></td></tr>`).join('');
        host.innerHTML = `<div class="toolbar" style="margin-bottom:10px"><button class="btn" onclick="Admin.editProject()">Add Project</button></div><div class="card"><h3>Projects (${DB.projects.length})</h3><div class="table-wrapper"><table><thead><tr><th>Title</th><th>SDG Goals</th><th>School</th><th>Actions</th></tr></thead><tbody>${list || '<tr><td colspan="4" style="text-align:center">No Projects</td></tr>'}</tbody></table></div></div>`;
    },
    editProject(id) {
        const p = id ? DB.projects.find(x => x.id === id) : { id: U.uid('project'), title: '', category: '', team: '', school: '' };
        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>${id ? 'Edit' : 'Add'} Project</h3><label>Title</label><input id="p_title" value="${p.title}"><label>Theme</label><input id="p_cat" value="${p.category}"><label>SDG Goals</label><input id="p_team" value="${p.team}"><label>School</label><input id="p_school" value="${p.school}"><div class="toolbar" style="margin-top:12px"><button class="btn" id="saveBtn">Save</button><button class="btn secondary" id="cancelBtn">Cancel</button></div></div></div>`);
        document.body.appendChild(dlg);
        dlg.querySelector('#cancelBtn').onclick = () => dlg.remove();
        dlg.querySelector('#saveBtn').onclick = async () => {
            p.title = dlg.querySelector('#p_title').value;
            p.category = dlg.querySelector('#p_cat').value;
            p.team = dlg.querySelector('#p_team').value;
            p.school = dlg.querySelector('#p_school').value;
            if (!p.title) return UI.alert('Title required', 'error', 'Error');

            try {
                UI.showLoading('Saving...');
                await API.saveProject(p);

                // Local update
                const idx = DB.projects.findIndex(x => x.id === p.id);
                if (idx >= 0) DB.projects[idx] = p;
                else DB.projects.push(p);

                UI.hideLoading();
                dlg.remove();
                this.projects(document.getElementById('adminView'));
            } catch (err) {
                UI.hideLoading();
                UI.alert('Error: ' + err.message, 'error', 'Error');
            }
        };
    },
    async deleteProject(id) {
        if (!await UI.confirm('Are you sure you want to delete this project? This action cannot be undone.', 'Delete Project?')) return;
        await API.deleteProject(id);
        await API.loadData();
        this.projects(document.getElementById('adminView'));
    },

    evaluators(host) {
        const list = DB.evaluators.map(e => `<tr><td><b>${e.name || '-'}</b><div class="hint">${e.email}</div></td><td>${e.expertise || '-'}</td><td>${e.code}</td><td><div class="toolbar"><button class="btn" onclick="Admin.editEvaluator('${e.id}')">Edit</button><button class="btn danger" onclick="Admin.deleteEvaluator('${e.id}')">Del</button></div></td></tr>`).join('');
        host.innerHTML = `<div class="toolbar" style="margin-bottom:10px"><button class="btn" onclick="Admin.editEvaluator()">Add Evaluator</button></div><div class="card"><h3>Evaluators (${DB.evaluators.length})</h3><div class="table-wrapper"><table><thead><tr><th>Name/Email</th><th>Expertise</th><th>Code</th><th>Actions</th></tr></thead><tbody>${list || '<tr><td colspan="4" style="text-align:center">No Evaluators</td></tr>'}</tbody></table></div></div>`;
    },
    editEvaluator(id) {
        const e = id ? DB.evaluators.find(x => x.id === id) : { id: U.uid('evaluator'), name: '', email: '', expertise: '', code: Math.floor(100000 + Math.random() * 900000) };
        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>${id ? 'Edit' : 'Add'} Evaluator</h3><label>Name</label><input id="e_name" value="${e.name}"><label>Email</label><input id="e_email" value="${e.email}"><label>Expertise</label><input id="e_exp" value="${e.expertise}"><label>Code</label><input id="e_code" value="${e.code}"><div class="toolbar" style="margin-top:12px"><button class="btn" id="saveBtn">Save</button><button class="btn secondary" id="cancelBtn">Cancel</button></div></div></div>`);
        document.body.appendChild(dlg);
        dlg.querySelector('#cancelBtn').onclick = () => dlg.remove();
        dlg.querySelector('#saveBtn').onclick = async () => {
            e.name = dlg.querySelector('#e_name').value;
            e.email = dlg.querySelector('#e_email').value;
            e.expertise = dlg.querySelector('#e_exp').value;
            e.code = dlg.querySelector('#e_code').value;
            if (!e.email) return UI.alert('Email required', 'error', 'Error');

            try {
                UI.showLoading('Saving...');
                await API.saveEvaluator(e);

                // Optimistic update / Local update
                const idx = DB.evaluators.findIndex(x => x.id === e.id);
                if (idx >= 0) DB.evaluators[idx] = e;
                else DB.evaluators.push(e);

                UI.hideLoading();
                dlg.remove();
                this.evaluators(document.getElementById('adminView'));
            } catch (err) {
                UI.hideLoading();
                UI.alert('Error: ' + err.message, 'error', 'Error');
            }
        };
    },
    async deleteEvaluator(id) {
        if (!await UI.confirm('Are you sure you want to delete this evaluator? All their completed evaluations will remain but they can no longer log in.', 'Delete Evaluator?')) return;
        await API.deleteEvaluator(id);
        await API.loadData();
        this.evaluators(document.getElementById('adminView'));
    },

    panels(host) {
        const list = DB.panels.map(pa => {
            const evals = pa.evaluatorIds.map(id => DB.evaluators.find(e => e.id === id)).filter(e => e);
            const projs = pa.projectIds.map(id => DB.projects.find(p => p.id === id)).filter(p => p);
            return `<tr><td><b>${pa.name}</b></td><td>${evals.length} members</td><td>${projs.length} projects</td><td><div class="toolbar"><button class="btn" onclick="Admin.editPanel('${pa.id}')">Edit</button><button class="btn danger" onclick="Admin.deletePanel('${pa.id}')">Del</button></div></td></tr>`;
        }).join('');
        host.innerHTML = `<div class="toolbar" style="margin-bottom:10px"><button class="btn" onclick="Admin.editPanel()">Create Panel</button></div><div class="card"><h3>Panels (${DB.panels.length})</h3><div class="table-wrapper"><table><thead><tr><th>Panel</th><th>Evaluators</th><th>Projects</th><th>Actions</th></tr></thead><tbody>${list || '<tr><td colspan="4" style="text-align:center">No Panels</td></tr>'}</tbody></table></div></div>`;
    },
    editPanel(id) {
        const pa = id ? DB.panels.find(x => x.id === id) : { id: U.uid('panel'), name: 'Panel ' + (DB.panels.length + 1), evaluatorIds: [], projectIds: [] };

        // Calculate already assigned items (excluding current panel if editing)
        const otherPanels = DB.panels.filter(p => p.id !== pa.id);
        const assignedEids = new Set(otherPanels.flatMap(p => p.evaluatorIds));
        const assignedPids = new Set(otherPanels.flatMap(p => p.projectIds));

        const evalOpts = DB.evaluators.map(e => {
            const isAssigned = assignedEids.has(e.id);
            const style = isAssigned ? 'background: #1a1e2e; cursor: not-allowed; border: 1px dashed #444; color: #666;' : 'cursor:pointer';
            const disabled = isAssigned ? 'disabled' : '';
            const checked = pa.evaluatorIds.includes(e.id) ? 'checked' : '';
            const label = isAssigned ? `${e.name || e.email} (Assigned)` : (e.name || e.email);
            return `<label class="chip" style="${style}"><input type="checkbox" data-eid value="${e.id}" style="width:auto;margin-right:6px" ${disabled} ${checked}> ${label}</label>`;
        }).join(' ');

        const projOpts = DB.projects.map(p => {
            const isAssigned = assignedPids.has(p.id);
            const style = isAssigned ? 'background: #1a1e2e; cursor: not-allowed; border: 1px dashed #444; color: #666;' : 'cursor:pointer';
            const disabled = isAssigned ? 'disabled' : '';
            const checked = pa.projectIds.includes(p.id) ? 'checked' : '';
            const label = isAssigned ? `${p.title} (Assigned)` : p.title;
            return `<label class="chip" style="${style}"><input type="checkbox" data-pid value="${p.id}" style="width:auto;margin-right:6px" ${disabled} ${checked}> ${label}</label>`;
        }).join(' ');

        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>${id ? 'Edit' : 'Create'} Panel</h3><label>Name</label><input id="pa_name" value="${pa.name}"><label>Evaluators</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${evalOpts || 'No evaluators'}</div><label>Projects</label><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${projOpts || 'No projects'}</div><div class="toolbar" style="margin-top:12px"><button class="btn" id="saveBtn">Save</button><button class="btn secondary" id="cancelBtn">Cancel</button></div></div></div>`);
        document.body.appendChild(dlg);
        dlg.querySelectorAll('[data-eid]').forEach(ch => { ch.checked = pa.evaluatorIds.includes(ch.value) });
        dlg.querySelectorAll('[data-pid]').forEach(ch => { ch.checked = pa.projectIds.includes(ch.value) });
        dlg.querySelector('#cancelBtn').onclick = () => dlg.remove();
        dlg.querySelector('#saveBtn').onclick = async () => {
            pa.name = dlg.querySelector('#pa_name').value;
            pa.evaluatorIds = [...dlg.querySelectorAll('[data-eid]:checked')].map(x => x.value);
            pa.projectIds = [...dlg.querySelectorAll('[data-pid]:checked')].map(x => x.value);
            if (!pa.name) return UI.alert('Name required', 'error', 'Error');
            if (pa.evaluatorIds.length < 3) return UI.alert('Please select at least 3 evaluators.', 'error', 'Error');
            if (pa.projectIds.length < 2) return UI.alert('Please select at least 2 projects.', 'error', 'Error');

            try {
                UI.showLoading('Saving...');
                await API.savePanel(pa);

                // Local update
                const idx = DB.panels.findIndex(x => x.id === pa.id);
                if (idx >= 0) DB.panels[idx] = pa;
                else DB.panels.push(pa);

                UI.hideLoading();
                dlg.remove();
                this.panels(document.getElementById('adminView'));
            } catch (err) {
                UI.hideLoading();
                UI.alert('Error: ' + err.message, 'error', 'Error');
            }
        };
    },
    async deletePanel(id) {
        if (!await UI.confirm('Are you sure you want to delete this panel? This will unassign all projects and evaluators from this panel.', 'Delete Panel?')) return;
        await API.deletePanel(id);
        await API.loadData();
        this.panels(document.getElementById('adminView'));
    },

    data(host) {
        const rows = DB.results.map(r => ({ ...r, panel: DB.panels.find(p => p.id === r.panelId)?.name, project: DB.projects.find(p => p.id === r.projectId)?.title, evaluator: DB.evaluators.find(e => e.id === r.evaluatorId)?.name }));
        host.innerHTML = `<div class="toolbar" style="margin-bottom:10px"><button class="btn" onclick='U.download("results.json", DB.results)'>Download JSON</button></div><div class="card"><h3>Raw Results (${DB.results.length})</h3><div class="table-wrapper"><table><thead><tr><th>Project</th><th>Evaluator</th><th>Score</th><th>Finalized</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.project || '-'}</td><td>${r.evaluator || '-'}</td><td>${r.total}</td><td>${r.finalizedByEvaluator}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
};

const Eval = {
    draft: null,

    showProfileForm() {
        UI.show('evalProfile');
        const ev = Auth.currentEval;
        if (ev) {
            document.getElementById('profName').value = ev.name || '';
            document.getElementById('profExpertise').value = ev.expertise || '';
            document.getElementById('profNotes').value = ev.notes || '';
        }
    },
    async saveProfile() {
        const name = document.getElementById('profName').value.trim();
        const expertise = document.getElementById('profExpertise').value.trim();
        const notes = document.getElementById('profNotes').value.trim();
        if (!name) return UI.alert('Name required', 'error', 'Error');

        const ev = { ...Auth.currentEval, name, expertise, notes };
        UI.showLoading('Saving Profile...');
        await API.updateProfile(ev);
        Auth.currentEval = ev;
        UI.hideLoading();

        this.goToAssigned();
        UI.syncBranding();
    },

    goToAssigned() {
        UI.show('evalProjects');
        const myPanels = DB.panels.filter(p => p.evaluatorIds.includes(Auth.currentEval.id));
        const myProjectIds = [...new Set(myPanels.flatMap(p => p.projectIds))];
        const finalizedAll = DB.evaluatorState[Auth.currentEval.id]?.finalizedAll;

        const rows = myProjectIds.map(pid => {
            const p = DB.projects.find(x => x.id === pid) || { title: 'Unknown' };
            const submitted = DB.results.find(r => r.projectId === pid && r.evaluatorId === Auth.currentEval.id);

            if (submitted) {
                const actions = `
                    <button class="btn secondary" onclick="Eval.openViewModal('${submitted.id}')">View</button>
                    ${!finalizedAll ? `<button class="btn" style="margin-left:6px" onclick="Eval.openEvaluateModal('${pid}')">Edit</button>` : ''}
                `;
                return `<tr><td><b>${p.title}</b><div class="hint">${p.category || ''}</div></td><td><span class="pill success">Evaluated</span></td><td><div class="toolbar">${actions}</div></td></tr>`;
            } else {
                return `<tr><td><b>${p.title}</b><div class="hint">${p.category || ''}</div></td><td><span class="pill">Pending</span></td><td><button class="btn" ${finalizedAll ? 'disabled' : ''} onclick="Eval.openEvaluateModal('${pid}')">Evaluate</button></td></tr>`;
            }
        }).join('');

        const left = myProjectIds.length - DB.results.filter(r => r.evaluatorId === Auth.currentEval.id).length;
        document.getElementById('leftCount').textContent = `${left} remaining`;
        document.getElementById('progressFill').style.width = ((myProjectIds.length - left) / myProjectIds.length * 100) + '%';

        // Add View Rubric Button
        const rubricBtn = `<button class="btn secondary" style="font-size:12px;padding:4px 8px;margin-bottom:8px" onclick="Eval.viewRubric()">View Evaluation Criteria</button>`;
        document.getElementById('evalProjectTable').innerHTML = `${rubricBtn}<table><thead><tr><th>Project</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="text-align:center">No projects assigned</td></tr>'}</tbody></table>`;

        const toolbar = document.getElementById('evalToolbar');
        toolbar.innerHTML = '';
        if (!finalizedAll && left === 0 && myProjectIds.length > 0) {
            const btn = U.el(`<button class="btn" style="width:100%">Finalize All Evaluations</button>`);
            btn.onclick = () => this.doFinalize();
            toolbar.appendChild(btn);
        } else if (finalizedAll) {
            toolbar.innerHTML = `<div class="pill success" style="width:100%;text-align:center;padding:12px">All Evaluations Finalized</div>`;
        }
    },

    openEvaluateModal(projectId) {
        const project = DB.projects.find(p => p.id === projectId);
        const panel = DB.panels.find(p => p.projectIds.includes(projectId) && p.evaluatorIds.includes(Auth.currentEval.id));
        const prior = DB.results.find(r => r.projectId === projectId && r.evaluatorId === Auth.currentEval.id);

        const fields = DB.rubricDefs.map(d => `
            <div style="margin-bottom:12px;border-bottom:1px solid var(--border);padding-bottom:12px">
                <label style="font-size:14px;color:var(--acc)">${d.label} <span style="color:var(--muted);font-weight:400">(Max: ${d.maxPoints || 10})</span></label>
                <div class="hint" style="margin-bottom:6px;font-style:italic">${d.description || ''}</div>
                <input type="number" min="0" max="${d.maxPoints || 10}" data-key="${d.key}" value="${prior?.scores?.[d.key] || ''}" placeholder="Score">
            </div>`).join('');

        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>Evaluate: ${project.title}</h3>${fields}<label>Remark</label><textarea id="e_remark">${prior?.remark || ''}</textarea><div class="toolbar" style="margin-top:16px"><button class="btn" id="subBtn">Submit</button><button class="btn secondary" id="cancelBtn">Cancel</button></div></div></div>`);
        document.body.appendChild(dlg);

        dlg.querySelector('#cancelBtn').onclick = () => dlg.remove();
        dlg.querySelector('#subBtn').onclick = async () => {
            const scores = {};
            let total = 0;
            let valid = true;
            dlg.querySelectorAll('input[data-key]').forEach(i => {
                const key = i.getAttribute('data-key');
                const def = DB.rubricDefs.find(d => d.key === key);
                const max = def ? (def.maxPoints || 10) : 10;

                const val = parseFloat(i.value);
                if (isNaN(val) || val < 0 || val > max) valid = false;
                scores[key] = val;
                total += val;
            });

            if (!valid) return UI.alert('Please enter valid scores within the specified range for each criteria.', 'error', 'Invalid Input');

            const result = {
                id: prior?.id || U.uid('result'),
                projectId,
                panelId: panel?.id,
                evaluatorId: Auth.currentEval.id,
                scores,
                total,
                remark: dlg.querySelector('#e_remark').value
            };

            UI.showLoading('Saving...');
            await API.saveResult(result);
            await API.loadData();
            UI.hideLoading();
            dlg.remove();
            this.goToAssigned();
        };
    },

    openViewModal(resultId) {
        const res = DB.results.find(r => r.id === resultId);
        const proj = DB.projects.find(p => p.id === res.projectId);
        const fields = DB.rubricDefs.map(d => `<div style="margin-bottom:6px"><span class="hint">${d.label}:</span> <b>${res.scores?.[d.key]}</b></div>`).join('');

        const dlg = U.el(`<div class="modal-wrap"><div class="modal"><h3>${proj.title}</h3>${fields}<p style="margin-top:12px"><b>Total: ${res.total}</b></p><p>Remark: ${res.remark || 'None'}</p><button class="btn secondary" style="margin-top:16px" onclick="this.closest('.modal-wrap').remove()">Close</button></div></div>`);
        document.body.appendChild(dlg);
    },

    async doFinalize() {
        if (!await UI.confirm('Are you sure you want to finalize ALL evaluations? You will NOT be able to edit your scores after this.', 'Finalize All?')) return;
        UI.showLoading('Finalizing...');
        await API.finalizeEvaluator(Auth.currentEval.id);
        await API.loadData();
        UI.hideLoading();
        this.goToAssigned();
    },

    viewRubric() {
        const rows = DB.rubricDefs.map((r, i) => `
            <tr>
                <td><b>${r.label}</b></td>
                <td>${r.description || '-'}</td>
                <td style="text-align:center">${r.maxPoints || 10}</td>
            </tr>`).join('');

        const dlg = U.el(`
            <div class="modal-wrap">
                <div class="modal" style="max-width:800px">
                    <h3>Evaluation Criteria Reference</h3>
                    <div class="table-wrapper" style="max-height:60vh;overflow-y:auto">
                        <table>
                            <thead><tr><th>Criteria</th><th>Points to Consider</th><th>Max</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                    <div class="toolbar" style="margin-top:16px">
                        <button class="btn" onclick="this.closest('.modal-wrap').remove()">Close</button>
                    </div>
                </div>
            </div>`);
        document.body.appendChild(dlg);
    }
};

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Try to connect to backend immediately
    try {
        await API.loadData();
        document.querySelector('.container').classList.remove('hidden'); // Show UI if loaded
        UI.initCarousel();
    } catch (e) {
        console.log('Backend not reachable yet needs login');
    }
});
