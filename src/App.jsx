import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Waves, Mail, Lock, User, Phone, Clock,
  CheckCircle2, XCircle, LogOut, ShieldCheck,
  Anchor, Sparkles, X, MailCheck, ChevronLeft, ChevronRight,
  Menu, Loader2,
} from "lucide-react";

// Dirección de la API en Render
const API_URL = "https://casa-caribe-api.onrender.com/api";

/* ---------- Paleta (contraste verificado, WCAG AA en combinaciones de texto) ---------- */
const INK = "#1C2420";
const CREAM = "#FBF3E6";
const CREAM_SOFT = "#F4E9D8";
const TEAL_DEEP = "#082B29";
const TEAL = "#0B3D3A";
const TEAL_MID = "#155650";
const CORAL = "#E8613D";       // uso decorativo / iconos, no como fondo de texto pequeño
const CORAL_DEEP = "#B84322";  // fondo de botón con texto crema — ratio ~4.7:1
const GOLD = "#DFA22B";        // sobre TEAL_DEEP ratio ~6.7:1
const SEAFOAM = "#C7E3D4";

const TIMES = (() => {
  const out = [];
  for (let h = 12; h <= 21; h++) {
    out.push(`${h}:00`);
    if (h !== 21) out.push(`${h}:30`);
  }
  return out;
})();

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function nextDays(n) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export default function App() {
  const [view, setView] = useState("landing"); // landing | auth | book | mine | staff
  const [authMode, setAuthMode] = useState("signup"); // signup | login
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [decidingId, setDecidingId] = useState(null);

  const days = useMemo(() => nextDays(14), []);
  const [selectedDate, setSelectedDate] = useState(dateKey(days[0]));
  const [dayScroll, setDayScroll] = useState(0);
  const [party, setParty] = useState(2);
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState("");

  const showToast = useCallback((text, tone = "ok") => {
    setToast({ text, tone, key: Date.now() });
    setTimeout(() => setToast((t) => (t && t.key === Date.now() ? null : t)), 3200);
  }, []);

  const fetchReservas = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoadingList(true);
    try {
      const endpoint = view === "staff" ? `${API_URL}/admin/reservas` : `${API_URL}/reservas/mis-reservas`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } catch (err) {
      console.error("Error cargando reservas:", err);
    } finally {
      setLoadingList(false);
    }
  }, [view]);

  // NOTE: adjust "rol" to whatever field your /api/auth/login response actually
  // uses for the user's role (e.g. currentUser.role, currentUser.is_admin, etc.)
  const isAdmin = currentUser?.rol === "admin";

  useEffect(() => {
    if (currentUser && (view === "mine" || view === "staff" || view === "book")) {
      fetchReservas();
    }
    setMobileNavOpen(false);
  }, [currentUser, view, fetchReservas]);

  // Client-side guard: this only hides the UI. The API must reject non-admins
  // independently — see note below the component.
  useEffect(() => {
    if (view === "staff" && !isAdmin) {
      showToast("No tienes permisos para ver esta sección", "error");
      setView("book");
    }
  }, [view, isAdmin, showToast]);

  /* ---------------- Auth ---------------- */

  async function handleEmailSignup(form) {
    setLoadingAuth(true);
    try {
      const res = await fetch(`${API_URL}/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: form.name,
          correo: form.email,
          telefono: form.phone,
          password: form.password
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Error en el registro", "error");
        return;
      }

      showToast("Cuenta creada con éxito. Inicia sesión.");
      setAuthMode("login");
    } catch (err) {
      showToast("Error de conexión con el servidor", "error");
    } finally {
      setLoadingAuth(false);
    }
  }

  async function handleEmailLogin(email, password) {
    setLoadingAuth(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Credenciales incorrectas", "error");
        return;
      }

      localStorage.setItem("token", data.access_token);
      setCurrentUser(data.usuario);
      const primerNombre = (data.usuario.nombre_completo || data.usuario.name || "Cliente").split(" ")[0];
      showToast(`¡Bienvenido, ${primerNombre}!`);
      setView("book");
    } catch (err) {
      showToast("Error al conectar con la API", "error");
    } finally {
      setLoadingAuth(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setCurrentUser(null);
    setView("landing");
  }

  /* ---------------- Reservas ---------------- */

  async function submitReservation() {
    if (!selectedTime) return;
    const token = localStorage.getItem("token");

    setLoadingSubmit(true);
    try {
      const res = await fetch(`${API_URL}/reservas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fecha: selectedDate,
          hora: selectedTime,
          cantidad_personas: party,
          tipo_mesa: "terraza",
          notas: notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Error al crear la reserva", "error");
        return;
      }

      setSelectedTime(null);
      setNotes("");
      showToast("Reserva creada correctamente.");
      fetchReservas();
      setView("mine");
    } catch (err) {
      showToast("Error al procesar la reserva", "error");
    } finally {
      setLoadingSubmit(false);
    }
  }

  async function decideReservation(id, decision) {
    const token = localStorage.getItem("token");
    setDecidingId(id);

    try {
      const res = await fetch(`${API_URL}/admin/reservas/${id}/decidir`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ estado: decision })
      });

      if (res.ok) {
        const r = reservations.find((x) => (x.id || x._id) === id);
        if (decision === "confirmada" && r) {
          setEmailPreview(r);
          showToast(`Confirmación enviada a ${r.cliente?.correo || r.correo_cliente}`);
        } else {
          showToast("Reserva cancelada", "error");
        }
        fetchReservas();
      }
    } catch (err) {
      showToast("Error al procesar la solicitud", "error");
    } finally {
      setDecidingId(null);
    }
  }

  /* ---------------- Componentes de UI ---------------- */

  function StatusBadge({ status }) {
    const map = {
      pendiente: { bg: "#FBEBC9", text: "#7A4E00", label: "Pendiente" },
      confirmada: { bg: SEAFOAM, text: TEAL_DEEP, label: "Confirmada" },
      cancelada: { bg: "#F3D6CE", text: "#7A2913", label: "Cancelada" },
    }[status] || { bg: "#E2E8F0", text: "#334155", label: status };

    return (
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
        style={{ background: map.bg, color: map.text, fontFamily: "'Work Sans', sans-serif" }}
      >
        {map.label}
      </span>
    );
  }

  function WaveDivider({ flip }) {
    return (
      <svg
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 44, display: "block", transform: flip ? "scaleY(-1)" : "none" }}
      >
        <path d="M0,34 C150,64 350,4 600,34 C850,64 1050,4 1200,34 L1200,60 L0,60 Z" fill={flip ? CREAM : TEAL_DEEP} opacity="1" />
        <path d="M0,40 C180,66 330,14 600,40 C870,66 1020,14 1200,40 L1200,60 L0,60 Z" fill={flip ? CREAM : TEAL_DEEP} opacity="0.5" />
      </svg>
    );
  }

  function Logomark({ size = 34 }) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-xl shrink-0"
        style={{ width: size, height: size, background: `linear-gradient(155deg, ${TEAL} 0%, ${TEAL_DEEP} 100%)` }}
      >
        <Anchor size={size * 0.52} color={GOLD} strokeWidth={2.25} />
      </span>
    );
  }

  function Field({ icon: Icon, type = "text", placeholder, name, required = true, defaultValue }) {
    return (
      <label
        className="cc-field flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border bg-white"
        style={{ borderColor: "#D8CDB4" }}
      >
        <Icon size={16} color={TEAL} className="shrink-0" />
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="w-full outline-none bg-transparent text-sm"
          style={{ color: INK, fontFamily: "'Work Sans', sans-serif" }}
        />
      </label>
    );
  }

  function SectionLabel({ children }) {
    return (
      <div
        style={{
          fontFamily: "'Work Sans', sans-serif",
          fontSize: 12,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.6,
          color: TEAL,
        }}
      >
        {children}
      </div>
    );
  }

  function Spinner({ size = 16, color = TEAL_DEEP }) {
    return <Loader2 size={size} color={color} className="animate-spin" />;
  }

  const navItems = [
    { key: "book", label: "Reservar" },
    { key: "mine", label: "Mis reservas" },
    ...(isAdmin ? [{ key: "staff", label: "Panel Staff" }] : []),
  ];

  /* ---------------- Render ---------------- */

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Work+Sans:wght@400;500;600;700&display=swap');

        * { box-sizing: border-box; }

        .cc-view { animation: cc-fade 0.28s ease; }
        @keyframes cc-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        .cc-nav-link { position: relative; background: transparent; border: none; cursor: pointer;
          font-family: 'Work Sans', sans-serif; font-size: 14px; font-weight: 500;
          color: ${CREAM}; opacity: 0.72; padding-bottom: 4px; border-bottom: 2px solid transparent;
          transition: opacity 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .cc-nav-link:hover { opacity: 1; }
        .cc-nav-link.active { opacity: 1; color: ${GOLD}; border-bottom-color: ${GOLD}; }
        .cc-nav-link:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 3px; border-radius: 2px; }

        .cc-btn { font-family: 'Work Sans', sans-serif; cursor: pointer; border: none;
          transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.08s ease, box-shadow 0.15s ease; }
        .cc-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .cc-btn:active:not(:disabled) { transform: scale(0.98); }
        .cc-btn:focus-visible { outline: 2px solid ${CORAL_DEEP}; outline-offset: 2px; }

        .cc-btn-primary { background: ${CORAL_DEEP}; color: ${CREAM}; }
        .cc-btn-primary:hover:not(:disabled) { background: #9C3A1D; }

        .cc-btn-dark { background: ${TEAL_DEEP}; color: ${CREAM}; }
        .cc-btn-dark:hover:not(:disabled) { background: #062120; }

        .cc-btn-outline { background: white; color: ${INK}; border: 1px solid #D8CDB4; }
        .cc-btn-outline:hover:not(:disabled) { background: ${CREAM_SOFT}; border-color: ${TEAL_MID}; }

        .cc-btn-ghost { background: rgba(255,255,255,0.08); color: ${CREAM}; border: 1px solid rgba(199,227,212,0.45); }
        .cc-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.16); }

        .cc-field { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
        .cc-field:focus-within { border-color: ${CORAL_DEEP}; box-shadow: 0 0 0 3px rgba(184,67,34,0.12); }

        .cc-card { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
        .cc-card:hover { box-shadow: 0 6px 20px rgba(8,43,41,0.09); border-color: ${TEAL_MID}; }

        .cc-time-btn { font-family: 'Work Sans', sans-serif; cursor: pointer;
          transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.08s ease; }
        .cc-time-btn:hover:not(:disabled) { border-color: ${TEAL_MID}; }
        .cc-time-btn:focus-visible { outline: 2px solid ${CORAL_DEEP}; outline-offset: 2px; }
        .cc-time-btn:active:not(:disabled) { transform: scale(0.97); }

        .cc-icon-btn { cursor: pointer; border: none; transition: transform 0.1s ease, filter 0.15s ease; }
        .cc-icon-btn:hover:not(:disabled) { filter: brightness(0.95); }
        .cc-icon-btn:active:not(:disabled) { transform: scale(0.94); }
        .cc-icon-btn:focus-visible { outline: 2px solid ${TEAL_DEEP}; outline-offset: 2px; }
        .cc-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .cc-link { color: ${CORAL_DEEP}; font-weight: 600; background: none; border: none; cursor: pointer;
          text-decoration: underline; text-underline-offset: 2px; }
        .cc-link:hover { color: #8C3418; }
        .cc-link:focus-visible { outline: 2px solid ${CORAL_DEEP}; outline-offset: 2px; border-radius: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .cc-view, .cc-btn, .cc-card, .cc-time-btn, .cc-icon-btn, .cc-nav-link { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* HEADER */}
      <header className="w-full sticky top-0 z-30" style={{ background: TEAL_DEEP, borderBottom: `1px solid ${TEAL}`, boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-3.5">
          <button
            className="flex items-center gap-2.5 bg-transparent border-0 cursor-pointer cc-icon-btn"
            style={{ borderRadius: 8 }}
            onClick={() => setView(currentUser ? "book" : "landing")}
          >
            <Logomark />
            <span style={{ color: CREAM, fontSize: 21, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>Casa Caribe</span>
          </button>

          <nav className="hidden sm:flex items-center gap-7">
            {currentUser && navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`cc-nav-link${view === item.key ? " active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2.5">
            {currentUser ? (
              <button onClick={handleLogout} className="cc-btn cc-btn-ghost hidden sm:flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full font-medium">
                <LogOut size={15} color={GOLD} /> Salir
              </button>
            ) : (
              <button onClick={() => setView("auth")} className="cc-btn cc-btn-primary text-sm px-4 py-2 rounded-full font-medium hidden sm:inline-flex">
                Ingresar / Registro
              </button>
            )}
            {currentUser && (
              <button
                className="cc-icon-btn sm:hidden p-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.08)" }}
                onClick={() => setMobileNavOpen((v) => !v)}
                aria-label="Abrir menú"
              >
                {mobileNavOpen ? <X size={19} color={CREAM} /> : <Menu size={19} color={CREAM} />}
              </button>
            )}
            {!currentUser && (
              <button onClick={() => setView("auth")} className="cc-btn cc-btn-primary sm:hidden text-sm px-3.5 py-1.5 rounded-full font-medium">
                Entrar
              </button>
            )}
          </div>
        </div>

        {currentUser && mobileNavOpen && (
          <div className="sm:hidden px-5 pb-4 flex flex-col gap-1" style={{ borderTop: `1px solid ${TEAL}` }}>
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className="text-left py-2.5 px-2 rounded-lg text-sm font-medium"
                style={{
                  fontFamily: "'Work Sans', sans-serif",
                  color: view === item.key ? GOLD : CREAM,
                  background: view === item.key ? "rgba(223,162,43,0.1)" : "transparent",
                }}
              >
                {item.label}
              </button>
            ))}
            <button onClick={handleLogout} className="cc-btn cc-btn-ghost mt-2 flex items-center justify-center gap-1.5 text-sm px-3.5 py-2 rounded-full font-medium">
              <LogOut size={15} color={GOLD} /> Salir
            </button>
          </div>
        )}
      </header>

      {/* VISTAS */}
      {view === "landing" && (
        <div className="cc-view">
          <section style={{ background: `linear-gradient(160deg, ${TEAL_DEEP} 0%, ${TEAL} 130%)` }} className="px-5 pt-20 pb-12">
            <div className="max-w-3xl mx-auto text-center">
              <div className="flex justify-center mb-6">
                <Logomark size={52} />
              </div>
              <h1 style={{ fontFamily: "'Fraunces', serif", color: CREAM, fontSize: "clamp(2.4rem, 6vw, 3.8rem)", lineHeight: 1.05, letterSpacing: -0.5 }}>
                Casa Caribe
              </h1>
              <p style={{ color: SEAFOAM, fontFamily: "'Work Sans', sans-serif", fontSize: 17, marginTop: 16, maxWidth: 480, lineHeight: 1.6 }} className="mx-auto">
                Mariscos a la parrilla, sazón caribeña y una mesa esperando por ti. Reserva online de forma rápida y sin esperas.
              </p>
              <button
                onClick={() => setView(currentUser ? "book" : "auth")}
                className="cc-btn cc-btn-primary mt-9 px-8 py-3 rounded-full font-semibold"
                style={{ fontSize: 15, boxShadow: "0 8px 24px rgba(184,67,34,0.35)" }}
              >
                Reservar una mesa
              </button>
            </div>
          </section>
          <WaveDivider flip />
          <section className="px-5 py-14" style={{ background: CREAM }}>
            <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-9 text-center">
              {[
                { icon: Clock, title: "Disponibilidad real", body: "Revisa horarios libres al momento en que confirmas." },
                { icon: ShieldCheck, title: "Confirmación directa", body: "Cada solicitud es revisada personalmente por el equipo." },
                { icon: Sparkles, title: "Notificación al instante", body: "Recibes confirmación cuando tu mesa queda reservada." },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="inline-flex items-center justify-center rounded-full mb-3" style={{ width: 44, height: 44, background: CREAM_SOFT }}>
                    <Icon size={20} color={CORAL_DEEP} />
                  </span>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: INK, marginBottom: 6 }}>{title}</div>
                  <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, opacity: 0.72, lineHeight: 1.5 }}>{body}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {view === "auth" && (
        <div className="cc-view min-h-[70vh] flex items-center justify-center px-5 py-14" style={{ background: CREAM }}>
          <div className="w-full max-w-sm">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4"><Logomark size={40} /></div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 27, color: INK }}>
                {authMode === "signup" ? "Crea tu cuenta" : "Bienvenido de nuevo"}
              </div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.6, marginTop: 6 }}>
                {authMode === "signup" ? "Toma menos tiempo que el viaje hasta acá." : "Ingresa para gestionar tus reservas."}
              </div>
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (authMode === "signup") {
                  handleEmailSignup({
                    name: e.target.name.value,
                    email: e.target.email.value,
                    phone: e.target.phone.value,
                    password: e.target.password.value,
                  });
                } else {
                  handleEmailLogin(e.target.email.value, e.target.password.value);
                }
              }}
            >
              {authMode === "signup" && <Field icon={User} name="name" placeholder="Nombre completo" />}
              <Field icon={Mail} name="email" type="email" placeholder="Correo electrónico" />
              {authMode === "signup" && <Field icon={Phone} name="phone" type="tel" placeholder="Teléfono" />}
              <Field icon={Lock} name="password" type="password" placeholder="Contraseña" />

              <button type="submit" disabled={loadingAuth} className="cc-btn cc-btn-dark mt-2 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2">
                {loadingAuth && <Spinner size={15} color={CREAM} />}
                {authMode === "signup" ? "Crear cuenta" : "Entrar"}
              </button>
            </form>

            <div className="text-center mt-6" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.75 }}>
              {authMode === "signup" ? (
                <>¿Ya tienes cuenta?{" "}
                  <button type="button" className="cc-link" onClick={() => setAuthMode("login")}>Inicia sesión</button>
                </>
              ) : (
                <>¿Nuevo por aquí?{" "}
                  <button type="button" className="cc-link" onClick={() => setAuthMode("signup")}>Crea una cuenta</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "book" && currentUser && (
        <div className="cc-view px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-8">
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 27, color: INK }}>Reservar una mesa</div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.65, marginTop: 4 }}>
                Selecciona fecha, personas y horario disponible.
              </div>
            </div>

            <div>
              <SectionLabel>Personas</SectionLabel>
              <div className="flex flex-wrap gap-2 mt-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setParty(n)}
                    className="cc-time-btn w-10 h-10 rounded-full text-sm font-semibold"
                    style={{
                      background: party === n ? CORAL_DEEP : "white",
                      color: party === n ? CREAM : INK,
                      border: `1px solid ${party === n ? CORAL_DEEP : "#D8CDB4"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Día</SectionLabel>
              <div className="flex items-center gap-1 mt-3">
                <button
                  disabled={dayScroll === 0}
                  onClick={() => setDayScroll((s) => Math.max(0, s - 5))}
                  className="cc-icon-btn p-1 rounded-full"
                  style={{ opacity: dayScroll === 0 ? 0.3 : 1, background: "transparent" }}
                >
                  <ChevronLeft size={18} color={TEAL_DEEP} />
                </button>
                <div className="flex gap-2 overflow-x-auto">
                  {days.slice(dayScroll, dayScroll + 5).map((d) => {
                    const k = dateKey(d);
                    const active = k === selectedDate;
                    return (
                      <button
                        key={k}
                        onClick={() => { setSelectedDate(k); setSelectedTime(null); }}
                        className="cc-time-btn px-3 py-2 rounded-xl text-xs whitespace-nowrap font-medium"
                        style={{
                          background: active ? TEAL_DEEP : "white",
                          color: active ? CREAM : INK,
                          border: `1px solid ${active ? TEAL_DEEP : "#D8CDB4"}`,
                        }}
                      >
                        {fmtDateLabel(d)}
                      </button>
                    );
                  })}
                </div>
                <button
                  disabled={dayScroll + 5 >= days.length}
                  onClick={() => setDayScroll((s) => Math.min(days.length - 5, s + 5))}
                  className="cc-icon-btn p-1 rounded-full"
                  style={{ opacity: dayScroll + 5 >= days.length ? 0.3 : 1, background: "transparent" }}
                >
                  <ChevronRight size={18} color={TEAL_DEEP} />
                </button>
              </div>
            </div>

            <div>
              <SectionLabel>Horarios disponibles</SectionLabel>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
                {TIMES.map((t) => {
                  const isSelected = selectedTime === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className="cc-time-btn py-2.5 rounded-lg text-sm font-medium"
                      style={{
                        background: isSelected ? TEAL_DEEP : "white",
                        color: isSelected ? CREAM : INK,
                        border: `1px solid ${isSelected ? TEAL_DEEP : "#D8CDB4"}`,
                      }}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedTime && (
              <div className="cc-view p-5 rounded-2xl bg-white space-y-3" style={{ border: `1px solid #D8CDB4`, boxShadow: "0 4px 16px rgba(8,43,41,0.06)" }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, fontWeight: 500 }}>
                  Mesa para {party} personas · {selectedDate} · {fmtTime(selectedTime)}
                </div>
                <textarea
                  placeholder="Notas especiales (alergias, celebración, terraza...)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="cc-field w-full rounded-lg p-3 text-sm outline-none border block"
                  style={{ borderColor: "#D8CDB4", fontFamily: "'Work Sans', sans-serif", color: INK, minHeight: 74 }}
                />
                <button
                  onClick={submitReservation}
                  disabled={loadingSubmit}
                  className="cc-btn cc-btn-primary w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                >
                  {loadingSubmit && <Spinner size={15} color={CREAM} />}
                  Confirmar y solicitar mesa
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "mine" && currentUser && (
        <div className="cc-view px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 27, color: INK }}>Mis reservas</div>
              {loadingList && <Spinner />}
            </div>

            {!loadingList && reservations.length === 0 ? (
              <div className="p-9 rounded-2xl text-center bg-white" style={{ border: `1.5px dashed #D8CDB4` }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, opacity: 0.7, marginBottom: 16 }}>
                  No tienes reservas registradas.
                </div>
                <button onClick={() => setView("book")} className="cc-btn cc-btn-dark px-5 py-2 rounded-full text-sm font-semibold">
                  Reservar mesa
                </button>
              </div>
            ) : (
              reservations.map((r) => (
                <div
                  key={r.id || r._id}
                  className="cc-card p-4 rounded-xl bg-white flex items-center justify-between gap-3"
                  style={{ border: `1px solid #D8CDB4` }}
                >
                  <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                      {r.fecha} · {fmtTime(r.hora)}
                    </div>
                    <div style={{ fontSize: 13, color: INK, opacity: 0.65, marginTop: 2 }}>
                      Personas: {r.cantidad_personas || r.personas} {r.tipo_mesa ? `· Mesa: ${r.tipo_mesa}` : ""}
                    </div>
                    {r.notas && <div style={{ fontSize: 12, color: INK, opacity: 0.5, marginTop: 3 }}>"{r.notas}"</div>}
                  </div>
                  <StatusBadge status={r.estado} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {view === "staff" && currentUser && isAdmin && (
        <div className="cc-view px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 27, color: INK }}>Panel del staff</div>
              {loadingList && <Spinner />}
            </div>

            {!loadingList && reservations.length === 0 ? (
              <div className="p-9 rounded-2xl text-center bg-white" style={{ border: `1.5px dashed #D8CDB4` }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.6 }}>No hay reservas activas.</div>
              </div>
            ) : (
              reservations.map((r) => {
                const rid = r.id || r._id;
                const isDeciding = decidingId === rid;
                return (
                  <div
                    key={rid}
                    className="cc-card p-4 rounded-xl bg-white flex items-center justify-between gap-3"
                    style={{ border: `1px solid #D8CDB4` }}
                  >
                    <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                      <div style={{ fontSize: 14, color: INK, fontWeight: 600 }}>
                        {r.cliente?.nombre || r.nombre_cliente || "Cliente"} · {r.cantidad_personas || r.personas} personas
                      </div>
                      <div style={{ fontSize: 13, color: INK, opacity: 0.65, marginTop: 2 }}>
                        {r.fecha} · {fmtTime(r.hora)} · {r.cliente?.correo || r.correo_cliente}
                      </div>
                      {r.notas && <div style={{ fontSize: 12, color: INK, opacity: 0.5, marginTop: 3 }}>"{r.notas}"</div>}
                    </div>

                    {r.estado === "pendiente" ? (
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => decideReservation(rid, "confirmada")}
                          disabled={isDeciding}
                          className="cc-icon-btn p-2 rounded-full"
                          style={{ background: SEAFOAM }}
                          aria-label="Confirmar reserva"
                        >
                          {isDeciding ? <Spinner size={17} color={TEAL_DEEP} /> : <CheckCircle2 size={18} color={TEAL_DEEP} />}
                        </button>
                        <button
                          onClick={() => decideReservation(rid, "cancelada")}
                          disabled={isDeciding}
                          className="cc-icon-btn p-2 rounded-full"
                          style={{ background: "#F3D6CE" }}
                          aria-label="Cancelar reserva"
                        >
                          <XCircle size={18} color="#7A2913" />
                        </button>
                      </div>
                    ) : (
                      <StatusBadge status={r.estado} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm"
          style={{
            background: toast.tone === "error" ? "#8C2E17" : TEAL_DEEP,
            color: CREAM,
            fontFamily: "'Work Sans', sans-serif",
            maxWidth: "90vw",
          }}
        >
          {toast.tone === "error" ? <XCircle size={16} color="#F3D6CE" /> : <CheckCircle2 size={16} color={SEAFOAM} />}
          {toast.text}
        </div>
      )}

      {/* MODAL EMAIL */}
      {emailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,20,18,0.55)" }} onClick={() => setEmailPreview(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5" style={{ background: TEAL_DEEP }}>
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: CREAM, fontFamily: "'Work Sans', sans-serif" }}>
                <MailCheck size={16} color={GOLD} /> Confirmación enviada por email
              </div>
              <button onClick={() => setEmailPreview(null)} className="cc-icon-btn p-1 rounded-full" aria-label="Cerrar">
                <X size={16} color={CREAM} />
              </button>
            </div>
            <div className="p-6" style={{ fontFamily: "'Work Sans', sans-serif", color: INK }}>
              <div className="text-xs opacity-60 mb-3">Para: {emailPreview.cliente?.correo || emailPreview.correo_cliente}</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 23, marginBottom: 12 }}>¡Mesa confirmada!</div>
              <div className="rounded-xl px-4 py-3.5 my-2 space-y-1.5" style={{ background: SEAFOAM, fontSize: 14, lineHeight: 1.7 }}>
                <div><strong>Mesa para {emailPreview.cantidad_personas || emailPreview.personas} personas</strong></div>
                <div>Fecha: {emailPreview.fecha}</div>
                <div>Hora: {fmtTime(emailPreview.hora)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}