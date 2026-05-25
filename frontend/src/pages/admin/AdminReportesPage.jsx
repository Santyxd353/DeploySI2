import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import AdminLayout from "../../components/admin/AdminLayout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  CalendarIcon,
  ChartBarIcon,
  ClipboardListIcon,
  DollarIcon,
  PackageIcon,
  SearchIcon,
  SparkIcon,
  UsersGroupIcon,
} from "../../components/ui/Icons";
import { useAuth } from "../../context/AuthContext";
import { reportesService } from "../../services/reportesService";

const EMPTY_FILTERS = { periodo: "este_mes", top: 25 };
const MAX_AUDIO_RECORDING_MS = 12000;
const CHART_COLORS = ["#0f766e", "#0891b2", "#2563eb", "#f59e0b", "#e11d48", "#7c3aed", "#475569", "#16a34a"];

const CATEGORY_META = {
  Ventas: {
    icon: DollarIcon,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-600",
    description: "Ingresos, facturas, tickets y vendedores.",
  },
  Productos: {
    icon: PackageIcon,
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-600",
    description: "Rotacion, ingresos, categorias y laboratorios.",
  },
  Inventario: {
    icon: PackageIcon,
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    description: "Stock actual, bajo, agotado y movimientos.",
  },
  Clientes: {
    icon: UsersGroupIcon,
    tone: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-600",
    description: "Clientes frecuentes, nuevos y segmentos.",
  },
  Recetas: {
    icon: ClipboardListIcon,
    tone: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-600",
    description: "Estados, vencimientos y trazabilidad.",
  },
  Bitacora: {
    icon: ChartBarIcon,
    tone: "bg-slate-100 text-slate-700 border-slate-200",
    dot: "bg-slate-700",
    description: "Auditoria, fallos, usuarios y modulos.",
  },
};

function cleanFilters(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== "" && value !== null && value !== undefined)
  );
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value).replace(/\r?\n/g, " ").trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function isNumeric(value) {
  if (value === null || value === undefined || value === "") return false;
  return Number.isFinite(Number(value));
}

function formatValue(value, type) {
  if (value === null || value === undefined || value === "") return "-";
  if (type === "currency") {
    return `Bs ${Number(value || 0).toLocaleString("es-BO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (type === "number") return Number(value || 0).toLocaleString("es-BO");
  if (type === "datetime") return new Date(value).toLocaleString("es-BO");
  return String(value);
}

function safeDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("es-BO");
}

function getLabelColumn(columns, rows, preferredKey) {
  if (preferredKey && columns.some((column) => column.key === preferredKey)) return preferredKey;
  const textColumn = columns.find((column) => column.type !== "number" && column.type !== "currency");
  if (textColumn) return textColumn.key;
  return columns[0]?.key || "";
}

function getNumericColumns(columns, rows) {
  return columns.filter((column) => {
    if (column.type === "number" || column.type === "currency") return true;
    return rows.some((row) => isNumeric(row[column.key]));
  });
}

function buildChartRows(result, limit = 12) {
  const columns = result?.columnas || [];
  const rows = Array.isArray(result?.filas) ? result.filas : [];
  const numericColumns = getNumericColumns(columns, rows);
  const valueKey = result?.grafico?.value_key || numericColumns[0]?.key || "";
  const labelKey = getLabelColumn(columns, rows, result?.grafico?.label_key);

  if (!valueKey || !labelKey) return [];

  return rows
    .map((row) => ({
      label: String(row[labelKey] || "Sin dato"),
      value: Number(row[valueKey] || 0),
      raw: row,
    }))
    .filter((item) => Number.isFinite(item.value))
    .slice(0, limit);
}

function buildStats(result) {
  const rows = Array.isArray(result?.filas) ? result.filas : [];
  const columns = result?.columnas || [];
  const numericColumns = getNumericColumns(columns, rows);
  const valueColumn =
    numericColumns.find((column) => column.key === result?.grafico?.value_key) || numericColumns[0] || null;
  const values = valueColumn
    ? rows.map((row) => Number(row[valueColumn.key] || 0)).filter((value) => Number.isFinite(value))
    : [];
  const total = values.reduce((sum, value) => sum + value, 0);

  return {
    rowsCount: rows.length,
    columnsCount: columns.length,
    numericColumns,
    valueColumn,
    total,
    avg: values.length ? total / values.length : 0,
    max: values.length ? Math.max(...values) : 0,
    min: values.length ? Math.min(...values) : 0,
  };
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function setPdfFill(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.setFillColor(r, g, b);
}

function setPdfText(doc, hex) {
  const [r, g, b] = hexToRgb(hex);
  doc.setTextColor(r, g, b);
}

function truncateText(text, maxLength = 28) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${((Math.max(value, 0) / total) * 100).toLocaleString("es-BO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function makeChartCanvas(width = 1200, height = 620) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

function createBarChartImage(rows, valueType, title = "Grafico principal") {
  const { canvas, ctx } = makeChartCanvas(1600, 480);
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 38px Sora, Arial, sans-serif";
  ctx.fillText(title, 60, 58);
  ctx.fillStyle = "#64748b";
  ctx.font = "500 23px Sora, Arial, sans-serif";
  ctx.fillText("Comparacion de los principales registros", 60, 92);

  if (!rows.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 30px Sora, Arial, sans-serif";
    ctx.fillText("Sin datos para graficar", 610, 270);
    return canvas.toDataURL("image/png");
  }

  const chartRows = rows.slice(0, 9);
  const max = Math.max(...chartRows.map((row) => Math.abs(row.value)), 1);
  const left = 460;
  const top = 122;
  const barHeight = 27;
  const gap = 17;
  const barMaxWidth = 780;

  chartRows.forEach((row, index) => {
    const y = top + index * (barHeight + gap);
    const barWidth = Math.max(10, (Math.abs(row.value) / max) * barMaxWidth);
    const color = CHART_COLORS[index % CHART_COLORS.length];

    ctx.fillStyle = "#334155";
    ctx.font = "800 20px Sora, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(truncateText(row.label, 38), left - 28, y + 20);

    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, left, y, barMaxWidth, barHeight, 16);
    ctx.fill();

    ctx.fillStyle = color;
    roundRect(ctx, left, y, barWidth, barHeight, 16);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.font = "800 20px Sora, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(formatValue(row.value, valueType), left + barMaxWidth + 32, y + 20);
  });

  return canvas.toDataURL("image/png");
}

function createLineChartImage(rows, valueType) {
  const { canvas, ctx } = makeChartCanvas(1600, 480);
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 38px Sora, Arial, sans-serif";
  ctx.fillText("Tendencia principal", 60, 58);
  ctx.fillStyle = "#64748b";
  ctx.font = "500 23px Sora, Arial, sans-serif";
  ctx.fillText("Evolucion de valores en el periodo", 60, 92);

  if (rows.length < 2) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 30px Sora, Arial, sans-serif";
    ctx.fillText("No hay suficientes puntos para tendencia", 520, 270);
    return canvas.toDataURL("image/png");
  }

  const chartRows = rows.slice(0, 12);
  const values = chartRows.map((row) => row.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const left = 95;
  const top = 122;
  const width = 1410;
  const height = 250;

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    const y = top + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + width, y);
    ctx.stroke();
  }

  const points = chartRows.map((row, index) => ({
    x: left + (index / (chartRows.length - 1)) * width,
    y: top + height - ((row.value - min) / range) * height,
    row,
  }));

  const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
  gradient.addColorStop(0, "#0f766e");
  gradient.addColorStop(1, "#0891b2");
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  points.forEach((point) => {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 5;
    ctx.stroke();
  });

  ctx.fillStyle = "#475569";
  ctx.font = "700 19px Sora, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(truncateText(chartRows[0]?.label, 24), left, top + height + 48);
  ctx.textAlign = "center";
  ctx.fillText(formatValue(max, valueType), left + width / 2, top + height + 50);
  ctx.textAlign = "right";
  ctx.fillText(truncateText(chartRows[chartRows.length - 1]?.label, 24), left + width, top + height + 48);

  return canvas.toDataURL("image/png");
}

function createDonutChartImage(rows, valueType) {
  const { canvas, ctx } = makeChartCanvas(1600, 560);
  ctx.fillStyle = "#0f172a";
  ctx.font = "800 40px Sora, Arial, sans-serif";
  ctx.fillText("Distribucion", 60, 60);
  ctx.fillStyle = "#64748b";
  ctx.font = "500 24px Sora, Arial, sans-serif";
  ctx.fillText("Participacion porcentual por registro", 60, 98);

  const chartRows = rows.slice(0, 12);
  const total = chartRows.reduce((sum, row) => sum + Math.max(row.value, 0), 0);
  if (!chartRows.length || !total) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 30px Sora, Arial, sans-serif";
    ctx.fillText("Sin datos de distribucion", 560, 290);
    return canvas.toDataURL("image/png");
  }

  const centerX = 190;
  const centerY = 285;
  const radius = 118;
  const innerRadius = 70;
  let startAngle = -Math.PI / 2;
  chartRows.forEach((row, index) => {
    const slice = (Math.max(row.value, 0) / total) * Math.PI * 2;
    const endAngle = startAngle + slice;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fill();
    startAngle = endAngle;
  });
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 17px Sora, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TOTAL", centerX, centerY - 8);
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 24px Sora, Arial, sans-serif";
  ctx.fillText(formatValue(total, valueType).slice(0, 16), centerX, centerY + 22);

  const left = 410;
  const top = 126;
  const barWidth = 760;
  const barHeight = 16;
  const rowHeight = 35;
  ctx.textAlign = "left";
  chartRows.forEach((row, index) => {
    const y = top + index * rowHeight;
    const percent = Math.max(row.value, 0) / total;
    const color = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fillStyle = "#334155";
    ctx.font = "800 18px Sora, Arial, sans-serif";
    ctx.fillText(truncateText(row.label, 40), left, y);

    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, left, y + 12, barWidth, barHeight, 9);
    ctx.fill();

    ctx.fillStyle = color;
    roundRect(ctx, left, y + 12, Math.max(8, percent * barWidth), barHeight, 9);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "900 18px Sora, Arial, sans-serif";
    ctx.fillText(formatPercent(row.value, total), left + barWidth + 35, y + 2);

    ctx.fillStyle = "#64748b";
    ctx.font = "700 16px Sora, Arial, sans-serif";
    ctx.fillText(formatValue(row.value, valueType), left + barWidth + 35, y + 24);
  });

  return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function groupedReports(reportTypes) {
  return reportTypes.reduce((groups, report) => {
    groups[report.categoria] = groups[report.categoria] || [];
    groups[report.categoria].push(report);
    return groups;
  }, {});
}

function FieldInput({ filter, value, onChange, catalog }) {
  const baseClass =
    "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100";

  if (filter.type === "select") {
    const options = filter.options || catalog?.opciones?.[filter.options_key] || [];
    return (
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (filter.type === "boolean") {
    return (
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={baseClass}>
        <option value="">Todos</option>
        <option value="true">Si</option>
        <option value="false">No</option>
      </select>
    );
  }

  return (
    <Input
      type={filter.type === "number" ? "number" : filter.type}
      min={filter.min}
      max={filter.max}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className="h-10"
    />
  );
}

function StepHeader({ number, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
        {description ? <p className="text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}

function ReportControlPanel({
  catalog,
  categories,
  reportsByCategory,
  activeCategory,
  setActiveCategory,
  selectedType,
  selectedReport,
  onSelectReport,
  filters,
  visibleFilters,
  updateFilter,
  onGenerate,
  onClear,
  loadingReport,
  loadingCatalog,
}) {
  const [reportSearch, setReportSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeReports = reportsByCategory[activeCategory] || [];
  const filteredReports = activeReports.filter((report) =>
    `${report.label} ${report.categoria}`.toLowerCase().includes(reportSearch.trim().toLowerCase())
  );
  const primaryFilters = visibleFilters.filter((filter) =>
    ["periodo", "fecha_inicio", "fecha_fin", "agrupacion", "top"].includes(filter.id)
  );
  const detailFilters = visibleFilters.filter((filter) => !primaryFilters.some((item) => item.id === filter.id));
  const visibleDetailFilters = showAdvanced ? detailFilters : detailFilters.slice(0, 6);

  return (
    <aside className="space-y-4 xl:sticky xl:top-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <StepHeader number="1" title="Elige el reporte" description="Filtra por area y selecciona el analisis que necesitas." />

        <div className="mt-4 grid grid-cols-2 gap-2">
          {categories.map((category) => {
            const meta = CATEGORY_META[category] || CATEGORY_META.Ventas;
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-2xl border px-3 py-2 text-left transition ${
                  active ? meta.tone : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                }`}
              >
                <span className={`mb-2 block h-2 w-8 rounded-full ${active ? meta.dot : "bg-slate-300"}`} />
                <span className="block text-xs font-black">{category}</span>
                <span className="block text-[11px] text-slate-500">{reportsByCategory[category]?.length || 0} reportes</span>
              </button>
            );
          })}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Buscar reporte</span>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              value={reportSearch}
              onChange={(event) => setReportSearch(event.target.value)}
              placeholder="Ventas, stock, clientes..."
              className="h-10 pl-9"
            />
          </div>
        </label>

        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {loadingCatalog ? (
            <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">Cargando reportes...</p>
          ) : null}

          {filteredReports.map((report) => {
            const active = selectedType === report.id;
            return (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelectReport(report)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  active
                    ? "border-teal-500 bg-teal-50 text-teal-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block text-sm font-black">{report.label}</span>
                <span className="mt-1 block text-[11px] font-semibold text-slate-500">{report.filtros?.length || 0} filtros disponibles</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <StepHeader number="2" title="Ajusta filtros" description={selectedReport?.label || "Selecciona un reporte para ver filtros."} />

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            <CalendarIcon className="h-4 w-4" />
            Periodo
          </div>
          <div className="grid gap-3">
            {primaryFilters.map((filter) => (
              <label key={filter.id} className="block">
                <span className="mb-1 block text-[11px] font-bold text-slate-500">{filter.label}</span>
                <FieldInput filter={filter} value={filters[filter.id]} onChange={(value) => updateFilter(filter.id, value)} catalog={catalog} />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {visibleDetailFilters.map((filter) => (
            <label key={filter.id} className="block">
              <span className="mb-1 block text-[11px] font-bold text-slate-500">{filter.label}</span>
              <FieldInput filter={filter} value={filters[filter.id]} onChange={(value) => updateFilter(filter.id, value)} catalog={catalog} />
            </label>
          ))}
        </div>

        {detailFilters.length > 6 ? (
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="mt-3 text-xs font-black text-teal-700 hover:text-teal-600"
          >
            {showAdvanced ? "Ver menos filtros" : `Ver ${detailFilters.length - 6} filtros mas`}
          </button>
        ) : null}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onClear}>
            Limpiar
          </Button>
          <Button onClick={onGenerate} disabled={loadingReport || !selectedType}>
            {loadingReport ? "Generando..." : "Generar"}
          </Button>
        </div>
      </section>
    </aside>
  );
}

function AiCommandBar({ aiText, setAiText, onText, onAudio, recording, loadingReport, audioLoading }) {
  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <SparkIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-black text-slate-950">Pedir reporte con IA</h2>
            <p className="text-xs text-slate-500">Escribe o graba una solicitud. Ej: productos con stock bajo.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {["medicamentos mas vendidos del mes pasado", "productos con stock bajo", "ventas por vendedor este mes"].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setAiText(example)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:bg-white"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_150px_140px]">
        <Input
          value={aiText}
          onChange={(event) => setAiText(event.target.value)}
          placeholder="Ej: dame las ventas por origen de este mes"
          className="h-11"
        />
        <Button onClick={onText} disabled={loadingReport || audioLoading}>
          {loadingReport ? "Generando IA" : "Generar IA"}
        </Button>
        <Button
          variant={recording ? "default" : "secondary"}
          onClick={onAudio}
          disabled={audioLoading || loadingReport}
          className={recording ? "bg-rose-700 hover:bg-rose-600" : ""}
        >
          {recording ? "Detener" : audioLoading ? "Transcribiendo" : "Audio"}
        </Button>
      </div>
    </section>
  );
}

function MetricCard({ label, value, detail, tone = "neutral" }) {
  const tones = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
    info: "border-cyan-200 bg-cyan-50 text-cyan-950",
    neutral: "border-slate-200 bg-white text-slate-950",
  };
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${tones[tone] || tones.neutral}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-60">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      {detail ? <p className="mt-1 text-xs font-semibold opacity-65">{detail}</p> : null}
    </article>
  );
}

function EmptyChart({ message = "Sin datos para graficar" }) {
  return (
    <div className="flex h-full min-h-44 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-semibold text-slate-400">
      {message}
    </div>
  );
}

function BarChart({ rows, valueType, compact = false }) {
  if (!rows.length) return <EmptyChart />;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const viewRows = compact ? rows.slice(0, 7) : rows;

  return (
    <div className="space-y-3">
      {viewRows.map((row, index) => (
        <div key={`${row.label}-${index}`} className="grid grid-cols-[120px_minmax(0,1fr)_90px] items-center gap-3">
          <p className="truncate text-xs font-bold text-slate-600" title={row.label}>
            {row.label}
          </p>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-teal-600 to-cyan-500"
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
            />
          </div>
          <p className="text-right text-xs font-black text-slate-700">{formatValue(row.value, valueType)}</p>
        </div>
      ))}
    </div>
  );
}

function LineChart({ rows, valueType }) {
  if (rows.length < 2) return <EmptyChart message="La tendencia necesita al menos dos puntos." />;
  const max = Math.max(...rows.map((row) => row.value), 1);
  const min = Math.min(...rows.map((row) => row.value), 0);
  const range = Math.max(max - min, 1);
  const points = rows
    .map((row, index) => {
      const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
      const y = 100 - ((row.value - min) / range) * 82 - 9;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox="0 0 100 100" className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="reportLineGradient" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.6" />
        ))}
        <polyline points={points} fill="none" stroke="url(#reportLineGradient)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {rows.map((row, index) => {
          const x = rows.length === 1 ? 50 : (index / (rows.length - 1)) * 100;
          const y = 100 - ((row.value - min) / range) * 82 - 9;
          return <circle key={`${row.label}-${index}`} cx={x} cy={y} r="2.4" fill="#0f766e" />;
        })}
      </svg>
      <div className="mt-2 flex justify-between gap-2 text-[11px] font-semibold text-slate-500">
        <span className="truncate">{rows[0]?.label}</span>
        <span>{formatValue(max, valueType)}</span>
        <span className="truncate text-right">{rows[rows.length - 1]?.label}</span>
      </div>
    </div>
  );
}

function DonutChart({ rows, valueType }) {
  if (!rows.length) return <EmptyChart message="Sin distribucion disponible." />;
  const distributionRows = rows.slice(0, 12);
  const total = distributionRows.reduce((sum, row) => sum + Math.max(row.value, 0), 0);
  if (!total) return <EmptyChart message="Los valores estan en cero." />;

  let offset = 0;
  const segments = distributionRows
    .map((row, index) => {
      const start = offset;
      const end = start + (Math.max(row.value, 0) / total) * 100;
      offset = end;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div className="grid gap-5 2xl:grid-cols-[190px_minmax(0,1fr)] 2xl:items-start">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div
          className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2.25rem] shadow-inner"
          style={{ background: `conic-gradient(${segments})` }}
        >
          <div className="flex h-24 w-24 flex-col items-center justify-center rounded-3xl bg-white text-center shadow-sm">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total</span>
            <span className="max-w-20 break-words text-sm font-black leading-tight text-slate-900">{formatValue(total, valueType)}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        {distributionRows.map((row, index) => {
          const color = CHART_COLORS[index % CHART_COLORS.length];
          return (
            <div key={`${row.label}-${index}`} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <span className="flex min-w-0 items-start gap-2 text-xs font-bold leading-snug text-slate-700">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="break-words">{row.label}</span>
                </span>
                <span className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-900">{formatPercent(row.value, total)}</span>
              </div>
              <div className="mb-2 text-xs font-semibold text-slate-500">{formatValue(row.value, valueType)}</div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, (row.value / total) * 100)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChartShell({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-950">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <ChartBarIcon className="h-4 w-4" />
        </span>
      </div>
      {children}
    </section>
  );
}

function DashboardPreview({ selectedReport, activeCategory, onGenerate }) {
  const meta = CATEGORY_META[activeCategory] || CATEGORY_META.Ventas;
  const Icon = meta.icon;
  const previewBars = [
    { label: "Ventas", value: 86 },
    { label: "Inventario", value: 64 },
    { label: "Clientes", value: 42 },
    { label: "Recetas", value: 30 },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${meta.tone}`}>
              <Icon className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Vista previa</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">{selectedReport?.label || "Selecciona un reporte"}</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-500">
                El dashboard se genera con metricas, graficos, distribucion, estadisticas y tabla exportable.
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} disabled={!selectedReport}>
            Generar dashboard
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Ingresos" value="Bs 0.00" detail="Se calcula al generar" tone="success" />
        <MetricCard label="Registros" value="0" detail="Segun filtros" tone="info" />
        <MetricCard label="Promedio" value="-" detail="Analisis automatico" />
        <MetricCard label="Alertas" value="-" detail="Stock, fallos o vencidos" tone="warning" />
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
        <ChartShell title="Grafico principal" subtitle="Aqui aparecera la tendencia o comparacion principal.">
          <BarChart rows={previewBars} compact />
        </ChartShell>
        <ChartShell title="Distribucion" subtitle="Participacion de los grupos principales.">
          <DonutChart rows={previewBars} />
        </ChartShell>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Detalle exportable</h3>
            <p className="text-xs text-slate-500">Los datos apareceran aqui despues de generar.</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Indicador</th>
                <th className="px-4 py-3">Resultado</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-500">
              <tr>
                <td className="px-4 py-4">Reporte seleccionado</td>
                <td className="px-4 py-4">{selectedReport?.label || "-"}</td>
                <td className="px-4 py-4">Pendiente</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ResultsDashboard({ result, tableSearch, setTableSearch, onCsv, onPdf }) {
  const rows = Array.isArray(result?.filas) ? result.filas : [];
  const columns = result?.columnas || [];
  const stats = buildStats(result);
  const chartRows = buildChartRows(result, 12);
  const valueType = stats.valueColumn?.type;
  const tableRows = useMemo(() => {
    const search = tableSearch.trim().toLowerCase();
    if (!search) return rows;
    return rows.filter((row) =>
      columns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(search))
    );
  }, [columns, rows, tableSearch]);
  const metricCards = (result?.metricas || []).slice(0, 4);
  const topItem = chartRows[0];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-700">{result.periodo || "Reporte"}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">{result.titulo}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Generado: {safeDate(result.generado_en)}
              {topItem ? ` | Principal: ${topItem.label}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onCsv} disabled={!rows.length}>
              CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onPdf("portrait")}>
              PDF vertical
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onPdf("landscape")}>
              PDF horizontal
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={formatValue(metric.value, metric.label.toLowerCase().includes("bs") ? "currency" : undefined)}
            detail="Backend"
            tone={metric.tone || "neutral"}
          />
        ))}
        <MetricCard label="Registros" value={formatValue(stats.rowsCount, "number")} detail={`${stats.columnsCount} columnas`} tone="info" />
        {stats.valueColumn ? (
          <MetricCard
            label={`Total ${stats.valueColumn.label}`}
            value={formatValue(stats.total, stats.valueColumn.type)}
            detail={`Promedio ${formatValue(stats.avg, stats.valueColumn.type)}`}
            tone="success"
          />
        ) : null}
      </section>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.85fr)]">
        <ChartShell
          title={result?.grafico?.tipo === "line" ? "Tendencia principal" : "Comparacion principal"}
          subtitle="Valores relevantes segun el reporte generado."
        >
          {result?.grafico?.tipo === "line" ? (
            <LineChart rows={chartRows} valueType={valueType} />
          ) : (
            <BarChart rows={chartRows} valueType={valueType} />
          )}
        </ChartShell>

        <ChartShell title="Distribucion" subtitle="Participacion de los principales registros.">
          <DonutChart rows={chartRows} valueType={valueType} />
        </ChartShell>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Promedio" value={formatValue(stats.avg, valueType)} detail={stats.valueColumn?.label || "Sin columna numerica"} />
        <MetricCard label="Maximo" value={formatValue(stats.max, valueType)} detail="Mayor valor" tone="success" />
        <MetricCard label="Minimo" value={formatValue(stats.min, valueType)} detail="Menor valor" tone="warning" />
        <MetricCard label="Columnas numericas" value={formatValue(stats.numericColumns.length, "number")} detail="Analizables" tone="info" />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Datos del reporte</h3>
            <p className="text-xs text-slate-500">Tabla filtrable y exportable.</p>
          </div>
          <div className="w-full sm:w-80">
            <Input value={tableSearch} onChange={(event) => setTableSearch(event.target.value)} placeholder="Buscar en tabla" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="max-h-[440px] overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  {columns.map((column) => (
                    <th key={column.key} className="whitespace-nowrap px-4 py-3">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {tableRows.length ? (
                  tableRows.map((row, index) => (
                    <tr key={index} className="transition hover:bg-slate-50">
                      {columns.map((column) => (
                        <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatValue(row[column.key], column.type)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
                      No hay resultados para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function AdminReportesPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [selectedType, setSelectedType] = useState("");
  const [activeCategory, setActiveCategory] = useState("Ventas");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [result, setResult] = useState(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [error, setError] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiInfo, setAiInfo] = useState("");
  const [recording, setRecording] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const reportTypes = catalog?.reportes || [];
  const reportsByCategory = useMemo(() => groupedReports(reportTypes), [reportTypes]);
  const categories = useMemo(() => Object.keys(reportsByCategory), [reportsByCategory]);
  const filterDefinitions = useMemo(() => {
    return Object.fromEntries((catalog?.filtros || []).map((item) => [item.id, item]));
  }, [catalog]);
  const selectedReport = useMemo(
    () => reportTypes.find((item) => item.id === selectedType) || null,
    [reportTypes, selectedType]
  );
  const visibleFilters = useMemo(() => {
    if (!selectedReport) return [];
    const unique = [...new Set(selectedReport.filtros || [])];
    return unique.map((id) => filterDefinitions[id]).filter(Boolean);
  }, [filterDefinitions, selectedReport]);

  useEffect(() => {
    let mounted = true;
    setLoadingCatalog(true);
    reportesService
      .catalogo()
      .then((data) => {
        if (!mounted) return;
        const defaultType = data?.defaults?.tipo_reporte || data?.reportes?.[0]?.id || "";
        const defaultReport = data?.reportes?.find((report) => report.id === defaultType) || data?.reportes?.[0];
        const defaultFilters = { ...EMPTY_FILTERS, ...(data?.defaults?.filtros || {}) };
        setCatalog(data);
        setSelectedType(defaultType);
        setActiveCategory(defaultReport?.categoria || "Ventas");
        setFilters(defaultFilters);
        setLoadingReport(true);
        return reportesService
          .generar({ tipo_reporte: defaultType, filtros: cleanFilters(defaultFilters) })
          .then((reportData) => {
            if (mounted) setResult(reportData);
          })
          .catch(() => {
            if (mounted) setResult(null);
          })
          .finally(() => {
            if (mounted) setLoadingReport(false);
          });
      })
      .catch((err) => setError(err?.detail || "No se pudo cargar el catalogo de reportes."))
      .finally(() => mounted && setLoadingCatalog(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearTimeout(recordingTimerRef.current);
      if (recorderRef.current?.state && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const updateFilter = (id, value) => {
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  const selectReport = (report) => {
    setSelectedType(report.id);
    setActiveCategory(report.categoria);
    setResult(null);
    setTableSearch("");
  };

  const generarReporte = async (override) => {
    const tipo = override?.tipo_reporte || selectedType;
    const filtros = cleanFilters(override?.filtros || filters);
    if (!tipo) return;

    try {
      setLoadingReport(true);
      setError("");
      const data = await reportesService.generar({ tipo_reporte: tipo, filtros });
      const catalogReport = reportTypes.find((item) => item.id === (data.tipo_reporte || tipo));
      setResult(data);
      setSelectedType(data.tipo_reporte || tipo);
      setActiveCategory(catalogReport?.categoria || activeCategory);
      setTableSearch("");
      setAiInfo("");
    } catch (err) {
      setError(err?.detail || "No se pudo generar el reporte.");
    } finally {
      setLoadingReport(false);
    }
  };

  const generarDesdeTexto = async () => {
    if (!aiText.trim()) {
      setError("Escribe una solicitud para generar un reporte.");
      return;
    }

    try {
      setLoadingReport(true);
      setError("");
      const data = await reportesService.interpretarTexto(aiText.trim());
      const report = data.reporte;
      const catalogReport = reportTypes.find((item) => item.id === report.tipo_reporte);
      setResult(report);
      setSelectedType(report.tipo_reporte);
      setActiveCategory(catalogReport?.categoria || activeCategory);
      setFilters({ ...EMPTY_FILTERS, ...(report.filtros_aplicados || {}) });
      setTableSearch("");
      setAiInfo(`Solicitud interpretada: ${data.interpretacion?.mensaje || data.texto}`);
    } catch (err) {
      setError(err?.detail || "No se pudo interpretar la solicitud con IA.");
    } finally {
      setLoadingReport(false);
    }
  };

  const enviarAudio = async (blob) => {
    try {
      setAudioLoading(true);
      setError("");
      setAiInfo("Transcribiendo audio y generando reporte...");
      const data = await reportesService.interpretarAudio(blob);
      const report = data.reporte;
      const catalogReport = reportTypes.find((item) => item.id === report.tipo_reporte);
      setResult(report);
      setSelectedType(report.tipo_reporte);
      setActiveCategory(catalogReport?.categoria || activeCategory);
      setFilters({ ...EMPTY_FILTERS, ...(report.filtros_aplicados || {}) });
      setAiText(data.transcripcion || data.texto || "");
      setTableSearch("");
      setAiInfo(`Audio transcrito: ${data.transcripcion || data.texto}`);
    } catch (err) {
      setError(err?.detail || "No se pudo generar el reporte desde el audio.");
    } finally {
      setAudioLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Tu navegador no soporta grabacion de audio.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorderOptions = {
        audioBitsPerSecond: 24000,
        ...(mimeType ? { mimeType } : {}),
      };
      const recorder = new MediaRecorder(stream, recorderOptions);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current) {
          window.clearTimeout(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) enviarAudio(blob);
      };
      recorder.start(1000);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state !== "inactive") {
          recorder.stop();
          setRecording(false);
        }
      }, MAX_AUDIO_RECORDING_MS);
      setRecording(true);
    } catch {
      setError("No se pudo acceder al microfono.");
      setRecording(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const columns = result.columnas || [];
    const delimiter = ";";
    const filters = Object.entries(result.filtros_aplicados || {}).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined
    );
    const metrics = result.metricas || [];
    const dataRows = result.filas || [];
    const lines = [
      "sep=;",
      [csvCell("Farmacia SaludPlus"), csvCell("Modulo Reportes")].join(delimiter),
      [csvCell("Reporte"), csvCell(result.titulo || "Reporte")].join(delimiter),
      [csvCell("Periodo"), csvCell(result.periodo || "Sin periodo")].join(delimiter),
      [csvCell("Generado"), csvCell(safeDate(result.generado_en))].join(delimiter),
      "",
      [csvCell("Metricas")].join(delimiter),
      [csvCell("Indicador"), csvCell("Valor")].join(delimiter),
      ...metrics.map((metric) =>
        [
          csvCell(metric.label),
          csvCell(formatValue(metric.value, metric.label.toLowerCase().includes("bs") ? "currency" : undefined)),
        ].join(delimiter)
      ),
      "",
      [csvCell("Filtros aplicados")].join(delimiter),
      [csvCell("Filtro"), csvCell("Valor")].join(delimiter),
      ...(filters.length ? filters : [["Sin filtros adicionales", ""]]).map(([key, value]) =>
        [csvCell(key), csvCell(value)].join(delimiter)
      ),
      "",
      [csvCell("Datos del reporte")].join(delimiter),
      columns.map((column) => csvCell(column.label)).join(delimiter),
      ...dataRows.map((row) => columns.map((column) => csvCell(formatValue(row[column.key], column.type))).join(delimiter)),
    ];
    const content = `\ufeff${lines.join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.tipo_reporte || "reporte"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = (orientation = "landscape") => {
    if (!result) return;
    const columns = result.columnas || [];
    const rows = result.filas || [];
    const stats = buildStats(result);
    const chartRows = buildChartRows(result, 12);
    const valueType = stats.valueColumn?.type;
    const isPortrait = orientation === "portrait";
    const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = isPortrait ? 10 : 12;
    const headerHeight = isPortrait ? 48 : 42;
    const contentWidth = pageWidth - margin * 2;

    setPdfFill(doc, "#0f172a");
    doc.rect(0, 0, pageWidth, headerHeight, "F");
    setPdfFill(doc, "#0f766e");
    doc.rect(0, headerHeight - 7, pageWidth, 7, "F");
    setPdfText(doc, "#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("FARMACIA SALUDPLUS", margin, 12);
    doc.setFontSize(isPortrait ? 18 : 22);
    doc.text(doc.splitTextToSize(result.titulo || "Reporte", isPortrait ? 118 : 170), margin, 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Periodo: ${result.periodo || "Sin periodo"}`, margin, headerHeight - 12);
    const summaryWidth = isPortrait ? 60 : 76;
    const summaryX = pageWidth - margin - summaryWidth;
    setPdfFill(doc, "#0e7490");
    doc.roundedRect(summaryX, 9, summaryWidth, isPortrait ? 29 : 26, 4, 4, "F");
    setPdfText(doc, "#cffafe");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text("REPORTE OPERATIVO", summaryX + 5, 17);
    setPdfText(doc, "#ffffff");
    doc.setFontSize(13);
    doc.text(formatValue(stats.rowsCount, "number"), summaryX + 5, 27);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("registros exportados", summaryX + 5, isPortrait ? 34 : 33);

    const filterPairs = Object.entries(result.filtros_aplicados || {})
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${value}`);
    const filtersText = filterPairs.length ? filterPairs.join("  |  ") : "Sin filtros adicionales";

    let cursorY = headerHeight + 7;
    setPdfFill(doc, "#f8fafc");
    doc.roundedRect(margin, cursorY, contentWidth, isPortrait ? 22 : 17, 4, 4, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, isPortrait ? 22 : 17, 4, 4, "S");
    setPdfText(doc, "#475569");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(`Generado: ${safeDate(result.generado_en)}   |   Filtros: ${filtersText}`, contentWidth - 8), margin + 4, cursorY + 7);
    cursorY += isPortrait ? 28 : 23;

    const metricItems = [
      ...(result.metricas || []).slice(0, 4).map((metric) => ({
        label: metric.label,
        value: formatValue(metric.value, metric.label.toLowerCase().includes("bs") ? "currency" : undefined),
      })),
      { label: "Registros", value: formatValue(stats.rowsCount, "number") },
    ].slice(0, 5);

    const gap = 4;
    const metricColumns = isPortrait ? 2 : 5;
    const cardHeight = isPortrait ? 22 : 23;
    const cardWidth = (contentWidth - gap * (metricColumns - 1)) / metricColumns;
    metricItems.forEach((metric, index) => {
      const row = Math.floor(index / metricColumns);
      const col = index % metricColumns;
      const x = margin + col * (cardWidth + gap);
      const y = cursorY + row * (cardHeight + gap);
      setPdfFill(doc, index === 2 ? "#ecfdf5" : index === 4 ? "#ecfeff" : "#ffffff");
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "F");
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "S");
      setPdfText(doc, "#64748b");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.text(String(metric.label).toUpperCase().slice(0, 24), x + 4, y + 7);
      setPdfText(doc, "#0f172a");
      doc.setFontSize(isPortrait ? 11 : 13);
      doc.text(String(metric.value).slice(0, 24), x + 4, y + 17);
    });
    cursorY += Math.ceil(metricItems.length / metricColumns) * (cardHeight + gap) + 4;

    const mainChartImage =
      result?.grafico?.tipo === "line"
        ? createLineChartImage(chartRows, valueType)
        : createBarChartImage(chartRows, valueType, result?.grafico?.tipo === "line" ? "Tendencia principal" : "Grafico principal");
    const distributionImage = createDonutChartImage(chartRows, valueType);

    const chartHeight = isPortrait ? 58 : 66;
    setPdfFill(doc, "#ffffff");
    doc.roundedRect(margin, cursorY, contentWidth, chartHeight, 4, 4, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, chartHeight, 4, 4, "S");
    doc.addImage(mainChartImage, "PNG", margin + 2, cursorY + 3, contentWidth - 4, chartHeight - 6);
    cursorY += chartHeight + 6;

    const distributionHeight = isPortrait ? 92 : 88;
    setPdfFill(doc, "#ffffff");
    doc.roundedRect(margin, cursorY, contentWidth, distributionHeight, 4, 4, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, cursorY, contentWidth, distributionHeight, 4, 4, "S");
    doc.addImage(distributionImage, "PNG", margin + 2, cursorY + 3, contentWidth - 4, distributionHeight - 6);
    cursorY += distributionHeight + 8;

    if (cursorY > pageHeight - 55) {
      doc.addPage();
      cursorY = margin;
    }

    if (columns.length) {
      autoTable(doc, {
        startY: cursorY,
        head: [columns.map((column) => column.label)],
        body: rows.map((row) => columns.map((column) => formatValue(row[column.key], column.type))),
        theme: "grid",
        styles: {
          fontSize: isPortrait ? 6.5 : 7.3,
          cellPadding: isPortrait ? 1.8 : 2.2,
          lineColor: [226, 232, 240],
          lineWidth: 0.2,
          textColor: [51, 65, 85],
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [15, 118, 110],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin },
        didDrawPage: () => {
          setPdfText(doc, "#94a3b8");
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.text("Farmacia SaludPlus - Reporte generado desde el modulo Reportes", margin, pageHeight - 7);
        },
      });
    } else {
      setPdfText(doc, "#64748b");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Este reporte no contiene tabla de detalle; revise las metricas superiores.", margin, cursorY + 8);
    }

    const totalPages = doc.internal.getNumberOfPages();
    for (let page = 1; page <= totalPages; page += 1) {
      doc.setPage(page);
      setPdfText(doc, "#94a3b8");
      doc.setFontSize(7);
      doc.text(`Pagina ${page} de ${totalPages}`, pageWidth - margin - 22, pageHeight - 7);
    }

    const filename = String(result.tipo_reporte || "reporte").replace(/[^a-z0-9_-]/gi, "_");
    doc.save(`${filename}_${isPortrait ? "vertical" : "horizontal"}.pdf`);
  };

  return (
    <AdminLayout activeSection="reports" currentUser={user} onLogout={handleLogout}>
      <div className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-700">Modulo reportes</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Dashboard de reportes</h1>
              <p className="mt-1 text-sm text-slate-500">
                Elige un reporte, ajusta filtros y visualiza metricas, graficos y datos exportables.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportCsv} disabled={!result?.filas?.length}>
                CSV
              </Button>
              <Button variant="secondary" onClick={() => exportPdf("portrait")} disabled={!result}>
                PDF vertical
              </Button>
              <Button variant="secondary" onClick={() => exportPdf("landscape")} disabled={!result}>
                PDF horizontal
              </Button>
              <Button onClick={() => generarReporte()} disabled={loadingReport || !selectedType}>
                {loadingReport ? "Generando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </section>

        {error ? (
          <Alert tone="danger">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {aiInfo ? (
          <Alert tone="info">
            <AlertDescription>{aiInfo}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <ReportControlPanel
            catalog={catalog}
            categories={categories}
            reportsByCategory={reportsByCategory}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            selectedType={selectedType}
            selectedReport={selectedReport}
            onSelectReport={selectReport}
            filters={filters}
            visibleFilters={visibleFilters}
            updateFilter={updateFilter}
            onGenerate={() => generarReporte()}
            onClear={() => setFilters(EMPTY_FILTERS)}
            loadingReport={loadingReport}
            loadingCatalog={loadingCatalog}
          />

          <main className="min-w-0 space-y-4">
            <AiCommandBar
              aiText={aiText}
              setAiText={setAiText}
              onText={generarDesdeTexto}
              onAudio={toggleRecording}
              recording={recording}
              loadingReport={loadingReport}
              audioLoading={audioLoading}
            />

            {result ? (
              <ResultsDashboard
                result={result}
                tableSearch={tableSearch}
                setTableSearch={setTableSearch}
                onCsv={exportCsv}
                onPdf={exportPdf}
              />
            ) : (
              <DashboardPreview
                selectedReport={selectedReport}
                activeCategory={activeCategory}
                onGenerate={() => generarReporte()}
              />
            )}
          </main>
        </section>
      </div>
    </AdminLayout>
  );
}
