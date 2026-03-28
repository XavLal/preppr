import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  aisleForSelect,
  compareAisles,
  SHOP_AISLES,
} from "@/lib/shopAisles";
import { SHOP_UNITS, unitForSelect } from "@/lib/shopUnits";
import type { ShoppingLine } from "@/types";

export default function ShoppingPage() {
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const commit = useAppStore((s) => s.commit);

  useEffect(() => {
    if (!state) void hydrate();
  }, [hydrate, state]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [aisle, setAisle] = useState<string>(SHOP_AISLES[3]);
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("pièce");
  const [formBusy, setFormBusy] = useState(false);

  const grouped = useMemo(() => {
    const lines = state?.shoppingLines ?? [];
    const m = new Map<string, typeof lines>();
    for (const l of lines) {
      const arr = m.get(l.aisle) ?? [];
      arr.push(l);
      m.set(l.aisle, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => compareAisles(a, b));
  }, [state?.shoppingLines]);

  function resetForm() {
    setName("");
    setAisle(SHOP_AISLES[3]);
    setQty("1");
    setUnit("pièce");
    setEditingLineId(null);
  }

  function openAddModal() {
    resetForm();
    setModalOpen(true);
  }

  function openEditModal(line: ShoppingLine) {
    setEditingLineId(line.id);
    setName(line.name);
    setAisle(aisleForSelect(line.aisle));
    setQty(String(line.quantity));
    setUnit(unitForSelect(line.unit));
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    resetForm();
  }

  async function toggleLine(id: string, checked: boolean) {
    await commit((d) => {
      const line = d.shoppingLines.find((x) => x.id === id);
      if (line) line.checked = checked;
    });
  }

  async function removeLine(id: string) {
    const line = state?.shoppingLines.find((x) => x.id === id);
    if (!line?.checked) return;
    await commit((d) => {
      d.shoppingLines = d.shoppingLines.filter((x) => x.id !== id);
    });
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    const q = Number(qty);
    setFormBusy(true);
    let ok: boolean;
    if (editingLineId === null) {
      ok = await commit((d) => {
        d.shoppingLines.push({
          id: crypto.randomUUID(),
          name: name.trim(),
          quantity: Number.isFinite(q) ? q : 1,
          unit,
          aisle,
          checked: false,
          manual: true,
        });
      });
    } else {
      const id = editingLineId;
      ok = await commit((d) => {
        const line = d.shoppingLines.find((x) => x.id === id);
        if (line) {
          line.name = name.trim();
          line.quantity = Number.isFinite(q) ? q : line.quantity;
          line.unit = unit;
          line.aisle = aisle;
        }
      });
    }
    setFormBusy(false);
    if (ok) closeModal();
  }

  const isEdit = editingLineId !== null;

  if (!state) {
    return <p className="muted">Chargement…</p>;
  }

  return (
    <div>
      <h1>Liste de courses</h1>

      <div className="toolbar shop-toolbar">
        <button type="button" className="btn primary" onClick={openAddModal}>
          Ajouter un ingrédient
        </button>
      </div>

      {modalOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ingredient-form-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="ingredient-form-title">
              {isEdit ? "Modifier l’ingrédient" : "Ajouter un ingrédient"}
            </h2>
            <form onSubmit={submitForm}>
              <label className="field">
                <span>Nom</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Rayon</span>
                <select
                  value={aisle}
                  onChange={(e) => setAisle(e.target.value)}
                  required
                >
                  {SHOP_AISLES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid-2">
                <label className="field">
                  <span>Quantité</span>
                  <input value={qty} onChange={(e) => setQty(e.target.value)} />
                </label>
                <label className="field">
                  <span>Unité</span>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  >
                    {SHOP_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row end">
                <button type="button" className="btn ghost" onClick={closeModal}>
                  Annuler
                </button>
                <button type="submit" className="btn primary" disabled={formBusy}>
                  {formBusy
                    ? isEdit
                      ? "Enregistrement…"
                      : "Ajout…"
                    : isEdit
                      ? "Enregistrer"
                      : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {grouped.map(([aisleName, lines]) => (
        <section key={aisleName} className="aisle-block">
          <h2>{aisleName}</h2>
          <ul className="shop-list">
            {lines.map((l) => (
              <li key={l.id} className={l.checked ? "checked" : ""}>
                <div className="shop-line-main">
                  <label className="check shop-line-check">
                    <input
                      type="checkbox"
                      checked={l.checked}
                      onChange={(e) => void toggleLine(l.id, e.target.checked)}
                    />
                  </label>
                  <button
                    type="button"
                    className="shop-line-edit"
                    onClick={() => openEditModal(l)}
                    aria-label={`Modifier ${l.name}`}
                  >
                    <span className="shop-line-qty">
                      <strong>
                        {l.quantity} {l.unit}
                      </strong>
                    </span>
                    <span className="shop-line-name">{l.name}</span>
                    {l.manual ? <span className="pill">Manuel</span> : null}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn ghost danger"
                  disabled={!l.checked}
                  title={l.checked ? "Retirer" : "Cochez d’abord"}
                  onClick={() => void removeLine(l.id)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
