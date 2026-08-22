import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Waves, Mail, Lock, User, Phone, Calendar, Clock,
  CheckCircle2, XCircle, LogOut, ShieldCheck,
  Anchor, Sparkles, X, MailCheck, ChevronLeft, ChevronRight
} from "lucide-react";

// Dirección de la API en Render
const API_URL = "https://casa-caribe-api.onrender.com/api";

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

  const [currentUser, setCurrentUser] = useState(null);
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

  const fetchReservas = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

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
    }
  }, [view]);

  useEffect(() => {
    if (currentUser && (view === "mine" || view === "staff" || view === "book")) {
      fetchReservas();
    }
  }, [currentUser, view, fetchReservas]);

  /* ---------------- Auth ---------------- */

  async function handleEmailSignup(form) {
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
    }
  }

  async function handleEmailLogin(email, password) {
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
    }
  }

  async function decideReservation(id, decision) {
    const token = localStorage.getItem("token");

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
    }
  }

  /* ---------------- Componentes de Estilo ---------------- */

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

  function StatusBadge({ status }) {
    const map = {
      pendiente: { bg: "#FCEFD2", text: "#8A5A00", label: "Pendiente" },
      confirmada: { bg: SEAFOAM, text: TEAL_DEEP, label: "Confirmada" },
      cancelada: { bg: "#F3D9D3", text: "#8A2E1D", label: "Cancelada" },
    }[status] || { bg: "#E2E8F0", text: "#475569", label: status };

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: map.bg, color: map.text, fontFamily: "'Work Sans', sans-serif" }}>
        {map.label}
      </span>
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

  function Field({ icon: Icon, type = "text", placeholder, name, required = true }) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border bg-white" style={{ borderColor: TEAL }}>
        <Icon size={15} color={TEAL} className="shrink-0" />
        <input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          className="w-full outline-none bg-transparent text-sm"
          style={{ color: INK, fontFamily: "'Work Sans', sans-serif" }}
        />
      </div>
    );
  }

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Work+Sans:wght@400;500;600&display=swap');
      `}</style>

      {/* HEADER */}
      <header className="w-full sticky top-0 z-30 shadow-md" style={{ background: TEAL_DEEP, borderBottom: `1px solid ${TEAL}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
          <button className="flex items-center gap-2 bg-transparent border-0 cursor-pointer" onClick={() => setView(currentUser ? "book" : "landing")}>
            <Waves size={24} color={GOLD} />
            <span style={{ color: CREAM, fontSize: 22, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>Casa Caribe</span>
          </button>

          <nav className="hidden sm:flex items-center gap-6">
            {currentUser && (
              <>
                <button
                  onClick={() => setView("book")}
                  className="text-sm font-medium tracking-wide transition-all bg-transparent border-0 cursor-pointer"
                  style={{
                    color: view === "book" ? GOLD : CREAM,
                    opacity: view === "book" ? 1 : 0.85,
                    fontFamily: "'Work Sans', sans-serif",
                    borderBottom: view === "book" ? `2px solid ${GOLD}` : "2px solid transparent",
                    paddingBottom: 4,
                  }}
                >
                  Reservar
                </button>
                <button
                  onClick={() => setView("mine")}
                  className="text-sm font-medium tracking-wide transition-all bg-transparent border-0 cursor-pointer"
                  style={{
                    color: view === "mine" ? GOLD : CREAM,
                    opacity: view === "mine" ? 1 : 0.85,
                    fontFamily: "'Work Sans', sans-serif",
                    borderBottom: view === "mine" ? `2px solid ${GOLD}` : "2px solid transparent",
                    paddingBottom: 4,
                  }}
                >
                  Mis reservas
                </button>
                <button
                  onClick={() => setView("staff")}
                  className="text-sm font-medium tracking-wide transition-all bg-transparent border-0 cursor-pointer"
                  style={{
                    color: view === "staff" ? GOLD : CREAM,
                    opacity: view === "staff" ? 1 : 0.85,
                    fontFamily: "'Work Sans', sans-serif",
                    borderBottom: view === "staff" ? `2px solid ${GOLD}` : "2px solid transparent",
                    paddingBottom: 4,
                  }}
                >
                  Panel Staff
                </button>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-sm px-3.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer"
                style={{ color: CREAM, border: `1px solid ${SEAFOAM}`, backgroundColor: "rgba(255,255,255,0.08)", fontFamily: "'Work Sans', sans-serif" }}
              >
                <LogOut size={15} color={GOLD} /> Salir
              </button>
            ) : (
              <button
                onClick={() => setView("auth")}
                className="text-sm px-4 py-2 rounded-full font-medium shadow-md cursor-pointer border-0"
                style={{ background: CORAL, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                Ingresar / Registro
              </button>
            )}
          </div>
        </div>
      </header>

      {/* VISTAS */}
      {view === "landing" && (
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
                Mariscos a la parrilla, sazón caribeña y una mesa esperando por ti. Reserva online de forma rápida y sin esperas.
              </p>
              <button
                onClick={() => setView(currentUser ? "book" : "auth")}
                className="mt-8 px-7 py-3 rounded-full font-medium shadow-md"
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
                { icon: Clock, title: "Disponibilidad real", body: "Revisa horarios libres al momento en que confirmas." },
                { icon: ShieldCheck, title: "Confirmación directa", body: "Cada solicitud es revisada personalmente por el equipo." },
                { icon: Sparkles, title: "Notificación al instante", body: "Recibes confirmación cuando tu mesa queda reservada." },
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
      )}

      {view === "auth" && (
        <div className="min-h-[70vh] flex items-center justify-center px-5 py-12" style={{ background: CREAM }}>
          <div className="w-full max-w-sm">
            <div className="text-center mb-7">
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>
                {authMode === "signup" ? "Crea tu cuenta" : "Bienvenido de nuevo"}
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

              <button
                type="submit"
                className="mt-2 py-2.5 rounded-xl font-medium text-sm shadow-sm"
                style={{ background: TEAL_DEEP, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
              >
                {authMode === "signup" ? "Crear cuenta" : "Entrar"}
              </button>
            </form>

            <div className="text-center mt-5" style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.7 }}>
              {authMode === "signup" ? (
                <>¿Ya tienes cuenta?{" "}
                  <button className="underline font-medium" style={{ color: CORAL }} onClick={() => setAuthMode("login")}>Inicia sesión</button>
                </>
              ) : (
                <>¿Nuevo por aquí?{" "}
                  <button className="underline font-medium" style={{ color: CORAL }} onClick={() => setAuthMode("signup")}>Crea una cuenta</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {view === "book" && currentUser && (
        <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-7">
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>Reservar una mesa</div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.65, marginTop: 4 }}>
                Selecciona fecha, personas y horario disponible.
              </div>
            </div>

            {/* Selector Personas */}
            <div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55 }}>Personas</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setParty(n)}
                    className="w-10 h-10 rounded-full text-sm font-medium transition-colors"
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

            {/* Selector Día */}
            <div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55 }}>Día</div>
              <div className="flex items-center gap-1 mt-2">
                <button disabled={dayScroll === 0} onClick={() => setDayScroll((s) => Math.max(0, s - 5))} style={{ opacity: dayScroll === 0 ? 0.3 : 1 }}>
                  <ChevronLeft size={18} color={TEAL} />
                </button>
                <div className="flex gap-2 overflow-x-auto">
                  {days.slice(dayScroll, dayScroll + 5).map((d) => {
                    const k = dateKey(d);
                    const active = k === selectedDate;
                    return (
                      <button
                        key={k}
                        onClick={() => { setSelectedDate(k); setSelectedTime(null); }}
                        className="px-3 py-2 rounded-xl text-xs whitespace-nowrap font-medium transition-colors"
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

            {/* Selector Hora */}
            <div>
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.55 }}>Horarios disponibles</div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
                {TIMES.map((t) => {
                  const isSelected = selectedTime === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setSelectedTime(t)}
                      className="py-2.5 rounded-lg text-sm transition-colors"
                      style={{
                        background: isSelected ? TEAL_DEEP : "white",
                        color: isSelected ? CREAM : INK,
                        border: `1px solid ${TEAL}`,
                        fontFamily: "'Work Sans', sans-serif",
                      }}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Confirmar Reserva */}
            {selectedTime && (
              <div className="p-5 rounded-2xl bg-white border shadow-sm space-y-3" style={{ borderColor: TEAL }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK }}>
                  Mesa para {party} personas · {selectedDate} · {fmtTime(selectedTime)}
                </div>
                <textarea
                  placeholder="Notas especiales (alergias, celebración, terraza...)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg p-3 text-sm outline-none border"
                  style={{ borderColor: TEAL, fontFamily: "'Work Sans', sans-serif", color: INK, minHeight: 70 }}
                />
                <button
                  onClick={submitReservation}
                  className="w-full py-2.5 rounded-xl font-medium text-sm shadow-md"
                  style={{ background: CORAL, color: CREAM, fontFamily: "'Work Sans', sans-serif" }}
                >
                  Confirmar y Solicitar Mesa
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === "mine" && currentUser && (
        <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-4">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>Mis Reservas</div>

            {reservations.length === 0 ? (
              <div className="p-8 rounded-2xl text-center bg-white border border-dashed" style={{ borderColor: TEAL }}>
                <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: INK, opacity: 0.7, marginBottom: 14 }}>
                  No tienes reservas registradas.
                </div>
                <button onClick={() => setView("book")} className="px-5 py-2 rounded-full text-sm font-medium" style={{ background: TEAL_DEEP, color: CREAM }}>
                  Reservar mesa
                </button>
              </div>
            ) : (
              reservations.map((r) => (
                <div key={r.id || r._id} className="p-4 rounded-xl bg-white border flex items-center justify-between shadow-sm" style={{ borderColor: TEAL }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>
                      {r.fecha} · {fmtTime(r.hora)}
                    </div>
                    <div style={{ fontSize: 13, color: INK, opacity: 0.6 }}>
                      Personas: {r.cantidad_personas || r.personas} {r.tipo_mesa ? `· Mesa: ${r.tipo_mesa}` : ""}
                    </div>
                    {r.notas && <div style={{ fontSize: 12, color: INK, opacity: 0.5, marginTop: 2 }}>"{r.notas}"</div>}
                  </div>
                  <StatusBadge status={r.estado} />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {view === "staff" && currentUser && (
        <div className="px-5 py-10" style={{ background: CREAM, minHeight: "70vh" }}>
          <div className="max-w-2xl mx-auto space-y-4">
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: 26, color: INK }}>Panel del Staff</div>

            {reservations.length === 0 ? (
              <div style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: INK, opacity: 0.5 }}>No hay reservas activas.</div>
            ) : (
              reservations.map((r) => (
                <div key={r.id || r._id} className="p-4 rounded-xl bg-white border flex items-center justify-between gap-3 shadow-sm" style={{ borderColor: TEAL }}>
                  <div style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    <div style={{ fontSize: 14, color: INK, fontWeight: 500 }}>
                      {r.cliente?.nombre || r.nombre_cliente || "Cliente"} · {r.cantidad_personas || r.personas} personas
                    </div>
                    <div style={{ fontSize: 13, color: INK, opacity: 0.6 }}>
                      {r.fecha} · {fmtTime(r.hora)} · {r.cliente?.correo || r.correo_cliente}
                    </div>
                    {r.notas && <div style={{ fontSize: 12, color: INK, opacity: 0.5, marginTop: 2 }}>"{r.notas}"</div>}
                  </div>

                  {r.estado === "pendiente" ? (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => decideReservation(r.id || r._id, "confirmada")} className="p-2 rounded-full" style={{ background: SEAFOAM }}>
                        <CheckCircle2 size={18} color={TEAL_DEEP} />
                      </button>
                      <button onClick={() => decideReservation(r.id || r._id, "cancelada")} className="p-2 rounded-full" style={{ background: "#F3D9D3" }}>
                        <XCircle size={18} color="#8A2E1D" />
                      </button>
                    </div>
                  ) : (
                    <StatusBadge status={r.estado} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TOAST NOTIFICACIONES */}
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm"
          style={{
            background: toast.tone === "error" ? "#B23A2E" : TEAL_DEEP,
            color: CREAM,
            fontFamily: "'Work Sans', sans-serif",
          }}
        >
          {toast.tone === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} color={SEAFOAM} />}
          {toast.text}
        </div>
      )}

      {/* MODAL EMAIL SIMULADO */}
      {emailPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setEmailPreview(null)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3" style={{ background: TEAL_DEEP }}>
              <div className="flex items-center gap-2 text-xs" style={{ color: CREAM, fontFamily: "'Work Sans', sans-serif" }}>
                <MailCheck size={16} color={GOLD} /> Confirmación enviada por Email
              </div>
              <button onClick={() => setEmailPreview(null)}><X size={16} color={CREAM} /></button>
            </div>
            <div className="p-6" style={{ fontFamily: "'Work Sans', sans-serif", color: INK }}>
              <div className="text-xs opacity-60 mb-3">Para: {emailPreview.cliente?.correo || emailPreview.correo_cliente}</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 10 }}>
                ¡Mesa Confirmada!
              </div>
              <div className="rounded-xl px-4 py-3 my-4 space-y-1" style={{ background: SEAFOAM, fontSize: 14 }}>
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