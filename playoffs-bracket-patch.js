// ============================================================
// MTM VISUALIZADOR - PLAYOFFS BRACKET PATCH v2.0
// ============================================================
// · Bracket simétrico (izq → der) con conectores SVG
// · Soporte: 64avos, 32avos, 16avos, Octavos, Cuartos, Semis, Final
// · Responsive: snap-scroll horizontal + fade-in en móvil
// · Modal de partido con navegación por series BoX
// · Nuevo menú "Stats Playoffs" (aparece si hay bracket)
// · Impresión en 3 modos: marcador, stats agregadas, ronda específica
// ============================================================
// Carga este archivo DESPUÉS de script.js
// ============================================================

(function () {
    'use strict';

    // ============================================================
    // 1. CONSTANTES Y HELPERS
    // ============================================================
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const CONNECTOR_WIDTH = 1.5;
    const CONNECTOR_COLOR = 'rgba(255,255,255,0.12)';
    const CONNECTOR_COLOR_FINAL = 'rgba(250,204,21,0.35)';

    function escapeHtml(s) {
        if (typeof s !== 'string') return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };
        return s.replace(/[&<>"']/g, m => map[m]);
    }

    function getTeam(torneo, id) {
        if (!torneo || !torneo.teams) return null;
        return torneo.teams.find(t => t.id === id) || null;
    }

    function calculatePIG(goals, assists, saves, shots, torneo) {
        const mult = (torneo && torneo.pigMultipliers) || { goals: 2, assists: 1.5, saves: 1, shots: 0.2 };
        return (goals * mult.goals) + (assists * mult.assists) + (saves * mult.saves) + ((shots - goals) * mult.shots);
    }

    function getRoundLabels(totalRounds) {
        const base = ['32°avos', '16°avos', 'Octavos', 'Cuartos', 'Semis', 'Final'];
        if (totalRounds <= 6) {
            return base.slice(6 - totalRounds);
        }
        const extra = totalRounds - 6;
        const prefix = [];
        for (let i = 0; i < extra; i++) prefix.push('R' + (i + 1));
        return prefix.concat(base);
    }

    function getWinner(match) {
        if (!match || !match.played) return null;
        if (match.box && match.box.enabled && match.box.finished) {
            return match.box.winner; // 'h' | 'a'
        }
        if (match.sH > match.sA) return 'h';
        if (match.sA > match.sH) return 'a';
        return null;
    }

    function getDisplayScore(match) {
        if (!match) return { h: '-', a: '-', isBox: false, label: '' };
        if (match.box && match.box.enabled && match.box.finished) {
            return { h: match.box.winsH, a: match.box.winsA, isBox: true, label: match.box.label };
        }
        if (match.played) {
            return { h: match.sH, a: match.sA, isBox: false, label: '' };
        }
        return { h: '-', a: '-', isBox: false, label: '' };
    }

    function hasPlayoffsBracket(torneo) {
        if (!torneo || !torneo.playoffs || !torneo.playoffs.rounds) return false;
        if (!torneo.playoffs.rounds.length) return false;
        return torneo.playoffs.rounds.some(r => r.some(m => m.h && m.a));
    }

    // ============================================================
    // 2. RENDER BRACKET
    // ============================================================
    function renderBracket(torneo) {
        if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
            return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
        }

        const rounds = torneo.playoffs.rounds;
        const totalRounds = rounds.length;
        const labels = getRoundLabels(totalRounds);

        let html = '<div class="mb-wrapper"><div class="mb-container" id="mb-container">';
        html += '<svg class="mb-svg" id="mb-svg"></svg>';

        rounds.forEach((round, rIdx) => {
            const isFinal = rIdx === totalRounds - 1;
            html += `<div class="mb-column ${isFinal ? 'mb-column-final' : ''}" data-round="${rIdx}">`;
            html += `<div class="mb-round-header">${labels[rIdx]}</div>`;
            html += `<div class="mb-round-body">`;
            round.forEach((match, mIdx) => {
                html += renderMatchCard(match, torneo, isFinal, rIdx, mIdx);
            });
            html += `</div></div>`;
        });

        html += '</div></div>';
        return html;
    }

    function renderMatchCard(match, torneo, isFinal, roundIdx, matchIdx) {
        const h = getTeam(torneo, match.h);
        const a = getTeam(torneo, match.a);
        const hName = h ? h.name : 'TBD';
        const aName = a ? a.name : 'TBD';
        const hShield = h ? h.shield : '';
        const aShield = a ? a.shield : '';

        const score = getDisplayScore(match);
        const winner = getWinner(match);
        const hWinner = winner === 'h';
        const aWinner = winner === 'a';

        const hShieldTag = hShield
            ? `<img class="mb-shield" src="${hShield}" alt="">`
            : `<div class="mb-shield mb-shield-empty"></div>`;
        const aShieldTag = aShield
            ? `<img class="mb-shield" src="${aShield}" alt="">`
            : `<div class="mb-shield mb-shield-empty"></div>`;

        const boxBadge = score.isBox ? `<span class="mb-box-badge">${score.label}</span>` : '';

        const clickable = match.played ? ' onclick="window.playoffsBracketPatch.openMatchModal(\'' + match.id + '\', ' + roundIdx + ', ' + matchIdx + ')"' : '';

        return `
            <div class="mb-card ${isFinal ? 'mb-card-final' : ''}" data-round="${roundIdx}" data-match-idx="${matchIdx}"${clickable}>
                <div class="mb-team ${hWinner ? 'mb-winner' : ''} ${!h ? 'mb-team-empty' : ''}">
                    ${hShieldTag}
                    <span class="mb-name">${escapeHtml(hName)}</span>
                    ${hWinner ? '<span style="color:#4ade80;font-size:0.7rem;">✓</span>' : ''}
                    <span class="mb-score">${score.h}</span>
                </div>
                <div class="mb-team ${aWinner ? 'mb-winner' : ''} ${!a ? 'mb-team-empty' : ''}">
                    ${aShieldTag}
                    <span class="mb-name">${escapeHtml(aName)}</span>
                    ${aWinner ? '<span style="color:#4ade80;font-size:0.7rem;">✓</span>' : ''}
                    <span class="mb-score">${score.a}</span>
                </div>
                ${boxBadge ? `<div style="text-align:center;margin-top:0.15rem;">${boxBadge}</div>` : ''}
            </div>
        `;
    }

    // ============================================================
    // 3. CONECTORES SVG
    // ============================================================
    let _connectorRaf = null;

    function drawConnectors() {
        const container = document.getElementById('mb-container');
        const svg = document.getElementById('mb-svg');
        if (!container || !svg) return;

        const containerRect = container.getBoundingClientRect();
        if (containerRect.width === 0 || containerRect.height === 0) return;

        svg.innerHTML = '';
        svg.setAttribute('width', containerRect.width);
        svg.setAttribute('height', containerRect.height);
        svg.setAttribute('viewBox', `0 0 ${containerRect.width} ${containerRect.height}`);

        const cards = container.querySelectorAll('.mb-card');
        if (!cards.length) return;

        // Indexar cards por [round][matchIdx]
        const cardsByRound = {};
        cards.forEach(c => {
            const r = parseInt(c.dataset.round);
            const i = parseInt(c.dataset.matchIdx);
            if (!cardsByRound[r]) cardsByRound[r] = {};
            cardsByRound[r][i] = c;
        });

        const roundKeys = Object.keys(cardsByRound).map(Number).sort((a, b) => a - b);
        const totalRounds = roundKeys.length;

        roundKeys.forEach(r => {
            if (r === totalRounds - 1) return; // final no tiene salida

            const round = cardsByRound[r];
            const parentRound = cardsByRound[r + 1];
            if (!parentRound) return;

            const isFinalPrev = (r + 1 === totalRounds - 1);
            const color = isFinalPrev ? CONNECTOR_COLOR_FINAL : CONNECTOR_COLOR;

            Object.keys(round).forEach(idxStr => {
                const i = parseInt(idxStr);
                const childEl = round[i];
                const parentIdx = Math.floor(i / 2);
                const parentEl = parentRound[parentIdx];
                if (!childEl || !parentEl) return;

                const cRect = childEl.getBoundingClientRect();
                const pRect = parentEl.getBoundingClientRect();

                const x1 = cRect.right - containerRect.left;
                const y1 = cRect.top + cRect.height / 2 - containerRect.top;
                const x2 = pRect.left - containerRect.left;
                const y2 = pRect.top + pRect.height / 2 - containerRect.top;

                // Punto medio horizontal (a mitad de camino entre columnas)
                const midX = x1 + (x2 - x1) * 0.45;

                const path = document.createElementNS(SVG_NS, 'path');
                const d = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
                path.setAttribute('d', d);
                path.setAttribute('stroke', color);
                path.setAttribute('stroke-width', CONNECTOR_WIDTH);
                path.setAttribute('fill', 'none');
                path.setAttribute('stroke-linecap', 'round');
                path.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(path);
            });
        });
    }

    function scheduleDrawConnectors(delay) {
        if (_connectorRaf) cancelAnimationFrame(_connectorRaf);
        setTimeout(() => {
            _connectorRaf = requestAnimationFrame(() => {
                drawConnectors();
                // Segundo pase por si las fuentes/imágenes cambian el layout
                setTimeout(drawConnectors, 150);
            });
        }, delay || 50);
    }

    // Redibujar en resize
    let _resizeTimer = null;
    window.addEventListener('resize', () => {
        if (_resizeTimer) clearTimeout(_resizeTimer);
        _resizeTimer = setTimeout(() => {
            const playoffs = document.getElementById('section-playoffs');
            if (playoffs && playoffs.classList.contains('active')) {
                drawConnectors();
            }
        }, 250);
    });

    // ============================================================
    // 4. MODAL DE PARTIDO (con navegación BoX)
    // ============================================================
    let _activeModalMatch = null;
    let _activeModalRound = null;
    let _activeModalIdx = null;
    let _activeModalSelectedGame = null; // null = partido individual, 'agg' = agregado

    function openMatchModal(matchId, roundIdx, matchIdx) {
        const torneo = currentData;
        if (!torneo || !torneo.playoffs) return;

        const match = torneo.playoffs.rounds[roundIdx]?.[matchIdx];
        if (!match || !match.played) return;

        _activeModalMatch = match;
        _activeModalRound = roundIdx;
        _activeModalIdx = matchIdx;
        _activeModalSelectedGame = (match.box && match.box.enabled && match.box.games && match.box.games.length > 0)
            ? 0
            : null;

        renderMatchModal();
    }

    function renderMatchModal() {
        const match = _activeModalMatch;
        const torneo = currentData;
        if (!match || !torneo) return;

        const h = getTeam(torneo, match.h);
        const a = getTeam(torneo, match.a);
        const isBox = match.box && match.box.enabled;
        const score = getDisplayScore(match);

        const hWinner = getWinner(match) === 'h';
        const aWinner = getWinner(match) === 'a';

        let tabsHtml = '';
        if (isBox && match.box.games && match.box.games.length > 0) {
            tabsHtml += `<div class="pbx-modal-tabs">`;
            match.box.games.forEach((g, i) => {
                const isActive = _activeModalSelectedGame === i;
                tabsHtml += `<button class="pbx-tab ${isActive ? 'active' : ''}" onclick="window.playoffsBracketPatch.selectGame(${i})">Partido ${i + 1} · ${g.sH}-${g.sA}</button>`;
            });
            const isAgg = _activeModalSelectedGame === 'agg';
            tabsHtml += `<button class="pbx-tab aggregate ${isAgg ? 'active' : ''}" onclick="window.playoffsBracketPatch.selectGame('agg')">Σ Suma Total</button>`;
            tabsHtml += `</div>`;
        }

        // Determinar stats a mostrar
        let statsArray = [];
        let statsLabel = '';
        if (isBox && _activeModalSelectedGame !== null) {
            if (_activeModalSelectedGame === 'agg') {
                statsArray = match.stats || [];
                statsLabel = 'Suma total de la serie';
            } else {
                const g = match.box.games[_activeModalSelectedGame];
                statsArray = (g && g.stats) || [];
                statsLabel = `Partido ${_activeModalSelectedGame + 1} · ${g ? g.sH + '-' + g.sA : ''}`;
            }
        } else {
            statsArray = match.stats || [];
        }

        const hStats = statsArray.filter(s => s.tId === match.h);
        const aStats = statsArray.filter(s => s.tId === match.a);

        const renderTeamTable = (team, statsArray) => {
            if (!team) return `<div class="match-stats-team"><h4>Sin equipo</h4></div>`;
            const activeStats = statsArray.filter(s => (s.g || 0) > 0 || (s.a || 0) > 0 || (s.s || 0) > 0 || (s.t || 0) > 0);
            if (!activeStats.length) {
                return `<div class="match-stats-team ${team.id === match.h ? 'home' : 'away'}">
                    <h4>🛡️ ${escapeHtml(team.name)}</h4>
                    <table class="match-stats-table"><tbody><tr><td class="empty" colspan="5">Sin estadísticas</td></tr></tbody></table>
                </div>`;
            }
            let rows = '';
            activeStats.forEach(st => {
                const p = team.players.find(x => x.id === st.pId);
                const name = p ? p.name : '?';
                const captain = p && p.isCaptain ? '👑 ' : '';
                rows += `<tr>
                    <td>${captain}${escapeHtml(name)}</td>
                    <td class="g">${st.g || 0}</td>
                    <td class="a">${st.a || 0}</td>
                    <td class="s">${st.s || 0}</td>
                    <td class="t">${st.t || 0}</td>
                </tr>`;
            });
            return `<div class="match-stats-team ${team.id === match.h ? 'home' : 'away'}">
                <h4>🛡️ ${escapeHtml(team.name)}</h4>
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
            </div>`;
        };

        const matchHeaderLabel = isBox
            ? `<div style="text-align:center;margin-top:0.4rem;font-size:0.7rem;color:var(--neon-purple);font-weight:900;letter-spacing:0.08em;">SERIE ${match.box.label} · GANADOR: ${getWinner(match) === 'h' ? (h ? escapeHtml(h.name) : '?') : (a ? escapeHtml(a.name) : '?')}</div>`
            : '';

        const statsHeaderLabel = statsLabel ? `<div style="text-align:center;padding:0.5rem;background:rgba(0,0,0,0.3);border-bottom:1px solid var(--color-border);font-size:0.72rem;font-weight:700;color:var(--neon-cyan);text-transform:uppercase;letter-spacing:0.08em;">${statsLabel}</div>` : '';

        const modalHtml = `
            <div class="pbx-modal-overlay" onclick="if(event.target===this) window.playoffsBracketPatch.closeMatchModal()">
                <div class="pbx-modal">
                    <div class="match-stats-header">
                        <div class="team-block ${hWinner ? 'winner' : ''}">
                            <img src="${h ? h.shield : ''}" alt="">
                            <div class="team-name">${h ? escapeHtml(h.name) : 'TBD'}</div>
                        </div>
                        <div class="match-stats-score">${score.h} - ${score.a}</div>
                        <div class="team-block ${aWinner ? 'winner' : ''}">
                            <img src="${a ? a.shield : ''}" alt="">
                            <div class="team-name">${a ? escapeHtml(a.name) : 'TBD'}</div>
                        </div>
                    </div>
                    ${matchHeaderLabel}
                    ${tabsHtml}
                    ${statsHeaderLabel}
                    <div class="match-stats-body">
                        ${renderTeamTable(h, hStats)}
                        ${renderTeamTable(a, aStats)}
                    </div>
                    <div class="match-stats-actions">
                        <button class="btn-cancel" onclick="window.playoffsBracketPatch.closeMatchModal()">Cerrar</button>
                        <button class="btn-download" onclick="window.playoffsBracketPatch.showPrintOptions()">🖨️ Imprimir</button>
                    </div>
                </div>
            </div>
        `;

        // Eliminar modales previos
        document.querySelectorAll('.pbx-modal-overlay').forEach(el => el.remove());

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHtml;
        document.body.appendChild(wrapper);
    }

    function selectGame(idx) {
        _activeModalSelectedGame = idx;
        renderMatchModal();
    }

    function closeMatchModal() {
        document.querySelectorAll('.pbx-modal-overlay').forEach(el => el.remove());
    }

    // ============================================================
    // 5. IMPRESIÓN
    // ============================================================
    function showPrintOptions() {
        const match = _activeModalMatch;
        const torneo = currentData;
        if (!match || !torneo) return;

        const isBox = match.box && match.box.enabled;

        let bodyHtml = '';
        bodyHtml += `
            <div class="print-config-row">
                <label><input type="radio" name="pbx-print-mode" value="result" checked> 📊 Imprimir solo marcador</label>
            </div>
            <div class="print-config-row">
                <label><input type="radio" name="pbx-print-mode" value="aggregate"> 📈 Imprimir suma total de stats</label>
            </div>
        `;

        if (isBox && match.box.games && match.box.games.length > 0) {
            bodyHtml += `
                <div class="print-config-row">
                    <label><input type="radio" name="pbx-print-mode" value="game"> 🎮 Imprimir un partido específico</label>
                </div>
                <div class="print-config-row" id="pbx-game-selector" style="display:none;">
                    <label>Partido:</label>
                    <select id="pbx-print-game-idx" class="print-top-input" style="width:auto;min-width:160px;">
                        ${match.box.games.map((g, i) => `<option value="${i}">Partido ${i + 1} (${g.sH}-${g.sA})</option>`).join('')}
                    </select>
                </div>
            `;
        }

        openPrintConfigModal('🖨️ Opciones de impresión', bodyHtml, () => {
            const selected = document.querySelector('input[name="pbx-print-mode"]:checked');
            if (!selected) return false;
            const mode = selected.value;
            if (mode === 'result') return printMatchResult(match, torneo);
            if (mode === 'aggregate') return printMatchAggregateStats(match, torneo);
            if (mode === 'game') {
                const idx = parseInt(document.getElementById('pbx-print-game-idx').value) || 0;
                return printMatchSpecificGame(match, torneo, idx);
            }
            return false;
        });

        // Listener para mostrar/ocultar el selector
        setTimeout(() => {
            document.querySelectorAll('input[name="pbx-print-mode"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    const sel = document.getElementById('pbx-game-selector');
                    if (sel) sel.style.display = (radio.value === 'game' && radio.checked) ? 'flex' : 'none';
                });
            });
        }, 30);
    }

    function _resolveCSSVars(html) {
        // Wrapper que usa resolveCSSVars global del visualizador
        if (typeof resolveCSSVars === 'function') return resolveCSSVars(html);
        return html;
    }

    function _getPrintHeader(title) {
        if (typeof getPrintHeader === 'function') return getPrintHeader(title);
        return `<div style="border-bottom:2px solid #2d2d44;padding-bottom:0.5rem;margin-bottom:1rem;"><h1>${title}</h1></div>`;
    }

    function _showPrintModal(html, filename, width) {
        if (typeof showPrintModal === 'function') {
            showPrintModal(html, filename, width || 800);
        } else {
            alert('Sistema de impresión no disponible.');
        }
    }

    function printMatchResult(match, torneo) {
        const h = getTeam(torneo, match.h);
        const a = getTeam(torneo, match.a);
        const score = getDisplayScore(match);
        const winner = getWinner(match);
        const hWinner = winner === 'h';
        const aWinner = winner === 'a';

        let html = _getPrintHeader('Resultado del Partido');
        html += `
            <div style="display:flex;justify-content:space-between;align-items:center;margin:1rem 0;padding:1.2rem 1.5rem;background:rgba(0,0,0,0.3);border-radius:14px;border:1px solid #2d2d44;">
                <div style="display:flex;align-items:center;gap:1rem;flex:1;">
                    <img src="${h ? h.shield : ''}" style="width:70px;height:70px;border-radius:50%;background:#000;border:2px solid ${hWinner ? '#facc15' : '#2d2d44'};object-fit:contain;">
                    <div>
                        <div style="font-size:1.3rem;font-weight:900;color:${hWinner ? '#facc15' : '#fff'};">${h ? escapeHtml(h.name) : 'TBD'}</div>
                        ${hWinner ? '<div style="color:#facc15;font-size:0.85rem;font-weight:700;">🏆 GANADOR</div>' : ''}
                    </div>
                </div>
                <div style="font-size:2.8rem;font-weight:900;color:#facc15;padding:0 1.5rem;white-space:nowrap;">${score.h} - ${score.a}</div>
                <div style="display:flex;align-items:center;gap:1rem;flex:1;justify-content:flex-end;">
                    <div style="text-align:right;">
                        <div style="font-size:1.3rem;font-weight:900;color:${aWinner ? '#facc15' : '#fff'};">${a ? escapeHtml(a.name) : 'TBD'}</div>
                        ${aWinner ? '<div style="color:#facc15;font-size:0.85rem;font-weight:700;">🏆 GANADOR</div>' : ''}
                    </div>
                    <img src="${a ? a.shield : ''}" style="width:70px;height:70px;border-radius:50%;background:#000;border:2px solid ${aWinner ? '#facc15' : '#2d2d44'};object-fit:contain;">
                </div>
            </div>
        `;
        if (score.isBox) {
            html += `<div style="text-align:center;font-size:0.9rem;color:#a855f7;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;">Serie ${score.label}</div>`;
        }
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>`;
        html = _resolveCSSVars(html);
        _showPrintModal(html, `partido_${sanitizeForFilename(h ? h.name : 'X')}_vs_${sanitizeForFilename(a ? a.name : 'X')}.jpg`, 900);
        closeMatchModal();
        return true;
    }

    function printMatchAggregateStats(match, torneo) {
        const h = getTeam(torneo, match.h);
        const a = getTeam(torneo, match.a);
        const score = getDisplayScore(match);
        const stats = match.stats || [];
        const hStats = stats.filter(s => s.tId === match.h);
        const aStats = stats.filter(s => s.tId === match.a);

        const renderTeamBlock = (team, statsArr) => {
            if (!team) return '';
            const active = statsArr.filter(s => (s.g || 0) > 0 || (s.a || 0) > 0 || (s.s || 0) > 0 || (s.t || 0) > 0);
            let rows = '';
            active.forEach(s => {
                const p = team.players.find(x => x.id === s.pId);
                rows += `<tr>
                    <td style="padding:0.4rem 0.5rem;color:#fff;font-weight:700;">${p ? escapeHtml(p.name) : '?'}</td>
                    <td style="padding:0.4rem;text-align:center;color:#4ade80;">${s.g || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#22d3ee;">${s.a || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#ec4899;">${s.s || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#facc15;">${s.t || 0}</td>
                </tr>`;
            });
            return `
                <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.8rem;border-left:3px solid ${team.id === match.h ? '#4ade80' : '#f87171'};">
                    <h4 style="font-size:0.9rem;color:${team.id === match.h ? '#4ade80' : '#f87171'};margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(team.name)}</h4>
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

        let html = _getPrintHeader('Suma Total de Stats');
        html += `<div style="text-align:center;margin:0.8rem 0 1rem;font-size:1.1rem;color:#fff;font-weight:900;">${h ? escapeHtml(h.name) : '?'} <span style="color:#facc15;">${score.h} - ${score.a}</span> ${a ? escapeHtml(a.name) : '?'}${score.isBox ? ` <span style="color:#a855f7;font-size:0.85rem;">(${score.label})</span>` : ''}</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">${renderTeamBlock(h, hStats)}${renderTeamBlock(a, aStats)}</div>`;
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>`;
        html = _resolveCSSVars(html);
        _showPrintModal(html, `stats_agregadas_${sanitizeForFilename(h ? h.name : 'X')}_vs_${sanitizeForFilename(a ? a.name : 'X')}.jpg`, 900);
        closeMatchModal();
        return true;
    }

    function printMatchSpecificGame(match, torneo, gameIdx) {
        if (!match.box || !match.box.games || !match.box.games[gameIdx]) return false;
        const game = match.box.games[gameIdx];
        const h = getTeam(torneo, match.h);
        const a = getTeam(torneo, match.a);

        const hStats = (game.stats || []).filter(s => s.tId === match.h);
        const aStats = (game.stats || []).filter(s => s.tId === match.a);

        const renderTeamBlock = (team, statsArr) => {
            if (!team) return '';
            let rows = '';
            statsArr.forEach(s => {
                const p = team.players.find(x => x.id === s.pId);
                rows += `<tr>
                    <td style="padding:0.4rem 0.5rem;color:#fff;font-weight:700;">${p ? escapeHtml(p.name) : '?'}</td>
                    <td style="padding:0.4rem;text-align:center;color:#4ade80;">${s.g || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#22d3ee;">${s.a || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#ec4899;">${s.s || 0}</td>
                    <td style="padding:0.4rem;text-align:center;color:#facc15;">${s.t || 0}</td>
                </tr>`;
            });
            return `
                <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.8rem;border-left:3px solid ${team.id === match.h ? '#4ade80' : '#f87171'};">
                    <h4 style="font-size:0.9rem;color:${team.id === match.h ? '#4ade80' : '#f87171'};margin-bottom:0.5rem;text-transform:uppercase;">${escapeHtml(team.name)}</h4>
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

        let html = _getPrintHeader(`Partido ${gameIdx + 1} de ${match.box.label}`);
        html += `<div style="text-align:center;margin:0.8rem 0 1rem;font-size:1.1rem;color:#fff;font-weight:900;">${h ? escapeHtml(h.name) : '?'} <span style="color:#facc15;">${game.sH} - ${game.sA}</span> ${a ? escapeHtml(a.name) : '?'}</div>`;
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">${renderTeamBlock(h, hStats)}${renderTeamBlock(a, aStats)}</div>`;
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>`;
        html = _resolveCSSVars(html);
        _showPrintModal(html, `partido_${gameIdx + 1}_${sanitizeForFilename(h ? h.name : 'X')}_vs_${sanitizeForFilename(a ? a.name : 'X')}.jpg`, 900);
        closeMatchModal();
        return true;
    }

    function printFullPlayoffStats() {
        const torneo = currentData;
        if (!torneo) return;
        const data = buildPlayoffStatsData(torneo);
        if (!data) return;

        let html = _getPrintHeader('Stats de Play-Offs');

        const tables = [
            { key: 'g', label: '⚽ Goleadores', fieldLabel: 'Goles' },
            { key: 'a', label: '🎯 Asistencias', fieldLabel: 'Asistencias' },
            { key: 's', label: '🧤 Salvadas', fieldLabel: 'Salvadas' },
            { key: 't', label: '💀 Tiros', fieldLabel: 'Tiros' },
            { key: 'pig', label: '📊 PIG', fieldLabel: 'PIG' },
            { key: 'mvps', label: '⭐ MVPs', fieldLabel: 'MVPs' }
        ];

        tables.forEach(table => {
            const sorted = [...data.players].sort((a, b) => {
                if (table.key === 'pig') return (b.playoffPIG || 0) - (a.playoffPIG || 0);
                if (table.key === 'mvps') return (b.mvps || 0) - (a.mvps || 0);
                return (b.playoff[table.key] || 0) - (a.playoff[table.key] || 0);
            });
            const visible = sorted.slice(0, 15);

            html += `<div style="margin-bottom:1.2rem;">`;
            html += `<h3 style="font-family:Montserrat,sans-serif;font-size:1rem;font-weight:900;color:#a855f7;margin-bottom:0.5rem;text-transform:uppercase;">${table.label}</h3>`;
            html += `<table style="width:100%;border-collapse:collapse;font-size:0.75rem;">`;
            html += `<thead><tr style="background:rgba(30,30,47,0.7);border-bottom:1px solid #2d2d44;">`;
            html += `<th style="padding:0.4rem;text-align:center;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">#</th>`;
            html += `<th style="padding:0.4rem;text-align:left;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Jugador</th>`;
            html += `<th style="padding:0.4rem;text-align:left;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Equipo</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#22d3ee;font-size:0.6rem;text-transform:uppercase;">PO</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#94a3b8;font-size:0.6rem;text-transform:uppercase;">Total</th>`;
            html += `<th style="padding:0.4rem;text-align:center;color:#facc15;font-size:0.6rem;text-transform:uppercase;">PJ</th>`;
            html += `</tr></thead><tbody>`;
            if (visible.length === 0) {
                html += `<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:0.6rem;">Sin datos</td></tr>`;
            } else {
                visible.forEach((p, i) => {
                    let poVal, totalVal;
                    if (table.key === 'pig') {
                        poVal = (p.playoffPIG || 0).toFixed(1);
                        totalVal = (p.totalPIG || 0).toFixed(1);
                    } else if (table.key === 'mvps') {
                        poVal = p.mvps;
                        totalVal = '—';
                    } else {
                        poVal = p.playoff[table.key] || 0;
                        totalVal = p.total[table.key] || 0;
                    }
                    const bg = i % 2 === 0 ? 'rgba(30,30,47,0.3)' : 'rgba(20,20,30,0.3)';
                    html += `<tr style="background:${bg};border-bottom:1px solid #2d2d44;">`;
                    html += `<td style="padding:0.35rem 0.4rem;text-align:center;color:${i < 3 ? '#ffd700' : '#94a3b8'};font-weight:700;">${i + 1}</td>`;
                    html += `<td style="padding:0.35rem 0.4rem;color:#fff;font-weight:700;">${p.isCaptain ? '👑 ' : ''}${escapeHtml(p.name)}</td>`;
                    html += `<td style="padding:0.35rem 0.4rem;color:#94a3b8;">${escapeHtml(p.teamName)}</td>`;
                    html += `<td style="padding:0.35rem 0.4rem;text-align:center;color:#22d3ee;font-weight:900;">${poVal}</td>`;
                    html += `<td style="padding:0.35rem 0.4rem;text-align:center;color:#94a3b8;">${totalVal}</td>`;
                    html += `<td style="padding:0.35rem 0.4rem;text-align:center;color:#facc15;">${p.playoff.matches || 0}</td>`;
                    html += `</tr>`;
                });
            }
            html += `</tbody></table></div>`;
        });

        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>`;
        html = _resolveCSSVars(html);
        _showPrintModal(html, `stats_playoffs.jpg`, 900);
    }

    // ============================================================
    // 6. NUEVA VISTA: STATS PLAYOFFS
    // ============================================================
    function buildPlayoffStatsData(torneo) {
        if (!torneo || !torneo.playoffs || !torneo.playoffs.rounds) return null;

        const playoffAgg = {};
        const regularAgg = {};
        const playoffMVPs = {};
        const teamsCache = {};

        torneo.teams.forEach(team => {
            team.players.forEach(p => {
                teamsCache[p.id] = {
                    pId: p.id, tId: team.id,
                    name: p.name, teamName: team.name,
                    teamShield: team.shield, isCaptain: p.isCaptain
                };
            });
        });

        // Playoffs
        torneo.playoffs.rounds.forEach(round => {
            let bestMatchPIG = -1;
            let bestPlayerId = null;
            round.forEach(m => {
                if (!m.played || !m.stats) return;
                m.stats.forEach(st => {
                    if (!playoffAgg[st.pId]) playoffAgg[st.pId] = { pId: st.pId, tId: st.tId, g: 0, a: 0, s: 0, t: 0, matches: 0 };
                    playoffAgg[st.pId].g += st.g || 0;
                    playoffAgg[st.pId].a += st.a || 0;
                    playoffAgg[st.pId].s += st.s || 0;
                    playoffAgg[st.pId].t += st.t || 0;
                    playoffAgg[st.pId].matches += 1;
                    const pig = calculatePIG(st.g || 0, st.a || 0, st.s || 0, st.t || 0, torneo);
                    if (pig > bestMatchPIG) {
                        bestMatchPIG = pig;
                        bestPlayerId = st.pId;
                    }
                });
            });
            if (bestPlayerId && bestMatchPIG > 0) {
                playoffMVPs[bestPlayerId] = (playoffMVPs[bestPlayerId] || 0) + 1;
            }
        });

        // Regular
        if (torneo.rounds) {
            torneo.rounds.forEach(round => {
                round.forEach(m => {
                    if (!m.played || !m.stats) return;
                    m.stats.forEach(st => {
                        if (!regularAgg[st.pId]) regularAgg[st.pId] = { g: 0, a: 0, s: 0, t: 0 };
                        regularAgg[st.pId].g += st.g || 0;
                        regularAgg[st.pId].a += st.a || 0;
                        regularAgg[st.pId].s += st.s || 0;
                        regularAgg[st.pId].t += st.t || 0;
                    });
                });
            });
        }

        const players = Object.values(playoffAgg).map(ps => {
            const info = teamsCache[ps.pId] || { name: 'Jugador', teamName: '?', teamShield: '', isCaptain: false };
            const reg = regularAgg[ps.pId] || { g: 0, a: 0, s: 0, t: 0 };
            return {
                id: ps.pId,
                name: info.name,
                teamName: info.teamName,
                teamShield: info.teamShield,
                isCaptain: info.isCaptain,
                playoff: ps,
                total: { g: ps.g + reg.g, a: ps.a + reg.a, s: ps.s + reg.s, t: ps.t + reg.t, matches: ps.matches },
                mvps: playoffMVPs[ps.pId] || 0
            };
        });

        players.forEach(p => {
            p.playoffPIG = calculatePIG(p.playoff.g, p.playoff.a, p.playoff.s, p.playoff.t, torneo);
            p.totalPIG = calculatePIG(p.total.g, p.total.a, p.total.s, p.total.t, torneo);
        });

        return { players };
    }

    function renderPlayoffStatsView() {
        const torneo = currentData;
        const content = document.getElementById('playoff-stats-content');
        if (!content || !torneo) return;

        const data = buildPlayoffStatsData(torneo);
        if (!data || data.players.length === 0) {
            content.innerHTML = '<div class="empty-state"><i class="fa-solid fa-chart-bar"></i>No hay estadísticas de playoffs registradas todavía.</div>';
            return;
        }

        const tables = [
            { key: 'g', label: '⚽ Goleadores', fieldLabel: 'Goles' },
            { key: 'a', label: '🎯 Asistencias', fieldLabel: 'Asistencias' },
            { key: 's', label: '🧤 Salvadas', fieldLabel: 'Salvadas' },
            { key: 't', label: '💀 Tiros (Peligro)', fieldLabel: 'Tiros' },
            { key: 'pig', label: '📊 PIG (Impacto)', fieldLabel: 'PIG' },
            { key: 'mvps', label: '⭐ MVPs de Playoffs', fieldLabel: 'MVPs' }
        ];

        let html = '';
        tables.forEach(table => {
            const sorted = [...data.players].sort((a, b) => {
                if (table.key === 'pig') return (b.playoffPIG || 0) - (a.playoffPIG || 0);
                if (table.key === 'mvps') return (b.mvps || 0) - (a.mvps || 0);
                return (b.playoff[table.key] || 0) - (a.playoff[table.key] || 0);
            });
            const visible = sorted.slice(0, 30);

            html += `<div class="glass-card rounded-2xl overflow-hidden shadow-2xl mb-6">`;
            html += `<div class="bg-gray-900/80 p-3 border-b border-gray-800 flex justify-between items-center">`;
            html += `<h4 class="font-black text-sm text-neon-cyan uppercase tracking-widest">${table.label}</h4>`;
            html += `<span class="text-[10px] text-gray-500 font-bold">${sorted.length} jugadores</span>`;
            html += `</div>`;
            html += `<div class="overflow-x-auto"><table class="w-full text-left">`;
            html += `<thead class="bg-gray-900/50 text-gray-500 uppercase text-[10px] font-black tracking-widest border-b border-gray-800">`;
            html += `<tr>`;
            html += `<th class="py-2 px-3 text-center">Rnk</th>`;
            html += `<th class="py-2 px-3">Jugador</th>`;
            html += `<th class="py-2 px-3">Equipo</th>`;
            html += `<th class="py-2 px-3 text-center text-neon-cyan">${table.fieldLabel} (PO)</th>`;
            html += `<th class="py-2 px-3 text-center text-gray-400">${table.fieldLabel} (Total)</th>`;
            html += `<th class="py-2 px-3 text-center text-neon-yellow">PJ</th>`;
            html += `</tr></thead><tbody class="divide-y divide-gray-800/50 bg-[#0a0c14]">`;

            if (visible.length === 0) {
                html += `<tr><td colspan="6" class="text-center text-gray-500 py-4 text-xs">Sin datos</td></tr>`;
            } else {
                visible.forEach((p, i) => {
                    let poVal, totalVal;
                    if (table.key === 'pig') {
                        poVal = (p.playoffPIG || 0).toFixed(1);
                        totalVal = (p.totalPIG || 0).toFixed(1);
                    } else if (table.key === 'mvps') {
                        poVal = p.mvps;
                        totalVal = '—';
                    } else {
                        poVal = p.playoff[table.key] || 0;
                        totalVal = p.total[table.key] || 0;
                    }
                    html += `<tr class="hover:bg-surface_hover transition-colors">`;
                    html += `<td class="py-2 px-3 text-center font-bold text-gray-600">${i + 1}</td>`;
                    html += `<td class="py-2 px-3 font-bold text-white flex items-center gap-2"><img src="${p.teamShield || ''}" class="w-5 h-5 rounded object-contain bg-black border border-gray-800">${p.isCaptain ? '👑 ' : ''}${escapeHtml(p.name)}</td>`;
                    html += `<td class="py-2 px-3 text-gray-400 text-xs">${escapeHtml(p.teamName)}</td>`;
                    html += `<td class="py-2 px-3 text-center font-black text-neon-cyan">${poVal}</td>`;
                    html += `<td class="py-2 px-3 text-center font-bold text-gray-500">${totalVal}</td>`;
                    html += `<td class="py-2 px-3 text-center text-xs">${p.playoff.matches || 0}</td>`;
                    html += `</tr>`;
                });
            }
            html += `</tbody></table></div></div>`;
        });

        content.innerHTML = html;
    }

    // ============================================================
    // 7. INYECCIÓN DE MENÚ Y SECCIÓN "STATS PLAYOFFS"
    // ============================================================
    function injectPlayoffStatsMenu() {
        const torneo = currentData;
        if (!torneo) return;
        if (!hasPlayoffsBracket(torneo)) {
            removePlayoffStatsMenu();
            return;
        }

        // Ya existe: no duplicar
        if (document.getElementById('nav-playoff-stats')) return;

        const playoffsNav = document.getElementById('nav-playoffs');
        if (!playoffsNav) return;

        // Insertar item de menú
        const newNav = document.createElement('div');
        newNav.className = playoffsNav.className;
        newNav.id = 'nav-playoff-stats';
        newNav.dataset.section = 'playoff-stats';
        newNav.setAttribute('onclick', "switchView('playoff-stats')");
        newNav.innerHTML = '<i class="fas fa-chart-bar"></i> Stats Playoffs';
        playoffsNav.parentNode.insertBefore(newNav, playoffsNav.nextSibling);

        // Insertar section
        if (!document.getElementById('section-playoff-stats')) {
            const sectionsContainer = document.getElementById('sectionsContainer');
            const section = document.createElement('div');
            section.className = 'section';
            section.id = 'section-playoff-stats';
            section.innerHTML = `
                <div class="section-title">
                    <i class="fas fa-chart-bar"></i> Stats Playoffs
                    <button class="print-btn" onclick="window.playoffsBracketPatch.printFullPlayoffStats()">
                        <i class="fas fa-print"></i> Imprimir
                    </button>
                </div>
                <div id="playoff-stats-content"></div>
            `;
            sectionsContainer.appendChild(section);
        }
    }

    function removePlayoffStatsMenu() {
        const nav = document.getElementById('nav-playoff-stats');
        if (nav) nav.remove();
        const section = document.getElementById('section-playoff-stats');
        if (section) section.remove();
    }

    // ============================================================
    // 8. INYECCIÓN DE BOTÓN IMPRIMIR EN SECTION-TITLE DE PLAYOFFS
    // ============================================================
    function injectPlayoffsPrintButton() {
        const section = document.getElementById('section-playoffs');
        if (!section) return;
        const title = section.querySelector('.section-title');
        if (!title) return;
        if (title.querySelector('.pbx-print-all-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'print-btn pbx-print-all-btn';
        btn.innerHTML = '<i class="fas fa-print"></i> Imprimir Bracket';
        btn.onclick = () => printBracketView();
        title.appendChild(btn);
    }

    function printBracketView() {
        const torneo = currentData;
        if (!torneo || !hasPlayoffsBracket(torneo)) return;

        const rounds = torneo.playoffs.rounds;
        const labels = getRoundLabels(rounds.length);

        let html = _getPrintHeader('Bracket de Play-Offs');
        html += `<div style="display:flex;gap:1.5rem;overflow-x:auto;padding:1rem 0;">`;

        rounds.forEach((round, rIdx) => {
            const isFinal = rIdx === rounds.length - 1;
            html += `<div style="display:flex;flex-direction:column;gap:0.5rem;min-width:180px;">`;
            html += `<div style="text-align:center;font-size:0.75rem;font-weight:900;color:${isFinal ? '#facc15' : '#94a3b8'};text-transform:uppercase;letter-spacing:0.1em;padding:0.4rem 0;border-bottom:1px solid #2d2d44;margin-bottom:0.5rem;">${labels[rIdx]}</div>`;
            html += `<div style="display:flex;flex-direction:column;justify-content:space-around;flex:1;gap:0.5rem;">`;
            round.forEach(m => {
                const h = getTeam(torneo, m.h);
                const a = getTeam(torneo, m.a);
                const score = getDisplayScore(m);
                const winner = getWinner(m);
                const hWinner = winner === 'h';
                const aWinner = winner === 'a';
                html += `<div style="background:rgba(0,0,0,0.5);border:1px solid ${isFinal ? 'rgba(250,204,21,0.4)' : '#2d2d44'};border-radius:8px;padding:0.4rem 0.6rem;font-size:0.7rem;">`;
                html += `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.15rem 0;${hWinner ? 'color:#4ade80;font-weight:900;' : 'color:#fff;font-weight:700;'}"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${h ? escapeHtml(h.name) : 'TBD'}</span><span style="color:#facc15;font-weight:900;">${score.h}</span></div>`;
                html += `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.15rem 0;${aWinner ? 'color:#4ade80;font-weight:900;' : 'color:#fff;font-weight:700;'}"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a ? escapeHtml(a.name) : 'TBD'}</span><span style="color:#facc15;font-weight:900;">${score.a}</span></div>`;
                if (score.isBox) html += `<div style="text-align:center;font-size:0.55rem;color:#a855f7;font-weight:900;margin-top:0.1rem;">${score.label}</div>`;
                html += `</div>`;
            });
            html += `</div></div>`;
        });

        html += `</div>`;
        html += `<div style="margin-top:1rem;font-size:0.6rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>`;
        html = _resolveCSSVars(html);
        _showPrintModal(html, `bracket_playoffs.jpg`, 1100);
    }

    // ============================================================
    // 9. CSS INYECTADO
    // ============================================================
    function injectStyles() {
        if (document.getElementById('pbx-styles-v2')) return;
        const style = document.createElement('style');
        style.id = 'pbx-styles-v2';
        style.textContent = `
/* ============ BRACKET CONTAINER ============ */
#playoffs-container {
    padding: 1rem !important;
    overflow: visible !important;
    min-height: auto !important;
    height: auto !important;
    display: block !important;
    background: transparent !important;
    border: none !important;
}

.mb-wrapper {
    width: 100%;
    overflow-x: auto;
    overflow-y: visible;
    padding: 0.75rem 0.25rem;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
}

.mb-container {
    display: flex;
    gap: 3rem;
    min-width: max-content;
    align-items: stretch;
    min-height: 500px;
    position: relative;
    padding: 0.5rem 0;
}

.mb-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
}

.mb-column {
    display: flex;
    flex-direction: column;
    min-width: 220px;
    max-width: 220px;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
    scroll-snap-align: center;
}

.mb-round-header {
    text-align: center;
    font-family: 'Montserrat', sans-serif;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-text-muted, #94a3b8);
    padding: 0.5rem 0;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    margin-bottom: 0.75rem;
    flex-shrink: 0;
}

.mb-column-final .mb-round-header {
    color: #facc15;
    border-bottom-color: rgba(250,204,21,0.3);
    font-size: 0.82rem;
    text-shadow: 0 0 12px rgba(250,204,21,0.3);
}

.mb-round-body {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    flex: 1;
    gap: 0.5rem;
}

.mb-card {
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 0.55rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    transition: border-color 0.2s, transform 0.15s;
    cursor: pointer;
    position: relative;
    z-index: 2;
    animation: mbFadeIn 0.4s ease both;
}

.mb-card:hover {
    border-color: rgba(168,85,247,0.5);
    transform: translateY(-1px);
}

.mb-card-final {
    border-color: rgba(250,204,21,0.4);
    box-shadow: 0 0 24px rgba(250,204,21,0.12);
    padding: 0.7rem 0.9rem;
}

.mb-card-final:hover {
    border-color: #facc15;
    box-shadow: 0 0 32px rgba(250,204,21,0.2);
}

.mb-team {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.45rem;
    background: rgba(0,0,0,0.3);
    border-radius: 8px;
    min-width: 0;
}

.mb-team.mb-winner {
    background: rgba(74,222,128,0.08);
    box-shadow: inset 3px 0 0 #4ade80;
}

.mb-team.mb-team-empty {
    opacity: 0.5;
}

.mb-shield {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #000;
    border: 1.5px solid rgba(255,255,255,0.15);
    object-fit: contain;
    flex-shrink: 0;
    display: block;
}

.mb-shield-empty {
    background: rgba(255,255,255,0.05);
    border-style: dashed;
}

.mb-name {
    flex: 1;
    font-weight: 700;
    font-size: 0.75rem;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

.mb-score {
    font-family: 'Montserrat', sans-serif;
    font-weight: 900;
    font-size: 0.9rem;
    color: #facc15;
    padding: 0 0.3rem;
    min-width: 18px;
    text-align: center;
    flex-shrink: 0;
}

.mb-box-badge {
    font-size: 0.55rem;
    font-weight: 900;
    color: #a855f7;
    background: rgba(168,85,247,0.15);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-block;
    border: 1px solid rgba(168,85,247,0.3);
}

@keyframes mbFadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Stagger animation */
.mb-card:nth-child(1) { animation-delay: 0.02s; }
.mb-card:nth-child(2) { animation-delay: 0.05s; }
.mb-card:nth-child(3) { animation-delay: 0.08s; }
.mb-card:nth-child(4) { animation-delay: 0.11s; }
.mb-card:nth-child(5) { animation-delay: 0.14s; }
.mb-card:nth-child(6) { animation-delay: 0.17s; }
.mb-card:nth-child(7) { animation-delay: 0.20s; }
.mb-card:nth-child(8) { animation-delay: 0.23s; }

/* ============ MODAL DE PARTIDO ============ */
.pbx-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: pbxFadeIn 0.2s ease;
}

@keyframes pbxFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.pbx-modal {
    background: var(--color-surface, #14141e);
    border: 1px solid var(--color-border, #2d2d44);
    border-radius: 20px;
    max-width: 820px;
    width: 100%;
    max-height: 92vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,0.8);
    animation: pbxModalIn 0.25s ease;
}

@keyframes pbxModalIn {
    from { opacity: 0; transform: scale(0.96) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}

.pbx-modal-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border, #2d2d44);
    background: rgba(0,0,0,0.2);
}

.pbx-tab {
    padding: 0.35rem 0.8rem;
    border-radius: 8px;
    background: transparent;
    border: 1px solid var(--color-border, #2d2d44);
    color: var(--color-text-muted, #94a3b8);
    font-weight: 700;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
}

.pbx-tab:hover {
    color: #fff;
    border-color: rgba(168,85,247,0.5);
}

.pbx-tab.active {
    background: #a855f7;
    color: #000;
    border-color: #a855f7;
    box-shadow: 0 0 12px rgba(168,85,247,0.4);
}

.pbx-tab.aggregate {
    background: rgba(34,211,238,0.1);
    color: #22d3ee;
    border-color: rgba(34,211,238,0.3);
}

.pbx-tab.aggregate.active {
    background: #22d3ee;
    color: #000;
    border-color: #22d3ee;
    box-shadow: 0 0 12px rgba(34,211,238,0.4);
}

/* ============ RESPONSIVE MÓVIL ============ */
@media (max-width: 900px) {
    .mb-wrapper {
        scroll-snap-type: x mandatory;
        padding: 0.5rem 0;
    }
    .mb-container {
        gap: 1rem;
        min-height: 400px;
    }
    .mb-column {
        min-width: 85vw;
        max-width: 85vw;
        scroll-snap-align: center;
    }
    .mb-round-body {
        max-height: 62vh;
        overflow-y: auto;
        padding-right: 0.4rem;
        -webkit-overflow-scrolling: touch;
    }
    .mb-svg {
        display: none !important;
    }
    .mb-card {
        animation: mbFadeIn 0.35s ease both;
    }
}

/* ============ OCULTAR CSS VIEJO DE PLAYOFFS ============ */
#playoffs-container .bracket-mirror,
#playoffs-container .bracket-linear,
#playoffs-container .bracket-scroll,
#playoffs-container .bracket-container,
#playoffs-container .bracket-container-mirror,
#playoffs-container .bracket-container-linear,
#playoffs-container .bracket-side,
#playoffs-container .bracket-center,
#playoffs-container .bracket-round,
#playoffs-container .bracket-round-header,
#playoffs-container .bracket-round-body,
#playoffs-container .bracket-pair,
#playoffs-container .bracket-standalone,
#playoffs-container .bracket-match,
#playoffs-container .bracket-team,
#playoffs-container .bracket-team-shield,
#playoffs-container .bracket-team-name,
#playoffs-container .bracket-team-score,
#playoffs-container .bracket-score {
    all: unset !important;
    display: revert !important;
}
#playoffs-container .bracket-match-actions,
#playoffs-container .bracket-btn-report,
#playoffs-container .bracket-btn-sim,
#playoffs-container .bracket-btn-edit {
    display: none !important;
}
`;
        document.head.appendChild(style);
    }

    // ============================================================
    // 10. OVERRIDES
    // ============================================================

    // 10.1. renderPlayoffs
    const _originalRenderPlayoffs = window.renderPlayoffs;
    window.renderPlayoffs = function (torneo) {
        if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
            return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
        }
        return renderBracket(torneo);
    };

    // 10.2. switchView
    const _originalSwitchView = window.switchView;
    window.switchView = function (id) {
        _originalSwitchView.call(this, id);
        if (id === 'playoffs') {
            scheduleDrawConnectors(80);
        }
        if (id === 'playoff-stats') {
            renderPlayoffStatsView();
        }
    };

    // 10.3. buildUI
    const _originalBuildUI = window.buildUI;
    window.buildUI = function (torneo) {
        _originalBuildUI.call(this, torneo);
        setTimeout(() => {
            injectPlayoffStatsMenu();
            injectPlayoffsPrintButton();
        }, 60);
    };

    // ============================================================
    // 11. API PÚBLICA DEL PARCHE
    // ============================================================
    window.playoffsBracketPatch = {
        openMatchModal,
        closeMatchModal,
        selectGame,
        showPrintOptions,
        printFullPlayoffStats,
        printBracketView,
        drawConnectors: scheduleDrawConnectors,
        renderPlayoffStatsView
    };

    // ============================================================
    // 12. INIT
    // ============================================================
    injectStyles();

    // Nota: el listener del cambio de modo de impresión se inyecta en showPrintOptions.

    console.log('✅ Playoffs Bracket Patch v2.0 cargado.');
})();