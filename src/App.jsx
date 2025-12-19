import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, ShieldCheck } from "lucide-react";

const LS_KEY = "ponto_rancho_jl_v2";

const WEEKDAYS = [
  { key: "sun", label: "Dom", idx: 0 },
  { key: "mon", label: "Seg", idx: 1 },
  { key: "tue", label: "Ter", idx: 2 },
  { key: "wed", label: "Qua", idx: 3 },
  { key: "thu", label: "Qui", idx: 4 },
  { key: "fri", label: "Sex", idx: 5 },
  { key: "sat", label: "Sáb", idx: 6 },
];

function pad2(n) {
  return String(n).padStart(2, "0");
}
function nowISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function nowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function clampISO(iso) {
  // evita input vazio quebrar
  if (!iso || typeof iso !== "string") return nowISO();
  return iso;
}
function weekdayIdxFromISO(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.getDay();
}
function minutesFromHHMM(v) {
  if (!v || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
function hhmmFromMinutes(min) {
  if (min == null) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function diffMinutes(startHHMM, endHHMM) {
  const s = minutesFromHHMM(startHHMM);
  const e = minutesFromHHMM(endHHMM);
  if (s == null || e == null) return 0;
  return Math.max(0, e - s);
}
function formatMinutes(min) {
  const sign = min < 0 ? "-" : "";
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${pad2(m)}`;
}
function safeId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function csvEscape(s) {
  const v = String(s ?? "");
  if (v.includes('"') || v.includes(",") || v.includes("\n")) return `"${v.replaceAll('"', '""')}"`;
  return v;
}
function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --------- default data ----------
const DEFAULT_STATE = {
  employees: [
    {
      id: "emp_joao",
      name: "Caseiro João (exemplo)",
      pin: "1234",
      // previsto em minutos por dia da semana
      schedule: {
        sun: 0, // domingo normalmente folga
        mon: 480,
        tue: 480,
        wed: 480,
        thu: 480,
        fri: 480,
        sat: 240, // sábado meio período (ajuste como quiser)
      },
      active: true,
    },
  ],
  // records: { [employeeId]: { [dateISO]: { in1, out1, in2, out2 } } }
  records: {},
  // overrides: { [employeeId]: { [dateISO]: { expectedMinutes, note } } }
  overrides: {},
  // ui
  adminPinHashHint: "", // apenas visual (não é segurança real)
};

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    // merge leve para não quebrar se faltar campos
    return {
      ...DEFAULT_STATE,
      ...parsed,
      employees: Array.isArray(parsed?.employees) ? parsed.employees : DEFAULT_STATE.employees,
      records: parsed?.records ?? {},
      overrides: parsed?.overrides ?? {},
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(st) {
  localStorage.setItem(LS_KEY, JSON.stringify(st));
}

// --------- UI primitives ----------
const styles = {
  page: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#f6f7fb",
    minHeight: "100vh",
    color: "#111827",
  },
  shell: { maxWidth: 1100, margin: "0 auto", padding: 18 },
  headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  title: { fontSize: 22, fontWeight: 800, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  topRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  card: {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 1px 10px rgba(17,24,39,0.05)",
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  col: { display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 260 },
  sectionTitle: { fontWeight: 800, fontSize: 13, color: "#111827" },
  help: { fontSize: 12, color: "#6b7280", lineHeight: 1.35 },

  tabs: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 },
  tab: (active) => ({
    borderRadius: 999,
    padding: "8px 12px",
    border: "1px solid " + (active ? "#111827" : "#e5e7eb"),
    background: active ? "#111827" : "white",
    color: active ? "white" : "#111827",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  }),

  input: {
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    outline: "none",
    background: "white",
  },
  label: { fontSize: 12, color: "#6b7280", marginBottom: 6, fontWeight: 700 },
  btn: (variant = "dark") => {
    const base = {
      borderRadius: 14,
      padding: "10px 12px",
      fontWeight: 800,
      fontSize: 14,
      border: "1px solid transparent",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      userSelect: "none",
    };
    if (variant === "dark") return { ...base, background: "#111827", color: "white" };
    if (variant === "light") return { ...base, background: "white", borderColor: "#e5e7eb", color: "#111827" };
    if (variant === "danger") return { ...base, background: "#fee2e2", borderColor: "#fecaca", color: "#991b1b" };
    if (variant === "success") return { ...base, background: "#dcfce7", borderColor: "#bbf7d0", color: "#166534" };
    return base;
  },
  badge: (tone) => {
    if (tone === "bad")
      return { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#fee2e2", color: "#991b1b", fontWeight: 900, fontSize: 12 };
    if (tone === "good")
      return { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#dcfce7", color: "#166534", fontWeight: 900, fontSize: 12 };
    return { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: "#e5e7eb", color: "#374151", fontWeight: 900, fontSize: 12 };
  },
  hr: { height: 1, background: "#e5e7eb", margin: "10px 0" },
  small: { fontSize: 12, color: "#6b7280" },

  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
  th: { textAlign: "left", fontSize: 12, color: "#6b7280", padding: "10px 10px", borderBottom: "1px solid #e5e7eb" },
  td: { fontSize: 13, padding: "10px 10px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" },
};

// --------- App ----------
export default function App() {
  const [db, setDb] = useState(() => loadState());
  const [tab, setTab] = useState("func"); // func | admin | folgas | escala

  // filtros topo
  const [from, setFrom] = useState(() => addDaysISO(nowISO(), -30));
  const [to, setTo] = useState(() => nowISO());
  const [topEmployeeId, setTopEmployeeId] = useState(() => db.employees?.[0]?.id ?? "");

  // funcionário (bate ponto)
  const [funcEmployeeId, setFuncEmployeeId] = useState(() => db.employees?.[0]?.id ?? "");
  const [funcPin, setFuncPin] = useState("");
  const [funcDate, setFuncDate] = useState(() => nowISO());
  const [isValidated, setIsValidated] = useState(false);

  // admin (editar/lançar)
  const [adminEmployeeId, setAdminEmployeeId] = useState(() => db.employees?.[0]?.id ?? "");
  const [adminDate, setAdminDate] = useState(() => nowISO());
  const [adminIn1, setAdminIn1] = useState("");
  const [adminOut1, setAdminOut1] = useState("");
  const [adminIn2, setAdminIn2] = useState("");
  const [adminOut2, setAdminOut2] = useState("");

  // folgas/compensação
  const [ovEmployeeId, setOvEmployeeId] = useState(() => db.employees?.[0]?.id ?? "");
  const [ovDate, setOvDate] = useState(() => nowISO());
  const [ovExpectedHours, setOvExpectedHours] = useState(""); // horas (texto)
  const [ovNote, setOvNote] = useState("");

  // funcionários & escala
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [editEmpId, setEditEmpId] = useState(null);

  useEffect(() => {
    saveState(db);
  }, [db]);

  // manter selects válidos
  useEffect(() => {
    const first = db.employees?.[0]?.id ?? "";
    if (!topEmployeeId && first) setTopEmployeeId(first);
    if (!funcEmployeeId && first) setFuncEmployeeId(first);
    if (!adminEmployeeId && first) setAdminEmployeeId(first);
    if (!ovEmployeeId && first) setOvEmployeeId(first);
  }, [db.employees]); // eslint-disable-line react-hooks/exhaustive-deps

  const employeesActive = useMemo(() => db.employees.filter((e) => e.active !== false), [db.employees]);

  function getEmp(id) {
    return db.employees.find((e) => e.id === id) ?? null;
  }

  function getDayRecord(employeeId, dateISO) {
    return db.records?.[employeeId]?.[dateISO] ?? { in1: "", out1: "", in2: "", out2: "" };
  }

  function setDayRecord(employeeId, dateISO, patch) {
    setDb((prev) => {
      const next = { ...prev };
      next.records = { ...(prev.records ?? {}) };
      next.records[employeeId] = { ...(next.records[employeeId] ?? {}) };
      const cur = next.records[employeeId][dateISO] ?? { in1: "", out1: "", in2: "", out2: "" };
      next.records[employeeId][dateISO] = { ...cur, ...patch };
      return next;
    });
  }

  function deleteDayRecord(employeeId, dateISO) {
    setDb((prev) => {
      const next = { ...prev, records: { ...(prev.records ?? {}) } };
      if (!next.records[employeeId]) return prev;
      const perEmp = { ...next.records[employeeId] };
      delete perEmp[dateISO];
      next.records[employeeId] = perEmp;
      return next;
    });
  }

  function getOverride(employeeId, dateISO) {
    return db.overrides?.[employeeId]?.[dateISO] ?? null;
  }

  function setOverride(employeeId, dateISO, expectedMinutes, note) {
    setDb((prev) => {
      const next = { ...prev };
      next.overrides = { ...(prev.overrides ?? {}) };
      next.overrides[employeeId] = { ...(next.overrides[employeeId] ?? {}) };
      next.overrides[employeeId][dateISO] = { expectedMinutes, note: note ?? "" };
      return next;
    });
  }

  function deleteOverride(employeeId, dateISO) {
    setDb((prev) => {
      const next = { ...prev, overrides: { ...(prev.overrides ?? {}) } };
      if (!next.overrides[employeeId]) return prev;
      const perEmp = { ...next.overrides[employeeId] };
      delete perEmp[dateISO];
      next.overrides[employeeId] = perEmp;
      return next;
    });
  }

  function expectedMinutesFor(employeeId, dateISO) {
    const emp = getEmp(employeeId);
    if (!emp) return 0;
    const ov = getOverride(employeeId, dateISO);
    if (ov && typeof ov.expectedMinutes === "number") return ov.expectedMinutes;

    const wd = WEEKDAYS.find((w) => w.idx === weekdayIdxFromISO(dateISO))?.key;
    return emp.schedule?.[wd] ?? 0;
  }

  function workedMinutesForRecord(rec) {
    const a = diffMinutes(rec.in1, rec.out1);
    const b = diffMinutes(rec.in2, rec.out2);
    return a + b;
  }

  function listDays(fromISO, toISO) {
    const a = clampISO(fromISO);
    const b = clampISO(toISO);
    if (a > b) return [];
    const out = [];
    let cur = a;
    while (cur <= b) {
      out.push(cur);
      cur = addDaysISO(cur, 1);
    }
    return out;
  }

  const summary = useMemo(() => {
    const empId = topEmployeeId;
    const days = listDays(from, to);
    let expected = 0;
    let worked = 0;

    for (const d of days) {
      expected += expectedMinutesFor(empId, d);
      worked += workedMinutesForRecord(getDayRecord(empId, d));
    }

    const saldo = worked - expected;
    return { expected, worked, saldo };
  }, [db, topEmployeeId, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  function exportCSV() {
    const emp = getEmp(topEmployeeId);
    const empName = emp?.name ?? "funcionario";
    const days = listDays(from, to);

    const header = [
      "data",
      "funcionario",
      "entrada1",
      "saida1",
      "entrada2",
      "saida2",
      "trabalhado_hhmm",
      "previsto_hhmm",
      "saldo_hhmm",
      "obs_folga_ajuste",
    ];

    const rows = [header.join(",")];

    for (const d of days) {
      const rec = getDayRecord(topEmployeeId, d);
      const workedMin = workedMinutesForRecord(rec);
      const expMin = expectedMinutesFor(topEmployeeId, d);
      const ov = getOverride(topEmployeeId, d);

      rows.push(
        [
          csvEscape(d),
          csvEscape(empName),
          csvEscape(rec.in1 || ""),
          csvEscape(rec.out1 || ""),
          csvEscape(rec.in2 || ""),
          csvEscape(rec.out2 || ""),
          csvEscape(formatMinutes(workedMin)),
          csvEscape(formatMinutes(expMin)),
          csvEscape(formatMinutes(workedMin - expMin)),
          csvEscape(ov?.note ?? ""),
        ].join(",")
      );
    }

    downloadText(`ponto_${empName.replaceAll(" ", "_")}_${from}_a_${to}.csv`, rows.join("\n"));
  }

  // --------- Funcionário: validar + bater ponto ----------
  function validateFunc() {
    const emp = getEmp(funcEmployeeId);
    if (!emp) return;
    if ((funcPin ?? "").trim() === String(emp.pin ?? "").trim()) {
      setIsValidated(true);
    } else {
      alert("PIN inválido.");
      setIsValidated(false);
    }
  }

  function nextSlot(rec) {
    if (!rec.in1) return "in1";
    if (!rec.out1) return "out1";
    if (!rec.in2) return "in2";
    if (!rec.out2) return "out2";
    return null;
  }

  function punchNow() {
    if (!isValidated) {
      alert("Primeiro valide o PIN.");
      return;
    }
    const dateISO = funcDate;
    const rec = getDayRecord(funcEmployeeId, dateISO);
    const slot = nextSlot(rec);
    if (!slot) {
      alert("Dia já completo (Entrada1, Saída1, Entrada2, Saída2).");
      return;
    }
    setDayRecord(funcEmployeeId, dateISO, { [slot]: nowHHMM() });
  }

  // --------- Admin: carregar record para editar ----------
  useEffect(() => {
    const r = getDayRecord(adminEmployeeId, adminDate);
    setAdminIn1(r.in1 || "");
    setAdminOut1(r.out1 || "");
    setAdminIn2(r.in2 || "");
    setAdminOut2(r.out2 || "");
  }, [adminEmployeeId, adminDate]); // eslint-disable-line react-hooks/exhaustive-deps

  function adminSave() {
    const patch = { in1: adminIn1, out1: adminOut1, in2: adminIn2, out2: adminOut2 };
    setDayRecord(adminEmployeeId, adminDate, patch);
    alert("Salvo!");
  }

  // --------- Folgas/Ajustes ----------
  function applyOverride() {
    const hrs = (ovExpectedHours ?? "").trim();
    let expectedMinutes = null;

    if (hrs === "") {
      alert("Informe horas previstas (ex: 0 para folga, 8 para dia normal, 4 para meio período).");
      return;
    }
    if (!/^\d+(\.\d+)?$/.test(hrs)) {
      alert("Use número (ex: 0, 4, 8).");
      return;
    }
    expectedMinutes = Math.round(parseFloat(hrs) * 60);

    setOverride(ovEmployeeId, ovDate, expectedMinutes, ovNote);
    alert("Ajuste aplicado!");
  }

  // --------- Funcionários & escala ----------
  function addEmployee() {
    const name = newName.trim();
    const pin = newPin.trim();
    if (!name) return alert("Informe o nome.");
    if (!pin || pin.length < 4) return alert("Informe um PIN (mínimo 4 dígitos).");

    const id = "emp_" + safeId();
    const schedule = {
      sun: 0,
      mon: 480,
      tue: 480,
      wed: 480,
      thu: 480,
      fri: 480,
      sat: 240,
    };

    setDb((prev) => ({
      ...prev,
      employees: [...prev.employees, { id, name, pin, schedule, active: true }],
    }));
    setNewName("");
    setNewPin("");
  }

  function setScheduleMinute(empId, weekdayKey, minutes) {
    setDb((prev) => {
      const employees = prev.employees.map((e) => {
        if (e.id !== empId) return e;
        return { ...e, schedule: { ...(e.schedule ?? {}), [weekdayKey]: minutes } };
      });
      return { ...prev, employees };
    });
  }

  function toggleEmployeeActive(empId) {
    setDb((prev) => {
      const employees = prev.employees.map((e) => (e.id === empId ? { ...e, active: e.active === false ? true : false } : e));
      return { ...prev, employees };
    });
  }

  function deleteEmployee(empId) {
    if (!confirm("Tem certeza? Isso remove o funcionário (os dados de ponto ficam guardados no histórico local, mas ele some da lista).")) return;
    setDb((prev) => {
      const employees = prev.employees.filter((e) => e.id !== empId);
      return { ...prev, employees };
    });
  }

  // --------- UI helpers ----------
  function BadgeSaldo({ minutes }) {
    if (minutes < 0) return <span style={styles.badge("bad")}>A DEVER {formatMinutes(minutes)}</span>;
    if (minutes > 0) return <span style={styles.badge("good")}>A FAVOR +{formatMinutes(minutes)}</span>;
    return <span style={styles.badge("neutral")}>ZERADO {formatMinutes(minutes)}</span>;
  }

  function DayBox({ employeeId, dateISO, editable }) {
    const rec = getDayRecord(employeeId, dateISO);
    const workedMin = workedMinutesForRecord(rec);
    const expMin = expectedMinutesFor(employeeId, dateISO);
    const saldo = workedMin - expMin;
    const ov = getOverride(employeeId, dateISO);

    const wd = WEEKDAYS.find((w) => w.idx === weekdayIdxFromISO(dateISO));
    const wdLabel = wd?.label ?? "";

    return (
      <div style={{ ...styles.card, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 13 }}>
              {dateISO} • {wdLabel}
            </div>
            <div style={styles.small}>
              Trabalhado: <b>{formatMinutes(workedMin)}</b> • Previsto: <b>{formatMinutes(expMin)}</b>
              {ov?.note ? <span> • Obs: {ov.note}</span> : null}
            </div>
          </div>
          <BadgeSaldo minutes={saldo} />
        </div>

        <div style={styles.hr} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
          {["in1", "out1", "in2", "out2"].map((k, idx) => {
            const label = ["Entrada 1", "Saída 1", "Entrada 2", "Saída 2"][idx];
            const value = rec[k] || "";
            if (!editable) {
              return (
                <div key={k} style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, marginTop: 2 }}>{value || "--:--"}</div>
                </div>
              );
            }
            return (
              <div key={k}>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 800, marginBottom: 6 }}>{label}</div>
                <input
                  style={styles.input}
                  value={value}
                  placeholder="HH:MM"
                  onChange={(e) => setDayRecord(employeeId, dateISO, { [k]: e.target.value })}
                />
              </div>
            );
          })}
        </div>

        {editable ? (
          <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <button style={styles.btn("danger")} onClick={() => deleteDayRecord(employeeId, dateISO)}>
              <Trash2 size={16} /> Apagar dia
            </button>
            <div style={styles.small}>Dica: use HH:MM (ex: 07:30). O cálculo soma os intervalos (Entrada→Saída).</div>
          </div>
        ) : null}
      </div>
    );
  }

  // --------- Render ----------
  const topEmp = getEmp(topEmployeeId);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* HEADER */}
        <div style={styles.headerRow}>
          <div>
            <div style={styles.title}>Ponto Rancho J&L</div>
            <div style={styles.subtitle}>Funcionário bate ponto no celular • Banco de horas automático • Escala por funcionário</div>
          </div>

          <div style={styles.topRight}>
            <div style={{ ...styles.card, padding: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={styles.label}>Período de</div>
                <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <div style={styles.label}>Até</div>
                <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div style={{ minWidth: 260 }}>
                <div style={styles.label}>Funcionário (para ver detalhes)</div>
                <select style={styles.input} value={topEmployeeId} onChange={(e) => setTopEmployeeId(e.target.value)}>
                  {employeesActive.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <BadgeSaldo minutes={summary.saldo} />
                <div style={styles.small}>
                  Previsto: <b>{formatMinutes(summary.expected)}</b> • Trabalhado: <b>{formatMinutes(summary.worked)}</b>
                </div>
              </div>

              <button style={styles.btn("light")} onClick={exportCSV}>
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={styles.tabs}>
          <button style={styles.tab(tab === "func")} onClick={() => setTab("func")}>
            Bater ponto (funcionário)
          </button>
          <button style={styles.tab(tab === "admin")} onClick={() => setTab("admin")}>
            Lançar/editar ponto (admin)
          </button>
          <button style={styles.tab(tab === "folgas")} onClick={() => setTab("folgas")}>
            Folgas/compensação
          </button>
          <button style={styles.tab(tab === "escala")} onClick={() => setTab("escala")}>
            Funcionários & escala
          </button>
        </div>

        <div style={{ height: 12 }} />

        {/* BODY */}
        {tab === "func" ? (
          <div style={styles.row}>
            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Funcionário bate ponto (automático)</div>
                <div style={styles.help}>
                  Se domingo normalmente é folga, deixe a escala de <b>Dom = 0</b>. Quando ela trabalhar no domingo, é só bater o ponto e isso vira
                  <b> hora extra</b> automaticamente.
                </div>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Funcionário</div>
                <select
                  style={styles.input}
                  value={funcEmployeeId}
                  onChange={(e) => {
                    setFuncEmployeeId(e.target.value);
                    setIsValidated(false);
                    setFuncPin("");
                  }}
                >
                  {employeesActive.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Data</div>
                <input style={styles.input} type="date" value={funcDate} onChange={(e) => setFuncDate(e.target.value)} />

                <div style={{ height: 10 }} />

                <div style={styles.row}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={styles.label}>PIN</div>
                    <input
                      style={styles.input}
                      value={funcPin}
                      onChange={(e) => setFuncPin(e.target.value)}
                      placeholder="4 dígitos"
                      inputMode="numeric"
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <button style={styles.btn("light")} onClick={validateFunc}>
                      <ShieldCheck size={16} /> Validar
                    </button>
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <button style={styles.btn(isValidated ? "dark" : "light")} onClick={punchNow}>
                  Bater ponto agora
                </button>

                <div style={{ marginTop: 10 }}>
                  <div style={styles.small}>
                    Sequência automática: <b>Entrada 1 → Saída 1 → Entrada 2 → Saída 2</b>. <br />
                    Se tentar bater mais que 4 vezes no dia, ele avisa.
                  </div>
                </div>
              </div>

              <div style={{ height: 12 }} />

              <DayBox employeeId={funcEmployeeId} dateISO={funcDate} editable={false} />
            </div>

            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Hoje (resumo rápido)</div>
                <div style={styles.help}>Mostra o que já foi batido hoje para o funcionário selecionado.</div>
                <div style={{ height: 10 }} />
                <DayBox employeeId={funcEmployeeId} dateISO={nowISO()} editable={false} />
              </div>

              <div style={{ height: 12 }} />

              <div style={styles.card}>
                <div style={styles.sectionTitle}>Regras (automático)</div>
                <div style={styles.help}>
                  <b>Saldo = Trabalhado - Previsto</b> (da escala do funcionário por dia da semana). <br />
                  Se trabalhar em dia que é folga (previsto = 0), vira hora a haver automaticamente.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "admin" ? (
          <div style={styles.row}>
            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Lançar/editar ponto (admin)</div>
                <div style={styles.help}>
                  Use isso para corrigir um dia, lançar ponto manualmente ou arrumar algo que o funcionário bateu errado.
                </div>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Funcionário</div>
                <select style={styles.input} value={adminEmployeeId} onChange={(e) => setAdminEmployeeId(e.target.value)}>
                  {employeesActive.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Data</div>
                <input style={styles.input} type="date" value={adminDate} onChange={(e) => setAdminDate(e.target.value)} />

                <div style={{ height: 12 }} />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                  <div>
                    <div style={styles.label}>Entrada 1</div>
                    <input style={styles.input} value={adminIn1} onChange={(e) => setAdminIn1(e.target.value)} placeholder="HH:MM" />
                  </div>
                  <div>
                    <div style={styles.label}>Saída 1</div>
                    <input style={styles.input} value={adminOut1} onChange={(e) => setAdminOut1(e.target.value)} placeholder="HH:MM" />
                  </div>
                  <div>
                    <div style={styles.label}>Entrada 2</div>
                    <input style={styles.input} value={adminIn2} onChange={(e) => setAdminIn2(e.target.value)} placeholder="HH:MM" />
                  </div>
                  <div>
                    <div style={styles.label}>Saída 2</div>
                    <input style={styles.input} value={adminOut2} onChange={(e) => setAdminOut2(e.target.value)} placeholder="HH:MM" />
                  </div>
                </div>

                <div style={{ height: 12 }} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={styles.btn("dark")} onClick={adminSave}>
                    Salvar
                  </button>
                  <button style={styles.btn("danger")} onClick={() => deleteDayRecord(adminEmployeeId, adminDate)}>
                    <Trash2 size={16} /> Apagar dia
                  </button>
                </div>

                <div style={{ marginTop: 10, ...styles.small }}>
                  Dica: se quiser só “meio dia”, pode preencher só Entrada1/Saída1. O cálculo soma o que existir.
                </div>
              </div>
            </div>

            <div style={styles.col}>
              <DayBox employeeId={adminEmployeeId} dateISO={adminDate} editable={false} />

              <div style={{ height: 12 }} />

              <div style={styles.card}>
                <div style={styles.sectionTitle}>Ver últimos dias no período</div>
                <div style={styles.help}>Uma listinha rápida para conferir o que foi lançado.</div>

                <div style={{ height: 10 }} />

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Trabalhado</th>
                        <th style={styles.th}>Previsto</th>
                        <th style={styles.th}>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listDays(from, to)
                        .slice(-12)
                        .reverse()
                        .map((d) => {
                          const rec = getDayRecord(adminEmployeeId, d);
                          const w = workedMinutesForRecord(rec);
                          const p = expectedMinutesFor(adminEmployeeId, d);
                          const s = w - p;
                          return (
                            <tr key={d}>
                              <td style={styles.td}>
                                <button
                                  style={{ ...styles.btn("light"), padding: "6px 10px", borderRadius: 12 }}
                                  onClick={() => setAdminDate(d)}
                                >
                                  {d}
                                </button>
                              </td>
                              <td style={styles.td}>{formatMinutes(w)}</td>
                              <td style={styles.td}>{formatMinutes(p)}</td>
                              <td style={styles.td}>
                                <BadgeSaldo minutes={s} />
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "folgas" ? (
          <div style={styles.row}>
            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Folgas / compensação / ajuste de previsto</div>
                <div style={styles.help}>
                  Aqui você define o <b>Previsto</b> de um dia específico (ex: folga = 0h, feriado = 0h, ou ajustar para 6h).
                  Isso sobrescreve a escala daquele dia.
                </div>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Funcionário</div>
                <select style={styles.input} value={ovEmployeeId} onChange={(e) => setOvEmployeeId(e.target.value)}>
                  {employeesActive.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Data</div>
                <input style={styles.input} type="date" value={ovDate} onChange={(e) => setOvDate(e.target.value)} />

                <div style={{ height: 10 }} />

                <div style={styles.label}>Horas previstas nesse dia (0 = folga)</div>
                <input
                  style={styles.input}
                  value={ovExpectedHours}
                  onChange={(e) => setOvExpectedHours(e.target.value)}
                  placeholder="Ex: 0, 4, 6, 8"
                />

                <div style={{ height: 10 }} />

                <div style={styles.label}>Observação (opcional)</div>
                <input style={styles.input} value={ovNote} onChange={(e) => setOvNote(e.target.value)} placeholder="Ex: folga combinada / feriado / compensação" />

                <div style={{ height: 12 }} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button style={styles.btn("dark")} onClick={applyOverride}>
                    Aplicar ajuste
                  </button>
                  <button style={styles.btn("danger")} onClick={() => deleteOverride(ovEmployeeId, ovDate)}>
                    <Trash2 size={16} /> Remover ajuste
                  </button>
                </div>

                <div style={{ marginTop: 10, ...styles.small }}>
                  Caso “domingo geralmente folga”: deixe a escala Dom = 0. Só use ajuste se for um caso especial (tipo “domingo vira previsto 8h”).
                </div>
              </div>
            </div>

            <div style={styles.col}>
              <DayBox employeeId={ovEmployeeId} dateISO={ovDate} editable={false} />

              <div style={{ height: 12 }} />

              <div style={styles.card}>
                <div style={styles.sectionTitle}>Ajustes cadastrados (no período)</div>
                <div style={styles.help}>Lista apenas os dias com ajuste/folga manual.</div>

                <div style={{ height: 10 }} />

                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Data</th>
                        <th style={styles.th}>Previsto (ajuste)</th>
                        <th style={styles.th}>Obs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listDays(from, to)
                        .filter((d) => !!getOverride(ovEmployeeId, d))
                        .map((d) => {
                          const ov = getOverride(ovEmployeeId, d);
                          return (
                            <tr key={d}>
                              <td style={styles.td}>
                                <button style={{ ...styles.btn("light"), padding: "6px 10px", borderRadius: 12 }} onClick={() => setOvDate(d)}>
                                  {d}
                                </button>
                              </td>
                              <td style={styles.td}>{formatMinutes(ov.expectedMinutes ?? 0)}</td>
                              <td style={styles.td}>{ov.note ?? ""}</td>
                            </tr>
                          );
                        })}
                      {listDays(from, to).filter((d) => !!getOverride(ovEmployeeId, d)).length === 0 ? (
                        <tr>
                          <td style={styles.td} colSpan={3}>
                            <span style={styles.small}>Nenhum ajuste no período.</span>
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "escala" ? (
          <div style={styles.row}>
            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Adicionar funcionário</div>
                <div style={styles.help}>Crie funcionários com PIN para bater ponto. Depois ajuste a escala por dia da semana.</div>

                <div style={{ height: 10 }} />

                <div style={styles.label}>Nome</div>
                <input style={styles.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Maria" />

                <div style={{ height: 10 }} />

                <div style={styles.label}>PIN (4 dígitos ou mais)</div>
                <input style={styles.input} value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Ex: 4321" inputMode="numeric" />

                <div style={{ height: 12 }} />

                <button style={styles.btn("dark")} onClick={addEmployee}>
                  <Plus size={16} /> Adicionar
                </button>
              </div>

              <div style={{ height: 12 }} />

              <div style={styles.card}>
                <div style={styles.sectionTitle}>Dica de domingo</div>
                <div style={styles.help}>
                  Para “domingo geralmente não trabalha, mas às vezes trabalha”: deixe <b>Dom = 0</b> na escala.
                  Quando ela trabalhar no domingo, ela bate ponto normal e o saldo fica <b>A FAVOR</b>.
                </div>
              </div>
            </div>

            <div style={styles.col}>
              <div style={styles.card}>
                <div style={styles.sectionTitle}>Funcionários</div>
                <div style={styles.help}>Clique em um funcionário para editar a escala.</div>

                <div style={{ height: 10 }} />

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {db.employees.map((emp) => {
                    const active = emp.active !== false;
                    return (
                      <div key={emp.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 12, background: active ? "white" : "#fafafa" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                          <div>
                            <div style={{ fontWeight: 900 }}>{emp.name}</div>
                            <div style={styles.small}>PIN: {emp.pin ? "••••" : "(sem PIN)"} • Status: {active ? "Ativo" : "Inativo"}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button style={styles.btn("light")} onClick={() => setEditEmpId(emp.id)}>
                              Editar escala
                            </button>
                            <button style={styles.btn("light")} onClick={() => toggleEmployeeActive(emp.id)}>
                              {active ? "Desativar" : "Ativar"}
                            </button>
                            <button style={styles.btn("danger")} onClick={() => deleteEmployee(emp.id)}>
                              <Trash2 size={16} /> Remover
                            </button>
                          </div>
                        </div>

                        {editEmpId === emp.id ? (
                          <div style={{ marginTop: 12 }}>
                            <div style={styles.hr} />
                            <div style={{ fontWeight: 900, fontSize: 13 }}>Escala (horas por dia)</div>
                            <div style={styles.small}>Altere horas por dia. Ex: Dom = 0 (folga), Seg = 8, Sáb = 4.</div>

                            <div style={{ height: 10 }} />

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
                              {WEEKDAYS.map((w) => {
                                const minutes = emp.schedule?.[w.key] ?? 0;
                                const hours = (minutes / 60).toString();
                                return (
                                  <div key={w.key}>
                                    <div style={{ ...styles.label, textAlign: "center" }}>{w.label}</div>
                                    <input
                                      style={{ ...styles.input, textAlign: "center", padding: "10px 8px" }}
                                      value={hours}
                                      onChange={(e) => {
                                        const v = e.target.value.trim();
                                        if (v === "") return setScheduleMinute(emp.id, w.key, 0);
                                        if (!/^\d+(\.\d+)?$/.test(v)) return;
                                        setScheduleMinute(emp.id, w.key, Math.round(parseFloat(v) * 60));
                                      }}
                                      placeholder="0"
                                    />
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ height: 10 }} />

                            <button style={styles.btn("light")} onClick={() => setEditEmpId(null)}>
                              Fechar
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ height: 16 }} />
        <div style={{ ...styles.card, padding: 12 }}>
          <div style={styles.small}>
            Dados ficam salvos no <b>navegador (localStorage)</b>. Para usar em outro computador, recomendo depois migrar para um backend (Firebase/Supabase).
            Por enquanto é perfeito para rodar rápido no rancho.
          </div>
        </div>
      </div>
    </div>
  );
}
