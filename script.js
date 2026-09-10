  // ==========================================
  // VARIABLES GLOBALES
  // ==========================================
  let data1 = null;
  let data2 = null;
  let currentData = null;
  let currentDivision = 1;
  let customThemes = [];
  let currentTheme = 'dominio';
  let currentDensity = 'normal';
  let advFilters = { rankMin: '', rankMax: '', division: '', priceMin: 0, priceMax: Infinity };
  let rankingsCache = {};
  let statsLimits = { goals: 10, assists: 10, saves: 10, shots: 10 };
  const MAX_STATS_LIMIT = 50;
  let currentMvpJornada = 0;
  let currentEcoFilters = { round: 'todas', team: 'all', type: 'todos', sort: 'reciente' };

  let perfSelectedTeamId = null;
  let perfSelectedPlayerId = null;
  let perfCurrentTab = 'equipos';

  const sidebar = document.getElementById('sidebar');
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mainNav = document.getElementById('mainNav');
  const sectionsContainer = document.getElementById('sectionsContainer');
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');

  const MENU_ITEMS = [
    { id: 'tabla', label: 'Tabla General', icon: 'fa-table' },
    { id: 'media', label: 'Tabla de Media', icon: 'fa-chart-simple' },
    { id: 'jornadas', label: 'Jornadas', icon: 'fa-calendar-day' },
    { id: 'playoffs', label: 'PlayOffs', icon: 'fa-sitemap' },
    { id: 'stats', label: 'Stats', icon: 'fa-chart-bar' },
    { id: 'performance', label: 'Performance', icon: 'fa-chart-line' },
    { id: 'balon', label: 'Balón de Oro', icon: 'fa-trophy' },
    { id: 'equipos', label: 'Equipos', icon: 'fa-users' },
    { id: 'mercado', label: 'Mercado', icon: 'fa-store' },
    { id: 'economia', label: 'Mov. Económicos', icon: 'fa-coins' },
    { id: 'sanciones', label: 'Sanciones', icon: 'fa-gavel' },
    { id: 'seleccion', label: 'Selección Nacional', icon: 'fa-flag' },
    { id: 'amistosos', label: 'Partidos Amistosos', icon: 'fa-handshake' },
    { id: 'salon', label: 'Salón de la Fama', icon: 'fa-medal' }
  ];

  // ==========================================
  // UTILIDADES
  // ==========================================
  function formatCurrency(amount) {
    if (amount >= 1e6) return '$' + (amount / 1e6).toFixed(1) + 'M';
    if (amount >= 1e3) return '$' + (amount / 1e3).toFixed(0) + 'K';
    return '$' + amount.toFixed(0);
  }

  function getRankColor(rank) {
    const colors = {
      'Bronce': '#cd7f32', 'Plata': '#c0c0c0', 'Oro': '#ffd700',
      'Platino': '#e5e4e2', 'Diamante': '#b9f2ff', 'Campeón': '#ff6b6b',
      'Gran Campeón': '#ff4757', 'SSL': '#ff4757'
    };
    return colors[rank] || '#fff';
  }

  function getTeamById(teams, id) {
    if (!teams) return null;
    return teams.find(t => t.id === id);
  }

  function getPlayerById(torneo, playerId) {
    if (!torneo || !torneo.teams) return null;
    for (let tm of torneo.teams) {
      const p = tm.players.find(x => x.id === playerId);
      if (p) return p;
    }
    return null;
  }

  function formatDate(timestamp) {
    try {
      const d = new Date(timestamp);
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
    } catch (_) { return '--/--/--'; }
  }

  function getTipoInfo(type) {
    const map = {
      'bonus': { label: 'Bonos', icon: '🏆', cls: 'bonus' },
      'transfer_in': { label: 'Fichajes', icon: '📥', cls: 'fichaje' },
      'transfer_out': { label: 'Ventas', icon: '📤', cls: 'venta' },
      'loan': { label: 'Préstamos', icon: '📋', cls: 'prestamo' },
      'penalty': { label: 'Sanciones', icon: '⚠️', cls: 'sancion' },
      'release': { label: 'Liberación', icon: '📄', cls: 'transferencia' },
      'return': { label: 'Retorno', icon: '↩️', cls: 'transferencia' }
    };
    return map[type] || { label: 'Otro', icon: '🔄', cls: 'transferencia' };
  }

  function getPlayerCategory(pig) {
    if (pig > 200) return { label: 'Leyenda', emoji: '⭐', multiplier: 3.0 };
    if (pig > 150) return { label: 'Elite', emoji: '🏆', multiplier: 2.5 };
    if (pig > 100) return { label: 'Superestrella', emoji: '💎', multiplier: 2.0 };
    if (pig > 75) return { label: 'Estrella', emoji: '🌟', multiplier: 1.6 };
    if (pig > 50) return { label: 'Promesa', emoji: '⚡', multiplier: 1.3 };
    if (pig > 30) return { label: 'Consolidado', emoji: '🔄', multiplier: 1.0 };
    if (pig > 15) return { label: 'Rotación', emoji: '📋', multiplier: 0.7 };
    if (pig > 5) return { label: 'Fondo', emoji: '🪑', multiplier: 0.5 };
    return { label: 'Novato', emoji: '🆕', multiplier: 0.3 };
  }

  function getRankMultiplier(rank, division) {
    const base = { 'Bronce':0.5, 'Plata':0.7, 'Oro':1.0, 'Platino':1.3, 'Diamante':1.7, 'Campeón':2.2, 'Gran Campeón':2.8, 'SSL':3.5 }[rank] || 1.0;
    if (rank === 'SSL') return 3.5;
    const bonus = { 1:0, 2:0.12, 3:0.25 }[division] || 0;
    return base * (1 + bonus);
  }

  function applyPowerFrenzy(value) {
    if (value <= 120) return Math.min(value, 500);
    if (value <= 200) return 120 + (value - 120) / 1.2;
    if (value <= 400) return 200 + (value - 200) / 1.8;
    return 400 + (value - 400) / 3;
  }

  function getPlayerVisibility(player, team) {
    if (!team) return '☆☆☆☆☆';
    const pig = player.seasonStats?.pig || 0;
    const cat = getPlayerCategory(pig);
    const catFactor = cat.multiplier;
    const rankFactor = getRankMultiplier(player.rocketRank, player.division || 2);
    const roleMap = { 'Titular 🌟':1.5, 'Suplente 🔄':0.9, 'Reserva 💤':0.5 };
    const roleFactor = roleMap[player.role] || 0.5;
    const glb = team.glb || 50;
    let teamFactor = 0.5;
    if (glb >= 450) teamFactor = 2.0;
    else if (glb >= 350) teamFactor = 1.7;
    else if (glb >= 250) teamFactor = 1.4;
    else if (glb >= 150) teamFactor = 1.1;
    else if (glb >= 100) teamFactor = 0.9;
    else if (glb >= 70) teamFactor = 0.7;
    let raw = catFactor * rankFactor * roleFactor * teamFactor;
    const scaled = Math.pow(raw, 0.6);
    let stars = Math.min(5, Math.max(1, Math.ceil(scaled)));
    if (player.isCaptain && glb >= 250) stars = Math.max(stars, 4);
    if (player.isCaptain && glb >= 400) stars = 5;
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  function getTeamName(teamId) {
    if (!teamId) return 'Agente Libre';
    if (!currentData) return '?';
    for (let tm of currentData.teams) {
      if (tm.id === teamId) return tm.name;
    }
    return '?';
  }

  // ==========================================
  // CÁLCULO DE RANKINGS
  // ==========================================
  function calculateRankings(torneo) {
    const allPlayers = [];
    torneo.teams.forEach(team => {
      team.players.forEach(p => {
        if (p.name && p.name.trim() !== '') {
          allPlayers.push({ ...p, teamName: team.name, teamShield: team.shield, teamGlb: team.glb });
        }
      });
    });
    (torneo.freeAgents || []).forEach(p => {
      if (p.name && p.name.trim() !== '') {
        allPlayers.push({ ...p, teamName: 'Agente Libre', teamShield: '', teamGlb: 0 });
      }
    });
    if (allPlayers.length === 0) return {};

    const sortBy = (key, desc = true) => {
      const sorted = [...allPlayers].sort((a, b) => {
        const va = a.seasonStats?.[key] || 0;
        const vb = b.seasonStats?.[key] || 0;
        return desc ? vb - va : va - vb;
      });
      sorted.forEach((p, i) => p[`rank_${key}`] = i + 1);
      return sorted;
    };

    sortBy('goals');
    sortBy('assists');
    sortBy('saves');
    sortBy('shots');
    sortBy('pig');

    const sortedByMarket = [...allPlayers].sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0));
    sortedByMarket.forEach((p, i) => p.rank_market = i + 1);

    const sortedByPig = [...allPlayers].sort((a, b) => (b.seasonStats?.pig || 0) - (a.seasonStats?.pig || 0));
    sortedByPig.forEach((p, i) => p.rank_bdor = i + 1);

    const cache = {};
    allPlayers.forEach(p => {
      cache[p.id] = {
        rank_market: p.rank_market || 0,
        rank_goals: p.rank_goals || 0,
        rank_assists: p.rank_assists || 0,
        rank_saves: p.rank_saves || 0,
        rank_shots: p.rank_shots || 0,
        rank_pig: p.rank_pig || 0,
        rank_bdor: p.rank_bdor || 0
      };
    });
    return cache;
  }

  // ==========================================
  // PERFIL DE JUGADOR
  // ==========================================
  function showPlayerProfile(playerId) {
    const torneo = currentData;
    if (!torneo) return;

    let player = null;
    let team = null;
    for (let tm of torneo.teams) {
      const found = tm.players.find(p => p.id === playerId);
      if (found) { player = found; team = tm; break; }
    }
    if (!player && torneo.freeAgents) {
      const found = torneo.freeAgents.find(p => p.id === playerId);
      if (found) { player = found; team = null; }
    }
    if (!player) return alert('Jugador no encontrado.');

    const ranks = rankingsCache[playerId] || { rank_market: 0, rank_goals: 0, rank_assists: 0, rank_saves: 0, rank_pig: 0, rank_bdor: 0 };
    const stats = player.seasonStats || { goals: 0, assists: 0, saves: 0, shots: 0, pig: 0 };
    const career = player.careerStats || { totalGoals: 0, totalAssists: 0, totalSaves: 0, totalPIG: 0, seasonsPlayed: 0, teams: [] };
    const history = player.transferHistory || [];
    const rankColor = getRankColor(player.rocketRank);
    const category = getPlayerCategory(stats.pig);
    const visibility = getPlayerVisibility(player, team);

    let badges = '';
    if (player.isCaptain) badges += '<span class="badge-captain">👑 Capitán</span> ';
    if (player.status === 'loaned') badges += '<span class="badge-loan">📤 PRESTADO</span> ';
    if (player.status === 'free_agent') badges += '<span class="badge-free">🆓 AGENTE LIBRE</span> ';
    if (torneo.nationalTeams) {
      let inNational = false;
      for (let nt of torneo.nationalTeams) {
        if (nt.players && nt.players.some(p => p.id === playerId)) { inNational = true; break; }
      }
      if (inNational) badges += '<span class="badge-national">🌍 SELECCIÓN</span> ';
    }
    if (player.sanctions && player.sanctions.length > 0) {
      const active = player.sanctions.filter(s => s.active !== false);
      if (active.some(s => s.type === 'red' || s.type === 'suspension')) {
        badges += '<span class="badge-suspended">🚫 SUSPENDIDO</span> ';
      } else if (active.some(s => s.type === 'yellow')) {
        badges += '<span class="badge-yellow">🟨 AMONESTADO</span> ';
      }
    }

    const visibilityDisplay = visibility || '☆☆☆☆☆';

    const html = `
      <div class="player-profile-card">
        <div class="profile-header-row">
          <div class="profile-shield">
            <img src="${team ? team.shield : ''}" alt="${team ? team.name : 'Sin equipo'}" onerror="this.style.display='none'">
          </div>
          <div class="profile-header-info">
            <div class="profile-name">
              <span class="icon">🎯</span> ${player.name}
            </div>
            <div class="profile-meta">
              ${team ? team.name : 'Agente Libre'} •
              <span style="color:${rankColor}; font-weight:700;">${player.rocketRank} ${player.rocketRank !== 'SSL' ? player.division : ''}</span> •
              ${category.emoji} ${category.label} •
              ${player.role || 'Sin rol'}
            </div>
            <div class="profile-badges">
              ${badges}
              <span class="profile-visibility">${visibilityDisplay} Visibilidad</span>
              <span class="bdor-rank">🏅 Ranking BdO: #${ranks.rank_bdor}</span>
            </div>
          </div>
        </div>

        <div class="profile-value">
          💰 Valor de Mercado: ${formatCurrency(player.marketValue || 0)} &nbsp;|&nbsp; 📊 Ranking en mercado: #${ranks.rank_market}
        </div>

        <div class="profile-stats-grid">
          <div class="stat-item">
            <div class="stat-value">⚽ ${stats.goals || 0}</div>
            <div class="stat-label">Goles · <span style="color:#ffd700;">#${ranks.rank_goals}</span></div>
          </div>
          <div class="stat-item">
            <div class="stat-value">🎯 ${stats.assists || 0}</div>
            <div class="stat-label">Asisten · <span style="color:#ffd700;">#${ranks.rank_assists}</span></div>
          </div>
          <div class="stat-item">
            <div class="stat-value">🧤 ${stats.saves || 0}</div>
            <div class="stat-label">Salv · <span style="color:#ffd700;">#${ranks.rank_saves}</span></div>
          </div>
          <div class="stat-item">
            <div class="stat-value">📊 ${(stats.pig || 0).toFixed(1)}</div>
            <div class="stat-label">PIG · <span style="color:#ffd700;">#${ranks.rank_pig}</span></div>
          </div>
        </div>

        <div class="profile-career">
          <div class="section-title-sm">📊 Estadísticas de Carrera</div>
          <div class="career-stats">
            <span>Goles: ${career.totalGoals || 0}</span>
            <span>Asistencias: ${career.totalAssists || 0}</span>
            <span>Salvadas: ${career.totalSaves || 0}</span>
            <span>PIG total: ${(career.totalPIG || 0).toFixed(1)}</span>
            <span>Temporadas: ${career.seasonsPlayed || 0}</span>
            <span>Equipos: ${(career.teams || []).length}</span>
          </div>
        </div>

        <div class="profile-info">
          <div class="section-title-sm">ℹ️ Información</div>
          <div class="info-items">
            <span>Estado: ${player.status === 'loaned' ? '📤 Prestado' : player.status === 'free_agent' ? '🆓 Agente Libre' : '✅ Propio'}</span>
            <span>Peligro: ${player.peligro || 0} 💀</span>
            <span>Visibilidad: ${visibilityDisplay}</span>
          </div>
        </div>

        ${history.length > 0 ? `
        <div class="profile-history">
          <div class="section-title-sm">📜 Historial de Movimientos</div>
          ${history.slice().reverse().map(h => {
            const fromName = getTeamName(h.fromTeamId);
            const toName = getTeamName(h.toTeamId);
            const typeMap = {
              'transfer': '🔄 Traspaso',
              'loan': '📤 Préstamo',
              'return': '📥 Retorno',
              'free_agent': '🆓 Agente Libre'
            };
            return `
              <div class="history-item">
                ${typeMap[h.type] || '🔄 Movimiento'} 
                ${fromName} → ${toName} 
                ${h.fee ? '💰 '+formatCurrency(h.fee) : ''}
                ${h.round ? '(Jornada '+h.round+')' : ''}
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        <div class="profile-actions">
          <div class="profile-actions-left">
            <button onclick="showPlayerPerformance('${player.id}')" class="btn-performance">
              📊 Ver Performance
            </button>
            <button onclick="printPlayerProfile('${player.id}')" class="btn-share">
              🖨️ Imprimir
            </button>
          </div>
          <button onclick="closePlayerProfile()" class="btn-close">
            ❌ Cerrar
          </button>
        </div>
      </div>
    `;

    const modal = document.getElementById('profile-modal-overlay');
    const content = document.getElementById('profile-modal-content');
    content.innerHTML = html;
    modal.classList.add('active');
  }

  function closePlayerProfile() {
    document.getElementById('profile-modal-overlay').classList.remove('active');
  }

  function showPlayerPerformance(playerId) {
    // Cierra el perfil y navega a la sección Performance con ese jugador preseleccionado
    closePlayerProfile();
    perfSelectedPlayerId = playerId;
    perfCurrentTab = 'jugadores';
    switchView('performance');
  }

  function printPlayerProfile(playerId) {
    // Cerramos la tarjeta antes de imprimir para que en móvil no se quede encima
    closePlayerProfile();

    const torneo = currentData;
    if (!torneo) return;

    let player = null;
    let team = null;
    for (let tm of torneo.teams) {
      const found = tm.players.find(p => p.id === playerId);
      if (found) { player = found; team = tm; break; }
    }
    if (!player && torneo.freeAgents) {
      const found = torneo.freeAgents.find(p => p.id === playerId);
      if (found) { player = found; team = null; }
    }
    if (!player) return alert('Jugador no encontrado.');

    const ranks = rankingsCache[playerId] || { rank_market: 0, rank_goals: 0, rank_assists: 0, rank_saves: 0, rank_pig: 0, rank_bdor: 0 };
    const stats = player.seasonStats || { goals: 0, assists: 0, saves: 0, shots: 0, pig: 0 };
    const career = player.careerStats || { totalGoals: 0, totalAssists: 0, totalSaves: 0, totalPIG: 0, seasonsPlayed: 0, teams: [] };
    const rankColor = getRankColor(player.rocketRank);
    const category = getPlayerCategory(stats.pig);
    const visibility = getPlayerVisibility(player, team);

    let badges = '';
    if (player.isCaptain) badges += '👑 Capitán ';
    if (player.status === 'loaned') badges += '📤 PRESTADO ';
    if (player.status === 'free_agent') badges += '🆓 AGENTE LIBRE ';
    if (player.sanctions && player.sanctions.length > 0) {
      const active = player.sanctions.filter(s => s.active !== false);
      if (active.some(s => s.type === 'red' || s.type === 'suspension')) badges += '🚫 SUSPENDIDO ';
      else if (active.some(s => s.type === 'yellow')) badges += '🟨 AMONESTADO ';
    }

    const visibilityDisplay = visibility || '☆☆☆☆☆';

    const printHtml = `
      <div style="background:var(--color-surface);color:var(--color-text);padding:1.5rem;border-radius:16px;border:1px solid var(--color-border);max-width:700px;margin:0 auto;font-family:Inter,sans-serif;">
        <div style="display:flex;gap:1rem;align-items:center;border-bottom:1px solid var(--color-border);padding-bottom:0.8rem;">
          <div style="flex-shrink:0;"><img src="${team ? team.shield : ''}" style="width:60px;height:60px;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;"></div>
          <div style="flex:1;">
            <div style="font-size:1.3rem;font-weight:900;">🎯 ${player.name}</div>
            <div style="font-size:0.75rem;color:#94a3b8;">
              ${team ? team.name : 'Agente Libre'} •
              <span style="color:${rankColor};font-weight:700;">${player.rocketRank} ${player.rocketRank !== 'SSL' ? player.division : ''}</span> •
              ${category.emoji} ${category.label} •
              ${player.role || 'Sin rol'}
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-top:0.2rem;font-size:0.65rem;">
              ${badges ? `<span>${badges}</span>` : ''}
              <span style="color:var(--neon-yellow);">${visibilityDisplay} Visibilidad</span>
              <span style="color:#ffd700;font-weight:900;">🏅 Ranking BdO: #${ranks.rank_bdor}</span>
            </div>
          </div>
        </div>

        <div style="text-align:center;font-size:0.9rem;font-weight:700;background:rgba(0,0,0,0.2);padding:0.4rem;border-radius:10px;margin:0.5rem 0;">
          💰 Valor de Mercado: ${formatCurrency(player.marketValue || 0)} &nbsp;|&nbsp; 📊 Ranking: #${ranks.rank_market}
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;margin-bottom:0.5rem;">
          ${['goals','assists','saves','pig'].map(key => {
            const labelMap = { goals:'Goles', assists:'Asisten', saves:'Salv', pig:'PIG' };
            const iconMap = { goals:'⚽', assists:'🎯', saves:'🧤', pig:'📊' };
            const rankKey = key === 'pig' ? 'rank_pig' : `rank_${key}`;
            const val = key === 'pig' ? (stats[key]||0).toFixed(1) : stats[key]||0;
            return `
              <div style="background:rgba(0,0,0,0.2);padding:0.5rem 0.3rem;border-radius:10px;text-align:center;">
                <div style="font-size:1.2rem;font-weight:900;">${iconMap[key]} ${val}</div>
                <div style="font-size:0.55rem;color:#94a3b8;">${labelMap[key]} · <span style="color:#ffd700;">#${ranks[rankKey]||0}</span></div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top:0.5rem;font-size:0.55rem;color:#94a3b8;text-align:center;">${torneo.name} · Generado desde MTM Nexus</div>
      </div>
    `;

    showPrintModal(printHtml, `perfil_${player.name.replace(/[^a-zA-Z0-9]/g,'_')}.jpg`, 700);
  }

  // ==========================================
  // IMPRESIÓN
  // ==========================================
  function getPrintHeader(title) {
    const logoImg = document.getElementById('logoImage');
    const logoUrl = logoImg.style.display !== 'none' && logoImg.src ? logoImg.src : '';
    const leagueName = document.getElementById('brandTitle').innerText || 'LIGA DOMINIO MX';
    return `
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.5rem;border-bottom:2px solid #2d2d44;padding-bottom:0.5rem;">
        ${logoUrl ? `<img src="${logoUrl}" style="width:50px;height:50px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;" />` : ''}
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:1.2rem;color:var(--neon-purple);">${leagueName}</div>
          <div style="font-size:0.8rem;color:#94a3b8;">${title}</div>
        </div>
      </div>
    `;
  }

  function showPrintModalIOS(htmlContent, filename) {
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) { alert('Por favor, permite las ventanas emergentes para imprimir.'); return; }
      printWindow.document.write(`
        <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Imprimir - ${filename}</title>
        <style>body { background: #0a0a0f; color: #e2e8f0; font-family: Inter, system-ui, sans-serif; padding: 2rem; max-width: 900px; margin: 0 auto; } img { max-width: 100%; } table { width: 100%; border-collapse: collapse; } th, td { padding: 0.3rem 0.5rem; border: 1px solid #2d2d44; } th { background: #1e1e2f; }</style>
        </head><body>${htmlContent}<script>window.onload=function(){window.print();};<\/script></body></html>
      `);
      printWindow.document.close();
    } catch (e) { alert('Error al imprimir: ' + e.message); }
  }

  function showPrintModal(htmlContent, filename, width = 800) {
    if (isIOS() || /^((?!chrome|android).)*safari/i.test(navigator.userAgent)) { showPrintModalIOS(htmlContent, filename); return; }
    if (typeof html2canvas === 'undefined') { showPrintModalIOS(htmlContent, filename); return; }

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'fixed';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '0';
    tempDiv.style.width = width + 'px';
    tempDiv.style.background = '#0a0a0f';
    tempDiv.style.padding = '1rem';
    tempDiv.style.color = '#e2e8f0';
    tempDiv.style.fontFamily = 'Inter, system-ui, sans-serif';
    tempDiv.style.borderRadius = '8px';
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);

    html2canvas(tempDiv, {
      scale: 2,
      backgroundColor: '#0a0a0f',
      useCORS: true,
      logging: false,
      windowHeight: tempDiv.scrollHeight,
      windowWidth: tempDiv.scrollWidth
    }).then(canvas => {
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      tempDiv.remove();
      const overlay = document.createElement('div');
      overlay.className = 'print-modal-overlay';
      overlay.innerHTML = `
        <div class="print-modal">
          <h3><i class="fas fa-print"></i> Vista previa</h3>
          <div class="preview"><img src="${imgData}" style="max-width:100%;border-radius:4px;" /></div>
          <div class="actions">
            <button class="btn-cancel" onclick="this.closest('.print-modal-overlay').remove()">Cancelar</button>
            <button class="btn-download" onclick="downloadImage('${imgData}', '${filename}'); this.closest('.print-modal-overlay').remove();">Descargar</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
    }).catch(err => {
      tempDiv.remove();
      showPrintModalIOS(htmlContent, filename);
    });
  }

  function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  // ==========================================
  // CARGA DE DATOS
  // ==========================================
  async function loadAllData() {
    try {
      const resp1 = await fetch('datos.json?t=' + Date.now());
      if (!resp1.ok) throw new Error('No se pudo cargar datos.json (1ª División)');
      data1 = await resp1.json();
      if (data1.tournaments && Array.isArray(data1.tournaments) && data1.tournaments.length) {
        data1 = data1.tournaments[0];
      }
    } catch (e) {
      errorContainer.style.display = 'block';
      errorMessage.textContent = 'Error al cargar datos.json: ' + e.message;
      return;
    }

    try {
      const resp2 = await fetch('datos2.json?t=' + Date.now());
      if (resp2.ok) {
        data2 = await resp2.json();
        if (data2.tournaments && Array.isArray(data2.tournaments) && data2.tournaments.length) {
          data2 = data2.tournaments[0];
        }
      } else {
        data2 = null;
      }
    } catch (_) {
      data2 = null;
    }

    if (data1 && data2) {
      showTournamentSelector();
    } else if (data1) {
      selectTournament(1);
    } else {
      errorContainer.style.display = 'block';
      errorMessage.textContent = 'No se encontraron datos válidos.';
    }
  }

  function showTournamentSelector() {
    const selector = document.getElementById('tournament-selector');
    selector.style.display = 'flex';
    document.getElementById('selector-name1').textContent = data1.name || '1ª División';
    document.getElementById('selector-name2').textContent = data2.name || '2ª División';
    document.getElementById('selector-info1').textContent = `${data1.teams?.length || 0} equipos`;
    document.getElementById('selector-info2').textContent = `${data2.teams?.length || 0} equipos`;
    const logo1 = document.getElementById('selector-logo1');
    const logo2 = document.getElementById('selector-logo2');
    logo1.src = data1.logo || '';
    logo2.src = data2.logo || '';
    logo1.onerror = function() { this.style.display = 'none'; };
    logo2.onerror = function() { this.style.display = 'none'; };
  }

  function selectTournament(division) {
    const selector = document.getElementById('tournament-selector');
    selector.style.display = 'none';

    if (division === 1) {
      currentData = data1;
      currentDivision = 1;
      loadLogo('logo.png', 'logo.jpg');
    } else {
      currentData = data2;
      currentDivision = 2;
      loadLogo('logo2.png', 'logo2.jpg');
    }
    applyData(currentData);
  }

  function applyData(torneo) {
    if (!torneo) return;
    rankingsCache = calculateRankings(torneo);
    const brandTitle = document.getElementById('brandTitle');
    const brandSub = document.getElementById('brandSub');
    brandTitle.innerHTML = `MTM <span>NEXUS</span>`;
    brandSub.textContent = torneo.name || 'Visualizador de Torneo';
    loadPreferences();
    buildUI(torneo);
    errorContainer.style.display = 'none';
  }

  function loadLogo(primary, secondary) {
    const img = document.getElementById('logoImage');
    const noLogo = document.getElementById('noLogoText');
    const names = [primary, secondary];
    for (let name of names) {
      if (!name) continue;
      const testImg = new Image();
      testImg.onload = function() {
        img.src = name;
        img.style.display = 'block';
        noLogo.style.display = 'none';
      };
      testImg.onerror = function() {
        img.style.display = 'none';
        noLogo.style.display = 'block';
      };
      testImg.src = name;
      break;
    }
  }

  function loadCustomThemes() {
    try {
      const saved = localStorage.getItem('mtm_custom_themes');
      if (saved) customThemes = JSON.parse(saved);
    } catch (_) { customThemes = []; }
  }

  function applyTheme(theme) {
    currentTheme = theme;
    let themeConfig = null;
    if (theme.startsWith('custom_')) {
      const id = theme.replace('custom_', '');
      themeConfig = customThemes.find(t => t.id === id);
      if (!themeConfig) { applyTheme('dominio'); return; }
    }

    try {
      if (theme === 'dominio') {
        document.documentElement.setAttribute('data-theme', 'dominio');
        document.getElementById('brandTitle').innerHTML = '<span style="color:#00a84d;">LIGA</span> <span style="color:#fff;">DOMINIO</span> <span style="color:#d32f2f;">MX</span>';
        document.getElementById('brandSub').innerHTML = '<span style="color:#00a84d;">COMPITE</span>, <span style="color:#fff;">DOMINA</span> <span style="color:#d32f2f;">Y REPITE</span>';
        loadLogo('logo.png', 'logo.jpg');
      } else if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.getElementById('brandTitle').innerHTML = 'MTM <span>NEXUS</span>';
        document.getElementById('brandSub').textContent = 'Modo Claro';
        loadLogo('logo.png', 'logo.jpg');
      } else {
        applyTheme('dominio');
        return;
      }
      localStorage.setItem('mtm_theme', theme);
    } catch (_) {}
  }

  function applyDensity(density) {
    currentDensity = density;
    document.documentElement.setAttribute('data-density', density);
    try { localStorage.setItem('mtm_density', density); } catch (_) {}
  }

  function loadPreferences() {
    loadCustomThemes();
    try {
      const savedTheme = localStorage.getItem('mtm_theme');
      if (savedTheme) applyTheme(savedTheme);
      else applyTheme('dominio');
      const savedDensity = localStorage.getItem('mtm_density');
      if (savedDensity) applyDensity(savedDensity);
      else applyDensity('normal');
    } catch (_) {
      applyTheme('dominio');
      applyDensity('normal');
    }
  }

  function goToTournamentSelector() {
    if (data1 && data2) {
      showTournamentSelector();
      sectionsContainer.innerHTML = '';
      currentData = null;
    } else {
      location.reload();
    }
  }

  // ==========================================
  // CÁLCULO DE PODER REAL POR JORNADA (EQUIPOS)
  // ==========================================
  function calculateTeamPowerAtRound(teamId, torneo, targetRound) {
    const team = getTeamById(torneo.teams, teamId);
    if (!team) return { atk: 0, def: 0, glb: 0 };

    let pigAtk = 0, pigDef = 0, formAtk = 0, formDef = 0;

    for (let r = 0; r <= targetRound; r++) {
      const round = torneo.rounds[r];
      if (!round) continue;
      round.forEach(m => {
        if (!m.played) return;
        if (m.h !== teamId && m.a !== teamId) return;
        const isHome = m.h === teamId;
        if (isHome) {
          formAtk += (m.sH - 3) * 1.5;
          formDef += (3 - m.sA) * 1.5;
        } else {
          formAtk += (m.sA - 3) * 1.5;
          formDef += (3 - m.sH) * 1.5;
        }
        formAtk = Math.max(-20, Math.min(20, formAtk));
        formDef = Math.max(-20, Math.min(20, formDef));
        if (m.stats) {
          m.stats.forEach(st => {
            if (st.tId === teamId) {
              pigAtk += (st.g || 0) * 2.0 + (st.a || 0) * 1.5;
              pigDef += (st.s || 0) * 1.0;
            }
          });
        }
      });
    }

    const activePlayers = team.players.filter(p => p.name && p.name.trim() !== '');
    let avgRankMult = 1;
    if (activePlayers.length > 0) {
      const sum = activePlayers.reduce((acc, p) => {
        const rankValue = getRankMultiplier(p.rocketRank, p.division || 2);
        return acc + rankValue;
      }, 0);
      avgRankMult = sum / activePlayers.length;
      avgRankMult = 1 + (avgRankMult - 1) * 2.0;
    }

    let baseAtk = 30 + (pigAtk / 25) + (formAtk * 1.5);
    let baseDef = 30 + (pigDef / 30) + (formDef * 1.5);
    let calcAtk = baseAtk * avgRankMult;
    let calcDef = baseDef * avgRankMult;
    calcAtk = applyPowerFrenzy(calcAtk);
    calcDef = applyPowerFrenzy(calcDef);

    const atk = Math.min(500, Math.max(10, Math.floor(calcAtk)));
    const def = Math.min(500, Math.max(10, Math.floor(calcDef)));
    const glb = Math.floor((atk + def) / 2);
    return { atk, def, glb };
  }

  // ==========================================
  // PERFORMANCE - LABELS
  // ==========================================
  function getPlayoffLabels(torneo) {
    const labels = [];
    const rounds = torneo.rounds || [];
    const totalRounds = rounds.length;

    let lastPlayedRound = -1;
    for (let i = 0; i < totalRounds; i++) {
      const round = rounds[i];
      if (round && round.some(m => m.played)) {
        lastPlayedRound = i;
      }
    }

    if (lastPlayedRound === -1) {
      labels.push({ type: 'liguilla', round: 0, label: 'J1', hasData: false, roundIdx: 0 });
      return labels;
    }

    for (let i = 0; i <= lastPlayedRound; i++) {
      const round = rounds[i];
      const hasPlayed = round && round.some(m => m.played);
      labels.push({
        type: 'liguilla',
        round: i,
        roundIdx: i,
        label: `J${i + 1}`,
        hasData: hasPlayed
      });
    }

    if (torneo.playoffs && torneo.playoffs.rounds) {
      const playoffRounds = torneo.playoffs.rounds;
      const phaseNames = ['4°tos', 'Semis', 'Final'];
      playoffRounds.forEach((round, idx) => {
        const hasPlayed = round && round.some(m => m.played);
        const phaseName = phaseNames[idx] || `PO${idx + 1}`;
        labels.push({
          type: 'playoff',
          round: idx,
          roundIdx: idx,
          label: phaseName,
          hasData: hasPlayed
        });
      });
    }

    return labels;
  }

  function calculateTeamPerformance(teamId, torneo) {
    const team = getTeamById(torneo.teams, teamId);
    if (!team) return [];

    const labels = getPlayoffLabels(torneo);
    const result = [];
    let totalGF = 0, totalGA = 0, totalSaves = 0, totalMatches = 0;

    labels.forEach((label) => {
      let gf = 0, ga = 0, saves = 0;

      if (label.type === 'liguilla') {
        const round = torneo.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && (m.h === teamId || m.a === teamId)) {
              const isHome = m.h === teamId;
              gf += isHome ? m.sH : m.sA;
              ga += isHome ? m.sA : m.sH;
              totalMatches++;
              if (m.stats) {
                m.stats.forEach(st => {
                  if (st.tId === teamId) saves += st.s || 0;
                });
              }
            }
          });
        }
      } else if (label.type === 'playoff') {
        const round = torneo.playoffs.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && (m.h === teamId || m.a === teamId)) {
              const isHome = m.h === teamId;
              gf += isHome ? m.sH : m.sA;
              ga += isHome ? m.sA : m.sH;
              totalMatches++;
              if (m.stats) {
                m.stats.forEach(st => {
                  if (st.tId === teamId) saves += st.s || 0;
                });
              }
            }
          });
        }
      }

      totalGF += gf;
      totalGA += ga;
      totalSaves += saves;

      const power = calculateTeamPowerAtRound(teamId, torneo, label.roundIdx);

      result.push({
        label: label.label,
        type: label.type,
        roundIdx: label.roundIdx,
        hasData: label.hasData,
        atk: power.atk,
        def: power.def,
        glb: power.glb,
        gf: gf,
        ga: ga,
        saves: saves,
        matches: totalMatches
      });
    });

    result.totalGF = totalGF;
    result.totalGA = totalGA;
    result.totalSaves = totalSaves;
    result.matches = totalMatches;
    return result;
  }

  function calculatePlayerPerformance(playerId, torneo) {
    const result = [];
    let totalGoals = 0, totalAssists = 0, totalSaves = 0, totalShots = 0, totalPIG = 0;
    const labels = getPlayoffLabels(torneo);

    labels.forEach((label) => {
      let goals = 0, assists = 0, saves = 0, shots = 0;

      if (label.type === 'liguilla') {
        const round = torneo.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && m.stats) {
              const stat = m.stats.find(s => s.pId === playerId);
              if (stat) {
                goals += stat.g || 0;
                assists += stat.a || 0;
                saves += stat.s || 0;
                shots += stat.t || 0;
              }
            }
          });
        }
      } else if (label.type === 'playoff') {
        const round = torneo.playoffs.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && m.stats) {
              const stat = m.stats.find(s => s.pId === playerId);
              if (stat) {
                goals += stat.g || 0;
                assists += stat.a || 0;
                saves += stat.s || 0;
                shots += stat.t || 0;
              }
            }
          });
        }
      }

      const pig = (goals * 2) + (assists * 1.5) + (saves * 1) + ((shots - goals) * 0.2);
      totalGoals += goals;
      totalAssists += assists;
      totalSaves += saves;
      totalShots += shots;
      totalPIG += pig;

      result.push({
        label: label.label,
        type: label.type,
        roundIdx: label.roundIdx,
        hasData: label.hasData,
        goals: goals,
        assists: assists,
        saves: saves,
        shots: shots,
        pig: pig
      });
    });

    result.totalGoals = totalGoals;
    result.totalAssists = totalAssists;
    result.totalSaves = totalSaves;
    result.totalShots = totalShots;
    result.totalPIG = totalPIG;
    return result;
  }

  function calculatePlayerMarketValueHistory(playerId, torneo) {
    const history = [];
    const labels = getPlayoffLabels(torneo);
    let accumulatedStats = { goals: 0, assists: 0, saves: 0, shots: 0, matches: 0 };
    let pigHistory = [];

    let player = null, team = null;
    for (let tm of torneo.teams) {
      const found = tm.players.find(p => p.id === playerId);
      if (found) { player = found; team = tm; break; }
    }
    if (!player || !team) return history;

    const basePlayer = JSON.parse(JSON.stringify(player));
    const baseTeam = JSON.parse(JSON.stringify(team));

    labels.forEach((label) => {
      let goals = 0, assists = 0, saves = 0, shots = 0, matches = 0;

      if (label.type === 'liguilla') {
        const round = torneo.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && m.stats) {
              const stat = m.stats.find(s => s.pId === playerId);
              if (stat) {
                goals += stat.g || 0;
                assists += stat.a || 0;
                saves += stat.s || 0;
                shots += stat.t || 0;
                matches++;
              }
            }
          });
        }
      } else if (label.type === 'playoff') {
        const round = torneo.playoffs.rounds[label.round];
        if (round) {
          round.forEach(m => {
            if (m.played && m.stats) {
              const stat = m.stats.find(s => s.pId === playerId);
              if (stat) {
                goals += stat.g || 0;
                assists += stat.a || 0;
                saves += stat.s || 0;
                shots += stat.t || 0;
                matches++;
              }
            }
          });
        }
      }

      accumulatedStats.goals += goals;
      accumulatedStats.assists += assists;
      accumulatedStats.saves += saves;
      accumulatedStats.shots += shots;
      accumulatedStats.matches += matches;

      const pig = (accumulatedStats.goals * 2) + (accumulatedStats.assists * 1.5) + (accumulatedStats.saves * 1) + ((accumulatedStats.shots - accumulatedStats.goals) * 0.2);
      pigHistory.push(pig);

      const marketValue = calculateMarketValueFromStats(basePlayer, baseTeam, accumulatedStats, pigHistory);

      history.push({
        label: label.label,
        type: label.type,
        roundIdx: label.roundIdx,
        marketValue: marketValue,
        pig: pig,
        matches: accumulatedStats.matches,
        goals: accumulatedStats.goals,
        assists: accumulatedStats.assists,
        saves: accumulatedStats.saves,
        shots: accumulatedStats.shots
      });
    });

    return history;
  }

  function getBasePrice(rank, division) {
    const BASE_PRICES = {
      'Bronce': { 1: 300, 2: 500, 3: 700 },
      'Plata': { 1: 800, 2: 1200, 3: 2000 },
      'Oro': { 1: 2500, 2: 3500, 3: 5000 },
      'Platino': { 1: 6000, 2: 8000, 3: 10000 },
      'Diamante': { 1: 15000, 2: 18000, 3: 22000 },
      'Campeón': { 1: 25000, 2: 40000, 3: 60000 },
      'Gran Campeón': { 1: 90000, 2: 120000, 3: 160000 },
      'SSL': { 1: 250000, 2: 250000, 3: 250000 }
    };
    return BASE_PRICES[rank]?.[division] || 5000;
  }

  function calculateMarketValueFromStats(player, team, stats, pigHistory) {
    if (!player || !team) return 5000;

    const { goals, assists, saves, shots } = stats;
    const effectivePig = (goals * 2) + (assists * 1.5) + (saves * 1) + ((shots - goals) * 0.2);

    const basePrice = getBasePrice(player.rocketRank, player.division || 2);
    const ROLE_MULTIPLIER = { 'Titular 🌟': 1.4, 'Suplente 🔄': 0.9, 'Reserva 💤': 0.6 };
    let roleFactor = player.isCaptain ? 1.8 : (ROLE_MULTIPLIER[player.role] || 0.6);

    let sanctionPenalty = 0;
    if (player.sanctions) {
      const active = player.sanctions.filter(s => s.active);
      if (active.some(s => s.type === 'red' || s.type === 'suspension')) sanctionPenalty = -0.30;
      else if (active.some(s => s.type === 'yellow')) sanctionPenalty = -0.10;
    }
    roleFactor = Math.max(0.1, roleFactor + sanctionPenalty);

    const avgPIG = pigHistory.length > 0 ? pigHistory.reduce((a,b) => a+b, 0) / pigHistory.length : 0;
    const last5 = pigHistory.slice(-5);
    const avgLast5 = last5.length > 0 ? last5.reduce((a,b) => a+b, 0) / last5.length : 0;
    let streakPenalty = 0;
    if (last5.length >= 3 && avgLast5 < avgPIG * 0.5) streakPenalty = -0.20;
    else if (last5.length >= 3 && avgLast5 < avgPIG * 0.7) streakPenalty = -0.10;
    roleFactor = Math.max(0.1, roleFactor + streakPenalty);

    const pigValue = effectivePig * 25000;
    const goalValue = goals * 40000;
    const assistValue = assists * 25000;
    const saveValue = saves * 20000;
    const dangerValue = (goals + assists + shots) * 10000;

    let performanceValue = (pigValue * 0.5) + (goalValue * 0.15) + (assistValue * 0.1) +
                          (saveValue * 0.05) + (dangerValue * 0.05);
    const consistencyMultiplier = 1 + (avgPIG / 1000);
    performanceValue *= consistencyMultiplier;

    const rankValue = getRankMultiplier(player.rocketRank, player.division || 2);
    const rankFactor = 0.5 + (rankValue / 2);

    let category = 0.3;
    if (effectivePig > 200) category = 3.0;
    else if (effectivePig > 150) category = 2.5;
    else if (effectivePig > 100) category = 2.0;
    else if (effectivePig > 75) category = 1.6;
    else if (effectivePig > 50) category = 1.3;
    else if (effectivePig > 30) category = 1.0;
    else if (effectivePig > 15) category = 0.7;
    else if (effectivePig > 5) category = 0.5;

    const glb = team.glb || 50;
    let visibility = 0.6;
    if (glb >= 450) visibility = 2.0;
    else if (glb >= 350) visibility = 1.7;
    else if (glb >= 250) visibility = 1.4;
    else if (glb >= 150) visibility = 1.1;
    else if (glb >= 100) visibility = 0.9;
    else if (glb >= 70) visibility = 0.7;

    let marketValue = (basePrice * roleFactor * visibility) +
                      (performanceValue * rankFactor * roleFactor * category * visibility);
    const minPrice = basePrice * 0.5;
    marketValue = Math.max(minPrice, Math.min(20000000, marketValue));

    return Math.round(marketValue / 100) * 100;
  }

  // ==========================================
  // DIBUJO DE GRÁFICO
  // ==========================================
  function drawPerformanceChart(canvasId, data, type, labels, visibleLines) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const parentRect = canvas.parentElement.getBoundingClientRect();
    let width = Math.min((parentRect.width || 800) - 40, 850);
    if (width < 200) width = 700;
    const height = 280;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (!data || data.length === 0 || !labels || labels.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Sin datos disponibles', width / 2, height / 2);
      return;
    }

    const alignedData = labels.map((label, idx) => {
      const entry = data[idx] || {};
      return {
        label: label.label,
        type: label.type,
        roundIdx: label.roundIdx !== undefined ? label.roundIdx : idx,
        hasData: label.hasData,
        goals: entry.goals || 0,
        assists: entry.assists || 0,
        saves: entry.saves || 0,
        shots: entry.shots || 0,
        pig: entry.pig || 0,
        atk: entry.atk || 0,
        def: entry.def || 0,
        glb: entry.glb || 0,
        marketValue: entry.marketValue || 0
      };
    });

    let maxVal = 0;
    let maxValMarket = 0;
    alignedData.forEach(d => {
      if (type === 'equipo') {
        maxVal = Math.max(maxVal, d.atk || 0, d.def || 0, d.glb || 0);
      } else {
        maxVal = Math.max(maxVal, d.goals || 0, d.assists || 0, d.saves || 0, d.shots || 0, d.pig || 0);
        maxValMarket = Math.max(maxValMarket, d.marketValue || 0);
      }
    });

    maxVal = maxVal * 1.15;
    if (maxVal < 10) maxVal = 10;
    maxVal = Math.ceil(maxVal / 5) * 5;
    maxValMarket = maxValMarket * 1.15;
    if (maxValMarket > 0 && maxValMarket < 10000) maxValMarket = 10000;
    maxValMarket = Math.ceil(maxValMarket / 1000) * 1000;

    const padding = { top: 20, bottom: 35, left: 45, right: 65 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(type === 'equipo' ? 'EQUIPO' : 'JUGADOR', padding.left, 14);

    const legendColors = {
      'goals': '#4ade80', 'assists': '#22d3ee', 'saves': '#ec4899',
      'shots': '#facc15', 'pig': '#a855f7', 'marketValue': '#ff6b6b',
      'atk': '#4ade80', 'def': '#f87171', 'glb': '#ffffff'
    };
    const legendLabels = {
      'goals': '⚽ Goles', 'assists': '🎯 Asist', 'saves': '🧤 Salv',
      'shots': '💀 Tiros', 'pig': '📊 PIG', 'marketValue': '💰 Valor',
      'atk': '⚡ ATK', 'def': '🛡️ DEF', 'glb': '⭐ GLB'
    };

    const keys = type === 'equipo' ? ['atk', 'def', 'glb'] : ['goals', 'assists', 'saves', 'shots', 'pig', 'marketValue'];
    let legendItems = [];
    keys.forEach(key => {
      if (visibleLines[key]) legendItems.push({ key, color: legendColors[key], label: legendLabels[key] });
    });

    legendItems.forEach((item, i) => {
      const xPos = padding.left + 10 + i * 78;
      ctx.fillStyle = item.color;
      ctx.fillRect(xPos, 8, 14, 3);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '8px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(item.label, xPos + 18, 12);
    });

    ctx.strokeStyle = 'rgba(45,45,68,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal - (i / 5) * maxVal), padding.left - 6, y + 3);
    }

    if (type !== 'equipo' && visibleLines.marketValue && maxValMarket > 0) {
      ctx.strokeStyle = 'rgba(255,107,107,0.2)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (i / 5) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(width - padding.right + 5, y);
        ctx.lineTo(width - padding.right + 10, y);
        ctx.stroke();
        ctx.fillStyle = '#ff6b6b';
        ctx.font = '8px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(formatCurrency(maxValMarket - (i / 5) * maxValMarket), width - padding.right + 12, y + 3);
      }
    }

    ctx.strokeStyle = 'rgba(45,45,68,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartHeight);
    ctx.lineTo(width - padding.right, padding.top + chartHeight);
    ctx.stroke();

    const totalPoints = alignedData.length;
    alignedData.forEach((d, i) => {
      const x = padding.left + (i / (totalPoints - 1 || 1)) * chartWidth;
      const isPlayoff = d.type === 'playoff';
      ctx.fillStyle = isPlayoff ? '#facc15' : '#94a3b8';
      ctx.font = isPlayoff ? 'bold 8px Inter, sans-serif' : '8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.label, x, padding.top + chartHeight + 16);

      if (isPlayoff && i > 0 && alignedData[i-1].type === 'liguilla') {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    const allPoints = [];
    const hitBoxes = [];

    const drawLineWithPoints = (key, color, useRightScale = false, yOffset = 0) => {
      if (!visibleLines[key]) return;
      const hasData = alignedData.some(d => d[key] > 0);
      if (!hasData) return;

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);

      const points = [];
      alignedData.forEach((d, i) => {
        const x = padding.left + (i / (totalPoints - 1 || 1)) * chartWidth;
        const val = typeof d[key] === 'number' ? d[key] : 0;
        let y;
        if (useRightScale && maxValMarket > 0) {
          y = padding.top + chartHeight - (val / maxValMarket) * chartHeight;
        } else {
          y = padding.top + chartHeight - (val / maxVal) * chartHeight;
        }
        y += yOffset;
        points.push({
          x, y, val,
          label: d.label,
          roundIdx: d.roundIdx,
          type: d.type,
          data: d,
          key: key
        });
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      points.forEach((p) => {
        if (p.val > 0 || key === 'marketValue') {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        allPoints.push(p);
        hitBoxes.push({ x: p.x, y: p.y, data: p });
      });
    };

    if (type === 'equipo') {
      const allSame = alignedData.every(d => d.atk === d.def && d.def === d.glb && d.atk > 0);
      if (allSame) {
        drawLineWithPoints('atk', '#4ade80', false, -3);
        drawLineWithPoints('def', '#f87171', false, 0);
        drawLineWithPoints('glb', '#ffffff', false, 3);
      } else {
        drawLineWithPoints('atk', '#4ade80', false, 0);
        drawLineWithPoints('def', '#f87171', false, 0);
        drawLineWithPoints('glb', '#ffffff', false, 0);
      }
    } else {
      drawLineWithPoints('goals', '#4ade80', false);
      drawLineWithPoints('assists', '#22d3ee', false);
      drawLineWithPoints('saves', '#ec4899', false);
      drawLineWithPoints('shots', '#facc15', false);
      drawLineWithPoints('pig', '#a855f7', false);
      if (visibleLines.marketValue) {
        drawLineWithPoints('marketValue', '#ff6b6b', true);
      }
    }

    canvas._chartPoints = allPoints;
    canvas._hitBoxes = hitBoxes;
    canvas._type = type;
    canvas._labels = labels;
    canvas._torneo = currentData;
    canvas._teamId = type === 'equipo' ? perfSelectedTeamId : null;
    canvas._playerId = type === 'jugador' ? perfSelectedPlayerId : null;
    canvas._maxVal = maxVal;
    canvas._maxValMarket = maxValMarket;
    canvas._padding = padding;
    canvas._chartWidth = chartWidth;
    canvas._chartHeight = chartHeight;
    canvas._width = width;
    canvas._height = height;
  }

  // ==========================================
  // TOOLTIP (CORREGIDO: detección por X)
  // ==========================================
  function setupTooltip(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const tooltip = document.getElementById('perf-tooltip');
    let tooltipTimeout = null;

    function getCanvasCoords(e) {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || e.touches?.[0]?.clientX || 0;
      const clientY = e.clientY || e.touches?.[0]?.clientY || 0;
      // El canvas tiene style.width en px CSS, así que rect.left/width también están en px CSS.
      // Las coordenadas p.x/p.y de los puntos también están en px CSS (porque ctx.scale(dpr, dpr)).
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return { x, y, clientX, clientY };
    }

    function showTooltip(e) {
      const coords = getCanvasCoords(e);
      const points = canvas._chartPoints || [];

      if (points.length === 0) {
        tooltip.style.display = 'none';
        return;
      }

      // Filtrar solo por proximidad en X. Elegir el más cercano por |dx|.
      let closest = null;
      let minDx = Infinity;
      for (const p of points) {
        const dx = Math.abs(p.x - coords.x);
        if (dx < minDx) {
          minDx = dx;
          closest = p;
        }
      }

      // Umbral de 30px en X. Si no hay candidato cercano, ocultar.
      if (!closest || minDx > 30) {
        tooltip.style.display = 'none';
        return;
      }

      const type = canvas._type || 'equipo';
      const torneo = canvas._torneo || currentData;

      tooltip.style.display = 'block';
      let left = coords.clientX + 15;
      let top = coords.clientY - 10;
      if (left + 300 > window.innerWidth) left = coords.clientX - 300;
      if (top + 220 > window.innerHeight) top = window.innerHeight - 220;
      if (top < 10) top = 10;
      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';

      document.getElementById('tooltip-jornada').textContent = closest.label || '';

      let statsHtml = '';
      const d = closest.data || {};
      if (type === 'equipo') {
        statsHtml = `
          <div>⚡ ATK: ${d.atk || 0}</div>
          <div>🛡️ DEF: ${d.def || 0}</div>
          <div>⭐ GLB: ${d.glb || 0}</div>
        `;
      } else {
        statsHtml = `
          <div>⚽ Goles: ${d.goals || 0}</div>
          <div>🎯 Asistencias: ${d.assists || 0}</div>
          <div>🧤 Salvadas: ${d.saves || 0}</div>
          <div>💀 Tiros: ${d.shots || 0}</div>
          <div>📊 PIG: ${(d.pig || 0).toFixed(1)}</div>
          ${d.marketValue !== undefined && d.marketValue > 0 ? `<div>💰 Valor: ${formatCurrency(d.marketValue)}</div>` : ''}
        `;
      }
      document.getElementById('tooltip-stats').innerHTML = statsHtml;

      let matchHtml = 'Sin partido en esta jornada';
      if (torneo && closest.roundIdx !== undefined && closest.roundIdx !== null) {
        let match = null;
        if (closest.type === 'liguilla') {
          const round = torneo.rounds && torneo.rounds[closest.roundIdx];
          if (round) {
            if (type === 'equipo') {
              match = round.find(m => m.played && (m.h === canvas._teamId || m.a === canvas._teamId));
            } else {
              const playerId = canvas._playerId;
              for (let tm of torneo.teams) {
                if (tm.players.some(p => p.id === playerId)) {
                  match = round.find(m => m.played && (m.h === tm.id || m.a === tm.id));
                  break;
                }
              }
            }
          }
        } else if (closest.type === 'playoff' && torneo.playoffs && torneo.playoffs.rounds) {
          const round = torneo.playoffs.rounds[closest.roundIdx];
          if (round) {
            if (type === 'equipo') {
              match = round.find(m => m.played && (m.h === canvas._teamId || m.a === canvas._teamId));
            } else {
              const playerId = canvas._playerId;
              for (let tm of torneo.teams) {
                if (tm.players.some(p => p.id === playerId)) {
                  match = round.find(m => m.played && (m.h === tm.id || m.a === tm.id));
                  break;
                }
              }
            }
          }
        }
        if (match) {
          const h = getTeamById(torneo.teams, match.h);
          const a = getTeamById(torneo.teams, match.a);
          matchHtml = `${h?.name || '?'} ${match.sH} - ${match.sA} ${a?.name || '?'}`;
        }
      }
      document.getElementById('tooltip-match').textContent = matchHtml;
    }

    function hideTooltip() {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => {
        tooltip.style.display = 'none';
      }, 200);
    }

    canvas.addEventListener('mousemove', function(e) {
      if (tooltipTimeout) clearTimeout(tooltipTimeout);
      showTooltip(e);
    });
    canvas.addEventListener('mouseleave', hideTooltip);

    canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, touches: e.touches };
        showTooltip(fakeEvent);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', function(e) {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY, touches: e.touches };
        showTooltip(fakeEvent);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', hideTooltip, { passive: true });
  }

  // ==========================================
  // RENDERIZADO PERFORMANCE - EQUIPOS
  // ==========================================
  function renderPerformanceEquipos() {
    const torneo = currentData;
    if (!torneo) return;

    const listContainer = document.getElementById('perf-equipo-list');
    if (!listContainer) return;

    if (!torneo.teams || torneo.teams.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No hay equipos.</div>';
      return;
    }

    const scrollPos = listContainer.scrollTop;

    if (!perfSelectedTeamId || !torneo.teams.find(t => t.id === perfSelectedTeamId)) {
      perfSelectedTeamId = torneo.teams[0]?.id || null;
    }

    listContainer.innerHTML = torneo.teams.map(t => `
      <div class="list-item ${t.id === perfSelectedTeamId ? 'active' : ''}"
           onclick="selectPerformanceEquipo('${t.id}')">
        <img src="${t.shield || ''}" style="width:1.2rem;height:1.2rem;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;margin-right:0.3rem;">
        ${t.name} <span style="margin-left:auto;font-size:0.6rem;color:var(--neon-yellow);">${t.glb || 0}</span>
      </div>
    `).join('');

    listContainer.scrollTop = scrollPos;

    const team = getTeamById(torneo.teams, perfSelectedTeamId);
    if (team) {
      const labels = getPlayoffLabels(torneo);
      const data = calculateTeamPerformance(perfSelectedTeamId, torneo);

      // PEAKS REALES: iterar sobre data para encontrar el valor máximo histórico
      let atkPeak = { value: 0, label: '—' };
      let defPeak = { value: 0, label: '—' };
      let glbPeak = { value: 0, label: '—' };
      data.forEach((d, i) => {
        const lbl = labels[i]?.label || '—';
        if (d.atk > atkPeak.value) atkPeak = { value: d.atk, label: lbl };
        if (d.def > defPeak.value) defPeak = { value: d.def, label: lbl };
        if (d.glb > glbPeak.value) glbPeak = { value: d.glb, label: lbl };
      });

      const visibleLines = {
        atk: document.getElementById('perf-show-atk')?.checked !== false,
        def: document.getElementById('perf-show-def')?.checked !== false,
        glb: document.getElementById('perf-show-glb')?.checked !== false
      };

      const matches = data.matches || 0;
      const gf = data.totalGF || 0;
      const ga = data.totalGA || 0;
      const saves = data.totalSaves || 0;
      const avgGF = matches > 0 ? (gf / matches).toFixed(2) : '0.00';
      const avgGA = matches > 0 ? (ga / matches).toFixed(2) : '0.00';
      const avgSaves = matches > 0 ? (saves / matches).toFixed(2) : '0.00';

      const statsHtml = `
        <div class="perf-stats-grid">
          <div class="stat-box">
            <div class="icon">🏟️</div>
            <div class="label">Partidos</div>
            <div class="value">${matches}</div>
          </div>
          <div class="stat-box">
            <div class="icon">⚽</div>
            <div class="label">Goles Favor</div>
            <div class="value" style="color:var(--neon-green);">${gf}</div>
          </div>
          <div class="stat-box">
            <div class="icon">🥅</div>
            <div class="label">Goles Contra</div>
            <div class="value" style="color:var(--neon-red);">${ga}</div>
          </div>
          <div class="stat-box">
            <div class="icon">🧤</div>
            <div class="label">Salvadas</div>
            <div class="value" style="color:var(--neon-pink);">${saves}</div>
          </div>
        </div>
        <div class="perf-peaks">
          <div class="peak-item peak-atk">
            <div class="peak-header"><span class="peak-icon">⚡</span> ATK Peak</div>
            <div class="peak-value" style="color:var(--neon-green);">${atkPeak.value}</div>
            <div class="peak-label">Alcanzado en ${atkPeak.label}</div>
          </div>
          <div class="peak-item peak-def">
            <div class="peak-header"><span class="peak-icon">🛡️</span> DEF Peak</div>
            <div class="peak-value" style="color:var(--neon-red);">${defPeak.value}</div>
            <div class="peak-label">Alcanzado en ${defPeak.label}</div>
          </div>
          <div class="peak-item peak-glb">
            <div class="peak-header"><span class="peak-icon">⭐</span> GLB Peak</div>
            <div class="peak-value" style="color:#ffffff;">${glbPeak.value}</div>
            <div class="peak-label">Alcanzado en ${glbPeak.label}</div>
          </div>
          <div class="peak-item peak-neutral">
            <div class="peak-header"><span class="peak-icon">📊</span> Prom. GF</div>
            <div class="peak-value" style="color:var(--neon-green);">${avgGF}</div>
            <div class="peak-label">Goles a favor por partido</div>
          </div>
          <div class="peak-item peak-neutral">
            <div class="peak-header"><span class="peak-icon">📉</span> Prom. GC</div>
            <div class="peak-value" style="color:var(--neon-red);">${avgGA}</div>
            <div class="peak-label">Goles en contra por partido</div>
          </div>
          <div class="peak-item peak-neutral">
            <div class="peak-header"><span class="peak-icon">🧤</span> Prom. Salv</div>
            <div class="peak-value" style="color:var(--neon-pink);">${avgSaves}</div>
            <div class="peak-label">Salvadas por partido</div>
          </div>
        </div>
      `;
      document.getElementById('perf-equipo-stats').innerHTML = statsHtml;

      requestAnimationFrame(() => {
        setTimeout(() => {
          drawPerformanceChart('perf-equipo-chart', data, 'equipo', labels, visibleLines);
          setupTooltip('perf-equipo-chart');
        }, 30);
      });
    }
  }

  // ==========================================
  // RENDERIZADO PERFORMANCE - JUGADORES
  // ==========================================
  function renderPerformanceJugadores() {
    const torneo = currentData;
    if (!torneo) return;

    const listContainer = document.getElementById('perf-jugador-list');
    if (!listContainer) return;

    if (!torneo.teams || torneo.teams.length === 0) {
      listContainer.innerHTML = '<div class="empty-state">No hay jugadores.</div>';
      return;
    }

    const scrollPos = listContainer.scrollTop;

    let listHtml = '';
    torneo.teams.forEach(t => {
      const players = t.players.filter(p => p.name && p.name.trim() !== '');
      if (players.length === 0) return;
      listHtml += `
        <div class="perf-team-header">
          <img src="${t.shield || ''}">
          ${t.name}
        </div>
      `;
      players.forEach(p => {
        const active = p.id === perfSelectedPlayerId ? 'active' : '';
        const pig = p.seasonStats?.pig || 0;
        listHtml += `
          <div class="list-item sub-item ${active}" onclick="selectPerformancePlayer('${p.id}')">
            ${p.isCaptain ? '👑' : ''}
            <span>${p.name}</span>
            <span style="margin-left:auto;font-size:0.6rem;color:var(--neon-yellow);">${pig.toFixed(1)}</span>
          </div>
        `;
      });
    });
    listContainer.innerHTML = listHtml;

    if (!perfSelectedPlayerId || !getPlayerById(torneo, perfSelectedPlayerId)) {
      let firstPlayerWithData = null;
      for (let team of torneo.teams) {
        for (let player of team.players) {
          if (player.name && player.name.trim() !== '') {
            if (player.seasonStats && (player.seasonStats.matchesPlayed > 0 || player.seasonStats.pig > 0)) {
              firstPlayerWithData = player;
              break;
            }
            if (!firstPlayerWithData) firstPlayerWithData = player;
          }
        }
        if (firstPlayerWithData && firstPlayerWithData.seasonStats?.matchesPlayed > 0) break;
      }
      if (firstPlayerWithData) perfSelectedPlayerId = firstPlayerWithData.id;
    }

    listContainer.scrollTop = scrollPos;

    if (perfSelectedPlayerId) {
      const playerContent = document.getElementById('perf-jugadores-content');
      if (playerContent && !playerContent.classList.contains('active')) {
        playerContent.classList.add('active');
      }

      const labels = getPlayoffLabels(torneo);
      const data = calculatePlayerPerformance(perfSelectedPlayerId, torneo);
      const marketData = calculatePlayerMarketValueHistory(perfSelectedPlayerId, torneo);

      const combinedData = data.map((d, idx) => {
        const market = marketData[idx] || { marketValue: 0 };
        return { ...d, marketValue: market.marketValue || 0 };
      });

      // PEAKS REALES para jugadores
      let pigPeak = { value: 0, label: '—' };
      let valuePeak = { value: 0, label: '—' };
      let valueMin = { value: Infinity, label: '—' };

      combinedData.forEach((d, i) => {
        const lbl = labels[i]?.label || '—';
        if (d.pig > pigPeak.value) { pigPeak.value = d.pig; pigPeak.label = lbl; }
        if (d.marketValue > valuePeak.value) { valuePeak.value = d.marketValue; valuePeak.label = lbl; }
        if (d.marketValue < valueMin.value && d.marketValue > 0) { valueMin.value = d.marketValue; valueMin.label = lbl; }
      });

      const visibleLines = {
        goals: document.getElementById('perf-show-goals')?.checked !== false,
        assists: document.getElementById('perf-show-assists')?.checked !== false,
        saves: document.getElementById('perf-show-saves')?.checked !== false,
        shots: document.getElementById('perf-show-shots')?.checked !== false,
        pig: document.getElementById('perf-show-pig')?.checked !== false,
        marketValue: document.getElementById('perf-show-value')?.checked !== false
      };

      const totalRounds = labels.length || 1;
      const totals = data;
      const avgGoals = (totals.totalGoals / totalRounds).toFixed(2);
      const avgAssists = (totals.totalAssists / totalRounds).toFixed(2);
      const avgSaves = (totals.totalSaves / totalRounds).toFixed(2);
      const avgShots = (totals.totalShots / totalRounds).toFixed(2);

      const statsHtml = `
        <div class="perf-stats-grid">
          <div class="stat-box">
            <div class="icon">⚽</div>
            <div class="label">Prom. Goles</div>
            <div class="value" style="color:var(--neon-green);">${avgGoals}</div>
          </div>
          <div class="stat-box">
            <div class="icon">🎯</div>
            <div class="label">Prom. Asistencias</div>
            <div class="value" style="color:var(--neon-cyan);">${avgAssists}</div>
          </div>
          <div class="stat-box">
            <div class="icon">🧤</div>
            <div class="label">Prom. Salvadas</div>
            <div class="value" style="color:var(--neon-pink);">${avgSaves}</div>
          </div>
          <div class="stat-box">
            <div class="icon">💀</div>
            <div class="label">Prom. Tiros</div>
            <div class="value" style="color:var(--neon-yellow);">${avgShots}</div>
          </div>
        </div>
        <div class="perf-peaks">
          <div class="peak-item peak-pig">
            <div class="peak-header"><span class="peak-icon">📊</span> PIG Peak</div>
            <div class="peak-value" style="color:var(--neon-yellow);">${pigPeak.value.toFixed(1)}</div>
            <div class="peak-label">Alcanzado en ${pigPeak.label}</div>
          </div>
          ${valuePeak.value > 0 ? `
          <div class="peak-item peak-value">
            <div class="peak-header"><span class="peak-icon">💰</span> Valor Peak</div>
            <div class="peak-value" style="color:#ff6b6b;">${formatCurrency(valuePeak.value)}</div>
            <div class="peak-label">Alcanzado en ${valuePeak.label}</div>
          </div>` : ''}
          ${valueMin.value < Infinity ? `
          <div class="peak-item peak-min">
            <div class="peak-header"><span class="peak-icon">📉</span> Valor Mín</div>
            <div class="peak-value" style="color:var(--neon-cyan);">${formatCurrency(valueMin.value)}</div>
            <div class="peak-label">Registrado en ${valueMin.label}</div>
          </div>` : ''}
        </div>
      `;
      document.getElementById('perf-jugador-stats').innerHTML = statsHtml;

      requestAnimationFrame(() => {
        setTimeout(() => {
          drawPerformanceChart('perf-jugador-chart', combinedData, 'jugador', labels, visibleLines);
          setupTooltip('perf-jugador-chart');
        }, 50);
      });
    }
  }

  function refreshPerfChart(type) {
    if (type === 'equipo') {
      renderPerformanceEquipos();
    } else {
      renderPerformanceJugadores();
    }
  }

  function selectPerformanceEquipo(teamId) {
    if (perfSelectedTeamId === teamId) return;
    perfSelectedTeamId = teamId;
    renderPerformanceEquipos();
  }

  function selectPerformancePlayer(playerId) {
    if (perfSelectedPlayerId === playerId) return;
    perfSelectedPlayerId = playerId;
    renderPerformanceJugadores();
  }

  function switchPerfTab(tab) {
    perfCurrentTab = tab;
    document.querySelectorAll('.perf-tabs button').forEach(b => b.classList.remove('active'));
    document.querySelector(`.perf-tabs button[data-tab="${tab}"]`)?.classList.add('active');
    document.querySelectorAll('.perf-sub-view').forEach(v => v.classList.remove('active'));

    if (tab === 'equipos') {
      document.getElementById('perf-equipos-content').classList.add('active');
      document.getElementById('perf-title').textContent = 'Equipos';
      renderPerformanceEquipos();
    } else {
      document.getElementById('perf-jugadores-content').classList.add('active');
      document.getElementById('perf-title').textContent = 'Jugadores';
      renderPerformanceJugadores();
    }
  }

  function printPerformance() {
    const torneo = currentData;
    if (!torneo) return alert('No hay datos.');
    const tab = perfCurrentTab || 'equipos';
    const title = tab === 'equipos' ? 'Equipos' : 'Jugadores';

    let htmlContent = getPrintHeader(`Performance - ${title}`);

    if (tab === 'equipos') {
      const team = getTeamById(torneo.teams, perfSelectedTeamId);
      if (!team) return alert('No hay equipo seleccionado.');
      const data = calculateTeamPerformance(perfSelectedTeamId, torneo);
      const labels = getPlayoffLabels(torneo);

      const matches = data.matches || 0;
      const gf = data.totalGF || 0;
      const ga = data.totalGA || 0;
      const saves = data.totalSaves || 0;

      htmlContent += `
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
          <img src="${team.shield || ''}" style="width:60px;height:60px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;">
          <div>
            <div style="font-weight:900;font-size:1.2rem;">${team.name}</div>
            <div style="font-size:0.7rem;color:#94a3b8;">GLB ${team.glb || 0} · ATK ${team.atk || 0} · DEF ${team.def || 0}</div>
          </div>
        </div>
        <div style="font-size:0.7rem;color:#94a3b8;">
          Partidos: ${matches} · GF: ${gf} · GC: ${ga} · Salvadas: ${saves}
        </div>
      `;
    } else {
      let player = null, team = null;
      for (let tm of torneo.teams) {
        const found = tm.players.find(p => p.id === perfSelectedPlayerId);
        if (found) { player = found; team = tm; break; }
      }
      if (!player) return alert('No hay jugador seleccionado.');
      const data = calculatePlayerPerformance(perfSelectedPlayerId, torneo);
      const labels = getPlayoffLabels(torneo);

      htmlContent += `
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
          <img src="${team?.shield || ''}" style="width:60px;height:60px;border-radius:50%;background:#000;border:1px solid #2d2d44;object-fit:contain;">
          <div>
            <div style="font-weight:900;font-size:1.2rem;">${player.name}</div>
            <div style="font-size:0.7rem;color:#94a3b8;">${team?.name || 'Agente Libre'} · ${player.rocketRank}</div>
          </div>
        </div>
      `;
    }

    const canvasId = tab === 'equipos' ? 'perf-equipo-chart' : 'perf-jugador-chart';
    const canvas = document.getElementById(canvasId);
    if (canvas) {
      const imgData = canvas.toDataURL('image/png');
      htmlContent += `<div style="margin:1rem 0;text-align:center;"><img src="${imgData}" style="max-width:100%;border:1px solid #2d2d44;border-radius:8px;" /></div>`;
    }

    htmlContent += `<div style="margin-top:0.5rem;font-size:0.55rem;color:#94a3b8;">${torneo.name} · Generado desde MTM Nexus</div>`;
    showPrintModal(htmlContent, `performance_${title}.jpg`, 850);
  }

  function renderPerformance(torneo) {
    const container = document.getElementById('section-performance');
    if (!container) return;
    const title = container.querySelector('.section-title');
    if (title) {
      const tabLabel = perfCurrentTab === 'equipos' ? 'Equipos' : 'Jugadores';
      title.innerHTML = `<i class="fas fa-chart-line"></i> Performance - <span id="perf-title">${tabLabel}</span>
        <button class="print-btn" onclick="printPerformance()"><i class="fas fa-print"></i> Imprimir</button>`;
    }
    if (perfCurrentTab === 'equipos') renderPerformanceEquipos();
    else renderPerformanceJugadores();
  }

  // ==========================================
  // CONSTRUCCIÓN DE LA INTERFAZ
  // ==========================================
  function buildUI(torneo) {
    var navHtml = '';
    const menuGroups = [
      { items: ['tabla', 'media', 'jornadas', 'playoffs', 'stats', 'performance', 'balon', 'equipos'], border: 'green' },
      { items: ['mercado', 'economia', 'sanciones', 'seleccion', 'amistosos'], border: 'white' },
      { items: ['salon'], border: 'red' }
    ];

    menuGroups.forEach((group) => {
      group.items.forEach((id) => {
        const item = MENU_ITEMS.find(i => i.id === id);
        if (!item) return;
        const borderClass = group.border === 'green' ? 'menu-border-green' : group.border === 'white' ? 'menu-border-white' : 'menu-border-red';
        navHtml += `<div class="nav-item ${borderClass}" data-section="${item.id}" onclick="switchView('${item.id}')">`;
        navHtml += `<i class="fas ${item.icon}"></i> ${item.label}`;
        navHtml += `</div>`;
      });
      if (group !== menuGroups[menuGroups.length - 1]) {
        navHtml += `<div class="nav-divider"><span></span></div>`;
      }
    });

    mainNav.innerHTML = navHtml;

    var sectionsHtml = '';
    MENU_ITEMS.forEach(function(item) {
      var id = item.id;
      var contentFn = null;
      var title = '';
      var icon = '';
      var printFn = null;

      switch(id) {
        case 'tabla': contentFn = renderTabla; title = 'Tabla General'; icon = 'fa-table'; printFn = printTablaGeneral; break;
        case 'media': contentFn = renderMedia; title = 'Tabla de Media'; icon = 'fa-chart-simple'; printFn = printTablaMedia; break;
        case 'jornadas': contentFn = renderJornadas; title = 'Jornadas'; icon = 'fa-calendar-day'; printFn = printJornada; break;
        case 'playoffs': contentFn = renderPlayoffs; title = 'PlayOffs'; icon = 'fa-sitemap'; break;
        case 'stats': contentFn = renderStats; title = 'Stats'; icon = 'fa-chart-bar'; printFn = printStats; break;
        case 'performance': contentFn = null; title = 'Performance'; icon = 'fa-chart-line'; break;
        case 'balon': contentFn = renderBalon; title = 'Balón de Oro'; icon = 'fa-trophy'; printFn = printBalon; break;
        case 'equipos': contentFn = renderEquipos; title = 'Equipos'; icon = 'fa-users'; printFn = printEquipos; break;
        case 'mercado': contentFn = renderMercado; title = 'Mercado'; icon = 'fa-store'; printFn = printMercado; break;
        case 'economia': contentFn = renderEconomia; title = 'Mov. Económicos'; icon = 'fa-coins'; break;
        case 'sanciones': contentFn = renderSanciones; title = 'Sanciones'; icon = 'fa-gavel'; printFn = printSanciones; break;
        case 'seleccion': contentFn = renderSeleccion; title = 'Selección Nacional'; icon = 'fa-flag'; printFn = printSeleccion; break;
        case 'amistosos': contentFn = renderAmistosos; title = 'Partidos Amistosos'; icon = 'fa-handshake'; printFn = printAmistosos; break;
        case 'salon': contentFn = renderSalon; title = 'Salón de la Fama'; icon = 'fa-medal'; printFn = printSalon; break;
      }

      if (id === 'performance') {
        sectionsHtml += `<div class="section" id="section-performance"></div>`;
        return;
      }

      if (contentFn) {
        var contentData = contentFn(torneo);
        var printBtnHtml = printFn ? `<button class="print-btn" onclick="window['${printFn.name}']()"><i class="fas fa-print"></i> Imprimir</button>` : '';
        sectionsHtml += `<div class="section" id="section-${id}">`;
        sectionsHtml += `<div class="section-title"><i class="fas ${icon}"></i> ${title} ${printBtnHtml}</div>`;
        sectionsHtml += contentData;
        sectionsHtml += `</div>`;
      }
    });

    sectionsContainer.innerHTML = sectionsHtml;

    const perfContainer = document.getElementById('section-performance');
    if (perfContainer) {
      perfContainer.innerHTML = `
        <div class="section-title"><i class="fas fa-chart-line"></i> Performance - <span id="perf-title">Equipos</span>
          <button class="print-btn" onclick="printPerformance()"><i class="fas fa-print"></i> Imprimir</button>
        </div>
        <div class="perf-tabs">
          <button class="active" data-tab="equipos" onclick="switchPerfTab('equipos')">Equipos</button>
          <button data-tab="jugadores" onclick="switchPerfTab('jugadores')">Jugadores</button>
        </div>
        <div id="perf-equipos-content" class="perf-sub-view active">
          <div class="perf-layout">
            <div class="perf-list" id="perf-equipo-list"></div>
            <div class="perf-chart-area" id="perf-equipo-chart-area">
              <div class="perf-line-selectors">
                <label><input type="checkbox" id="perf-show-atk" checked onchange="refreshPerfChart('equipo')"> ⚡ ATK</label>
                <label><input type="checkbox" id="perf-show-def" checked onchange="refreshPerfChart('equipo')"> 🛡️ DEF</label>
                <label><input type="checkbox" id="perf-show-glb" checked onchange="refreshPerfChart('equipo')"> ⭐ GLB</label>
                <button onclick="refreshPerfChart('equipo')" class="btn-refresh"><i class="fas fa-rotate"></i></button>
              </div>
              <canvas id="perf-equipo-chart" height="280"></canvas>
              <div id="perf-equipo-stats"></div>
            </div>
          </div>
        </div>
        <div id="perf-jugadores-content" class="perf-sub-view">
          <div class="perf-layout">
            <div class="perf-list" id="perf-jugador-list"></div>
            <div class="perf-chart-area" id="perf-jugador-chart-area">
              <div class="perf-line-selectors">
                <label><input type="checkbox" id="perf-show-goals" checked onchange="refreshPerfChart('jugador')"> ⚽ Goles</label>
                <label><input type="checkbox" id="perf-show-assists" checked onchange="refreshPerfChart('jugador')"> 🎯 Asistencias</label>
                <label><input type="checkbox" id="perf-show-saves" checked onchange="refreshPerfChart('jugador')"> 🧤 Salvadas</label>
                <label><input type="checkbox" id="perf-show-shots" checked onchange="refreshPerfChart('jugador')"> 💀 Tiros</label>
                <label><input type="checkbox" id="perf-show-pig" checked onchange="refreshPerfChart('jugador')"> 📊 PIG</label>
                <label><input type="checkbox" id="perf-show-value" onchange="refreshPerfChart('jugador')"> 💰 Valor</label>
                <button onclick="refreshPerfChart('jugador')" class="btn-refresh"><i class="fas fa-rotate"></i></button>
              </div>
              <canvas id="perf-jugador-chart" height="280"></canvas>
              <div id="perf-jugador-stats"></div>
            </div>
          </div>
        </div>
      `;
      renderPerformanceEquipos();
    }

    switchView('tabla');
  }

  // ==========================================
  // SWITCH VIEW - con cierre automático de sidebar en móvil
  // ==========================================
  function switchView(id) {
    document.querySelectorAll('.section').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('section-' + id);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.classList.toggle('active', el.dataset.section === id);
    });
    if (id === 'performance') {
      setTimeout(() => {
        switchPerfTab(perfCurrentTab || 'equipos');
      }, 50);
    }
    // Cerrar sidebar en móvil al cambiar de vista
    if (window.innerWidth <= 820) {
      sidebar.classList.remove('open');
    }
  }

  // ==========================================
  // RENDERIZADO DE SECCIONES
  // ==========================================
  function renderTabla(torneo) {
    if (!torneo.teams || !torneo.teams.length) return '<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i>No hay equipos.</div>';
    const teams = [...torneo.teams];
    teams.sort((a,b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
    const lig = torneo.tableConfig?.liguilla ?? 8;
    const des = torneo.tableConfig?.descenso ?? 2;
    const asc = torneo.tableConfig?.ascenso ?? 2;

    let html = `<div class="table-wrap" id="tabla-general-container"><table><thead><tr>`;
    html += `<th class="th-pts">#</th><th>Equipo</th><th class="th-pts">Pts</th><th class="th-pj">PJ</th><th class="th-pg">PG</th><th class="th-pe">PE</th><th class="th-pp">PP</th><th class="th-gf">GF</th><th class="th-gc">GC</th><th class="th-dg">DG</th>`;
    html += `</tr></thead><tbody>`;
    teams.forEach((tm, i) => {
      let rowClass = '';
      if (i < asc && torneo.linkedTournamentId) rowClass = 'row-ascenso';
      else if (i < lig) rowClass = 'row-clasif';
      else if (i >= teams.length - des && des > 0) rowClass = 'row-descenso';
      const dg = (tm.gf||0) - (tm.gc||0);
      html += `<tr class="${rowClass}">`;
      html += `<td>${i+1}</td>`;
      html += `<td class="flex-center"><img src="${tm.shield||''}" class="shield-sm" alt=""> ${tm.name}</td>`;
      html += `<td class="td-pts"><strong>${tm.pts||0}</strong></td>`;
      html += `<td class="td-pj">${tm.pj||0}</td>`;
      html += `<td class="td-pg">${tm.pg||0}</td>`;
      html += `<td class="td-pe">${tm.pe||0}</td>`;
      html += `<td class="td-pp">${tm.pp||0}</td>`;
      html += `<td class="td-gf">${tm.gf||0}</td>`;
      html += `<td class="td-gc">${tm.gc||0}</td>`;
      html += `<td class="td-dg">${dg}</td>`;
      html += `</tr>`;
    });
    html += '</tbody></table></div>';
    let legend = '<div class="flex-center gap-1" style="font-size:0.65rem;margin-top:0.4rem;">';
    if (lig > 0) legend += `<span class="flex-center"><span style="display:inline-block;width:10px;height:10px;background:var(--neon-green);border-radius:2px;"></span> Clasificación</span>`;
    if (asc > 0 && torneo.linkedTournamentId) legend += `<span class="flex-center"><span style="display:inline-block;width:10px;height:10px;background:var(--neon-yellow);border-radius:2px;"></span> Ascenso</span>`;
    if (des > 0) legend += `<span class="flex-center"><span style="display:inline-block;width:10px;height:10px;background:var(--neon-red);border-radius:2px;"></span> Descenso</span>`;
    legend += '</div>';
    // Detectar overflow para mostrar hint de scroll
    setTimeout(() => {
      const cont = document.getElementById('tabla-general-container');
      if (cont && cont.scrollWidth > cont.clientWidth + 4) {
        cont.classList.add('scrollable');
      }
    }, 100);
    return html + legend;
  }

  function renderMedia(torneo) {
    if (!torneo.teams || !torneo.teams.length) return '<div class="empty-state"><i class="fa-solid fa-circle-exclamation"></i>No hay equipos.</div>';
    const sorted = [...torneo.teams].sort((a,b) => (b.glb||0) - (a.glb||0));
    const avgGLB = torneo.teams.reduce((sum, t) => sum + t.glb, 0) / torneo.teams.length;
    const getTrend = (team, valKey) => {
      // Compara el valor actual del equipo contra el promedio, para la flecha
      const diff = (team[valKey] || 0) - avgGLB;
      if (diff > 10) return { symbol: '▲', cls: 'trend-up' };
      if (diff < -10) return { symbol: '▼', cls: 'trend-down' };
      return { symbol: '—', cls: 'trend-flat' };
    };
    let html = `<div class="table-wrap" id="tabla-media-container"><table><thead><tr><th>#</th><th>Equipo</th><th class="th-neutral">ATK</th><th class="th-neutral">DEF</th><th class="th-neutral">GLB</th></tr></thead><tbody>`;
    sorted.forEach((tm, i) => {
      const atkTrend = getTrend(tm, 'atk');
      const defTrend = getTrend(tm, 'def');
      const glbTrend = getTrend(tm, 'glb');
      html += `<tr><td>${i+1}</td><td class="flex-center"><img src="${tm.shield||''}" class="shield-sm"> ${tm.name}</td>`;
      html += `<td><span class="power-badge atk">${tm.atk||0} <span class="${atkTrend.cls}">${atkTrend.symbol}</span></span></td>`;
      html += `<td><span class="power-badge def">${tm.def||0} <span class="${defTrend.cls}">${defTrend.symbol}</span></span></td>`;
      html += `<td><span class="power-badge glb">${tm.glb||0} <span class="${glbTrend.cls}">${glbTrend.symbol}</span></span></td>`;
      html += `</tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderJornadas(torneo) {
    if (!torneo.rounds || !torneo.rounds.length) return '<div class="empty-state"><i class="fa-solid fa-calendar-xmark"></i>No hay jornadas generadas.</div>';
    let html = '';
    torneo.rounds.forEach((round, idx) => {
      html += `<div class="card"><div class="card-header">Jornada ${idx+1}</div>`;
      if (!round.length) {
        html += '<div class="text-muted" style="font-size:0.8rem;">Sin partidos</div>';
      } else {
        html += `<div class="table-wrap"><table><thead><tr><th>Local</th><th>Resultado</th><th>Visitante</th></tr></thead><tbody>`;
        round.forEach(m => {
          const h = getTeamById(torneo.teams, m.h);
          const a = getTeamById(torneo.teams, m.a);
          const hName = h ? h.name : '???';
          const aName = a ? a.name : '???';
          const hShield = h ? h.shield : '';
          const aShield = a ? a.shield : '';
          const played = m.played || false;
          const score = played ? `${m.sH} - ${m.sA}` : 'vs';
          const clickable = played ? `class="match-clickable" onclick="showMatchStats('${m.id}')"` : '';
          html += `<tr ${clickable}><td class="flex-center"><img src="${hShield}" class="shield-sm"> ${hName}</td><td style="font-weight:700;text-align:center;">${score}</td><td class="flex-center" style="justify-content:flex-end;">${aName} <img src="${aShield}" class="shield-sm"></td></tr>`;
        });
        html += '</tbody></table></div>';
      }
      html += '</div>';
    });
    return html;
  }

  window.showMatchStats = function(matchId) {
    if (!currentData) return;
    let match = null;
    for (let round of (currentData.rounds || [])) {
      const found = round.find(m => m.id === matchId);
      if (found) { match = found; break; }
    }
    if (!match) {
      for (let fm of (currentData.friendlyMatches || [])) {
        if (fm.id === matchId) { match = fm; break; }
      }
    }
    if (!match || !match.played || !match.stats) {
      alert('Este partido no tiene estadísticas detalladas.');
      return;
    }

    const h = getTeamById(currentData.teams, match.h);
    const a = getTeamById(currentData.teams, match.a);
    const hName = h ? h.name : 'Desconocido';
    const aName = a ? a.name : 'Desconocido';
    const hShield = h ? h.shield : '';
    const aShield = a ? a.shield : '';

    const hStats = match.stats.filter(s => s.tId === match.h);
    const aStats = match.stats.filter(s => s.tId === match.a);

    function renderPlayerStats(team, statsArray) {
      if (!team || !statsArray.length) return '<div class="text-muted" style="font-size:0.7rem;">Sin estadísticas</div>';
      let html = `<div style="font-size:0.7rem;margin-top:0.2rem;"><table style="width:100%;font-size:0.7rem;border-collapse:collapse;"><thead><tr style="border-bottom:1px solid var(--color-border);"><th>Jugador</th><th>G</th><th>A</th><th>S</th><th>T</th></tr></thead><tbody>`;
      statsArray.forEach(st => {
        const p = team.players.find(x => x.id === st.pId);
        const name = p ? p.name : '?';
        html += `<tr><td>${name}</td><td>${st.g||0}</td><td>${st.a||0}</td><td>${st.s||0}</td><td>${st.t||0}</td></tr>`;
      });
      html += '</tbody></table></div>';
      return html;
    }

    const modalHtml = `
      <div class="print-modal-overlay" onclick="if(event.target===this) this.remove()">
        <div class="print-modal" style="max-width:650px;">
          <h3>📊 Estadísticas del partido</h3>
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:1rem;margin-bottom:0.5rem;">
            <span class="flex-center"><img src="${hShield}" style="width:2rem;height:2rem;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;"> ${hName}</span>
            <span style="font-weight:900;font-size:1.3rem;">${match.sH} - ${match.sA}</span>
            <span class="flex-center">${aName} <img src="${aShield}" style="width:2rem;height:2rem;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;"></span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
            <div><div class="card-header" style="font-size:0.7rem;">${hName}</div>${renderPlayerStats(h, hStats)}</div>
            <div><div class="card-header" style="font-size:0.7rem;">${aName}</div>${renderPlayerStats(a, aStats)}</div>
          </div>
          <div class="actions" style="margin-top:0.5rem;">
            <button class="btn-cancel" onclick="this.closest('.print-modal-overlay').remove()">Cerrar</button>
            <button class="btn-download" onclick="printMatchStats('${matchId}')">Imprimir</button>
          </div>
        </div>
      </div>
    `;
    const overlay = document.createElement('div');
    overlay.innerHTML = modalHtml;
    document.body.appendChild(overlay);
  };

  window.printMatchStats = function(matchId) {
    const match = (() => {
      for (let round of (currentData.rounds || [])) {
        const found = round.find(m => m.id === matchId);
        if (found) return found;
      }
      return null;
    })();
    if (!match) return alert('Partido no encontrado.');

    const h = getTeamById(currentData.teams, match.h);
    const a = getTeamById(currentData.teams, match.a);

    function renderStats(team, statsArray) {
      if (!team || !statsArray.length) return '<div class="text-muted">Sin estadísticas</div>';
      let html = '<table style="width:100%;font-size:0.7rem;border-collapse:collapse;margin-top:0.2rem;"><thead><tr style="border-bottom:1px solid #2d2d44;"><th>Jugador</th><th>G</th><th>A</th><th>S</th><th>T</th></tr></thead><tbody>';
      statsArray.forEach(st => {
        const p = team.players.find(x => x.id === st.pId);
        html += `<tr><td>${p ? p.name : '?'}</td><td>${st.g||0}</td><td>${st.a||0}</td><td>${st.s||0}</td><td>${st.t||0}</td></tr>`;
      });
      html += '</tbody></table>';
      return html;
    }

    const htmlContent = getPrintHeader('Estadísticas del partido') +
      `<div style="display:flex;justify-content:space-between;align-items:center;font-size:0.95rem;margin:0.4rem 0;">
        <span>${h?.name || '?'}</span>
        <span style="font-weight:900;font-size:1.2rem;">${match.sH} - ${match.sA}</span>
        <span>${a?.name || '?'}</span>
      </div>`;
    showPrintModal(htmlContent, `partido_${matchId}.jpg`, 700);
    document.querySelector('.print-modal-overlay')?.remove();
  };

  function renderPlayoffs(torneo) {
    if (!torneo.playoffs || !torneo.playoffs.rounds || !torneo.playoffs.rounds.length) {
      return '<div class="empty-state"><i class="fa-solid fa-clock"></i>Próximamente</div>';
    }
    const rounds = torneo.playoffs.rounds;
    let html = '<div style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:center;">';
    rounds.forEach((r, ri) => {
      html += `<div style="display:flex;flex-direction:column;gap:0.4rem;min-width:130px;">`;
      html += `<div class="card-header" style="text-align:center;">${ri === 0 ? 'Cuartos' : ri === 1 ? 'Semis' : ri === 2 ? 'Final' : `Ronda ${ri+1}`}</div>`;
      r.forEach(m => {
        const h = getTeamById(torneo.teams, m.h);
        const a = getTeamById(torneo.teams, m.a);
        const played = m.played || false;
        const score = played ? `${m.sH} - ${m.sA}` : 'vs';
        html += `<div class="card" style="padding:0.4rem 0.6rem;margin:0;min-width:110px;"><div class="flex-center" style="justify-content:space-between;font-size:0.7rem;"><span class="flex-center"><img src="${h?.shield||''}" class="shield-sm" style="width:1.2rem;height:1.2rem;"> ${h?.name || 'TBD'}</span><span style="font-weight:700;">${score}</span><span class="flex-center">${a?.name || 'TBD'} <img src="${a?.shield||''}" class="shield-sm" style="width:1.2rem;height:1.2rem;"></span></div></div>`;
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderStats(torneo) {
    const allPlayers = [];
    torneo.teams.forEach(team => {
      team.players.forEach(p => {
        if (p.name && p.name.trim() !== '') {
          const s = p.seasonStats || {};
          allPlayers.push({
            id: p.id, ...p, teamName: team.name, teamShield: team.shield,
            goals: s.goals || 0, assists: s.assists || 0, saves: s.saves || 0, shots: s.shots || 0,
            pig: s.pig || 0, matchesPlayed: s.matchesPlayed || 0
          });
        }
      });
    });
    if (!allPlayers.length) return '<div class="empty-state"><i class="fa-solid fa-users-slash"></i>No hay jugadores con estadísticas.</div>';

    function makeTable(title, key, label, containerId) {
      const sorted = [...allPlayers].sort((a,b) => (b[key]||0) - (a[key]||0));
      const limit = statsLimits[key] || 10;
      const visible = sorted.slice(0, limit);
      const hasMore = limit < sorted.length && limit < MAX_STATS_LIMIT;
      let html = `<div class="card"><div class="card-header">${title}${hasMore ? `<button class="expand-btn" data-key="${key}">Ver 10 más</button>` : ''}</div><div class="table-wrap" id="${containerId}"><table><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>${label}</th></tr></thead><tbody>`;
      visible.forEach((p, i) => {
        html += `<tr onclick="showPlayerProfile('${p.id}')" style="cursor:pointer;"><td>${i+1}</td><td class="flex-center"><img src="${p.teamShield||''}" class="shield-sm"> ${p.name}</td><td>${p.teamName}</td><td><strong>${p[key]||0}</strong></td></tr>`;
      });
      html += '</tbody></table></div></div>';
      return html;
    }

    let html = makeTable('⚽ Goleadores', 'goals', 'Goles', 'stats-goals');
    html += makeTable('🎯 Asistencias', 'assists', 'Asistencias', 'stats-assists');
    html += makeTable('🧤 Salvadas', 'saves', 'Salvadas', 'stats-saves');
    html += makeTable('💀 Tiros (Peligro)', 'shots', 'Tiros', 'stats-shots');

    html += `<div class="card"><div class="card-header">🔥 Poder de Equipos</div><div class="table-wrap">`;
    const sortedTeams = [...torneo.teams].sort((a,b) => (b.glb||0) - (a.glb||0));
    html += `<table><thead><tr><th>#</th><th>Equipo</th><th class="th-neutral">ATK</th><th class="th-neutral">DEF</th><th class="th-neutral">GLB</th></tr></thead><tbody>`;
    sortedTeams.forEach((tm, i) => {
      html += `<tr><td>${i+1}</td><td class="flex-center"><img src="${tm.shield||''}" class="shield-sm"> ${tm.name}</td><td><span class="power-badge atk">${tm.atk||0}</span></td><td><span class="power-badge def">${tm.def||0}</span></td><td><span class="power-badge glb">${tm.glb||0}</span></td></tr>`;
    });
    html += '</tbody></table></div></div>';

    html += `<div class="card"><div class="card-header">⭐ MVPs por Jornada</div>`;
    const totalJornadas = torneo.rounds ? torneo.rounds.length : 0;
    if (!totalJornadas) {
      html += '<div class="text-muted" style="font-size:0.8rem;">No hay jornadas.</div>';
    } else {
      html += `<div class="jornada-nav" id="mvp-jornada-nav">`;
      for (let i = 0; i < totalJornadas; i++) {
        html += `<button data-jornada="${i}" class="${i === currentMvpJornada ? 'active' : ''}">J${i+1}</button>`;
      }
      html += `</div><div id="mvp-content"></div>`;
    }
    html += '</div>';

    setTimeout(function() {
      document.querySelectorAll('.expand-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const key = this.dataset.key;
          if (statsLimits[key]) {
            statsLimits[key] += 10;
            if (statsLimits[key] > MAX_STATS_LIMIT) statsLimits[key] = MAX_STATS_LIMIT;
            const sec = document.getElementById('section-stats');
            if (sec) {
              const cont = sec.querySelector('.section-content');
              if (cont) cont.innerHTML = renderStats(currentData);
            }
          }
        });
      });
      document.querySelectorAll('#mvp-jornada-nav button').forEach(function(btn) {
        btn.addEventListener('click', function() {
          const idx = parseInt(this.dataset.jornada);
          currentMvpJornada = idx;
          document.querySelectorAll('#mvp-jornada-nav button').forEach(function(b) { b.classList.remove('active'); });
          this.classList.add('active');
          document.getElementById('mvp-content').innerHTML = renderMvpForJornada(currentData, idx);
        });
      });
      if (totalJornadas > 0) {
        document.getElementById('mvp-content').innerHTML = renderMvpForJornada(currentData, currentMvpJornada);
      }
    }, 50);

    return html;
  }

  function renderMvpForJornada(torneo, jornadaIdx) {
    const round = torneo.rounds && torneo.rounds[jornadaIdx];
    if (!round || !round.length) return '<div class="text-muted" style="font-size:0.8rem;">No hay partidos en esta jornada.</div>';

    const statsMap = {};
    const teamStats = {};
    torneo.teams.forEach(function(t) { teamStats[t.id] = { pts: 0, g: 0, a: 0, s: 0, pig: 0 }; });

    round.forEach(function(m) {
      if (m.stats) {
        m.stats.forEach(function(st) {
          if (!statsMap[st.pId]) statsMap[st.pId] = { g:0, a:0, s:0, t:0, pig:0, teamId: st.tId };
          statsMap[st.pId].g += st.g || 0;
          statsMap[st.pId].a += st.a || 0;
          statsMap[st.pId].s += st.s || 0;
          statsMap[st.pId].t += st.t || 0;
          var pig = (st.g||0)*2 + (st.a||0)*1.5 + (st.s||0)*1 + ((st.t||0) - (st.g||0))*0.2;
          statsMap[st.pId].pig += pig;
          if (teamStats[st.tId]) {
            teamStats[st.tId].g += st.g || 0;
            teamStats[st.tId].a += st.a || 0;
            teamStats[st.tId].s += st.s || 0;
            teamStats[st.tId].pig += pig;
          }
        });
      }
      if (m.played) {
        if (m.sH > m.sA) { if (teamStats[m.h]) teamStats[m.h].pts += 3; }
        else if (m.sA > m.sH) { if (teamStats[m.a]) teamStats[m.a].pts += 3; }
        else { if (teamStats[m.h]) teamStats[m.h].pts += 1; if (teamStats[m.a]) teamStats[m.a].pts += 1; }
      }
    });

    var mvp = null, maxPig = -1;
    Object.keys(statsMap).forEach(function(pid) {
      var st = statsMap[pid];
      if (st.pig > maxPig) { maxPig = st.pig; mvp = { id: pid, pig: st.pig }; }
    });

    var bestTeam = null, bestScore = -1;
    Object.keys(teamStats).forEach(function(tid) {
      var st = teamStats[tid];
      var score = (st.pts || 0) + (st.pig || 0)/10;
      if (score > bestScore) { bestScore = score; bestTeam = { id: tid, pts: st.pts, pig: st.pig }; }
    });

    var bestGoleador = null, bestAsistidor = null, bestMuro = null;
    var maxG=-1, maxA=-1, maxS=-1;
    Object.keys(statsMap).forEach(function(pid) {
      var st = statsMap[pid];
      if (st.g > maxG) { maxG = st.g; bestGoleador = { id: pid, g: st.g }; }
      if (st.a > maxA) { maxA = st.a; bestAsistidor = { id: pid, a: st.a }; }
      if (st.s > maxS) { maxS = st.s; bestMuro = { id: pid, s: st.s }; }
    });

    function getPlayerInfo(pid) {
      for (var i = 0; i < torneo.teams.length; i++) {
        var team = torneo.teams[i];
        var p = team.players.find(function(x) { return x.id === pid; });
        if (p) return { name: p.name, teamName: team.name, rank: p.rocketRank || 'Platino' };
      }
      return null;
    }

    var html = '<div class="mvp-grid">';
    if (mvp) {
      var info = getPlayerInfo(mvp.id);
      html += '<div class="mvp-card"><div class="label">🏆 MVP</div><div class="name">' + (info ? info.name : '?') + '</div><div style="font-size:0.65rem;color:var(--color-text-muted);">' + (info ? info.teamName : '') + '</div><div class="stat">' + mvp.pig.toFixed(1) + ' PIG</div></div>';
    }
    if (bestTeam) {
      var team = getTeamById(torneo.teams, bestTeam.id);
      html += '<div class="mvp-card"><div class="label">🏅 Equipo</div><div class="name">' + (team ? team.name : '?') + '</div><div class="stat">' + (bestTeam.pts||0) + ' pts</div></div>';
    }
    html += '<div class="mvp-card" style="max-width:300px;flex:2;"><div class="label">⭐ Dream Team</div>';
    if (bestGoleador) {
      var info = getPlayerInfo(bestGoleador.id);
      html += '<div style="font-size:0.65rem;"><span class="text-neon-green">⚽</span> ' + (info ? info.name : '?') + ' (' + bestGoleador.g + ')</div>';
    }
    if (bestAsistidor) {
      var info = getPlayerInfo(bestAsistidor.id);
      html += '<div style="font-size:0.65rem;"><span class="text-neon-cyan">🎯</span> ' + (info ? info.name : '?') + ' (' + bestAsistidor.a + ')</div>';
    }
    if (bestMuro) {
      var info = getPlayerInfo(bestMuro.id);
      html += '<div style="font-size:0.65rem;"><span class="text-neon-pink">🧤</span> ' + (info ? info.name : '?') + ' (' + bestMuro.s + ')</div>';
    }
    html += '</div></div>';
    return html;
  }

  function renderBalon(torneo) {
    var allPlayers = [];
    torneo.teams.forEach(function(team) {
      team.players.forEach(function(p) {
        if (p.name && p.name.trim() !== '') {
          var s = p.seasonStats || { pig:0 };
          allPlayers.push({ id: p.id, name: p.name, teamName: team.name, teamShield: team.shield, pig: s.pig || 0 });
        }
      });
    });
    if (!allPlayers.length) return '<div class="empty-state"><i class="fa-solid fa-trophy"></i>Sin jugadores.</div>';
    var sorted = allPlayers.sort(function(a,b) { return (b.pig||0) - (a.pig||0); });

    var html = '<div class="podium">';
    var top3 = sorted.slice(0,3);
    var cls = ['first','second','third'];
    top3.forEach(function(p, i) {
      var displayName = p.name.length > 16 ? p.name.substring(0, 14) + '…' : p.name;
      html += `<div class="podium-item ${cls[i]}" onclick="showPlayerProfile('${p.id}')">`;
      html += '<div class="circle"><img src="' + (p.teamShield || '') + '" onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<span class=\\\'no-img\\\'>#' + (i+1) + '</span>\';" /></div>';
      html += '<div class="pos">#' + (i+1) + '</div>';
      html += '<div class="name">' + displayName + '</div>';
      html += '<div class="value">' + (p.pig||0).toFixed(1) + ' PIG</div>';
      html += '<div class="sub">' + p.teamName + '</div>';
      html += '</div>';
    });
    html += '</div>';

    html += '<div class="table-wrap"><table><thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>PIG</th></tr></thead><tbody>';
    sorted.slice(3).forEach(function(p, i) {
      html += `<tr onclick="showPlayerProfile('${p.id}')" style="cursor:pointer;"><td>${i+4}</td><td class="flex-center"><img src="${p.teamShield||''}" class="shield-sm"> ${p.name}</td><td>${p.teamName}</td><td>${(p.pig||0).toFixed(1)}</td></tr>`;
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderEquipos(torneo) {
    if (!torneo.teams || !torneo.teams.length) return '<div class="empty-state"><i class="fa-solid fa-users-slash"></i>No hay equipos.</div>';
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.5rem;">';
    torneo.teams.forEach(function(team) {
        var titulares = team.players.filter(function(p) { return p.role === 'Titular 🌟' && p.name && p.name.trim() !== ''; });
        var suplentes = team.players.filter(function(p) { return p.role === 'Suplente 🔄' && p.name && p.name.trim() !== ''; });
        var reservas = team.players.filter(function(p) { return p.role === 'Reserva 💤' && p.name && p.name.trim() !== ''; });
        var capitan = team.players.find(function(p) { return p.isCaptain; });

        var renderPlayerSlots = function(players, cls, label) {
            if (!players.length) return '<span class="text-muted" style="font-size:0.7rem;">Sin ' + label + '</span>';
            return players.map(function(p) {
                const stats = p.seasonStats || { goals: 0, assists: 0, saves: 0 };
                const rankColor = getRankColor(p.rocketRank);
                const captainClass = p.isCaptain ? ' captain' : '';
                return `
                    <div class="player-slot ${cls}${captainClass}" onclick="showPlayerProfile('${p.id}')" title="Ver perfil de ${p.name}">
                        <div class="slot-name">${p.name}</div>
                        <div class="slot-rank" style="color:${rankColor}">${p.rocketRank} ${p.rocketRank !== 'SSL' ? p.division : ''}</div>
                        <div class="slot-stats">
                            <span>⚽${stats.goals||0}</span>
                            <span>🎯${stats.assists||0}</span>
                            <span>🧤${stats.saves||0}</span>
                        </div>
                    </div>
                `;
            }).join('');
        };

        html += '<div class="card" style="padding:1.2rem;border-radius:16px;">';
        html += '<div style="display:flex;align-items:center;gap:1rem;margin-bottom:0.8rem;">';
        html += '<img src="' + (team.shield||'') + '" style="width:3.5rem;height:3.5rem;border-radius:50%;background:#000;border:2px solid var(--color-border);object-fit:contain;" />';
        html += '<div style="flex:1;">';
        html += '<div style="font-size:1.2rem;font-weight:900;color:var(--neon-purple);">' + team.name + '</div>';
        html += '<div style="display:flex;gap:0.8rem;font-size:0.7rem;color:var(--color-text-muted);flex-wrap:wrap;">';
        html += '<span><i class="fas fa-bolt" style="color:var(--neon-green);"></i> ATK ' + (team.atk||0) + '</span>';
        html += '<span><i class="fas fa-shield" style="color:var(--neon-red);"></i> DEF ' + (team.def||0) + '</span>';
        html += '<span><i class="fas fa-star" style="color:#ffffff;"></i> GLB ' + (team.glb||0) + '</span>';
        html += '<span><i class="fas fa-coins" style="color:var(--neon-green);"></i> ' + formatCurrency(team.budget||0) + '</span>';
        if (capitan) html += '<span><i class="fas fa-crown" style="color:var(--neon-yellow);"></i> ' + capitan.name + '</span>';
        html += '</div></div></div>';
        html += '<div style="margin-top:0.5rem;">';
        html += '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);margin-bottom:0.2rem;">Titulares</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">' + renderPlayerSlots(titulares, 'titular', 'Titulares') + '</div>';
        html += '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);margin:0.4rem 0 0.2rem;">Suplentes</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">' + renderPlayerSlots(suplentes, 'suplente', 'Suplentes') + '</div>';
        html += '<div style="font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);margin:0.4rem 0 0.2rem;">Reservas</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">' + renderPlayerSlots(reservas, 'reserva', 'Reservas') + '</div>';
        html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderMercado(torneo) {
    var allPlayers = [];
    torneo.teams.forEach(function(team) {
      team.players.forEach(function(p) {
        if (p.name && p.name.trim() !== '') {
          var s = p.seasonStats || { pig:0 };
          var rankDisplay = p.rocketRank + (p.rocketRank !== 'SSL' ? ' ' + p.division : '');
          allPlayers.push({ id: p.id, name: p.name, teamId: team.id, teamName: team.name, teamShield: team.shield, pig: s.pig || 0, marketValue: p.marketValue || 0, rocketRankDisplay: rankDisplay, isCaptain: p.isCaptain || false, isFree: false, rocketRank: p.rocketRank || 'Platino', division: p.division || 2 });
        }
      });
    });
    (torneo.freeAgents || []).forEach(function(p) {
      if (p.name && p.name.trim() !== '') {
        var s = p.seasonStats || { pig:0 };
        var rankDisplay = p.rocketRank + (p.rocketRank !== 'SSL' ? ' ' + p.division : '');
        allPlayers.push({ id: p.id, name: p.name, teamId: null, teamName: 'Agente Libre', teamShield: '', pig: s.pig || 0, marketValue: p.marketValue || 0, rocketRankDisplay: rankDisplay, isCaptain: p.isCaptain || false, isFree: true, rocketRank: p.rocketRank || 'Platino', division: p.division || 2 });
      }
    });
    if (!allPlayers.length) return '<div class="empty-state"><i class="fa-solid fa-store-slash"></i>No hay jugadores.</div>';

    var teamsOpts = torneo.teams.map(function(t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('');

    var html = '<div class="filters" style="display:flex;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.8rem;">';
    html += '<select id="mercadoEquipo" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);"><option value="all">Todos los equipos</option>' + teamsOpts + '<option value="free">Agentes Libres</option></select>';
    html += '<select id="mercadoOrden" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);">';
    html += '<option value="precio-desc">Precio ↓</option><option value="precio-asc">Precio ↑</option><option value="pig-desc">PIG ↓</option><option value="pig-asc">PIG ↑</option><option value="nombre">Nombre A-Z</option><option value="nombre-desc">Nombre Z-A</option>';
    html += '</select>';
    html += '<input id="mercadoBuscar" type="text" placeholder="Buscar jugador..." style="flex:1;min-width:120px;background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);">';
    html += '<button onclick="openAdvancedSearch()" style="background:var(--neon-purple);color:#000;border:none;padding:0.35rem 0.8rem;border-radius:var(--radius);font-weight:700;cursor:pointer;font-size:0.7rem;">🔍 Búsqueda avanzada</button>';
    html += '<button onclick="clearMarketFilters()" style="background:var(--color-border);color:var(--color-text);border:none;padding:0.35rem 0.8rem;border-radius:var(--radius);font-weight:700;cursor:pointer;font-size:0.7rem;">↺ Limpiar</button>';
    html += '</div>';
    html += '<div id="mercadoTablaContainer"></div>';

    function renderMercadoTabla() {
      var equipo = document.getElementById('mercadoEquipo').value;
      var orden = document.getElementById('mercadoOrden').value;
      var busqueda = document.getElementById('mercadoBuscar').value.toLowerCase();

      var filtered = allPlayers;
      if (equipo === 'free') filtered = filtered.filter(function(p) { return p.isFree; });
      else if (equipo !== 'all') filtered = filtered.filter(function(p) { return p.teamId === equipo; });
      if (busqueda) filtered = filtered.filter(function(p) { return p.name.toLowerCase().includes(busqueda); });

      if (advFilters.rankMin) {
        const rankOrder = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Campeón', 'Gran Campeón', 'SSL'];
        const minIdx = rankOrder.indexOf(advFilters.rankMin);
        if (minIdx !== -1) filtered = filtered.filter(p => rankOrder.indexOf(p.rocketRank) >= minIdx);
      }
      if (advFilters.rankMax) {
        const rankOrder = ['Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Campeón', 'Gran Campeón', 'SSL'];
        const maxIdx = rankOrder.indexOf(advFilters.rankMax);
        if (maxIdx !== -1) filtered = filtered.filter(p => rankOrder.indexOf(p.rocketRank) <= maxIdx);
      }
      if (advFilters.division) filtered = filtered.filter(p => p.division == advFilters.division);
      if (advFilters.priceMin > 0) filtered = filtered.filter(p => p.marketValue >= advFilters.priceMin);
      if (advFilters.priceMax < Infinity) filtered = filtered.filter(p => p.marketValue <= advFilters.priceMax);

      switch (orden) {
        case 'precio-desc': filtered.sort(function(a,b) { return (b.marketValue||0) - (a.marketValue||0); }); break;
        case 'precio-asc': filtered.sort(function(a,b) { return (a.marketValue||0) - (b.marketValue||0); }); break;
        case 'pig-desc': filtered.sort(function(a,b) { return (b.pig||0) - (a.pig||0); }); break;
        case 'pig-asc': filtered.sort(function(a,b) { return (a.pig||0) - (b.pig||0); }); break;
        case 'nombre': filtered.sort(function(a,b) { return a.name.localeCompare(b.name); }); break;
        case 'nombre-desc': filtered.sort(function(a,b) { return b.name.localeCompare(a.name); }); break;
      }

      if (!filtered.length) {
        document.getElementById('mercadoTablaContainer').innerHTML = '<div class="empty-state"><i class="fa-solid fa-search"></i>No se encontraron jugadores.</div>';
        return;
      }

      var tabla = '<div class="table-wrap"><table><thead><tr><th>RNK</th><th>Jugador</th><th>Equipo</th><th>PIG</th><th>Rango</th><th>Precio</th></tr></thead><tbody>';
      filtered.forEach(function(p, index) {
        var rank = index + 1;
        var rnkClass = (rank <= 10) ? 'rnk-gold' : '';
        tabla += `<tr class="market-row-click" onclick="showPlayerProfile('${p.id}')">`;
        tabla += `<td style="text-align:center;font-weight:700;" class="${rnkClass}">${rank}</td>`;
        tabla += '<td class="flex-center"><img src="' + (p.teamShield||'') + '" class="shield-sm"> ' + p.name + (p.isCaptain ? ' 👑' : '') + (p.isFree ? ' 🆓' : '') + '</td>';
        tabla += '<td>' + p.teamName + '</td>';
        tabla += '<td>' + (p.pig||0).toFixed(1) + '</td>';
        tabla += '<td style="color:' + getRankColor(p.rocketRank) + ';font-weight:700;">' + p.rocketRankDisplay + '</td>';
        tabla += '<td>' + formatCurrency(p.marketValue||0) + '</td>';
        tabla += '</tr>';
      });
      tabla += '</tbody></table></div>';
      document.getElementById('mercadoTablaContainer').innerHTML = tabla;
    }

    setTimeout(function() {
      document.getElementById('mercadoEquipo').addEventListener('change', renderMercadoTabla);
      document.getElementById('mercadoOrden').addEventListener('change', renderMercadoTabla);
      document.getElementById('mercadoBuscar').addEventListener('input', renderMercadoTabla);
      renderMercadoTabla();
    }, 0);

    return html;
  }

  function clearMarketFilters() {
    document.getElementById('mercadoEquipo').value = 'all';
    document.getElementById('mercadoOrden').value = 'precio-desc';
    document.getElementById('mercadoBuscar').value = '';
    advFilters = { rankMin: '', rankMax: '', division: '', priceMin: 0, priceMax: Infinity };
    if (document.getElementById('section-mercado').classList.contains('active')) {
      renderMercado(currentData);
    }
  }

  function openAdvancedSearch() {
    document.getElementById('adv-search-overlay').classList.add('active');
    document.getElementById('adv-rank-min').value = advFilters.rankMin || '';
    document.getElementById('adv-rank-max').value = advFilters.rankMax || '';
    document.getElementById('adv-division').value = advFilters.division || '';
    document.getElementById('adv-price-min').value = advFilters.priceMin || '';
    document.getElementById('adv-price-max').value = advFilters.priceMax < Infinity ? advFilters.priceMax : '';
  }

  function closeAdvancedSearch() {
    document.getElementById('adv-search-overlay').classList.remove('active');
  }

  function clearAdvancedSearch() {
    advFilters = { rankMin: '', rankMax: '', division: '', priceMin: 0, priceMax: Infinity };
    closeAdvancedSearch();
    if (document.getElementById('section-mercado').classList.contains('active')) {
      renderMercado(currentData);
    }
  }

  function applyAdvancedSearch() {
    const rankMin = document.getElementById('adv-rank-min').value;
    const rankMax = document.getElementById('adv-rank-max').value;
    const division = document.getElementById('adv-division').value;
    const priceMin = parseFloat(document.getElementById('adv-price-min').value) || 0;
    const priceMax = parseFloat(document.getElementById('adv-price-max').value) || Infinity;
    advFilters = { rankMin, rankMax, division, priceMin, priceMax };
    closeAdvancedSearch();
    if (document.getElementById('section-mercado').classList.contains('active')) {
      renderMercado(currentData);
    }
  }

  function renderEconomia(torneo) {
    if (!torneo.economyLogs || torneo.economyLogs.length === 0) {
      return '<div class="empty-state"><i class="fa-solid fa-coins"></i>No hay movimientos económicos.</div>';
    }

    let maxRound = 0;
    torneo.economyLogs.forEach(log => { if (log.round && log.round > maxRound) maxRound = log.round; });
    if (maxRound === 0) maxRound = torneo.rounds ? torneo.rounds.length : 1;

    let roundOptions = '<option value="todas">Todas</option>';
    for (let i = 1; i <= maxRound; i++) roundOptions += `<option value="${i}">Jornada ${i}</option>`;

    const typeOptions = [
      { value: 'todos', label: 'Todos' },
      { value: 'bonus', label: '🏆 Bonos' },
      { value: 'transfer_in', label: '📥 Fichajes' },
      { value: 'transfer_out', label: '📤 Ventas' },
      { value: 'loan', label: '📋 Préstamos' },
      { value: 'penalty', label: '⚠️ Sanciones' },
      { value: 'release', label: '📄 Liberaciones' }
    ];
    let typeSelect = typeOptions.map(t => `<option value="${t.value}">${t.label}</option>`).join('');

    const sortOptions = [
      { value: 'reciente', label: 'Más reciente' },
      { value: 'antiguo', label: 'Menos reciente' },
      { value: 'mas_caro', label: 'Más caro' },
      { value: 'menos_caro', label: 'Menos caro' }
    ];
    let sortSelect = sortOptions.map(s => `<option value="${s.value}">${s.label}</option>`).join('');

    const teamOptions = torneo.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    let html = `
      <div class="card" style="padding:0.8rem 1rem;">
        <div style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:flex-end;">
          <div><label style="font-size:0.6rem;color:var(--color-text-muted);display:block;">Jornada</label><select id="eco-filtro-jornada" onchange="aplicarFiltrosEconomia()" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);">${roundOptions}</select></div>
          <div><label style="font-size:0.6rem;color:var(--color-text-muted);display:block;">Equipo</label><select id="eco-filtro-equipo" onchange="aplicarFiltrosEconomia()" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);"><option value="all">Todos</option>${teamOptions}</select></div>
          <div><label style="font-size:0.6rem;color:var(--color-text-muted);display:block;">Tipo</label><select id="eco-filtro-tipo" onchange="aplicarFiltrosEconomia()" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);">${typeSelect}</select></div>
          <div><label style="font-size:0.6rem;color:var(--color-text-muted);display:block;">Orden</label><select id="eco-filtro-orden" onchange="aplicarFiltrosEconomia()" style="background:rgba(0,0,0,0.5);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.35rem 0.7rem;color:var(--color-text);">${sortSelect}</select></div>
        </div>
      </div>
      <div class="card" style="padding:0.6rem 1rem;">
        <div style="display:flex;flex-wrap:wrap;gap:0.8rem 1.5rem;font-size:0.85rem;" id="eco-summary-container">
          <span>📊 Movs: <span id="eco-total-movs" style="font-weight:700;">0</span></span>
          <span>💚 Ingresos: <span id="eco-total-ingresos" style="font-weight:700;color:var(--neon-green);">$0</span></span>
          <span>❤️ Gastos: <span id="eco-total-gastos" style="font-weight:700;color:var(--neon-red);">$0</span></span>
          <span>📈 Neto: <span id="eco-total-neto" style="font-weight:700;">$0</span></span>
        </div>
      </div>
      <div id="eco-tabla-container">
        <div class="table-wrap">
          <table><thead><tr><th>Fecha</th><th>Equipo</th><th>Descripción</th><th>Tipo</th><th style="text-align:right;">Monto</th></tr></thead>
          <tbody id="eco-tabla-body"><tr><td colspan="5" class="text-center text-muted">Cargando...</td></tr></tbody></table>
        </div>
      </div>
    `;

    setTimeout(() => { aplicarFiltrosEconomia(); }, 50);
    return html;
  }

  function obtenerMovimientosFiltrados(torneo, filtros) {
    if (!torneo || !torneo.economyLogs) return [];
    let movs = torneo.economyLogs.slice();
    if (filtros.round && filtros.round !== 'todas') {
      const roundNum = parseInt(filtros.round);
      movs = movs.filter(m => m.round === roundNum);
    }
    if (filtros.team && filtros.team !== 'all') movs = movs.filter(m => m.teamId === filtros.team);
    if (filtros.type && filtros.type !== 'todos') movs = movs.filter(m => m.type === filtros.type);
    switch (filtros.sort) {
      case 'reciente': movs.sort((a,b) => (b.date||0) - (a.date||0)); break;
      case 'antiguo': movs.sort((a,b) => (a.date||0) - (b.date||0)); break;
      case 'mas_caro': movs.sort((a,b) => Math.abs(b.amount||0) - Math.abs(a.amount||0)); break;
      case 'menos_caro': movs.sort((a,b) => Math.abs(a.amount||0) - Math.abs(b.amount||0)); break;
      default: movs.sort((a,b) => (b.date||0) - (a.date||0));
    }
    return movs;
  }

  function aplicarFiltrosEconomia() {
    const torneo = currentData;
    if (!torneo || !torneo.economyLogs) return;

    const round = document.getElementById('eco-filtro-jornada')?.value || 'todas';
    const team = document.getElementById('eco-filtro-equipo')?.value || 'all';
    const type = document.getElementById('eco-filtro-tipo')?.value || 'todos';
    const sort = document.getElementById('eco-filtro-orden')?.value || 'reciente';

    const movs = obtenerMovimientosFiltrados(torneo, { round, team, type, sort });

    let total = 0, ingresos = 0, gastos = 0;
    movs.forEach(m => {
      const amt = m.amount || 0;
      total += amt;
      if (amt > 0) ingresos += amt;
      else gastos += Math.abs(amt);
    });

    document.getElementById('eco-total-movs').textContent = movs.length;
    document.getElementById('eco-total-ingresos').textContent = formatCurrency(ingresos);
    document.getElementById('eco-total-gastos').textContent = formatCurrency(gastos);
    const netoEl = document.getElementById('eco-total-neto');
    netoEl.textContent = formatCurrency(total);
    netoEl.style.color = total >= 0 ? 'var(--neon-green)' : 'var(--neon-red)';

    const tbody = document.getElementById('eco-tabla-body');
    if (!movs.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay movimientos.</td></tr>';
      return;
    }

    let html = '';
    movs.forEach(m => {
      const team = getTeamById(torneo.teams, m.teamId);
      const teamName = team ? team.name : 'Desconocido';
      const teamShield = team ? team.shield : '';
      const tipoInfo = getTipoInfo(m.type);
      const isIncome = (m.amount || 0) > 0;
      const sign = isIncome ? '+' : '';
      const color = isIncome ? 'var(--neon-green)' : 'var(--neon-red)';
      const dateStr = formatDate(m.date);
      html += `<tr><td style="font-size:0.65rem;">${dateStr}</td><td class="flex-center"><img src="${teamShield}" class="shield-sm"> ${teamName}</td><td>${m.description || 'Sin descripción'}</td><td><span class="type-badge" style="border:1px solid var(--color-border);padding:0.1rem 0.5rem;border-radius:20px;font-size:0.6rem;">${tipoInfo.icon} ${tipoInfo.label}</span></td><td style="text-align:right;color:${color};font-weight:700;">${sign}${formatCurrency(m.amount)}</td></tr>`;
    });
    tbody.innerHTML = html;
  }

  function renderSanciones(torneo) {
    if (!torneo.sanctionsLog || !torneo.sanctionsLog.length) return '<div class="empty-state"><i class="fa-solid fa-gavel"></i>No hay sanciones registradas.</div>';
    var logs = torneo.sanctionsLog.filter(function(s) { return s.active !== false; }).slice().reverse();
    if (!logs.length) return '<div class="empty-state"><i class="fa-solid fa-check-circle" style="color:var(--neon-green);"></i>No hay sanciones activas.</div>';
    var html = '<div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Equipo</th><th>Tipo</th><th>Motivo</th><th>Jornadas</th></tr></thead><tbody>';
    logs.forEach(function(s) {
      var team = torneo.teams.find(function(t) { return t.id === s.teamId; });
      var teamName = team ? team.name : 'Desconocido';
      var teamShield = team ? team.shield : '';
      var typeLabel = s.type === 'yellow' ? '🟨 Amonestación' : s.type === 'red' ? '🟥 Expulsión' : s.type === 'suspension' ? '🚫 Suspensión' : '💰 Multa';
      var rounds = s.roundEnd ? 'J' + s.roundStart + ' - J' + s.roundEnd : 'Desde J' + s.roundStart;
      html += '<tr><td><strong>' + s.playerName + '</strong></td><td class="flex-center"><img src="' + teamShield + '" class="shield-sm"> ' + teamName + '</td><td>' + typeLabel + '</td><td>' + s.reason + '</td><td>' + rounds + '</td></tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderSeleccion(torneo) {
    var national = null;
    if (torneo.nationalTeams) {
      national = torneo.nationalTeams.find(function(nt) { return nt.type === 'main'; });
      if (!national) national = torneo.nationalTeams[0];
    }
    if (!national || !national.players || !national.players.length) return '<div class="empty-state"><i class="fa-solid fa-flag"></i>No hay selección nacional configurada.</div>';

    var html = '<div class="card"><div class="flex-center" style="justify-content:space-between;"><span style="font-family:Montserrat,sans-serif;font-weight:900;font-size:1.2rem;">' + national.name + '</span><span style="font-size:0.65rem;color:var(--color-text-muted);">' + (national.type === 'main' ? '🇲🇽 Selección Nacional' : '🔵 Sub Selección') + '</span></div><div style="display:flex;flex-wrap:wrap;gap:0.8rem;margin-top:0.4rem;justify-content:center;">';
    national.players.forEach(function(p) {
      var rankColor = getRankColor(p.rocketRank || 'Platino');
      var rankDisplay = p.rocketRank + (p.rocketRank !== 'SSL' ? ' ' + p.division : '');
      html += `<div onclick="showPlayerProfile('${p.id}')" style="cursor:pointer;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:0.5rem;text-align:center;min-width:90px;flex:1 0 auto;max-width:140px;">`;
      html += '<div style="font-size:0.55rem;color:var(--color-text-muted);">' + (p.role||'Jugador') + '</div>';
      html += '<img src="' + (p.shield||'') + '" style="width:2.5rem;height:2.5rem;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;margin:0.1rem auto;">';
      html += '<div style="font-weight:700;font-size:0.8rem;">' + p.name + '</div>';
      html += '<div style="font-size:0.55rem;color:' + rankColor + ';">' + rankDisplay + '</div>';
      html += '<div style="font-size:0.6rem;color:var(--neon-yellow);">G' + (p.stats?.goals||0) + ' A' + (p.stats?.assists||0) + ' S' + (p.stats?.saves||0) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    var power = { atk: national.atk||0, def: national.def||0, glb: national.glb||0 };
    html += '<div class="card" style="margin-top:0.3rem;"><div class="flex-center" style="gap:0.8rem;flex-wrap:wrap;"><span class="power-badge atk">ATK ' + power.atk + '</span><span class="power-badge def">DEF ' + power.def + '</span><span class="power-badge glb">GLB ' + power.glb + '</span></div></div>';
    return html;
  }

  function renderAmistosos(torneo) {
    if (!torneo.friendlyMatches || !torneo.friendlyMatches.length) return '<div class="empty-state"><i class="fa-solid fa-handshake-slash"></i>No hay partidos amistosos.</div>';
    var html = '';
    torneo.friendlyMatches.forEach(function(fm) {
      var h = getTeamById(torneo.teams, fm.h);
      var a = getTeamById(torneo.teams, fm.a);
      var played = fm.played || false;
      var score = played ? fm.sH + ' - ' + fm.sA : 'vs';
      var clickable = played ? 'class="match-clickable" onclick="showMatchStats(\'' + fm.id + '\')"' : '';
      html += '<div class="card"' + clickable + '><div class="flex-center" style="justify-content:space-between;">';
      html += '<span class="flex-center"><img src="' + (h?.shield || '') + '" class="shield-sm"> ' + (h?.name || 'Desconocido') + '</span>';
      html += '<span style="font-weight:700;font-size:1.1rem;">' + score + '</span>';
      html += '<span class="flex-center">' + (a?.name || 'Desconocido') + ' <img src="' + (a?.shield || '') + '" class="shield-sm"></span>';
      html += '</div></div>';
    });
    return html;
  }

  function renderSalon(torneo) {
    if (!torneo.seasons || !torneo.seasons.length) return '<div class="empty-state"><i class="fa-solid fa-medal"></i>No hay temporadas guardadas.</div>';
    var html = '';
    torneo.seasons.slice().reverse().forEach(function(season, idx) {
      var realIdx = torneo.seasons.length - idx;
      html += '<div class="card"><div class="card-header">Temporada ' + realIdx + ' - ' + new Date(season.date).toLocaleDateString('es-ES') + '</div>';
      var champ = season.champion ? season.teams.find(function(t) { return t.id === season.champion; }) : null;
      if (champ) {
        html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.3rem;"><span style="font-size:1.3rem;">🏆</span><img src="' + (champ.shield||'') + '" style="width:1.8rem;height:1.8rem;border-radius:50%;background:#000;border:1px solid var(--color-border);object-fit:contain;"><strong>' + champ.name + '</strong> <span style="font-size:0.65rem;color:var(--color-text-muted);">' + (champ.pts||0) + ' pts</span></div>';
      }
      var dt = season.dreamTeam || {};
      if (dt.goleador || dt.asistidor || dt.portero) {
        html += '<div style="font-size:0.65rem;display:flex;flex-wrap:wrap;gap:0.3rem 1rem;margin:0.2rem 0;">';
        if (dt.goleador) html += '<span><span class="text-neon-green">⚽</span> ' + dt.goleador.name + ' (' + dt.goleador.g + ')</span>';
        if (dt.asistidor) html += '<span><span class="text-neon-cyan">🎯</span> ' + dt.asistidor.name + ' (' + dt.asistidor.a + ')</span>';
        if (dt.portero) html += '<span><span class="text-neon-pink">🧤</span> ' + dt.portero.name + ' (' + dt.portero.s + ')</span>';
        html += '</div>';
      }
      html += '</div>';
    });
    return html;
  }

  // ==========================================
  // IMPRESIÓN DE SECCIONES
  // ==========================================
  function printTablaGeneral() {
    var container = document.querySelector('#section-tabla .table-wrap');
    if (!container) return alert('No hay tabla para imprimir.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('TABLA GENERAL') + clone.outerHTML + '<div style="margin-top:0.3rem;font-size:0.55rem;color:#94a3b8;">' + currentData.name + '</div>';
    showPrintModal(html, 'tabla_general.jpg', 900);
  }

  function printTablaMedia() {
    var container = document.querySelector('#section-media .table-wrap');
    if (!container) return alert('No hay tabla para imprimir.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('TABLA DE MEDIA') + clone.outerHTML + '<div style="margin-top:0.3rem;font-size:0.55rem;color:#94a3b8;">' + currentData.name + '</div>';
    showPrintModal(html, 'tabla_media.jpg', 900);
  }

  function printJornada() {
    if (!currentData.rounds || !currentData.rounds.length) return alert('No hay jornadas.');
    var options = currentData.rounds.map(function(_, i) { return '<option value="' + i + '">Jornada ' + (i+1) + '</option>'; }).join('');
    var modal = document.createElement('div');
    modal.className = 'print-modal-overlay';
    modal.innerHTML = '<div class="print-modal" style="max-width:400px;"><h3>Seleccionar Jornada</h3><select id="print-jornada-select" style="width:100%;padding:0.4rem;margin:0.4rem 0;background:#0a0a0f;color:#fff;border:1px solid var(--color-border);border-radius:8px;">' + options + '</select><div class="actions"><button class="btn-cancel" onclick="this.closest(\'.print-modal-overlay\').remove()">Cancelar</button><button class="btn-download" onclick="confirmPrintJornada()">Descargar</button></div></div>';
    document.body.appendChild(modal);

    window.confirmPrintJornada = function() {
      var idx = parseInt(document.getElementById('print-jornada-select').value);
      var round = currentData.rounds[idx];
      if (!round) return alert('Jornada no encontrada.');
      var html = getPrintHeader('JORNADA ' + (idx+1)) + '<div style="margin-top:0.2rem;"><table style="width:100%;border-collapse:collapse;font-size:0.7rem;">';
      html += '<thead><tr style="background:#1e1e2f;"><th style="padding:0.3rem 0.5rem;text-align:left;">Local</th><th style="padding:0.3rem 0.5rem;text-align:center;">Resultado</th><th style="padding:0.3rem 0.5rem;text-align:right;">Visitante</th></tr></thead><tbody>';
      round.forEach(function(m) {
        var h = getTeamById(currentData.teams, m.h);
        var a = getTeamById(currentData.teams, m.a);
        var played = m.played || false;
        var score = played ? m.sH + ' - ' + m.sA : 'vs';
        html += '<tr style="border-bottom:1px solid #2d2d44;"><td style="padding:0.2rem 0.5rem;">' + (h?.name || '???') + '</td><td style="padding:0.2rem 0.5rem;text-align:center;font-weight:700;">' + score + '</td><td style="padding:0.2rem 0.5rem;text-align:right;">' + (a?.name || '???') + '</td></tr>';
      });
      html += '</tbody></table></div>';
      showPrintModal(html, 'jornada_' + (idx+1) + '.jpg', 800);
      modal.remove();
    };
  }

  function printStats() {
    var modal = document.createElement('div');
    modal.className = 'print-modal-overlay';
    modal.innerHTML = '<div class="print-modal" style="max-width:400px;"><h3>Imprimir Stats</h3><p style="font-size:0.75rem;color:var(--color-text-muted);">Usa el botón Imprimir del navegador para guardar como PDF.</p><div class="actions"><button class="btn-cancel" onclick="this.closest(\'.print-modal-overlay\').remove()">Cerrar</button></div></div>';
    document.body.appendChild(modal);
  }

  function printBalon() {
    var modal = document.createElement('div');
    modal.className = 'print-modal-overlay';
    modal.innerHTML = '<div class="print-modal" style="max-width:400px;"><h3>Balón de Oro</h3><p style="font-size:0.75rem;color:var(--color-text-muted);">Usa el botón Imprimir del navegador para guardar como PDF.</p><div class="actions"><button class="btn-cancel" onclick="this.closest(\'.print-modal-overlay\').remove()">Cerrar</button></div></div>';
    document.body.appendChild(modal);
  }

  function printEquipos() {
    var modal = document.createElement('div');
    modal.className = 'print-modal-overlay';
    modal.innerHTML = '<div class="print-modal" style="max-width:400px;"><h3>Imprimir Equipos</h3><p style="font-size:0.75rem;color:var(--color-text-muted);">Usa el botón Imprimir del navegador.</p><div class="actions"><button class="btn-cancel" onclick="this.closest(\'.print-modal-overlay\').remove()">Cerrar</button></div></div>';
    document.body.appendChild(modal);
  }

  function printMercado() {
    var modal = document.createElement('div');
    modal.className = 'print-modal-overlay';
    modal.innerHTML = '<div class="print-modal" style="max-width:400px;"><h3>Imprimir Mercado</h3><p style="font-size:0.75rem;color:var(--color-text-muted);">Usa el botón Imprimir del navegador.</p><div class="actions"><button class="btn-cancel" onclick="this.closest(\'.print-modal-overlay\').remove()">Cerrar</button></div></div>';
    document.body.appendChild(modal);
  }

  function printSanciones() {
    var container = document.querySelector('#section-sanciones .table-wrap');
    if (!container) return alert('No hay sanciones.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('Sanciones') + clone.outerHTML;
    showPrintModal(html, 'sanciones.jpg', 900);
  }

  function printSeleccion() {
    var container = document.querySelector('#section-seleccion .card');
    if (!container) return alert('No hay selección.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('Selección Nacional') + clone.outerHTML;
    showPrintModal(html, 'seleccion.jpg', 700);
  }

  function printAmistosos() {
    var container = document.querySelector('#section-amistosos');
    if (!container) return alert('No hay amistosos.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('Partidos Amistosos') + clone.innerHTML;
    showPrintModal(html, 'amistosos.jpg', 800);
  }

  function printSalon() {
    var container = document.querySelector('#section-salon');
    if (!container) return alert('No hay salón.');
    var clone = container.cloneNode(true);
    var html = getPrintHeader('Salón de la Fama') + clone.innerHTML;
    showPrintModal(html, 'salon_fama.jpg', 800);
  }

  // ==========================================
  // EVENTOS
  // ==========================================
  hamburgerBtn.addEventListener('click', function() {
    sidebar.classList.toggle('open');
  });
  document.addEventListener('click', function(e) {
    if (window.innerWidth <= 820) {
      if (!sidebar.contains(e.target) && e.target !== hamburgerBtn && !hamburgerBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    }
  });

  // ==========================================
  // INICIO
  // ==========================================
  loadAllData();