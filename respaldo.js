/* ============================================================
   LUCXSTUDIO — respaldo.js
   1) Respaldo completo con datos de contexto (dispositivo, fecha)
   2) Importar con vista previa: COMBINAR (agrega lo que falte y
      ajusta el stock) o REEMPLAZAR todo, siempre con copia anterior
   3) Enviar el respaldo a otro dispositivo (compartir / descargar)
   4) Descargar la caja en Excel (o CSV si no carga el generador)
   Pensado para: respaldo de la PC → celular → vender en el bazar
   → regresar el respaldo a la PC y ver todo lo que pasó.
   ============================================================ */
import { AppState, saveState, importData } from "./storage.js";
import { showToast } from "./ui.js";
import { fmt, bazarIdsDe, desgloseCierreBazar, desgloseCierreCajaGeneral, colorNombre } from "./calculator.js";

const $ = id => document.getElementById(id);
const K_ULTIMO = "LUCXSTUDIO_ULTIMO_RESPALDO";
const K_DISP = "LUCXSTUDIO_DISPOSITIVO";
const K_SNAP = "LUCXSTUDIO_COPIA_ANTERIOR";
const K_AVISO = "LUCXSTUDIO_AVISO_RESPALDO";
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
};

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
const hoyLocal = () => new Date().toLocaleDateString("sv-SE");
const horaLocal = () => new Date().toTimeString().slice(0, 5).replace(":", "");
const slug = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function nombreDispositivo() {
  const guardado = ls.get(K_DISP);
  if (guardado) return guardado;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? "Celular" : "Computadora";
}
function fechaLegible(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}
function diasDesde(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000);
}
function haceCuanto(iso) {
  const d = diasDesde(iso);
  if (d === null) return "nunca";
  if (d <= 0) return "hoy";
  if (d === 1) return "ayer";
  return `hace ${d} días`;
}
function descargarBlob(blob, nombre) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const COLECCIONES = [
  ["cotizaciones", "Cotizaciones"], ["playeras", "Playeras (incluye vendidas)"], ["stickers", "Stickers"],
  ["ventasStickers", "Ventas de stickers"], ["clientes", "Clientes"], ["bazares", "Bazares"],
  ["gastos", "Gastos"], ["mermas", "Mermas"], ["consignaciones", "Consignaciones"],
  ["comprasPendientes", "Compras pendientes"], ["consultas", "Consultas de interés"]
];
const conteo = (estado, k) => (estado && Array.isArray(estado[k]) ? estado[k].length : 0);

/* ---------------------------------------------------------------
   RESPALDO COMPLETO
--------------------------------------------------------------- */
function construirRespaldo() {
  const resumen = {};
  COLECCIONES.forEach(([k]) => { resumen[k] = conteo(AppState, k); });
  return {
    app: "LUCXSTUDIO", tipo: "respaldo-completo", version: 2,
    exportadoEn: new Date().toISOString(), dispositivo: nombreDispositivo(),
    ultimaModificacion: AppState.ultimaModificacion || null, resumen, datos: AppState
  };
}
function archivoRespaldo() {
  const nombre = `lucxstudio_respaldo_${slug(nombreDispositivo()) || "dispositivo"}_${hoyLocal()}_${horaLocal()}.json`;
  return { nombre, blob: new Blob([JSON.stringify(construirRespaldo())], { type: "application/json" }) };
}
function marcarRespaldo() {
  ls.set(K_ULTIMO, new Date().toISOString());
  renderEstado();
}
function descargarRespaldoCompleto() {
  const { nombre, blob } = archivoRespaldo();
  descargarBlob(blob, nombre);
  marcarRespaldo();
  showToast("Respaldo descargado.");
}
async function compartirRespaldo() {
  const { nombre, blob } = archivoRespaldo();
  const file = new File([blob], nombre, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Respaldo LUCXSTUDIO", text: "Respaldo de LUCXSTUDIO" });
      marcarRespaldo();
      showToast("Respaldo enviado.");
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;   // la persona canceló
    }
  }
  descargarBlob(blob, nombre);
  marcarRespaldo();
  showToast("Tu navegador no puede compartir archivos: se descargó el respaldo para que lo envíes tú.");
}

/* ---------------------------------------------------------------
   COPIA ANTERIOR (una sola, se sobreescribe en cada importación)
--------------------------------------------------------------- */
function guardarCopiaAnterior(motivo) {
  const ok = ls.set(K_SNAP, JSON.stringify({ guardadaEn: new Date().toISOString(), motivo, datos: AppState }));
  if (!ok) showToast("No se pudo guardar la copia anterior (poco espacio). Usa el botón Deshacer del aviso.", "error");
  renderEstado();
}
function leerCopiaAnterior() {
  const raw = ls.get(K_SNAP);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
async function restaurarCopiaAnterior() {
  const snap = leerCopiaAnterior();
  if (!snap || !snap.datos) return showToast("No hay copia anterior guardada.", "error");
  const ok = await window.confirmPopup({
    title: "Restaurar copia anterior",
    message: `Tus datos volverán a como estaban el ${fechaLegible(snap.guardadaEn)} (${snap.motivo || "antes de importar"}). Lo que hayas hecho después se perderá.`,
    confirmLabel: "Restaurar", danger: true
  });
  if (!ok) return;
  const copia = window.tomarCopiaEstado();
  importData(JSON.parse(JSON.stringify(snap.datos)));
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer("Copia anterior restaurada.", copia);
  renderEstado();
}

/* ---------------------------------------------------------------
   IMPORTAR: LEER, COMPARAR Y APLICAR
--------------------------------------------------------------- */
function interpretar(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (parsed.tipo === "respaldo-completo" && parsed.datos) return { tipo: "completo", parsed: parsed.datos, datos: parsed.datos, meta: parsed };
  if (parsed.tipo === "respaldo-seccion" && parsed.datos) return { tipo: "seccion", parsed, datos: parsed.datos, meta: parsed };
  if (Array.isArray(parsed.cotizaciones) || Array.isArray(parsed.playeras) || parsed.settings) return { tipo: "plano", parsed, datos: parsed, meta: null };
  return null;
}
async function importarRespaldoArchivo(file) {
  let parsed;
  try { parsed = JSON.parse(await file.text()); }
  catch (e) { return showToast("El archivo no es un respaldo válido.", "error"); }
  const entrada = interpretar(parsed);
  if (!entrada) return showToast("El archivo no parece un respaldo de LUCXSTUDIO.", "error");
  vistaPreviaImportacion(entrada);
}

// Combina por "id": agrega lo que falta y deja lo que ya existe. Después ajusta el stock por las
// ventas y mermas NUEVAS (para que dos dispositivos que vendieron de la misma pieza no se pisen).
const NO_FUSIONAR = new Set(["settings", "cajaGeneral", "recommendedChartStyles", "ultimaModificacion"]);
function fusionar(datos, aplicar) {
  const r = { nuevos: 0, distintos: 0, ajustes: 0, bazares: {} };
  const nuevosIds = {}, nuevosItems = {};
  Object.keys(datos).forEach(k => {
    if (NO_FUSIONAR.has(k) || !Array.isArray(datos[k])) return;
    const local = Array.isArray(AppState[k]) ? AppState[k] : [];
    if (aplicar && !Array.isArray(AppState[k])) AppState[k] = local;
    const porId = new Map(local.map(x => [x && x.id, x]));
    nuevosIds[k] = new Set(); nuevosItems[k] = [];
    datos[k].forEach(item => {
      if (!item || typeof item !== "object" || !item.id) return;
      const ya = porId.get(item.id);
      if (!ya) {
        const copia = JSON.parse(JSON.stringify(item));
        r.nuevos++; nuevosIds[k].add(item.id); nuevosItems[k].push(copia);
        if (aplicar) local.push(copia);
      } else if (JSON.stringify(ya) !== JSON.stringify(item)) {
        r.distintos++;
      }
    });
  });
  const esNuevo = (k, id) => !!(nuevosIds[k] && nuevosIds[k].has(id));
  const bajar = (lista, id, cantidad) => {
    const o = (AppState[lista] || []).find(x => x.id === id);
    if (!o) return;
    r.ajustes++;
    if (aplicar) {
      o.stock = Math.max(0, (o.stock || 0) - (cantidad || 0));
      if (o.stock === 0) o.estado = "Agotado";
    }
  };
  (nuevosItems.playeras || []).forEach(v => { if (v.ventaRapida && v.origenId && !esNuevo("playeras", v.origenId)) bajar("playeras", v.origenId, v.stock); });
  (nuevosItems.ventasStickers || []).forEach(v => { if (v.stickerId && !esNuevo("stickers", v.stickerId)) bajar("stickers", v.stickerId, v.cantidad); });
  (nuevosItems.mermas || []).forEach(m => { if (m.playeraId && !esNuevo("playeras", m.playeraId)) bajar("playeras", m.playeraId, m.cantidad); });
  // Bazares con movimiento nuevo (para ofrecer abrirlos al terminar)
  ["cotizaciones", "playeras", "ventasStickers"].forEach(k => (nuevosItems[k] || []).forEach(x => {
    bazarIdsDe(x).forEach(id => { r.bazares[id] = (r.bazares[id] || 0) + 1; });
  }));
  return r;
}

function vistaPreviaImportacion(entrada) {
  const { datos, meta } = entrada;
  const filas = [];
  COLECCIONES.forEach(([k, etiqueta]) => {
    if (!Array.isArray(datos[k])) return;
    const aqui = conteo(AppState, k), alla = datos[k].length;
    filas.push([etiqueta, `${aqui} → ${alla}`, alla > aqui ? "good" : alla < aqui ? "bad" : ""]);
  });
  const sim = fusionar(datos, false);
  const archivo = [];
  if (meta && meta.exportadoEn) archivo.push(["Guardado el", fechaLegible(meta.exportadoEn)]);
  if (meta && meta.dispositivo) archivo.push(["Dispositivo", meta.dispositivo]);
  if (meta && meta.ultimaModificacion) archivo.push(["Último cambio en el archivo", fechaLegible(meta.ultimaModificacion)]);
  archivo.push(["Último cambio en este dispositivo", fechaLegible(AppState.ultimaModificacion)]);
  if (entrada.tipo === "seccion") archivo.unshift(["Tipo", `Solo una sección (${meta.seccion || "—"})`]);

  const secciones = [{ title: "Archivo", rows: archivo }];
  if (filas.length) secciones.push({ title: "Comparación (este dispositivo → archivo)", rows: filas });
  secciones.push({
    title: "Si eliges Combinar",
    rows: [
      ["Registros nuevos que se agregarían", String(sim.nuevos), sim.nuevos ? "good" : ""],
      ["Ajustes de stock por ventas y mermas nuevas", String(sim.ajustes)],
      ["Registros con diferencias (se conserva lo de aquí)", String(sim.distintos), sim.distintos ? "bad" : ""]
    ],
    text: "Combinar es lo ideal si vendiste en los dos dispositivos: agrega lo que falte y ajusta el stock. No copia ediciones ni eliminaciones de registros que ya existen aquí. Reemplazar deja este dispositivo igual al archivo."
  });
  window.openQuickDetail({
    icon: "📥", title: "Importar respaldo", subtitle: "Revisa antes de aplicar",
    sections: secciones,
    actions: [
      { label: "🔀 Combinar", variant: "primary", onClick: () => aplicarCombinar(datos) },
      { label: "♻️ Reemplazar todo", variant: "danger", onClick: () => aplicarReemplazo(entrada) },
      { label: "Cancelar" }
    ]
  });
}
function aplicarCombinar(datos) {
  const copia = window.tomarCopiaEstado();
  guardarCopiaAnterior("antes de combinar un respaldo");
  const r = fusionar(datos, true);
  // Los gastos/cotizaciones recién combinados pueden traer ligas nuevas: se recalculan los costos.
  if (typeof window.recalcularCostosCotizacionesPorGastos === "function") window.recalcularCostosCotizacionesPorGastos();
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer(`Combinado: ${r.nuevos} registro(s) nuevo(s).`, copia);
  const bazares = Object.keys(r.bazares)
    .map(id => ({ id, n: r.bazares[id], b: AppState.bazares.find(x => x.id === id) }))
    .filter(x => x.b).sort((a, b) => b.n - a.n).slice(0, 2);
  const secciones = [{ rows: [
    ["Registros nuevos agregados", String(r.nuevos), r.nuevos ? "good" : ""],
    ["Ajustes de stock por ventas y mermas nuevas", String(r.ajustes)],
    ["Registros con diferencias (se conservó lo de aquí)", String(r.distintos), r.distintos ? "bad" : ""]
  ] }];
  if (bazares.length) secciones.push({ title: "Bazares con movimiento nuevo", rows: bazares.map(x => [x.b.nombre, `${x.n} registro(s)`]) });
  const acciones = bazares.map(x => ({ label: `🏪 Ver ${x.b.nombre}`, variant: "primary", onClick: () => window.goToBazarDetalle(x.id) }));
  acciones.push({ label: "Listo", variant: bazares.length ? "secondary" : "primary" });
  window.openQuickDetail({ icon: "✅", title: "Respaldo combinado", subtitle: "Ya puedes ver lo que pasó", sections: secciones, actions: acciones });
}
async function aplicarReemplazo(entrada) {
  const ok = await window.confirmPopup({
    title: "Reemplazar todo",
    message: entrada.tipo === "seccion"
      ? "Se reemplazará esa sección con lo que trae el archivo. Se guardará una copia anterior."
      : "Este dispositivo quedará igual que el archivo. Lo que solo exista aquí se perderá (se guarda una copia anterior por si acaso).",
    confirmLabel: "Reemplazar", danger: true
  });
  if (!ok) return;
  const copia = window.tomarCopiaEstado();
  guardarCopiaAnterior("antes de reemplazar con un respaldo");
  importData(entrada.tipo === "seccion" ? entrada.parsed : JSON.parse(JSON.stringify(entrada.parsed)));
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer("Respaldo importado.", copia);
}

/* ---------------------------------------------------------------
   DESCARGAR LA CAJA (Excel; CSV si no carga el generador de Excel)
--------------------------------------------------------------- */
function lugarTexto(ids) {
  if (!ids.length) return "Caja general";
  return ids.map(id => (AppState.bazares.find(b => b.id === id) || {}).nombre || "Bazar eliminado").join(", ");
}
function lineasCaja() {
  const lineas = [];
  AppState.cotizaciones.filter(c => !c.ventaNula).forEach(c => {
    const piezas = (c.items || []).reduce((s, i) => s + (i.cantidad || 0), 0) + (c.stickers || []).reduce((s, i) => s + (i.cantidad || 0), 0);
    lineas.push({
      fecha: c.fecha || "", tipo: "Cotización", detalle: `${c.folio || ""} · ${c.cliente || "Cliente sin nombre"}`,
      piezas, precio: "", total: c.totalVenta || 0, metodo: c.metodoPago || "Efectivo",
      tarjeta: c.montoTarjeta || 0, comision: c.comisionTerminal || 0, bazarIds: bazarIdsDe(c)
    });
  });
  AppState.playeras.filter(p => (p.bazarEstado || "Disponible") === "Vendida" && (p.stock || 0) > 0).forEach(p => {
    const total = (p.precioVenta || 0) * (p.stock || 0);
    lineas.push({
      fecha: p.fechaVenta || "", tipo: p.ventaRapida ? "Venta rápida" : "Playera",
      detalle: `${p.nombre} (Talla ${p.talla || "—"}, ${colorNombre(p.colorId)})`, piezas: p.stock || 0,
      precio: p.precioVenta || 0, total, metodo: p.metodoPago || "Efectivo",
      tarjeta: p.montoTarjeta || 0, comision: p.comisionTerminal || 0, bazarIds: bazarIdsDe(p)
    });
  });
  (AppState.ventasStickers || []).forEach(v => {
    lineas.push({
      fecha: v.fecha || "", tipo: "Sticker", detalle: `${v.nombre} (${v.tamano || "—"})`, piezas: v.cantidad || 0,
      precio: v.precioVenta || 0, total: (v.precioVenta || 0) * (v.cantidad || 0), metodo: v.metodoPago || "Efectivo",
      tarjeta: v.montoTarjeta || 0, comision: v.comisionTerminal || 0, bazarIds: bazarIdsDe(v)
    });
  });
  return lineas;
}
const redondear = n => Math.round((Number(n) || 0) * 100) / 100;
function csv(filas) {
  if (!filas.length) return "";
  const cols = Object.keys(filas[0]);
  const esc = v => { const s = v === null || v === undefined ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.map(esc).join(","), ...filas.map(f => cols.map(c => esc(f[c])).join(","))].join("\r\n");
}
function exportarCaja(lugar) {
  lugar = lugar || "todas";
  const todas = lineasCaja();
  const lineas = (lugar === "todas" ? todas
    : lugar === "general" ? todas.filter(l => !l.bazarIds.length)
    : todas.filter(l => l.bazarIds.includes(lugar)))
    .sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
  const bazar = (lugar !== "todas" && lugar !== "general") ? AppState.bazares.find(b => b.id === lugar) : null;
  if (lugar !== "todas" && lugar !== "general" && !bazar) return showToast("Ese bazar ya no existe.", "error");

  const efectivoDe = l => Math.max(0, redondear(l.total - l.tarjeta));
  const ventas = lineas.map(l => ({
    "Fecha": l.fecha || "Sin fecha", "Lugar": lugarTexto(l.bazarIds), "Tipo": l.tipo, "Detalle": l.detalle,
    "Piezas": l.piezas, "Precio c/u": l.precio === "" ? "" : redondear(l.precio), "Total": redondear(l.total),
    "Método de pago": l.metodo, "Efectivo": efectivoDe(l), "Tarjeta": redondear(l.tarjeta), "Comisión de terminal": redondear(l.comision)
  }));

  const lugares = lugar === "todas"
    ? [{ nombre: "Caja general", d: desgloseCierreCajaGeneral() }, ...AppState.bazares.map(b => ({ nombre: b.nombre, d: desgloseCierreBazar(b) }))]
    : lugar === "general" ? [{ nombre: "Caja general", d: desgloseCierreCajaGeneral() }] : [{ nombre: bazar.nombre, d: desgloseCierreBazar(bazar) }];
  const resumen = lugares.map(({ nombre, d }) => ({
    "Lugar": nombre, "Total vendido": redondear(d.totalVendido), "Efectivo": redondear(d.ventasEfectivo), "Tarjeta": redondear(d.ventasTarjeta),
    "Comisión de terminal": redondear(d.comisionTerminal), "Fondo de caja": redondear(d.fondoCaja),
    "Efectivo esperado": redondear(d.efectivoEsperado), "Efectivo contado": d.efectivoContado === null ? "" : redondear(d.efectivoContado),
    "Diferencia": d.diferencia === null ? "" : redondear(d.diferencia)
  }));
  if (lugar === "todas") {
    const t = lineas.reduce((s, l) => s + l.total, 0), tj = lineas.reduce((s, l) => s + l.tarjeta, 0);
    resumen.push({ "Lugar": "TOTAL (todas las ventas)", "Total vendido": redondear(t), "Efectivo": redondear(Math.max(0, t - tj)), "Tarjeta": redondear(tj),
      "Comisión de terminal": redondear(lineas.reduce((s, l) => s + l.comision, 0)), "Fondo de caja": "", "Efectivo esperado": "", "Efectivo contado": "", "Diferencia": "" });
  }

  const dias = new Map();
  lineas.forEach(l => {
    const k = l.fecha || "Sin fecha";
    const x = dias.get(k) || { n: 0, total: 0, tarjeta: 0 };
    x.n++; x.total += l.total; x.tarjeta += l.tarjeta;
    dias.set(k, x);
  });
  const porDia = [...dias.entries()].map(([fecha, x]) => ({
    "Fecha": fecha, "Ventas": x.n, "Total": redondear(x.total), "Efectivo": redondear(Math.max(0, x.total - x.tarjeta)), "Tarjeta": redondear(x.tarjeta)
  }));

  const nombreBase = `lucxstudio_caja_${lugar === "todas" ? "todas" : slug(lugar === "general" ? "general" : bazar.nombre)}_${hoyLocal()}`;
  if (window.XLSX) {
    const wb = XLSX.utils.book_new();
    const hoja = (filas, nombre, anchos) => {
      const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ Aviso: "Sin datos" }]);
      if (anchos) ws["!cols"] = anchos.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, nombre);
    };
    hoja(resumen, "Resumen", [26, 14, 12, 12, 20, 14, 18, 18, 12]);
    hoja(ventas, "Ventas", [12, 24, 14, 40, 8, 11, 11, 15, 11, 11, 20]);
    hoja(porDia, "Por día", [12, 9, 12, 12, 12]);
    XLSX.writeFile(wb, nombreBase + ".xlsx");
    showToast("Caja descargada en Excel.");
  } else {
    // Sin generador de Excel (por ejemplo, sin internet): CSV con BOM para que Excel respete los acentos.
    descargarBlob(new Blob(["\ufeff" + csv(ventas)], { type: "text/csv;charset=utf-8" }), nombreBase + ".csv");
    showToast("No cargó el generador de Excel: se descargó un CSV con las ventas.");
  }
}

/* ---------------------------------------------------------------
   TARJETA DE AJUSTES + RECORDATORIO
--------------------------------------------------------------- */
function renderEstado() {
  const cont = $("respaldo-estado");
  if (!cont) return;
  const ultimo = ls.get(K_ULTIMO);
  const hayDatos = conteo(AppState, "cotizaciones") + conteo(AppState, "playeras") + conteo(AppState, "stickers") > 0;
  const dias = diasDesde(ultimo);
  const urgente = hayDatos && (dias === null || dias > 7);
  cont.innerHTML = "";
  const linea = (txt, cls) => { const p = document.createElement("p"); p.className = "respaldo-linea" + (cls ? " " + cls : ""); p.textContent = txt; cont.appendChild(p); };
  linea(`${urgente ? "⚠️ " : "💾 "}Último respaldo descargado: ${ultimo ? `${haceCuanto(ultimo)} (${fechaLegible(ultimo)})` : "nunca"}`, urgente ? "warn" : "");
  linea(`🕒 Último cambio en este dispositivo: ${fechaLegible(AppState.ultimaModificacion)}`);
  linea("📊 Aquí hay: " + COLECCIONES.slice(0, 6).map(([k, e]) => `${conteo(AppState, k)} ${e.split(" (")[0].toLowerCase()}`).join(" · "));
  const snap = leerCopiaAnterior();
  const btn = $("rs-restaurar");
  if (btn) {
    btn.style.display = snap ? "" : "none";
    if (snap) btn.title = `Copia del ${fechaLegible(snap.guardadaEn)} (${snap.motivo || ""})`;
  }
}
function recordatorioRespaldo() {
  const hayDatos = conteo(AppState, "cotizaciones") + conteo(AppState, "playeras") > 0;
  if (!hayDatos || ls.get(K_AVISO) === hoyLocal()) return;
  const dias = diasDesde(ls.get(K_ULTIMO));
  if (dias !== null && dias <= 7) return;
  ls.set(K_AVISO, hoyLocal());
  showToast(dias === null ? "Todavía no has descargado un respaldo de tus datos." : `Hace ${dias} días que no descargas un respaldo.`, "success",
    { accion: "Descargar", alAccionar: descargarRespaldoCompleto, duracion: 10000 });
}

function iniciar() {
  const bind = (id, fn) => { const b = $(id); if (b) b.addEventListener("click", fn); };
  bind("rs-descargar", descargarRespaldoCompleto);
  bind("rs-compartir", compartirRespaldo);
  bind("rs-restaurar", restaurarCopiaAnterior);
  bind("rs-caja", () => exportarCaja("todas"));
  bind("caja-descargar", () => exportarCaja(($("caja-selector") || {}).value || "general"));
  const imp = $("rs-importar");
  if (imp) imp.addEventListener("change", e => { const f = e.target.files[0]; if (f) importarRespaldoArchivo(f); e.target.value = ""; });
  const nom = $("respaldo-dispositivo");
  if (nom) {
    nom.value = ls.get(K_DISP) || "";
    nom.placeholder = nombreDispositivo();
    nom.addEventListener("change", () => { ls.set(K_DISP, nom.value.trim()); nom.placeholder = nombreDispositivo(); });
  }
  const pagina = $("page-ajustes");
  if (pagina) new MutationObserver(renderEstado).observe(pagina, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("lucx:estado-cambio", renderEstado);
  setTimeout(() => { renderEstado(); recordatorioRespaldo(); }, 3500);
}
iniciar();

Object.assign(window, { descargarRespaldoCompleto, importarRespaldoArchivo, exportarCaja });
