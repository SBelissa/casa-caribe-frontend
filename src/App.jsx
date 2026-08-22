import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Waves, Mail, Lock, User, Phone, Calendar, Clock,
  CheckCircle2, XCircle, LogOut, Anchor, Sparkles, X, MailCheck,
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

export default function App() {
  const [view, setView] = useState("landing");
  const [authMode, setAuthMode] = useState("signup");
  const [currentUser, setCurrentUser] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [toast, setToast] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);

  const days = useMemo(() => nextDays(14), []);
  const [selectedDate, setSelectedDate] = useState(dateKey(days[0]));
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
      showToast(`Bienvenido, ${data.usuario.name.split(" ")[0]}`);
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
        const r = reservations.find((x) => x.id === id);
        if (decision === "confirmada" && r) {
          setEmailPreview(r);
          showToast(`Confirmación enviada a ${r.cliente.correo}`);
        } else {
          showToast("Reserva cancelada", "error");
        }
        fetchReservas();
      }
    } catch (err) {
      showToast("Error al procesar la solicitud", "error");
    }
  }

  function StatusBadge({ status }) {
    const map = {
      pendiente: { bg: "#FCEFD2", text: "#8A5A00", label: "Pendiente" },
      confirmada: { bg: SEAFOAM, text: TEAL_DEEP, label: "Confirmada" },
      cancelada: { bg: "#F3D9D3", text: "#8A2E1D", label: "Cancelada" },
    }[status] || { bg: "#E2E8F0", text: "#475569", label: status };

    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: map.bg, color: map.text }}>
        {map.label}
      </span>
    );
  }

  return (
    <div style={{ background: CREAM, minHeight: "100vh" }}>
      <header className="w-full sticky top-0 z-30" style={{ background: TEAL_DEEP, borderBottom: `1px solid ${TEAL}` }}>
        <div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
          <button className="flex items-center gap-2" onClick={() => setView(currentUser ? "book" : "landing")}>
            <Waves size={22} color={GOLD} />
            <span style={{ color: CREAM, fontSize: 21, fontWeight: "bold", fontFamily: "'Fraunces', serif" }}>Casa Caribe</span>
          </button>
          <div className="flex gap-4 items-center">
            {currentUser ? (
              <>
                <button onClick={() => setView("book")} style={{ color: CREAM }} className="text-sm">Reservar</button>
                <button onClick={() => setView("mine")} style={{ color: CREAM }} className="text-sm">Mis Reservas</button>
                <button onClick={() => setView("staff")} style={{ color: CREAM }} className="text-sm">Panel Staff</button>
                <button onClick={handleLogout} className="flex items-center gap-1 border px-3 py-1 rounded-full text-sm" style={{ color: CREAM, borderColor: TEAL }}>
                  <LogOut size={14} /> Salir
                </button>
              </>
            ) : (
              <button onClick={() => setView("auth")} className="px-4 py-1.5 rounded-full font-medium text-sm" style={{ background: CORAL, color: CREAM }}>
                Ingresar
              </button>
            )}
          </div>
        </div>
      </header>

      {view === "landing" && (
        <div className="text-center py-20 px-5">
          <h1 className="text-4xl font-bold mb-4" style={{ color: INK, fontFamily: "'Fraunces', serif" }}>Restaurante Casa Caribe</h1>
          <p className="mb-6 opacity-80" style={{ color: INK }}>Reserva tu mesa en línea de manera fácil y rápida.</p>
          <button onClick={() => setView(currentUser ? "book" : "auth")} className="px-6 py-3 rounded-full text-white font-medium shadow-md" style={{ background: CORAL }}>
            Reservar una mesa
          </button>
        </div>
      )}

      {view === "auth" && (
        <div className="max-w-sm mx-auto my-12 p-6 bg-white rounded-2xl border shadow-sm" style={{ borderColor: TEAL }}>
          <h2 className="text-xl font-bold mb-4 text-center" style={{ fontFamily: "'Fraunces', serif" }}>{authMode === "signup" ? "Crear Cuenta" : "Iniciar Sesión"}</h2>
          <form onSubmit={(e) => {
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
          }} className="flex flex-col gap-3">
            {authMode === "signup" && <input name="name" placeholder="Nombre completo" required className="border p-2.5 rounded-xl text-sm outline-none" />}
            <input name="email" type="email" placeholder="Correo electrónico" required className="border p-2.5 rounded-xl text-sm outline-none" />
            {authMode === "signup" && <input name="phone" placeholder="Teléfono" required className="border p-2.5 rounded-xl text-sm outline-none" />}
            <input name="password" type="password" placeholder="Contraseña" required className="border p-2.5 rounded-xl text-sm outline-none" />
            <button type="submit" className="py-2.5 rounded-xl font-medium text-white text-sm mt-2 shadow-sm" style={{ background: TEAL_DEEP }}>
              {authMode === "signup" ? "Crear cuenta" : "Entrar"}
            </button>
          </form>
          <button className="w-full text-center mt-4 text-sm underline opacity-80" onClick={() => setAuthMode(authMode === "signup" ? "login" : "signup")}>
            {authMode === "signup" ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}
          </button>
        </div>
      )}

      {view === "book" && currentUser && (
        <div className="max-w-2xl mx-auto py-10 px-5 space-y-6">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Fraunces', serif" }}>Crear Reserva</h2>
          <div>
            <label className="text-xs font-bold uppercase opacity-60">Número de Personas</label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setParty(n)} className={`w-10 h-10 rounded-full border text-sm font-medium transition-colors ${party === n ? "bg-orange-600 text-white border-orange-600" : "bg-white"}`}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase opacity-60">Horario Disponible</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-2">
              {TIMES.map((t) => (
                <button key={t} onClick={() => setSelectedTime(t)} className={`py-2 rounded-lg border text-sm transition-colors ${selectedTime === t ? "bg-teal-900 text-white" : "bg-white"}`}>
                  {fmtTime(t)}
                </button>
              ))}
            </div>
          </div>
          {selectedTime && (
            <div className="p-4 bg-white rounded-xl border space-y-3 shadow-sm">
              <textarea placeholder="Notas adicionales (alergias, celebración...)" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border p-2 rounded-lg text-sm outline-none" />
              <button onClick={submitReservation} className="w-full py-2.5 rounded-xl text-white font-medium shadow-md" style={{ background: CORAL }}>Confirmar Reserva</button>
            </div>
          )}
        </div>
      )}

      {view === "mine" && currentUser && (
        <div className="max-w-2xl mx-auto py-10 px-5 space-y-3">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Fraunces', serif" }}>Mis Reservas</h2>
          {reservations.length === 0 ? (
            <p className="opacity-60 text-sm">No tienes reservas registradas.</p>
          ) : (
            reservations.map((r) => (
              <div key={r.id} className="p-4 bg-white rounded-xl border flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-bold text-sm">{r.fecha} - {fmtTime(r.hora)}</div>
                  <div className="text-xs opacity-70">Personas: {r.cantidad_personas} | Mesa: {r.tipo_mesa}</div>
                  {r.notas && <div className="text-xs opacity-50 mt-1">"{r.notas}"</div>}
                </div>
                <StatusBadge status={r.estado} />
              </div>
            ))
          )}
        </div>
      )}

      {view === "staff" && currentUser && (
        <div className="max-w-2xl mx-auto py-10 px-5 space-y-3">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "'Fraunces', serif" }}>Panel del Staff</h2>
          {reservations.map((r) => (
            <div key={r.id} className="p-4 bg-white rounded-xl border flex justify-between items-center shadow-sm">
              <div>
                <div className="font-bold text-sm">{r.cliente?.nombre} ({r.cantidad_personas} personas)</div>
                <div className="text-xs opacity-70">{r.fecha} a las {fmtTime(r.hora)}</div>
              </div>
              {r.estado === "pendiente" ? (
                <div className="flex gap-2">
                  <button onClick={() => decideReservation(r.id, "confirmada")} className="p-2 bg-emerald-100 rounded-full text-emerald-800"><CheckCircle2 size={18} /></button>
                  <button onClick={() => decideReservation(r.id, "cancelada")} className="p-2 bg-rose-100 rounded-full text-rose-800"><XCircle size={18} /></button>
                </div>
              ) : (
                <StatusBadge status={r.estado} />
              )}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl text-white shadow-lg text-sm z-50" style={{ background: toast.tone === "error" ? "#B23A2E" : TEAL_DEEP }}>
          {toast.text}
        </div>
      )}
    </div>
  );
}
