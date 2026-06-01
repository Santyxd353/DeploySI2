import { useRef, useState } from "react";
import { CloseIcon, CartIcon } from "../ui/Icons";

function CartItem({ item, onUpdateQuantity, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(item.cantidad));
  const inputRef = useRef(null);

  const handleStartEdit = () => {
    setInputValue(String(item.cantidad));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleFinishEdit = () => {
    setEditing(false);
    const parsed = parseInt(inputValue, 10);
    if (isNaN(parsed) || parsed <= 0) {
      setInputValue(String(item.cantidad));
      return;
    }
    const clamped = Math.min(parsed, item.stock_disponible);
    onUpdateQuantity(item.producto_id, clamped);
    setInputValue(String(clamped));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputValue(String(item.cantidad));
      setEditing(false);
    }
  };

  return (
    <div className="mb-2 rounded-xl border border-slate-100 bg-slate-50 p-3 transition-all duration-150 hover:border-slate-200">
      <div className="mb-1.5 flex items-start justify-between">
        <div className="flex-1 pr-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-bold text-slate-800 line-clamp-1">{item.nombre}</p>
            {item.requiere_receta ? (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                ⚠ Receta
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-slate-500">SKU: {item.sku}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.producto_id)}
          className="mt-0.5 text-slate-400 transition hover:text-rose-500"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.producto_id, item.cantidad - 1)}
            disabled={item.cantidad <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-100 active:scale-95 disabled:opacity-30"
          >
            -
          </button>

          {editing ? (
            <input
              ref={inputRef}
              type="number"
              min="1"
              max={item.stock_disponible}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={handleKeyDown}
              className="h-8 w-14 rounded-lg border border-emerald-400 bg-white text-center text-sm font-bold text-slate-800 shadow-sm outline-none ring-4 ring-emerald-100"
            />
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              title="Click para editar cantidad"
              className="flex h-8 w-14 cursor-text items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-800 transition hover:border-emerald-300"
            >
              {item.cantidad}
            </button>
          )}

          <button
            type="button"
            onClick={() => onUpdateQuantity(item.producto_id, item.cantidad + 1)}
            disabled={item.cantidad >= item.stock_disponible}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-600 transition hover:bg-slate-100 active:scale-95 disabled:opacity-30"
          >
            +
          </button>
        </div>

        <div className="text-right">
          <p className="text-sm font-black text-emerald-700 transition-all duration-150">
            Bs {item.subtotal.toFixed(2)}
          </p>
          <p className="text-[10px] text-slate-400">
            Bs {Number(item.precio_unitario).toFixed(2)} c/u
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Cart({ cart, onUpdateQuantity, onRemove, onClear, totals, onCheckout, disabled }) {
  return (
    <div className="flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <CartIcon className="h-5 w-5 text-teal-600" />
          <h2 className="text-sm font-black text-slate-800">Carrito POS</h2>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-100 px-1.5 text-[10px] font-bold text-teal-700 transition-all duration-200">
            {cart.length}
          </span>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-semibold text-rose-500 transition hover:text-rose-700"
          >
            Vaciar
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {cart.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <CartIcon className="mb-3 h-12 w-12" />
            <p className="text-sm font-medium">Carrito vacío</p>
            <p className="text-xs">Agrega productos desde la lista</p>
          </div>
        )}

        {cart.map((item) => (
          <CartItem
            key={item.producto_id}
            item={item}
            onUpdateQuantity={onUpdateQuantity}
            onRemove={onRemove}
          />
        ))}
      </div>

      <div className="border-t border-slate-200 px-4 py-4">
        <div className="mb-4 space-y-1">
          <div className="flex items-center justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="font-semibold transition-all duration-150">
              Bs {totals.subtotal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between text-lg font-black text-slate-900">
            <span>Total</span>
            <span className="text-emerald-700 transition-all duration-150">
              Bs {totals.total.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onCheckout}
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition-all duration-150 hover:from-emerald-500 hover:to-teal-500 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
        >
          Cobrar — Bs {totals.total.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
