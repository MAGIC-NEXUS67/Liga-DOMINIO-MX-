// ==========================================
// PATCH: Bracket de Play-Offs — lineal horizontal
// Rondas en columnas, de izquierda a derecha
// Sin conectores, sin scroll, sin botones
// ==========================================

(function () {
  'use strict';

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

  function renderMatchCard(match, torneo, isFinal) {
    const h = getTeamById(torneo.teams, match.h);
    const a = getTeamById(torneo.teams, match.a);
    const hName = h ? h.name : 'TBD';
    const aName = a ? a.name : 'TBD';
    const hShield = h ? h.shield : '';
    const aShield = a ? a.shield : '';
    const played = match.played || false;
    const hWinner = played && match.sH > match.sA;
    const aWinner = played && match.sA > match.sH;
    const hScore = played ? match.sH : '-';
    const aScore = played ? match.sA : '-';

    const hShieldTag = hShield
      ? `<img class="mb-shield" src="${hShield}" alt="">`
      : `<div class="mb-shield mb-shield-empty"></div>`;
    const aShieldTag = aShield
      ? `<img class="mb-shield" src="${aShield}" alt="">`
      : `<div class="mb-shield mb-shield-empty"></div>`;

    return `
      <div class="mb-card ${isFinal ? 'mb-card-final' : ''}">
        <div class="mb-team ${hWinner ? 'mb-winner' : ''}">
          ${hShieldTag}
          <span class="mb-name">${hName}</span>
          <span class="mb-score">${hScore}</span>
        </div>
        <div class="mb-team ${aWinner ? 'mb-winner' : ''}">
          ${aShieldTag}
          <span class="mb-name">${aName}</span>
          <span class="mb-score">${aScore}</span>
        </div>
      </div>
    `;
  }

  function renderBracket(torneo) {
    const rounds = torneo.playoffs.rounds;
    const totalRounds = rounds.length;
    const labels = getRoundLabelsPatch(totalRounds);

    let html = '<div class="mb-wrapper">';

    rounds.forEach((round, rIdx) => {
      const isFinal = rIdx === totalRounds - 1;
      html += `<div class="mb-column ${isFinal ? 'mb-column-final' : ''}">`;
      html += `<div class="mb-round-header">${labels[rIdx]}</div>`;
      html += `<div class="mb-round-body">`;
      round.forEach((match) => {
        html += renderMatchCard(match, torneo, isFinal);
      });
      html += `</div></div>`;
    });

    html += '</div>';
    return html;
  }

  window.renderPlayoffs = function (torneo) {
    if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
      return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
    }
    return renderBracket(torneo);
  };

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
  // CSS con prefijo mb-
  // ==========================================
  const style = document.createElement('style');
  style.id = 'playoffs-bracket-patch-style';
  style.textContent = `
    /* Contenedor principal */
    #playoffs-container {
      padding: 1rem !important;
      overflow: visible !important;
      min-height: auto !important;
      height: auto !important;
      display: block !important;
      background: transparent !important;
      border: none !important;
    }

    /* Wrapper horizontal: rondas en columnas de izquierda a derecha */
    .mb-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: flex-start !important;
      gap: 1.5rem !important;
      padding: 0.5rem 0 !important;
    }

    /* Columna de ronda */
    .mb-column {
      flex: 1 1 0 !important;
      min-width: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.5rem !important;
    }

    .mb-column-final {
      /* nada especial, mismo ancho */
    }

    /* Header de ronda */
    .mb-round-header {
      font-family: 'Montserrat', sans-serif !important;
      font-size: 0.72rem !important;
      font-weight: 900 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.12em !important;
      color: #94a3b8 !important;
      text-align: center !important;
      padding: 0.4rem 0 !important;
      margin-bottom: 0.3rem !important;
      border-bottom: 1px solid rgba(255,255,255,0.06) !important;
    }

    .mb-column-final .mb-round-header {
      color: #facc15 !important;
      border-bottom-color: rgba(250,204,21,0.3) !important;
      font-size: 0.82rem !important;
      text-shadow: 0 0 12px rgba(250,204,21,0.3) !important;
    }

    /* Body de la ronda: partidos apilados verticalmente */
    .mb-round-body {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.5rem !important;
      width: 100% !important;
      justify-content: space-around !important;
      flex: 1 1 auto !important;
    }

    /* Card de partido */
    .mb-card {
      background: rgba(0,0,0,0.45) !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      border-radius: 12px !important;
      padding: 0.6rem 0.7rem !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 0.3rem !important;
      width: 100% !important;
      box-sizing: border-box !important;
      transition: border-color 0.2s !important;
    }

    .mb-card:hover {
      border-color: rgba(168,85,247,0.5) !important;
    }

    .mb-card-final {
      border-color: rgba(250,204,21,0.4) !important;
      box-shadow: 0 0 24px rgba(250,204,21,0.12) !important;
      padding: 0.8rem 0.9rem !important;
    }

    .mb-card-final:hover {
      border-color: #facc15 !important;
      box-shadow: 0 0 32px rgba(250,204,21,0.2) !important;
    }

    /* Fila de equipo */
    .mb-team {
      display: flex !important;
      align-items: center !important;
      gap: 0.45rem !important;
      padding: 0.32rem 0.42rem !important;
      background: rgba(0,0,0,0.3) !important;
      border-radius: 8px !important;
      min-width: 0 !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .mb-team.mb-winner {
      background: rgba(74,222,128,0.08) !important;
      box-shadow: inset 3px 0 0 #4ade80 !important;
    }

    /* Escudo */
    .mb-shield {
      width: 24px !important;
      height: 24px !important;
      min-width: 24px !important;
      max-width: 24px !important;
      border-radius: 50% !important;
      background: #000 !important;
      border: 1.5px solid rgba(255,255,255,0.15) !important;
      object-fit: contain !important;
      flex-shrink: 0 !important;
      display: block !important;
    }

    .mb-shield-empty {
      background: rgba(255,255,255,0.04) !important;
      border-style: dashed !important;
    }

    /* Nombre */
    .mb-name {
      flex: 1 1 auto !important;
      font-weight: 700 !important;
      font-size: 0.76rem !important;
      color: #fff !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      min-width: 0 !important;
      text-align: left !important;
      line-height: 1.2 !important;
    }

    /* Score */
    .mb-score {
      font-family: 'Montserrat', sans-serif !important;
      font-weight: 900 !important;
      font-size: 0.9rem !important;
      color: #facc15 !important;
      padding: 0 0.25rem !important;
      min-width: 18px !important;
      text-align: center !important;
      flex-shrink: 0 !important;
    }

    /* Responsive: en pantallas chicas, cambia a columnas apiladas */
    @media (max-width: 900px) {
      .mb-wrapper {
        flex-direction: column !important;
        gap: 1rem !important;
      }
      .mb-column {
        width: 100% !important;
      }
      .mb-name { font-size: 0.78rem !important; }
      .mb-shield { width: 26px !important; height: 26px !important; min-width: 26px !important; max-width: 26px !important; }
    }

    /* Neutralizar CSS viejo */
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

  console.log('✅ Patch de Play-Offs cargado (horizontal, rondas en columnas izquierda → derecha).');
})();