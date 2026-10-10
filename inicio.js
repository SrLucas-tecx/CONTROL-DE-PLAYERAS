/* ============================================================
   LUCXSTUDIO — inicio.js  (Rediseño · Sprint 4)
   Panel de inicio: 4 números del mes, accesos rápidos y lista de
   "Requiere atención". Cada número abre un pop-up con el desglose.
   Solo lee datos (AppState); no modifica nada.
   ============================================================ */
import { AppState } from "./storage.js";
import { ETAPAS_PRODUCCION } from "./config.js";
import { fmt, escapeHtml, semaforoCotizacion } from "./calculator.js";

const $ = id => document.getElementById(id);

/* ---------------------------------------------------------------
   FECHAS (todo en hora local para que el mes no "cambie" de noche)
--------------------------------------------------------------- */
function hoyLocal() { return new Date().toLocaleDateString("sv-SE"); }          // YYYY-MM-DD
function mesLocal(offset) {                                                      // YYYY-MM
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + (offset || 0));
  return d.toLocaleDateString("sv-SE").slice(0, 7);
}
const enMes = (fecha, ym) => (fecha || "").startsWith(ym);

/* ---------------------------------------------------------------
   CÁLCULOS DEL PANEL
--------------------------------------------------------------- */
function calcular() {
  const ym = mesLocal(0), ymAnt = mesLocal(-1);
  const cotsValidas = AppState.cotizaciones.filter(c => !c.ventaNula);
  const delMes = cotsValidas.filter(c => enMes(c.fecha, ym));
  const delMesAnt = cotsValidas.filter(c => enMes(c.fecha, ymAnt));

  const vendido = delMes.reduce((s, c) => s + (c.totalVenta || 0), 0);
  const vendidoAnt = delMesAnt.reduce((s, c) => s + (c.totalVenta || 0), 0);
  const menudeo = delMes.filter(c => c.tipoVenta !== "Mayoreo").reduce((s, c) => s + (c.totalVenta || 0), 0);
  const mayoreo = vendido - menudeo;
  const tarjeta = delMes.reduce((s, c) => s + (c.montoTarjeta || 0), 0);
  const efectivo = Math.max(0, vendido - tarjeta);
  const porCobrar = cotsValidas
    .filter(c => (c.anticipo || 0) > 0 && c.estado !== "Pagado")
    .reduce((s, c) => s + Math.max(0, (c.totalVenta || 0) - (c.anticipo || 0)), 0);

  const gananciaCots = delMes.reduce((s, c) => s + (c.ganancia || 0), 0);
  const mermas = AppState.mermas.filter(m => enMes(m.fecha, ym)).reduce((s, m) => s + (m.costoTotal || 0), 0);
  const gastos = AppState.gastos.filter(g => enMes(g.fecha, ym)).reduce((s, g) => s + (g.monto || 0), 0);
  const gananciaNeta = gananciaCots - mermas;

  const pendientes = cotsValidas
    .filter(c => (c.estadoProduccion || "Por hacer") !== "Entregado")
    .map(c => ({ c, sem: semaforoCotizacion(c) }));
  const atrasados = pendientes.filter(x => x.sem.color === "red");

  const playerasBajas = AppState.playeras.filter(p => (p.stockMinimo || 0) > 0 && (p.stock || 0) <= p.stockMinimo);
  const stickersBajos = AppState.stickers.filter(s => (s.stockMinimo || 0) > 0 && (s.stock || 0) <= s.stockMinimo);

  return {
    ym, delMes, vendido, vendidoAnt, menudeo, mayoreo, efectivo, tarjeta, porCobrar,
    gananciaCots, mermas, gastos, gananciaNeta,
    pendientes, atrasados, playerasBajas, stickersBajos
  };
}

/* ---------------------------------------------------------------
   RENDER DEL PANEL
--------------------------------------------------------------- */
function renderInicio() {
  if (!$("page-inicio")) return;
  const d = calcular();
  const mesTxt = new Date().toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  $("home-titulo").textContent = "Resumen del mes";
  $("home-fecha").textContent = mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1);

  $("kpi-vendido").textContent = fmt(d.vendido);
  $("kpi-vendido-sub").textContent = `${d.delMes.length} cotización(es)`;

  $("kpi-ganancia").textContent = fmt(d.gananciaNeta);
  $("kpi-ganancia").style.color = d.gananciaNeta < 0 ? "var(--color-danger)" : "";
  $("kpi-ganancia-sub").textContent = d.mermas ? `incluye ${fmt(d.mermas)} de mermas` : "cotizaciones del mes";

  $("kpi-pendientes").textContent = String(d.pendientes.length);
  $("kpi-pendientes-sub").textContent = d.atrasados.length ? `🔴 ${d.atrasados.length} urgente(s) o atrasado(s)` : "todo a tiempo";

  const totalBajo = d.playerasBajas.length + d.stickersBajos.length;
  $("kpi-stock").textContent = String(totalBajo);
  $("kpi-stock-sub").textContent = totalBajo ? `${d.playerasBajas.length} playera(s) · ${d.stickersBajos.length} sticker(s)` : "inventario al día";

  // Lista "Requiere atención": pedidos atrasados/urgentes y productos con stock bajo
  const filas = [];
  d.atrasados.slice(0, 5).forEach(({ c, sem }) => {
    filas.push(`<button type="button" class="home-row" onclick="viewCotizacion('${c.id}')">
      <span>🔴 ${escapeHtml(c.folio || "")} · ${escapeHtml(c.cliente || "Cliente sin nombre")}</span>
      <span class="home-row-tag">${escapeHtml(sem.label)} · ${escapeHtml(c.estadoProduccion || "Por hacer")}</span></button>`);
  });
  d.playerasBajas.slice(0, 3).forEach(p => {
    filas.push(`<button type="button" class="home-row" onclick="openModalPlayera('${p.id}')">
      <span>⚠️ ${escapeHtml(p.nombre)} · ${escapeHtml(p.talla) || "—"}</span>
      <span class="home-row-tag">${p.stock || 0} pza (mín. ${p.stockMinimo})</span></button>`);
  });
  d.stickersBajos.slice(0, 2).forEach(s => {
    filas.push(`<button type="button" class="home-row" onclick="openModalSticker('${s.id}')">
      <span>⚠️ ✂️ ${escapeHtml(s.nombre)}</span>
      <span class="home-row-tag">${s.stock || 0} pza (mín. ${s.stockMinimo})</span></button>`);
  });
  $("home-atencion").innerHTML = filas.join("") || `<p class="empty-hint">Todo al día 🎉 No hay pedidos atrasados ni stock bajo.</p>`;
}

/* ---------------------------------------------------------------
   POP-UPS DE CADA NÚMERO
--------------------------------------------------------------- */
function detalleVendido() {
  const d = calcular();
  let comparacion = ["Mes anterior", fmt(d.vendidoAnt)];
  const filas = [
    ["Total vendido", fmt(d.vendido), "accent"],
    ["Cotizaciones", String(d.delMes.length)],
    ["Menudeo", fmt(d.menudeo)],
    ["Mayoreo", fmt(d.mayoreo)]
  ];
  const cobro = [["En efectivo", fmt(d.efectivo)], ["Con tarjeta", fmt(d.tarjeta)]];
  if (d.porCobrar > 0) cobro.push(["Saldos por cobrar (anticipos)", fmt(d.porCobrar), "bad"]);
  const comp = [comparacion];
  if (d.vendidoAnt > 0) {
    const pct = Math.round(((d.vendido - d.vendidoAnt) / d.vendidoAnt) * 100);
    comp.push(["Cambio contra el mes anterior", `${pct >= 0 ? "+" : ""}${pct}%`, pct >= 0 ? "good" : "bad"]);
  }
  window.openQuickDetail({
    icon: "💰", title: "Vendido este mes", subtitle: "Sin contar ventas nulas",
    sections: [{ title: "Este mes", rows: filas }, { title: "Cómo se cobró", rows: cobro }, { title: "Comparación", rows: comp }],
    actions: [
      { label: "Ver cotizaciones", variant: "primary", onClick: () => window.switchPage("cotizaciones") },
      { label: "Cerrar" }
    ]
  });
}
function detalleGanancia() {
  const d = calcular();
  window.openQuickDetail({
    icon: "📈", title: "Ganancia del mes", subtitle: "Cotizaciones guardadas del mes en curso",
    sections: [
      { title: "Cálculo", rows: [
        ["Ganancia de cotizaciones", fmt(d.gananciaCots)],
        ["Mermas del mes", "− " + fmt(d.mermas), d.mermas ? "bad" : ""],
        ["Ganancia neta", fmt(d.gananciaNeta), d.gananciaNeta >= 0 ? "good" : "bad"]
      ] },
      { title: "Solo referencia", rows: [["Gastos generales del mes", fmt(d.gastos)]],
        text: "Los gastos generales no se restan aquí para no contar dos veces el material y el DTF que ya están en el costo de cada cotización." }
    ],
    actions: [
      { label: "Ver estadísticas", variant: "primary", onClick: () => window.switchPage("estadisticas") },
      { label: "Ver gastos", onClick: () => window.switchPage("gastos") }
    ]
  });
}
function detalleProduccion() {
  const d = calcular();
  const porEtapa = ETAPAS_PRODUCCION.filter(e => e !== "Entregado").map(e => [
    e, String(d.pendientes.filter(x => (x.c.estadoProduccion || "Por hacer") === e).length)
  ]);
  const urgentes = d.pendientes
    .filter(x => x.sem.color !== "green")
    .sort((a, b) => (a.sem.color === "red" ? 0 : 1) - (b.sem.color === "red" ? 0 : 1))
    .slice(0, 6)
    .map(({ c, sem }) => [`${sem.color === "red" ? "🔴" : "🟡"} ${c.folio || ""} · ${c.cliente || "Cliente sin nombre"}`, `${sem.label} · ${c.estadoProduccion || "Por hacer"}`, sem.color === "red" ? "bad" : ""]);
  const secciones = [{ title: "Por etapa", rows: porEtapa }];
  if (urgentes.length) secciones.push({ title: "Lo más urgente", rows: urgentes });
  window.openQuickDetail({
    icon: "🚦", title: "Pedidos pendientes", subtitle: `${d.pendientes.length} sin entregar`,
    sections: secciones,
    actions: [
      { label: "Ir al Kanban", variant: "primary", onClick: () => window.switchPage("produccion") },
      { label: "Cerrar" }
    ]
  });
}
function detalleStock() {
  const d = calcular();
  const playeras = d.playerasBajas.map(p => [`👕 ${p.nombre} · ${p.talla || "—"}`, `${p.stock || 0} de mín. ${p.stockMinimo}`, "bad"]);
  const stickers = d.stickersBajos.map(s => [`✂️ ${s.nombre}`, `${s.stock || 0} de mín. ${s.stockMinimo}`, "bad"]);
  const secciones = [];
  if (playeras.length) secciones.push({ title: "Playeras", rows: playeras });
  if (stickers.length) secciones.push({ title: "Stickers", rows: stickers });
  if (!secciones.length) secciones.push({ title: "Todo en orden", text: "Ningún producto está en su stock mínimo. Define el mínimo de cada producto al editarlo." });
  window.openQuickDetail({
    icon: "📦", title: "Stock bajo", subtitle: "Productos en su mínimo o por debajo",
    sections: secciones,
    actions: [
      { label: "Ir a Playeras", variant: "primary", onClick: () => window.switchPage("playeras") },
      { label: "Ir a Stickers", onClick: () => window.switchPage("stickers") }
    ]
  });
}
const DETALLES = { vendido: detalleVendido, ganancia: detalleGanancia, pendientes: detalleProduccion, stock: detalleStock };

/* ---------------------------------------------------------------
   RESUMEN DEL DÍA (pop-up una vez al día, solo si hay algo urgente)
--------------------------------------------------------------- */
const DIA_KEY = "LUCXSTUDIO_RESUMEN_DIA";
function resumenDelDia() {
  try { if (localStorage.getItem(DIA_KEY) === hoyLocal()) return; } catch (e) { return; }
  if (document.querySelector(".modal-overlay.open")) return; // no pisar otra ventana
  const d = calcular();
  const nPedidos = d.atrasados.length;
  const nStock = d.playerasBajas.length + d.stickersBajos.length;
  if (!nPedidos && !nStock) return;
  const rows = [];
  if (nPedidos) rows.push(["Pedidos urgentes o atrasados", String(nPedidos), "bad"]);
  if (nStock) rows.push(["Productos con stock bajo", String(nStock), "bad"]);
  const acciones = [];
  if (nPedidos) acciones.push({ label: "Ver pedidos", variant: "primary", onClick: () => window.switchPage("produccion") });
  if (nStock) acciones.push({ label: "Ver stock", onClick: () => window.switchPage("playeras") });
  acciones.push({ label: "Después" });
  window.openQuickDetail({
    icon: "☀️", title: "Resumen del día", subtitle: "Esto necesita atención hoy",
    sections: [{ rows }], actions: acciones
  });
  try { localStorage.setItem(DIA_KEY, hoyLocal()); } catch (e) { /* sin almacenamiento */ }
}

/* ---------------------------------------------------------------
   INICIO
--------------------------------------------------------------- */
function iniciar() {
  document.querySelectorAll("#page-inicio .kpi-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const fn = DETALLES[btn.dataset.kpi];
      if (fn && typeof window.openQuickDetail === "function") fn();
    });
  });
  // El tip de bienvenida del menú (nav.js) sale a los ~0.7 s; el resumen del día espera más.
  setTimeout(resumenDelDia, 2200);
}
iniciar();

Object.assign(window, { renderInicio });
