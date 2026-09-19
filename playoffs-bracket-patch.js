// ==========================================
// PATCH: Bracket de Play-Offs (lineal único, PC y móvil iguales)
// - Un solo layout vertical/horizontal-lineal para todas las resoluciones
// - Rondas apiladas de izquierda a derecha (scroll horizontal si es necesario)
// - Cards en 2 filas (equipo arriba, equipo abajo)
// - ❌ SIN botones de reportar / simular / editar
// - Se sobreescribe la función renderPlayoffs original
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

  // ---------- Render de un partido individual ----------
  // Siempre layout vertical (2 filas: home arriba, away abajo)
  // SIN botones
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

  // ---------- Render de una ronda completa ----------
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

    let html = '<div class="bracket-scroll bracket-linear">';
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
    return '<div class="bracket-wrapper">' + renderLinearBracketOnly(torneo) + '</div>';
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

  // ---------- Hook para que UIController.renderPlayoffs use la nueva versión ----------
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

  // ---------- CSS override ----------
  // Fuerza:
  // - Ocultar el layout espejado (ya no se usa)
  // - Mostrar SIEMPRE el layout lineal, en cualquier resolución
  // - Ocultar cualquier botón de bracket residual
  // - Mejorar el aspecto del scroll
  const style = document.createElement('style');
  style.textContent = `
    /* Ocultar el layout espejado (ya no se usa) */
    .bracket-mirror { display: none !important; }
    /* Forzar el layout lineal SIEMPRE */
    .bracket-linear { display: block !important; }

    /* Ocultar cualquier botón residual */
    .bracket-match-actions,
    .bracket-btn-report,
    .bracket-btn-sim,
    .bracket-btn-edit { display: none !important; }

    /* Scroll del bracket más limpio */
    .bracket-scroll {
      scrollbar-width: thin;
      scrollbar-color: rgba(168,85,247,0.4) transparent;
    }
    .bracket-scroll::-webkit-scrollbar {
      height: 8px;
    }
    .bracket-scroll::-webkit-scrollbar-track {
      background: transparent;
    }
    .bracket-scroll::-webkit-scrollbar-thumb {
      background: rgba(168,85,247,0.4);
      border-radius: 100px;
    }
    .bracket-scroll::-webkit-scrollbar-thumb:hover {
      background: rgba(168,85,247,0.7);
    }

    /* Escudos un poco más grandes */
    .bracket-team-shield {
      width: 26px !important;
      height: 26px !important;
    }

    /* Cards con un poco más de padding y ancho cómodo */
    .bracket-round {
      min-width: 220px !important;
      max-width: 240px !important;
    }
    .bracket-match {
      padding: 0.6rem 0.75rem !important;
    }
    .bracket-team-name {
      font-size: 0.78rem !important;
    }
  `;
  document.head.appendChild(style);

  console.log('✅ Patch de Play-Offs cargado (layout lineal único, PC y móvil iguales, SIN botones).');
})();