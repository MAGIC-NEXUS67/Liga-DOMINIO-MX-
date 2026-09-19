// ==========================================
// PATCH: Bracket de Play-Offs
// - PC (>1024px): layout espejado (equipos a izquierda y derecha, final al centro)
// - Móvil (<=1024px): layout lineal (todas las rondas de izquierda a derecha)
// - Conectores rectos entre rondas
// - Final destacada con borde dorado
// - Cards en 1 fila (PC) / 2 filas (móvil)
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
    // Fallback: si hay más rondas que las predefinidas
    const extra = totalRounds - base.length;
    const prefix = [];
    for (let i = 0; i < extra; i++) prefix.push('R' + (i + 1));
    return prefix.concat(base);
  }

  // ---------- Render de un partido individual ----------
  function renderBracketMatchPatch(match, torneo, roundIndex, matchIndex, isFinal, pcLayout) {
    const h = getTeamById(torneo.teams, match.h);
    const a = getTeamById(torneo.teams, match.a);
    const hName = h ? h.name : 'TBD';
    const aName = a ? a.name : 'TBD';
    const hShield = h ? h.shield : '';
    const aShield = a ? a.shield : '';
    const played = match.played || false;
    const canPlay = !!(h && a);

    const hWinner = played && match.sH > match.sA;
    const aWinner = played && match.sA > match.sH;

    let actionsHtml = '';
    if (played) {
      actionsHtml = `<button class="bracket-btn bracket-btn-edit" onclick="event.stopPropagation(); UIController.showModal('mod-report', {mId:'${match.id}', isPlayoff:true, r:${roundIndex}, i:${matchIndex}})">EDITAR</button>`;
    } else if (canPlay) {
      actionsHtml = `
        <button class="bracket-btn bracket-btn-report" onclick="event.stopPropagation(); UIController.showModal('mod-report', {mId:'${match.id}', isPlayoff:true, r:${roundIndex}, i:${matchIndex}})">REPORTAR</button>
        <button class="bracket-btn bracket-btn-sim" onclick="event.stopPropagation(); UIController.simulatePredictionPopup('${match.id}', true, {r:${roundIndex}, i:${matchIndex}})">⚡</button>
      `;
    }

    const hShieldHtml = hShield
      ? `<img src="${hShield}" class="bracket-team-shield" alt="">`
      : `<div class="bracket-team-shield bracket-team-shield-empty"></div>`;
    const aShieldHtml = aShield
      ? `<img src="${aShield}" class="bracket-team-shield" alt="">`
      : `<div class="bracket-team-shield bracket-team-shield-empty"></div>`;

    const hScore = played ? match.sH : '-';
    const aScore = played ? match.sA : '-';

    if (pcLayout) {
      // Layout PC: 1 sola fila (home | score | away | acciones)
      return `
        <div class="bracket-match ${isFinal ? 'bracket-match-final' : ''}">
          <div class="bracket-team bracket-team-home ${hWinner ? 'winner' : ''}">
            <span class="bracket-team-name">${hName}</span>
            ${hShieldHtml}
          </div>
          <div class="bracket-score ${!played ? 'bracket-score-pending' : ''}">
            <span class="score-home">${hScore}</span>
            <span class="score-sep">-</span>
            <span class="score-away">${aScore}</span>
          </div>
          <div class="bracket-team bracket-team-away ${aWinner ? 'winner' : ''}">
            ${aShieldHtml}
            <span class="bracket-team-name">${aName}</span>
          </div>
          <div class="bracket-match-actions">${actionsHtml}</div>
        </div>
      `;
    } else {
      // Layout móvil: 2 filas (home arriba, away abajo) + acciones
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
          <div class="bracket-match-actions">${actionsHtml}</div>
        </div>
      `;
    }
  }

  // ---------- Render de una ronda completa ----------
  function renderBracketRoundBodyPatch(matches, roundIndex, offset, torneo, isFinal, pcLayout) {
    let html = '';

    if (isFinal || matches.length === 1) {
      html += `<div class="bracket-standalone">`;
      html += renderBracketMatchPatch(matches[0], torneo, roundIndex, offset, isFinal, pcLayout);
      html += `</div>`;
    } else {
      for (let i = 0; i < matches.length; i += 2) {
        const m1 = matches[i];
        const m2 = matches[i + 1];
        html += `<div class="bracket-pair">`;
        html += renderBracketMatchPatch(m1, torneo, roundIndex, offset + i, false, pcLayout);
        if (m2) html += renderBracketMatchPatch(m2, torneo, roundIndex, offset + i + 1, false, pcLayout);
        html += `</div>`;
      }
    }

    return html;
  }

  // ---------- Bracket lineal (móvil) ----------
  function renderLinearBracketPatch(torneo) {
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
      html += renderBracketRoundBodyPatch(round, rIdx, 0, torneo, isFinal, false);
      html += '</div></div>';
    });

    html += '</div></div>';
    return html;
  }

  // ---------- Bracket espejado (PC) ----------
  function renderMirrorBracketPatch(torneo) {
    const rounds = torneo.playoffs.rounds;
    const totalRounds = rounds.length;
    const labels = getRoundLabelsPatch(totalRounds);

    // Si solo hay una ronda (final directa) → usar lineal
    if (totalRounds === 1) {
      return renderLinearBracketPatch(torneo);
    }

    const lastRoundIdx = totalRounds - 1;

    // Dividir cada ronda previa en 2 mitades (izq/der)
    const leftRounds = [];
    const rightRounds = [];
    for (let r = 0; r < lastRoundIdx; r++) {
      const half = Math.floor(rounds[r].length / 2);
      leftRounds.push({ matches: rounds[r].slice(0, half), roundIndex: r, offset: 0 });
      rightRounds.push({ matches: rounds[r].slice(half), roundIndex: r, offset: half });
    }

    let html = '<div class="bracket-scroll bracket-mirror">';
    html += '<div class="bracket-container bracket-container-mirror">';

    // LEFT SIDE
    html += '<div class="bracket-side bracket-side-left">';
    leftRounds.forEach(({ matches, roundIndex, offset }) => {
      html += `<div class="bracket-round">`;
      html += `<div class="bracket-round-header">${labels[roundIndex]}</div>`;
      html += '<div class="bracket-round-body">';
      html += renderBracketRoundBodyPatch(matches, roundIndex, offset, torneo, false, true);
      html += '</div></div>';
    });
    html += '</div>';

    // CENTER: FINAL
    html += '<div class="bracket-center">';
    const finalMatch = rounds[lastRoundIdx] ? rounds[lastRoundIdx][0] : null;
    if (finalMatch) {
      html += `<div class="bracket-round bracket-round-final">`;
      html += `<div class="bracket-round-header">${labels[lastRoundIdx]}</div>`;
      html += '<div class="bracket-round-body">';
      html += renderBracketRoundBodyPatch([finalMatch], lastRoundIdx, 0, torneo, true, true);
      html += '</div></div>';
    }
    html += '</div>';

    // RIGHT SIDE (reversed)
    html += '<div class="bracket-side bracket-side-right">';
    [...rightRounds].reverse().forEach(({ matches, roundIndex, offset }) => {
      html += `<div class="bracket-round">`;
      html += `<div class="bracket-round-header">${labels[roundIndex]}</div>`;
      html += '<div class="bracket-round-body">';
      html += renderBracketRoundBodyPatch(matches, roundIndex, offset, torneo, false, true);
      html += '</div></div>';
    });
    html += '</div>';

    html += '</div></div>';
    return html;
  }

  // ---------- Reemplazo de renderPlayoffs ----------
  window.renderPlayoffs = function (torneo) {
    if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
      return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
    }
    return '<div class="bracket-wrapper">'
         + renderMirrorBracketPatch(torneo)
         + renderLinearBracketPatch(torneo)
         + '</div>';
  };

  // ---------- Recalcular play-Offs cuando cambia el tamaño de la ventana ----------
  // (Por si el usuario rota el móvil o cambia el tamaño y necesita ver el layout correcto)
  let _bracketResizeTimer = null;
  window.addEventListener('resize', () => {
    if (_bracketResizeTimer) clearTimeout(_bracketResizeTimer);
    _bracketResizeTimer = setTimeout(() => {
      const section = document.getElementById('section-playoffs');
      if (section && section.classList.contains('active')) {
        // Forzar re-render solo si la vista está activa
        try {
          if (typeof UIController !== 'undefined' && UIController.renderPlayoffs) {
            UIController.renderPlayoffs();
          }
        } catch (_) { /* noop */ }
      }
    }, 250);
  });

  // ---------- Hook para que UIController.renderPlayoffs use la nueva versión ----------
  // Si UIController ya existe (porque el script original cargó antes), parcheamos su método.
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
        // Mantener los indicadores de cabecera actualizados
        if (window.UIController.updateNavVisibility) window.UIController.updateNavVisibility();
        if (window.UIController.updateHeaderIndicators) window.UIController.updateHeaderIndicators();
        if (window.UIController.refreshActivityTray) window.UIController.refreshActivityTray();
      };
    } else {
      // Reintentar en el siguiente tick (por si UIController se define después)
      setTimeout(patchUIController, 50);
    }
  }
  patchUIController();

  console.log('✅ Patch de Play-Offs cargado (bracket espejado + lineal).');
})();