export default function ProductsPagination({ loading, paginationRangeText, currentPage, totalPages, onPreviousPage, onNextPage }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3">
      <p className="text-xs font-semibold text-slate-600">{paginationRangeText}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={onPreviousPage}
          disabled={loading || currentPage <= 1}
          className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Anterior
        </button>
        <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
          Página <span className="text-teal-600">{currentPage}</span> de <span className="text-slate-900">{totalPages}</span>
        </span>
        <button
          onClick={onNextPage}
          disabled={loading || currentPage >= totalPages}
          className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
