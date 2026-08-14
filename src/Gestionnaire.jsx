import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import {
  C, FONT, STATUS_CONFIG, batteryColor, BORNES, seedSlots, tickSlots, HOURLY_USAGE,
  Led, StatPill, EmptyState, SlotCell, InfoTile, SlotDetail, btnGhost,
  usePersistentState, LoginScreen,
} from "./App.jsx";

/* ============================================================
   RADDIA — GESTIONNAIRE.JSX
   Isolé dans son propre fichier pour être chargé à la demande
   (lazy loading) : un client qui ne fait que scanner un QR code
   n'a jamais besoin de télécharger recharts ni tout ce module.
   ============================================================ */

function StatsView({ stats, slots }) {
  const androidCount = slots.filter((s) => s.phone === "Android").length;
  const iosCount = slots.filter((s) => s.phone === "iOS").length;
  const total = androidCount + iosCount || 1;
  return (
    <div>
      <div className="stats-row">
        <StatPill label="LIBRES" value={stats.free} color="#9aa0b0" />
        <StatPill label="EN CHARGE" value={stats.charging} color={C.amber} />
        <StatPill label="PRÊTS" value={stats.ready} color={C.green} />
        <StatPill label="ERREURS" value={stats.fault} color={C.red} />
      </div>

      <div className="two-col">
        <div className="chart-card">
          <div className="chart-title">UTILISATION PAR HEURE</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={HOURLY_USAGE}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
              <XAxis dataKey="h" tick={{ fill: C.muted, fontSize: 9, fontFamily: FONT }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 9, fontFamily: FONT }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: FONT }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="v" fill={C.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-title">RÉPARTITION APPAREILS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
            <DeviceBar label="Android" count={androidCount} total={total} color={C.blue} />
            <DeviceBar label="iOS" count={iosCount} total={total} color={C.purple} />
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: 14 }}>
        <div className="chart-title">RÉSUMÉ ÉTAT GÉNÉRAL</div>
        <table className="summary-table">
          <tbody>
            <tr><td>Taux d'occupation</td><td>{Math.round(((stats.charging + stats.ready) / stats.total) * 100)}%</td></tr>
            <tr><td>Taux de disponibilité</td><td>{Math.round((stats.free / stats.total) * 100)}%</td></tr>
            <tr><td>Casiers en incident</td><td style={{ color: stats.fault > 0 ? C.red : C.green }}>{stats.fault}</td></tr>
            <tr><td>Latence moyenne capteurs</td><td>0.8s</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
function DeviceBar({ label, count, total, color }) {
  const pct = Math.round((count / total) * 100);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
        <span style={{ color: C.text }}>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{count} · {pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

/* ==================== PARTIE 6 — VUE RÉGLAGES ==================== */

function GestionnaireApp({ onExit }) {
  const [user, setUser] = usePersistentState("raddia_gestionnaire_user", null);
  const [borneIdx, setBorneIdx] = useState(0);
  const [slotsByBorne, setSlotsByBorne] = useState(() => BORNES.map((_, i) => seedSlots(i)));
  const [view, setView] = useState("dashboard");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [time, setTime] = useState(new Date());
  const [toast, setToast] = useState(null);

  // Horloge en temps réel dans l'en-tête
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Moteur de simulation : ne fait évoluer que la borne actuellement affichée
  useEffect(() => {
    const t = setInterval(() => {
      setSlotsByBorne((prev) => prev.map((slots, i) => (i === borneIdx ? tickSlots(slots) : slots)));
    }, 1800);
    return () => clearInterval(t);
  }, [borneIdx]);

  const slots = slotsByBorne[borneIdx];
  const stats = {
    total: slots.length,
    free: slots.filter((s) => s.status === "free").length,
    charging: slots.filter((s) => s.status === "charging").length,
    ready: slots.filter((s) => s.status === "ready").length,
    fault: slots.filter((s) => s.status === "fault").length,
  };
  const sel = selected !== null ? slots.find((s) => s.id === selected) : null;

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const handleUnlock = useCallback((id) => {
    setSlotsByBorne((prev) =>
      prev.map((bslots, i) =>
        i !== borneIdx ? bslots : bslots.map((s) => (s.id === id ? { ...s, status: "free", battery: 0, phone: null, timeLeft: null, since: null } : s))
      )
    );
    showToast(`Casier ${String(id).padStart(3, "0")} déverrouillé`);
    setSelected(null);
  }, [borneIdx, showToast]);

  const goto = (v) => { setView(v); setFilter("all"); setSelected(null); };

  // Tant qu'aucun utilisateur n'est connecté, on affiche uniquement l'écran de connexion
  if (!user) {
    return <LoginScreen onLogin={setUser} onExit={onExit} />;
  }

  return (
    <div className="raddia-root">
      <style>{CSS}</style>

      {/* Sidebar — visible uniquement en desktop (>= 900px), gérée en CSS */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">RADDIA</div>
          <div className="logo-sub">SYSTÈME DE CHARGE INTELLIGENT</div>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">NAVIGATION</div>
          {NAV_ITEMS.map((n) => (
            <div key={n.id} className={`nav-item ${view === n.id ? "active" : ""}`} onClick={() => goto(n.id)}>
              <span className="nav-icon">{n.icon}</span> {n.label}
              {n.id === "alerts" && stats.fault > 0 && <span className="nav-badge">{stats.fault}</span>}
            </div>
          ))}
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">BORNES ACTIVES</div>
          {BORNES.map((b, i) => (
            <div key={b.id} className={`sidebar-borne ${i === borneIdx ? "selected" : ""}`} onClick={() => { setBorneIdx(i); setFilter("all"); }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Led color={b.status === "online" ? C.green : C.amber} />
                <div className="borne-name">{b.name}</div>
              </div>
              <div className="borne-loc">{b.loc}</div>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <div style={{ fontSize: 10, color: C.muted }}>Connecté en tant que</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{user.name}</div>
          <div style={{ fontSize: 9, color: C.green, marginTop: 2 }}>{user.email}</div>
          <button onClick={() => { setUser(null); onExit && onExit(); }} className="logout-btn">SE DÉCONNECTER</button>
        </div>
      </aside>

      {/* Colonne principale */}
      <div className="main-col">
        <header className="topbar">
          <div className="mobile-logo">
            <div className="logo">RADDIA</div>
            <div className="logo-sub">{BORNES[borneIdx].name}</div>
          </div>
          <div className="topbar-title">{NAV_ITEMS.find((n) => n.id === view)?.label}</div>
          <div className="topbar-right">
            <div className="clock">{time.toLocaleTimeString("fr-FR")}</div>
            <div className="online-badge"><span className="online-dot" />EN LIGNE</div>
            <button onClick={() => { setUser(null); onExit && onExit(); }} className="logout-btn-mobile" title="Se déconnecter" aria-label="Se déconnecter">⏻</button>
          </div>
        </header>

        <main className="content">
          {view === "dashboard" && <CasiersView slots={slots} filter={filter} setFilter={setFilter} onSelect={setSelected} stats={stats} borneName={BORNES[borneIdx].name} />}
          {view === "alerts" && <AlertsView slots={slots} onSelect={setSelected} />}
          {view === "stats" && <StatsView stats={stats} slots={slots} />}
          {view === "settings" && <SettingsView borne={BORNES[borneIdx]} />}
        </main>
      </div>

      {/* Nav du bas — visible uniquement en mobile (< 900px), gérée en CSS */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map((n) => (
          <button key={n.id} className={`bn-item ${view === n.id ? "active" : ""}`} onClick={() => goto(n.id)}>
            <div className="bn-icon">{n.icon}</div>
            <div className="bn-label">{n.label}</div>
            {n.id === "alerts" && stats.fault > 0 && <span className="bn-badge">{stats.fault}</span>}
          </button>
        ))}
      </nav>

      <SlotDetail slot={sel} onClose={() => setSelected(null)} onUnlock={handleUnlock} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

/* ---------- CSS RESPONSIVE ---------- */
// Mobile-first : par défaut nav en bas + grille 5 colonnes.
// À partir de 900px (media query en bas) : sidebar + grille 10 colonnes.
const CSS = `
  * { box-sizing: border-box; }
  .raddia-root {
    font-family: ${FONT}; background: ${C.bg}; color: ${C.text};
    min-height: 100vh; min-height: 100dvh; display: grid; grid-template-columns: 1fr; grid-template-rows: auto 1fr auto;
  }
  .sidebar { display: none; }
  .mobile-logo { display: flex; flex-direction: column; }
  .topbar-title { display: none; }

  .topbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px; border-bottom: 1px solid ${C.border};
    background: rgba(7,7,15,0.9); backdrop-filter: blur(16px);
    position: sticky; top: 0; z-index: 20;
  }
  .logo { font-size: 18px; font-weight: 800; letter-spacing: 5px; color: ${C.green}; }
  .logo-sub { font-size: 8px; color: ${C.muted}; letter-spacing: 2px; margin-top: 2px; }
  .topbar-right { display: flex; align-items: center; gap: 12px; }
  .clock { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .online-badge { display: flex; align-items: center; gap: 5px; font-size: 8px; color: ${C.muted}; letter-spacing: 1px; }
  .online-dot { width: 6px; height: 6px; border-radius: 50%; background: ${C.green}; animation: pulse 2s infinite; }
  .logout-btn-mobile {
    background: none; border: 1px solid ${C.border}; color: ${C.muted}; width: 26px; height: 26px;
    border-radius: 50%; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
  }
  .sidebar-footer { margin-top: auto; padding: 16px 20px; border-top: 1px solid ${C.border}; }
  .logout-btn {
    width: 100%; margin-top: 12px; padding: 8px; border-radius: 7px; border: 1px solid ${C.border};
    background: none; color: ${C.muted}; font-family: ${FONT}; font-size: 9px; letter-spacing: 1px;
    cursor: pointer; transition: all .15s;
  }
  .logout-btn:hover { border-color: ${C.red}66; color: #f87171; }

  .content { padding: 16px 16px 90px; max-width: 1100px; width: 100%; margin: 0 auto; }

  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .stat-pill { font-family: ${FONT}; border: 1px solid ${C.border}; border-radius: 10px; padding: 10px 4px; text-align: center; transition: all .15s; }

  .slot-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
  .slot-cell {
    aspect-ratio: 1; border-radius: 9px; border: 1px solid; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    font-family: ${FONT}; transition: transform .1s;
  }
  .slot-cell:hover { transform: translateY(-1px); }
  .mini-bar { width: 70%; height: 3px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }

  .two-col { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 14px; }
  .chart-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 12px; padding: 14px; }
  .chart-title { font-size: 10px; color: ${C.muted}; letter-spacing: 1.5px; margin-bottom: 10px; }
  .summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .summary-table td { padding: 8px 0; border-top: 1px solid ${C.borderSoft}; }
  .summary-table td:first-child { color: ${C.muted}; }
  .summary-table td:last-child { text-align: right; font-weight: 700; }
  .summary-table tr:first-child td { border-top: none; }

  .alert-row {
    width: 100%; display: flex; align-items: center; gap: 12px; text-align: left;
    border: 1px solid; border-radius: 10px; padding: 13px 14px; margin-bottom: 8px;
    cursor: pointer; font-family: ${FONT};
  }

  .detail-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    display: flex; align-items: flex-end; justify-content: center; z-index: 100;
  }
  .detail-panel { width: 100%; max-width: 480px; border: 1px solid; border-radius: 20px 20px 0 0; padding: 24px; animation: slideUp .25s ease; }
  .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

  .toast {
    position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
    background: ${C.surface}; border: 1px solid ${C.green}55; color: ${C.text};
    padding: 10px 18px; border-radius: 10px; font-size: 12px; z-index: 200;
    animation: fadeInUp .25s ease;
  }

  .bottom-nav { display: flex; border-top: 1px solid ${C.border}; background: rgba(7,7,15,0.97); backdrop-filter: blur(16px); position: sticky; bottom: 0; z-index: 20; }
  .bn-item { flex: 1; background: none; border: none; padding: 10px 0; cursor: pointer; color: ${C.dim}; font-family: ${FONT}; position: relative; }
  .bn-item.active { color: ${C.green}; }
  .bn-icon { font-size: 17px; }
  .bn-label { font-size: 8px; letter-spacing: 1px; margin-top: 3px; }
  .bn-badge {
    position: absolute; top: 4px; right: 30%; background: ${C.red}; color: #fff;
    border-radius: 50%; width: 14px; height: 14px; font-size: 8px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }

  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
  @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
  @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes fadeInUp { from { transform: translate(-50%, 8px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }

  /* ============ DESKTOP (>= 900px) ============ */
  @media (min-width: 900px) {
    .raddia-root { grid-template-columns: 240px 1fr; grid-template-rows: 1fr; }
    .sidebar { display: flex; flex-direction: column; background: ${C.bg2}; border-right: 1px solid ${C.border}; padding: 20px 0; overflow-y: auto; }
    .sidebar-brand { padding: 0 20px 20px; }
    .sidebar-section { padding: 0 12px; margin-bottom: 10px; }
    .sidebar-label { font-size: 8px; color: ${C.muted}; letter-spacing: 2px; padding: 8px; }
    .nav-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px;
      cursor: pointer; color: ${C.muted}; font-size: 12px; letter-spacing: 1px; border: 1px solid transparent;
      position: relative; transition: all .15s;
    }
    .nav-item:hover { background: rgba(255,255,255,0.03); }
    .nav-item.active { background: rgba(16,185,129,0.08); border-color: ${C.green}33; color: ${C.green}; }
    .nav-badge { position: absolute; right: 10px; background: ${C.red}; color: #fff; border-radius: 10px; font-size: 9px; padding: 1px 6px; font-weight: 700; }
    .sidebar-borne { padding: 10px 12px; border-radius: 8px; cursor: pointer; margin-bottom: 4px; border: 1px solid transparent; }
    .sidebar-borne:hover { background: rgba(255,255,255,0.02); }
    .sidebar-borne.selected { background: rgba(255,255,255,0.04); border-color: ${C.border}; }
    .borne-name { font-size: 11px; font-weight: 700; }
    .borne-loc { font-size: 9px; color: ${C.muted}; margin-top: 3px; margin-left: 13px; }

    .main-col { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
    .mobile-logo { display: none; }
    .topbar-title { display: block; font-size: 13px; letter-spacing: 3px; color: ${C.muted}; }
    .bottom-nav { display: none; }
    .content { padding: 24px 32px 32px; }

    .slot-grid { grid-template-columns: repeat(10, 1fr); }
    .two-col { grid-template-columns: 1fr 1fr; }
    .detail-overlay { align-items: center; }
    .detail-panel { border-radius: 20px; }
  }
`;

/* ============================================================
   RADDIA — PARTIE 14 : FILET DE SÉCURITÉ (ERROR BOUNDARY)
   Empêche qu'une erreur JS n'importe où dans l'app ne fasse
   disparaître toute l'interface (écran noir silencieux).
   ============================================================ */

// Les Error Boundary DOIVENT être des classes en React — c'est la seule API
// qui permette d'intercepter une erreur survenue pendant le rendu d'un composant.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // En attendant un vrai backend de supervision, on log au moins dans la console
    // pour qu'un développeur puisse diagnostiquer via les outils du navigateur.
    console.error("RADDIA — erreur interceptée :", error, info);
  }

  handleReload = () => {
    // Rechargement complet : le moyen le plus fiable de repartir d'un état sain
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="crash-root">
        <style>{CRASH_CSS}</style>
        <div className="crash-icon">⚠</div>
        <div className="crash-title">Un problème est survenu</div>
        <div className="crash-sub">
          L'application a rencontré une erreur inattendue.<br />
          Vos données n'ont pas été perdues — rechargez la page pour continuer.
        </div>
        <button className="crash-btn" onClick={this.handleReload}>RECHARGER LA PAGE</button>
      </div>
    );
  }
}

const CRASH_CSS = `
  .crash-root {
    font-family: ${FONT}; background: ${C.bg}; color: ${C.text}; min-height: 100vh; min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
  }
  .crash-icon { font-size: 40px; margin-bottom: 18px; color: ${C.amber}; }
  .crash-title { font-size: 16px; font-weight: 700; margin-bottom: 10px; }
  .crash-sub { font-size: 12px; color: ${C.muted}; line-height: 1.7; margin-bottom: 26px; max-width: 320px; }
  .crash-btn {
    background: ${C.green}; color: #07070f; border: none; padding: 14px 26px; border-radius: 12px;
    font-family: ${FONT}; font-size: 12px; font-weight: 800; letter-spacing: 1px; cursor: pointer;
  }
  .crash-btn:hover { opacity: 0.9; }
`;

/* ==================== PARTIE 13 — ROUTEUR RACINE (ASSEMBLAGE FINAL) ==================== */
// Enchaîne le parcours client : scan -> suivi de charge -> récupération

export default GestionnaireApp;
