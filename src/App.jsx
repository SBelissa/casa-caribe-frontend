import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Waves, Mail, Lock, User, Phone, Calendar, Clock,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, LogOut, ShieldCheck,
  Anchor, Sparkles, X, MailCheck,
} from "lucide-react";

// URL pública de tu API desplegada en Render
const API_URL = "https://casa-caribe-backend.onrender.com/api";

const INK = "#20261F";
const CREAM = "#FBF3E6";
const TEAL = "#0B3D3A";
const TEAL_DEEP = "#082B29";
const CORAL = "#E8613D";
const GOLD = "#DFA22B";
const SEAFOAM = "#C7E3D4";

const TIMES = (() => {
  const out = [];
  for (let h = 12; h <= 21; h++) {
    out.push(`${h}:00`);
    if (h !== 21) out.push(`${h}:30`);
  }
  return out;
})();

const SLOT_CAPACITY = 24;

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

export default function CasaCaribeApp() {
  const [view, setView] = useState("landing"); // landing | auth | book | mine | staff
  const [authMode, setAuthMode] = useState("signup"); // signup | login

  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });

  const [reservations, setReservations] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);

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

  // Cargar reservas desde el Backend
  const cargarReservas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/reservas`);
      if (res.ok) {
        const data = await res.json();
        setReservations(data);
      }
    } catch (err) {
      console.error("Error al cargar reservas:", err);
    }
  }, []);

  useEffect(() => {
    cargarReservas();
  }, [cargarReservas]);

  const bookedCovers = useCallback(
    (dateK, time) =>
      reservations
        .filter((r) => r.fecha === dateK && r.hora === time && r.estado !== "rechazada")
        .reduce((sum, r) => sum + (r.personas || r.party || 0), 0),
    [reservations]
  );

  const slotStatus = useCallback(
    (dateK, time, forParty) => {
      const remaining = SLOT_CAPACITY - bookedCovers(dateK, time);
      if (remaining < forParty) return "full";
      if (remaining <= SLOT_CAPACITY * 0.3) return "limited";
      return "available";
    },
    [bookedCovers]
  );

  /* ---------------- Auth Real con API ---------------- */

  async function handleEmailSignup(form) {
    try {
      const res = await fetch(`${API_URL}/auth/registro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_completo: form.name,
          correo: form.email,
          fecha_nacimiento: form.birthday,
          celular: form.phone,
          password: form.password,
          rol: "cliente",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error al registrar usuario.");

      showToast("Cuenta creada exitosamente. Inicia sesión para continuar.");
      setAuthMode("login");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleEmailLogin(email, password) {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Error de credenciales.");

      setToken(data.access_token);
      setCurrentUser(data.usuario);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.usuario));

      showToast(`¡Bienvenido de nuevo, ${data.usuario.nombre_completo.split(" ")[0]}!`);
      setView("book");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function handleLogout() {
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setView("landing");
  }

  /* ---------------- Booking Real con API ---------------- */

  async function submitReservation() {
    if (!selectedTime) return;
    try {
      const res = await fetch(`${API_URL}/reservas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          usuario_id: currentUser.id || currentUser._id,
          nombre_cliente: currentUser.nombre_completo || currentUser.name,
          correo_cliente: currentUser.correo || currentUser.email,
          fecha: selectedDate,
          hora: selectedTime,
          personas: party,
          notas: notes,
        }),
      });

      if (!res.ok) throw new Error("Error al enviar la reserva");

      await cargarReservas();
      setSelectedTime(null);
      setNotes("");
      showToast("Reserva enviada. Te confirmaremos por correo.");
      setView("mine");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function decideReservation(id, decision) {
    try {
      const nuevoEstado = decision === "confirmed" ? "confirmada" : "rechazada";
      const res = await fetch(`${API_URL}/reservas/${id}/estado`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ estado: nuevoEstado }),
      });

      if (!res.ok) throw new Error("Error al actualizar reserva");

      await cargarReservas();
      const r = reservations.find((x) => (x.id || x._id) === id);

      if (decision === "confirmed" && r) {
        setEmailPreview(r);
        showToast(`Correo de confirmación enviado a ${r.correo_cliente || r.email}`);
      } else if (decision === "declined" && r) {
        showToast(`Reserva de ${r.nombre_cliente || r.name} rechazada`, "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  /* ---------------- UI Components ---------------- */

  const NavLink = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      className="text-sm tracking-wide transition-opacity"
      style={{
        color: CREAM,
        opacity: active ? 1 : 0.65,
        fontFamily: "'Work Sans', sans-serif",
        borderBottom: active ? `2px solid ${GOLD}` : "2px solid transparent",
        paddingBottom: 4,
      }}
    >
      {label}
    </button>
  );

  function Header() {
    const esStaff = currentUser && (currentUser.rol === "staff" || currentUser.rol === "admin");
    return (
      <header
        className="w-full sticky top-0 z-30"
        style={{ background: TEAL_DEEP, borderBottom: `1px solid ${TEAL}` }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
          <button
            className="flex items-center gap-2"
            onClick={() => setView(currentUser ? "book" : "landing")}
          >
            <Waves size={22} color={GOLD} />
            <span style={{ fontFamily: "'Fraunces', serif", color: CREAM, fontSize: 21, letterSpacing: 0.3 }}>
              Casa Caribe
            </span>
          </button>

          <nav className="hidden sm:flex items-center gap-6">
            {currentUser && (
              <>
                <NavLink label="Reservar" active={view === "book"} onClick={() => setView("book")} />
                <NavLink label="Mis Reservas" active={view === "mine"} onClick={() => setView("mine")} />
                {esStaff && <NavLink label="Panel Staff" active={view === "staff"} onClick={() => setView("staff")} />}
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ color: CREAM, border: `1px solid ${TEAL}`, fontFamily: "'Work Sans', sans-serif" }}
              >
                <LogOut size={14} /> Salir
              </button>
            ) : (
              <button
                onClick={() => setView("auth")}
                className="text-sm px-4 py-1.5 rounded-full font-medium"
                style={{ background: CORAL, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                Ingresar / Registro
              </button>
            )}
          </div>
        </div>
      </header>
    );
  }

  function WaveDivider({ flip }) {
    return (
      <svg
        viewBox="0 0 1200 60"
        preserveAspectRatio="none"
        style={{ width: "100%", height: 40, display: "block", transform: flip ? "scaleY(-1)" : "none" }}
      >
        <path
          d="M0,30 C150,60 350,0 600,30 C850,60 1050,0 1200,30 L1200,60 L0,60 Z"
          fill={flip ? CREAM : TEAL_DEEP}
        />
      </svg>
    );
  }

  function Toast() {
    if (!toast) return null;
    return (
      <div
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2"
        style={{
          background: toast.tone === "error" ? "#B23A2E" : TEAL_DEEP,
          color: CREAM,
          fontFamily: "'Work Sans', sans-serif",
          fontSize: 14,
          maxWidth: "90vw",
        }}
      >
        {toast.tone === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} color={SEAFOAM} />}
        {toast.text}
      </div>
    );
  }

  function EmailPreviewModal() {
    if (!emailPreview) return null;
    const r = emailPreview;
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(8,20,18,0.55)" }}
        onClick={() => setEmailPreview(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: CREAM }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3" style={{ background: TEAL_DEEP }}>
            <div className="flex items-center gap-2" style={{ color: CREAM, fontFamily: "'Work Sans', sans-serif", fontSize: 13 }}>
              <MailCheck size={16} color={GOLD} /> Correo de confirmación simulado
            </div>
            <button onClick={() => setEmailPreview(null)}>
              <X size={16} color={CREAM} />
            </button>
          </div>
          <div className="p-6" style={{ fontFamily: "'Work Sans', sans-serif", color: INK }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>Para: {r.correo_cliente || r.email}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 10 }}>
              Tu mesa está lista, {(r.nombre_cliente || r.name || "").split(" ")[0]}.
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
              Casa Caribe ha confirmado tu reserva. Detalles:
            </p>
            <div className="rounded-xl px-4 py-3 mb-4" style={{ background: SEAFOAM, fontSize: 14, lineHeight: 1.9 }}>
              <div><strong>Mesa para {r.personas || r.party} personas</strong></div>
              <div>Fecha: {r.fecha || r.date}</div>
              <div>Hora: {fmtTime(r.hora || r.time)}</div>
              {(r.notas || r.notes) && <div>Notas: {r.notas || r.notes}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Landing() {
    return (
      <div>
        <section style={{ background: TEAL_DEEP }} className="px-5 pt-16 pb-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-5">
              <Anchor size={26} color={GOLD} />
            </div>
            <h1 style={{ fontFamily: "'Fraunces', serif", color: CREAM, fontSize: "clamp(2.2rem, 6vw, 3.6rem)", lineHeight: 1.05 }}>
              Casa Caribe
            </h1>
            <p style={{ color: SEAFOAM, fontFamily: "'Work Sans', sans-serif", fontSize: 17, marginTop: 14, maxWidth: 480 }} className="mx-auto">
              Mariscos a la parrilla, sazón caribeña y una mesa esperando por ti. Reserva online de forma rápida.
            </p>
            <button
              onClick={() => setView(currentUser ? "book" : "auth")}
              className="mt-8 px-7 py-3 rounded-full font-medium"
              style={{ background: CORAL, color: CREAM, fontFamily: "'Work Sans', sans-serif", fontSize: 15 }}
            >
              Reservar una mesa
            </button>
          </div>
        </section>
        <WaveDivider flip />
        <section className="px-5 py-14" style={{ background: CREAM }}>
          <div className="max-w-3xl mx-auto grid sm:grid-cols-3 gap-8 text-center">
            {[
              { icon: Clock, title: "Disponibilidad real", body: "Revisa horarios disponibles en tiempo real." },
              { icon: ShieldCheck, title: "Confirmado por el equipo", body: "Cada reserva es revisada directamente por nuestro personal." },
              { icon: Sparkles, title: "Notificación por correo", body: "Recibes confirmación directa cuando tu mesa queda asignada." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title}>
                <Icon size={22} color={CORAL} className="mx-auto mb-3" />
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: INK, marginBottom: 6 }}>{title}</div>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, opacity: 0.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function AuthPanel() {
    const [form, setForm] = useState({ name: "", email: "", birthday: "", phone: "", password: "" });
    const [loginForm, setLoginForm] = useState({ email: "", password: "" });

    return (
      <div className="min-h-[70vh] flex items-center justify-center px-5 py-12" style={{ background: CREAM }}>
        <div className="w-full max-w-sm">
          <div className="text-center mb-7">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>
              {authMode === "signup" ? "Crea tu cuenta" : "Bienvenido de nuevo"}
            </div>
          </div>

          {authMode === "signup" ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.name || !form.email || !form.password) {
                  showToast("Completa tu nombre, correo y contraseña.", "error");
                  return;
                }
                handleEmailSignup(form);
              }}
            >
              <Field icon={User} placeholder="Nombre completo" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field icon={Mail} type="email" placeholder="Correo electrónico" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field icon={Calendar} type="date" value={form.birthday} onChange={(v) => setForm({ ...form, birthday: v })} />
              <Field icon={Phone} type="tel" placeholder="Teléfono / Celular" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field icon={Lock} type="password" placeholder="Contraseña" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
              <button
                type="submit"
                className="mt-1 py-2.5 rounded-xl font-medium text-sm"
                style={{ background: TEAL_DEEP, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                Crear cuenta
              </button>
            </form>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleEmailLogin(loginForm.email, loginForm.password);
              }}
            >
              <Field icon={Mail} type="email" placeholder="Correo electrónico" value={loginForm.email} onChange={(v) => setLoginForm({ ...loginForm, email: v })} />
              <Field icon={Lock} type="password" placeholder="Contraseña" value={loginForm.password} onChange={(v) => setLoginForm({ ...loginForm, password: v })} />
              <button
                type="submit"
                className="mt-1 py-2.5 rounded-xl font-medium text-sm"
                style={{ background: TEAL_DEEP, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                Iniciar Sesión
              </button>
            </form>
          )}

          <div className="text-center mt-5" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.7 }}>
            {authMode === "signup" ? (
              <>¿Ya tienes cuenta?{" "}
                <button className="underline" style={{ color: CORAL }} onClick={() => setAuthMode("login")}>Inicia sesión</button>
              </>
            ) : (
              <>¿Nuevo por aquí?{" "}
                <button className="underline" style={{ color: CORAL }} onClick={() => setAuthMode("signup")}>Crea una cuenta</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function Field({ icon: Icon, type = "text", placeholder, value, onChange }) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl" style={{ border: `1px solid ${TEAL}`, background: "white" }}>
        <Icon size={15} color={TEAL} style={{ flexShrink: 0 }} />
        <input
          type={type}
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full outline-none bg-transparent text-sm"
          style={{ color: INK, fontFamily: "'Work Sans', sans-serif" }}
        />
      </div>
    );
  }

  function BookingView() {
    const selectedDayObj = days.find((d) => dateKey(d) === selectedDate);
    const visibleDays = days.slice(dayScroll, dayScroll + 5);

    return (
      <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
        <div className="max-w-2xl mx-auto">
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>Reservar una mesa</div>
          
          <div className="mt-7">
            <Label>Personas</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => { setParty(n); setSelectedTime(null); }}
                  className="w-10 h-10 rounded-full text-sm font-medium"
                  style={{
                    background: party === n ? CORAL : "white",
                    color: party === n ? CREAM : INK,
                    border: `1px solid ${party === n ? CORAL : TEAL}`,
                    fontFamily: "'Work Sans', sans-serif",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7">
            <Label>Día</Label>
            <div className="flex items-center gap-1 mt-2">
              <button disabled={dayScroll === 0} onClick={() => setDayScroll((s) => Math.max(0, s - 5))} style={{ opacity: dayScroll === 0 ? 0.3 : 1 }}>
                <ChevronLeft size={18} color={TEAL} />
              </button>
              <div className="flex gap-2 overflow-x-auto">
                {visibleDays.map((d) => {
                  const k = dateKey(d);
                  const active = k === selectedDate;
                  return (
                    <button
                      key={k}
                      onClick={() => { setSelectedDate(k); setSelectedTime(null); }}
                      className="px-3 py-2 rounded-xl text-xs whitespace-nowrap font-medium"
                      style={{
                        background: active ? TEAL_DEEP : "white",
                        color: active ? CREAM : INK,
                        border: `1px solid ${active ? TEAL_DEEP : TEAL}`,
                        fontFamily: "'Work Sans', sans-serif",
                      }}
                    >
                      {fmtDateLabel(d)}
                    </button>
                  );
                })}
              </div>
              <button disabled={dayScroll + 5 >= days.length} onClick={() => setDayScroll((s) => Math.min(days.length - 5, s + 5))} style={{ opacity: dayScroll + 5 >= days.length ? 0.3 : 1 }}>
                <ChevronRight size={18} color={TEAL} />
              </button>
            </div>
          </div>

          <div className="mt-7">
            <Label>Horarios disponibles — {selectedDayObj && fmtDateLabel(selectedDayObj)}</Label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {TIMES.map((t) => {
                const status = slotStatus(selectedDate, t, party);
                const isSelected = selectedTime === t;
                const colors = {
                  available: { bg: isSelected ? TEAL_DEEP : "white", text: isSelected ? CREAM : INK, border: TEAL },
                  limited: { bg: isSelected ? GOLD : "#FCEFD2", text: INK, border: GOLD },
                  full: { bg: "#F1E9DC", text: INK, border: "#F1E9DC" },
                }[status];
                return (
                  <button
                    key={t}
                    disabled={status === "full"}
                    onClick={() => setSelectedTime(t)}
                    className="py-2.5 rounded-lg text-sm"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      opacity: status === "full" ? 0.45 : 1,
                      fontFamily: "'Work Sans', sans-serif",
                    }}
                  >
                    {fmtTime(t)}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedTime && (
            <div className="mt-7 p-5 rounded-2xl" style={{ background: "white", border: `1px solid ${TEAL}` }}>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, marginBottom: 10 }}>
                {party} personas · {selectedDayObj && fmtDateLabel(selectedDayObj)} · {fmtTime(selectedTime)}
              </div>
              <textarea
                placeholder="¿Alguna nota especial? (Alergias, cumpleaños...)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{ border: `1px solid ${TEAL}`, fontFamily: "'Work Sans', sans-serif", color: INK, minHeight: 70 }}
              />
              <button
                onClick={submitReservation}
                className="mt-3 w-full py-2.5 rounded-xl font-medium text-sm"
                style={{ background: CORAL, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                Solicitar Reserva
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  function Label({ children }) {
    return (
      <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: INK, opacity: 0.55 }}>
        {children}
      </div>
    );
  }

  function StatusBadge({ status }) {
    const map = {
      pendiente: { bg: "#FCEFD2", text: "#8A5A00", label: "Pendiente" },
      confirmada: { bg: SEAFOAM, text: TEAL_DEEP, label: "Confirmada" },
      rechazada: { bg: "#F3D9D3", text: "#8A2E1D", label: "Rechazada" },
    }[status] || { bg: "#FCEFD2", text: "#8A5A00", label: status };

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: map.bg, color: map.text, fontFamily: "'Work Sans', sans-serif" }}>
        {map.label}
      </span>
    );
  }

  function MyReservations() {
    const userId = currentUser.id || currentUser._id;
    const mine = reservations.filter((r) => r.usuario_id === userId || r.userId === userId);

    return (
      <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
        <div className="max-w-2xl mx-auto">
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK, marginBottom: 6 }}>Mis reservas</div>
          {mine.length === 0 ? (
            <div className="mt-8 p-8 rounded-2xl text-center" style={{ background: "white", border: `1px dashed ${TEAL}` }}>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, opacity: 0.7, marginBottom: 14 }}>No tienes reservas activas.</div>
              <button onClick={() => setView("book")} className="px-4 py-2 rounded-full text-sm font-medium" style={{ background: TEAL_DEEP, color: CREAM }}>
                Reservar una mesa
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mt-6">
              {mine.map((r) => (
                <div key={r._id || r.id} className="p-4 rounded-xl flex items-center justify-between" style={{ background: "white", border: `1px solid ${TEAL}` }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>
                      Fecha: {r.fecha || r.date} · {fmtTime(r.hora || r.time)}
                    </div>
                    <div style={{ fontSize: 13, color: INK, opacity: 0.6 }}>Personas: {r.personas || r.party}</div>
                  </div>
                  <StatusBadge status={r.estado || r.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  function StaffView() {
    const pending = reservations.filter((r) => (r.estado || r.status) === "pendiente");
    const decided = reservations.filter((r) => (r.estado || r.status) !== "pendiente");

    return (
      <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
        <div className="max-w-2xl mx-auto">
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>Panel de Staff</div>

          <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55, marginTop: 20, marginBottom: 8 }}>
            Pendientes de revisión · {pending.length}
          </div>

          <div className="flex flex-col gap-3">
            {pending.map((r) => (
              <div key={r._id || r.id} className="p-4 rounded-xl flex items-center justify-between gap-3" style={{ background: "white", border: `1px solid ${TEAL}` }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                  <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>{r.nombre_cliente || r.name} · {r.personas || r.party} personas</div>
                  <div style={{ fontSize: 13, color: INK, opacity: 0.6 }}>
                    {r.fecha || r.date} · {fmtTime(r.hora || r.time)} · {r.correo_cliente || r.email}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => decideReservation(r._id || r.id, "confirmed")} className="p-2 rounded-full" style={{ background: SEAFOAM }}>
                    <CheckCircle2 size={17} color={TEAL_DEEP} />
                  </button>
                  <button onClick={() => decideReservation(r._id || r.id, "declined")} className="p-2 rounded-full" style={{ background: "#F3D9D3" }}>
                    <XCircle size={17} color="#8A2E1D" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {decided.length > 0 && (
            <>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55, marginTop: 28, marginBottom: 8 }}>
                Gestionadas
              </div>
              <div className="flex flex-col gap-2">
                {decided.map((r) => (
                  <div key={r._id || r.id} className="px-4 py-3 rounded-xl flex items-center justify-between" style={{ background: "white", border: `1px solid ${TEAL}` }}>
                    <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK }}>
                      {r.nombre_cliente || r.name} · {fmtTime(r.hora || r.time)} · {r.personas || r.party} personas
                    </div>
                    <StatusBadge status={r.estado || r.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>
      <Header />
      {view === "landing" && <Landing />}
      {view === "auth" && <AuthPanel />}
      {view === "book" && currentUser && <BookingView />}
      {view === "mine" && currentUser && <MyReservations />}
      {view === "staff" && currentUser && <StaffView />}
      {!currentUser && (view === "book" || view === "mine" || view === "staff") && <AuthPanel />}
      <Toast />
      <EmailPreviewModal />
    </div>
  );
}
