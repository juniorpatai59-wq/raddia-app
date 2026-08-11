import { useState, useEffect, useCallback } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

/* ============================================================
   RADDIA — APP GESTIONNAIRE (assemblage des parties 1 à 7)
   Un seul fichier ici pour l'artefact, mais organisé exactement
   comme les 7 briques qu'on a construites une à une.
   ============================================================ */

/* ==================== PARTIE 1 — FONDATIONS ==================== */
const C = {
  bg: "#07070f", bg2: "#0d0d1a", surface: "#12121f",
  border: "rgba(255,255,255,0.08)", borderSoft: "rgba(255,255,255,0.05)",
  text: "#eeeef5", muted: "#6b7280", dim: "#3a3a4a",
  green: "#10b981", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6", purple: "#8b5cf6",
};
const FONT = "'JetBrains Mono', 'Fira Code', 'Courier New', monospace";

const STATUS_CONFIG = {
  free:     { bg: "rgba(255,255,255,0.02)", led: C.dim,   label: "Libre" },
  charging: { bg: "rgba(245,158,11,0.07)",  led: C.amber, label: "En charge" },
  ready:    { bg: "rgba(16,185,129,0.07)",  led: C.green, label: "Prêt" },
  fault:    { bg: "rgba(239,68,68,0.09)",   led: C.red,   label: "Erreur" },
};
const batteryColor = (pct) => (pct >= 80 ? C.green : pct >= 40 ? C.amber : C.red);

const BORNES = [
  { id: "DKR-01", name: "RADDIA-DKR-01", loc: "Aéroport LSS · Terminal 1", status: "online" },
  { id: "DKR-02", name: "RADDIA-DKR-02", loc: "Centre Commercial Almadies", status: "online" },
  { id: "DKR-03", name: "RADDIA-DKR-03", loc: "Hôtel Terrou-Bi", status: "degraded" },
];

function seedSlots(seedBias = 0) {
  return Array.from({ length: 50 }, (_, i) => {
    const r = (Math.sin(i * 12.9898 + seedBias * 7.233) * 43758.5453) % 1;
    const v = Math.abs(r);
    const status = v < 0.28 ? "free" : v < 0.62 ? "charging" : v < 0.94 ? "ready" : "fault";
    const battery = status === "free" ? 0 : status === "charging" ? Math.floor(v * 60) + 8 : status === "ready" ? 100 : Math.floor(v * 25);
    return {
      id: i + 1, status, battery,
      phone: status !== "free" ? (v > 0.5 ? "Android" : "iOS") : null,
      timeLeft: status === "charging" ? Math.floor((100 - battery) * 0.9) : null,
      since: status !== "free" ? Date.now() - Math.floor(v * 3600000) : null,
    };
  });
}

function tickSlots(slots) {
  return slots.map((s) => {
    if (s.status === "charging") {
      const nextBattery = Math.min(100, s.battery + Math.random() * 2.2);
      if (nextBattery >= 100) return { ...s, status: "ready", battery: 100, timeLeft: null };
      return { ...s, battery: nextBattery, timeLeft: Math.max(0, Math.round((100 - nextBattery) * 0.9)) };
    }
    if (s.status === "ready" && Math.random() < 0.05) {
      return { ...s, status: "free", battery: 0, phone: null, timeLeft: null, since: null };
    }
    if (s.status === "free" && Math.random() < 0.035) {
      const phone = Math.random() > 0.5 ? "Android" : "iOS";
      return { ...s, status: "charging", battery: 3, phone, timeLeft: 88, since: Date.now() };
    }
    if (s.status === "charging" && Math.random() < 0.004) return { ...s, status: "fault" };
    return s;
  });
}

const HOURLY_USAGE = [
  { h: "06h", v: 4 }, { h: "08h", v: 22 }, { h: "10h", v: 35 }, { h: "12h", v: 41 },
  { h: "14h", v: 38 }, { h: "16h", v: 44 }, { h: "18h", v: 47 }, { h: "20h", v: 30 }, { h: "22h", v: 11 },
];

/* ==================== PARTIE 2 — COMPOSANTS D'AFFICHAGE ==================== */
function Led({ color, blink }) {
  return (
    <div style={{
      width: 7, height: 7, borderRadius: "50%", background: color,
      boxShadow: `0 0 6px ${color}`, flexShrink: 0,
      animation: blink ? "blink 1.2s ease-in-out infinite" : undefined,
    }} />
  );
}

function StatPill({ label, value, color, active, onClick }) {
  return (
    <button onClick={onClick} className="stat-pill" style={{
      borderColor: active ? color : C.border,
      background: active ? `${color}1a` : "rgba(255,255,255,0.02)",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1.5, marginTop: 4 }}>{label}</div>
    </button>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 20px", color: C.dim }}>
      <div style={{ fontSize: 32, marginBottom: 10, color: C.muted }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.muted, letterSpacing: 0.5 }}>{text}</div>
    </div>
  );
}

function SlotCell({ slot, onSelect }) {
  const cfg = STATUS_CONFIG[slot.status];
  return (
    <button onClick={() => onSelect(slot.id)} className="slot-cell" style={{ background: cfg.bg, borderColor: `${cfg.led}44` }}>
      <Led color={cfg.led} blink={slot.status === "charging"} />
      <div style={{ fontSize: 10, fontWeight: 700, color: C.text, fontVariantNumeric: "tabular-nums" }}>
        {String(slot.id).padStart(2, "0")}
      </div>
      {slot.status !== "free" && (
        <div className="mini-bar">
          <div style={{ height: "100%", width: `${slot.battery}%`, background: batteryColor(slot.battery), borderRadius: 2 }} />
        </div>
      )}
    </button>
  );
}

function InfoTile({ label, val }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 9, color: C.muted, letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700 }}>{val}</div>
    </div>
  );
}

function SlotDetail({ slot, onClose, onUnlock }) {
  if (!slot) return null;
  const cfg = STATUS_CONFIG[slot.status];
  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-panel" onClick={(e) => e.stopPropagation()} style={{ background: `linear-gradient(160deg, ${C.surface}, ${C.bg2})`, borderColor: `${cfg.led}55` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2 }}>CASIER</div>
            <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>{String(slot.id).padStart(3, "0")}</div>
          </div>
          <button onClick={onClose} style={btnGhost}>✕</button>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: `${cfg.led}1f`, border: `1px solid ${cfg.led}`, borderRadius: 20, padding: "6px 14px", marginBottom: 20 }}>
          <Led color={cfg.led} blink={slot.status === "charging"} />
          <span style={{ fontSize: 12, color: cfg.led, fontWeight: 700, letterSpacing: 1 }}>{cfg.label.toUpperCase()}</span>
        </div>

        {slot.status === "free" ? (
          <EmptyState icon="○" text="Casier disponible — aucun appareil en dépôt." />
        ) : (
          <>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>NIVEAU DE BATTERIE</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: batteryColor(slot.battery) }}>{Math.round(slot.battery)}%</span>
              </div>
              <div style={{ height: 8, background: "rgba(255,255,255,0.07)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${slot.battery}%`, background: batteryColor(slot.battery), borderRadius: 4, transition: "width .5s" }} />
              </div>
            </div>
            <div className="detail-grid">
              <InfoTile label="APPAREIL" val={slot.phone} />
              <InfoTile label="CONNECTEUR" val={slot.phone === "iOS" ? "Lightning" : "USB-C"} />
              {slot.status === "charging" && <InfoTile label="TEMPS RESTANT" val={`~${slot.timeLeft} min`} />}
              <InfoTile label="PUISSANCE" val="18 W" />
            </div>
          </>
        )}

        <button
          onClick={() => onUnlock(slot.id)}
          disabled={slot.status === "free" || slot.status === "charging"}
          style={{
            width: "100%", marginTop: 20, padding: 14, borderRadius: 10, fontSize: 13, fontWeight: 700, letterSpacing: 1.5,
            fontFamily: FONT, cursor: slot.status === "free" || slot.status === "charging" ? "default" : "pointer",
            border: `1px solid ${cfg.led}44`,
            background: slot.status === "ready" ? C.green : slot.status === "fault" ? C.red : "rgba(255,255,255,0.05)",
            color: slot.status === "ready" || slot.status === "fault" ? "#07070f" : C.muted,
          }}
        >
          {slot.status === "ready" ? "🔓 DÉVERROUILLER" :
           slot.status === "fault" ? "⚠ FORCER LE RESET" :
           slot.status === "charging" ? "CHARGE EN COURS…" : "AUCUNE ACTION"}
        </button>
      </div>
    </div>
  );
}

const btnGhost = {
  background: "none", border: `1px solid ${C.border}`, color: C.muted, padding: "5px 10px",
  borderRadius: 6, cursor: "pointer", fontSize: 10, letterSpacing: 1, fontFamily: FONT,
};

/* ==================== PARTIE 3 — VUE CASIERS ==================== */
const STATUS_LABEL = { free: "Libre", charging: "En charge", ready: "Prêt", fault: "Erreur" };

function CasiersView({ slots, filter, setFilter, onSelect, stats, borneName }) {
  const filtered = filter === "all" ? slots : slots.filter((s) => s.status === filter);
  return (
    <div>
      <div className="stats-row">
        <StatPill label="LIBRES" value={stats.free} color="#9aa0b0" active={filter === "free"} onClick={() => setFilter(filter === "free" ? "all" : "free")} />
        <StatPill label="EN CHARGE" value={stats.charging} color={C.amber} active={filter === "charging"} onClick={() => setFilter(filter === "charging" ? "all" : "charging")} />
        <StatPill label="PRÊTS" value={stats.ready} color={C.green} active={filter === "ready"} onClick={() => setFilter(filter === "ready" ? "all" : "ready")} />
        <StatPill label="ERREURS" value={stats.fault} color={C.red} active={filter === "fault"} onClick={() => setFilter(filter === "fault" ? "all" : "fault")} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 10px" }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1 }}>
          {borneName} · {filter === "all" ? `${slots.length} CASIERS` : `FILTRE ${STATUS_LABEL[filter].toUpperCase()} (${filtered.length})`}
        </div>
        {filter !== "all" && <button onClick={() => setFilter("all")} style={btnGhost}>× EFFACER</button>}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="○" text="Aucun casier dans cet état pour le moment." />
      ) : (
        <div className="slot-grid">
          {filtered.map((slot) => <SlotCell key={slot.id} slot={slot} onSelect={onSelect} />)}
        </div>
      )}
    </div>
  );
}

/* ==================== PARTIE 4 — VUE ALERTES ==================== */
function AlertsView({ slots, onSelect }) {
  const faults = slots.filter((s) => s.status === "fault");
  const readies = slots.filter((s) => s.status === "ready");
  if (faults.length === 0 && readies.length === 0) return <EmptyState icon="◉" text="Aucune alerte active. Tout fonctionne normalement." />;
  return (
    <div>
      {faults.length > 0 && (
        <>
          <SectionLabel text={`INCIDENTS (${faults.length})`} />
          {faults.map((s) => (
            <AlertRow key={s.id} slot={s} color={C.red} title={`Casier ${String(s.id).padStart(3, "0")} — Erreur détectée`} desc={`Batterie ${Math.round(s.battery)}% · Vérification requise`} onSelect={onSelect} />
          ))}
        </>
      )}
      {readies.length > 0 && (
        <>
          <SectionLabel text={`CHARGES COMPLÈTES (${readies.length})`} />
          {readies.map((s) => (
            <AlertRow key={s.id} slot={s} color={C.green} title={`Casier ${String(s.id).padStart(3, "0")} — Charge complète`} desc="Prêt à être récupéré" onSelect={onSelect} />
          ))}
        </>
      )}
    </div>
  );
}
function SectionLabel({ text }) {
  return <div style={{ fontSize: 10, color: C.muted, letterSpacing: 2, margin: "18px 0 8px" }}>{text}</div>;
}
function AlertRow({ slot, color, title, desc, onSelect }) {
  return (
    <button onClick={() => onSelect(slot.id)} className="alert-row" style={{ background: `${color}12`, borderColor: `${color}33` }}>
      <Led color={color} />
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{desc}</div>
      </div>
    </button>
  );
}

/* ==================== PARTIE 5 — VUE STATISTIQUES ==================== */
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
function SettingsView({ borne }) {
  const rows = [
    { label: "Nom de la borne", val: borne.name },
    { label: "Emplacement", val: borne.loc },
    { label: "Puissance par casier", val: "18 W (Quick Charge)" },
    { label: "Connexion", val: "Wi-Fi 802.11ac + 4G LTE backup" },
    { label: "Chiffrement", val: "TLS 1.3" },
    { label: "Batterie de secours (UPS)", val: "Autonomie 30 min" },
  ];
  return (
    <div>
      <SectionLabel text="INFORMATIONS BORNE" />
      <div className="chart-card">
        {rows.map((r, i) => (
          <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${C.borderSoft}`, fontSize: 12 }}>
            <span style={{ color: C.muted }}>{r.label}</span>
            <span style={{ fontWeight: 700 }}>{r.val}</span>
          </div>
        ))}
      </div>
      <SectionLabel text="NOTIFICATIONS" />
      <div className="chart-card" style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
        Alertes push : incident, charge complète, seuil critique.<br />
        Ces réglages seront connectés au vrai backend lors de l'intégration MQTT/API.
      </div>
    </div>
  );
}

/* ==================== PARTIE 8 — AUTHENTIFICATION ==================== */
// ⚠️ Vérification simulée en local — à remplacer par un vrai appel API (JWT)
// vers le backend dès qu'il existera. Structure volontairement simple.
const DEMO_USERS = [
  { email: "admin@raddia.sn", password: "raddia2026", name: "Admin principal", role: "Administrateur" },
];

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit() {
    if (loading) return;
    setError("");
    setLoading(true);
    setTimeout(() => {
      const user = DEMO_USERS.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );
      if (user) onLogin(user);
      else setError("Identifiants incorrects. Vérifiez votre email et mot de passe.");
      setLoading(false);
    }, 500);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div className="login-root">
      <style>{LOGIN_CSS}</style>
      <div className="login-card">
        <div className="login-brand">
          <div className="logo">RADDIA</div>
          <div className="logo-sub">SYSTÈME DE CHARGE INTELLIGENT</div>
        </div>
        <div className="login-heading">Connexion gestionnaire</div>
        <div className="login-sub">Accédez au pilotage temps réel de vos bornes</div>
        <div>
          <label className="login-label">EMAIL</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={handleKeyDown} placeholder="admin@raddia.sn" className="login-input" autoComplete="username" />
          <label className="login-label">MOT DE PASSE</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={handleKeyDown} placeholder="••••••••" className="login-input" autoComplete="current-password" />
          {error && <div className="login-error">{error}</div>}
          <button type="button" onClick={handleSubmit} className="login-btn" disabled={loading}>{loading ? "CONNEXION…" : "SE CONNECTER"}</button>
        </div>
        <div className="login-demo">Démo : admin@raddia.sn / raddia2026</div>
      </div>
    </div>
  );
}

const LOGIN_CSS = `
  .login-root { font-family: ${FONT}; background: ${C.bg}; color: ${C.text}; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .login-card { width: 100%; max-width: 380px; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; padding: 32px 28px; }
  .login-brand { text-align: center; margin-bottom: 28px; }
  .login-brand .logo { font-size: 24px; font-weight: 800; letter-spacing: 6px; color: ${C.green}; }
  .login-brand .logo-sub { font-size: 8px; color: ${C.muted}; letter-spacing: 2px; margin-top: 4px; }
  .login-heading { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .login-sub { font-size: 11px; color: ${C.muted}; margin-bottom: 24px; }
  .login-label { display: block; font-size: 9px; color: ${C.muted}; letter-spacing: 1.5px; margin-bottom: 6px; margin-top: 14px; }
  .login-label:first-of-type { margin-top: 0; }
  .login-input { width: 100%; background: rgba(255,255,255,0.03); border: 1px solid ${C.border}; border-radius: 8px; padding: 11px 12px; color: ${C.text}; font-family: ${FONT}; font-size: 13px; outline: none; transition: border-color .15s; }
  .login-input:focus { border-color: ${C.green}88; }
  .login-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #f87171; font-size: 11px; padding: 9px 11px; border-radius: 8px; margin-top: 14px; }
  .login-btn { width: 100%; margin-top: 22px; padding: 13px; border-radius: 8px; border: none; background: ${C.green}; color: #07070f; font-family: ${FONT}; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; cursor: pointer; transition: opacity .15s; }
  .login-btn:disabled { opacity: 0.6; cursor: default; }
  .login-btn:not(:disabled):hover { opacity: 0.9; }
  .login-demo { text-align: center; font-size: 10px; color: ${C.dim}; margin-top: 18px; }
`;

/* ==================== PARTIE 7 — NAVIGATION + ASSEMBLAGE FINAL ==================== */
const NAV_ITEMS = [
  { id: "dashboard", icon: "⊞", label: "CASIERS" },
  { id: "alerts", icon: "◉", label: "ALERTES" },
  { id: "stats", icon: "▣", label: "STATS" },
  { id: "settings", icon: "◈", label: "RÉGLAGES" },
];

export default function RADDIAApp() {
  const [user, setUser] = useState(null);
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
    return <LoginScreen onLogin={setUser} />;
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
          <button onClick={() => setUser(null)} className="logout-btn">SE DÉCONNECTER</button>
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
            <button onClick={() => setUser(null)} className="logout-btn-mobile" title="Se déconnecter">⏻</button>
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
    min-height: 100vh; display: grid; grid-template-columns: 1fr; grid-template-rows: auto 1fr auto;
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

    .main-col { display: flex; flex-direction: column; min-height: 100vh; }
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
