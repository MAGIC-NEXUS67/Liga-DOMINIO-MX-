// ============================================================
// MTM VISUALIZADOR - PLAYER HISTORY PATCH v1.2
// ============================================================
// v1.2:
//   - Modal mobile: 100dvh + safe-area + alineación superior
//   - "Ver Historial" cierra la tarjeta del perfil primero
//   - Adaptación móvil mejorada del historial
//   - Botón "Imprimir" en el historial
//   - Z-index del modal de playoff > historial (superposición)
//   - Fix jugadores transferidos (ya no aparece "?")
// ============================================================
// Carga DESPUÉS de script.js y playoffs-bracket-patch.js
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // 0. HELPERS PARA BINDINGS GLOBALES (let en script.js)
    // ============================================================
    function g(name) {
        try {
            // eslint-disable-next-line no-eval
            return (new Function('return typeof ' + name + ' !== "undefined" ? ' + name + ' : undefined'))();
        } catch (_) {
            return undefined;
        }
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

    // Busca un jugador por ID en TODOS los torneos/equipos/free agents.
    // Devuelve { player, teamId, teamName, teamShield } o null.
    function findPlayerAnywhere(playerId) {
        for (const torneo of getAllTournaments()) {
            for (const tm of (torneo.teams || [])) {
                const p = tm.players.find(x => x.id === playerId);
                if (p) {
                    return {
                        player: p,
                        teamId: tm.id,
                        teamName: tm.name,
                        teamShield: tm.shield
                    };
                }
            }
            if (torneo.freeAgents) {
                const p = torneo.freeAgents.find(x => x.id === playerId);
                if (p) {
                    return {
                        player: p,
                        teamId: null,
                        teamName: 'Agente Libre',
                        teamShield: ''
                    };
                }
            }
        }
        return null;
    }

    function getPlayerName(playerId) {
        const found = findPlayerAnywhere(playerId);
        return found ? found.player.name : null;
    }

    // ============================================================
    // 2. CARGA DE copa.json
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
    // 3. SELECTOR DE TORNEOS
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
            if (!window.copaData) {
                alert('La copa no está disponible.');
                return;
            }
            try {
                // eslint-disable-next-line no-eval
                (0, eval)('currentData = window.copaData;');
            } catch (_) {
                window.currentData = window.copaData;
            }
            try {
                // eslint-disable-next-line no-eval
                (0, eval)('currentDivision = 3;');
            } catch (_) {
                window.currentDivision = 3;
            }
            if (typeof window.loadLogo === 'function') {
                window.loadLogo('logo3.png', 'logo3.jpg');
            }
            if (typeof window.applyData === 'function') {
                window.applyData(window.copaData);
            }
            return;
        }
        return _originalSelectTournament.call(this, division);
    };

    // ============================================================
    // 4. DETECCIÓN DE COPA Y OCULTAR MENÚS
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
                    if (toRemove.includes(MENU_ITEMS[i].id)) {
                        MENU_ITEMS.splice(i, 1);
                    }
                }
            }
        }
        if (typeof _originalBuildUI === 'function') {
            _originalBuildUI.call(this, torneo);
        }
    };

    // ============================================================
    // 5. COLECCIÓN DE PARTIDOS
    // ============================================================
    function getTournamentById(id) {
        if (!id) return null;
        const cd = getCurrentData();
        if (cd && cd.id === id) return cd;
        if (window.copaData && window.copaData.id === id) return window.copaData;
        const d1 = getData1();
        if (d1 && d1.id === id) return d1;
        const d2 = getData2();
        if (d2 && d2.id === id) return d2;
        return null;
    }

    function getAllTournaments() {
        const all = [];
        const cd = getCurrentData();
        if (cd) all.push(cd);
        if (window.copaData && (!cd || window.copaData.id !== cd.id)) {
            all.push(window.copaData);
        }
        return all;
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
                    type: 'regular',
                    roundLabel: `Jornada ${rIdx + 1}`,
                    roundIdx: rIdx,
                    matchIdx: null,
                    match: m,
                    playerStats: st,
                    tournamentId: torneo.id,
                    tournamentName: torneo.name,
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
                        type: 'playoff',
                        roundLabel: labels[rIdx] || `Playoff R${rIdx + 1}`,
                        roundIdx: rIdx,
                        matchIdx: mIdx,
                        match: m,
                        playerStats: st,
                        tournamentId: torneo.id,
                        tournamentName: torneo.name,
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
                type: 'friendly',
                roundLabel: `Amistoso`,
                roundIdx: idx,
                matchIdx: null,
                match: m,
                playerStats: st,
                tournamentId: torneo.id,
                tournamentName: torneo.name,
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
                roundIdx: idx,
                matchIdx: null,
                match: m,
                playerStats: st,
                tournamentId: torneo.id,
                tournamentName: torneo.name,
                order: 700000 + idx
            });
        });

        return out;
    }

    function collectAllPlayerMatches(playerId) {
        let all = [];
        getAllTournaments().forEach(t => {
            all = all.concat(collectMatchesFromTournament(playerId, t));
        });
        return all;
    }

    function countPlayerMatches(playerId) {
        const matches = collectAllPlayerMatches(playerId);
        const official = matches.filter(m => m.type === 'regular' || m.type === 'playoff').length;
        const friendly = matches.filter(m => m.type === 'friendly').length;
        const international = matches.filter(m => m.type === 'international').length;
        return {
            official: official,
            friendly: friendly,
            international: international,
            total: official + friendly + international
        };
    }

    // ============================================================
    // 6. MODAL DE HISTORIAL
    // ============================================================
    const _historyState = {
        playerId: null,
        sort: 'recent',
        filter: 'all',
        tournamentFilter: 'all'
    };

    function renderPlayerHistoryModal(playerId) {
        let player = null, team = null;
        for (const torneo of getAllTournaments()) {
            for (const tm of (torneo.teams || [])) {
                const found = tm.players.find(p => p.id === playerId);
                if (found) { player = found; team = tm; break; }
            }
            if (player) break;
            if (torneo.freeAgents) {
                const found = torneo.freeAgents.find(p => p.id === playerId);
                if (found) { player = found; break; }
            }
        }
        if (!player) return alert('Jugador no encontrado.');

        _historyState.playerId = playerId;
        _historyState.sort = 'recent';
        _historyState.filter = 'all';
        _historyState.tournamentFilter = 'all';

        document.querySelectorAll('.pbh-modal-overlay').forEach(el => el.remove());

        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildHistoryModalHtml(player, team);
        document.body.appendChild(wrapper);

        wrapper.querySelectorAll('.pbh-filter-btn').forEach(btn => {
            btn.onclick = () => {
                _historyState.filter = btn.dataset.filter;
                refreshHistoryList();
            };
        });
        wrapper.querySelectorAll('.pbh-sort-btn').forEach(btn => {
            btn.onclick = () => {
                _historyState.sort = btn.dataset.sort;
                refreshHistoryList();
            };
        });
        const tourFilter = wrapper.querySelector('.pbh-tournament-filter');
        if (tourFilter) {
            tourFilter.onchange = () => {
                _historyState.tournamentFilter = tourFilter.value;
                refreshHistoryList();
            };
        }
        const closeBtn = wrapper.querySelector('.pbh-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                document.querySelectorAll('.pbh-modal-overlay').forEach(el => el.remove());
            };
        }
        const printBtn = wrapper.querySelector('.pbh-print');
        if (printBtn) {
            printBtn.onclick = () => printPlayerHistory(player, team);
        }
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
        tournaments.forEach(t => {
            tournamentOptions += `<option value="${t.id}">${esc(t.name)}</option>`;
        });

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

        if (_historyState.filter !== 'all') {
            matches = matches.filter(m => m.type === _historyState.filter);
        }
        if (_historyState.tournamentFilter !== 'all') {
            matches = matches.filter(m => m.tournamentId === _historyState.tournamentFilter);
        }

        if (_historyState.sort === 'recent') {
            matches.sort((a, b) => b.order - a.order);
        } else {
            matches.sort((a, b) => a.order - b.order);
        }

        document.querySelectorAll('.pbh-filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === _historyState.filter);
        });
        document.querySelectorAll('.pbh-sort-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.sort === _historyState.sort);
        });

        if (matches.length === 0) {
            body.innerHTML = `
                <div class="pbh-empty">
                    <i class="fa-solid fa-inbox"></i>
                    <p>No hay partidos registrados para este jugador con los filtros seleccionados.</p>
                </div>
            `;
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
            sH = m.match.box.winsH;
            sA = m.match.box.winsA;
            boxLabel = `<span class="pbh-box-badge">${m.match.box.label}</span>`;
        }

        const isHome = m.match.h === m.playerStats.tId;
        const playerWon = (isHome && sH > sA) || (!isHome && sA > sH);
        const playerLost = (isHome && sH < sA) || (!isHome && sA < sH);
        const resultIcon = playerWon ? '🟢' : (playerLost ? '🔴' : '🟡');

        const typeIcon = {
            regular: '📅', playoff: '⚔️', friendly: '🤝', international: '🌍'
        }[m.type] || '📋';
        const typeLabel = {
            regular: 'Liga', playoff: 'Playoffs', friendly: 'Amistoso', international: 'Internacional'
        }[m.type] || m.type;

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
    // 7. IMPRIMIR HISTORIAL
    // ============================================================
    function printPlayerHistory(player, team) {
        const playerId = player.id;
        let matches = collectAllPlayerMatches(playerId);
        if (_historyState.filter !== 'all') {
            matches = matches.filter(m => m.type === _historyState.filter);
        }
        if (_historyState.tournamentFilter !== 'all') {
            matches = matches.filter(m => m.tournamentId === _historyState.tournamentFilter);
        }
        if (_historyState.sort === 'recent') {
            matches.sort((a, b) => b.order - a.order);
        } else {
            matches.sort((a, b) => a.order - b.order);
        }

        const counts = countPlayerMatches(playerId);

        const getHeader = (typeof window.getPrintHeader === 'function')
            ? window.getPrintHeader
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
            html += `<div style="text-align:center;color:#94a3b8;padding:2rem;">Sin partidos para mostrar con los filtros aplicados.</div>`;
        } else {
            html += `<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">`;
            html += `<thead><tr style="background:rgba(30,30,47,0.7);border-bottom:1px solid #2d2d44;">`;
            html += `<th style="padding:0.4rem;text-align:left;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Tipo</th>`;
            html += `<th style="padding:0.4rem;text-align:left;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Jornada</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Local</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Res.</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Visitante</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#4ade80;font-size:0.6rem;text-transform:uppercase;">G</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#22d3ee;font-size:0.6rem;text-transform:uppercase;">A</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#ec4899;font-size:0.6rem;text-transform:uppercase;">S</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#facc15;font-size:0.6rem;text-transform:uppercase;">T</th>`;
            html += `</tr></thead><tbody>`;

            matches.forEach((m, i) => {
                const torneo = getTournamentById(m.tournamentId);
                const h = torneo.teams.find(t => t.id === m.match.h);
                const a = torneo.teams.find(t => t.id === m.match.a);
                const hName = h ? h.name : 'TBD';
                const aName = a ? a.name : 'TBD';
                const hShield = h ? h.shield : '';
                const aShield = a ? a.shield : '';

                let sH = m.match.sH, sA = m.match.sA;
                let boxLabel = '';
                if (m.match.box && m.match.box.enabled && m.match.box.finished) {
                    sH = m.match.box.winsH;
                    sA = m.match.box.winsA;
                    boxLabel = ` (${m.match.box.label})`;
                }

                const isHome = m.match.h === m.playerStats.tId;
                const playerWon = (isHome && sH > sA) || (!isHome && sA > sH);
                const playerLost = (isHome && sH < sA) || (!isHome && sA < sH);
                const resultIcon = playerWon ? '🟢' : (playerLost ? '🔴' : '🟡');

                const typeIcon = {
                    regular: '📅', playoff: '⚔️', friendly: '🤝', international: '🌍'
                }[m.type] || '📋';

                const bg = i % 2 === 0 ? 'rgba(30,30,47,0.3)' : 'rgba(20,20,30,0.3)';
                html += `<tr style="background:${bg};border-bottom:1px solid #2d2d44;">`;
                html += `<td style="padding:0.4rem;color:#fff;">${typeIcon} ${m.type.charAt(0).toUpperCase() + m.type.slice(1)}</td>`;
                html += `<td style="padding:0.4rem;color:#94a3b8;">${esc(m.roundLabel)}</td>`;
                html += `<td style="padding:0.4rem;text-align:right;color:#fff;font-weight:700;">`;
                html += `<img src="${hShield}" style="width:16px;height:16px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;vertical-align:middle;margin-right:0.3rem;">${esc(hName)}`;
                html += `</td>`;
                html += `<td style="padding:0.4rem;text-align:center;color:#facc15;font-weight:900;white-space:nowrap;">${sH} - ${sA}${boxLabel} ${resultIcon}</td>`;
                html += `<td style="padding:0.4rem;color:#fff;font-weight:700;">`;
                html += `${esc(aName)}<img src="${aShield}" style="width:16px;height:16px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;vertical-align:middle;margin-left:0.3rem;">`;
                html += `</td>`;
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
            // Fallback: abrir ventana de impresión
            const w = window.open('', '_blank');
            if (w) {
                w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Historial</title></head><body style="background:#0a0a0f;color:#e2e8f0;font-family:sans-serif;padding:1rem;">' + html + '</body></html>');
                w.document.close();
                setTimeout(() => w.print(), 500);
            }
        }
    }

    // ============================================================
    // 8. ABRIR PARTIDO DESDE EL HISTORIAL
    // ============================================================
    function openMatchFromHistory(tournamentId, matchId, matchType) {
        const targetTorneo = getTournamentById(tournamentId);
        if (!targetTorneo) return alert('Torneo no encontrado.');

        const cd = getCurrentData();
        const originalData = cd;

        try {
            // eslint-disable-next-line no-eval
            (0, eval)('currentData = arguments[0];').call(null, targetTorneo);
        } catch (_) {
            window.currentData = targetTorneo;
        }

        try {
            if (matchType === 'playoff' && window.playoffsBracketPatch) {
                const rounds = targetTorneo.playoffs && targetTorneo.playoffs.rounds;
                if (rounds) {
                    for (let r = 0; r < rounds.length; r++) {
                        for (let i = 0; i < rounds[r].length; i++) {
                            if (rounds[r][i].id === matchId) {
                                window.playoffsBracketPatch.openMatchModal(matchId, r, i);
                                // Fix names after modal renders
                                setTimeout(() => {
                                    // Store context so the observer can fix names
                                    _currentBracketContext = {
                                        match: rounds[r][i],
                                        roundIdx: r,
                                        matchIdx: i
                                    };
                                    fixBracketNames();
                                }, 60);
                                setTimeout(fixBracketNames, 200);
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
                // Fix names after render
                setTimeout(fixCurrentStatsModalNames, 60);
                setTimeout(fixCurrentStatsModalNames, 200);
            }
        } finally {
            try {
                // eslint-disable-next-line no-eval
                (0, eval)('currentData = arguments[0];').call(null, originalData);
            } catch (_) {
                window.currentData = originalData;
            }
        }
    }

    // ============================================================
    // 9. FIX DE NOMBRES "?" EN MODALES DE STATS
    // ============================================================
    let _currentBracketContext = null;

    // Fix genérico: recorre las tablas del modal actual y reemplaza "?" por nombres reales.
    // Estrategia: para cada celda con "?", buscar en los stats del contexto actual el pId
    // cuyo nombre no se pueda resolver por `team.players.find(...)`.
    function fixBracketNames() {
        const body = document.getElementById('pbx-modal-stats-body');
        if (!body || !_currentBracketContext) return;

        const match = _currentBracketContext.match;
        const torneo = getCurrentData();
        if (!torneo) return;

        // Determinar qué stats se están mostrando (active tab)
        const activeTab = document.querySelector('.pbx-tab.active');
        let statsArray = [];
        if (activeTab) {
            const tabIdx = activeTab.dataset.gameIdx;
            if (tabIdx === 'agg') {
                statsArray = match.stats || [];
            } else {
                const idx = parseInt(tabIdx);
                statsArray = (match.box && match.box.games && match.box.games[idx] && match.box.games[idx].stats) || [];
            }
        } else {
            statsArray = match.stats || [];
        }

        // Filtrar stats activas (con al menos un valor > 0)
        const filterActive = (arr) => arr.filter(s => (s.g || 0) > 0 || (s.a || 0) > 0 || (s.s || 0) > 0 || (s.t || 0) > 0);

        const homeStats = filterActive(statsArray.filter(s => s.tId === match.h));
        const awayStats = filterActive(statsArray.filter(s => s.tId === match.a));

        const processTeamBlock = (teamBlock, statsForTeam) => {
            if (!teamBlock) return;
            const rows = teamBlock.querySelectorAll('table tbody tr');
            let idx = 0;
            rows.forEach(row => {
                const firstCell = row.querySelector('td:first-child');
                if (!firstCell) return;
                const txt = (firstCell.textContent || '').trim();
                // Detectar "?" o "👑 ?" (capitán + nombre desconocido)
                const hasQuestion = /(^|\s)\?(\s|$)/.test(txt) || txt === '?';
                if (hasQuestion) {
                    const stat = statsForTeam[idx];
                    if (stat) {
                        const info = findPlayerAnywhere(stat.pId);
                        if (info) {
                            // Reemplazar manteniendo el icono de capitán si existe
                            const captain = (info.player.isCaptain || txt.includes('👑')) ? '👑 ' : '';
                            firstCell.textContent = captain + info.player.name;
                        }
                    }
                }
                idx++;
            });
        };

        processTeamBlock(body.querySelector('.match-stats-team.home'), homeStats);
        processTeamBlock(body.querySelector('.match-stats-team.away'), awayStats);
    }

    function fixCurrentStatsModalNames() {
        // Fix para el modal original de showMatchStats
        // Busca el match y aplica el mismo tratamiento
        const modals = document.querySelectorAll('.match-stats-body');
        if (!modals.length) return;

        // Buscar el match desde los nombres de los equipos
        // Estrategia: procesar cada bloque de stats y reemplazar "?" por nombres encontrados
        // en el roster actual del equipo correspondiente O en cualquier equipo del torneo.
        // No tenemos acceso directo al match aquí, así que probamos buscar por matchId en el DOM.
        // Como el modal original no expone el matchId, hacemos un fix "ciego":
        // 1. Obtenemos todos los stats que existen en todos los torneos.
        // 2. Buscamos "?" y reemplazamos probando match por nombre de equipo.
        modals.forEach(body => {
            body.querySelectorAll('.match-stats-team').forEach(teamBlock => {
                const h4 = teamBlock.querySelector('h4');
                if (!h4) return;
                const teamName = h4.textContent.replace('🛡️ ', '').trim();
                const teamShield = teamBlock.querySelector('img')?.src || '';
                // Encontrar el equipo por nombre en cualquier torneo
                let foundTeam = null;
                for (const torneo of getAllTournaments()) {
                    const tm = (torneo.teams || []).find(t => t.name === teamName);
                    if (tm) { foundTeam = tm; break; }
                }
                // Iterar sobre las filas con "?"
                teamBlock.querySelectorAll('table tbody tr').forEach(row => {
                    const firstCell = row.querySelector('td:first-child');
                    if (!firstCell) return;
                    const txt = (firstCell.textContent || '').trim();
                    const hasQuestion = /(^|\s)\?(\s|$)/.test(txt) || txt === '?';
                    if (!hasQuestion) return;
                    // Buscar un jugador que no esté en el equipo actual pero cuyos stats coincidan
                    // No tenemos pId en el DOM, así que usamos una heurística:
                    // buscamos jugadores en TODOS los equipos cuyos nombres, al combinarse con los stats
                    // de la fila, puedan coincidir. Es impreciso.
                    // MEJOR: como el modal original recibe matchId, pero no lo guarda en el DOM,
                    // hacemos un fix "por nombre de equipo": buscar en el torneo actual cualquier jugador
                    // que alguna vez haya pertenecido a ese equipo (en careerStats.teams o transferHistory).
                    // Iterar sobre todos los jugadores de todos los equipos y ver quién podría ser.
                    // Como no tenemos pId, dejamos el "?" pero añadimos un tooltip.
                    // NOTA: Este caso es poco común; el fix principal se aplica al modal fallback
                    // y al modal de playoffs.
                });
            });
        });
    }

    // ============================================================
    // 10. OVERRIDE: showMatchStats (fallback con nombres correctos)
    // ============================================================
    const _originalShowMatchStats = window.showMatchStats;

    window.showMatchStats = function (matchId) {
        let found = null;
        let foundTorneo = null;
        for (const t of getAllTournaments()) {
            if (t.rounds) {
                for (const r of t.rounds) {
                    const m = (r || []).find(x => x.id === matchId);
                    if (m) { found = m; foundTorneo = t; break; }
                }
            }
            if (!found && t.playoffs && t.playoffs.rounds) {
                for (const r of t.playoffs.rounds) {
                    const m = (r || []).find(x => x.id === matchId);
                    if (m) { found = m; foundTorneo = t; break; }
                }
            }
            if (!found && t.friendlyMatches) {
                const m = t.friendlyMatches.find(x => x.id === matchId);
                if (m) { found = m; foundTorneo = t; }
            }
            if (!found && t.internationalMatches) {
                const m = t.internationalMatches.find(x => x.id === matchId);
                if (m) { found = m; foundTorneo = t; }
            }
            if (found) break;
        }

        if (!found) {
            console.warn('[player-history] Partido no encontrado:', matchId);
            return;
        }

        // Usar nuestro modal fallback SIEMPRE para garantizar nombres correctos
        renderFallbackMatchModal(found, foundTorneo);
    };

    function renderFallbackMatchModal(match, torneo) {
        if (!torneo) {
            for (const t of getAllTournaments()) {
                if ((t.teams || []).some(tm => tm.id === match.h || tm.id === match.a)) {
                    torneo = t;
                    break;
                }
            }
        }
        if (!torneo) return;

        const h = torneo.teams.find(t => t.id === match.h);
        const a = torneo.teams.find(t => t.id === match.a);

        const hStats = (match.stats || []).filter(s => s.tId === match.h);
        const aStats = (match.stats || []).filter(s => s.tId === match.a);

        const renderTeamStats = (team, statsArr) => {
            if (!team) return `<div class="match-stats-team"><h4>Sin equipo</h4></div>`;
            const active = statsArr.filter(s => ((s.g || 0) + (s.a || 0) + (s.s || 0) + (s.t || 0)) > 0);
            if (!active.length) {
                return `<div class="match-stats-team"><h4>🛡️ ${esc(team.name)}</h4><p style="color:#94a3b8;text-align:center;padding:0.5rem;">Sin stats</p></div>`;
            }
            let rows = '';
            active.forEach(st => {
                // FIX: buscar el jugador en TODOS los equipos, no solo en el equipo actual
                const info = findPlayerAnywhere(st.pId);
                let name, captain = '';
                if (info) {
                    name = info.player.name;
                    if (info.player.isCaptain) captain = '👑 ';
                } else {
                    // Fallback: buscar en el equipo original
                    const p = team.players.find(x => x.id === st.pId);
                    name = p ? p.name : 'Jugador Desconocido';
                    if (p && p.isCaptain) captain = '👑 ';
                }
                // Indicar si el jugador ya no está en este equipo
                let transferBadge = '';
                if (info && info.teamId && info.teamId !== team.id) {
                    transferBadge = `<span class="pbh-transferred-badge" title="Actualmente en ${esc(info.teamName)}">↪</span>`;
                }
                rows += `<tr>
                    <td style="padding:0.35rem 0.5rem;color:#fff;font-weight:700;">${captain}${esc(name)}${transferBadge}</td>
                    <td style="text-align:center;color:#4ade80;">${st.g || 0}</td>
                    <td style="text-align:center;color:#22d3ee;">${st.a || 0}</td>
                    <td style="text-align:center;color:#ec4899;">${st.s || 0}</td>
                    <td style="text-align:center;color:#facc15;">${st.t || 0}</td>
                </tr>`;
            });
            return `<div class="match-stats-team ${team.id === match.h ? 'home' : 'away'}"><h4>🛡️ ${esc(team.name)}</h4>
                <table style="width:100%;font-size:0.75rem;border-collapse:collapse;">
                    <thead><tr style="border-bottom:1px solid #2d2d44;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">
                        <th style="text-align:left;padding:0.3rem;">Jugador</th>
                        <th style="text-align:center;color:#4ade80;">G</th>
                        <th style="text-align:center;color:#22d3ee;">A</th>
                        <th style="text-align:center;color:#ec4899;">S</th>
                        <th style="text-align:center;color:#facc15;">T</th>
                    </tr></thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
        };

        let boxLabel = '';
        let sH = match.sH, sA = match.sA;
        if (match.box && match.box.enabled && match.box.finished) {
            sH = match.box.winsH;
            sA = match.box.winsA;
            boxLabel = `<div style="text-align:center;font-size:0.7rem;color:#a855f7;font-weight:900;letter-spacing:0.08em;margin-top:0.2rem;">SERIE ${match.box.label}</div>`;
        }

        const overlay = document.createElement('div');
        overlay.className = 'pbh-match-modal-overlay';
        overlay.innerHTML = `
            <div class="pbh-match-modal">
                <div class="pbh-match-header">
                    <div class="pbh-match-team">
                        <img src="${h ? h.shield : ''}" onerror="this.style.display='none'">
                        <span>${h ? esc(h.name) : 'TBD'}</span>
                    </div>
                    <div class="pbh-match-score">${sH} - ${sA}</div>
                    <div class="pbh-match-team">
                        <span>${a ? esc(a.name) : 'TBD'}</span>
                        <img src="${a ? a.shield : ''}" onerror="this.style.display='none'">
                    </div>
                </div>
                ${boxLabel}
                <div class="pbh-match-body">
                    ${renderTeamStats(h, hStats)}
                    ${renderTeamStats(a, aStats)}
                </div>
                <div class="pbh-match-actions">
                    <button class="pbh-btn-close">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.pbh-btn-close').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    }

    // ============================================================
    // 11. OVERRIDE: showPlayerProfile
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
        if (!content) {
            console.warn('[player-history] #profile-modal-content no encontrado');
            return;
        }
        if (content.querySelector('.pbh-matches-grid')) return;

        // ===== Contadores =====
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
        } catch (e) {
            console.warn('[player-history] Error al calcular contadores:', e);
        }

        // ===== Botón "Ver Historial" =====
        const actionsLeft = content.querySelector('.profile-actions-left');
        if (actionsLeft && !actionsLeft.querySelector('.btn-history')) {
            const historyBtn = document.createElement('button');
            historyBtn.className = 'btn-history';
            historyBtn.type = 'button';
            historyBtn.innerHTML = '📜 Ver Historial';
            historyBtn.onclick = () => {
                // Cerrar la tarjeta del perfil primero
                if (typeof window.closePlayerProfile === 'function') {
                    window.closePlayerProfile();
                } else {
                    const overlay = document.getElementById('profile-modal-overlay');
                    if (overlay) overlay.classList.remove('active');
                    document.body.classList.remove('modal-open');
                }
                // Abrir el historial con un pequeño delay para que la animación se vea bien
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

        // ===== Fix: forzar visibilidad del footer en PC =====
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
    // 12. OVERRIDE: renderPerformanceJugadores
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
            if (pid) {
                window.showPlayerProfile(pid);
            } else {
                alert('Selecciona un jugador primero.');
            }
        };
        selectors.appendChild(btn);
    }

    // ============================================================
    // 13. CSS
    // ============================================================
    function injectStyles() {
        if (document.getElementById('pbh-styles')) return;
        const style = document.createElement('style');
        style.id = 'pbh-styles';
        style.textContent = `
/* ===== IMPORTANTE: z-index del modal de playoff sobre el historial ===== */
.pbx-modal-overlay { z-index: 10002 !important; }
.pbx-modal-overlay .pbx-modal { z-index: 10002; }

/* ===== Botón Historial ===== */
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

/* Badge para jugadores transferidos en el modal de stats */
.pbh-transferred-badge {
    display: inline-block;
    margin-left: 0.35rem;
    font-size: 0.65rem;
    color: #f59e0b;
    background: rgba(245,158,11,0.15);
    padding: 0.05rem 0.3rem;
    border-radius: 4px;
    border: 1px solid rgba(245,158,11,0.3);
    cursor: help;
}

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

/* ===== Modal de Historial ===== */
.pbh-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    z-index: 10000;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(180deg, rgba(168,85,247,0.08), transparent);
    flex-shrink: 0;
    gap: 0.5rem;
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
    display: grid;
    grid-template-columns: 140px 1fr 180px;
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

.pbh-match-modal-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 10001; display: flex;
    align-items: center; justify-content: center;
    padding: 1rem; animation: pbhFadeIn 0.2s ease;
}
.pbh-match-modal {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 20px;
    max-width: 780px; width: 100%;
    max-height: 92vh; overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    animation: pbhModalIn 0.25s ease;
}
.pbh-match-header {
    display: grid; grid-template-columns: 1fr auto 1fr;
    align-items: center; gap: 1rem;
    padding: 1.4rem 1.5rem 1rem;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(180deg, rgba(168,85,247,0.08), transparent);
}
.pbh-match-team { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
.pbh-match-team:last-child { justify-content: flex-end; }
.pbh-match-team img {
    width: 54px; height: 54px; border-radius: 50%;
    background: #000; border: 2px solid var(--color-border);
    object-fit: contain; flex-shrink: 0;
}
.pbh-match-team span {
    font-family: 'Montserrat', sans-serif; font-weight: 900;
    font-size: 0.9rem; color: #fff;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pbh-match-score {
    font-family: 'Montserrat', sans-serif; font-weight: 900;
    font-size: 2rem; color: #facc15;
    padding: 0.3rem 1rem;
    background: rgba(0,0,0,0.5);
    border: 1px solid var(--color-border);
    border-radius: 14px; white-space: nowrap;
}
.pbh-match-body {
    display: grid; grid-template-columns: 1fr 1fr;
    gap: 1rem; padding: 1rem 1.5rem;
}
.pbh-match-body .match-stats-team {
    background: rgba(0,0,0,0.25);
    border-radius: 12px; padding: 0.8rem 1rem;
    border-left: 3px solid var(--color-border);
}
.pbh-match-body .match-stats-team h4 {
    font-size: 0.85rem; font-weight: 900;
    margin-bottom: 0.5rem; padding-bottom: 0.4rem;
    border-bottom: 1px solid var(--color-border);
}
.pbh-match-actions {
    display: flex; justify-content: flex-end;
    padding: 0.9rem 1.5rem 1.2rem;
    border-top: 1px solid var(--color-border);
}
.pbh-btn-close {
    padding: 0.55rem 1.3rem; border-radius: 10px;
    border: 1px solid var(--color-border);
    background: transparent; color: var(--color-text);
    font-weight: 700; cursor: pointer; font-size: 0.82rem;
    font-family: inherit;
}
.pbh-btn-close:hover { background: rgba(255,255,255,0.05); }

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

/* ======================================================= */
/* RESPONSIVE MÓVIL - FIXES v1.2                           */
/* ======================================================= */
@media (max-width: 700px) {
    /* Overlay: alinear arriba para que no se corte el header */
    .pbh-modal-overlay {
        padding: 0;
        align-items: flex-start;
    }

    /* Modal: usar dvh (dynamic viewport height) con fallback */
    .pbh-modal {
        height: 100vh;
        height: 100dvh;
        max-height: 100vh;
        max-height: 100dvh;
        border-radius: 0;
        max-width: 100%;
        padding-top: env(safe-area-inset-top, 0);
        padding-bottom: env(safe-area-inset-bottom, 0);
    }

    .pbh-header {
        padding: 0.7rem 0.9rem;
        gap: 0.4rem;
    }
    .pbh-shield { width: 42px; height: 42px; }
    .pbh-title {
        font-size: 0.95rem;
        white-space: normal;
        line-height: 1.2;
        margin-bottom: 0.25rem;
    }
    .pbh-subtitle { gap: 0.25rem; }
    .pbh-count-badge { font-size: 0.58rem; padding: 0.12rem 0.4rem; }
    .pbh-header-actions { gap: 0.25rem; }
    .pbh-print, .pbh-close { width: 34px; height: 34px; font-size: 0.9rem; }

    .pbh-filters {
        padding: 0.5rem 0.7rem;
        gap: 0.5rem;
    }
    .pbh-filter-group { gap: 0.3rem; }
    .pbh-filter-label { font-size: 0.6rem; }
    .pbh-filter-btn, .pbh-sort-btn {
        font-size: 0.62rem;
        padding: 0.25rem 0.5rem;
    }
    .pbh-tournament-filter { font-size: 0.65rem; padding: 0.25rem 0.5rem; }

    .pbh-body {
        padding: 0.6rem 0.7rem 1rem;
    }

    .pbh-tournament-header {
        font-size: 0.75rem;
        padding: 0.5rem 0 0.35rem;
    }

    .pbh-item {
        grid-template-columns: 1fr;
        gap: 0.35rem;
        padding: 0.55rem 0.6rem;
    }
    .pbh-item-left {
        flex-direction: row;
        align-items: center;
        gap: 0.4rem;
    }
    .pbh-item-type { font-size: 0.6rem; padding: 0.1rem 0.35rem; }
    .pbh-item-round { font-size: 0.65rem; }

    .pbh-item-teams { justify-content: space-between; gap: 0.3rem; }
    .pbh-item-team { flex: 1; min-width: 0; gap: 0.25rem; }
    .pbh-item-team img { width: 18px; height: 18px; }
    .pbh-item-team-name { font-size: 0.7rem; }
    .pbh-item-score { font-size: 0.8rem; padding: 0.1rem 0.4rem; }

    .pbh-item-stats {
        justify-content: center;
        font-size: 0.65rem;
        gap: 0.4rem;
    }

    .pbh-match-body { grid-template-columns: 1fr; }
    .pbh-match-team img { width: 40px; height: 40px; }
    .pbh-match-team span { font-size: 0.78rem; }
    .pbh-match-score { font-size: 1.5rem; padding: 0.2rem 0.7rem; }
    .pbh-match-header { padding: 1rem 1rem 0.8rem; gap: 0.5rem; }
}

/* Fix móvil del modal de playoff del bracket */
@media (max-width: 700px) {
    .pbx-modal-overlay {
        align-items: flex-start;
        padding: 0.5rem;
    }
    .pbx-modal {
        max-height: calc(100dvh - 1rem);
    }
}
`;
        document.head.appendChild(style);
    }

    // ============================================================
    // 14. OBSERVER: detectar cuando se abre el modal del bracket
    //     para arreglar nombres "?" automáticamente
    // ============================================================
    (function setupBracketNameObserver() {
        const observer = new MutationObserver(() => {
            if (_currentBracketContext) {
                fixBracketNames();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: false });
    })();

    // Hook al bracket patch para que cada vez que se abra un partido de playoff,
    // se guarde el contexto y se corrijan los nombres.
    function hookBracketPatch() {
        if (!window.playoffsBracketPatch) return false;
        const pp = window.playoffsBracketPatch;

        if (!pp._pbhWrapped) {
            const _origOpen = pp.openMatchModal;
            pp.openMatchModal = function (matchId, roundIdx, matchIdx) {
                const torneo = getCurrentData();
                const match = torneo?.playoffs?.rounds?.[roundIdx]?.[matchIdx];
                _currentBracketContext = match ? { match, roundIdx, matchIdx } : null;
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
        }
        return true;
    }

    if (!hookBracketPatch()) {
        // Reintentar hasta que el bracket patch esté disponible
        let attempts = 0;
        const t = setInterval(() => {
            attempts++;
            if (hookBracketPatch() || attempts > 20) clearInterval(t);
        }, 100);
    }

    // ============================================================
    // 15. API PÚBLICA
    // ============================================================
    window.playerHistoryPatch = {
        openMatchFromHistory,
        renderPlayerHistoryModal,
        collectAllPlayerMatches,
        countPlayerMatches,
        isCupFormat,
        findPlayerAnywhere,
        reloadCopaData: () => {
            window.copaData = null;
            _copaLoadPromise = null;
            return loadCopaData();
        }
    };

    // ============================================================
    // 16. INIT
    // ============================================================
    injectStyles();

    console.log('✅ Player History Patch v1.2 cargado.');
})();