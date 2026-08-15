import { useState, useEffect, useCallback, useRef, Component, lazy, Suspense } from "react";

/* ---------- PERSISTANCE LÉGÈRE (localStorage) ----------
   Évite qu'un rafraîchissement accidentel de la page ne déconnecte
   l'exploitant ou ne fasse perdre au client le fil de son casier.
   Protégé par try/catch : certains contextes (navigation privée
   restrictive) bloquent localStorage — l'app doit continuer à
   fonctionner normalement dans ce cas, juste sans persistance. */
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored !== null ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* stockage indisponible — on continue sans persister, pas d'erreur bloquante */
    }
  }, [key, state]);
  return [state, setState];
}

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
          <button onClick={onClose} style={btnGhost} aria-label="Fermer le panneau de détail">✕</button>
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
          onClick={() => {
            // Confirmation uniquement pour l'action potentiellement risquée (reset forcé) —
            // le déverrouillage d'un casier "prêt" reste un geste sans conséquence, pas besoin de le ralentir.
            if (slot.status === "fault") {
              const ok = window.confirm(
                `Forcer le reset du casier ${String(slot.id).padStart(3, "0")} ?\nCette action interrompt toute activité en cours sur ce casier.`
              );
              if (!ok) return;
            }
            onUnlock(slot.id);
          }}
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

function LoginScreen({ onLogin, onExit }) {
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
        {onExit && <button className="login-back" onClick={onExit}>← Accueil</button>}
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
  .login-root { font-family: ${FONT}; background: ${C.bg}; color: ${C.text}; min-height: 100vh; min-height: 100dvh; display: flex; align-items: center; justify-content: center; padding: 20px; }
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
  .login-back { background: none; border: none; color: ${C.muted}; font-family: ${FONT}; font-size: 10px; cursor: pointer; margin-bottom: 18px; letter-spacing: 0.5px; }
  .login-back:hover { color: ${C.text}; }
`;

/* ==================== PARTIE 9 — ÉCRAN DE LANCEMENT ==================== */
/* ============================================================
   RADDIA — PARTIE 9 : ÉCRAN DE LANCEMENT
   Premier écran vu par TOUT LE MONDE, avant même la connexion.
   Deux chemins bien distincts :
     - Gestionnaire -> écran de connexion (partie 8) -> app existante
     - Utilisateur  -> flux de charge sans compte (parties 10-12, à venir)
   ============================================================ */

// props :
//  - onSelect : appelé avec "gestionnaire" ou "utilisateur"
function AppModeSelect({ onSelect }) {
  return (
    <div className="mode-root">
      <style>{MODE_CSS}</style>

      <div className="mode-brand">
        <div className="logo">RADDIA</div>
        <div className="logo-sub">SYSTÈME DE CHARGE INTELLIGENT</div>
      </div>

      <div className="mode-cards">
        <button className="mode-card mode-card--user" onClick={() => onSelect("utilisateur")}>
          <div className="mode-icon">🔋</div>
          <div className="mode-title">Charger mon téléphone</div>
          <div className="mode-desc">Scannez le QR code d'un casier pour démarrer — sans compte, sans inscription.</div>
          <div className="mode-cta mode-cta--green">COMMENCER →</div>
        </button>

        <button className="mode-card mode-card--admin" onClick={() => onSelect("gestionnaire")}>
          <div className="mode-icon">⊞</div>
          <div className="mode-title">Espace gestionnaire</div>
          <div className="mode-desc">Pilotez vos bornes à distance : casiers, alertes, statistiques.</div>
          <div className="mode-cta mode-cta--muted">SE CONNECTER →</div>
        </button>
      </div>

      <div className="mode-footer">RADDIA · Dakar, Sénégal</div>
    </div>
  );
}

/* ---------- STYLES ---------- */
const MODE_CSS = `
  .mode-root {
    font-family: ${FONT}; background: ${C.bg}; color: ${C.text};
    min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; padding: 24px;
  }
  .mode-brand { text-align: center; margin-bottom: 40px; }
  .mode-brand .logo { font-size: 30px; font-weight: 800; letter-spacing: 7px; color: ${C.green}; }
  .mode-brand .logo-sub { font-size: 9px; color: ${C.muted}; letter-spacing: 3px; margin-top: 6px; }

  .mode-cards { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 380px; }
  .mode-card {
    background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 18px;
    padding: 26px 22px; text-align: left; cursor: pointer; font-family: ${FONT};
    transition: transform .15s, border-color .15s;
  }
  .mode-card:hover { transform: translateY(-2px); }
  .mode-card--user:hover { border-color: ${C.green}66; }
  .mode-card--admin:hover { border-color: ${C.blue}66; }
  .mode-icon { font-size: 28px; margin-bottom: 10px; }
  .mode-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
  .mode-desc { font-size: 12px; color: ${C.muted}; line-height: 1.5; margin-bottom: 16px; }
  .mode-cta { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
  .mode-cta--green { color: ${C.green}; }
  .mode-cta--muted { color: ${C.muted}; }

  .mode-footer { margin-top: 32px; font-size: 9px; color: ${C.dim}; letter-spacing: 1px; }

  @media (min-width: 700px) {
    .mode-cards { flex-direction: row; max-width: 640px; }
    .mode-card { flex: 1; }
  }
`;

/* ==================== PARTIE 10 — SCAN QR ==================== */
/* ============================================================
   RADDIA — PARTIE 10 : SCAN QR (VRAIE CAMÉRA)
   Flux utilisateur — première étape : associer un client à un casier
   ============================================================ */

/* ---------- FORMAT DU QR CODE (contrat à partager avec l'équipe hardware) ---------- */
// Contenu attendu sur l'autocollant QR de chaque casier physique :
//   RADDIA:<ID_BORNE>:<NUMERO_CASIER>
//   Exemple : RADDIA:DKR-01:23
function parseQRPayload(text) {
  const match = /^RADDIA:([A-Z0-9-]+):(\d+)$/.exec(text.trim());
  if (!match) return null;
  return { borneId: match[1], slotId: parseInt(match[2], 10) };
}

/* ---------- COMPOSANT PRINCIPAL ---------- */
// props :
//  - onScanned : appelé avec { borneId, slotId } une fois un QR valide détecté
//  - onBack    : retour à l'écran précédent
function QRScanner({ onScanned, onBack }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const [status, setStatus] = useState("init"); // init | scanning | denied | unsupported
  const [jsQRReady, setJsQRReady] = useState(!!window.jsQR);
  const [showDemoQR, setShowDemoQR] = useState(false);

  // QR de démo — même contenu que le bouton de simulation, généré via une API publique
  // (pas de bibliothèque supplémentaire à charger juste pour l'affichage)
  const DEMO_PAYLOAD = "RADDIA:DKR-01:23";
  const demoQRUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(DEMO_PAYLOAD)}`;

  /* Charge la bibliothèque de décodage QR depuis un CDN (pas de build nécessaire) */
  useEffect(() => {
    if (window.jsQR) { setJsQRReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js";
    script.onload = () => setJsQRReady(true);
    script.onerror = () => setStatus("unsupported");
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  /* Démarre la caméra dès que jsQR est prêt */
  useEffect(() => {
    if (!jsQRReady) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus("scanning");
      })
      .catch(() => setStatus("denied"));

    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [jsQRReady]);

  /* Boucle de scan : lit chaque image de la vidéo et cherche un QR code dedans */
  useEffect(() => {
    if (status !== "scanning") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    function tick() {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (code) {
          const parsed = parseQRPayload(code.data);
          if (parsed) {
            onScanned(parsed);
            return; // on arrête la boucle, un résultat valide a été trouvé
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, onScanned]);

  return (
    <div className="scan-root">
      <style>{SCAN_CSS}</style>

      <div className="scan-topbar">
        <button className="scan-back" onClick={onBack}>← Retour</button>
        <div className="scan-title">SCANNER LE CASIER</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="scan-view">
        <video ref={videoRef} className="scan-video" playsInline muted />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {status === "scanning" && (
          <div className="scan-frame">
            <div className="scan-corner tl" /><div className="scan-corner tr" />
            <div className="scan-corner bl" /><div className="scan-corner br" />
            <div className="scan-laser" />
          </div>
        )}

        {(status === "init") && (
          <div className="scan-overlay-msg">Initialisation de la caméra…</div>
        )}
        {status === "denied" && (
          <div className="scan-overlay-msg">
            Accès à la caméra refusé.<br />Autorisez la caméra dans les réglages de votre navigateur, ou utilisez la simulation ci-dessous.
          </div>
        )}
        {status === "unsupported" && (
          <div className="scan-overlay-msg">
            Caméra non disponible dans cet environnement.<br />Utilisez la simulation ci-dessous, ou ouvrez l'app déployée sur votre téléphone.
          </div>
        )}
      </div>

      <div className="scan-hint">
        {status === "scanning" ? "Visez le QR code affiché sur le casier" : "En attente de la caméra…"}
      </div>

      {/* Repli toujours disponible : utile en test, ou si la caméra ne fonctionne pas */}
      <button className="scan-fallback" onClick={() => onScanned({ borneId: "DKR-01", slotId: 23 })}>
        Simuler le scan (casier DKR-01 · #23)
      </button>

      {/* Aide au test : afficher un QR à scanner avec un autre appareil */}
      <button className="scan-demo-link" onClick={() => setShowDemoQR(true)}>
        📱 Afficher un QR de démo à scanner (depuis un autre écran)
      </button>

      {showDemoQR && (
        <div className="scan-demo-overlay" onClick={() => setShowDemoQR(false)}>
          <div className="scan-demo-card" onClick={(e) => e.stopPropagation()}>
            <div className="scan-demo-title">QR DE DÉMO — CASIER DKR-01 #23</div>
            <img src={demoQRUrl} alt="QR code de démonstration RADDIA" className="scan-demo-img" />
            <div className="scan-demo-desc">
              Affichez cet écran sur un ordinateur, puis scannez-le avec la caméra de votre téléphone (sur l'app déployée).
            </div>
            <button className="scan-demo-close" onClick={() => setShowDemoQR(false)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- STYLES ---------- */
const SCAN_CSS = `
  .scan-root { font-family: ${FONT}; background: #000; color: ${C.text}; min-height: 100vh; min-height: 100dvh; display: flex; flex-direction: column; }
  .scan-topbar { display: flex; align-items: center; justify-content: space-between; padding: 16px; }
  .scan-back { background: none; border: none; color: ${C.text}; font-family: ${FONT}; font-size: 12px; cursor: pointer; }
  .scan-title { font-size: 11px; letter-spacing: 2px; color: ${C.muted}; }

  .scan-view { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #050505; }
  .scan-video { width: 100%; height: 100%; object-fit: cover; }

  .scan-frame { position: absolute; width: 62vw; max-width: 260px; aspect-ratio: 1; }
  .scan-corner { position: absolute; width: 26px; height: 26px; border: 3px solid ${C.green}; }
  .scan-corner.tl { top: 0; left: 0; border-right: none; border-bottom: none; }
  .scan-corner.tr { top: 0; right: 0; border-left: none; border-bottom: none; }
  .scan-corner.bl { bottom: 0; left: 0; border-right: none; border-top: none; }
  .scan-corner.br { bottom: 0; right: 0; border-left: none; border-top: none; }
  .scan-laser { position: absolute; left: 4%; right: 4%; height: 2px; background: ${C.green}; box-shadow: 0 0 8px ${C.green}; animation: laserMove 2s ease-in-out infinite; }
  @keyframes laserMove { 0%,100% { top: 6%; } 50% { top: 92%; } }

  .scan-overlay-msg { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; padding: 30px; font-size: 12px; color: ${C.muted}; line-height: 1.6; background: rgba(0,0,0,0.6); }

  .scan-hint { text-align: center; font-size: 11px; color: ${C.muted}; padding: 16px; letter-spacing: 0.5px; }
  .scan-fallback {
    margin: 0 16px 20px; padding: 12px; border-radius: 10px; border: 1px dashed ${C.border};
    background: none; color: ${C.dim}; font-family: ${FONT}; font-size: 10px; letter-spacing: 0.5px; cursor: pointer;
  }
  .scan-fallback:hover { border-color: ${C.muted}; color: ${C.muted}; }

  .scan-demo-link {
    margin: 0 16px 20px; padding: 10px; border-radius: 10px; border: none;
    background: none; color: ${C.green}; font-family: ${FONT}; font-size: 10px; letter-spacing: 0.5px; cursor: pointer;
    opacity: 0.85;
  }
  .scan-demo-link:hover { opacity: 1; }

  .scan-demo-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 300; padding: 20px;
  }
  .scan-demo-card {
    background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px;
    padding: 24px; text-align: center; max-width: 320px;
  }
  .scan-demo-title { font-size: 10px; letter-spacing: 1.5px; color: ${C.muted}; margin-bottom: 16px; }
  .scan-demo-img { width: 100%; max-width: 220px; border-radius: 10px; background: #fff; padding: 10px; }
  .scan-demo-desc { font-size: 11px; color: ${C.muted}; line-height: 1.6; margin-top: 16px; }
  .scan-demo-close {
    margin-top: 18px; width: 100%; padding: 11px; border-radius: 8px; border: 1px solid ${C.border};
    background: none; color: ${C.text}; font-family: ${FONT}; font-size: 11px; letter-spacing: 1px; cursor: pointer;
  }
`;

/* ==================== PARTIE 11 — SUIVI DE CHARGE ==================== */
/* ============================================================
   RADDIA — PARTIE 11 : SUIVI DE CHARGE EN DIRECT
   Écran que le client garde ouvert (ou revient consulter)
   pendant que son téléphone charge dans le casier.
   ============================================================ */

// props :
//  - borneId, slotId : identifient le casier (viennent du scan, partie 10)
//  - onRetrieve       : appelé quand le client clique "Récupérer mon téléphone"
function ChargeTracking({ borneId, slotId, onRetrieve }) {
  const [battery, setBattery] = useState(4);
  const [notifGranted, setNotifGranted] = useState(false);
  const notifiedRef = useRef(false); // évite de notifier plusieurs fois

  const status = battery >= 100 ? "ready" : "charging";

  // ⏱️ Simulation accélérée pour la démo (charge complète en ~45s au lieu de ~90min réelles).
  // Pour un rythme réaliste en test prolongé, réduire l'incrément (ex: 0.02 au lieu de 2.2).
  useEffect(() => {
    if (status === "ready") return;
    const t = setInterval(() => {
      setBattery((b) => Math.min(100, b + 2.2 + Math.random() * 1.5));
    }, 1000);
    return () => clearInterval(t);
  }, [status]);

  // Notification navigateur quand la charge est terminée (si autorisée)
  useEffect(() => {
    if (status === "ready" && notifGranted && !notifiedRef.current && "Notification" in window) {
      notifiedRef.current = true;
      new Notification("RADDIA — Téléphone prêt 🔋", {
        body: `Casier ${String(slotId).padStart(3, "0")} : charge complète, vous pouvez le récupérer.`,
      });
    }
  }, [status, notifGranted, slotId]);

  function askNotifPermission() {
    if (!("Notification" in window)) return;
    Notification.requestPermission().then((perm) => setNotifGranted(perm === "granted"));
  }

  // Géométrie de l'anneau de progression (SVG)
  const R = 88;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC - (Math.min(battery, 100) / 100) * CIRC;
  const ringColor = status === "ready" ? C.green : C.amber;
  const estMinutes = Math.max(0, Math.round((100 - battery) * 0.9));

  return (
    <div className="track-root">
      <style>{TRACK_CSS}</style>

      <div className="track-header">
        <div className="track-eyebrow">CASIER {String(slotId).padStart(3, "0")}</div>
        <div className="track-borne">{borneId}</div>
      </div>

      <div className="track-ring-wrap">
        <svg viewBox="0 0 200 200" className="track-ring">
          <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
          <circle
            cx="100" cy="100" r={R} fill="none" stroke={ringColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={offset}
            transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1s linear, stroke .3s" }}
          />
        </svg>
        <div className="track-ring-center">
          <div className="track-pct" style={{ color: ringColor }}>{Math.round(battery)}%</div>
          <div className="track-pct-label">{status === "ready" ? "PRÊT" : "EN CHARGE"}</div>
        </div>
      </div>

      {status === "charging" ? (
        <>
          <div className="track-eta">Prêt dans environ <strong>{estMinutes} min</strong></div>
          {!notifGranted && "Notification" in window && (
            <button className="track-notif-btn" onClick={askNotifPermission}>
              🔔 Me prévenir quand c'est prêt
            </button>
          )}
          <div className="track-note">Vous pouvez fermer cet écran — votre téléphone continue de charger normalement dans le casier.</div>
        </>
      ) : (
        <>
          <div className="track-ready-banner">✓ Votre téléphone est chargé à 100%</div>
          <button className="track-retrieve-btn" onClick={onRetrieve}>
            🔓 RÉCUPÉRER MON TÉLÉPHONE
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- STYLES ---------- */
const TRACK_CSS = `
  .track-root {
    font-family: ${FONT}; background: ${C.bg}; color: ${C.text}; min-height: 100vh; min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px;
  }
  .track-header { text-align: center; margin-bottom: 28px; }
  .track-eyebrow { font-size: 11px; letter-spacing: 2px; color: ${C.muted}; }
  .track-borne { font-size: 13px; font-weight: 700; color: ${C.text}; margin-top: 4px; }

  .track-ring-wrap { position: relative; width: 220px; height: 220px; margin-bottom: 28px; }
  .track-ring { width: 100%; height: 100%; }
  .track-ring-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .track-pct { font-size: 36px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
  .track-pct-label { font-size: 10px; letter-spacing: 2px; color: ${C.muted}; margin-top: 6px; }

  .track-eta { font-size: 14px; color: ${C.text}; margin-bottom: 18px; }
  .track-eta strong { color: ${C.amber}; }

  .track-notif-btn {
    background: rgba(255,255,255,0.04); border: 1px solid ${C.border}; color: ${C.text};
    padding: 11px 20px; border-radius: 24px; font-family: ${FONT}; font-size: 11px;
    letter-spacing: 0.5px; cursor: pointer; margin-bottom: 20px;
  }
  .track-notif-btn:hover { border-color: ${C.green}66; }

  .track-note { font-size: 11px; color: ${C.dim}; text-align: center; max-width: 260px; line-height: 1.6; }

  .track-ready-banner {
    background: rgba(16,185,129,0.1); border: 1px solid ${C.green}55; color: ${C.green};
    padding: 12px 20px; border-radius: 12px; font-size: 13px; font-weight: 700; margin-bottom: 22px;
    animation: readyPulse 1.6s ease-in-out infinite;
  }
  @keyframes readyPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.03); } }

  .track-retrieve-btn {
    background: ${C.green}; color: #07070f; border: none; padding: 16px 28px; border-radius: 14px;
    font-family: ${FONT}; font-size: 13px; font-weight: 800; letter-spacing: 1px; cursor: pointer;
    box-shadow: 0 0 24px ${C.green}44;
  }
  .track-retrieve-btn:hover { opacity: 0.92; }
`;

/* ==================== PARTIE 12 — RÉCUPÉRATION ==================== */
/* ============================================================
   RADDIA — PARTIE 12 : RÉCUPÉRATION
   Dernière étape du parcours client : déverrouillage physique
   du casier, confirmation, puis retour à l'écran de lancement.
   ============================================================ */

// props :
//  - slotId    : numéro du casier
//  - onFinish  : appelé quand le client a terminé (retour à l'écran de lancement, partie 9)
function Retrieval({ slotId, onFinish }) {
  // "unlocking" -> le signal est envoyé au casier (simulation d'un appel au contrôleur physique)
  // "unlocked"  -> le casier est ouvert, en attente que le client confirme avoir repris son tél.
  const [step, setStep] = useState("unlocking");

  useEffect(() => {
    if (step !== "unlocking") return;
    // Simule le temps de communication avec le contrôleur du casier (MQTT -> relais physique)
    const t = setTimeout(() => setStep("unlocked"), 1400);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="retr-root">
      <style>{RETR_CSS}</style>

      {step === "unlocking" && (
        <>
          <div className="retr-spinner" />
          <div className="retr-title">Déverrouillage du casier {String(slotId).padStart(3, "0")}…</div>
          <div className="retr-sub">Un instant, le casier s'ouvre.</div>
        </>
      )}

      {step === "unlocked" && (
        <>
          <div className="retr-icon">🔓</div>
          <div className="retr-title">Casier ouvert</div>
          <div className="retr-sub">Récupérez votre téléphone, puis refermez le casier.</div>
          <button className="retr-btn" onClick={() => setStep("done")}>
            J'AI RÉCUPÉRÉ MON TÉLÉPHONE
          </button>
        </>
      )}

      {step === "done" && (
        <>
          <div className="retr-icon">✓</div>
          <div className="retr-title">Merci d'avoir utilisé RADDIA</div>
          <div className="retr-sub">À bientôt sur une de nos bornes !</div>
          <button className="retr-btn retr-btn--outline" onClick={onFinish}>
            TERMINER
          </button>
        </>
      )}
    </div>
  );
}

/* ---------- STYLES ---------- */
const RETR_CSS = `
  .retr-root {
    font-family: ${FONT}; background: ${C.bg}; color: ${C.text}; min-height: 100vh; min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 24px;
  }
  .retr-spinner {
    width: 52px; height: 52px; border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.1); border-top-color: ${C.green};
    animation: retrSpin 0.9s linear infinite; margin-bottom: 24px;
  }
  @keyframes retrSpin { to { transform: rotate(360deg); } }

  .retr-icon { font-size: 44px; margin-bottom: 18px; animation: retrPop .35s ease; }
  @keyframes retrPop { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }

  .retr-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; }
  .retr-sub { font-size: 12px; color: ${C.muted}; margin-bottom: 26px; max-width: 260px; line-height: 1.6; }

  .retr-btn {
    background: ${C.green}; color: #07070f; border: none; padding: 15px 26px; border-radius: 14px;
    font-family: ${FONT}; font-size: 12px; font-weight: 800; letter-spacing: 1px; cursor: pointer;
  }
  .retr-btn:hover { opacity: 0.9; }
  .retr-btn--outline { background: none; border: 1px solid ${C.border}; color: ${C.text}; }
  .retr-btn--outline:hover { border-color: ${C.green}66; }
`;

/* ==================== PARTIE 7 — NAVIGATION + ASSEMBLAGE FINAL ==================== */

function UserFlow({ onExit }) {
  const [step, setStep] = usePersistentState("raddia_user_step", "scan"); // scan | tracking | retrieval
  const [locker, setLocker] = usePersistentState("raddia_user_locker", null);

  // Efface la progression persistée : à utiliser chaque fois qu'on quitte
  // le parcours "pour de bon" (retour à l'accueil, fin de session), pour que
  // le prochain client reparte bien du scan et pas d'une session précédente.
  function exitFlow() {
    try {
      window.localStorage.removeItem("raddia_user_step");
      window.localStorage.removeItem("raddia_user_locker");
    } catch { /* pas grave si indisponible */ }
    onExit();
  }

  if (step === "scan") {
    return (
      <QRScanner
        onScanned={(loc) => { setLocker(loc); setStep("tracking"); }}
        onBack={exitFlow}
      />
    );
  }
  if (step === "tracking") {
    return (
      <ChargeTracking
        borneId={locker.borneId}
        slotId={locker.slotId}
        onRetrieve={() => setStep("retrieval")}
      />
    );
  }
  return <Retrieval slotId={locker.slotId} onFinish={exitFlow} />;
}

// Chargé à la demande uniquement : un client de l'app Utilisateur ne télécharge
// jamais ce module (ni recharts, sa plus grosse dépendance) — plus rapide au premier chargement.
const GestionnaireApp = lazy(() => import("./Gestionnaire.jsx"));

function GestionnaireLoading() {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.muted,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: FONT, fontSize: 12, letterSpacing: 1,
    }}>
      Chargement de l'espace gestionnaire…
    </div>
  );
}

// Point d'entrée de toute l'app : choisit entre l'univers Gestionnaire et l'univers Utilisateur
function RADDIARoot() {
  const [mode, setMode] = usePersistentState("raddia_mode", null); // null | "gestionnaire" | "utilisateur"

  if (mode === null) {
    return <AppModeSelect onSelect={setMode} />;
  }
  if (mode === "gestionnaire") {
    return (
      <Suspense fallback={<GestionnaireLoading />}>
        <GestionnaireApp onExit={() => setMode(null)} />
      </Suspense>
    );
  }
  return <UserFlow onExit={() => setMode(null)} />;
}

// Bandeau discret affiché quand le navigateur détecte une perte de connexion.
// Utile dès aujourd'hui (wifi public instable), et deviendra important
// une fois le vrai backend temps réel branché (les données affichées
// pourraient sinon sembler à jour alors qu'elles ne le sont plus).
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

function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  if (online) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 999,
      background: C.amber, color: "#07070f", textAlign: "center",
      fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "7px 10px",
    }}>
      ⚠ CONNEXION INTERNET PERDUE — Les données affichées peuvent ne plus être à jour
    </div>
  );
}

// Le filet de sécurité enveloppe TOUT — c'est la dernière ligne de défense
// contre un écran noir silencieux en cas de bug non anticipé.
export default function App() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <RADDIARoot />
    </ErrorBoundary>
  );
}

// Exports nommés — utilisés par Gestionnaire.jsx (chargé à la demande, voir RADDIARoot)
export {
  C, FONT, STATUS_CONFIG, batteryColor, BORNES, seedSlots, tickSlots, HOURLY_USAGE,
  Led, StatPill, EmptyState, SlotCell, InfoTile, SlotDetail, btnGhost,
  usePersistentState, LoginScreen,
};
