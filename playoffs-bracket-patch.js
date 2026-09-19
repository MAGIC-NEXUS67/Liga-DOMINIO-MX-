// ==========================================
// PATCH: Bracket de Play-Offs (idéntico al móvil, sin scroll)
// - Un solo layout lineal centrado
// - Cards anchas con nombres completos
// - Escudos visibles en home y away
// - ❌ SIN botones de reportar / simular / editar
// - ❌ SIN scroll horizontal (se adapta al ancho)
// ==========================================

(function () {
  'use strict';

  // ---------- Helpers de etiquetas de ronda ----------
  function getRoundLabelsPatch(totalRounds) {
    const base = ['16avos', 'Octavos', 'Cuartos', 'Semis', 'Final'];
    if (totalRounds <= base.length) {
      return base.slice(base.length - totalRounds);
    }
    const extra = totalRounds - base.length;
    const prefix = [];
    for (let i = 0; i < extra; i++) prefix.push('R' + (i + 1));
    return prefix.concat(base);
  }

  // ---------- Render de un partido ----------
  function renderBracketMatchPatch(match, torneo, roundIndex, matchIndex, isFinal) {
    const h = getTeamById(torneo.teams, match.h);
    const a = getTeamById(torneo.teams, match.a);
    const hName = h ? h.name : 'TBD';
    const aName = a ? a.name : 'TBD';
    const hShield = h ? h.shield : '';
    const aShield = a ? a.shield : '';
    const played = match.played || false;

    const hWinner = played && match.sH > match.sA;
    const aWinner = played && match.sA > match.sH;

    const hShieldHtml = hShield
      ? `<img src="${hShield}" class="bracket-team-shield" alt="">`
      : `<div class="bracket-team-shield bracket-team-shield-empty"></div>`;
    const aShieldHtml = aShield
      ? `<img src="${aShield}" class="bracket-team-shield" alt="">`
      : `<div class="bracket-team-shield bracket-team-shield-empty"></div>`;

    const hScore = played ? match.sH : '-';
    const aScore = played ? match.sA : '-';

    return `
      <div class="bracket-match ${isFinal ? 'bracket-match-final' : ''}">
        <div class="bracket-team bracket-team-home ${hWinner ? 'winner' : ''}">
          ${hShieldHtml}
          <span class="bracket-team-name">${hName}</span>
          <span class="bracket-team-score">${hScore}</span>
        </div>
        <div class="bracket-team bracket-team-away ${aWinner ? 'winner' : ''}">
          ${aShieldHtml}
          <span class="bracket-team-name">${aName}</span>
          <span class="bracket-team-score">${aScore}</span>
        </div>
      </div>
    `;
  }

  // ---------- Render de una ronda ----------
  function renderBracketRoundBodyPatch(matches, roundIndex, offset, torneo, isFinal) {
    let html = '';

    if (isFinal || matches.length === 1) {
      html += `<div class="bracket-standalone">`;
      html += renderBracketMatchPatch(matches[0], torneo, roundIndex, offset, isFinal);
      html += `</div>`;
    } else {
      for (let i = 0; i < matches.length; i += 2) {
        const m1 = matches[i];
        const m2 = matches[i + 1];
        html += `<div class="bracket-pair">`;
        html += renderBracketMatchPatch(m1, torneo, roundIndex, offset + i, false);
        if (m2) html += renderBracketMatchPatch(m2, torneo, roundIndex, offset + i + 1, false);
        html += `</div>`;
      }
    }

    return html;
  }

  // ---------- Bracket lineal único ----------
  function renderLinearBracketOnly(torneo) {
    const rounds = torneo.playoffs.rounds;
    const totalRounds = rounds.length;
    const labels = getRoundLabelsPatch(totalRounds);

    let html = '<div class="bracket-wrapper">';
    html += '<div class="bracket-container bracket-container-linear">';

    rounds.forEach((round, rIdx) => {
      const isFinal = rIdx === totalRounds - 1;
      html += `<div class="bracket-round ${isFinal ? 'bracket-round-final' : ''}">`;
      html += `<div class="bracket-round-header">${labels[rIdx]}</div>`;
      html += '<div class="bracket-round-body">';
      html += renderBracketRoundBodyPatch(round, rIdx, 0, torneo, isFinal);
      html += '</div></div>';
    });

    html += '</div></div>';
    return html;
  }

  // ---------- Reemplazo de renderPlayoffs ----------
  window.renderPlayoffs = function (torneo) {
    if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
      return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
    }
    return renderLinearBracketOnly(torneo);
  };

  // ---------- Recalcular al redimensionar ----------
  let _bracketResizeTimer = null;
  window.addEventListener('resize', () => {
    if (_bracketResizeTimer) clearTimeout(_bracketResizeTimer);
    _bracketResizeTimer = setTimeout(() => {
      const section = document.getElementById('section-playoffs');
      if (section && section.classList.contains('active')) {
        try {
          if (typeof UIController !== 'undefined' && UIController.renderPlayoffs) {
            UIController.renderPlayoffs();
          }
        } catch (_) { /* noop */ }
      }
    }, 250);
  });

  // ---------- Hook UIController ----------
  function patchUIController() {
    if (typeof window.UIController !== 'undefined' && typeof window.UIController.renderPlayoffs === 'function') {
      window.UIController.renderPlayoffs = function () {
        const t = currentData;
        const cnt = document.getElementById('playoffs-container');
        if (!cnt) return;
        if (!t || !t.playoffs || !t.playoffs.rounds || !t.playoffs.rounds.length) {
          cnt.innerHTML = '<p class="text-gray-600 font-bold uppercase tracking-widest"><i class="fa-solid fa-sitemap text-3xl block mb-2 text-center"></i> Selecciona formato y genera el cuadro</p>';
          return;
        }
        cnt.innerHTML = window.renderPlayoffs(t);
        if (window.UIController.updateNavVisibility) window.UIController.updateNavVisibility();
        if (window.UIController.updateHeaderIndicators) window.UIController.updateHeaderIndicators();
        if (window.UIController.refreshActivityTray) window.UIController.refreshActivityTray();
      };
    } else {
      setTimeout(patchUIController, 50);
    }
  }
  patchUIController();

  // ==========================================
  // CSS override — estilo idéntico al móvil, clean, sin scroll
  // ==========================================
  const style = document.createElement('style');
  style.id = 'playoffs-bracket-patch-style';
  style.textContent = `
    /* ---------- Contenedor principal ---------- */
    #playoffs-container {
      padding: 1rem !important;
      overflow: visible !important;
    }

    /* ---------- Wrapper general ---------- */
    .bracket-wrapper {
      width: 100%;
    }

    /* ---------- Ocultar layout espejado ---------- */
    .bracket-mirror { display: none !important; }
    .bracket-linear { display: block !important; }

    /* ---------- Ocultar cualquier botón residual ---------- */
    .bracket-match-actions,
    .bracket-btn-report,
    .bracket-btn-sim,
    .bracket-btn-edit { display: none !important; }

    /* ---------- SIN SCROLL: el contenedor se adapta ---------- */
    .bracket-scroll,
    .bracket-container-linear,
    .bracket-linear {
      overflow: visible !important;
      padding: 0 !important;
      border: none !important;
      background: transparent !important;
      min-width: 0 !important;
    }

    /* ---------- Contenedor de rondas ---------- */
    .bracket-container-linear {
      display: flex !important;
      flex-direction: column !important;
      gap: 1.25rem !important;
      min-height: auto !important;
      min-width: 0 !important;
      width: 100% !important;
      align-items: stretch !important;
    }

    /* ---------- Cada ronda: ancho completo, sin min/max width ---------- */
    .bracket-round {
      min-width: 0 !important;
      max-width: none !important;
      width: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.5rem !important;
      position: relative !important;
    }

    /* ---------- Header de ronda ---------- */
    .bracket-round-header {
      font-family: 'Montserrat', sans-serif !important;
      font-size: 0.72rem !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.12em !important;
      color: var(--color-text-muted) !important;
      text-align: center !important;
      padding: 0.5rem 0 !important;
      margin-bottom: 0.4rem !important;
      border-bottom: 1px solid rgba(255,255,255,0.06) !important;
    }

    .bracket-round-final .bracket-round-header {
      color: #facc15 !important;
      border-bottom-color: rgba(250,204,21,0.3) !important;
      font-size: 0.82rem !important;
      text-shadow: 0 0 12px rgba(250,204,21,0.3) !important;
    }

    /* ---------- Body de la ronda: partidos apilados verticalmente ---------- */
    .bracket-round-body {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.6rem !important;
      justify-content: flex-start !important;
      padding: 0 !important;
      position: relative !important;
    }

    /* ---------- Par de partidos: 2 columnas en PC, 1 en móvil ---------- */
    .bracket-pair {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 0.6rem !important;
      padding: 0 !important;
      position: relative !important;
      flex: none !important;
    }

    /* En móvil: 1 columna */
    @media (max-width: 640px) {
      .bracket-pair {
        grid-template-columns: 1fr !important;
      }
    }

    /* Ocultar conectores viejos */
    .bracket-pair::before,
    .bracket-pair::after,
    .bracket-standalone::after,
    .bracket-pair > .bracket-match::after {
      display: none !important;
    }

    /* ---------- Partido standalone (rondas de 1 solo partido) ---------- */
    .bracket-standalone {
      display: flex !important;
      justify-content: center !important;
      padding: 0 !important;
      position: relative !important;
    }
    .bracket-standalone .bracket-match {
      max-width: 100% !important;
      width: 100% !important;
    }

    /* ---------- Card de partido ---------- */
    .bracket-match {
      background: rgba(0,0,0,0.4) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 12px !important;
      padding: 0.7rem 0.85rem !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.4rem !important;
      position: relative !important;
      transition: border-color 0.2s, box-shadow 0.2s !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .bracket-match:hover {
      border-color: rgba(168,85,247,0.5) !important;
    }

    .bracket-match-final {
      border-color: rgba(250,204,21,0.4) !important;
      box-shadow: 0 0 24px rgba(250,204,21,0.12) !important;
      padding: 0.85rem 1rem !important;
    }

    .bracket-match-final:hover {
      border-color: #facc15 !important;
      box-shadow: 0 0 32px rgba(250,204,21,0.2) !important;
    }

    /* ---------- Team row (home y away) ---------- */
    .bracket-team {
      display: flex !important;
      align-items: center !important;
      gap: 0.55rem !important;
      padding: 0.4rem 0.5rem !important;
      background: rgba(0,0,0,0.3) !important;
      border-radius: 8px !important;
      min-width: 0 !important;
      transition: background 0.15s !important;
    }

    .bracket-team.winner {
      background: rgba(74,222,128,0.08) !important;
      box-shadow: inset 3px 0 0 var(--neon-green) !important;
    }

    /* Escudos: tamaño fijo y visible en ambos lados */
    .bracket-team-shield {
      width: 28px !important;
      height: 28px !important;
      border-radius: 50% !important;
      background: #000 !important;
      border: 1.5px solid rgba(255,255,255,0.12) !important;
      object-fit: contain !important;
      flex-shrink: 0 !important;
      display: block !important;
    }

    .bracket-team-shield-empty {
      background: rgba(255,255,255,0.03) !important;
      border-style: dashed !important;
    }

    /* Nombre: toma todo el espacio disponible y se ve completo */
    .bracket-team-name {
      flex: 1 1 auto !important;
      font-weight: 700 !important;
      font-size: 0.82rem !important;
      color: #fff !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      min-width: 0 !important;
      text-align: left !important;
    }

    /* Score: alineado a la derecha, con tipografía fuerte */
    .bracket-team-score {
      font-family: 'Montserrat', sans-serif !important;
      font-weight: 900 !important;
      font-size: 1rem !important;
      color: #facc15 !important;
      padding: 0 0.35rem !important;
      min-width: 22px !important;
      text-align: center !important;
      flex-shrink: 0 !important;
    }

    /* ---------- Responsive fino ---------- */
    @media (max-width: 640px) {
      .bracket-team-name { font-size: 0.76rem !important; }
      .bracket-team-shield { width: 24px !important; height: 24px !important; }
      .bracket-team-score { font-size: 0.9rem !important; }
      .bracket-match { padding: 0.6rem 0.7rem !important; }
    }
  `;
  document.head.appendChild(style);

  console.log('✅ Patch de Play-Offs cargado (layout lineal idéntico al móvil, sin scroll, sin botones).');
})();