import React, { useEffect, useMemo, useState } from "react";
import { Download, Plus, Trash2, ShieldCheck } from "lucide-react";

const LS_KEY = "ponto_rancho_jl_v1";

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

function addDaysISO(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekdayIndexFromISO(iso) {
  return new Date(iso + "T00:00:00").getDay(); // 0..6
}

function minutesFromHHMM(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function hhmmFromMinutes(mins) {
  const sign = mins < 0 ? "-" : "";
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h}:${pad2(m)}`;
}

function sumWorkedMinutes(entry) {
  const in1 = minutesFromHHMM(entry.in1);
  const out1 = minutesFromHHMM(entry.out1);
  const in2 = minutesFromHHMM(entry.in2);
  const out2 = minutesFromHHMM(entry.out2);

  let total = 0;
  if (in1 != null && out1 != null && out1 >= in1) total += out1 - in1;
  if (in2 != null && out2 != null && out2 >= in2) total += out2 - in2;
  return total;
}

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function defaultSchedule() {
  // Padrão sugerido do rancho (você configura por funcionário):
  // Seg–Sex 8h (almoço não conta); Sáb 4h; Dom folga
  return {
    sun: { active: false, minutes: 0 },
    mon: { active: true, minutes: 8 * 60 },
    tue: { active: true, minutes: 8 * 60 },
    wed: { active: true, minutes: 8 * 60 },
    thu: { active: true, minutes: 8 * 60 },
    fri: { active: true, minutes: 8 * 60 },
    sat: { active: true, minutes: 4 * 60 },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(state) {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function toCSV(rows) {
  const esc = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return '"' + s.replaceAll('"', '""') + '"';
    }
    return s;
  };
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(esc).join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function styles() {
  return {
    page: { fontFamily: "system-ui, Arial", background: "#f6f7fb", minHeight: "100vh", padding: 16 },
    container: { maxWidth: 1100, margin: "0 auto", display: "grid", gap: 12 },
    card: { background: "white", borderRadius: 16, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", border: "1px solid #eef0f6" },
    row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" },
    title: { fontSize: 22, fontWeight: 700, margin: 0 },
    subtitle: { fontSize: 13, color: "#667085", marginTop: 6 },
    tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
    tabBtn: (active) => ({
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid " + (active ? "#111827" : "#e5e7eb"),
      background: active ? "#111827" : "white",
      color: active ? "white" : "#111827",
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 13,
    }),
    input: { padding: 10, borderRadius: 12, border: "1px solid #e5e7eb", width: "100%" },
    label: { fontSize: 12, color: "#667085", fontWeight: 600 },
    btn: (kind = "primary") => ({
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid " + (kind === "primary" ? "#111827" : "#e5e7eb"),
      background: kind === "primary" ? "#111827" : "white",
      color: kind === "primary" ? "white" : "#111827",
      cursor: "pointer",
      fontWeight: 700,
      fontSize: 13,
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
      justifyContent: "center",
    }),
    pill: (kind) => ({
      display: "inline-flex",
      padding: "6px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      color: "white",
      background: kind === "pos" ? "#16a34a" : kind === "neg" ? "#e11d48" : "#334155",
    }),
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0, overflow: "hidden", borderRadius: 12, border: "1px solid #eef0f6" },
    th: { textAlign: "left", fontSize: 12, color: "#667085", padding: 10, background: "#f8fafc", borderBottom: "1px solid #eef0f6" },
    td: { padding: 10, borderBottom: "1px solid #f0f2f7", fontSize: 13 },
    tdRight: { padding: 10, borderBottom: "1px solid #f0f2f7", fontSize: 13, textAlign: "right" },
    muted: { color: "#667085", fontSize: 12 },
    hr: { border: 0, borderTop: "1px solid #eef0f6", margin: "12px 0" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  };
}

export default function App() {
  const S = styles();

  const [state, setState] = useState(() => {
    const loaded = loadState();
    if (loaded) return loaded;
    const today = nowISO();
    return {
      meta: { createdAt: new Date().toISOString(), appName: "Ponto Rancho J&L" },
      ui: { periodFrom: addDaysISO(today, -30), periodTo: today, tab: "bater" },
      employees: [
        {
          id: makeId("emp"),
          name: "Caseiro João (exemplo)",
          role: "Caseiro",
          pin: "1234",
          schedule: defaultSchedule(),
        },
      ],
      // entries[empId][dateISO] = {in1,out1,in2,out2,note}
      entries: {},
      // dayOffs[empId][dateISO] = {type,note}
      dayOffs: {},
      // admin pin simples (uso interno)
      adminPin: "9999",
    };
  });

  useEffect(() => saveState(state), [state]);

  const [activeEmpId, setActiveEmpId] = useState(state.employees[0]?.id ?? "");

  useEffect(() => {
    if (!state.employees.some((e) => e.id === activeEmpId)) {
      setActiveEmpId(state.employees[0]?.id ?? "");
    }
  }, [state.employees, activeEmpId]);

  const activeEmp = useMemo(
    () => state.employees.find((e) => e.id === activeEmpId) ?? null,
    [state.employees, activeEmpId]
  );

  const periodFrom = state.ui.periodFrom;
  const periodTo = state.ui.periodTo;

  const periodDays = useMemo(() => {
    if (!periodFrom || !periodTo) return [];
    if (periodTo < periodFrom) return [];
    const days = [];
    let cur = periodFrom;
    while (cur <= periodTo) {
      days.push(cur);
      cur = addDaysISO(cur, 1);
    }
    return days;
  }, [periodFrom, periodTo]);

  function upsertEntry(empId, dateISO, patch) {
    setState((s) => {
      const empEntries = s.entries[empId] ?? {};
      const prev = empEntries[dateISO] ?? { in1: "", out1: "", in2: "", out2: "", note: "" };
      return {
        ...s,
        entries: {
          ...s.entries,
          [empId]: {
            ...empEntries,
            [dateISO]: { ...prev, ...patch },
          },
        },
      };
    });
  }

  function deleteEntry(empId, dateISO) {
    setState((s) => {
      const empEntries = { ...(s.entries[empId] ?? {}) };
      delete empEntries[dateISO];
      return { ...s, entries: { ...s.entries, [empId]: empEntries } };
    });
  }

  function upsertDayOff(empId, dateISO, value) {
    setState((s) => {
      const empDayOffs = s.dayOffs[empId] ?? {};
      return { ...s, dayOffs: { ...s.dayOffs, [empId]: { ...empDayOffs, [dateISO]: value } } };
    });
  }

  function deleteDayOff(empId, dateISO) {
    setState((s) => {
      const empDayOffs = { ...(s.dayOffs[empId] ?? {}) };
      delete empDayOffs[dateISO];
      return { ...s, dayOffs: { ...s.dayOffs, [empId]: empDayOffs } };
    });
  }

  function updateEmployee(empId, patch) {
    setState((s) => ({
      ...s,
      employees: s.employees.map((e) => (e.id === empId ? { ...e, ...patch } : e)),
    }));
  }

  function addEmployee(name, role) {
    const emp = {
      id: makeId("emp"),
      name: (name || "").trim() || "Novo funcionário",
      role: (role || "").trim() || "",
      pin: "1234",
      schedule: defaultSchedule(),
    };
    setState((s) => ({ ...s, employees: [emp, ...s.employees] }));
    setActiveEmpId(emp.id);
  }

  function removeEmployee(empId) {
    setState((s) => {
      const employees = s.employees.filter((e) => e.id !== empId);
      const entries = { ...s.entries };
      const dayOffs = { ...s.dayOffs };
      delete entries[empId];
      delete dayOffs[empId];
      return { ...s, employees, entries, dayOffs };
    });
  }

  const balances = useMemo(() => {
    const out = {};
    for (const emp of state.employees) {
      const empEntries = state.entries[emp.id] ?? {};
      const empDayOffs = state.dayOffs[emp.id] ?? {};

      let expected = 0;
      let worked = 0;
      let dayOffCount = 0;

      for (const day of periodDays) {
        const widx = weekdayIndexFromISO(day);
        const wkey = WEEKDAYS[widx].key;
        const sch = emp.schedule?.[wkey] ?? { active: false, minutes: 0 };

        const off = empDayOffs[day]; // qualquer tipo zera previsto
        if (off) dayOffCount += 1;

        const expectedDay = off ? 0 : sch.active ? sch.minutes : 0;
        expected += expectedDay;

        const entry = empEntries[day];
        if (entry) worked += sumWorkedMinutes(entry);
      }

      out[emp.id] = { expected, worked, saldo: worked - expected, dayOffCount };
    }
    return out;
  }, [state.employees, state.entries, state.dayOffs, periodDays]);

  function exportCSV() {
    const rows = [];
    for (const emp of state.employees) {
      const empEntries = state.entries[emp.id] ?? {};
      const empDayOffs = state.dayOffs[emp.id] ?? {};
      for (const day of periodDays) {
        const entry = empEntries[day];
        const off = empDayOffs[day];

        const worked = entry ? sumWorkedMinutes(entry) : 0;

        const widx = weekdayIndexFromISO(day);
        const wkey = WEEKDAYS[widx].key;
        const sch = emp.schedule?.[wkey] ?? { active: false, minutes: 0 };
        const expected = off ? 0 : sch.active ? sch.minutes : 0;

        rows.push({
          funcionario: emp.name,
          cargo: emp.role,
          data: day,
          dia_semana: WEEKDAYS[widx].label,
          tipo_folga: off?.type ?? "",
          folga_obs: off?.note ?? "",
          entrada1: entry?.in1 ?? "",
          saida1: entry?.out1 ?? "",
          entrada2: entry?.in2 ?? "",
          saida2: entry?.out2 ?? "",
          ponto_obs: entry?.note ?? "",
          previsto_min: expected,
          trabalhado_min: worked,
          saldo_min: worked - expected,
          saldo_hhmm: hhmmFromMinutes(worked - expected),
        });
      }
    }
    downloadText(`ponto_rancho_jl_${periodFrom}_a_${periodTo}.csv`, toCSV(rows));
  }

  const activeBalance = balances[activeEmpId] ?? { expected: 0, worked: 0, saldo: 0, dayOffCount: 0 };

  function saldoPill(mins) {
    if (mins > 0) return <span style={S.pill("pos")}>A HAVER {hhmmFromMinutes(mins)}</span>;
    if (mins < 0) return <span style={S.pill("neg")}>A DEVER {hhmmFromMinutes(mins)}</span>;
    return <span style={S.pill("zero")}>ZERADO 0:00</span>;
  }

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: "space-between" }}>
            <div>
              <h1 style={S.title}>{state.meta.appName}</h1>
              <div style={S.subtitle}>
                Funcionário bate ponto no celular • Banco de horas automático • Escala por funcionário
              </div>
            </div>
            <button style={S.btn("outline")} onClick={exportCSV} title="Exportar">
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.row}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={S.label}>Período de</div>
              <input
                style={S.input}
                type="date"
                value={state.ui.periodFrom}
                onChange={(e) => setState((s) => ({ ...s, ui: { ...s.ui, periodFrom: e.target.value } }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={S.label}>Até</div>
              <input
                style={S.input}
                type="date"
                value={state.ui.periodTo}
                onChange={(e) => setState((s) => ({ ...s, ui: { ...s.ui, periodTo: e.target.value } }))}
              />
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={S.label}>Funcionário (para ver detalhes)</div>
              <select style={S.input} value={activeEmpId} onChange={(e) => setActiveEmpId(e.target.value)}>
                {state.employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {saldoPill(activeBalance.saldo)}
              <span style={{ ...S.muted, fontWeight: 700 }}>Previsto:</span> {hhmmFromMinutes(activeBalance.expected)}
              <span style={{ ...S.muted, fontWeight: 700, marginLeft: 8 }}>Trabalhado:</span>{" "}
              {hhmmFromMinutes(activeBalance.worked)}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.tabs}>
            <button
              style={S.tabBtn(state.ui.tab === "bater")}
              onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, tab: "bater" } }))}
            >
              Bater ponto (funcionário)
            </button>
            <button
              style={S.tabBtn(state.ui.tab === "lancar")}
              onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, tab: "lancar" } }))}
            >
              Lançar/editar ponto (admin)
            </button>
            <button
              style={S.tabBtn(state.ui.tab === "folgas")}
              onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, tab: "folgas" } }))}
            >
              Folgas/compensação
            </button>
            <button
              style={S.tabBtn(state.ui.tab === "cadastro")}
              onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, tab: "cadastro" } }))}
            >
              Funcionários & escala
            </button>
          </div>

          <div style={S.hr} />

          {state.ui.tab === "bater" && (
            <PunchTab
              employees={state.employees}
              entries={state.entries}
              onUpsertEntry={upsertEntry}
            />
          )}

          {state.ui.tab === "lancar" && (
            <AdminEntriesTab
              employee={activeEmp}
              empId={activeEmpId}
              entries={state.entries}
              dayOffs={state.dayOffs}
              periodDays={periodDays}
              onUpsertEntry={upsertEntry}
              onDeleteEntry={deleteEntry}
              schedule={activeEmp?.schedule}
            />
          )}

          {state.ui.tab === "folgas" && (
            <DayOffTab
              employee={activeEmp}
              empId={activeEmpId}
              dayOffs={state.dayOffs}
              periodFrom={periodFrom}
              periodTo={periodTo}
              onUpsertDayOff={upsertDayOff}
              onDeleteDayOff={deleteDayOff}
            />
          )}

          {state.ui.tab === "cadastro" && (
            <EmployeesTab
              employees={state.employees}
              balances={balances}
              activeEmpId={activeEmpId}
              setActiveEmpId={setActiveEmpId}
              onAdd={addEmployee}
              onRemove={removeEmployee}
              onUpdate={updateEmployee}
            />
          )}
        </div>

        <div style={S.card}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Regras (automático)</div>
          <div style={S.muted}>
            Saldo = Trabalhado − Previsto (da escala do funcionário por dia da semana). Se trabalhar em dia que é folga
            (previsto = 0), vira <b>hora a haver automaticamente</b>.
          </div>
        </div>
      </div>
    </div>
  );
}

function PunchTab({ employees, entries, onUpsertEntry }) {
  const S = styles();
  const today = nowISO();

  const [empId, setEmpId] = useState(employees[0]?.id ?? "");
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);
  const [dateISO, setDateISO] = useState(today);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!employees.some((e) => e.id === empId)) setEmpId(employees[0]?.id ?? "");
  }, [employees, empId]);

  const emp = useMemo(() => employees.find((e) => e.id === empId) ?? null, [employees, empId]);

  const currentEntry = useMemo(() => {
    const empEntries = entries?.[empId] ?? {};
    return empEntries[dateISO] ?? { in1: "", out1: "", in2: "", out2: "", note: "" };
  }, [entries, empId, dateISO]);

  function nowHHMM() {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }

  function validate() {
    const pass = (pin || "").trim() === (emp?.pin || "");
    setOk(pass);
    setMsg(pass ? "PIN OK ✅" : "PIN incorreto ❌");
    setTimeout(() => setMsg(""), 2000);
  }

  function punch() {
    if (!empId || !ok) return;
    const t = nowHHMM();
    const e = { ...currentEntry };

    // Sequência automática: in1 -> out1 -> in2 -> out2
    if (!e.in1) e.in1 = t;
    else if (!e.out1) e.out1 = t;
    else if (!e.in2) e.in2 = t;
    else if (!e.out2) e.out2 = t;
    else e.out2 = t;

    if (!e.note) e.note = "Batida via celular";
    onUpsertEntry(empId, dateISO, e);
    setMsg(`Registrado: ${t}`);
    setTimeout(() => setMsg(""), 2500);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.muted}>
        Funcionário: selecione seu nome, digite seu PIN e clique em <b>Bater ponto</b>. A sequência é automática.
      </div>

      <div style={S.row}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={S.label}>Funcionário</div>
          <select style={S.input} value={empId} onChange={(e) => { setEmpId(e.target.value); setOk(false); setPin(""); }}>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        <div style={{ width: 180, minWidth: 180 }}>
          <div style={S.label}>Data</div>
          <input style={S.input} type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
        </div>

        <div style={{ width: 220, minWidth: 220 }}>
          <div style={S.label}>PIN</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input style={S.input} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4 dígitos" />
            <button style={S.btn(ok ? "outline" : "primary")} onClick={validate}>
              <ShieldCheck size={16} /> {ok ? "OK" : "Validar"}
            </button>
          </div>
        </div>
      </div>

      <button style={{ ...S.btn("primary"), height: 48, fontSize: 14 }} disabled={!ok} onClick={punch}>
        Bater ponto agora
      </button>

      {msg ? <div style={{ fontWeight: 800 }}>{msg}</div> : null}

      <div style={{ border: "1px solid #eef0f6", borderRadius: 12, padding: 12, background: "#fafbff" }}>
        <div style={{ fontWeight: 800 }}>Hoje ({dateISO}) • {emp?.name}</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <Box label="Entrada 1" value={currentEntry.in1} />
          <Box label="Saída 1" value={currentEntry.out1} />
          <Box label="Entrada 2" value={currentEntry.in2} />
          <Box label="Saída 2" value={currentEntry.out2} />
        </div>
      </div>
    </div>
  );
}

function Box({ label, value }) {
  const S = styles();
  return (
    <div style={{ border: "1px solid #eef0f6", borderRadius: 12, padding: 10, background: "white" }}>
      <div style={S.label}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 14 }}>{value || "--:--"}</div>
    </div>
  );
}

function AdminEntriesTab({ employee, empId, entries, dayOffs, periodDays, onUpsertEntry, onDeleteEntry, schedule }) {
  const S = styles();
  const empEntries = entries[empId] ?? {};
  const empDayOffs = dayOffs[empId] ?? {};

  if (!employee) return <div style={S.muted}>Selecione um funcionário.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.muted}>Clique nos campos para editar. (Admin)</div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Data</th>
            <th style={S.th}>Dia</th>
            <th style={S.th}>Entrada 1</th>
            <th style={S.th}>Saída 1</th>
            <th style={S.th}>Entrada 2</th>
            <th style={S.th}>Saída 2</th>
            <th style={{ ...S.th, textAlign: "right" }}>Saldo do dia</th>
            <th style={{ ...S.th, textAlign: "right" }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {periodDays.map((day) => {
            const e = empEntries[day] ?? { in1: "", out1: "", in2: "", out2: "", note: "" };
            const off = empDayOffs[day];

            const worked = sumWorkedMinutes(e);
            const widx = weekdayIndexFromISO(day);
            const wkey = WEEKDAYS[widx].key;
            const sch = schedule?.[wkey] ?? { active: false, minutes: 0 };
            const expected = off ? 0 : sch.active ? sch.minutes : 0;

            const saldo = worked - expected;

            return (
              <tr key={day}>
                <td style={S.td}><b>{day}</b></td>
                <td style={S.td}>
                  {WEEKDAYS[widx].label}{" "}
                  {off ? <span style={{ marginLeft: 8, ...S.pill("zero") }}>{off.type.toUpperCase()}</span> : null}
                </td>
                {["in1", "out1", "in2", "out2"].map((k) => (
                  <td key={k} style={S.td}>
                    <input
                      style={S.input}
                      value={e[k] || ""}
                      placeholder="--:--"
                      onChange={(ev) => onUpsertEntry(empId, day, { [k]: ev.target.value })}
                    />
                  </td>
                ))}
                <td style={S.tdRight}>{hhmmFromMinutes(saldo)}</td>
                <td style={S.tdRight}>
                  <button style={S.btn("outline")} onClick={() => onDeleteEntry(empId, day)} title="Apagar">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DayOffTab({ employee, empId, dayOffs, periodFrom, periodTo, onUpsertDayOff, onDeleteDayOff }) {
  const S = styles();
  const empDayOffs = dayOffs[empId] ?? {};
  const [dateISO, setDateISO] = useState(periodFrom);
  const [type, setType] = useState("compensacao");
  const [note, setNote] = useState("");

  useEffect(() => {
    const v = empDayOffs[dateISO];
    if (v) {
      setType(v.type || "compensacao");
      setNote(v.note || "");
    } else {
      setType("compensacao");
      setNote("");
    }
  }, [dateISO]); // eslint-disable-line

  if (!employee) return <div style={S.muted}>Selecione um funcionário.</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.muted}>
        Use <b>Compensação</b> quando ele folgar em outro dia para compensar banco de horas. Qualquer tipo aqui zera o previsto do dia.
      </div>

      <div style={S.row}>
        <div style={{ width: 200 }}>
          <div style={S.label}>Data</div>
          <input style={S.input} type="date" value={dateISO} onChange={(e) => setDateISO(e.target.value)} />
        </div>
        <div style={{ width: 220 }}>
          <div style={S.label}>Tipo</div>
          <select style={S.input} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="folga">Folga</option>
            <option value="ferias">Férias</option>
            <option value="atestado">Atestado</option>
            <option value="falta">Falta</option>
            <option value="compensacao">Compensação</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={S.label}>Observação</div>
          <input style={S.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: folga de compensação" />
        </div>
      </div>

      <div style={S.row}>
        <button
          style={S.btn("primary")}
          onClick={() => onUpsertDayOff(empId, dateISO, { type, note })}
        >
          Salvar
        </button>
        <button style={S.btn("outline")} onClick={() => onDeleteDayOff(empId, dateISO)}>
          Remover
        </button>
      </div>

      <div style={S.hr} />

      <div style={{ fontWeight: 900 }}>Lançamentos no período</div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Data</th>
            <th style={S.th}>Tipo</th>
            <th style={S.th}>Obs.</th>
            <th style={{ ...S.th, textAlign: "right" }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(empDayOffs)
            .filter(([d]) => (!periodFrom || !periodTo) ? true : (d >= periodFrom && d <= periodTo))
            .sort(([a], [b]) => (a < b ? 1 : -1))
            .map(([d, v]) => (
              <tr key={d}>
                <td style={S.td}><b>{d}</b></td>
                <td style={S.td}>{v.type}</td>
                <td style={S.td}>{v.note}</td>
                <td style={S.tdRight}>
                  <button style={S.btn("outline")} onClick={() => onDeleteDayOff(empId, d)} title="Apagar">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function EmployeesTab({ employees, balances, activeEmpId, setActiveEmpId, onAdd, onRemove, onUpdate }) {
  const S = styles();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const active = useMemo(() => employees.find((e) => e.id === activeEmpId) ?? null, [employees, activeEmpId]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={S.row}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={S.label}>Nome</div>
          <input style={S.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: José da Silva" />
        </div>
        <div style={{ width: 220, minWidth: 220 }}>
          <div style={S.label}>Função</div>
          <input style={S.input} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex.: Jardineiro" />
        </div>
        <button
          style={S.btn("primary")}
          onClick={() => {
            onAdd(name, role);
            setName("");
            setRole("");
          }}
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Nome</th>
            <th style={S.th}>Função</th>
            <th style={{ ...S.th, textAlign: "right" }}>Saldo (período)</th>
            <th style={{ ...S.th, textAlign: "right" }}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => {
            const b = balances[e.id] ?? { saldo: 0 };
            return (
              <tr key={e.id} style={e.id === activeEmpId ? { background: "#f8fafc" } : undefined}>
                <td style={S.td}><b>{e.name}</b></td>
                <td style={S.td}>{e.role}</td>
                <td style={S.tdRight}>{hhmmFromMinutes(b.saldo)}</td>
                <td style={S.tdRight}>
                  <div style={{ display: "inline-flex", gap: 8 }}>
                    <button style={S.btn("outline")} onClick={() => setActiveEmpId(e.id)}>Abrir</button>
                    <button
                      style={S.btn("outline")}
                      onClick={() => {
                        if (confirm(`Remover ${e.name}? Isso apaga lançamentos e folgas.`)) onRemove(e.id);
                      }}
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={S.hr} />

      {!active ? (
        <div style={S.muted}>Selecione um funcionário para editar PIN e escala.</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontWeight: 900 }}>Editar funcionário</div>

          <div style={S.row}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={S.label}>Nome</div>
              <input style={S.input} value={active.name} onChange={(e) => onUpdate(active.id, { name: e.target.value })} />
            </div>
            <div style={{ width: 220, minWidth: 220 }}>
              <div style={S.label}>Função</div>
              <input style={S.input} value={active.role} onChange={(e) => onUpdate(active.id, { role: e.target.value })} />
            </div>
            <div style={{ width: 220, minWidth: 220 }}>
              <div style={S.label}>PIN (4 dígitos)</div>
              <input
                style={S.input}
                value={active.pin}
                onChange={(e) => onUpdate(active.id, { pin: e.target.value })}
                placeholder="1234"
              />
            </div>
          </div>

          <div style={{ fontWeight: 900 }}>Escala semanal (por funcionário)</div>
          <div style={S.muted}>
            Marque os dias trabalhados e informe as <b>horas previstas</b> por dia. Se trabalhar em dia de folga, vira crédito automático.
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {WEEKDAYS.map((wd) => {
              const sch = active.schedule?.[wd.key] ?? { active: false, minutes: 0 };
              return (
                <div key={wd.key} style={{ display: "flex", alignItems: "center", gap: 10, border: "1px solid #eef0f6", borderRadius: 12, padding: 10 }}>
                  <input
                    type="checkbox"
                    checked={!!sch.active}
                    onChange={(e) => {
                      const v = e.target.checked;
                      const next = {
                        ...active.schedule,
                        [wd.key]: { active: v, minutes: v ? (sch.minutes || 8 * 60) : 0 },
                      };
                      onUpdate(active.id, { schedule: next });
                    }}
                  />
                  <div style={{ width: 60, fontWeight: 900 }}>{wd.label}</div>

                  <div style={{ width: 120 }}>
                    <div style={S.label}>Horas</div>
                    <input
                      style={S.input}
                      type="number"
                      min={0}
                      step={0.5}
                      disabled={!sch.active}
                      value={sch.minutes / 60}
                      onChange={(e) => {
                        const hours = parseFloat(e.target.value || "0");
                        const next = { ...active.schedule, [wd.key]: { ...sch, minutes: Math.round(hours * 60) } };
                        onUpdate(active.id, { schedule: next });
                      }}
                    />
                  </div>

                  <div style={{ marginLeft: "auto", ...S.muted }}>
                    Previsto: <b>{hhmmFromMinutes(sch.active ? sch.minutes : 0)}</b>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
