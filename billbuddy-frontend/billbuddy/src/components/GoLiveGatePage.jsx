import { useEffect, useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "pass", label: "Pass" },
  { value: "partial", label: "Partial" },
  { value: "fail", label: "Fail" },
  { value: "unknown", label: "Unknown" }
];

const PRIORITY_OPTIONS = [
  { value: "blocker", label: "Blocker" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" }
];

function toDraft(gate) {
  return {
    status: gate.status || "unknown",
    priority: gate.priority || "high",
    ownerName: gate.owner_name || "",
    targetDate: gate.target_date ? String(gate.target_date).slice(0, 10) : "",
    notes: gate.notes || "",
    evidenceLink: gate.evidence_link || ""
  };
}

function badgeClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pass") return "success";
  if (normalized === "partial") return "pending";
  if (normalized === "fail") return "error";
  return "neutral";
}

export default function GoLiveGatePage(props) {
  const {
    activeModule,
    currentModuleMeta,
    gates,
    loading,
    savingGateId,
    onRefresh,
    onUpdateGate
  } = props;

  const [draftById, setDraftById] = useState({});

  useEffect(() => {
    const next = {};
    (gates || []).forEach((gate) => {
      next[gate.id] = toDraft(gate);
    });
    setDraftById(next);
  }, [gates]);

  const counts = useMemo(() => {
    const rows = Array.isArray(gates) ? gates : [];
    return {
      total: rows.length,
      pass: rows.filter((row) => String(row.status || "").toLowerCase() === "pass").length,
      partial: rows.filter((row) => String(row.status || "").toLowerCase() === "partial").length,
      fail: rows.filter((row) => String(row.status || "").toLowerCase() === "fail").length,
      unknown: rows.filter((row) => String(row.status || "").toLowerCase() === "unknown").length
    };
  }, [gates]);

  if (activeModule !== "Go-Live Gate") return null;

  return (
    <section className="module-placeholder glass-panel">
      <div className="page-banner">
        <div>
          <p className="eyebrow">{currentModuleMeta["Go-Live Gate"]?.eyebrow || "Readiness"}</p>
          <h2>{currentModuleMeta["Go-Live Gate"]?.title || "Go-Live Gate Tracker"}</h2>
          <p>{currentModuleMeta["Go-Live Gate"]?.subtitle || "Track security and reliability controls before production launch."}</p>
        </div>
        <div className="banner-stat">
          <span>Open Risks</span>
          <strong>{counts.fail + counts.partial + counts.unknown}</strong>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: "14px" }}>
        <article className="kpi-card glass-panel"><p>Total</p><h3>{counts.total}</h3></article>
        <article className="kpi-card glass-panel"><p>Pass</p><h3>{counts.pass}</h3></article>
        <article className="kpi-card glass-panel"><p>Partial</p><h3>{counts.partial}</h3></article>
        <article className="kpi-card glass-panel"><p>Fail</p><h3>{counts.fail}</h3></article>
        <article className="kpi-card glass-panel"><p>Unknown</p><h3>{counts.unknown}</h3></article>
      </div>

      <div className="section-head">
        <h3>Security Go-Live Gate Sheet</h3>
        <button type="button" className="ghost-btn" onClick={onRefresh} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>Control</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Target Date</th>
            <th>Notes</th>
            <th>Evidence</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {(gates || []).map((gate) => {
            const draft = draftById[gate.id] || toDraft(gate);
            const isSaving = Number(savingGateId || 0) === Number(gate.id);
            return (
              <tr key={gate.id}>
                <td>{gate.category}</td>
                <td style={{ minWidth: "260px" }}>{gate.control_name}</td>
                <td>
                  <select
                    value={draft.priority}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, priority: event.target.value } }))}
                  >
                    {PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <span className={`badge ${badgeClass(draft.status)}`}>{String(draft.status || "").toUpperCase()}</span>
                  <select
                    value={draft.status}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, status: event.target.value } }))}
                  >
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </td>
                <td>
                  <input
                    placeholder="Owner"
                    value={draft.ownerName}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, ownerName: event.target.value } }))}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={draft.targetDate}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, targetDate: event.target.value } }))}
                  />
                </td>
                <td>
                  <input
                    placeholder="Notes"
                    value={draft.notes}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, notes: event.target.value } }))}
                  />
                </td>
                <td>
                  <input
                    placeholder="Evidence link"
                    value={draft.evidenceLink}
                    onChange={(event) => setDraftById((prev) => ({ ...prev, [gate.id]: { ...draft, evidenceLink: event.target.value } }))}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="ghost-btn compact-btn"
                    onClick={() => onUpdateGate(gate.id, draft)}
                    disabled={isSaving}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                </td>
              </tr>
            );
          })}
          {!loading && (!gates || gates.length === 0) ? (
            <tr>
              <td colSpan="9">No go-live gates found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
