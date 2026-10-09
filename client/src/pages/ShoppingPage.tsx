import { type DragEvent, type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useCatalogLabels } from "@/i18n/labels";
import { Separator } from "@/components/ui/separator";
import {
  moveLineStepInAisle,
  moveLineWithinAisle,
} from "@/lib/reorderShoppingAisle";
import { randomId } from "@/lib/randomId";
import { useAppStore } from "@/store/useAppStore";
import {
  aisleForSelect,
  aisleOrderToMap,
  compareAisles,
  normalizeAisleOrder,
  SHOP_AISLES,
} from "@/lib/shopAisles";
import { SHOP_UNITS, unitForSelect } from "@/lib/shopUnits";
import type { ShoppingLine } from "@/types";

export default function ShoppingPage() {
  const { t, i18n } = useTranslation(["shopping", "common"]);
  const { aisleLabel, unitLabel } = useCatalogLabels();
  const hydrate = useAppStore((s) => s.hydrate);
  const state = useAppStore((s) => s.state);
  const error = useAppStore((s) => s.error);
  const pendingSync = useAppStore((s) => s.pendingSync);
  const commit = useAppStore((s) => s.commit);
  const clearAllShopping = useAppStore((s) => s.clearAllShopping);
  const online = useOnlineStatus();

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
  const [clearShoppingOpen, setClearShoppingOpen] = useState(false);
  const [clearShoppingBusy, setClearShoppingBusy] = useState(false);
  const [removeBoughtOpen, setRemoveBoughtOpen] = useState(false);
  const [removeBoughtBusy, setRemoveBoughtBusy] = useState(false);
  const [draggingLineId, setDraggingLineId] = useState<string | null>(null);
  const dragGhostElRef = useRef<HTMLDivElement | null>(null);
  /** Rayon imposé (bouton + à côté du titre de rayon) : le select est masqué. */
  const [lockAisleInForm, setLockAisleInForm] = useState(false);

  function cleanupDragGhost() {
    const el = dragGhostElRef.current;
    if (el) {
      el.remove();
      dragGhostElRef.current = null;
    }
  }

  useEffect(() => {
    // Firefox peut ne pas déclencher `drop` comme attendu. On force le "reset" via `dragend`.
    const onAnyDragEnd = () => {
      setDraggingLineId(null);
      cleanupDragGhost();
    };
    window.addEventListener("dragend", onAnyDragEnd);
    return () => window.removeEventListener("dragend", onAnyDragEnd);
  }, []);

  const aisleOrderMap = useMemo(() => {
    const order = state
      ? normalizeAisleOrder(state.shopAisleOrder)
      : normalizeAisleOrder(undefined);
    return aisleOrderToMap(order);
  }, [state?.shopAisleOrder, state]);

  const grouped = useMemo(() => {
    const lines = state?.shoppingLines ?? [];
    const m = new Map<string, typeof lines>();
    for (const l of lines) {
      const arr = m.get(l.aisle) ?? [];
      arr.push(l);
      m.set(l.aisle, arr);
    }
    return Array.from(m.entries()).sort(([a], [b]) =>
      compareAisles(a, b, aisleOrderMap)
    );
  }, [state?.shoppingLines, aisleOrderMap]);

  function resetForm() {
    setName("");
    setAisle(SHOP_AISLES[3]);
    setQty("1");
    setUnit("pièce");
    setEditingLineId(null);
    setLockAisleInForm(false);
  }

  function openAddModal() {
    resetForm();
    setModalOpen(true);
  }

  function openAddModalForAisle(aisleName: string) {
    setEditingLineId(null);
    setName("");
    setQty("1");
    setUnit("pièce");
    setAisle(aisleForSelect(aisleName));
    setLockAisleInForm(true);
    setModalOpen(true);
  }

  function openEditModal(line: ShoppingLine) {
    setEditingLineId(line.id);
    setName(line.name);
    setAisle(aisleForSelect(line.aisle));
    setQty(String(line.quantity));
    setUnit(unitForSelect(line.unit));
    setLockAisleInForm(false);
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

  async function persistLineOrder(nextLines: ShoppingLine[]) {
    await commit((d) => {
      d.shoppingLines = nextLines;
    });
  }

  async function moveInAisle(aisleName: string, lineId: string, dir: -1 | 1) {
    const cur = state?.shoppingLines;
    if (!cur) return;
    const next = moveLineStepInAisle(cur, aisleName, lineId, dir);
    if (next) await persistLineOrder(next);
  }

  function onDragStartLine(e: DragEvent, lineId: string) {
    const line = state?.shoppingLines.find((x) => x.id === lineId);
    if (line?.checked) {
      e.preventDefault();
      return;
    }

    // Firefox est parfois capricieux sur `getData()` : on met plusieurs types.
    e.dataTransfer.setData("text/plain", lineId);
    e.dataTransfer.setData("application/x-preppr-shopping-line-id", lineId);
    e.dataTransfer.effectAllowed = "move";
    // Évite les effets “ghost” bizarres (Firefox) en contrôlant l’image de drag.
    const ghost = document.createElement("div");
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    ghost.style.position = "absolute";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    document.body.appendChild(ghost);
    dragGhostElRef.current = ghost;
    e.dataTransfer.setDragImage(ghost, 0, 0);

    setDraggingLineId(lineId);
  }

  async function onDropOnLine(
    e: DragEvent,
    aisleName: string,
    targetLineId: string
  ) {
    e.preventDefault();

    const fromId =
      e.dataTransfer.getData("application/x-preppr-shopping-line-id") ||
      e.dataTransfer.getData("text/plain");
    setDraggingLineId(null);
    cleanupDragGhost();
    const cur = state?.shoppingLines;
    if (!fromId || !cur) return;
    const fromLine = cur.find((x) => x.id === fromId);
    if (!fromLine || fromLine.aisle !== aisleName || fromId === targetLineId)
      return;
    const next = moveLineWithinAisle(cur, aisleName, fromId, targetLineId);
    await persistLineOrder(next);
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    const q = Number(qty);
    setFormBusy(true);
    try {
      let ok: boolean;
      if (editingLineId === null) {
        ok = await commit((d) => {
          d.shoppingLines.push({
            id: randomId(),
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
      if (ok) closeModal();
    } finally {
      setFormBusy(false);
    }
  }

  const isEdit = editingLineId !== null;
  const showAisleField = isEdit || !lockAisleInForm;

  const lineCount = state?.shoppingLines.length ?? 0;
  const boughtLineCount =
    state?.shoppingLines.filter((l) => l.checked).length ?? 0;
  const canBulkClearShopping = online && !pendingSync && lineCount > 0;
  const canRemoveBought = boughtLineCount > 0;

  async function confirmClearAllShopping() {
    setClearShoppingBusy(true);
    const ok = await clearAllShopping();
    setClearShoppingBusy(false);
    if (ok) setClearShoppingOpen(false);
  }

  async function confirmRemoveBoughtLines() {
    setRemoveBoughtBusy(true);
    await commit((d) => {
      d.shoppingLines = d.shoppingLines.filter((l) => !l.checked);
    });
    setRemoveBoughtBusy(false);
    setRemoveBoughtOpen(false);
  }

  if (!state) {
    return <p className="muted">{t("common:loading")}</p>;
  }

  const printGeneratedAt = new Date().toLocaleString(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="shopping-page">
      <h1>{t("title")}</h1>
      <p className="muted small shop-print-generated shop-print-only">
        {t("printedAt", { date: printGeneratedAt })}
      </p>

      {error ? (
        <p className="error banner" role="alert">
          {error}
        </p>
      ) : null}

      <div className="toolbar shop-toolbar">
        <button type="button" className="btn primary" onClick={openAddModal}>
          {t("addIngredient")}
        </button>
        <button
          type="button"
          className="btn ghost shop-toolbar-print"
          disabled={lineCount === 0}
          title={lineCount === 0 ? t("emptyList") : undefined}
          onClick={() => window.print()}
        >
          {t("print")}
        </button>
      </div>
      <p className="muted small shop-reorder-hint">{t("reorderHint")}</p>

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
              {isEdit ? t("editIngredient") : t("addIngredientTitle")}
            </h2>
            <form onSubmit={submitForm} className="shop-ingredient-form">
              {error ? (
                <p className="error banner" role="alert">
                  {error}
                </p>
              ) : null}
              <label className="field">
                <span>{t("name")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              {showAisleField ? (
                <label className="field">
                  <span>{t("aisle")}</span>
                  <select
                    value={aisle}
                    onChange={(e) => setAisle(e.target.value)}
                    required
                  >
                    {SHOP_AISLES.map((a) => (
                      <option key={a} value={a}>
                        {aisleLabel(a)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="muted small shop-form-aisle-hint">
                  {t("aisleLocked")} <strong>{aisleLabel(aisle)}</strong>
                </p>
              )}
              <div className="field field-qty-unit">
                <span>{t("qtyUnit")}</span>
                <div className="qty-unit-row">
                  <label className="sr-only" htmlFor="shop-form-qty">
                    {t("quantity")}
                  </label>
                  <input
                    id="shop-form-qty"
                    className="shop-form-qty"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    inputMode="decimal"
                  />
                  <label className="sr-only" htmlFor="shop-form-unit">
                    {t("unit")}
                  </label>
                  <select
                    id="shop-form-unit"
                    className="shop-form-unit"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    required
                  >
                    {SHOP_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="row end">
                <button type="button" className="btn ghost" onClick={closeModal}>
                  {t("common:cancel")}
                </button>
                <button type="submit" className="btn primary" disabled={formBusy}>
                  {formBusy
                    ? isEdit
                      ? t("saving")
                      : t("adding")
                    : isEdit
                      ? t("save")
                      : t("add")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {grouped.map(([aisleName, lines]) => (
        <section key={aisleName} className="aisle-block">
          <div className="aisle-block-head">
            <h2>{aisleLabel(aisleName)}</h2>
            <button
              type="button"
              className="btn aisle-add-btn"
              aria-label={t("addInAisle", { aisle: aisleLabel(aisleName) })}
              title={t("addInThisAisle")}
              onClick={() => openAddModalForAisle(aisleName)}
            >
              +
            </button>
          </div>
          <ul className="shop-list">
            {lines.map((l, idx) => (
              <li
                key={l.id}
                className={[
                  l.checked ? "checked" : "",
                  draggingLineId === l.id ? "shop-li-dragging" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => void onDropOnLine(e, aisleName, l.id)}
              >
                <div className="shop-line-main">
                  <span
                    className="shop-drag-handle"
                    draggable={!l.checked}
                    title={t("dragReorder")}
                    aria-label={t("reorderItem", { name: l.name })}
                    onDragStart={(e) => onDragStartLine(e, l.id)}
                    onDragEnd={() => {
                      setDraggingLineId(null);
                      cleanupDragGhost();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    ⋮
                  </span>
                  <label
                    className="check shop-line-check"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={l.checked}
                      onChange={(e) => void toggleLine(l.id, e.target.checked)}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </label>
                  <button
                    type="button"
                    className="shop-line-edit"
                    onClick={() => openEditModal(l)}
                    aria-label={t("editItem", { name: l.name })}
                  >
                    <span className="shop-line-qty">
                      <strong>
                        {l.quantity} {unitLabel(l.unit)}
                      </strong>
                    </span>
                    <span className="shop-line-name">{l.name}</span>
                    {l.extraIngredient ? (
                      <span className="pill pill-extra">{t("extra")}</span>
                    ) : l.manual ? (
                      <span className="pill">{t("manual")}</span>
                    ) : null}
                  </button>
                </div>
                <div className="shop-line-actions">
                  {!l.checked ? (
                    <div
                      className="shop-reorder-btns"
                      role="group"
                      aria-label={t("positionIn", { aisle: aisleLabel(aisleName) })}
                    >
                      <button
                        type="button"
                        className="btn icon ghost"
                        disabled={idx === 0}
                        aria-label={t("moveUp", { name: l.name })}
                        onClick={() => void moveInAisle(aisleName, l.id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn icon ghost"
                        disabled={idx === lines.length - 1}
                        aria-label={t("moveDown", { name: l.name })}
                        onClick={() => void moveInAisle(aisleName, l.id, 1)}
                      >
                        ↓
                      </button>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn ghost danger"
                    disabled={!l.checked}
                    title={l.checked ? t("removeTitle") : t("removeLocked")}
                    onClick={() => void removeLine(l.id)}
                  >
                    {t("remove")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <footer className="page-footer">
        <Separator className="mb-[1.25rem]" />
        <p className="muted small">{t("footerHint")}</p>
        <div className="shop-footer-actions">
          <button
            type="button"
            className="btn ghost"
            disabled={!canRemoveBought}
            title={boughtLineCount === 0 ? t("noneChecked") : undefined}
            onClick={() => setRemoveBoughtOpen(true)}
          >
            {t("removeChecked")}
          </button>
          <button
            type="button"
            className="btn danger ghost"
            disabled={!canBulkClearShopping}
            title={
              !online
                ? t("common:connectionRequired")
                : pendingSync
                  ? t("common:syncPending")
                  : lineCount === 0
                    ? t("alreadyEmpty")
                    : undefined
            }
            onClick={() => setClearShoppingOpen(true)}
          >
            {t("clearAll")}
          </button>
        </div>
      </footer>

      {removeBoughtOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-bought-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !removeBoughtBusy) setRemoveBoughtOpen(false);
          }}
        >
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="remove-bought-title">{t("removeCheckedTitle")}</h2>
            <p className="muted">{t("removeCheckedBody")}</p>
            <div className="row end">
              <button
                type="button"
                className="btn ghost"
                disabled={removeBoughtBusy}
                onClick={() => setRemoveBoughtOpen(false)}
              >
                {t("common:cancel")}
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={removeBoughtBusy}
                onClick={() => void confirmRemoveBoughtLines()}
              >
                {removeBoughtBusy ? t("removing") : t("removeCheckedConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clearShoppingOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-shopping-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !clearShoppingBusy) setClearShoppingOpen(false);
          }}
        >
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="clear-shopping-title">{t("clearTitle")}</h2>
            <p className="muted">{t("clearBody")}</p>
            <div className="row end">
              <button
                type="button"
                className="btn ghost"
                disabled={clearShoppingBusy}
                onClick={() => setClearShoppingOpen(false)}
              >
                {t("common:cancel")}
              </button>
              <button
                type="button"
                className="btn danger"
                disabled={clearShoppingBusy}
                onClick={() => void confirmClearAllShopping()}
              >
                {clearShoppingBusy ? t("clearing") : t("clearConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
