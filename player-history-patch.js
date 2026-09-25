// ============================================================
// MTM VISUALIZADOR - PLAYER HISTORY PATCH v1.3
// ============================================================
// v1.3:
//   - Restaurar estilo original del modal de partidos (fase regular)
//   - Modal fallback usa las clases nativas del visualizador
//   - Indicador de agente libre (🆓) en modales de partido
//   - Click en jugador (modal regular/playoffs) → tarjeta del jugador
//   - Contexto de torneo correcto al abrir tarjeta (respeta división)
//   - Indicador de división en las tarjetas de jugador
// ============================================================
// Carga DESPUÉS de script.js y playoffs-bracket-patch.js
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // 0. HELPERS PARA BINDINGS GLOBALES
    // ============================================================
    function g(name) {
        try {
            // eslint-disable-next-line no-eval
            return (new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined'))();
        } catch (_) { return undefined; }
    }

    function getCurrentData() {
        const cd = g('currentData');
        if (cd) return cd;
        return window.currentData || null;
    }

    function getData1() {
        const d = g('data1');
        if (d) return d;
        return window.data1 || null;
    }

    function getData2() {
        const d = g('data2');
        if (d) return d;
        return window.data2 || null;
    }

    function getMenuItems() {
        const m = g('MENU_ITEMS');
        if (m) return m;
        return window.MENU_ITEMS || null;
    }

    function getPerfSelectedPlayerId() {
        const v = g('perfSelectedPlayerId');
        if (v !== undefined) return v;
        return window.perfSelectedPlayerId || null;
    }

    if (typeof window.showPlayerProfile !== 'function') {
        console.error('[player-history] script.js no cargado. Abortando.');
        return;
    }

    // ============================================================
    // 1. HELPERS
    // ============================================================
    function esc(s) {
        if (typeof s !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
        return s.replace(/[&<>"']/g, m => map[m]);
    }

    function getPlayoffLabels(totalRounds) {
        const base = ['32°avos', '16°avos', 'Octavos', 'Cuartos', 'Semis', 'Final'];
        if (totalRounds <= 6) return base.slice(6 - totalRounds);
        const extra = totalRounds - 6;
        const prefix = [];
        for (let i = 0; i < extra; i++) prefix.push('R' + (i + 1));
        return prefix.concat(base);
    }

    function isCupFormat(torneo) {
        if (!torneo) return false;
        if (torneo.isCup === true) return true;
        const noRegularRounds = !torneo.rounds || torneo.rounds.length === 0;
        const hasPlayoffs = torneo.playoffs && torneo.playoffs.rounds &&
                            torneo.playoffs.rounds.length > 0 &&
                            torneo.playoffs.rounds.some(r => r.some(m => m.h && m.a));
        return noRegularRounds && hasPlayoffs;
    }

    function getTournamentDivision(torneo) {
        if (!torneo) return null;
        if (torneo.isCup) return 'cup';
        if (torneo.divisionLevel !== undefined && torneo.divisionLevel !== null) {
            return torneo.divisionLevel;
        }
        // Fallback: parsear nombre
        if (/2ª|segunda|expansi[oó]n|2da/i.test(torneo.name || '')) return 2;
        if (/1ª|primera/i.test(torneo.name || '')) return 1;
        return null;
    }

    function divisionLabel(div) {
        if (div === 'cup') return '🏆 Copa';
        if (div === 1) return '1ª División';
        if (div === 2) return '2ª División';
        if (typeof div === 'number') return `${div}ª División`;
        return null;
    }

    // ============================================================
    // 2. BÚSQUEDA GLOBAL DE JUGADORES
    // ============================================================
    function getAllTournaments() {
        const all = [];
        const cd = getCurrentData();
        if (cd) all.push(cd);
        if (window.copaData && (!cd || window.copaData.id !== cd.id)) {
            all.push(window.copaData);
        }
        return all;
    }

    // Devuelve { player, teamId, teamName, teamShield, torneo } o null
    function findPlayerInTorneo(playerId, torneo) {
        if (!torneo) return null;
        for (const tm of (torneo.teams || [])) {
            const p = tm.players.find(x => x.id === playerId);
            if (p) return { player: p, teamId: tm.id, teamName: tm.name, teamShield: tm.shield, torneo };
        }
        if (torneo.freeAgents) {
            const p = torneo.freeAgents.find(x => x.id === playerId);
            if (p) return { player: p, teamId: null, teamName: 'Agente Libre', teamShield: '', torneo };
        }
        return null;
    }

    function findPlayerAnywhere(playerId) {
        for (const t of getAllTournaments()) {
            const found = findPlayerInTorneo(playerId, t);
            if (found) return found;
        }
        return null;
    }

    // ============================================================
    // 3. CARGA DE copa.json
    // ============================================================
    window.copaData = null;
    let _copaLoadPromise = null;

    function loadCopaData() {
        if (_copaLoadPromise) return _copaLoadPromise;
        _copaLoadPromise = (async () => {
            try {
                const resp = await fetch('copa.json?t=' + Date.now());
                if (!resp.ok) {
                    console.info('[player-history] copa.json no encontrado (' + resp.status + ')');
                    return null;
                }
                const data = await resp.json();
                let copa = data;
                if (data.tournaments && Array.isArray(data.tournaments) && data.tournaments.length) {
                    copa = data.tournaments[0];
                }
                window.copaData = copa;
                console.log('[player-history] ✅ copa.json cargado:', copa.name);
                const selector = document.getElementById('tournament-selector');
                if (selector && selector.style.display !== 'none') {
                    patchTournamentSelector();
                }
                return copa;
            } catch (e) {
                console.info('[player-history] copa.json no disponible:', e.message);
                return null;
            }
        })();
        return _copaLoadPromise;
    }

    loadCopaData();

    // ============================================================
    // 4. SELECTOR DE TORNEOS
    // ============================================================
    function patchTournamentSelector() {
        const cardsContainer = document.querySelector('#tournament-selector .tournament-cards');
        if (!cardsContainer) return;
        const existing = document.getElementById('cup-selector-card');
        if (existing) existing.remove();
        if (!window.copaData) return;

        const cupCard = document.createElement('div');
        cupCard.id = 'cup-selector-card';
        cupCard.className = 'tournament-card';
        cupCard.setAttribute('onclick', 'selectTournament(3)');
        cupCard.innerHTML = `
            <img id="selector-logo3" src="${window.copaData.logo || ''}" alt="Logo Copa" onerror="this.style.display='none'">
            <h3 id="selector-name3">${esc(window.copaData.name || 'Copa')}</h3>
            <span class="badge second">🏆 COPA</span>
            <div class="info" id="selector-info3">${(window.copaData.teams || []).length} equipos</div>
        `;
        cardsContainer.appendChild(cupCard);
        cardsContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))';
    }

    const _originalShowTournamentSelector = window.showTournamentSelector;
    window.showTournamentSelector = function () {
        if (typeof _originalShowTournamentSelector === 'function') {
            _originalShowTournamentSelector.call(this);
        }
        setTimeout(patchTournamentSelector, 60);
    };

    const _originalSelectTournament = window.selectTournament;
    window.selectTournament = function (division) {
        if (division === 3) {
            const selector = document.getElementById('tournament-selector');
            if (selector) selector.style.display = 'none';
            if (!window.copaData) { alert('La copa no está disponible.'); return; }
            try {
                // eslint-disable-next-line no-eval
                (0, eval)('currentData = window.copaData;');
            } catch (_) { window.currentData = window.copaData; }
            try {
                // eslint-disable-next-line no-eval
                (0, eval)('currentDivision = 3;');
            } catch (_) { window.currentDivision = 3; }
            if (typeof window.loadLogo === 'function') window.loadLogo('logo3.png', 'logo3.jpg');
            if (typeof window.applyData === 'function') window.applyData(window.copaData);
            return;
        }
        return _originalSelectTournament.call(this, division);
    };

    // ============================================================
    // 5. DETECCIÓN DE COPA Y OCULTAR MENÚS
    // ============================================================
    const _originalBuildUI = window.buildUI;
    const _originalMenuItems = (() => {
        const m = getMenuItems();
        return m ? m.map(i => ({ ...i })) : null;
    })();

    window.buildUI = function (torneo) {
        const MENU_ITEMS = getMenuItems();
        if (_originalMenuItems && MENU_ITEMS) {
            MENU_ITEMS.length = 0;
            _originalMenuItems.forEach(item => MENU_ITEMS.push(item));
            if (isCupFormat(torneo)) {
                const toRemove = ['tabla', 'jornadas', 'stats', 'economia', 'seleccion'];
                for (let i = MENU_ITEMS.length - 1; i >= 0; i--) {
                    if (toRemove.includes(MENU_ITEMS[i].id)) MENU_ITEMS.splice(i, 1);
                }
            }
        }
        if (typeof _originalBuildUI === 'function') _originalBuildUI.call(this, torneo);
    };

    // ============================================================
    // 6. COLECCIÓN DE PARTIDOS
    // ============================================================
    function getTournamentById(id) {
        if (!id) return null;
        const cd = getCurrentData();
        if (cd && cd.id === id) return cd;
        if (window.copaData && window.copaData.id === id) return window.copaData;
        const d1 = getData1(); if (d1 && d1.id === id) return d1;
        const d2 = getData2(); if (d2 && d2.id === id) return d2;
        return null;
    }

    function collectMatchesFromTournament(playerId, torneo) {
        const out = [];
        if (!torneo) return out;
        (torneo.rounds || []).forEach((round, rIdx) => {
            (round || []).forEach(m => {
                if (!m || !m.played || !m.stats) return;
                const st = m.stats.find(s => s.pId === playerId);
                if (!st) return;
                out.push({
                    type: 'regular', roundLabel: `Jornada ${rIdx + 1}`,
                    roundIdx: rIdx, matchIdx: null, match: m, playerStats: st,
                    tournamentId: torneo.id, tournamentName: torneo.name,
                    order: 100000 + rIdx * 100
                });
            });
        });
        if (torneo.playoffs && torneo.playoffs.rounds) {
            const labels = getPlayoffLabels(torneo.playoffs.rounds.length);
            torneo.playoffs.rounds.forEach((round, rIdx) => {
                (round || []).forEach((m, mIdx) => {
                    if (!m || !m.played || !m.stats) return;
                    const st = m.stats.find(s => s.pId === playerId);
                    if (!st) return;
                    out.push({
                        type: 'playoff', roundLabel: labels[rIdx] || `Playoff R${rIdx + 1}`,
                        roundIdx: rIdx, matchIdx: mIdx, match: m, playerStats: st,
                        tournamentId: torneo.id, tournamentName: torneo.name,
                        order: 900000 + rIdx * 1000 + mIdx
                    });
                });
            });
        }
        (torneo.friendlyMatches || []).forEach((m, idx) => {
            if (!m || !m.played || !m.stats) return;
            const st = m.stats.find(s => s.pId === playerId);
            if (!st) return;
            out.push({
                type: 'friendly', roundLabel: `Amistoso`,
                roundIdx: idx, matchIdx: null, match: m, playerStats: st,
                tournamentId: torneo.id, tournamentName: torneo.name,
                order: 500000 + idx
            });
        });
        (torneo.internationalMatches || []).forEach((m, idx) => {
            if (!m || !m.played || !m.stats) return;
            const st = m.stats.find(s => s.pId === playerId);
            if (!st) return;
            out.push({
                type: 'international',
                roundLabel: m.isFriendly ? 'Internacional amistoso' : 'Internacional oficial',
                roundIdx: idx, matchIdx: null, match: m, playerStats: st,
                tournamentId: torneo.id, tournamentName: torneo.name,
                order: 700000 + idx
            });
        });
        return out;
    }

    function collectAllPlayerMatches(playerId) {
        let all = [];
        getAllTournaments().forEach(t => { all = all.concat(collectMatchesFromTournament(playerId, t)); });
        return all;
    }

    function countPlayerMatches(playerId) {
        const matches = collectAllPlayerMatches(playerId);
        const official = matches.filter(m => m.type === 'regular' || m.type === 'playoff').length;
        const friendly = matches.filter(m => m.type === 'friendly').length;
        const international = matches.filter(m => m.type === 'international').length;
        return { official, friendly, international, total: official + friendly + international };
    }

    // ============================================================
    // 7. MODAL DE HISTORIAL
    // ============================================================
    const _historyState = { playerId: null, sort: 'recent', filter: 'all', tournamentFilter: 'all' };

    function renderPlayerHistoryModal(playerId) {
        const info = findPlayerAnywhere(playerId);
        if (!info) return alert('Jugador no encontrado.');
        const player = info.player;
        const team = info.teamId ? info.torneo.teams.find(t => t.id === info.teamId) : null;

        _historyState.playerId = playerId;
        _historyState.sort = 'recent';
        _historyState.filter = 'all';
        _historyState.tournamentFilter = 'all';

        document.querySelectorAll('.pbh-modal-overlay').forEach(el => el.remove());

        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildHistoryModalHtml(player, team);
        document.body.appendChild(wrapper);

        wrapper.querySelectorAll('.pbh-filter-btn').forEach(btn => {
            btn.onclick = () => { _historyState.filter = btn.dataset.filter; refreshHistoryList(); };
        });
        wrapper.querySelectorAll('.pbh-sort-btn').forEach(btn => {
            btn.onclick = () => { _historyState.sort = btn.dataset.sort; refreshHistoryList(); };
        });
        const tourFilter = wrapper.querySelector('.pbh-tournament-filter');
        if (tourFilter) tourFilter.onchange = () => { _historyState.tournamentFilter = tourFilter.value; refreshHistoryList(); };
        const closeBtn = wrapper.querySelector('.pbh-close');
        if (closeBtn) closeBtn.onclick = () => document.querySelectorAll('.pbh-modal-overlay').forEach(el => el.remove());
        const printBtn = wrapper.querySelector('.pbh-print');
        if (printBtn) printBtn.onclick = () => printPlayerHistory(player, team);
        wrapper.querySelector('.pbh-modal-overlay').addEventListener('click', (e) => {
            if (e.target.classList.contains('pbh-modal-overlay')) {
                document.querySelectorAll('.pbh-modal-overlay').forEach(el => el.remove());
            }
        });

        refreshHistoryList();
    }

    function buildHistoryModalHtml(player, team) {
        const counts = countPlayerMatches(player.id);
        const tournaments = getAllTournaments();
        let tournamentOptions = '<option value="all">Todos los torneos</option>';
        tournaments.forEach(t => { tournamentOptions += `<option value="${t.id}">${esc(t.name)}</option>`; });

        return `
            <div class="pbh-modal-overlay">
                <div class="pbh-modal">
                    <div class="pbh-header">
                        <div class="pbh-player-info">
                            <img class="pbh-shield" src="${team ? team.shield : ''}" onerror="this.style.display='none'">
                            <div>
                                <h3 class="pbh-title">📜 Historial de ${esc(player.name)} ${player.isCaptain ? '👑' : ''}</h3>
                                <div class="pbh-subtitle">
                                    <span class="pbh-count-badge official">🏆 <strong>${counts.official}</strong> oficiales</span>
                                    <span class="pbh-count-badge friendly">🤝 <strong>${counts.friendly}</strong> amistosos</span>
                                    <span class="pbh-count-badge international">🌍 <strong>${counts.international}</strong> selección</span>
                                    <span class="pbh-count-badge total">📊 <strong>${counts.total}</strong> totales</span>
                                </div>
                            </div>
                        </div>
                        <div class="pbh-header-actions">
                            <button class="pbh-print" title="Imprimir historial">🖨️</button>
                            <button class="pbh-close" title="Cerrar">✕</button>
                        </div>
                    </div>
                    <div class="pbh-filters">
                        <div class="pbh-filter-group">
                            <span class="pbh-filter-label">Tipo:</span>
                            <button class="pbh-filter-btn active" data-filter="all">Todos</button>
                            <button class="pbh-filter-btn" data-filter="regular">Liga</button>
                            <button class="pbh-filter-btn" data-filter="playoff">Playoffs</button>
                            <button class="pbh-filter-btn" data-filter="friendly">Amistosos</button>
                            <button class="pbh-filter-btn" data-filter="international">Internacional</button>
                        </div>
                        <div class="pbh-filter-group">
                            <span class="pbh-filter-label">Torneo:</span>
                            <select class="pbh-tournament-filter">${tournamentOptions}</select>
                        </div>
                        <div class="pbh-filter-group">
                            <span class="pbh-filter-label">Orden:</span>
                            <button class="pbh-sort-btn active" data-sort="recent">Recientes</button>
                            <button class="pbh-sort-btn" data-sort="chronological">Cronológico</button>
                        </div>
                    </div>
                    <div class="pbh-body" id="pbh-body"></div>
                </div>
            </div>
        `;
    }

    function refreshHistoryList() {
        const body = document.getElementById('pbh-body');
        if (!body) return;
        const playerId = _historyState.playerId;
        let matches = collectAllPlayerMatches(playerId);
        if (_historyState.filter !== 'all') matches = matches.filter(m => m.type === _historyState.filter);
        if (_historyState.tournamentFilter !== 'all') matches = matches.filter(m => m.tournamentId === _historyState.tournamentFilter);
        if (_historyState.sort === 'recent') matches.sort((a, b) => b.order - a.order);
        else matches.sort((a, b) => a.order - b.order);

        document.querySelectorAll('.pbh-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === _historyState.filter));
        document.querySelectorAll('.pbh-sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === _historyState.sort));

        if (matches.length === 0) {
            body.innerHTML = `<div class="pbh-empty"><i class="fa-solid fa-inbox"></i><p>No hay partidos registrados para este jugador con los filtros seleccionados.</p></div>`;
            return;
        }

        let html = '';
        if (_historyState.sort === 'recent' && _historyState.tournamentFilter === 'all') {
            const grouped = {};
            matches.forEach(m => {
                if (!grouped[m.tournamentId]) grouped[m.tournamentId] = { name: m.tournamentName, matches: [] };
                grouped[m.tournamentId].matches.push(m);
            });
            const sortedGroups = Object.values(grouped).sort((a, b) => b.matches.length - a.matches.length);
            sortedGroups.forEach(g => {
                html += `<div class="pbh-tournament-header">🏆 ${esc(g.name)} <span class="pbh-count">${g.matches.length} partidos</span></div>`;
                g.matches.forEach(m => { html += renderHistoryItem(m); });
            });
        } else {
            matches.forEach(m => { html += renderHistoryItem(m); });
        }
        body.innerHTML = html;
    }

    function renderHistoryItem(m) {
        const torneo = getTournamentById(m.tournamentId);
        if (!torneo) return '';
        const h = torneo.teams.find(t => t.id === m.match.h);
        const a = torneo.teams.find(t => t.id === m.match.a);
        const hName = h ? h.name : 'TBD';
        const aName = a ? a.name : 'TBD';
        const hShield = h ? h.shield : '';
        const aShield = a ? a.shield : '';

        let sH = m.match.sH, sA = m.match.sA;
        let boxLabel = '';
        if (m.match.box && m.match.box.enabled && m.match.box.finished) {
            sH = m.match.box.winsH; sA = m.match.box.winsA;
            boxLabel = `<span class="pbh-box-badge">${m.match.box.label}</span>`;
        }
        const isHome = m.match.h === m.playerStats.tId;
        const playerWon = (isHome && sH > sA) || (!isHome && sA > sH);
        const playerLost = (isHome && sH < sA) || (!isHome && sA < sH);
        const resultIcon = playerWon ? '🟢' : (playerLost ? '🔴' : '🟡');
        const typeIcon = { regular: '📅', playoff: '⚔️', friendly: '🤝', international: '🌍' }[m.type] || '📋';
        const typeLabel = { regular: 'Liga', playoff: 'Playoffs', friendly: 'Amistoso', international: 'Internacional' }[m.type] || m.type;

        return `
            <div class="pbh-item" onclick="window.playerHistoryPatch.openMatchFromHistory('${m.tournamentId}', '${m.match.id}', '${m.type}')">
                <div class="pbh-item-left">
                    <span class="pbh-item-type type-${m.type}">${typeIcon} ${typeLabel}</span>
                    <span class="pbh-item-round">${esc(m.roundLabel)}</span>
                </div>
                <div class="pbh-item-teams">
                    <span class="pbh-item-team home ${isHome ? 'mine' : ''}">
                        <img src="${hShield}" onerror="this.style.display='none'">
                        <span class="pbh-item-team-name">${esc(hName)}</span>
                    </span>
                    <span class="pbh-item-score">${sH} - ${sA} ${boxLabel}</span>
                    <span class="pbh-item-team away ${!isHome ? 'mine' : ''}">
                        <span class="pbh-item-team-name">${esc(aName)}</span>
                        <img src="${aShield}" onerror="this.style.display='none'">
                    </span>
                </div>
                <div class="pbh-item-stats">
                    <span>${resultIcon}</span>
                    <span>⚽ ${m.playerStats.g || 0}</span>
                    <span>🎯 ${m.playerStats.a || 0}</span>
                    <span>🧤 ${m.playerStats.s || 0}</span>
                    <span>💀 ${m.playerStats.t || 0}</span>
                </div>
            </div>
        `;
    }

    // ============================================================
    // 8. IMPRIMIR HISTORIAL
    // ============================================================
    function printPlayerHistory(player, team) {
        const playerId = player.id;
        let matches = collectAllPlayerMatches(playerId);
        if (_historyState.filter !== 'all') matches = matches.filter(m => m.type === _historyState.filter);
        if (_historyState.tournamentFilter !== 'all') matches = matches.filter(m => m.tournamentId === _historyState.tournamentFilter);
        if (_historyState.sort === 'recent') matches.sort((a, b) => b.order - a.order);
        else matches.sort((a, b) => a.order - b.order);
        const counts = countPlayerMatches(playerId);

        const getHeader = (typeof window.getPrintHeader === 'function') ? window.getPrintHeader
            : (title) => `<div style="border-bottom:2px solid #2d2d44;padding-bottom:0.5rem;margin-bottom:1rem;"><h1 style="font-family:Montserrat,sans-serif;font-weight:900;color:#fff;">${title}</h1></div>`;

        let html = getHeader(`Historial de ${esc(player.name)}`);
        html += `<div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;padding:0.8rem;background:rgba(0,0,0,0.3);border-radius:12px;border:1px solid #2d2d44;">`;
        html += `<img src="${team ? team.shield : ''}" style="width:60px;height:60px;border-radius:50%;background:#000;border:2px solid #2d2d44;object-fit:contain;">`;
        html += `<div><div style="font-weight:900;font-size:1.3rem;color:#fff;">${esc(player.name)} ${player.isCaptain ? '👑' : ''}</div>`;
        html += `<div style="font-size:0.75rem;color:#94a3b8;margin-top:0.2rem;">`;
        html += `<span style="color:#22d3ee;">🏆 ${counts.official} oficiales</span> · `;
        html += `<span style="color:#facc15;">🤝 ${counts.friendly} amistosos</span> · `;
        html += `<span style="color:#a855f7;">🌍 ${counts.international} selección</span> · `;
        html += `<span style="color:#fff;">📊 ${counts.total} totales</span>`;
        html += `</div></div></div>`;

        if (matches.length === 0) {
            html += `<div style="text-align:center;color:#94a3b8;padding:2rem;">Sin partidos para mostrar.</div>`;
        } else {
            html += `<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">`;
            html += `<thead><tr style="background:rgba(30,30,47,0.7);border-bottom:1px solid #2d2d44;">`;
            ['Tipo','Jornada','Local','Res.','Visitante','G','A','S','T'].forEach((h, i) => {
                const color = i === 5 ? '#4ade80' : i === 6 ? '#22d3ee' : i === 7 ? '#ec4899' : i === 8 ? '#facc15' : '#94a3b8';
                html += `<th style="padding:0.4rem;text-align:${i < 3 ? 'left' : 'center'};color:${color};font-size:0.6rem;text-transform:uppercase;">${h}</th>`;
            });
            html += `</tr></thead><tbody>`;
            matches.forEach((m, i) => {
                const torneo = getTournamentById(m.tournamentId);
                const h = torneo.teams.find(t => t.id === m.match.h);
                const a = torneo.teams.find(t => t.id === m.match.a);
                let sH = m.match.sH, sA = m.match.sA; let boxLabel = '';
                if (m.match.box && m.match.box.enabled && m.match.box.finished) {
                    sH = m.match.box.winsH; sA = m.match.box.winsA;
                    boxLabel = ` (${m.match.box.label})`;
                }
                const isHome = m.match.h === m.playerStats.tId;
                const playerWon = (isHome && sH > sA) || (!isHome && sA > sH);
                const playerLost = (isHome && sH < sA) || (!isHome && sA < sH);
                const resultIcon = playerWon ? '🟢' : (playerLost ? '🔴' : '🟡');
                const typeIcon = { regular: '📅', playoff: '⚔️', friendly: '🤝', international: '🌍' }[m.type] || '📋';
                const bg = i % 2 === 0 ? 'rgba(30,30,47,0.3)' : 'rgba(20,20,30,0.3)';
                html += `<tr style="background:${bg};border-bottom:1px solid #2d2d44;">`;
                html += `<td style="padding:0.4rem;color:#fff;">${typeIcon} ${m.type.charAt(0).toUpperCase() + m.type.slice(1)}</td>`;
                html += `<td style="padding:0.4rem;color:#94a3b8;">${esc(m.roundLabel)}</td>`;
                html += `<td style="padding:0.4rem;text-align:right;color:#fff;font-weight:700;">`;
                html += `<img src="${h ? h.shield : ''}" style="width:16px;height:16px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;vertical-align:middle;margin-right:0.3rem;">${esc(h ? h.name : 'TBD')}</td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#facc15;font-weight:900;white-space:nowrap;">${sH} - ${sA}${boxLabel} ${resultIcon}</td>`;
                html += `<td style="padding:0.4rem;color:#fff;font-weight:700;">${esc(a ? a.name : 'TBD')}<img src="${a ? a.shield : ''}" style="width:16px;height:16px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;vertical-align:middle;margin-left:0.3rem;"></td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#4ade80;">${m.playerStats.g || 0}</td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#22d3ee;">${m.playerStats.a || 0}</td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#ec4899;">${m.playerStats.s || 0}</td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#facc15;">${m.playerStats.t || 0}</td>`;
                html += `</tr>`;
            });
            html += `</tbody></table>`;
        }
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">Generado desde MTM Nexus Visualizador</div>`;
        const resolveFn = (typeof window.resolveCSSVars === 'function') ? window.resolveCSSVars : (h) => h;
        html = resolveFn(html);
        const filename = `historial_${(player.name || 'jugador').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 20)}.jpg`;
        if (typeof window.showPrintModal === 'function') {
            window.showPrintModal(html, filename, 900);
        } else {
            const w = window.open('', '_blank');
            if (w) {
                w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Historial</title></head><body style="background:#0a0a0f;color:#e2e8f0;font-family:sans-serif;padding:1rem;">' + html + '</body></html>');
                w.document.close();
                setTimeout(() => w.print(), 500);
            }
        }
    }

    // ============================================================
    // 9. BÚSQUEDA DE PARTIDOS
    // ============================================================
    function findMatchById(matchId, torneo) {
        if (!torneo) return null;
        if (torneo.rounds) {
            for (const r of torneo.rounds) {
                const m = (r || []).find(x => x.id === matchId);
                if (m) return m;
            }
        }
        if (torneo.friendlyMatches) {
            const m = torneo.friendlyMatches.find(x => x.id === matchId);
            if (m) return m;
        }
        if (torneo.internationalMatches) {
            const m = torneo.internationalMatches.find(x => x.id === matchId);
            if (m) return m;
        }
        return null;
    }

    function findMatchAndTournament(matchId) {
        for (const t of getAllTournaments()) {
            if (t.rounds) {
                for (const r of t.rounds) {
                    const m = (r || []).find(x => x.id === matchId);
                    if (m) return { match: m, torneo: t };
                }
            }
            if (t.playoffs && t.playoffs.rounds) {
                for (const r of t.playoffs.rounds) {
                    const m = (r || []).find(x => x.id === matchId);
                    if (m) return { match: m, torneo: t, isPlayoff: true };
                }
            }
            if (t.friendlyMatches) {
                const m = t.friendlyMatches.find(x => x.id === matchId);
                if (m) return { match: m, torneo: t };
            }
            if (t.internationalMatches) {
                const m = t.internationalMatches.find(x => x.id === matchId);
                if (m) return { match: m, torneo: t };
            }
        }
        return { match: null, torneo: null };
    }

    // ============================================================
    // 10. ABRIR TARJETA CON CONTEXTO CORRECTO
    // ============================================================
    function showPlayerProfileInContext(playerId, preferredTorneo) {
        // 1. Buscar al jugador en el torneo preferido
        let found = findPlayerInTorneo(playerId, preferredTorneo);
        let targetTorneo = preferredTorneo;

        // 2. Si no está, buscar en cualquier otro torneo
        if (!found) {
            for (const t of getAllTournaments()) {
                found = findPlayerInTorneo(playerId, t);
                if (found) { targetTorneo = t; break; }
            }
        }
        if (!found) {
            // Último recurso: usar contexto actual
            return window.showPlayerProfile(playerId);
        }

        const originalData = getCurrentData();
        if (originalData && originalData.id === targetTorneo.id) {
            return window.showPlayerProfile(playerId);
        }

        // Swap temporalmente currentData
        try {
            // eslint-disable-next-line no-eval
            (0, eval)('currentData = arguments[0];').call(null, targetTorneo);
        } catch (_) { window.currentData = targetTorneo; }

        try {
            window.showPlayerProfile(playerId);
        } finally {
            setTimeout(() => {
                try {
                    // eslint-disable-next-line no-eval
                    (0, eval)('currentData = arguments[0];').call(null, originalData);
                } catch (_) { window.currentData = originalData; }
            }, 300);
        }
    }

    function openMatchFromHistory(tournamentId, matchId, matchType) {
        const targetTorneo = getTournamentById(tournamentId);
        if (!targetTorneo) return alert('Torneo no encontrado.');

        const cd = getCurrentData();
        const originalData = cd;

        try {
            // eslint-disable-next-line no-eval
            (0, eval)('currentData = arguments[0];').call(null, targetTorneo);
        } catch (_) { window.currentData = targetTorneo; }

        try {
            if (matchType === 'playoff' && window.playoffsBracketPatch) {
                const rounds = targetTorneo.playoffs && targetTorneo.playoffs.rounds;
                if (rounds) {
                    for (let r = 0; r < rounds.length; r++) {
                        for (let i = 0; i < rounds[r].length; i++) {
                            if (rounds[r][i].id === matchId) {
                                window.playoffsBracketPatch.openMatchModal(matchId, r, i);
                                _currentBracketContext = { match: rounds[r][i], roundIdx: r, matchIdx: i, torneo: targetTorneo };
                                setTimeout(fixBracketNames, 60);
                                setTimeout(fixBracketNames, 200);
                                setTimeout(fixBracketNames, 400);
                                return;
                            }
                        }
                    }
                }
                alert('Partido de playoff no encontrado.');
                return;
            }
            if (typeof window.showMatchStats === 'function') {
                window.showMatchStats(matchId);
            }
        } finally {
            setTimeout(() => {
                try {
                    // eslint-disable-next-line no-eval
                    (0, eval)('currentData = arguments[0];').call(null, originalData);
                } catch (_) { window.currentData = originalData; }
            }, 400);
        }
    }

    // ============================================================
    // 11. DECORAR MODAL DE PARTIDO (fix nombres + click jugadores + badges)
    // ============================================================
    function decorateMatchModal(match, torneo) {
        if (!match || !torneo) return;
        const modal = document.querySelector('.match-stats-modal') || document.querySelector('.pbh-match-modal');
        if (!modal) return;

        const teamBlocks = modal.querySelectorAll('.match-stats-team');
        teamBlocks.forEach(teamBlock => {
            const h4 = teamBlock.querySelector('h4');
            if (!h4) return;
            const teamName = h4.textContent.replace('🛡️ ', '').trim();
            const team = torneo.teams.find(t => t.name === teamName);
            if (!team) return;

            const statsForTeam = (match.stats || []).filter(s => s.tId === team.id);
            const activeStats = statsForTeam.filter(s => ((s.g || 0) + (s.a || 0) + (s.s || 0) + (s.t || 0)) > 0);

            const rows = teamBlock.querySelectorAll('table tbody tr');
            rows.forEach((row, idx) => {
                const cell = row.querySelector('td:first-child');
                if (!cell) return;
                const st = activeStats[idx];
                if (!st) return;

                const info = findPlayerAnywhere(st.pId);
                let playerName = null;
                let isCaptain = false;

                if (info) {
                    playerName = info.player.name;
                    isCaptain = info.player.isCaptain;
                } else {
                    const p = team.players.find(x => x.id === st.pId);
                    playerName = p ? p.name : null;
                    isCaptain = p && p.isCaptain;
                }
                if (!playerName) return;

                let badge = '';
                if (info) {
                    if (info.teamId === null) {
                        badge = '<span class="pbh-fa-badge" title="Agente libre">🆓</span>';
                    } else if (info.teamId !== team.id) {
                        badge = `<span class="pbh-transferred-badge" title="Actualmente en ${esc(info.teamName)}">↪</span>`;
                    }
                }

                cell.innerHTML = `${isCaptain ? '👑 ' : ''}${esc(playerName)}${badge}`;
                cell.classList.add('pbh-clickable-player');
                cell.title = 'Click para ver la tarjeta del jugador';
                cell.onclick = (e) => {
                    e.stopPropagation();
                    showPlayerProfileInContext(st.pId, torneo);
                };
            });
        });
    }

    let _currentBracketContext = null;

    function fixBracketNames() {
        if (!_currentBracketContext) return;
        decorateMatchModal(_currentBracketContext.match, _currentBracketContext.torneo);
    }

    // ============================================================
    // 12. OVERRIDE: showMatchStats
    //     Regla: si está en currentData → usar original
    //            si no → usar fallback (con clases nativas)
    // ============================================================
    const _originalShowMatchStats = window.showMatchStats;

    window.showMatchStats = function (matchId) {
        const cd = getCurrentData();
        if (cd) {
            let inCurrent = false;
            if (cd.rounds) {
                for (const r of cd.rounds) {
                    if ((r || []).some(x => x.id === matchId)) { inCurrent = true; break; }
                }
            }
            if (!inCurrent && cd.friendlyMatches) {
                if (cd.friendlyMatches.some(x => x.id === matchId)) inCurrent = true;
            }
            if (!inCurrent && cd.internationalMatches) {
                if (cd.internationalMatches.some(x => x.id === matchId)) inCurrent = true;
            }
            if (inCurrent && typeof _originalShowMatchStats === 'function') {
                const result = _originalShowMatchStats.call(this, matchId);
                const match = findMatchById(matchId, cd);
                if (match) {
                    setTimeout(() => decorateMatchModal(match, cd), 30);
                    setTimeout(() => decorateMatchModal(match, cd), 150);
                }
                return result;
            }
        }
        // Partido externo
        const { match, torneo } = findMatchAndTournament(matchId);
        if (!match) { console.warn('[player-history] Partido no encontrado:', matchId); return; }
        renderFallbackMatchModal(match, torneo);
    };

    // ============================================================
    // 13. FALLBACK MODAL (usa clases NATIVAS del visualizador)
    // ============================================================
    function renderFallbackMatchModal(match, torneo) {
        if (!torneo) {
            for (const t of getAllTournaments()) {
                if ((t.teams || []).some(tm => tm.id === match.h || tm.id === match.a)) { torneo = t; break; }
            }
        }
        if (!torneo) return;

        const h = torneo.teams.find(t => t.id === match.h);
        const a = torneo.teams.find(t => t.id === match.a);
        const hName = h ? h.name : 'Desconocido';
        const aName = a ? a.name : 'Desconocido';
        const hShield = h ? h.shield : '';
        const aShield = a ? a.shield : '';
        const hWinner = match.sH > match.sA;
        const aWinner = match.sA > match.sH;

        let sH = match.sH, sA = match.sA;
        let boxLabel = '';
        if (match.box && match.box.enabled && match.box.finished) {
            sH = match.box.winsH;
            sA = match.box.winsA;
            boxLabel = `<div style="text-align:center;font-size:0.7rem;color:#a855f7;font-weight:900;letter-spacing:0.08em;margin-top:0.2rem;">SERIE ${match.box.label}</div>`;
        }

        const hStats = (match.stats || []).filter(s => s.tId === match.h);
        const aStats = (match.stats || []).filter(s => s.tId === match.a);

        function renderPlayerStats(team, statsArray) {
            const activeStats = statsArray.filter(s => (s.g || 0) > 0 || (s.a || 0) > 0 || (s.s || 0) > 0 || (s.t || 0) > 0);
            if (!team || !activeStats.length) {
                return `<table class="match-stats-table"><tbody><tr><td class="empty" colspan="5">Sin estadísticas registradas</td></tr></tbody></table>`;
            }
            let rows = '';
            activeStats.forEach(st => {
                const p = team.players.find(x => x.id === st.pId);
                const name = p ? p.name : '?';
                const captain = p && p.isCaptain ? '👑 ' : '';
                rows += `<tr>
                    <td>${captain}${esc(name)}</td>
                    <td class="g">${st.g || 0}</td>
                    <td class="a">${st.a || 0}</td>
                    <td class="s">${st.s || 0}</td>
                    <td class="t">${st.t || 0}</td>
                </tr>`;
            });
            return `
                <table class="match-stats-table">
                    <thead><tr>
                        <th>Jugador</th>
                        <th class="g">⚽ G</th>
                        <th class="a">🎯 A</th>
                        <th class="s">🧤 S</th>
                        <th class="t">💀 T</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        }

        const overlay = document.createElement('div');
        overlay.className = 'print-modal-overlay';
        overlay.innerHTML = `
            <div class="match-stats-modal">
                <div class="match-stats-header">
                    <div class="team-block ${hWinner ? 'winner' : ''}">
                        <img src="${hShield}" alt="">
                        <div class="team-name">${esc(hName)}</div>
                    </div>
                    <div class="match-stats-score">${sH} - ${sA}</div>
                    <div class="team-block ${aWinner ? 'winner' : ''}">
                        <img src="${aShield}" alt="">
                        <div class="team-name">${esc(aName)}</div>
                    </div>
                </div>
                ${boxLabel}
                <div class="match-stats-body">
                    <div class="match-stats-team home">
                        <h4>🛡️ ${esc(hName)}</h4>
                        ${renderPlayerStats(h, hStats)}
                    </div>
                    <div class="match-stats-team away">
                        <h4>🛡️ ${esc(aName)}</h4>
                        ${renderPlayerStats(a, aStats)}
                    </div>
                </div>
                <div class="match-stats-actions">
                    <button class="btn-cancel" onclick="this.closest('.print-modal-overlay').remove()">Cerrar</button>
                    <button class="btn-download" onclick="window.playerHistoryPatch.printFallbackMatch('${match.id}', '${torneo.id}')">🖨️ Imprimir</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Decorar para arreglar nombres y hacer clickeables a los jugadores
        setTimeout(() => decorateMatchModal(match, torneo), 20);
        setTimeout(() => decorateMatchModal(match, torneo), 100);
    }

    // ============================================================
    // 14. IMPRIMIR PARTIDO FALLBACK
    // ============================================================
    function printFallbackMatch(matchId, tournamentId) {
        const torneo = getTournamentById(tournamentId);
        if (!torneo) return alert('Torneo no encontrado.');
        const { match } = { match: findMatchById(matchId, torneo) || (torneo.playoffs && torneo.playoffs.rounds && (() => {
            for (const r of torneo.playoffs.rounds) {
                const m = (r || []).find(x => x.id === matchId);
                if (m) return m;
            }
            return null;
        })()) || (torneo.friendlyMatches && torneo.friendlyMatches.find(x => x.id === matchId)) };
        if (!match) return;

        const h = torneo.teams.find(t => t.id === match.h);
        const a = torneo.teams.find(t => t.id === match.a);
        const hStats = (match.stats || []).filter(s => s.tId === match.h);
        const aStats = (match.stats || []).filter(s => s.tId === match.a);
        const hName = h ? h.name : '?';
        const aName = a ? a.name : '?';
        const hShield = h ? h.shield : '';
        const aShield = a ? a.shield : '';

        let sH = match.sH, sA = match.sA;
        let boxLabel = '';
        if (match.box && match.box.enabled && match.box.finished) {
            sH = match.box.winsH; sA = match.box.winsA;
            boxLabel = ` <span style="color:#a855f7;font-size:0.85rem;">(${match.box.label})</span>`;
        }

        const getHeader = (typeof window.getPrintHeader === 'function') ? window.getPrintHeader
            : (title) => `<div style="border-bottom:2px solid #2d2d44;padding-bottom:0.5rem;margin-bottom:1rem;"><h1 style="font-family:Montserrat,sans-serif;font-weight:900;color:#fff;">${title}</h1></div>`;

        const renderTeamBlock = (team, statsArr, isHome) => {
            if (!team) return '';
            const active = statsArr.filter(s => ((s.g || 0) + (s.a || 0) + (s.s || 0) + (s.t || 0)) > 0);
            let rows = '';
            active.forEach(st => {
                const info = findPlayerAnywhere(st.pId);
                const p = info ? info.player : team.players.find(x => x.id === st.pId);
                rows += `<tr>
                    <td style="padding:0.4rem 0.5rem;color:#fff;font-weight:700;">${p ? (p.isCaptain ? '👑 ' : '') + esc(p.name) : '?'}</td>
                    <td style="padding:0.4rem;text-align:center;color:#4ade80;">${st.g || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#22d3ee;">${st.a || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#ec4899;">${st.s || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#facc15;">${st.t || 0}</td>
                </tr>`;
            });
            return `
                <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.8rem;border-left:3px solid ${isHome ? '#4ade80' : '#f87171'};">
                    <h4 style="font-size:0.9rem;color:${isHome ? '#4ade80' : '#f87171'};margin-bottom:0.5rem;text-transform:uppercase;">${esc(team.name)}</h4>
                    <table style="width:100%;font-size:0.75rem;border-collapse:collapse;">
                        <thead><tr style="border-bottom:1px solid #2d2d44;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">
                            <th style="text-align:left;padding:0.3rem;">Jugador</th>
                            <th style="text-align:center;color:#4ade80;">G</th>
                            <th style="text-align:center;color:#22d3ee;">A</th>
                            <th style="text-align:center;color:#ec4899;">S</th>
                            <th style="text-align:center;color:#facc15;">T</th>
                        </tr></thead>
                        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:0.6rem;">Sin stats</td></tr>'}</tbody>
                    </table>
                </div>
            `;
        };

        let html = getHeader('Estadísticas del Partido');
        html += `<div style="text-align:center;margin:0.8rem 0 1rem;font-size:1.1rem;color:#fff;font-weight:900;">${esc(hName)} <span style="color:#facc15;">${sH} - ${sA}</span> ${esc(aName)}${boxLabel}</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">${renderTeamBlock(h, hStats, true)}${renderTeamBlock(a, aStats, false)}</div>`;
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${esc(torneo.name)} · Generado desde MTM Nexus</div>`;

        const resolveFn = (typeof window.resolveCSSVars === 'function') ? window.resolveCSSVars : (h) => h;
        html = resolveFn(html);
        const filename = `partido_${(hName + '_vs_' + aName).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)}.jpg`;
        if (typeof window.showPrintModal === 'function') {
            window.showPrintModal(html, filename, 900);
        }
    }

    // ============================================================
    // 15. OVERRIDE: showPlayerProfile
    // ============================================================
    const _originalShowPlayerProfile = window.showPlayerProfile;

    window.showPlayerProfile = function (playerId) {
        if (typeof _originalShowPlayerProfile === 'function') {
            _originalShowPlayerProfile.call(this, playerId);
        }
        setTimeout(() => patchPlayerProfile(playerId), 20);
        setTimeout(() => patchPlayerProfile(playerId), 120);
    };

    function patchPlayerProfile(playerId) {
        const content = document.getElementById('profile-modal-content');
        if (!content) return;
        if (content.querySelector('.pbh-matches-grid')) return;

        // Contadores
        try {
            const counts = countPlayerMatches(playerId);
            const statsGrid = content.querySelector('.profile-stats-grid');
            if (statsGrid) {
                const matchGrid = document.createElement('div');
                matchGrid.className = 'profile-stats-grid pbh-matches-grid';
                matchGrid.innerHTML = `
                    <div class="stat-item pbh-stat-official">
                        <div class="stat-value">🏆 ${counts.official}</div>
                        <div class="stat-label">Partidos Oficiales</div>
                    </div>
                    <div class="stat-item pbh-stat-friendly">
                        <div class="stat-value">🤝 ${counts.friendly}</div>
                        <div class="stat-label">Amistosos</div>
                    </div>
                    <div class="stat-item pbh-stat-international">
                        <div class="stat-value">🌍 ${counts.international}</div>
                        <div class="stat-label">Selección Nacional</div>
                    </div>
                    <div class="stat-item pbh-stat-total">
                        <div class="stat-value">📊 ${counts.total}</div>
                        <div class="stat-label">Total de Partidos</div>
                    </div>
                `;
                statsGrid.parentNode.insertBefore(matchGrid, statsGrid.nextSibling);
            }
        } catch (e) { console.warn('[player-history] Error contadores:', e); }

        // Indicador de división
        try {
            const badgesContainer = content.querySelector('.profile-badges');
            if (badgesContainer && !badgesContainer.querySelector('.pbh-division-badge')) {
                const cd = getCurrentData();
                const div = getTournamentDivision(cd);
                const label = divisionLabel(div);
                if (label) {
                    const badge = document.createElement('span');
                    badge.className = 'pbh-division-badge' + (div === 'cup' ? ' cup' : (div === 1 ? ' div1' : ' div2'));
                    badge.textContent = label;
                    badgesContainer.insertBefore(badge, badgesContainer.firstChild);
                }
            }
        } catch (e) { console.warn('[player-history] Error division badge:', e); }

        // Botón Historial
        const actionsLeft = content.querySelector('.profile-actions-left');
        if (actionsLeft && !actionsLeft.querySelector('.btn-history')) {
            const historyBtn = document.createElement('button');
            historyBtn.className = 'btn-history';
            historyBtn.type = 'button';
            historyBtn.innerHTML = '📜 Ver Historial';
            historyBtn.onclick = () => {
                if (typeof window.closePlayerProfile === 'function') {
                    window.closePlayerProfile();
                } else {
                    const overlay = document.getElementById('profile-modal-overlay');
                    if (overlay) overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
                setTimeout(() => renderPlayerHistoryModal(playerId), 120);
            };
            const perfBtn = actionsLeft.querySelector('.btn-performance');
            if (perfBtn && perfBtn.nextSibling) {
                perfBtn.parentNode.insertBefore(historyBtn, perfBtn.nextSibling);
            } else if (perfBtn) {
                actionsLeft.appendChild(historyBtn);
            } else {
                actionsLeft.appendChild(historyBtn);
            }
        }

        // Fix footer PC
        const actions = content.querySelector('.profile-actions');
        if (actions) {
            actions.style.display = 'flex';
            actions.style.flexDirection = 'row';
            actions.style.flexWrap = 'wrap';
            actions.style.justifyContent = 'space-between';
            actions.style.alignItems = 'center';
            actions.style.gap = '0.6rem';
        }
        content.querySelectorAll('.profile-actions button').forEach(btn => {
            btn.style.visibility = 'visible';
            btn.style.opacity = '1';
        });
        const printBtn = content.querySelector('.profile-actions .btn-share');
        if (printBtn) {
            printBtn.style.display = 'inline-flex';
            printBtn.style.alignItems = 'center';
            printBtn.style.justifyContent = 'center';
        }
    }

    // ============================================================
    // 16. OVERRIDE: renderPerformanceJugadores
    // ============================================================
    const _originalRenderPerformanceJugadores = window.renderPerformanceJugadores;
    if (typeof _originalRenderPerformanceJugadores === 'function') {
        window.renderPerformanceJugadores = function () {
            _originalRenderPerformanceJugadores.call(this);
            setTimeout(patchPerformanceFilters, 40);
            setTimeout(patchPerformanceFilters, 200);
        };
    }

    function patchPerformanceFilters() {
        const selectors = document.querySelector('#perf-jugadores-content .perf-line-selectors');
        if (!selectors) return;
        if (selectors.querySelector('.pbh-btn-view-card')) return;
        const btn = document.createElement('button');
        btn.className = 'pbh-btn-view-card';
        btn.type = 'button';
        btn.innerHTML = '👤 Ver tarjeta individual';
        btn.onclick = () => {
            const pid = getPerfSelectedPlayerId();
            if (pid) window.showPlayerProfile(pid);
            else alert('Selecciona un jugador primero.');
        };
        selectors.appendChild(btn);
    }

    // ============================================================
    // 17. HOOK BRACKET PATCH
    // ============================================================
    function hookBracketPatch() {
        if (!window.playoffsBracketPatch) return false;
        const pp = window.playoffsBracketPatch;
        if (pp._pbhWrapped) return true;

        const _origOpen = pp.openMatchModal;
        pp.openMatchModal = function (matchId, roundIdx, matchIdx) {
            const torneo = getCurrentData();
            const match = torneo?.playoffs?.rounds?.[roundIdx]?.[matchIdx];
            _currentBracketContext = match ? { match, roundIdx, matchIdx, torneo } : null;
            const result = _origOpen.call(this, matchId, roundIdx, matchIdx);
            setTimeout(fixBracketNames, 40);
            setTimeout(fixBracketNames, 150);
            setTimeout(fixBracketNames, 400);
            return result;
        };

        const _origSelect = pp.selectGame;
        pp.selectGame = function (idx) {
            const result = _origSelect.call(this, idx);
            setTimeout(fixBracketNames, 40);
            setTimeout(fixBracketNames, 150);
            return result;
        };

        pp._pbhWrapped = true;
        return true;
    }

    if (!hookBracketPatch()) {
        let attempts = 0;
        const t = setInterval(() => {
            attempts++;
            if (hookBracketPatch() || attempts > 20) clearInterval(t);
        }, 100);
    }

    // ============================================================
    // 18. CSS
    // ============================================================
    function injectStyles() {
        if (document.getElementById('pbh-styles')) return;
        const style = document.createElement('style');
        style.id = 'pbh-styles';
        style.textContent = `
/* Botón Historial */
.btn-history {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    padding: 0.5rem 1.2rem;
    border-radius: 10px;
    border: none;
    font-weight: 700;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-family: inherit;
}
.btn-history:hover {
    box-shadow: 0 0 16px rgba(245,158,11,0.5);
    transform: translateY(-1px);
}

/* Badges de división en la tarjeta */
.pbh-division-badge {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 900;
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.pbh-division-badge.div1 {
    color: #ffd700;
    background: rgba(255, 215, 0, 0.1);
    border-color: rgba(255, 215, 0, 0.4);
}
.pbh-division-badge.div2 {
    color: #22d3ee;
    background: rgba(34, 211, 238, 0.1);
    border-color: rgba(34, 211, 238, 0.4);
}
.pbh-division-badge.cup {
    color: #a855f7;
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.4);
}

/* Contadores de partidos */
.pbh-matches-grid { margin-top: 0.5rem; }
.pbh-matches-grid .stat-item {
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 0.55rem 0.3rem;
    text-align: center;
}
.pbh-matches-grid .stat-value { font-size: 1.15rem; font-weight: 900; }
.pbh-stat-official .stat-value { color: #22d3ee; }
.pbh-stat-friendly .stat-value { color: #facc15; }
.pbh-stat-international .stat-value { color: #a855f7; }
.pbh-stat-total .stat-value { color: #fff; }

/* Badges en celdas de jugador */
.pbh-transferred-badge {
    display: inline-block;
    margin-left: 0.35rem;
    font-size: 0.7rem;
    color: #f59e0b;
    background: rgba(245,158,11,0.15);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    border: 1px solid rgba(245,158,11,0.3);
    cursor: help;
}
.pbh-fa-badge {
    display: inline-block;
    margin-left: 0.35rem;
    font-size: 0.7rem;
    color: #22d3ee;
    background: rgba(34,211,238,0.15);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    border: 1px solid rgba(34,211,238,0.3);
    cursor: help;
}
.pbh-clickable-player {
    cursor: pointer;
    transition: color 0.15s;
}
.pbh-clickable-player:hover {
    color: #facc15 !important;
    text-decoration: underline dotted;
}

/* Footer del perfil en PC */
@media (min-width: 821px) {
    .profile-actions {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: wrap !important;
        justify-content: space-between !important;
        align-items: center !important;
        gap: 0.6rem !important;
    }
    .profile-actions .btn-share,
    .profile-actions .btn-performance,
    .profile-actions .btn-history {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: 1 !important;
    }
    .profile-actions .btn-close { width: auto !important; }
}

/* Modal de Historial */
.pbh-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: pbhFadeIn 0.25s ease;
}
@keyframes pbhFadeIn { from { opacity: 0; } to { opacity: 1; } }

.pbh-modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    width: 100%;
    height: 95vh;
    max-width: 1100px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    animation: pbhModalIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
}
@keyframes pbhModalIn {
    from { opacity: 0; transform: scale(0.96) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.pbh-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(180deg, rgba(168,85,247,0.08), transparent);
    flex-shrink: 0; gap: 0.5rem;
}
.pbh-player-info { display: flex; align-items: center; gap: 1rem; min-width: 0; flex: 1; }
.pbh-shield {
    width: 54px; height: 54px; border-radius: 50%;
    background: #000; border: 2px solid var(--color-border);
    object-fit: contain; flex-shrink: 0;
}
.pbh-title {
    font-family: 'Montserrat', sans-serif;
    font-size: 1.3rem; font-weight: 900; color: #fff;
    margin-bottom: 0.35rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pbh-subtitle { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.pbh-count-badge {
    font-size: 0.7rem; padding: 0.2rem 0.6rem;
    border-radius: 8px; border: 1px solid; white-space: nowrap;
}
.pbh-count-badge.official { color: #22d3ee; border-color: rgba(34,211,238,0.3); background: rgba(34,211,238,0.08); }
.pbh-count-badge.friendly { color: #facc15; border-color: rgba(250,204,21,0.3); background: rgba(250,204,21,0.08); }
.pbh-count-badge.international { color: #a855f7; border-color: rgba(168,85,247,0.3); background: rgba(168,85,247,0.08); }
.pbh-count-badge.total { color: #fff; border-color: rgba(255,255,255,0.2); background: rgba(255,255,255,0.05); }

.pbh-header-actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
.pbh-print, .pbh-close {
    background: transparent; border: 1px solid var(--color-border);
    color: var(--color-text); width: 38px; height: 38px;
    border-radius: 10px; font-size: 1rem; cursor: pointer;
    transition: all 0.2s; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
}
.pbh-print:hover { background: rgba(168,85,247,0.1); border-color: #a855f7; color: #a855f7; }
.pbh-close:hover { background: rgba(255,255,255,0.05); border-color: var(--color-text); }

.pbh-filters {
    display: flex; flex-wrap: wrap; gap: 1rem;
    padding: 0.85rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    background: rgba(0,0,0,0.2); flex-shrink: 0;
}
.pbh-filter-group { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
.pbh-filter-label {
    font-size: 0.65rem; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--color-text-muted); font-weight: 700;
}
.pbh-filter-btn, .pbh-sort-btn {
    padding: 0.3rem 0.7rem; border-radius: 8px;
    background: transparent; border: 1px solid var(--color-border);
    color: var(--color-text-muted); font-size: 0.7rem;
    font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
}
.pbh-filter-btn:hover, .pbh-sort-btn:hover { color: #fff; border-color: rgba(168,85,247,0.5); }
.pbh-filter-btn.active, .pbh-sort-btn.active {
    background: var(--neon-purple, #a855f7); color: #000;
    border-color: var(--neon-purple, #a855f7);
    box-shadow: 0 0 10px rgba(168,85,247,0.3);
}
.pbh-tournament-filter {
    background: #000; border: 1px solid var(--color-border);
    color: #fff; padding: 0.3rem 0.6rem; border-radius: 8px;
    font-size: 0.72rem; font-family: inherit; cursor: pointer; outline: none;
}

.pbh-body {
    flex: 1; min-height: 0; overflow-y: auto;
    padding: 1rem 1.5rem;
    -webkit-overflow-scrolling: touch;
}
.pbh-tournament-header {
    font-family: 'Montserrat', sans-serif; font-size: 0.85rem;
    font-weight: 900; color: var(--neon-cyan, #22d3ee);
    text-transform: uppercase; letter-spacing: 0.1em;
    padding: 0.75rem 0 0.5rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 0.5rem; margin-top: 0.75rem;
    display: flex; justify-content: space-between; align-items: center;
}
.pbh-tournament-header:first-child { margin-top: 0; }
.pbh-count { font-size: 0.65rem; color: var(--color-text-muted); font-weight: 700; }

.pbh-item {
    display: grid; grid-template-columns: 140px 1fr 180px;
    gap: 0.8rem; align-items: center;
    padding: 0.65rem 0.85rem;
    background: rgba(0,0,0,0.25);
    border: 1px solid var(--color-border);
    border-radius: 10px; margin-bottom: 0.4rem;
    cursor: pointer; transition: all 0.15s;
}
.pbh-item:hover {
    background: rgba(168,85,247,0.08);
    border-color: rgba(168,85,247,0.4);
    transform: translateX(2px);
}
.pbh-item-left { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.pbh-item-type {
    font-size: 0.68rem; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.06em; padding: 0.15rem 0.4rem;
    border-radius: 5px; display: inline-block; width: fit-content;
}
.pbh-item-type.type-regular { background: rgba(34,211,238,0.15); color: #22d3ee; }
.pbh-item-type.type-playoff { background: rgba(250,204,21,0.15); color: #facc15; }
.pbh-item-type.type-friendly { background: rgba(74,222,128,0.15); color: #4ade80; }
.pbh-item-type.type-international { background: rgba(168,85,247,0.15); color: #a855f7; }
.pbh-item-round {
    font-size: 0.7rem; color: var(--color-text-muted);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pbh-item-teams {
    display: flex; align-items: center; justify-content: center;
    gap: 0.6rem; min-width: 0;
}
.pbh-item-team { display: flex; align-items: center; gap: 0.35rem; min-width: 0; flex: 1; }
.pbh-item-team.away { justify-content: flex-end; }
.pbh-item-team img {
    width: 22px; height: 22px; border-radius: 50%;
    background: #000; border: 1px solid var(--color-border);
    object-fit: contain; flex-shrink: 0;
}
.pbh-item-team.mine img { border-color: #facc15; box-shadow: 0 0 8px rgba(250,204,21,0.4); }
.pbh-item-team.mine .pbh-item-team-name { color: #facc15; font-weight: 900; }
.pbh-item-team-name {
    font-size: 0.78rem; font-weight: 700; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pbh-item-team.home .pbh-item-team-name { text-align: right; }
.pbh-item-team.away .pbh-item-team-name { text-align: left; }
.pbh-item-score {
    font-family: 'Montserrat', sans-serif; font-weight: 900;
    font-size: 0.95rem; color: #facc15;
    padding: 0.15rem 0.55rem;
    background: rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px; white-space: nowrap; flex-shrink: 0;
    display: flex; align-items: center; gap: 0.3rem;
}
.pbh-box-badge {
    font-size: 0.55rem; color: #a855f7;
    background: rgba(168,85,247,0.15); padding: 0.05rem 0.3rem;
    border-radius: 4px; border: 1px solid rgba(168,85,247,0.3);
}
.pbh-item-stats {
    display: flex; justify-content: flex-end; gap: 0.5rem;
    font-size: 0.72rem; font-weight: 700; color: var(--color-text-muted);
}
.pbh-item-stats span { white-space: nowrap; }
.pbh-item-stats span:first-child { font-size: 0.85rem; }
.pbh-empty {
    text-align: center; padding: 3rem 1rem;
    color: var(--color-text-muted);
}
.pbh-empty i { font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.4; }

.pbh-btn-view-card {
    background: var(--neon-purple, #a855f7); color: #000;
    padding: 0.3rem 0.8rem; border-radius: 6px; border: none;
    font-weight: 700; font-size: 0.72rem; cursor: pointer;
    transition: all 0.15s; font-family: inherit; margin-left: auto;
}
.pbh-btn-view-card:hover {
    background: #c084fc;
    box-shadow: 0 0 12px rgba(168,85,247,0.5);
}

/* z-index del modal de playoff sobre el historial */
.pbx-modal-overlay { z-index: 1000001 !important; }

/* Perfil por encima del modal de partido */
.profile-modal-overlay.active { z-index: 1000002 !important; }

/* RESPONSIVE MÓVIL */
@media (max-width: 700px) {
    .pbh-modal-overlay { padding: 0; align-items: flex-start; }
    .pbh-modal {
        height: 100vh; height: 100dvh;
        max-height: 100vh; max-height: 100dvh;
        border-radius: 0; max-width: 100%;
        padding-top: env(safe-area-inset-top, 0);
        padding-bottom: env(safe-area-inset-bottom, 0);
    }
    .pbh-header { padding: 0.7rem 0.9rem; gap: 0.4rem; }
    .pbh-shield { width: 42px; height: 42px; }
    .pbh-title { font-size: 0.95rem; white-space: normal; line-height: 1.2; margin-bottom: 0.25rem; }
    .pbh-subtitle { gap: 0.25rem; }
    .pbh-count-badge { font-size: 0.58rem; padding: 0.12rem 0.4rem; }
    .pbh-header-actions { gap: 0.25rem; }
    .pbh-print, .pbh-close { width: 34px; height: 34px; font-size: 0.9rem; }
    .pbh-filters { padding: 0.5rem 0.7rem; gap: 0.5rem; }
    .pbh-filter-group { gap: 0.3rem; }
    .pbh-filter-label { font-size: 0.6rem; }
    .pbh-filter-btn, .pbh-sort-btn { font-size: 0.62rem; padding: 0.25rem 0.5rem; }
    .pbh-tournament-filter { font-size: 0.65rem; padding: 0.25rem 0.5rem; }
    .pbh-body { padding: 0.6rem 0.7rem 1rem; }
    .pbh-tournament-header { font-size: 0.75rem; padding: 0.5rem 0 0.35rem; }
    .pbh-item { grid-template-columns: 1fr; gap: 0.35rem; padding: 0.55rem 0.6rem; }
    .pbh-item-left { flex-direction: row; align-items: center; gap: 0.4rem; }
    .pbh-item-type { font-size: 0.6rem; padding: 0.1rem 0.35rem; }
    .pbh-item-round { font-size: 0.65rem; }
    .pbh-item-teams { justify-content: space-between; gap: 0.3rem; }
    .pbh-item-team { flex: 1; min-width: 0; gap: 0.25rem; }
    .pbh-item-team img { width: 18px; height: 18px; }
    .pbh-item-team-name { font-size: 0.7rem; }
    .pbh-item-score { font-size: 0.8rem; padding: 0.1rem 0.4rem; }
    .pbh-item-stats { justify-content: center; font-size: 0.65rem; gap: 0.4rem; }
}
`;
        document.head.appendChild(style);
    }

    // ============================================================
    // 19. OBSERVER: detectar modales abiertos para decorar
    // ============================================================
    (function setupObserver() {
        const observer = new MutationObserver(() => {
            if (_currentBracketContext) fixBracketNames();
        });
        observer.observe(document.body, { childList: true, subtree: false });
    })();

    // ============================================================
    // 20. API PÚBLICA
    // ============================================================
    window.playerHistoryPatch = {
        openMatchFromHistory,
        renderPlayerHistoryModal,
        collectAllPlayerMatches,
        countPlayerMatches,
        isCupFormat,
        findPlayerAnywhere,
        showPlayerProfileInContext,
        printFallbackMatch,
        reloadCopaData: () => {
            window.copaData = null;
            _copaLoadPromise = null;
            return loadCopaData();
        }
    };

    // ============================================================
    // 21. INIT
    // ============================================================
    injectStyles();
    console.log('✅ Player History Patch v1.3 cargado.');
})();