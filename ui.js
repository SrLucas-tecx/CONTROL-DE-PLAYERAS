/* ============================================================
   LUCXSTUDIO — ui.js
   Manipulación del DOM, renderizado de tarjetas, modales y alertas
   ============================================================ */
import { SECTION_LABELS, ARTIST_PRESETS, ARTIST_MODE_LABEL, TIPOS_PRENDA, ETAPAS_PRODUCCION, RECOMMENDED_COMBINATIONS, RECOMMENDED_PALETTES, GASTOS_CATEGORIAS, GASTOS_BAZAR_TIPOS, MOTIVOS_MERMA, CONSIGNACION_ESTADOS } from "./config.js";
import { AppState, uid, saveState, getSectionData, importData, resetState, setToastHandler } from "./storage.js";
import {
  fmt, escapeHtml, costoTotalPlayera, costoEstampado, getCostoEstampadoEfectivo, sobrecargoTalla, costoUnitarioItem,
  areaTotalCm2, costoImpresion, comisionPlayera, costoImpresionEfectivoPlayera, montoPorPiezaLigada,
  colorNombre, colorHex, estadoBadgeClass, prioridadBadgeClass, bazarEstadoBadgeClass,
  bazarIdsDe, bazarTiene, nombresBazares, getBazarVentasYGanancia, gastosBazarPorTipo, costoBazarReal, saldoBazarPendiente, playerasSorpresaBajoStock,
  comisionTerminalMonto, saldoPendienteCliente, desgloseCierreBazar, desgloseCierreCajaGeneral, clienteNombre, statsCliente,
  totalMermas, totalMermasMesActual, totalMermasDeBazar, comisionConsignacion, statsConsignacion, nombreConsignacion,
  areaPiezaLigable, repartoProporcionalPorArea, pctLlenadoRollo, piezaCabeEnRollo,
  rankingConsultas, consultasPorEtiqueta, totalConsultas, nombreProductoConsulta,
  datosGrafica, datosInventarioGrafica, semaforoCotizacion, agruparClientes, agruparArtes,
  totalGastos, totalGastosMesActual, progresoCompra, faltanteCompra
} from "./calculator.js";

/* ---------------------------------------------------------------
   ESTADO DE UI (filtros, selección activa, etc.)
--------------------------------------------------------------- */
let uiFilters = { playeraTag: "all", stickerSize: "all" };
let activeBazarId = "";
let assignmentModalContext = null;

/* ---------------------------------------------------------------
   HELPERS GENERALES DE DOM
--------------------------------------------------------------- */
function num(id) { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; }
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function checked(id) { const el = document.getElementById(id); return el ? el.checked : false; }
function setChecked(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }

function rangoBazarFecha(bazar) {
  const inicio = bazar.fecha || bazar.fechaInicio || "—";
  const fin = bazar.fechaFin || inicio;
  return inicio === fin ? inicio : `${inicio} al ${fin}`;
}

export function showToast(message, type = "success") {
  const box = document.getElementById("toast");
  const item = document.createElement("div");
  item.className = "toast-item " + type;
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}
setToastHandler(showToast);

function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-modal]")) closeModal(e.target.getAttribute("data-modal"));
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});

/* ---------------------------------------------------------------
   NAVEGACIÓN
--------------------------------------------------------------- */
const PAGE_TITLES = {
  cotizador: "Cotizador rápido",
  cotizaciones: "Cotizaciones guardadas",
  produccion: "Producción (semáforo)",
  clientes: "Clientes",
  artes: "Historial de artes",
  playeras: "Inventario de playeras",
  stickers: "Estampados y stickers",
  etiquetas: "Etiquetas y colores",
  artistas: "Artistas y comisiones",
  proveedores: "Proveedores",
  gastos: "Gastos generales",
  mermas: "Mermas",
  compras: "Próximas compras",
  bazares: "Mis Bazares",
  consignaciones: "Consignaciones",
  caja: "Caja",
  interes: "Interés por producto",
  "bazar-detalle": "Detalle de bazar",
  estadisticas: "Estadísticas",
  ajustes: "Ajustes de costos"
};
export function switchPage(page) {
  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  const navHighlight = page === "bazar-detalle" ? "bazares" : page;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === navHighlight));
  document.getElementById("page-title").textContent = PAGE_TITLES[page] || "LUCXSTUDIO";
  document.getElementById("header-cta").style.display = page === "cotizador" ? "none" : "inline-block";
  if (page === "bazares") renderBazares();
  if (page === "caja") renderCaja();
  if (page === "interes") renderInteres();
  if (page === "estadisticas") renderEstadisticas();
  if (page === "produccion") renderProduccionKanban();
  if (page === "clientes") renderClientes();
  if (page === "artes") renderHistorialArtes();
  closeSidebarMobile();
}
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});
document.getElementById("header-cta").addEventListener("click", () => switchPage("cotizador"));

/* ---------------------------------------------------------------
   SELECTOR GLOBAL DE "BAZAR ACTIVO" (barra del header)
--------------------------------------------------------------- */
function renderHeaderBazarSelect() {
  const sel = document.getElementById("header-bazar-activo");
  sel.innerHTML = `<option value="">Sin bazar activo</option>` +
    AppState.bazares.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join("");
  sel.value = activeBazarId || "";
}
export function onHeaderBazarChange() {
  activeBazarId = val("header-bazar-activo");
  const currentPage = document.querySelector(".page-section.active").id.replace("page-", "");
  if (currentPage === "bazares") renderBazares();
  if (currentPage === "bazar-detalle") renderBazarDetalle();
}
document.getElementById("header-bazar-add").addEventListener("click", () => openModalBazar());

function closeSidebarMobile() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("sidebar-overlay").classList.remove("open");
}
document.getElementById("sidebar-toggle").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
  document.getElementById("sidebar-overlay").classList.toggle("open");
});
document.getElementById("sidebar-overlay").addEventListener("click", closeSidebarMobile);

/* ---------------------------------------------------------------
   MODO OSCURO / CLARO
--------------------------------------------------------------- */
document.getElementById("dark-mode-btn").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("LUCXSTUDIO_THEME", document.body.classList.contains("light") ? "light" : "dark");
});
export function applySavedTheme() {
  if (localStorage.getItem("LUCXSTUDIO_THEME") === "light") document.body.classList.add("light");
}

/* ---------------------------------------------------------------
   RESPALDO JSON
--------------------------------------------------------------- */
function exportarJSON() {
  const blob = new Blob([JSON.stringify(AppState, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lucxstudio_respaldo_" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  showToast("Respaldo descargado.");
}
function exportarSeccion(section) {
  const payload = {
    app: "LUCXSTUDIO",
    tipo: "respaldo-seccion",
    seccion: section,
    fechaExportacion: new Date().toISOString(),
    datos: getSectionData(section)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lucxstudio_${section}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  document.getElementById("backup-menu").classList.remove("open");
  showToast(`Respaldo de ${SECTION_LABELS[section]} descargado.`);
}
document.getElementById("export-json-btn").addEventListener("click", exportarJSON);
document.getElementById("export-json-btn-2").addEventListener("click", exportarJSON);
document.querySelectorAll("[data-export-section]").forEach(button => {
  button.addEventListener("click", () => exportarSeccion(button.dataset.exportSection));
});
document.getElementById("import-json-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      const result = importData(parsed);
      if (result.seccion) {
        showToast(`Sección ${SECTION_LABELS[result.seccion] || result.seccion} importada correctamente.`);
      } else {
        showToast("Datos importados correctamente.");
      }
      saveState();
      renderAll();
    } catch (err) {
      showToast("El archivo no es un respaldo válido.", "error");
    }
  };
  reader.readAsText(file);
});
document.getElementById("backup-btn").addEventListener("click", () => {
  document.getElementById("backup-menu").classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#backup-btn") && !e.target.closest("#backup-menu")) {
    document.getElementById("backup-menu").classList.remove("open");
  }
});
export function confirmResetAll() {
  if (confirm("¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer. Te recomendamos descargar un respaldo antes.")) {
    resetState();
    saveState();
    renderAll();
    showToast("Datos reiniciados.");
  }
}

/* =================================================================
   COLORES
================================================================= */
function openModalColor(id) {
  setVal("col-id", id || "");
  document.getElementById("modal-color-title").textContent = id ? "Editar color" : "Nuevo color";
  if (id) {
    const c = AppState.colores.find(x => x.id === id);
    setVal("col-nombre", c.nombre); setVal("col-hex", c.hex);
  } else {
    setVal("col-nombre", ""); setVal("col-hex", "#111113");
  }
  openModal("modal-color");
}
function saveColor() {
  const nombre = val("col-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al color.", "error");
  const id = val("col-id");
  const data = { nombre, hex: val("col-hex") };
  if (id) {
    Object.assign(AppState.colores.find(x => x.id === id), data);
  } else {
    AppState.colores.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-color"); renderColores(); refreshAllSelects();
  showToast("Color guardado.");
}
function deleteColor(id) {
  if (!confirm("¿Eliminar este color?")) return;
  AppState.colores = AppState.colores.filter(x => x.id !== id);
  saveState(); renderColores(); refreshAllSelects();
}
function renderColores() {
  const grid = document.getElementById("colores-grid");
  grid.innerHTML = AppState.colores.map(c => `
    <div class="chip-item">
      <span class="chip-swatch" style="background:${c.hex}"></span>
      ${escapeHtml(c.nombre)}
      <button onclick="openModalColor('${c.id}')" title="Editar">✏️</button>
      <button onclick="deleteColor('${c.id}')" title="Eliminar">✕</button>
    </div>`).join("") || `<p class="empty-hint">Aún no hay colores.</p>`;
}

/* =================================================================
   ETIQUETAS DE FILTRADO
================================================================= */
function openModalEtiqueta(id) {
  setVal("et-id", id || "");
  document.getElementById("modal-etiqueta-title").textContent = id ? "Editar etiqueta" : "Nueva etiqueta";
  if (id) {
    const e = AppState.etiquetas.find(x => x.id === id);
    setVal("et-nombre", e.nombre); setVal("et-color", e.color);
  } else {
    setVal("et-nombre", ""); setVal("et-color", "#e3363d");
  }
  openModal("modal-etiqueta");
}
function saveEtiqueta() {
  const nombre = val("et-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre a la etiqueta.", "error");
  const id = val("et-id");
  const data = { nombre, color: val("et-color") };
  if (id) {
    Object.assign(AppState.etiquetas.find(x => x.id === id), data);
  } else {
    AppState.etiquetas.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-etiqueta"); renderEtiquetas(); renderPlayeraTagChips(); renderAll();
  showToast("Etiqueta guardada.");
}
function deleteEtiqueta(id) {
  if (!confirm("¿Eliminar esta etiqueta? Se quitará de todas las playeras.")) return;
  AppState.etiquetas = AppState.etiquetas.filter(x => x.id !== id);
  AppState.playeras.forEach(p => { p.tags = (p.tags || []).filter(t => t !== id); });
  saveState(); renderEtiquetas(); renderPlayeraTagChips(); renderPlayeras();
}
function renderEtiquetas() {
  const grid = document.getElementById("etiquetas-grid");
  grid.innerHTML = AppState.etiquetas.map(e => `
    <div class="chip-item">
      <span class="chip-swatch" style="background:${e.color}"></span>
      ${escapeHtml(e.nombre)}
      <button onclick="openModalEtiqueta('${e.id}')" title="Editar">✏️</button>
      <button onclick="deleteEtiqueta('${e.id}')" title="Eliminar">✕</button>
    </div>`).join("") || `<p class="empty-hint">Aún no hay etiquetas.</p>`;
}

/* =================================================================
   ETIQUETAS OPERATIVAS (para cotizaciones: Urgente, Retrabajo, etc.)
================================================================= */
function openModalEtiquetaOp(id) {
  setVal("eo-id", id || "");
  document.getElementById("modal-etiqueta-op-title").textContent = id ? "Editar etiqueta operativa" : "Nueva etiqueta operativa";
  if (id) {
    const e = AppState.etiquetasOperativas.find(x => x.id === id);
    setVal("eo-nombre", e.nombre); setVal("eo-color", e.color);
  } else {
    setVal("eo-nombre", ""); setVal("eo-color", "#e3363d");
  }
  openModal("modal-etiqueta-op");
}
function saveEtiquetaOp() {
  const nombre = val("eo-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre a la etiqueta operativa.", "error");
  const id = val("eo-id");
  const data = { nombre, color: val("eo-color") };
  if (id) {
    Object.assign(AppState.etiquetasOperativas.find(x => x.id === id), data);
  } else {
    AppState.etiquetasOperativas.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-etiqueta-op"); renderEtiquetasOperativas(); refreshAllSelects();
  showToast("Etiqueta operativa guardada.");
}
function deleteEtiquetaOp(id) {
  if (!confirm("¿Eliminar esta etiqueta operativa? Se quitará de todas las cotizaciones.")) return;
  AppState.etiquetasOperativas = AppState.etiquetasOperativas.filter(x => x.id !== id);
  AppState.cotizaciones.forEach(c => { c.tagsOperativos = (c.tagsOperativos || []).filter(t => t !== id); });
  saveState(); renderEtiquetasOperativas(); refreshAllSelects(); renderCotizacionesGuardadas();
}
function renderEtiquetasOperativas() {
  const grid = document.getElementById("etiquetas-operativas-grid");
  if (!grid) return;
  grid.innerHTML = AppState.etiquetasOperativas.map(e => `
    <div class="chip-item">
      <span class="chip-swatch" style="background:${e.color}"></span>
      ${escapeHtml(e.nombre)}
      <button onclick="openModalEtiquetaOp('${e.id}')" title="Editar">✏️</button>
      <button onclick="deleteEtiquetaOp('${e.id}')" title="Eliminar">✕</button>
    </div>`).join("") || `<p class="empty-hint">Aún no hay etiquetas operativas.</p>`;
}

/* =================================================================
   ETIQUETAS DE TALLA (stock físico)
================================================================= */
function openModalTallaEtiqueta(id) {
  setVal("te-id", id || "");
  document.getElementById("modal-talla-etiqueta-title").textContent = id ? "Editar stock de etiqueta" : "Agregar stock de etiqueta";
  if (id) {
    const t = AppState.tallaEtiquetas.find(x => x.id === id);
    setVal("te-talla", t.talla); setVal("te-color", t.color); setVal("te-cantidad", t.cantidad);
  } else {
    setVal("te-talla", ""); setVal("te-color", "Negro"); setVal("te-cantidad", 0);
  }
  openModal("modal-talla-etiqueta");
}
function saveTallaEtiqueta() {
  const talla = val("te-talla").trim();
  if (!talla) return showToast("Indica la talla.", "error");
  const id = val("te-id");
  const data = { talla, color: val("te-color"), cantidad: parseInt(num("te-cantidad")) || 0 };
  if (id) {
    Object.assign(AppState.tallaEtiquetas.find(x => x.id === id), data);
  } else {
    AppState.tallaEtiquetas.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-talla-etiqueta"); renderTallaEtiquetas();
  showToast("Stock de etiquetas actualizado.");
}
function deleteTallaEtiqueta(id) {
  if (!confirm("¿Eliminar este registro de etiquetas?")) return;
  AppState.tallaEtiquetas = AppState.tallaEtiquetas.filter(x => x.id !== id);
  saveState(); renderTallaEtiquetas();
}
function adjustTallaEtiqueta(id, delta) {
  const t = AppState.tallaEtiquetas.find(x => x.id === id);
  t.cantidad = Math.max(0, (t.cantidad || 0) + delta);
  saveState(); renderTallaEtiquetas();
}
function renderTallaEtiquetas() {
  const list = document.getElementById("talla-etiquetas-list");
  list.innerHTML = AppState.tallaEtiquetas.map(t => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(t.talla)} · ${escapeHtml(t.color)}</span>
        <span class="card-swatch" style="background:${t.color === 'Negro' ? '#111113' : '#f2f0ee'}"></span>
      </div>
      <div class="card-row"><span>En stock</span><span>${t.cantidad}</span></div>
      <div class="card-actions">
        <button onclick="adjustTallaEtiqueta('${t.id}',-1)">− 1</button>
        <button onclick="adjustTallaEtiqueta('${t.id}',1)">+ 1</button>
        <button onclick="openModalTallaEtiqueta('${t.id}')">✏️</button>
        <button class="danger" onclick="deleteTallaEtiqueta('${t.id}')">🗑️</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Aún no registras etiquetas de talla.</p>`;
}

/* =================================================================
   ARTISTAS
================================================================= */
function onArtistModeChange() {
  const modo = val("a-modo");
  const row = document.getElementById("a-pct-row");
  if (modo === "personalizado") {
    row.style.opacity = "1";
    document.querySelectorAll("#a-pct-row input").forEach(i => i.disabled = false);
  } else {
    const preset = ARTIST_PRESETS[modo];
    setVal("a-pct-artista", preset.pctArtista);
    setVal("a-pct-estudio", preset.pctEstudio);
    document.querySelectorAll("#a-pct-row input").forEach(i => i.disabled = true);
    row.style.opacity = ".6";
  }
}
function openModalArtista(id) {
  setVal("a-id", id || "");
  document.getElementById("modal-artista-title").textContent = id ? "Editar artista" : "Nuevo artista";
  if (id) {
    const a = AppState.artistas.find(x => x.id === id);
    setVal("a-nombre", a.nombre); setVal("a-modo", a.modo);
    setVal("a-pct-artista", a.pctArtista); setVal("a-pct-estudio", a.pctEstudio);
    setVal("a-notas", a.notas || "");
  } else {
    setVal("a-nombre", ""); setVal("a-modo", "venta"); setVal("a-notas", "");
  }
  onArtistModeChange();
  openModal("modal-artista");
}
function saveArtista() {
  const nombre = val("a-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al artista.", "error");
  const id = val("a-id");
  const data = {
    nombre, modo: val("a-modo"),
    pctArtista: parseFloat(num("a-pct-artista")) || 0,
    pctEstudio: parseFloat(num("a-pct-estudio")) || 0,
    notas: val("a-notas")
  };
  if (id) {
    Object.assign(AppState.artistas.find(x => x.id === id), data);
  } else {
    AppState.artistas.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-artista"); renderArtistas(); refreshAllSelects();
  showToast("Artista guardado.");
}
function deleteArtista(id) {
  if (!confirm("¿Eliminar este artista?")) return;
  AppState.artistas = AppState.artistas.filter(x => x.id !== id);
  saveState(); renderArtistas(); refreshAllSelects();
}
function renderArtistas() {
  const grid = document.getElementById("artistas-grid");
  grid.innerHTML = AppState.artistas.map(a => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(a.nombre)}</span>
        <span class="card-badge badge-alta">${a.pctArtista}% / ${a.pctEstudio}%</span>
      </div>
      <div class="card-meta">${ARTIST_MODE_LABEL[a.modo] || a.modo}</div>
      ${a.notas ? `<div class="card-meta">${escapeHtml(a.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalArtista('${a.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteArtista('${a.id}')">🗑️ Eliminar</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Aún no registras artistas.</p>`;
}

/* =================================================================
   PROVEEDORES
================================================================= */
function openModalProveedor(id) {
  setVal("prov-id", id || "");
  document.getElementById("modal-proveedor-title").textContent = id ? "Editar proveedor" : "Nuevo proveedor";
  if (id) {
    const pr = AppState.proveedores.find(x => x.id === id);
    setVal("prov-nombre", pr.nombre); setVal("prov-contacto", pr.contacto || "");
    setVal("prov-producto", pr.producto || ""); setVal("prov-notas", pr.notas || "");
  } else {
    setVal("prov-nombre", ""); setVal("prov-contacto", ""); setVal("prov-producto", ""); setVal("prov-notas", "");
  }
  openModal("modal-proveedor");
}
function saveProveedor() {
  const nombre = val("prov-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al proveedor.", "error");
  const id = val("prov-id");
  const data = { nombre, contacto: val("prov-contacto"), producto: val("prov-producto"), notas: val("prov-notas") };
  if (id) {
    Object.assign(AppState.proveedores.find(x => x.id === id), data);
  } else {
    AppState.proveedores.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-proveedor"); renderProveedores();
  showToast("Proveedor guardado.");
}
function deleteProveedor(id) {
  if (!confirm("¿Eliminar este proveedor?")) return;
  AppState.proveedores = AppState.proveedores.filter(x => x.id !== id);
  saveState(); renderProveedores();
}
function renderProveedores() {
  const grid = document.getElementById("proveedores-grid");
  if (!grid) return;
  grid.innerHTML = AppState.proveedores.map(pr => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(pr.nombre)}</span>
      </div>
      ${pr.producto ? `<div class="card-meta">📦 ${escapeHtml(pr.producto)}</div>` : ""}
      ${pr.contacto ? `<div class="card-meta">📞 ${escapeHtml(pr.contacto)}</div>` : ""}
      ${pr.notas ? `<div class="card-meta">${escapeHtml(pr.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalProveedor('${pr.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteProveedor('${pr.id}')">🗑️ Eliminar</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Aún no registras proveedores.</p>`;
}

/* ---------------------------------------------------------------
   GASTOS GENERALES DEL NEGOCIO
--------------------------------------------------------------- */
function fillGastoCategoriaSelect() {
  const sel = document.getElementById("gasto-categoria");
  if (!sel) return;
  sel.innerHTML = GASTOS_CATEGORIAS.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}
// Une playeras y stickers (de diversos tamaños) en un solo checklist ligable a un gasto,
// usando ids compuestos "p:<id>" / "s:<id>" para no chocar entre las dos colecciones.
function piezasLigablesDisponibles() {
  const playeras = AppState.playeras.map(p => ({ tipo: "playera", id: p.id, key: `p:${p.id}`, nombre: p.nombre, detalle: `${p.talla || "—"} · ${colorNombre(p.colorId)}`, gastoVinculadoId: p.gastoVinculadoId, obj: p }));
  const stickers = AppState.stickers.map(s => ({ tipo: "sticker", id: s.id, key: `s:${s.id}`, nombre: s.nombre, detalle: `🏷️ Sticker ${s.tamano}`, gastoVinculadoId: s.gastoVinculadoId, obj: s }));
  return [...playeras, ...stickers].sort((a, b) => a.nombre.localeCompare(b.nombre));
}
// Revisa si alguna dimensión de la pieza no cabe en el ancho de rollo configurado
// (considerando que se puede rotar) — para las playeras revisa cada estampado, para
// un sticker revisa su propio ancho/largo. Gang Sheet no aplica (no se mide por pieza).
function piezaNoCabeEnRollo(pieza) {
  const anchoRollo = AppState.settings.dtfAnchoRolloCm;
  if (!anchoRollo) return false;
  if (pieza.tipo === "sticker") {
    return !piezaCabeEnRollo(pieza.obj.anchoCm, pieza.obj.largoCm, anchoRollo);
  }
  if (pieza.obj.modoCosteo === "gangsheet") return false;
  return (pieza.obj.estampados || []).some(e => !piezaCabeEnRollo(e.anchoCm, e.largoCm, anchoRollo));
}
function renderGastoLigarPlayerasList(gastoIdActual, seleccionadas) {
  const list = document.getElementById("gasto-ligar-list");
  if (!list) return;
  const piezas = piezasLigablesDisponibles();
  list.innerHTML = piezas.map(pieza => {
    const ligadaAOtro = pieza.gastoVinculadoId && pieza.gastoVinculadoId !== gastoIdActual;
    const noCabe = piezaNoCabeEnRollo(pieza);
    return `
    <label class="gasto-ligar-item">
      <input type="checkbox" class="gasto-ligar-cb" value="${pieza.key}" ${seleccionadas.includes(pieza.key) ? "checked" : ""} onchange="updateGastoLigarPreview()">
      <span>${escapeHtml(pieza.nombre)} · ${pieza.detalle}</span>
      ${noCabe ? `<span class="card-meta" style="color:var(--color-danger);">⚠️ no cabe en el ancho del rollo (${AppState.settings.dtfAnchoRolloCm} cm)</span>` : ""}
      ${ligadaAOtro ? `<span class="card-meta">🔗 se reasignará (ligada a otro gasto)</span>` : ""}
    </label>`;
  }).join("") || `<p class="empty-hint">Aún no tienes playeras ni stickers en el inventario.</p>`;
}
function toggleGastoLigarPlayeras(isChecked) {
  document.getElementById("gasto-ligar-wrap").style.display = isChecked ? "block" : "none";
  updateGastoLigarPreview();
}
// Dado un key compuesto "p:<id>" / "s:<id>", regresa el objeto real y su área (cm²) —
// base compartida entre el preview y el guardado para que nunca se desincronicen.
function piezaLigadaDeKey(key) {
  const [tipoKey, pid] = key.split(":");
  const tipo = tipoKey === "p" ? "playera" : "sticker";
  const obj = tipo === "playera" ? AppState.playeras.find(x => x.id === pid) : AppState.stickers.find(x => x.id === pid);
  return obj ? { key, tipo, pid, obj, area: areaPiezaLigable(tipo, obj) } : null;
}
// Calcula cuánto le toca a cada pieza seleccionada según el modo de reparto elegido —
// usado tanto por el preview en vivo como por saveGasto(), para que siempre coincidan.
// Por default lee el formulario abierto; si se le pasa `overrides` (piezasLigadas, monto,
// modo) calcula directo sobre datos guardados — así se puede recalcular un gasto ya
// guardado sin tener que reabrir el modal (botón "🔄 Recalcular reparto" en su tarjeta).
function calcularRepartoGasto(overrides) {
  const seleccionadas = overrides?.piezasLigadas ?? [...document.querySelectorAll(".gasto-ligar-cb:checked")].map(cb => cb.value);
  const monto = overrides?.monto ?? (num("gasto-monto") || 0);
  const modo = overrides?.modo ?? (val("gasto-reparto-modo") || "area");
  const piezas = seleccionadas.map(piezaLigadaDeKey).filter(Boolean);
  let costos = {};
  if (modo === "area") {
    const r = repartoProporcionalPorArea(piezas.map(p => ({ key: p.key, area: p.area })), monto);
    costos = r.costos;
    // Las piezas sin área comparable (Gang Sheet) no entran al reparto por área — se les
    // reparte en partes iguales lo que sobre después de cubrir a las que sí tienen área.
    const sinArea = piezas.filter(p => !p.area);
    if (sinArea.length) {
      const montoAsignado = Object.values(costos).reduce((s, c) => s + c, 0);
      const porPiezaSinArea = montoPorPiezaLigada(monto - montoAsignado, sinArea.length);
      sinArea.forEach(p => { costos[p.key] = Math.max(0, porPiezaSinArea); });
    }
  } else {
    const porPieza = montoPorPiezaLigada(monto, piezas.length);
    piezas.forEach(p => { costos[p.key] = porPieza; });
  }
  return { piezas, costos, modo, monto };
}
function updateGastoLigarPreview() {
  const preview = document.getElementById("gasto-ligar-preview");
  if (!preview) return;
  const { piezas, costos, modo, monto } = calcularRepartoGasto();
  const alertaEl = document.getElementById("gasto-llenado-alerta");
  if (!piezas.length) {
    preview.textContent = "Selecciona playeras o stickers para ver el costo real por pieza.";
    if (alertaEl) alertaEl.style.display = "none";
    return;
  }
  // % de llenado del rollo: solo informativo, no afecta el monto del gasto — avisa
  // cuando el lote es tan chico que el costo por pieza se dispara sin sentido.
  const areaTotalLote = piezas.reduce((s, p) => s + (p.area || 0), 0);
  const anchoRollo = AppState.settings.dtfAnchoRolloCm;
  const metros = Math.max(0.1, num("gasto-metros") || 1);
  const pctLlenado = pctLlenadoRollo(areaTotalLote, anchoRollo, metros);
  const umbral = AppState.settings.umbralLlenadoPct ?? 30;
  if (alertaEl) {
    if (areaTotalLote > 0 && pctLlenado < umbral) {
      alertaEl.style.display = "block";
      alertaEl.innerHTML = `⚠️ Este lote solo usa <b>${pctLlenado}%</b> del rollo (${metros} m) — el costo por pieza puede salir inflado. Agrega más piezas, o
        <button type="button" onclick="document.getElementById('gasto-ligar-toggle').checked=false; toggleGastoLigarPlayeras(false);">usa el costo estimado por área en vez de ligarlo</button>.`;
    } else {
      alertaEl.style.display = "none";
    }
  }
  if (modo === "igual") {
    preview.innerHTML = `${fmt(monto)} ÷ ${piezas.length} pieza(s) = <b>${fmt(costos[piezas[0].key])}</b> de costo real por pieza (partes iguales). Llenado del rollo: ${pctLlenado}%.`;
    return;
  }
  const filas = piezas.map(p => `<div class="card-row"><span>${escapeHtml(p.obj.nombre)}${p.area ? ` (${p.area.toFixed(0)} cm²)` : " (Gang Sheet)"}</span><span>${fmt(costos[p.key])}</span></div>`).join("");
  preview.innerHTML = `<div style="margin-bottom:6px;">Reparto por área — ${fmt(monto)} en total · Llenado del rollo: <b>${pctLlenado}%</b></div>${filas}`;
}
function openModalGasto(id) {
  fillGastoCategoriaSelect();
  setVal("gasto-id", id || "");
  document.getElementById("modal-gasto-title").textContent = id ? "Editar gasto" : "Nuevo gasto";
  let ligadas = [];
  if (id) {
    const g = AppState.gastos.find(x => x.id === id);
    setVal("gasto-concepto", g.concepto); setVal("gasto-categoria", g.categoria || "Otro");
    setVal("gasto-monto", g.monto || 0); setVal("gasto-fecha", g.fecha || "");
    setVal("gasto-link", g.link || ""); setVal("gasto-notas", g.notas || "");
    setVal("gasto-reparto-modo", g.repartoModo || "area");
    setVal("gasto-metros", g.metros || 1);
    ligadas = g.piezasLigadas || [];
  } else {
    setVal("gasto-reparto-modo", "area");
    setVal("gasto-metros", 1);
    setVal("gasto-concepto", ""); setVal("gasto-categoria", "Materiales"); setVal("gasto-monto", "");
    setVal("gasto-fecha", new Date().toISOString().slice(0, 10)); setVal("gasto-link", ""); setVal("gasto-notas", "");
  }
  setChecked("gasto-ligar-toggle", ligadas.length > 0);
  document.getElementById("gasto-ligar-wrap").style.display = ligadas.length > 0 ? "block" : "none";
  renderGastoLigarPlayerasList(id || "", ligadas);
  updateGastoLigarPreview();
  openModal("modal-gasto");
}
// Quita el costo real vinculado de una playera o un sticker (vuelve a usar el estimado).
function desvincularCostoRealDePieza(tipo, id) {
  if (tipo === "playera") {
    const p = AppState.playeras.find(x => x.id === id);
    if (p) { p.costoImpresionManual = null; p.gastoVinculadoId = ""; }
  } else {
    const s = AppState.stickers.find(x => x.id === id);
    if (s) {
      s.costo = s.anchoCm > 0 && s.largoCm > 0 ? Math.round(costoEstampado([{ anchoCm: s.anchoCm, largoCm: s.largoCm }], false) * 100) / 100 : 0;
      s.gastoVinculadoId = "";
    }
  }
}
// Wrapper para el botón "🔓 Desvincular" de las tarjetas: además de limpiar la pieza, la
// quita de piezasLigadas del gasto para que ambos lados cuadren.
function desvincularCostoRealDePiezaBoton(tipo, id) {
  const key = `${tipo === "playera" ? "p" : "s"}:${id}`;
  const pieza = tipo === "playera" ? AppState.playeras.find(x => x.id === id) : AppState.stickers.find(x => x.id === id);
  const gasto = pieza && pieza.gastoVinculadoId ? AppState.gastos.find(g => g.id === pieza.gastoVinculadoId) : null;
  if (gasto) gasto.piezasLigadas = (gasto.piezasLigadas || []).filter(k => k !== key);
  desvincularCostoRealDePieza(tipo, id);
  saveState(); renderPlayeras(); renderStickers(); renderGastos();
  showToast("Costo real desvinculado — vuelve a usar el estimado por área.");
}
function saveGasto() {
  const concepto = val("gasto-concepto").trim();
  if (!concepto) return showToast("Ponle un nombre al gasto.", "error");
  const id = val("gasto-id") || uid();
  const existing = AppState.gastos.find(x => x.id === id);
  const monto = num("gasto-monto");
  const ligar = checked("gasto-ligar-toggle");
  const seleccionadas = ligar ? [...document.querySelectorAll(".gasto-ligar-cb:checked")].map(cb => cb.value) : [];
  const repartoModo = val("gasto-reparto-modo") || "area";
  const data = {
    concepto, categoria: val("gasto-categoria"), monto,
    fecha: val("gasto-fecha"), link: val("gasto-link").trim(), notas: val("gasto-notas"),
    piezasLigadas: seleccionadas, repartoModo: ligar ? repartoModo : (existing?.repartoModo || "area"),
    metros: Math.max(0.1, num("gasto-metros") || 1)
  };
  if (existing) {
    // Desliga las piezas que ya no quedaron seleccionadas.
    (existing.piezasLigadas || []).forEach(key => {
      if (seleccionadas.includes(key)) return;
      const [tipoKey, pid] = key.split(":");
      const tipo = tipoKey === "p" ? "playera" : "sticker";
      const pieza = tipo === "playera" ? AppState.playeras.find(x => x.id === pid) : AppState.stickers.find(x => x.id === pid);
      if (pieza && pieza.gastoVinculadoId === id) desvincularCostoRealDePieza(tipo, pid);
    });
    Object.assign(existing, data);
  } else {
    AppState.gastos.push(Object.assign({ id }, data));
  }
  // Aplica el costo real a cada playera/sticker seleccionado, según el modo de reparto
  // elegido (por área — recomendado — o en partes iguales), y guarda el % de llenado del
  // rollo para poder mostrarlo después en las tarjetas sin tener que recalcular todo.
  const gastoGuardado = existing || AppState.gastos.find(x => x.id === id);
  if (ligar) {
    const { piezas, costos } = calcularRepartoGasto();
    piezas.forEach(p => {
      const costo = Math.round((costos[p.key] || 0) * 100) / 100;
      if (p.tipo === "playera") { p.obj.costoImpresionManual = costo; p.obj.gastoVinculadoId = id; }
      else { p.obj.costo = costo; p.obj.gastoVinculadoId = id; }
    });
    const areaTotalLote = piezas.reduce((s, p) => s + (p.area || 0), 0);
    gastoGuardado.areaTotalLote = areaTotalLote;
    gastoGuardado.pctLlenado = pctLlenadoRollo(areaTotalLote, AppState.settings.dtfAnchoRolloCm, data.metros);
  } else {
    gastoGuardado.areaTotalLote = 0;
    gastoGuardado.pctLlenado = null;
  }
  saveState(); closeModal("modal-gasto"); renderGastos(); renderPlayeras(); renderStickers();
  showToast(seleccionadas.length ? `Gasto guardado — costo real aplicado a ${seleccionadas.length} pieza(s) (${repartoModo === "area" ? "por área" : "partes iguales"}).` : "Gasto guardado.");
}
// Vuelve a aplicar el reparto de un gasto ya guardado (mismas piezas, mismo monto, mismo
// modo) directo desde su tarjeta, sin reabrir el modal — útil si cambiaste el ancho de
// estampado de alguna playera ligada y quieres que su costo real se actualice.
function recalcularRepartoGasto(id) {
  const g = AppState.gastos.find(x => x.id === id);
  if (!g || !(g.piezasLigadas || []).length) return;
  const { piezas, costos } = calcularRepartoGasto({ piezasLigadas: g.piezasLigadas, monto: g.monto, modo: g.repartoModo });
  piezas.forEach(p => {
    const costo = Math.round((costos[p.key] || 0) * 100) / 100;
    if (p.tipo === "playera") { p.obj.costoImpresionManual = costo; p.obj.gastoVinculadoId = id; }
    else { p.obj.costo = costo; p.obj.gastoVinculadoId = id; }
  });
  const areaTotalLote = piezas.reduce((s, p) => s + (p.area || 0), 0);
  g.areaTotalLote = areaTotalLote;
  g.pctLlenado = pctLlenadoRollo(areaTotalLote, AppState.settings.dtfAnchoRolloCm, g.metros || 1);
  saveState(); renderGastos(); renderPlayeras(); renderStickers();
  showToast("Reparto recalculado.");
}
function deleteGasto(id) {
  if (!confirm("¿Eliminar este gasto?")) return;
  const g = AppState.gastos.find(x => x.id === id);
  (g?.piezasLigadas || []).forEach(key => {
    const [tipoKey, pid] = key.split(":");
    const tipo = tipoKey === "p" ? "playera" : "sticker";
    const pieza = tipo === "playera" ? AppState.playeras.find(x => x.id === pid) : AppState.stickers.find(x => x.id === pid);
    if (pieza && pieza.gastoVinculadoId === id) desvincularCostoRealDePieza(tipo, pid);
  });
  AppState.gastos = AppState.gastos.filter(x => x.id !== id);
  saveState(); renderGastos(); renderPlayeras(); renderStickers();
}
function renderGastos() {
  const grid = document.getElementById("gastos-grid");
  if (!grid) return;
  const totalMesEl = document.getElementById("gastos-total-mes");
  const totalGeneralEl = document.getElementById("gastos-total-general");
  if (totalMesEl) totalMesEl.textContent = fmt(totalGastosMesActual(AppState.gastos));
  if (totalGeneralEl) totalGeneralEl.textContent = fmt(totalGastos(AppState.gastos));
  const ordenados = [...AppState.gastos].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  grid.innerHTML = ordenados.map(g => {
    const ligadas = g.piezasLigadas || [];
    const piezasInfo = ligadas.map(piezaLigadaDeKey).filter(Boolean);
    const costoDe = p => p.tipo === "playera" ? (p.obj.costoImpresionManual || 0) : (p.obj.costo || 0);
    const desglose = piezasInfo.map(p => `<div class="card-row"><span>${escapeHtml(p.obj.nombre)}</span><span>${fmt(costoDe(p))}</span></div>`).join("");
    const llenadoTxt = (g.pctLlenado !== null && g.pctLlenado !== undefined)
      ? ` · Llenado del rollo: <b style="color:${g.pctLlenado < (AppState.settings.umbralLlenadoPct ?? 30) ? "var(--color-danger)" : "var(--color-success)"}">${g.pctLlenado}%</b>`
      : "";
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(g.concepto)}</span>
        <span class="card-badge badge-alta">${escapeHtml(g.categoria || "Otro")}</span>
      </div>
      <div class="card-row"><span>Monto</span><span>${fmt(g.monto)}</span></div>
      ${g.fecha ? `<div class="card-meta">📅 ${escapeHtml(g.fecha)}</div>` : ""}
      ${g.link ? `<div class="card-meta">🔗 <a href="${escapeHtml(g.link)}" target="_blank" rel="noopener">Ver enlace</a></div>` : ""}
      ${ligadas.length ? `
      <div class="card-meta">🧵 ${ligadas.length} pieza(s) ligada(s) · ${g.repartoModo === "igual" ? "partes iguales" : "por área"}${llenadoTxt}</div>
      <details class="gasto-desglose">
        <summary>Ver desglose por pieza</summary>
        <div class="gasto-desglose-rows">${desglose}</div>
      </details>` : ""}
      ${g.notas ? `<div class="card-meta">${escapeHtml(g.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalGasto('${g.id}')">✏️ Editar</button>
        ${ligadas.length ? `<button onclick="recalcularRepartoGasto('${g.id}')">🔄 Recalcular reparto</button>` : ""}
        <button class="danger" onclick="deleteGasto('${g.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("") || `<p class="empty-hint">Aún no registras gastos generales.</p>`;
}

/* ---------------------------------------------------------------
   MERMAS (piezas dañadas / perdidas en producción)
--------------------------------------------------------------- */
function fillMermaMotivoSelect() {
  const sel = document.getElementById("merma-motivo");
  if (!sel) return;
  sel.innerHTML = MOTIVOS_MERMA.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join("");
}
function fillMermaSelects() {
  const pSel = document.getElementById("merma-playera");
  if (pSel) {
    pSel.innerHTML = `<option value="">— Sin playera / pieza libre —</option>` +
      [...AppState.playeras].sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(p => `<option value="${p.id}">${escapeHtml(p.nombre)} · ${escapeHtml(p.talla) || "—"} · ${colorNombre(p.colorId)} (stock ${p.stock || 0})</option>`).join("");
  }
  const bSel = document.getElementById("merma-bazar");
  if (bSel) {
    bSel.innerHTML = `<option value="">— No fue en un bazar —</option>` +
      AppState.bazares.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join("");
  }
}
// Al elegir una playera del inventario, se autocompleta el costo unitario con su costo
// real (área o vinculada a un gasto, lo que aplique) y se bloquea el concepto libre.
function onMermaPlayeraChange() {
  const playeraId = val("merma-playera");
  const nombreWrap = document.getElementById("merma-nombre-wrap");
  const p = playeraId ? AppState.playeras.find(x => x.id === playeraId) : null;
  if (p) {
    nombreWrap.style.display = "none";
    setVal("merma-costo-unitario", costoTotalPlayera(p).toFixed(2));
    const cantidadInput = document.getElementById("merma-cantidad");
    if (cantidadInput) cantidadInput.max = p.stock || 1;
  } else {
    nombreWrap.style.display = "block";
  }
  updateMermaCostoPreview();
}
function updateMermaCostoPreview() {
  const cantidad = Math.max(1, parseInt(num("merma-cantidad")) || 1);
  const costoUnitario = num("merma-costo-unitario") || 0;
  const preview = document.getElementById("merma-costo-preview");
  if (preview) preview.innerHTML = `Costo total de la merma: <b>${fmt(cantidad * costoUnitario)}</b>`;
}
function openModalMerma(id) {
  fillMermaMotivoSelect();
  fillMermaSelects();
  setVal("merma-id", id || "");
  document.getElementById("modal-merma-title").textContent = id ? "Editar merma" : "Nueva merma";
  if (id) {
    const m = AppState.mermas.find(x => x.id === id);
    setVal("merma-playera", m.playeraId || ""); setVal("merma-nombre", m.nombre || "");
    setVal("merma-cantidad", m.cantidad || 1); setVal("merma-costo-unitario", m.costoUnitario || 0);
    setVal("merma-motivo", m.motivo || MOTIVOS_MERMA[0]); setVal("merma-fecha", m.fecha || "");
    setVal("merma-bazar", m.bazarId || ""); setVal("merma-notas", m.notas || "");
  } else {
    setVal("merma-playera", ""); setVal("merma-nombre", ""); setVal("merma-cantidad", 1);
    setVal("merma-costo-unitario", 0); setVal("merma-motivo", MOTIVOS_MERMA[0]);
    setVal("merma-fecha", new Date().toISOString().slice(0, 10)); setVal("merma-bazar", ""); setVal("merma-notas", "");
  }
  document.getElementById("merma-nombre-wrap").style.display = val("merma-playera") ? "none" : "block";
  updateMermaCostoPreview();
  openModal("modal-merma");
}
// Acceso directo desde la tarjeta de una playera: la preselecciona y abre el formulario.
function openModalMermaDesdePlayera(playeraId) {
  openModalMerma();
  setVal("merma-playera", playeraId);
  onMermaPlayeraChange();
}
function saveMerma() {
  const playeraId = val("merma-playera");
  const p = playeraId ? AppState.playeras.find(x => x.id === playeraId) : null;
  const nombre = p ? p.nombre : val("merma-nombre").trim();
  if (!nombre) return showToast("Indica qué pieza se perdió.", "error");
  const id = val("merma-id") || uid();
  const existing = AppState.mermas.find(x => x.id === id);
  const cantidad = Math.max(1, parseInt(num("merma-cantidad")) || 1);
  const costoUnitario = Math.max(0, num("merma-costo-unitario") || 0);
  // Si estaba ligada a una playera del inventario, primero se revierte la cantidad
  // descontada anteriormente antes de aplicar la nueva (por si cambiaron cantidad/playera).
  if (existing && existing.playeraId) {
    const antes = AppState.playeras.find(x => x.id === existing.playeraId);
    if (antes) antes.stock = (antes.stock || 0) + (existing.cantidad || 0);
  }
  if (p) {
    p.stock = Math.max(0, (p.stock || 0) - cantidad);
  }
  const data = {
    playeraId: playeraId || "", nombre, cantidad, costoUnitario, costoTotal: cantidad * costoUnitario,
    motivo: val("merma-motivo"), fecha: val("merma-fecha"), bazarId: val("merma-bazar") || "", notas: val("merma-notas")
  };
  if (existing) {
    Object.assign(existing, data);
  } else {
    AppState.mermas.push(Object.assign({ id }, data));
  }
  saveState(); closeModal("modal-merma"); renderMermas(); renderPlayeras(); renderBazarDetalle();
  showToast("Merma registrada.");
}
// Deshace una merma mal registrada: si estaba ligada a una playera del inventario, le
// regresa exactamente la cantidad que se le había descontado (declasifica el registro),
// y luego lo elimina. Así nunca se pierde stock por un error de captura.
function deleteMerma(id) {
  const m = AppState.mermas.find(x => x.id === id);
  if (!m) return;
  const mensaje = m.playeraId
    ? `¿Eliminar esta merma? Se le regresarán ${m.cantidad} pieza(s) al stock de "${m.nombre}".`
    : "¿Eliminar este registro de merma?";
  if (!confirm(mensaje)) return;
  if (m.playeraId) {
    const p = AppState.playeras.find(x => x.id === m.playeraId);
    if (p) p.stock = (p.stock || 0) + (m.cantidad || 0);
  }
  AppState.mermas = AppState.mermas.filter(x => x.id !== id);
  saveState(); renderMermas(); renderPlayeras(); renderBazarDetalle();
  showToast(m.playeraId ? "Merma deshecha — el stock ya se regresó." : "Merma eliminada.");
}
function renderMermas() {
  const grid = document.getElementById("mermas-grid");
  if (!grid) return;
  const totalMesEl = document.getElementById("mermas-total-mes");
  const totalGeneralEl = document.getElementById("mermas-total-general");
  if (totalMesEl) totalMesEl.textContent = fmt(totalMermasMesActual(AppState.mermas));
  if (totalGeneralEl) totalGeneralEl.textContent = fmt(totalMermas(AppState.mermas));
  const ordenadas = [...AppState.mermas].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  grid.innerHTML = ordenadas.map(m => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">📉 ${escapeHtml(m.nombre)}</span>
        <span class="card-badge badge-agotado">${escapeHtml(m.motivo || "Otro")}</span>
      </div>
      <div class="card-row"><span>Cantidad</span><span>${m.cantidad}</span></div>
      <div class="card-row"><span>Costo unitario</span><span>${fmt(m.costoUnitario)}</span></div>
      <div class="card-row"><span>Costo total (pérdida)</span><span style="color:var(--color-danger);">${fmt(m.costoTotal)}</span></div>
      ${m.fecha ? `<div class="card-meta">📅 ${escapeHtml(m.fecha)}</div>` : ""}
      ${m.bazarId ? `<div class="card-meta">🏪 ${escapeHtml(bazarNombre(m.bazarId))}</div>` : ""}
      ${m.notas ? `<div class="card-meta">${escapeHtml(m.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalMerma('${m.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteMerma('${m.id}')">🗑️ Eliminar</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Aún no registras mermas — ¡que se mantenga así!</p>`;
}

/* ---------------------------------------------------------------
   PRÓXIMAS COMPRAS (wishlist con link y meta de ahorro)
--------------------------------------------------------------- */
function openModalCompra(id) {
  setVal("compra-id", id || "");
  document.getElementById("modal-compra-title").textContent = id ? "Editar compra pendiente" : "Nueva compra pendiente";
  if (id) {
    const c = AppState.comprasPendientes.find(x => x.id === id);
    setVal("compra-nombre", c.nombre); setVal("compra-link", c.link || "");
    setVal("compra-meta", c.metaMonto || 0); setVal("compra-ahorrado", c.ahorrado || 0);
    setVal("compra-notas", c.notas || "");
  } else {
    setVal("compra-nombre", ""); setVal("compra-link", ""); setVal("compra-meta", "");
    setVal("compra-ahorrado", 0); setVal("compra-notas", "");
  }
  openModal("modal-compra");
}
function saveCompra() {
  const nombre = val("compra-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre a la compra.", "error");
  const id = val("compra-id");
  const data = {
    nombre, link: val("compra-link").trim(), metaMonto: num("compra-meta"),
    ahorrado: num("compra-ahorrado"), notas: val("compra-notas")
  };
  if (id) {
    Object.assign(AppState.comprasPendientes.find(x => x.id === id), data);
  } else {
    AppState.comprasPendientes.push(Object.assign({ id: uid(), comprada: false }, data));
  }
  saveState(); closeModal("modal-compra"); renderComprasPendientes();
  showToast("Compra pendiente guardada.");
}
function deleteCompra(id) {
  if (!confirm("¿Eliminar esta compra pendiente?")) return;
  AppState.comprasPendientes = AppState.comprasPendientes.filter(x => x.id !== id);
  saveState(); renderComprasPendientes();
}
function addAhorroCompra(id) {
  const c = AppState.comprasPendientes.find(x => x.id === id);
  if (!c) return;
  const entrada = prompt("¿Cuánto quieres agregar al ahorro?", "0");
  if (entrada === null) return;
  const monto = parseFloat(entrada) || 0;
  if (monto <= 0) return;
  c.ahorrado = (c.ahorrado || 0) + monto;
  saveState(); renderComprasPendientes();
  showToast("Ahorro actualizado.");
}
function toggleCompraComprada(id) {
  const c = AppState.comprasPendientes.find(x => x.id === id);
  if (!c) return;
  c.comprada = !c.comprada;
  saveState(); renderComprasPendientes();
}
function renderComprasPendientes() {
  const grid = document.getElementById("compras-grid");
  if (!grid) return;
  const ordenadas = [...AppState.comprasPendientes].sort((a, b) => (a.comprada === b.comprada) ? 0 : (a.comprada ? 1 : -1));
  grid.innerHTML = ordenadas.map(c => {
    const pct = progresoCompra(c);
    const falta = faltanteCompra(c);
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(c.nombre)}</span>
        ${c.comprada ? `<span class="card-badge badge-comprada">✅ Comprada</span>` : ""}
      </div>
      ${c.link ? `<div class="card-meta">🔗 <a href="${escapeHtml(c.link)}" target="_blank" rel="noopener">Ver producto</a></div>` : ""}
      ${c.metaMonto ? `
        <div class="savings-label"><span>${fmt(c.ahorrado || 0)} ahorrado</span><span>Meta: ${fmt(c.metaMonto)}</span></div>
        <div class="savings-bar"><div class="savings-bar-fill${pct >= 100 ? " complete" : ""}" style="width:${pct}%;"></div></div>
        <div class="card-meta">${pct >= 100 ? "🎉 ¡Meta alcanzada!" : `Faltan ${fmt(falta)} (${pct}%)`}</div>
      ` : ""}
      ${c.notas ? `<div class="card-meta">${escapeHtml(c.notas)}</div>` : ""}
      <div class="card-actions">
        ${c.metaMonto ? `<button onclick="addAhorroCompra('${c.id}')">💰 Agregar ahorro</button>` : ""}
        <button onclick="toggleCompraComprada('${c.id}')">${c.comprada ? "↩️ Reabrir" : "✅ Marcar comprada"}</button>
        <button onclick="openModalCompra('${c.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteCompra('${c.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("") || `<p class="empty-hint">Aún no tienes compras pendientes por registrar.</p>`;
}

/* =================================================================
   AJUSTES DE COSTOS (DTF)
================================================================= */
function renderAjustes() {
  setVal("set-dtf-precio", AppState.settings.dtfPrecioMetro);
  setVal("set-dtf-precio-especial", AppState.settings.dtfPrecioMetroEspecial);
  setVal("set-dtf-ancho", AppState.settings.dtfAnchoRolloCm);
  setVal("set-sobrecargo-2xl", AppState.settings.sobrecargo2XLMonto);
  setVal("set-stock-minimo-default", AppState.settings.stockMinimoDefault);
  setVal("set-gangsheet-precio", AppState.settings.gangSheetPrecioMetro);
  setVal("set-gangsheet-blanco-precio", AppState.settings.gangSheetBlancoSolidoPrecioMetro);
  setVal("set-recargo-urgente", AppState.settings.recargoUrgentePct);
  setVal("set-comision-terminal", AppState.settings.comisionTerminalPct);
  setVal("set-umbral-llenado", AppState.settings.umbralLlenadoPct ?? 30);
  setVal("set-moneda", AppState.settings.moneda);
  updateCostPreview();
}
function updateCostPreview() {
  const precio = parseFloat(document.getElementById("set-dtf-precio").value) || 0;
  const precioEspecial = parseFloat(document.getElementById("set-dtf-precio-especial").value) || 0;
  const ancho = parseFloat(document.getElementById("set-dtf-ancho").value) || 1;
  const cm2 = precio / (100 * ancho);
  const cm2Especial = precioEspecial / (100 * ancho);
  document.getElementById("preview-costo-cm2").textContent = "$" + cm2.toFixed(4);
  document.getElementById("preview-costo-ejemplo").textContent = fmt(cm2 * 30 * 40);
  const previewEspecialEl = document.getElementById("preview-costo-especial-ejemplo");
  if (previewEspecialEl) previewEspecialEl.textContent = fmt(cm2Especial * 30 * 40);
}
document.getElementById("set-dtf-precio").addEventListener("input", updateCostPreview);
document.getElementById("set-dtf-precio-especial").addEventListener("input", updateCostPreview);
document.getElementById("set-dtf-ancho").addEventListener("input", updateCostPreview);
function saveSettings() {
  AppState.settings.dtfPrecioMetro = parseFloat(num("set-dtf-precio")) || 0;
  AppState.settings.dtfPrecioMetroEspecial = parseFloat(num("set-dtf-precio-especial")) || 0;
  AppState.settings.dtfAnchoRolloCm = parseFloat(num("set-dtf-ancho")) || 1;
  AppState.settings.sobrecargo2XLMonto = parseFloat(num("set-sobrecargo-2xl")) || 0;
  AppState.settings.stockMinimoDefault = parseInt(num("set-stock-minimo-default")) || 0;
  AppState.settings.gangSheetPrecioMetro = parseFloat(num("set-gangsheet-precio")) || 0;
  AppState.settings.gangSheetBlancoSolidoPrecioMetro = parseFloat(num("set-gangsheet-blanco-precio")) || 0;
  AppState.settings.recargoUrgentePct = Math.max(0, parseFloat(num("set-recargo-urgente")) || 0);
  AppState.settings.comisionTerminalPct = Math.max(0, parseFloat(num("set-comision-terminal")) || 0);
  AppState.settings.umbralLlenadoPct = Math.max(0, Math.min(100, parseFloat(num("set-umbral-llenado")) || 0));
  AppState.settings.moneda = val("set-moneda") || "MXN";
  saveState();
  showToast("Ajustes guardados. Los costos se recalculan automáticamente.");
  renderPlayeras(); renderStickers(); renderQuoteItems();
}

/* =================================================================
   BAZARES / LUGARES DE VENTA
================================================================= */
function openModalBazar(id) {
  setVal("b-id", id || "");
  document.getElementById("modal-bazar-title").textContent = id ? "Editar bazar / lugar" : "Nuevo bazar / lugar";
  if (id) {
    const b = AppState.bazares.find(x => x.id === id);
    const fechaInicio = b.fechaInicio || b.fecha || new Date().toISOString().slice(0,10);
    setVal("b-nombre", b.nombre); setVal("b-lugar", b.lugar); setVal("b-fecha", fechaInicio); setVal("b-fecha-fin", b.fechaFin || fechaInicio);
    setVal("b-costo", b.costoBaseBazar ?? b.costoBazar ?? 0); setVal("b-pagado", b.montoPagadoBazar || 0);
    setVal("b-fondo-caja", b.fondoCaja || 0); setVal("b-notas", b.notas || "");
    renderBazarExpenses(b.gastos || []);
  } else {
    const fechaHoy = new Date().toISOString().slice(0,10);
    setVal("b-nombre", ""); setVal("b-lugar", ""); setVal("b-fecha", fechaHoy); setVal("b-fecha-fin", fechaHoy);
    setVal("b-costo", 0); setVal("b-pagado", 0); setVal("b-fondo-caja", 0); setVal("b-notas", ""); renderBazarExpenses([]);
  }
  updateBazarCostTotal();
  openModal("modal-bazar");
}
function onBazarFechaInicioChange() {
  const inicio = val("b-fecha");
  const fin = document.getElementById("b-fecha-fin");
  if (fin && (!fin.value || fin.value < inicio)) fin.value = inicio;
}
function getBazarExpensesFromForm() {
  return [...document.querySelectorAll("#bazar-expenses-list .bazar-expense-row")]
    .map(row => ({
      id: row.dataset.id || uid(),
      nombre: row.querySelector(".bazar-expense-name").value.trim(),
      monto: Number.parseFloat(row.querySelector(".bazar-expense-amount").value) || 0,
      tipo: row.querySelector(".bazar-expense-tipo").value || "evento"
    }))
    .filter(gasto => gasto.nombre || gasto.monto > 0);
}
function renderBazarExpenses(gastos) {
  const list = document.getElementById("bazar-expenses-list");
  const empty = document.getElementById("bazar-expenses-empty");
  const opcionesTipo = GASTOS_BAZAR_TIPOS.map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join("");
  list.innerHTML = (gastos || []).map(gasto => `
    <div class="bazar-expense-row" data-id="${escapeHtml(gasto.id || uid())}">
      <input type="text" class="form-input bazar-expense-name" value="${escapeHtml(gasto.nombre || "")}" placeholder="Nombre del gasto">
      <select class="form-select bazar-expense-tipo" onchange="updateBazarCostTotal()">${opcionesTipo}</select>
      <input type="number" class="form-input bazar-expense-amount" value="${gasto.monto || 0}" min="0" step="0.01" placeholder="Monto" oninput="updateBazarCostTotal()">
      <button type="button" class="bazar-expense-remove" onclick="removeBazarExpense(this)" title="Quitar gasto">✕</button>
    </div>`).join("");
  // el <select> no respeta el atributo value al inyectarse por innerHTML, así que se fija aparte
  [...list.querySelectorAll(".bazar-expense-row")].forEach((row, i) => {
    const tipo = (gastos && gastos[i] && gastos[i].tipo) || "evento";
    row.querySelector(".bazar-expense-tipo").value = tipo;
  });
  empty.style.display = gastos && gastos.length ? "none" : "block";
}
function addBazarExpense() {
  const gastos = getBazarExpensesFromForm();
  gastos.push({ id: uid(), nombre: "", monto: 0, tipo: "evento" });
  renderBazarExpenses(gastos);
  const names = document.querySelectorAll("#bazar-expenses-list .bazar-expense-name");
  names[names.length - 1]?.focus();
  updateBazarCostTotal();
}
function removeBazarExpense(button) {
  const row = button.closest(".bazar-expense-row");
  row.remove();
  const list = document.getElementById("bazar-expenses-list");
  document.getElementById("bazar-expenses-empty").style.display = list.children.length ? "none" : "block";
  updateBazarCostTotal();
}
// Suma TODO lo capturado (base + producción + evento) — este es el costo real
// en efectivo del bazar. El desglose por tipo es solo para que el usuario vea
// cuánto de eso fue material/DTF y cuánto fue del evento en sí; nada se excluye.
function updateBazarCostTotal() {
  const base = Number.parseFloat(num("b-costo")) || 0;
  const rows = [...document.querySelectorAll("#bazar-expenses-list .bazar-expense-row")];
  let produccion = 0, evento = 0;
  rows.forEach(row => {
    const monto = Number.parseFloat(row.querySelector(".bazar-expense-amount").value) || 0;
    const tipo = row.querySelector(".bazar-expense-tipo").value;
    if (tipo === "produccion") produccion += monto; else evento += monto;
  });
  const total = base + produccion + evento;
  const pagado = Math.max(0, num("b-pagado"));
  const totalEl = document.getElementById("b-costo-total");
  const pendienteEl = document.getElementById("b-costo-pendiente");
  const breakdownEl = document.getElementById("b-costo-breakdown");
  if (totalEl) totalEl.textContent = fmt(total);
  if (pendienteEl) pendienteEl.textContent = fmt(Math.max(0, total - pagado));
  if (breakdownEl) {
    breakdownEl.textContent = `Puesto: ${fmt(base)} · 🧵 Producción: ${fmt(produccion)} · 🎪 Evento: ${fmt(evento)}`;
  }
}
function saveBazar() {
  const nombre = val("b-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al bazar.", "error");
  const id = val("b-id");
  const fechaInicio = val("b-fecha");
  const fechaFin = val("b-fecha-fin") || fechaInicio;
  if (fechaFin < fechaInicio) return showToast("La fecha final no puede ser anterior a la fecha de inicio.", "error");
  const gastos = getBazarExpensesFromForm();
  const costoBaseBazar = Number.parseFloat(num("b-costo")) || 0;
  const data = {
    nombre, lugar: val("b-lugar"), fecha: fechaInicio, fechaInicio, fechaFin,
    costoBaseBazar, montoPagadoBazar: Math.max(0, num("b-pagado")), fondoCaja: Math.max(0, num("b-fondo-caja")), gastos,
    costoBazar: costoBaseBazar + gastos.reduce((total, gasto) => total + gasto.monto, 0), notas: val("b-notas")
  };
  let newId = id;
  if (id) {
    Object.assign(AppState.bazares.find(x => x.id === id), data);
  } else {
    newId = uid();
    AppState.bazares.push(Object.assign({ id: newId, ingresosExtra: [] }, data));
    activeBazarId = newId; // el bazar recién creado se vuelve el activo automáticamente
  }
  saveState(); closeModal("modal-bazar"); renderBazares(); refreshAllSelects();
  if (document.getElementById("page-bazar-detalle").classList.contains("active")) renderBazarDetalle();
  if (assignmentModalContext) {
    const context = assignmentModalContext;
    assignmentModalContext = null;
    if (context.type === "playera") openModalAsignarPlayeraBazar(context.id);
    if (context.type === "cotizacion") openModalAsignarBazar(context.id);
  }
  showToast("Bazar guardado.");
}
function deleteBazar(id) {
  if (!confirm("¿Eliminar este bazar? Las cotizaciones y playeras ligadas quedarán sin bazar asignado.")) return;
  AppState.bazares = AppState.bazares.filter(x => x.id !== id);
  AppState.cotizaciones.forEach(c => {
    c.bazarIds = bazarIdsDe(c).filter(bazarId => bazarId !== id);
    c.bazarId = c.bazarIds[0] || "";
  });
  AppState.playeras.forEach(p => {
    p.bazarIds = bazarIdsDe(p).filter(bazarId => bazarId !== id);
    p.bazarId = p.bazarIds[0] || "";
  });
  if (activeBazarId === id) activeBazarId = "";
  saveState(); renderBazares(); refreshAllSelects(); renderCotizacionesGuardadas(); renderPlayeras();
}
function deleteBazarFromDetalle() {
  if (!activeBazarId) return;
  deleteBazar(activeBazarId);
  switchPage("bazares");
}
function renderAssignmentBazares(selectedIds) {
  const list = document.getElementById("ab-bazares-list");
  if (!list) return;
  const selected = selectedIds || [];
  list.innerHTML = AppState.bazares.length
    ? AppState.bazares.map(b => `
      <label class="assignment-bazar-option">
        <input type="checkbox" class="ab-bazar-option" value="${b.id}" ${selected.includes(b.id) ? "checked" : ""}>
        <span>🏪 ${escapeHtml(b.nombre)}</span>
      </label>`).join("")
    : `<div class="assignment-bazar-empty">Aún no hay bazares. Usa “+ Agregar bazar”.</div>`;
}
function openModalBazarDesdeAsignacion() {
  const playeraId = val("ab-playera-id");
  const cotizacionId = val("ab-cotizacion-id");
  assignmentModalContext = playeraId
    ? { type: "playera", id: playeraId }
    : cotizacionId ? { type: "cotizacion", id: cotizacionId } : null;
  openModalBazar();
}
function goToBazarDetalle(id) {
  activeBazarId = id;
  renderHeaderBazarSelect();
  switchPage("bazar-detalle");
  renderBazarDetalle();
}
// Envoltura para el botón "Editar" de la página de detalle de bazar: no se puede
// referenciar directamente la variable de módulo `activeBazarId` desde HTML inline.
function editActiveBazar() {
  openModalBazar(activeBazarId);
}
// Guarda el efectivo contado al cerrar la caja de este bazar y refresca la comparación
// contra el efectivo esperado (fondo de caja + ventas en efectivo).
function updateEfectivoContadoBazar(value) {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) return;
  b.efectivoContado = value === "" ? null : Math.max(0, parseFloat(value) || 0);
  saveState();
  renderBazarDetalle();
}

/* ---------------------------------------------------------------
   CAJA (registradora): bazar específico o caja general sin bazar
--------------------------------------------------------------- */
// Qué se está viendo en la página Caja: "general" (ventas sin bazar) o el id de un bazar.
let cajaSeleccion = "general";
function renderCaja() {
  const sel = document.getElementById("caja-selector");
  if (!sel) return;
  // Si el bazar que estaba seleccionado ya no existe, regresa a la caja general.
  if (cajaSeleccion !== "general" && !AppState.bazares.some(b => b.id === cajaSeleccion)) cajaSeleccion = "general";
  if (document.activeElement !== sel) {
    sel.innerHTML = `<option value="general">💰 Caja general (ventas sin bazar)</option>` +
      AppState.bazares.map(b => `<option value="${b.id}">🏪 ${escapeHtml(b.nombre)}</option>`).join("");
    sel.value = cajaSeleccion;
  } else {
    cajaSeleccion = sel.value;
  }
  const esGeneral = cajaSeleccion === "general";
  const bazar = esGeneral ? null : AppState.bazares.find(b => b.id === cajaSeleccion);
  const d = esGeneral ? desgloseCierreCajaGeneral() : desgloseCierreBazar(bazar);
  document.getElementById("caja-total-vendido").textContent = fmt(d.totalVendido);
  document.getElementById("caja-total-sub").textContent = esGeneral ? "ventas que no están ligadas a ningún bazar" : `ventas ligadas a ${bazar.nombre}`;
  document.getElementById("caja-efectivo").textContent = fmt(d.ventasEfectivo);
  document.getElementById("caja-tarjeta").textContent = fmt(d.ventasTarjeta);
  document.getElementById("caja-comision-sub").textContent = `comisión de terminal: ${fmt(d.comisionTerminal)}`;
  document.getElementById("caja-esperado").textContent = fmt(d.efectivoEsperado);
  document.getElementById("caja-fondo-hint").textContent = esGeneral
    ? "Cambio con el que abriste la caja."
    : "Es el mismo fondo de caja de este bazar — se edita desde aquí o desde el bazar.";
  setVal("caja-fondo", d.fondoCaja || "");
  setVal("caja-contado", d.efectivoContado ?? "");
  const difEl = document.getElementById("caja-diferencia");
  if (d.diferencia === null) {
    difEl.textContent = "Captura el efectivo contado para ver si cuadra la caja.";
    difEl.style.color = "";
  } else if (Math.abs(d.diferencia) < 0.01) {
    difEl.textContent = "✅ La caja cuadra exacto.";
    difEl.style.color = "var(--color-success)";
  } else if (d.diferencia > 0) {
    difEl.textContent = `Sobran ${fmt(d.diferencia)} respecto a lo esperado.`;
    difEl.style.color = "var(--color-success)";
  } else {
    difEl.textContent = `⚠️ Faltan ${fmt(Math.abs(d.diferencia))} respecto a lo esperado.`;
    difEl.style.color = "var(--color-danger)";
  }
}
// Guarda el fondo de caja donde corresponda: en la caja general, o en el bazar elegido
// (el mismo campo que usa el modal de bazar, para que ambos lugares queden sincronizados).
function updateFondoCaja(value) {
  const monto = value === "" ? 0 : Math.max(0, parseFloat(value) || 0);
  if (cajaSeleccion === "general") {
    AppState.cajaGeneral = Object.assign({ fondoCaja: 0, efectivoContado: null }, AppState.cajaGeneral, { fondoCaja: monto });
  } else {
    const b = AppState.bazares.find(x => x.id === cajaSeleccion);
    if (b) b.fondoCaja = monto;
  }
  saveState(); renderCaja(); renderBazarDetalle();
}
function updateEfectivoContadoCaja(value) {
  const monto = value === "" ? null : Math.max(0, parseFloat(value) || 0);
  if (cajaSeleccion === "general") {
    AppState.cajaGeneral = Object.assign({ fondoCaja: 0, efectivoContado: null }, AppState.cajaGeneral, { efectivoContado: monto });
  } else {
    const b = AppState.bazares.find(x => x.id === cajaSeleccion);
    if (b) b.efectivoContado = monto;
  }
  saveState(); renderCaja(); renderBazarDetalle();
}

/* =================================================================
   INTERÉS POR PRODUCTO (qué preguntaron más)
================================================================= */
let interesFiltro = "all";
let chartInteresProductos = null;
let chartInteresEtiquetas = null;
function renderInteres() {
  const sel = document.getElementById("interes-filtro");
  if (!sel) return;
  if (interesFiltro !== "all" && interesFiltro !== "none" && !AppState.bazares.some(b => b.id === interesFiltro)) interesFiltro = "all";
  if (document.activeElement !== sel) {
    sel.innerHTML = `<option value="all">Todas las consultas</option><option value="none">Solo sin bazar</option>` +
      AppState.bazares.map(b => `<option value="${b.id}">🏪 ${escapeHtml(b.nombre)}</option>`).join("");
    sel.value = interesFiltro;
  } else {
    interesFiltro = sel.value;
  }
  const ranking = rankingConsultas(interesFiltro);
  document.getElementById("interes-total").textContent = totalConsultas(interesFiltro);
  document.getElementById("interes-top").textContent = ranking.length ? ranking[0].nombre : "—";
  document.getElementById("interes-top-sub").textContent = ranking.length ? `${ranking[0].total} consulta(s)` : "aún sin consultas";

  // Etiquetas de consulta (chips con editar / eliminar)
  const etGrid = document.getElementById("consulta-etiquetas-grid");
  if (etGrid) {
    etGrid.innerHTML = AppState.consultaEtiquetas.map(e => `
      <div class="chip-item">
        <span class="chip-swatch" style="background:${e.color}"></span>
        <span>${escapeHtml(e.nombre)}</span>
        <button onclick="openModalConsultaEtiqueta('${e.id}')" title="Editar">✏️</button>
        <button onclick="deleteConsultaEtiqueta('${e.id}')" title="Eliminar">✕</button>
      </div>`).join("");
  }

  // Gráfica: ranking de productos (top 10)
  const top = ranking.slice(0, 10);
  const cvP = document.getElementById("chart-interes-productos");
  document.getElementById("chart-interes-productos-empty").style.display = top.length ? "none" : "block";
  cvP.style.display = top.length ? "block" : "none";
  if (chartInteresProductos) { chartInteresProductos.destroy(); chartInteresProductos = null; }
  if (top.length && typeof Chart !== "undefined") {
    chartInteresProductos = new Chart(cvP, {
      type: "bar",
      data: { labels: top.map(r => r.nombre), datasets: [{ label: "Consultas", data: top.map(r => r.total), backgroundColor: "#e3363d", borderRadius: 6 }] },
      options: { indexAxis: "y", responsive: true, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  // Gráfica: consultas por etiqueta
  const porEtiqueta = consultasPorEtiqueta(interesFiltro);
  const cvE = document.getElementById("chart-interes-etiquetas");
  document.getElementById("chart-interes-etiquetas-empty").style.display = porEtiqueta.length ? "none" : "block";
  cvE.style.display = porEtiqueta.length ? "block" : "none";
  if (chartInteresEtiquetas) { chartInteresEtiquetas.destroy(); chartInteresEtiquetas = null; }
  if (porEtiqueta.length && typeof Chart !== "undefined") {
    chartInteresEtiquetas = new Chart(cvE, {
      type: "doughnut",
      data: { labels: porEtiqueta.map(e => e.nombre), datasets: [{ data: porEtiqueta.map(e => e.total), backgroundColor: porEtiqueta.map(e => e.color) }] },
      options: { responsive: true }
    });
  }

  // Ranking con botones para ajustar rápidamente el conteo.
  document.getElementById("interes-ranking").innerHTML = ranking.map((r, i) => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${i === 0 ? "🔥 " : ""}${escapeHtml(r.nombre)}</span>
        <span class="card-badge badge-media">${r.total} consulta(s)</span>
      </div>
      <div class="card-actions">
        <button class="danger" onclick="quickSubtractConsulta('${escapeHtml(r.productoKey)}', '${escapeHtml(r.nombre).replace(/'/g, "\\'")}')">➖ −1 pregunta</button>
        <button onclick="quickAddConsulta('${escapeHtml(r.productoKey)}', '${escapeHtml(r.nombre).replace(/'/g, "\\'")}')">➕ +1 pregunta</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Todavía no registras consultas.</p>`;

  // Historial reciente
  const recientes = AppState.consultas
    .filter(c => interesFiltro === "all" || (interesFiltro === "none" ? !c.bazarId : c.bazarId === interesFiltro))
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.id.localeCompare(a.id))
    .slice(0, 15);
  document.getElementById("interes-historial").innerHTML = recientes.map(c => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(nombreProductoConsulta(c))}</span>
        <span class="card-badge badge-media">×${c.cantidad || 1}</span>
      </div>
      <div class="card-meta">📅 ${escapeHtml(c.fecha || "—")}${c.bazarId ? ` · 🏪 ${escapeHtml(bazarNombre(c.bazarId))}` : ""}</div>
      <div class="card-tags">${(c.tags || []).map(tid => {
        const e = AppState.consultaEtiquetas.find(x => x.id === tid);
        return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
      }).join("")}</div>
      ${c.notas ? `<div class="card-meta">${escapeHtml(c.notas)}</div>` : ""}
      <div class="card-actions"><button class="danger" onclick="deleteConsulta('${c.id}')">🗑️ Eliminar</button></div>
    </div>`).join("") || `<p class="empty-hint">Sin consultas registradas con este filtro.</p>`;
}
function openModalConsulta() {
  const prod = document.getElementById("consulta-producto");
  const opciones = [...AppState.playeras.map(p => ({ key: `p:${p.id}`, nombre: p.nombre, etiqueta: `👕 ${p.nombre}` })),
                    ...AppState.stickers.map(s => ({ key: `s:${s.id}`, nombre: s.nombre, etiqueta: `🏷️ ${s.nombre}` }))]
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  prod.innerHTML = `<option value="">✍️ Otro (escribir nombre)</option>` +
    opciones.map(o => `<option value="${o.key}">${escapeHtml(o.etiqueta)}</option>`).join("");
  prod.value = "";
  setVal("consulta-nombre", ""); setVal("consulta-cantidad", 1);
  setVal("consulta-fecha", new Date().toISOString().slice(0, 10)); setVal("consulta-notas", "");
  document.getElementById("consulta-bazar").innerHTML = `<option value="">— Sin bazar —</option>` +
    AppState.bazares.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join("");
  // Si ya estás viendo un bazar específico en el filtro, lo preselecciona.
  setVal("consulta-bazar", (interesFiltro !== "all" && interesFiltro !== "none") ? interesFiltro : "");
  document.getElementById("consulta-tags-container").innerHTML = AppState.consultaEtiquetas.map(e => `
    <label class="tag-checkbox" style="border-color:${e.color}">
      <input type="checkbox" value="${e.id}" class="consulta-tag-cb"> ${escapeHtml(e.nombre)}
    </label>`).join("") || `<span class="card-meta">Crea una etiqueta primero.</span>`;
  onConsultaProductoChange();
  openModal("modal-consulta");
}
function onConsultaProductoChange() {
  document.getElementById("consulta-nombre-wrap").style.display = val("consulta-producto") ? "none" : "block";
}
function saveConsulta() {
  const productoKey = val("consulta-producto");
  let nombre = val("consulta-nombre").trim();
  if (productoKey) {
    const [tk, id] = productoKey.split(":");
    const obj = tk === "p" ? AppState.playeras.find(x => x.id === id) : AppState.stickers.find(x => x.id === id);
    nombre = obj ? obj.nombre : nombre;
  }
  if (!nombre) return showToast("Indica por qué producto preguntaron.", "error");
  AppState.consultas.push({
    id: uid(), productoKey, nombre,
    cantidad: Math.max(1, parseInt(num("consulta-cantidad")) || 1),
    fecha: val("consulta-fecha"), bazarId: val("consulta-bazar") || "",
    tags: Array.from(document.querySelectorAll(".consulta-tag-cb:checked")).map(cb => cb.value),
    notas: val("consulta-notas")
  });
  saveState(); closeModal("modal-consulta"); renderInteres();
  showToast("Consulta registrada.");
}
// Registro rápido: suma una consulta más a un producto con un toque, ligada al bazar que
// estés filtrando (o sin bazar si el filtro es "todas" / "sin bazar").
function quickAddConsulta(productoKey, nombre) {
  AppState.consultas.push({
    id: uid(), productoKey: productoKey || "", nombre, cantidad: 1,
    fecha: new Date().toISOString().slice(0, 10),
    bazarId: (interesFiltro !== "all" && interesFiltro !== "none") ? interesFiltro : "",
    tags: [], notas: ""
  });
  saveState(); renderInteres();
}
function quickSubtractConsulta(productoKey, nombre) {
  const nombreNormalizado = nombre.trim().toLowerCase();
  const consulta = AppState.consultas
    .filter(c => (interesFiltro === "all" || (interesFiltro === "none" ? !c.bazarId : c.bazarId === interesFiltro)))
    .filter(c => productoKey ? c.productoKey === productoKey :
      !c.productoKey && nombreProductoConsulta(c).toLowerCase() === nombreNormalizado)
    .sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.id.localeCompare(a.id))[0];
  if (!consulta) return;

  if ((consulta.cantidad || 1) > 1) consulta.cantidad -= 1;
  else AppState.consultas = AppState.consultas.filter(c => c.id !== consulta.id);
  saveState(); renderInteres();
  showToast("Se restó una pregunta.");
}
function deleteConsulta(id) {
  AppState.consultas = AppState.consultas.filter(x => x.id !== id);
  saveState(); renderInteres();
}
function openModalConsultaEtiqueta(id) {
  setVal("cqt-id", id || "");
  document.getElementById("modal-consulta-etiqueta-title").textContent = id ? "Editar etiqueta de consulta" : "Nueva etiqueta de consulta";
  if (id) {
    const e = AppState.consultaEtiquetas.find(x => x.id === id);
    setVal("cqt-nombre", e.nombre); setVal("cqt-color", e.color);
  } else {
    setVal("cqt-nombre", ""); setVal("cqt-color", "#e0a23a");
  }
  openModal("modal-consulta-etiqueta");
}
function saveConsultaEtiqueta() {
  const nombre = val("cqt-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre a la etiqueta.", "error");
  const id = val("cqt-id");
  const data = { nombre, color: val("cqt-color") };
  if (id) Object.assign(AppState.consultaEtiquetas.find(x => x.id === id), data);
  else AppState.consultaEtiquetas.push(Object.assign({ id: uid() }, data));
  saveState(); closeModal("modal-consulta-etiqueta"); renderInteres();
  showToast("Etiqueta guardada.");
}
function deleteConsultaEtiqueta(id) {
  if (!confirm("¿Eliminar esta etiqueta? Se quitará de las consultas que la usan.")) return;
  AppState.consultaEtiquetas = AppState.consultaEtiquetas.filter(x => x.id !== id);
  AppState.consultas.forEach(c => { c.tags = (c.tags || []).filter(t => t !== id); });
  saveState(); renderInteres();
}

function renderBazares() {
  const body = document.getElementById("bazares-table-body");
  document.getElementById("bazares-empty-hint").style.display = AppState.bazares.length ? "none" : "block";
  body.innerHTML = AppState.bazares.map(b => {
    const stats = getBazarVentasYGanancia(b.id);
    const costoReal = costoBazarReal(b);
    const saldoPendiente = saldoBazarPendiente(b);
    const desglose = gastosBazarPorTipo(b);
    const sumIngresosExtra = (b.ingresosExtra || []).reduce((s, i) => s + (i.monto || 0), 0);
    const comisionTerminal = desgloseCierreBazar(b).comisionTerminal;
    const mermasBazar = totalMermasDeBazar(b.id);
    // Ganancia real = dinero que de verdad entró y salió del bolsillo (nunca usa el
    // costeo estimado por catálogo de cada playera, para no volver a contar el DTF/tela dos veces).
    const gananciaNeta = stats.totalVendido + sumIngresosExtra - costoReal - comisionTerminal - mermasBazar;
    const esActivo = activeBazarId === b.id;
    return `
    <tr class="${esActivo ? "is-active" : ""}">
      <td>
        <div class="bazar-name-cell">🏪 ${escapeHtml(b.nombre)} ${esActivo ? `<span class="card-badge badge-alta">Activo</span>` : ""}</div>
        <div class="card-meta">${escapeHtml(b.lugar || "—")} · ${rangoBazarFecha(b)}${costoReal ? ` · Costo real: ${fmt(costoReal)} · Pendiente: ${fmt(saldoPendiente)} (🧵 ${fmt(desglose.produccion)} · 🎪 ${fmt(desglose.evento)})` : ""}</div>
      </td>
      <td>${stats.cotsCount}</td>
      <td>${fmt(stats.totalVendido)}</td>
      <td style="color:${gananciaNeta>=0?'var(--color-success)':'var(--color-danger)'}">${fmt(gananciaNeta)}</td>
      <td>
        <div class="bazar-row-actions">
          <button class="${esActivo ? "active-badge" : ""}" onclick="goToBazarDetalle('${b.id}')">${esActivo ? "✓ Viendo" : "➡️ Ir al Bazar"}</button>
          <button onclick="openModalBazar('${b.id}')">✏️ Editar</button>
          <button class="danger" onclick="deleteBazar('${b.id}')">🗑️ Eliminar</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

/* =================================================================
   INVENTARIO DE PLAYERAS
================================================================= */
function refreshAllSelects() {
  // Color select en modal playera
  const colorSel = document.getElementById("p-color");
  colorSel.innerHTML = AppState.colores.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  // Filtro de color en inventario
  const filterColor = document.getElementById("filter-playera-color");
  filterColor.innerHTML = `<option value="all">Todos los colores</option>` +
    AppState.colores.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  // Filtro de talla (dinámico según playeras existentes)
  const tallas = [...new Set(AppState.playeras.map(p => p.talla).filter(Boolean))];
  const filterTalla = document.getElementById("filter-playera-talla");
  const currentTalla = filterTalla.value;
  filterTalla.innerHTML = `<option value="all">Todas las tallas</option>` +
    tallas.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
  filterTalla.value = tallas.includes(currentTalla) ? currentTalla : "all";
  // Tags en modal playera
  const tagsContainer = document.getElementById("p-tags-container");
  tagsContainer.innerHTML = AppState.etiquetas.map(e => `
    <label class="tag-checkbox" style="border-color:${e.color}">
      <input type="checkbox" value="${e.id}" class="p-tag-cb"> ${escapeHtml(e.nombre)}
    </label>`).join("") || `<span class="card-meta">Crea etiquetas en el apartado "Etiquetas y colores".</span>`;
  // Artista select en modal playera (por default SrLucas)
  const pArtista = document.getElementById("p-artista");
  if (pArtista) {
    pArtista.innerHTML = `<option value="">Sin artista (100% estudio)</option>` +
      AppState.artistas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)} (${a.pctArtista}%)</option>`).join("");
  }
  // Artista select en cotizador
  const qArtista = document.getElementById("q-artista");
  qArtista.innerHTML = `<option value="">Sin artista (100% estudio)</option>` +
    AppState.artistas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)} (${a.pctArtista}%)</option>`).join("") +
    `<option value="__custom__">Personalizado...</option>`;
  // Etiquetas operativas en el cotizador (Urgente, Retrabajo, etc.)
  renderQuoteTagsOperativos();
  // Selector global de bazar activo (header)
  renderHeaderBazarSelect();
  // Cliente select en el cotizador
  const qClienteSel = document.getElementById("q-cliente-select");
  if (qClienteSel) {
    const prevQCliente = qClienteSel.value;
    qClienteSel.innerHTML = `<option value="">— Cliente nuevo / sin guardar —</option>` +
      AppState.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
    qClienteSel.value = prevQCliente || "";
  }
  // Cliente (encargo) select en modal playera
  const pCliente = document.getElementById("p-cliente");
  if (pCliente) {
    pCliente.innerHTML = `<option value="">Sin cliente asignado</option>` +
      AppState.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  }
  // Cliente (encargo) select en modal sticker
  const sCliente = document.getElementById("s-cliente");
  if (sCliente) {
    sCliente.innerHTML = `<option value="">— Sin cliente asignado —</option>` +
      AppState.clientes.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)}</option>`).join("");
  }
  // Filtro de bazar en cotizaciones guardadas
  const filterCotBazar = document.getElementById("filter-cot-bazar");
  const prevFilterBazar = filterCotBazar.value;
  filterCotBazar.innerHTML = `<option value="all">Todos los bazares</option>` +
    AppState.bazares.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join("");
  filterCotBazar.value = prevFilterBazar || "all";
}
function renderPlayeraTagChips() {
  const container = document.getElementById("playera-tag-chips");
  container.innerHTML = AppState.etiquetas.map(e => `
    <button class="filter-chip ${uiFilters.playeraTag === e.id ? "active" : ""}" data-tag="${e.id}"
      onclick="setPlayeraTagFilter('${e.id}', this)" style="${uiFilters.playeraTag === e.id ? `background:${e.color};border-color:${e.color}` : ""}">
      ${escapeHtml(e.nombre)}
    </button>`).join("");
}
function setPlayeraTagFilter(tag, btn) {
  uiFilters.playeraTag = tag;
  document.querySelectorAll("#playera-tag-chips .filter-chip, .filter-bar > .filter-chip").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderPlayeraTagChips();
  document.querySelector('.filter-bar .filter-chip[data-tag="all"]').classList.toggle("active", tag === "all");
  renderPlayeras();
}

let playeraEstampadosDraft = [];
function onPlayeraModoCosteoChange() {
  const esGangSheet = val("p-modo-costeo") === "gangsheet";
  document.getElementById("p-area-wrap").style.display = esGangSheet ? "none" : "block";
  document.getElementById("p-gangsheet-wrap").style.display = esGangSheet ? "flex" : "none";
  updatePlayeraPreview();
}
function onPlayeraNumEstampadosChange() {
  const n = Math.max(1, parseInt(num("p-num-estampados")) || 1);
  while (playeraEstampadosDraft.length < n) playeraEstampadosDraft.push({ id: uid(), anchoCm: 0, largoCm: 0 });
  while (playeraEstampadosDraft.length > n) playeraEstampadosDraft.pop();
  renderPlayeraEstampadosList();
  updatePlayeraPreview();
}
function updatePlayeraEstampadoField(estId, field, value) {
  const e = playeraEstampadosDraft.find(x => x.id === estId);
  if (e) e[field] = parseFloat(value) || 0;
  updatePlayeraPreview();
}
function renderPlayeraEstampadosList() {
  const container = document.getElementById("p-estampados-list");
  if (!container) return;
  container.innerHTML = playeraEstampadosDraft.map((e, idx) => `
    <div class="estampado-row">
      <span class="estampado-row-label">#${idx + 1}</span>
      <input type="number" min="0" step="0.1" placeholder="Ancho cm" value="${e.anchoCm}" onchange="updatePlayeraEstampadoField('${e.id}','anchoCm',this.value)">
      <span>×</span>
      <input type="number" min="0" step="0.1" placeholder="Largo cm" value="${e.largoCm}" onchange="updatePlayeraEstampadoField('${e.id}','largoCm',this.value)">
    </div>`).join("");
}
function openModalPlayera(id) {
  setVal("p-id", id || "");
  document.getElementById("modal-playera-title").textContent = id ? "Editar playera" : "Nueva playera";
  refreshAllSelects();
  if (id) {
    const p = AppState.playeras.find(x => x.id === id);
    setVal("p-nombre", p.nombre); setVal("p-tipo", p.tipo); setVal("p-talla", p.talla);
    setVal("p-color", p.colorId); setVal("p-stock", p.stock);
    setVal("p-costo-playera", p.costoPlayera);
    setChecked("p-tiene-etiqueta", p.tieneEtiquetaTalla);
    setChecked("p-prenda-cliente", !!p.prendaCliente);
    setChecked("p-dtf-especial", !!p.dtfEspecial);
    setVal("p-stock-minimo", p.stockMinimo ?? AppState.settings.stockMinimoDefault ?? 0);
    setVal("p-precio-venta", p.precioVenta); setVal("p-precio-mayoreo", p.precioMayoreo || ""); setVal("p-prioridad", p.prioridad); setVal("p-estado", p.estado);
    setVal("p-notas", p.notas || "");
    document.querySelectorAll(".p-tag-cb").forEach(cb => cb.checked = (p.tags || []).includes(cb.value));
    playeraEstampadosDraft = JSON.parse(JSON.stringify(p.estampados && p.estampados.length ? p.estampados : [{ id: uid(), anchoCm: 0, largoCm: 0 }]));
    setVal("p-num-estampados", playeraEstampadosDraft.length);
    setVal("p-modo-costeo", p.modoCosteo || "area");
    setVal("p-gangsheet-metros", p.gangSheetMetros || 0);
    setChecked("p-gangsheet-blanco-solido", !!p.gangSheetBlancoSolido);
    setVal("p-artista", p.artistaId !== undefined ? p.artistaId : "a1");
    setVal("p-pct-artista", p.pctArtista ?? 0);
    setVal("p-cliente", p.clienteId || "");
  } else {
    ["p-nombre","p-notas"].forEach(f => setVal(f, ""));
    setVal("p-tipo", "Playera"); setVal("p-talla", ""); setVal("p-stock", 1);
    setVal("p-costo-playera", 47.5);
    setChecked("p-tiene-etiqueta", true);
    setChecked("p-prenda-cliente", false); setChecked("p-dtf-especial", false);
    setVal("p-stock-minimo", AppState.settings.stockMinimoDefault || 0);
    setVal("p-precio-venta", ""); setVal("p-precio-mayoreo", ""); setVal("p-prioridad", "Media"); setVal("p-estado", "En stock");
    playeraEstampadosDraft = [{ id: uid(), anchoCm: 0, largoCm: 0 }];
    setVal("p-num-estampados", 1);
    setVal("p-modo-costeo", "area");
    setVal("p-gangsheet-metros", 0);
    setChecked("p-gangsheet-blanco-solido", false);
    setVal("p-artista", "a1");
    setVal("p-pct-artista", (AppState.artistas.find(a => a.id === "a1") || {}).pctArtista || 0);
    setVal("p-cliente", "");
  }
  document.getElementById("p-costo-playera").disabled = checked("p-prenda-cliente");
  renderPlayeraEstampadosList();
  onPlayeraModoCosteoChange();
  onPlayeraTieneEtiquetaChange();
  openModal("modal-playera");
}
function onPrendaClienteChange() {
  const esCliente = checked("p-prenda-cliente");
  const input = document.getElementById("p-costo-playera");
  input.disabled = esCliente;
  if (esCliente) input.value = 0;
  updatePlayeraPreview();
}
// Al elegir un artista distinto, se rellena su % de comisión por default (tomado de su
// ficha en Artistas y comisiones), pero el campo se puede sobreescribir a mano — son los
// "2 campos" pedidos: 1) quién es el artista, 2) qué % le toca en esta playera.
function onPlayeraArtistChange() {
  const artistaId = val("p-artista");
  const a = AppState.artistas.find(x => x.id === artistaId);
  setVal("p-pct-artista", a ? a.pctArtista : 0);
  updatePlayeraPreview();
}
function updatePlayeraPreview() {
  const draft = {
    modoCosteo: val("p-modo-costeo"),
    dtfEspecial: checked("p-dtf-especial"),
    estampados: playeraEstampadosDraft,
    gangSheetMetros: num("p-gangsheet-metros"),
    gangSheetBlancoSolido: checked("p-gangsheet-blanco-solido")
  };
  const cEst = costoImpresion(draft);
  const costoBase = checked("p-prenda-cliente") ? 0 : num("p-costo-playera");
  const sobrecargo = sobrecargoTalla(val("p-talla"));
  // Si esta playera ya está vinculada a un gasto real (ej. "1 metro de DTF" repartido
  // entre varias piezas), el costo real vinculado manda sobre el estimado por área —
  // tanto en el costo total como en la ganancia — igual que hace costoImpresionEfectivoPlayera()
  // en calculator.js. El estimado se sigue mostrando aparte, solo como referencia.
  const existing = AppState.playeras.find(p => p.id === val("p-id"));
  const costoRealVinculado = existing?.costoImpresionManual ?? null;
  const cImpresionEfectivo = costoRealVinculado !== null ? costoRealVinculado : cEst;
  const cTotal = costoBase + cImpresionEfectivo + sobrecargo;
  const ganancia = num("p-precio-venta") - cTotal;
  const etiquetaCosto = draft.modoCosteo === "gangsheet" ? "Costo Gang Sheet" : "Costo del estampado";
  const textoCosto = costoRealVinculado !== null
    ? `${etiquetaCosto} estimado: <b>${fmt(cEst)}</b> — Costo real vinculado: <b>${fmt(costoRealVinculado)}</b>`
    : `${etiquetaCosto}: <b>${fmt(cEst)}</b>`;
  const tipoGanancia = costoRealVinculado !== null ? "real" : "estimada";
  document.getElementById("p-cost-preview").innerHTML = textoCosto
    + (sobrecargo ? ` — Sobrecargo talla: <b>${fmt(sobrecargo)}</b>` : "")
    + ` — Costo total: <b>${fmt(cTotal)}</b> — Ganancia ${tipoGanancia}: <b>${fmt(ganancia)}</b>`;
  // Reparto de esa ganancia entre artista y estudio — el % siempre se aplica sobre la
  // ganancia (no sobre el precio de venta), tal como se calcula en el cotizador.
  const pct = Math.max(0, Math.min(100, num("p-pct-artista")));
  const parteArtista = ganancia * (pct / 100);
  const artistaSel = document.getElementById("p-artista");
  const nombreArtista = (artistaSel && artistaSel.value) ? (AppState.artistas.find(a => a.id === artistaSel.value) || {}).nombre : "";
  const comisionPreview = document.getElementById("p-comision-preview");
  if (comisionPreview) {
    comisionPreview.innerHTML = `Parte ${nombreArtista ? escapeHtml(nombreArtista) : "artista"} (${pct}%): <b>${fmt(parteArtista)}</b> — Parte estudio (${100 - pct}%): <b>${fmt(ganancia - parteArtista)}</b>`;
  }
}
// Libera (regresa al stock) lo que esta playera había reclamado de etiquetas de talla
// físicas, usando el objeto de consumo guardado en ELLA MISMA — nunca vuelve a adivinar
// por texto qué registro era, así que revertir siempre es exacto.
function liberarEtiquetaTallaDePlayera(playera) {
  const consumo = playera && playera.etiquetaTallaConsumo;
  if (!consumo) return;
  const t = AppState.tallaEtiquetas.find(x => x.id === consumo.tallaEtiquetaId);
  if (t) t.cantidad = (t.cantidad || 0) + consumo.cantidad;
  playera.etiquetaTallaConsumo = null;
}
// Llena el select de "Etiqueta de talla a usar" con cada etiqueta guardada y cuántas
// quedan disponibles. Si esta playera ya tenía una reclamada, el conteo se muestra
// sumando de vuelta lo que ella misma tiene apartado (para no verlo artificialmente
// bajo), y queda preseleccionada; si no, se sugiere la que coincide por talla/color,
// pero el usuario puede elegir cualquier otra a mano.
function renderPlayeraEtiquetaTallaOptions(playeraIdActual) {
  const sel = document.getElementById("p-etiqueta-talla-id");
  if (!sel) return;
  const p = playeraIdActual ? AppState.playeras.find(x => x.id === playeraIdActual) : null;
  const consumoActual = p ? p.etiquetaTallaConsumo : null;
  if (!AppState.tallaEtiquetas.length) {
    sel.innerHTML = `<option value="">— No hay etiquetas de talla registradas —</option>`;
    return;
  }
  sel.innerHTML = AppState.tallaEtiquetas.map(t => {
    const disponible = (t.cantidad || 0) + (consumoActual && consumoActual.tallaEtiquetaId === t.id ? consumoActual.cantidad : 0);
    return `<option value="${t.id}">${escapeHtml(t.talla)} · ${escapeHtml(t.color)} (quedan ${disponible})</option>`;
  }).join("");
  if (consumoActual) {
    sel.value = consumoActual.tallaEtiquetaId;
  } else {
    const colorTxt = colorNombre(val("p-color"));
    const sugerida = AppState.tallaEtiquetas.find(t =>
      t.talla.trim().toLowerCase() === (val("p-talla") || "").trim().toLowerCase() && t.color === colorTxt);
    if (sugerida) sel.value = sugerida.id;
  }
}
function onPlayeraTieneEtiquetaChange() {
  const on = checked("p-tiene-etiqueta");
  document.getElementById("p-etiqueta-talla-wrap").style.display = on ? "block" : "none";
  if (on) renderPlayeraEtiquetaTallaOptions(val("p-id"));
  updatePlayeraPreview();
}
// Reclama (descuenta del stock físico) la etiqueta de talla que el usuario eligió a mano
// en el select — ya no se adivina por texto — y guarda en la propia playera un OBJETO
// { tallaEtiquetaId, talla, color, cantidad } con exactamente qué se usó, así sabes
// cuántas se disminuyeron por esta playera en particular, sin ambigüedad.
function reclamarEtiquetaTallaParaPlayera(playera) {
  if (!playera.tieneEtiquetaTalla) return;
  const tallaEtiquetaId = val("p-etiqueta-talla-id");
  const t = AppState.tallaEtiquetas.find(x => x.id === tallaEtiquetaId);
  if (!t) {
    showToast(`Elige qué etiqueta de talla usar, o créala en Catálogo > Etiquetas de talla.`, "error");
    return;
  }
  const cantidad = Math.max(1, playera.stock || 1);
  t.cantidad = Math.max(0, (t.cantidad || 0) - cantidad);
  playera.etiquetaTallaConsumo = { tallaEtiquetaId: t.id, talla: t.talla, color: t.color, cantidad };
  if (t.cantidad === 0) showToast(`⚠️ Se agotaron las etiquetas de talla ${t.talla} · ${t.color}.`, "error");
}
function savePlayera() {
  const nombre = val("p-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al diseño.", "error");
  const id = val("p-id");
  const existing = id ? AppState.playeras.find(x => x.id === id) : null;
  const tags = Array.from(document.querySelectorAll(".p-tag-cb:checked")).map(cb => cb.value);
  const prendaCliente = checked("p-prenda-cliente");
  const data = {
    nombre, tipo: val("p-tipo"), talla: val("p-talla").trim(), colorId: val("p-color"),
    stock: parseInt(num("p-stock")) || 0,
    costoPlayera: prendaCliente ? 0 : (parseFloat(num("p-costo-playera")) || 0),
    estampados: JSON.parse(JSON.stringify(playeraEstampadosDraft)),
    modoCosteo: val("p-modo-costeo") || "area",
    gangSheetMetros: parseFloat(num("p-gangsheet-metros")) || 0,
    gangSheetBlancoSolido: checked("p-gangsheet-blanco-solido"),
    tieneEtiquetaTalla: checked("p-tiene-etiqueta"),
    prendaCliente, dtfEspecial: checked("p-dtf-especial"),
    stockMinimo: parseInt(num("p-stock-minimo")) || 0,
    precioVenta: parseFloat(num("p-precio-venta")) || 0,
    precioMayoreo: parseFloat(num("p-precio-mayoreo")) || 0,
    prioridad: val("p-prioridad"), estado: val("p-estado"),
    artistaId: val("p-artista") || "",
    pctArtista: Math.max(0, Math.min(100, parseFloat(num("p-pct-artista")) || 0)),
    clienteId: val("p-cliente") || "",
    costoImpresionManual: (existing && existing.costoImpresionManual != null) ? existing.costoImpresionManual : null,
    gastoVinculadoId: (existing && existing.gastoVinculadoId) || "",
    bazarId: (existing && existing.bazarId) || "",
    bazarIds: (existing && bazarIdsDe(existing)) || [],
    bazarEstado: (existing && existing.bazarEstado) || "Disponible",
    tags, notas: val("p-notas")
  };
  if (id) {
    // Libera lo que esta playera ya había reclamado ANTES de aplicar los datos nuevos,
    // para que el reclamo se recalcule limpio (por si cambió talla, color, stock o el
    // toggle de etiqueta cosida).
    liberarEtiquetaTallaDePlayera(existing);
    Object.assign(existing, data);
    reclamarEtiquetaTallaParaPlayera(existing);
  } else {
    const nueva = Object.assign({ id: uid() }, data);
    reclamarEtiquetaTallaParaPlayera(nueva);
    AppState.playeras.push(nueva);
  }
  saveState(); closeModal("modal-playera"); refreshAllSelects(); renderPlayeras(); renderTallaEtiquetas();
  showToast("Playera guardada.");
}
function deletePlayera(id) {
  if (!confirm("¿Eliminar esta playera del inventario?")) return;
  const p = AppState.playeras.find(x => x.id === id);
  liberarEtiquetaTallaDePlayera(p);
  AppState.playeras = AppState.playeras.filter(x => x.id !== id);
  saveState(); renderPlayeras(); renderTallaEtiquetas();
}
// Banner en Inventario > Playeras cuando alguna "Bolsa sorpresa" (por tipo o etiqueta)
// llegó a su stock mínimo — suelen ser piezas de venta por impulso que se agotan sin
// que se note en el resto del inventario.
function renderAlertaPlayerasSorpresa() {
  const cont = document.getElementById("playeras-sorpresa-alerta");
  if (!cont) return;
  const bajas = playerasSorpresaBajoStock();
  if (!bajas.length) { cont.innerHTML = ""; return; }
  cont.innerHTML = `
    <div class="stock-alerta-banner">
      <span>🎁⚠️</span>
      <span>
        <b>${bajas.length} bolsa${bajas.length > 1 ? "s" : ""} sorpresa con stock bajo:</b>
        ${bajas.map(p => `<a href="#" onclick="openModalPlayera('${p.id}');return false;">${escapeHtml(p.nombre)} (${p.stock || 0} pza)</a>`).join(", ")}
      </span>
    </div>`;
}
function renderPlayeras() {
  renderPlayeraTagChips();
  renderAlertaPlayerasSorpresa();
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  const estadoF = document.getElementById("filter-playera-estado").value;
  const colorF = document.getElementById("filter-playera-color").value;
  const tallaF = document.getElementById("filter-playera-talla").value;
  let list = AppState.playeras.filter(p => {
    if (uiFilters.playeraTag !== "all" && !(p.tags || []).includes(uiFilters.playeraTag)) return false;
    if (estadoF !== "all" && p.estado !== estadoF) return false;
    if (colorF !== "all" && p.colorId !== colorF) return false;
    if (tallaF !== "all" && p.talla !== tallaF) return false;
    if (searchTerm && !p.nombre.toLowerCase().includes(searchTerm)) return false;
    return true;
  });
  const prioridadColor = nombre => {
    const color = nombre.trim().toLocaleLowerCase();
    if (color === "negro") return 0;
    if (color === "blanco") return 1;
    return 2;
  };
  list.sort((a, b) => {
    const colorA = colorNombre(a.colorId);
    const colorB = colorNombre(b.colorId);
    const prioridad = prioridadColor(colorA) - prioridadColor(colorB);
    if (prioridad !== 0) return prioridad;
    const porColor = colorA.localeCompare(colorB, "es", { sensitivity: "base" });
    return porColor || a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });
  const grid = document.getElementById("playeras-grid");
  document.getElementById("playeras-empty-hint").style.display = list.length ? "none" : "block";
  grid.innerHTML = list.map(p => {
    const cEst = costoImpresion(p);
    const cTotal = costoTotalPlayera(p);
    const ganancia = p.precioVenta - cTotal;
    const comision = comisionPlayera(p);
    const nombreArtista = p.artistaId ? ((AppState.artistas.find(a => a.id === p.artistaId) || {}).nombre || "—") : "";
    const gastoLigado = p.gastoVinculadoId ? AppState.gastos.find(g => g.id === p.gastoVinculadoId) : null;
    const stockBajo = (p.stockMinimo || 0) > 0 && (p.stock || 0) <= p.stockMinimo;
    const esGangSheet = p.modoCosteo === "gangsheet";
    const etiquetaImpresion = esGangSheet
      ? `Gang Sheet (${(p.gangSheetMetros||0)} m${p.gangSheetBlancoSolido ? ", blanco sólido" : ""})`
      : `Estampado (${(p.estampados||[]).length} · ${areaTotalCm2(p.estampados).toFixed(0)} cm²)${p.dtfEspecial ? " ✨" : ""}`;
    const tagsHtml = (p.tags || []).map(tid => {
      const e = AppState.etiquetas.find(x => x.id === tid);
      return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
    }).join("");
    const bazarEstado = bazarIdsDe(p).length ? (p.bazarEstado || "Disponible") : "";
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(p.nombre)}</span>
        <span class="card-swatch" style="background:${colorHex(p.colorId)}" title="${colorNombre(p.colorId)}"></span>
      </div>
      <div class="card-meta">
        <span>${escapeHtml(p.tipo)}</span>·<span>Talla ${escapeHtml(p.talla) || "—"}</span>·<span>${colorNombre(p.colorId)}</span>
        ${p.tieneEtiquetaTalla ? `·<span>🏷️ ${p.etiquetaTallaConsumo ? `${p.etiquetaTallaConsumo.cantidad} etiqueta(s) usada(s)` : "con etiqueta"}</span>` : ""}
      </div>
      ${p.clienteId ? `<div class="card-meta">👤 Encargo para: ${escapeHtml(clienteNombre(p.clienteId) || "—")}</div>` : ""}
      ${p.consignacionId ? `<div class="card-meta">🤝 ${escapeHtml(nombreConsignacion(p.consignacionId))} · ${escapeHtml(p.consignacionEstado || "En consignación")}</div>` : ""}
      <div class="card-row"><span>Stock</span><span>${p.stock} pza(s)</span></div>
      <div class="card-row"><span>Costo playera</span><span>${p.prendaCliente ? "🎁 Prenda del cliente ($0.00)" : fmt(p.costoPlayera)}</span></div>
      <div class="card-row"><span>${etiquetaImpresion}${gastoLigado ? " (estimado)" : ""}</span><span>${fmt(cEst)}</span></div>
      ${gastoLigado ? `<div class="card-row"><span>🔗 Costo real (de "${escapeHtml(gastoLigado.concepto)}")</span><span style="color:var(--color-accent);">${fmt(p.costoImpresionManual)}</span></div>` : ""}
      ${gastoLigado && gastoLigado.pctLlenado != null ? `<div class="card-meta">📐 Lote al ${gastoLigado.pctLlenado}% de llenado del rollo</div>` : ""}
      <div class="card-row"><span>Costo total</span><span>${fmt(cTotal)}</span></div>
      <div class="card-row"><span>Precio de venta</span><span>${fmt(p.precioVenta)}</span></div>
      ${p.precioMayoreo ? `<div class="card-row"><span>Precio mayoreo</span><span>${fmt(p.precioMayoreo)}</span></div>` : ""}
      <div class="card-row"><span>Ganancia</span><span style="color:${ganancia >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt(ganancia)}</span></div>
      ${nombreArtista ? `<div class="card-row"><span>🎨 ${escapeHtml(nombreArtista)} (${comision.pctArtista}%)</span><span>${fmt(comision.parteArtista)}</span></div>` : ""}
      <div class="card-tags">
        <span class="card-badge ${estadoBadgeClass(p.estado)}">${p.estado}</span>
        <span class="card-badge ${prioridadBadgeClass(p.prioridad)}">${p.prioridad}</span>
        ${bazarEstado ? `<span class="card-badge ${bazarEstadoBadgeClass(bazarEstado)}">${bazarEstado === "Vendida" ? " Vendida✅" : bazarEstado === "Venta nula" ? "🎁 Venta nula" : "🟢 En bazar"}</span>` : ""}
        ${bazarIdsDe(p).length ? `<span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(p))}</span>` : ""}
        ${p.prendaCliente ? `<span class="card-badge badge-media">🎁 Prenda del cliente</span>` : ""}
        ${esGangSheet ? `<span class="card-badge badge-alta">🧻 Gang Sheet</span>` : (p.dtfEspecial ? `<span class="card-badge badge-alta">✨ DTF especial</span>` : "")}
        ${stockBajo ? `<span class="card-badge badge-agotado">⚠️ Stock bajo</span>` : ""}
        ${tagsHtml}
      </div>
      <div class="card-actions">
        <button onclick="openModalPlayera('${p.id}')">✏️ Editar</button>
        <button onclick="openModalAsignarPlayeraBazar('${p.id}')">🏪 Bazar</button>
        <button onclick="openModalAsignarConsignacion('${p.id}')">🤝 Consignar</button>
        ${gastoLigado ? `<button onclick="desvincularCostoRealDePieza('playera','${p.id}')">🔓 Desvincular costo real</button>` : ""}
        <button onclick="openModalMermaDesdePlayera('${p.id}')">📉 Merma</button>
        <button class="danger" onclick="deletePlayera('${p.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

/* =================================================================
   INVENTARIO DE STICKERS
================================================================= */
function openModalSticker(id) {
  setVal("s-id", id || "");
  document.getElementById("modal-sticker-title").textContent = id ? "Editar estampado" : "Nuevo estampado";
  refreshAllSelects();
  if (id) {
    const s = AppState.stickers.find(x => x.id === id);
    setVal("s-nombre", s.nombre); setVal("s-tamano", s.tamano); setVal("s-ancho", s.anchoCm || 0); setVal("s-largo", s.largoCm || 0); setVal("s-costo", s.costo);
    setVal("s-precio-venta", s.precioVenta || 0);
    setVal("s-stock", s.stock); setVal("s-stock-minimo", s.stockMinimo ?? AppState.settings.stockMinimoDefault ?? 0);
    setVal("s-prioridad", s.prioridad); setVal("s-estado", s.estado);
    setVal("s-cliente", s.clienteId || "");
    setVal("s-notas", s.notas || "");
  } else {
    setVal("s-nombre", ""); setVal("s-tamano", "Chico"); setVal("s-ancho", 5); setVal("s-largo", 5); setVal("s-costo", 0); setVal("s-precio-venta", 0);
    setVal("s-stock", 1); setVal("s-stock-minimo", AppState.settings.stockMinimoDefault || 0);
    setVal("s-prioridad", "Media"); setVal("s-estado", "En stock"); setVal("s-cliente", ""); setVal("s-notas", "");
  }
  updateStickerCostPreview();
  openModal("modal-sticker");
}
function updateStickerCostPreview() {
  const ancho = num("s-ancho");
  const largo = num("s-largo");
  const costo = ancho > 0 && largo > 0 ? costoEstampado([{ anchoCm: ancho, largoCm: largo }], false) : 0;
  const costoInput = document.getElementById("s-costo");
  if (costoInput && ancho > 0 && largo > 0) costoInput.value = costo.toFixed(2);
  const preview = document.getElementById("s-costo-preview");
  if (preview) preview.textContent = ancho > 0 && largo > 0 ? `Costo de producción calculado: ${fmt(costo)}` : "Captura ancho y largo para calcular el costo de producción.";
}
function saveSticker() {
  const nombre = val("s-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al estampado.", "error");
  const id = val("s-id");
  const anchoCm = Math.round(num("s-ancho") * 100) / 100;
  const largoCm = Math.round(num("s-largo") * 100) / 100;
  const costoCalculado = Math.round((anchoCm > 0 && largoCm > 0 ? costoEstampado([{ anchoCm, largoCm }], false) : num("s-costo")) * 100) / 100;
  const data = {
    nombre, tamano: val("s-tamano"), anchoCm, largoCm, costo: costoCalculado,
    precioVenta: Math.round(num("s-precio-venta") * 100) / 100,
    stock: parseInt(num("s-stock")) || 0, stockMinimo: parseInt(num("s-stock-minimo")) || 0,
    prioridad: val("s-prioridad"), estado: val("s-estado"),
    clienteId: val("s-cliente") || "",
    notas: val("s-notas")
  };
  if (id) {
    Object.assign(AppState.stickers.find(x => x.id === id), data);
  } else {
    AppState.stickers.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-sticker"); renderStickers();
  showToast("Estampado guardado.");
}
function deleteSticker(id) {
  if (!confirm("¿Eliminar este estampado?")) return;
  AppState.stickers = AppState.stickers.filter(x => x.id !== id);
  saveState(); renderStickers();
}
function quoteStickerFromInventory(id) {
  const sticker = AppState.stickers.find(item => item.id === id);
  if (!sticker) return;
  quoteStickerItems.push({
    rowId: uid(), stickerId: sticker.id, nombre: sticker.nombre, tamano: sticker.tamano,
    costo: sticker.costo || 0, cantidad: 1, precioVenta: sticker.precioVenta || sticker.costo || 0
  });
  switchPage("cotizador");
  renderQuoteItems();
  showToast("Sticker agregado al cotizador.");
}
function setStickerSizeFilter(size, btn) {
  uiFilters.stickerSize = size;
  document.querySelectorAll('#page-stickers .filter-chip').forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderStickers();
}
function renderStickers() {
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  const counts = { Chico: 0, Mediano: 0, Grande: 0 };
  AppState.stickers.forEach(s => { counts[s.tamano] = (counts[s.tamano] || 0) + (s.stock || 0); });
  document.getElementById("count-chico").textContent = counts.Chico;
  document.getElementById("count-mediano").textContent = counts.Mediano;
  document.getElementById("count-grande").textContent = counts.Grande;
  document.getElementById("count-total-disenos").textContent = AppState.stickers.length;

  let list = AppState.stickers.filter(s => {
    if (uiFilters.stickerSize !== "all" && s.tamano !== uiFilters.stickerSize) return false;
    if (searchTerm && !s.nombre.toLowerCase().includes(searchTerm)) return false;
    return true;
  });
  const grid = document.getElementById("stickers-grid");
  document.getElementById("stickers-empty-hint").style.display = list.length ? "none" : "block";
  grid.innerHTML = list.map(s => {
    const stockBajo = (s.stockMinimo || 0) > 0 && (s.stock || 0) <= s.stockMinimo;
    const gastoLigado = s.gastoVinculadoId ? AppState.gastos.find(g => g.id === s.gastoVinculadoId) : null;
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(s.nombre)}</span>
        <span class="card-badge badge-media">${s.tamano}</span>
      </div>
      <div class="card-row"><span>Costo${gastoLigado ? " real" : ""}</span><span style="${gastoLigado ? "color:var(--color-accent);" : ""}">${fmt(s.costo)}</span></div>
      ${gastoLigado ? `<div class="card-meta">🔗 vinculado a "${escapeHtml(gastoLigado.concepto)}"${gastoLigado.pctLlenado != null ? ` · lote al ${gastoLigado.pctLlenado}% de llenado` : ""}</div>` : ""}
      <div class="card-row"><span>Precio de venta</span><span>${fmt(s.precioVenta)}</span></div>
      <div class="card-row"><span>Ganancia</span><span style="color:${(s.precioVenta || 0) - (s.costo || 0) >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt((s.precioVenta || 0) - (s.costo || 0))}</span></div>
      <div class="card-row"><span>Stock</span><span>${s.stock} pza(s)</span></div>
      <div class="card-tags">
        <span class="card-badge ${estadoBadgeClass(s.estado)}">${s.estado}</span>
        <span class="card-badge ${prioridadBadgeClass(s.prioridad)}">${s.prioridad}</span>
        ${stockBajo ? `<span class="card-badge badge-agotado">⚠️ Stock bajo</span>` : ""}
      </div>
      ${s.clienteId ? `<div class="card-meta">👤 Encargo para: ${escapeHtml(clienteNombre(s.clienteId) || "—")}</div>` : ""}
      ${s.notas ? `<div class="card-meta">${escapeHtml(s.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="quoteStickerFromInventory('${s.id}')">🧮 Cotizar</button>
        <button onclick="openModalSticker('${s.id}')">✏️ Editar</button>
        ${gastoLigado ? `<button onclick="desvincularCostoRealDePieza('sticker','${s.id}')">🔓 Desvincular costo real</button>` : ""}
        <button class="danger" onclick="deleteSticker('${s.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

/* =================================================================
   COTIZADOR RÁPIDO
================================================================= */
let quoteItems = [];
let quoteStickerItems = [];
let quoteServiciosExtra = [];
let quoteTagsOperativos = [];
let editingQuoteItemRowId = null;

function toggleQuoteTagOperativo(tagId, isChecked) {
  if (isChecked) {
    if (!quoteTagsOperativos.includes(tagId)) quoteTagsOperativos.push(tagId);
  } else {
    quoteTagsOperativos = quoteTagsOperativos.filter(t => t !== tagId);
  }
}
function renderQuoteTagsOperativos() {
  const tagsOpContainer = document.getElementById("q-tags-operativos-container");
  if (!tagsOpContainer) return;
  tagsOpContainer.innerHTML = AppState.etiquetasOperativas.map(e => `
    <label class="tag-checkbox" style="border-color:${e.color}">
      <input type="checkbox" value="${e.id}" class="q-tag-op-cb" ${quoteTagsOperativos.includes(e.id) ? "checked" : ""} onchange="toggleQuoteTagOperativo('${e.id}', this.checked)"> ${escapeHtml(e.nombre)}
    </label>`).join("") || `<span class="card-meta">Crea etiquetas operativas en el apartado "Etiquetas y colores".</span>`;
}

function blankQuoteItem() {
  return { rowId: uid(), playeraId: "", nombre: "", tipo: "Playera", talla: "", colorId: "", cantidad: 1,
    estampados: [{ id: uid(), anchoCm: 0, largoCm: 0 }],
    modoCosteo: "area", gangSheetMetros: 0, gangSheetBlancoSolido: false,
    costoPlayera: 0, precioVenta: 0, costoEstampadoManual: null,
    prendaCliente: false, dtfEspecial: false };
}
function addQuoteItem() {
  quoteItems.push(blankQuoteItem());
  renderQuoteItems();
}
function addQuoteSticker() {
  const sticker = AppState.stickers.find(s => (s.stock || 0) > 0) || AppState.stickers[0];
  quoteStickerItems.push({
    rowId: uid(), stickerId: sticker ? sticker.id : "", nombre: sticker ? sticker.nombre : "",
    tamano: sticker ? sticker.tamano : "Chico", anchoCm: sticker ? (sticker.anchoCm || 0) : 0,
    largoCm: sticker ? (sticker.largoCm || 0) : 0, costo: sticker ? sticker.costo : 0,
    cantidad: 1, precioVenta: sticker ? (sticker.precioVenta || sticker.costo) : 0
  });
  renderQuoteItems();
}
function removeQuoteSticker(rowId) {
  quoteStickerItems = quoteStickerItems.filter(item => item.rowId !== rowId);
  renderQuoteItems();
}
function updateQuoteStickerField(rowId, field, value) {
  const item = quoteStickerItems.find(sticker => sticker.rowId === rowId);
  if (!item) return;
  if (field === "stickerId") {
    const sticker = AppState.stickers.find(s => s.id === value);
    item.stickerId = value; item.nombre = sticker ? sticker.nombre : "";
    item.tamano = sticker ? sticker.tamano : "Chico"; item.anchoCm = sticker ? (sticker.anchoCm || 0) : 0;
    item.largoCm = sticker ? (sticker.largoCm || 0) : 0; item.costo = sticker ? sticker.costo : 0;
    item.precioVenta = sticker ? (sticker.precioVenta || sticker.costo) : 0;
  } else if (["cantidad", "anchoCm", "largoCm", "precioVenta"].includes(field)) {
    item[field] = Math.max(0, Math.round((Number.parseFloat(value) || 0) * 100) / 100);
    if (field === "anchoCm" || field === "largoCm") {
      item.costo = item.anchoCm > 0 && item.largoCm > 0
        ? Math.round(costoEstampado([{ anchoCm: item.anchoCm, largoCm: item.largoCm }], false) * 100) / 100
        : 0;
    }
  } else {
    item[field] = value;
  }
  renderQuoteItems();
}
function removeQuoteItem(rowId) {
  quoteItems = quoteItems.filter(i => i.rowId !== rowId);
  renderQuoteItems();
}
function onQuoteItemProductChange(rowId, playeraId) {
  const item = quoteItems.find(i => i.rowId === rowId);
  item.playeraId = playeraId;
  if (playeraId) {
    const p = AppState.playeras.find(x => x.id === playeraId);
    if (p) {
      const esMayoreo = val("q-tipo-venta") === "Mayoreo";
      item.nombre = p.nombre; item.tipo = p.tipo; item.talla = p.talla; item.colorId = p.colorId;
      item.estampados = JSON.parse(JSON.stringify(p.estampados && p.estampados.length ? p.estampados : [{ id: uid(), anchoCm: 0, largoCm: 0 }]));
      item.modoCosteo = p.modoCosteo || "area";
      item.gangSheetMetros = p.gangSheetMetros || 0;
      item.gangSheetBlancoSolido = !!p.gangSheetBlancoSolido;
      item.costoPlayera = p.costoPlayera;
      item.precioVenta = esMayoreo ? (p.precioMayoreo || p.precioVenta || item.precioVenta) : (p.precioVenta || item.precioVenta);
      item.costoEstampadoManual = null;
      item.prendaCliente = !!p.prendaCliente;
      item.dtfEspecial = !!p.dtfEspecial;
    }
  }
  renderQuoteItems();
}
// Activa/desactiva las banderas "prenda del cliente" y "DTF especial" de una prenda de la cotización.
function toggleQuoteItemFlag(rowId, field, isChecked) {
  const item = quoteItems.find(i => i.rowId === rowId);
  if (!item) return;
  item[field] = isChecked;
  if (field === "prendaCliente" && isChecked) item.costoPlayera = 0;
  renderQuoteItems();
}
// Campos que solo se recalculan cuando el usuario da clic fuera del campo (evento "change"),
// así se pueden escribir decimales sin que la tabla se refresque en cada tecla.
function updateQuoteItemField(rowId, field, value) {
  const item = quoteItems.find(i => i.rowId === rowId);
  if (!item) return;
  const numericFields = ["cantidad","costoPlayera","precioVenta","costoEstampadoManual"];
  item[field] = numericFields.includes(field) ? (parseFloat(value) || 0) : value;
  renderQuoteItems();
}

/* -----------------------------------------------------------------
   ÁREAS / GANG SHEET DE UNA PRENDA DEL COTIZADOR
   Se editan en un modal aparte (en vez de columnas en la tabla) para
   no saturar la tabla, ya que una prenda puede tener varios estampados.
----------------------------------------------------------------- */
function updateQuoteItemNumEstampados(rowId, value) {
  const item = quoteItems.find(i => i.rowId === rowId);
  if (!item) return;
  const n = Math.max(1, parseInt(value) || 1);
  const estampados = item.estampados || [];
  while (estampados.length < n) estampados.push({ id: uid(), anchoCm: 0, largoCm: 0 });
  while (estampados.length > n) estampados.pop();
  item.estampados = estampados;
  item.costoEstampadoManual = null;
  renderQuoteItems();
}
// Envoltura para usarse desde el atributo onchange del modal: no se puede referenciar
// directamente la variable de módulo `editingQuoteItemRowId` desde HTML inline.
function updateQuoteEstampadosCountFromModal(value) {
  updateQuoteItemNumEstampados(editingQuoteItemRowId, value);
  renderQuoteEstampadosList();
}
function openModalQuoteEstampados(rowId) {
  editingQuoteItemRowId = rowId;
  const item = quoteItems.find(i => i.rowId === rowId);
  if (!item) return;
  document.getElementById("modal-quote-estampados-title").textContent = `Impresión — ${item.nombre || "prenda personalizada"}`;
  setVal("qe-modo-costeo", item.modoCosteo || "area");
  setChecked("qe-dtf-especial", !!item.dtfEspecial);
  setVal("qe-num-estampados", (item.estampados || []).length || 1);
  setVal("qe-gangsheet-metros", item.gangSheetMetros || 0);
  setChecked("qe-gangsheet-blanco-solido", !!item.gangSheetBlancoSolido);
  onQuoteEstampadoModoChange();
  renderQuoteEstampadosList();
  openModal("modal-quote-estampados");
}
function toggleQuoteAreaDtfEspecial(isChecked) {
  const item = quoteItems.find(i => i.rowId === editingQuoteItemRowId);
  if (!item) return;
  item.dtfEspecial = isChecked;
  renderQuoteItems();
}
function onQuoteEstampadoModoChange() {
  const item = quoteItems.find(i => i.rowId === editingQuoteItemRowId);
  if (!item) return;
  item.modoCosteo = val("qe-modo-costeo");
  const esGangSheet = item.modoCosteo === "gangsheet";
  document.getElementById("qe-area-wrap").style.display = esGangSheet ? "none" : "block";
  document.getElementById("qe-gangsheet-wrap").style.display = esGangSheet ? "flex" : "none";
  renderQuoteItems();
}
function updateQuoteEstampadoField(estId, field, value) {
  const item = quoteItems.find(i => i.rowId === editingQuoteItemRowId);
  if (!item) return;
  const e = (item.estampados || []).find(x => x.id === estId);
  if (e) e[field] = parseFloat(value) || 0;
  item.costoEstampadoManual = null;
  renderQuoteEstampadosList();
  renderQuoteItems();
}
function updateQuoteGangSheetField(field, value) {
  const item = quoteItems.find(i => i.rowId === editingQuoteItemRowId);
  if (!item) return;
  item[field] = field === "gangSheetBlancoSolido" ? value : (parseFloat(value) || 0);
  renderQuoteItems();
}
function renderQuoteEstampadosList() {
  const item = quoteItems.find(i => i.rowId === editingQuoteItemRowId);
  const container = document.getElementById("qe-estampados-list");
  if (!item || !container) return;
  container.innerHTML = (item.estampados || []).map((e, idx) => `
    <div class="estampado-row">
      <span class="estampado-row-label">#${idx + 1}</span>
      <input type="number" min="0" step="0.1" placeholder="Ancho cm" value="${e.anchoCm}" onchange="updateQuoteEstampadoField('${e.id}','anchoCm',this.value)">
      <span>×</span>
      <input type="number" min="0" step="0.1" placeholder="Largo cm" value="${e.largoCm}" onchange="updateQuoteEstampadoField('${e.id}','largoCm',this.value)">
    </div>`).join("");
  const totalEl = document.getElementById("qe-estampados-total");
  if (totalEl) totalEl.textContent = areaTotalCm2(item.estampados).toFixed(1) + " cm²";
}
function onQuoteArtistChange() {
  const artistaId = val("q-artista");
  const customWrap = document.getElementById("q-comision-custom-wrap");
  customWrap.style.display = artistaId === "__custom__" ? "block" : "none";
  renderQuoteItems();
}
function onQuoteTipoVentaChange() {
  // al cambiar de menudeo a mayoreo (o viceversa), refresca el precio de las prendas ya jaladas del inventario
  const esMayoreo = val("q-tipo-venta") === "Mayoreo";
  quoteItems.forEach(item => {
    if (!item.playeraId) return;
    const p = AppState.playeras.find(x => x.id === item.playeraId);
    if (p) item.precioVenta = esMayoreo ? (p.precioMayoreo || p.precioVenta) : p.precioVenta;
  });
  renderQuoteItems();
}
function onQuoteVentaNulaChange() {
  const esNula = checked("q-venta-nula");
  document.getElementById("q-venta-nula-motivo-wrap").style.display = esNula ? "block" : "none";
  document.getElementById("venta-nula-banner").style.display = esNula ? "block" : "none";
}
function currentQuoteCommission() {
  const artistaId = val("q-artista");
  if (!artistaId) return { pctArtista: 0, pctEstudio: 100, nombre: "" };
  if (artistaId === "__custom__") {
    const pct = num("q-comision-pct");
    return { pctArtista: pct, pctEstudio: 100 - pct, nombre: "Personalizado" };
  }
  const a = AppState.artistas.find(x => x.id === artistaId);
  return a ? { pctArtista: a.pctArtista, pctEstudio: a.pctEstudio, nombre: a.nombre } : { pctArtista: 0, pctEstudio: 100, nombre: "" };
}
function renderQuoteItems() {
  const body = document.getElementById("quote-items-body");
  const hasQuoteContent = quoteItems.length || quoteStickerItems.length;
  document.getElementById("quote-empty-hint").style.display = hasQuoteContent ? "none" : "block";
  const addSpace = document.getElementById("quote-add-space");
  if (addSpace) addSpace.style.display = hasQuoteContent ? "none" : "flex";
  const playeraOptions = AppState.playeras.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  body.innerHTML = quoteItems.map(item => {
    const cEst = getCostoEstampadoEfectivo(item);
    const cTotalUnit = costoUnitarioItem(item);
    const gananciaUnit = item.precioVenta - cTotalUnit;
    const esGangSheet = item.modoCosteo === "gangsheet";
    const numEstampados = (item.estampados || []).length;
    const impresionLabel = esGangSheet
      ? `🧻 ${item.gangSheetMetros || 0} m${item.gangSheetBlancoSolido ? " (blanco)" : ""}`
      : `📐 ${numEstampados}× · ${areaTotalCm2(item.estampados).toFixed(0)} cm²`;
    return `
    <tr>
      <td>
        <div class="quote-product-cell">
          <select onchange="onQuoteItemProductChange('${item.rowId}', this.value)">
            <option value="">— Manual / personalizado —</option>
            ${playeraOptions}
          </select>
          ${!item.playeraId ? `<input type="text" placeholder="Nombre" value="${escapeHtml(item.nombre)}" onchange="updateQuoteItemField('${item.rowId}','nombre',this.value)">` : `<div class="card-meta">${escapeHtml(item.nombre)}</div>`}
        </div>
      </td>
      <td>
        <select onchange="updateQuoteItemField('${item.rowId}','tipo',this.value)" style="min-width:110px;">
          ${TIPOS_PRENDA.map(t => `<option value="${t}" ${item.tipo===t?"selected":""}>${t}</option>`).join("")}
        </select>
      </td>
      <td><input type="text" value="${escapeHtml(item.talla)}" onchange="updateQuoteItemField('${item.rowId}','talla',this.value)" style="width:60px;"></td>
      <td>
        <select onchange="updateQuoteItemField('${item.rowId}','colorId',this.value)">
          <option value="">—</option>
          ${AppState.colores.map(c => `<option value="${c.id}" ${item.colorId===c.id?"selected":""}>${escapeHtml(c.nombre)}</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="1" step="1" value="${item.cantidad}" onchange="updateQuoteItemField('${item.rowId}','cantidad',this.value)" style="width:60px;"></td>
      <td style="text-align:center;" title="Prenda del cliente (costo de playera $0.00)">
        <input type="checkbox" ${item.prendaCliente ? "checked" : ""} onchange="toggleQuoteItemFlag('${item.rowId}','prendaCliente', this.checked)">
      </td>
      <td><input type="number" min="0" step="0.01" value="${item.costoPlayera}" ${item.prendaCliente ? "disabled" : ""} onchange="updateQuoteItemField('${item.rowId}','costoPlayera',this.value)" style="width:80px;"></td>
      <td>
        <button class="area-edit-btn" onclick="openModalQuoteEstampados('${item.rowId}')" title="Editar impresión (áreas o Gang Sheet)">${impresionLabel}</button>
        <div class="card-meta">${fmt(cEst)}</div>
      </td>
      <td><input type="number" min="0" step="0.01" value="${item.precioVenta}" onchange="updateQuoteItemField('${item.rowId}','precioVenta',this.value)" style="width:85px;"></td>
      <td class="readonly-cell" style="color:${gananciaUnit>=0?'var(--color-success)':'var(--color-danger)'}">${fmt(gananciaUnit * item.cantidad)}</td>
      <td><button class="remove-row" onclick="removeQuoteItem('${item.rowId}')" title="Quitar">✕</button></td>
    </tr>`;
  }).join("");

  const stickerBody = document.getElementById("quote-stickers-body");
  const stickerEmpty = document.getElementById("quote-stickers-empty");
  if (stickerBody) {
    const stickerOptions = AppState.stickers.map(sticker => `<option value="${sticker.id}">${escapeHtml(sticker.nombre)}</option>`).join("");
    stickerBody.innerHTML = quoteStickerItems.map(item => `
      <tr>
        <td>
          <div class="quote-product-cell">
            <select onchange="updateQuoteStickerField('${item.rowId}','stickerId',this.value)"><option value="">— Manual / personalizado —</option>${stickerOptions}</select>
            ${!item.stickerId ? `<input type="text" placeholder="Nombre del sticker" value="${escapeHtml(item.nombre)}" onchange="updateQuoteStickerField('${item.rowId}','nombre',this.value)">` : `<div class="card-meta">${escapeHtml(item.nombre)}</div>`}
          </div>
        </td>
        <td>${!item.stickerId ? `<select onchange="updateQuoteStickerField('${item.rowId}','tamano',this.value)"><option ${item.tamano === "Chico" ? "selected" : ""}>Chico</option><option ${item.tamano === "Mediano" ? "selected" : ""}>Mediano</option><option ${item.tamano === "Grande" ? "selected" : ""}>Grande</option></select>` : escapeHtml(item.tamano)}</td>
        <td><input type="number" min="0" step="0.01" value="${Number(item.anchoCm || 0).toFixed(2)}" onchange="updateQuoteStickerField('${item.rowId}','anchoCm',this.value)"></td>
        <td><input type="number" min="0" step="0.01" value="${Number(item.largoCm || 0).toFixed(2)}" onchange="updateQuoteStickerField('${item.rowId}','largoCm',this.value)"></td>
        <td><input type="number" min="1" step="1" value="${item.cantidad}" onchange="updateQuoteStickerField('${item.rowId}','cantidad',this.value)"></td>
        <td><input type="number" min="0" step="0.01" value="${Number(item.costo || 0).toFixed(2)}" readonly></td>
        <td><input type="number" min="0" step="0.01" value="${Number(item.precioVenta || 0).toFixed(2)}" onchange="updateQuoteStickerField('${item.rowId}','precioVenta',this.value)"></td>
        <td class="readonly-cell" style="color:${item.precioVenta - item.costo >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">${fmt((item.precioVenta - item.costo) * item.cantidad)}</td>
        <td><button class="remove-row" onclick="removeQuoteSticker('${item.rowId}')" title="Quitar">✕</button></td>
      </tr>`).join("");
    quoteStickerItems.forEach(item => {
      const select = stickerBody.querySelector(`select[onchange*="${item.rowId}"]`);
      if (select) select.value = item.stickerId;
    });
    if (stickerEmpty) stickerEmpty.style.display = quoteStickerItems.length ? "none" : "block";
  }

  renderServiciosExtra();
  updateQuoteSummary();
}
function computeQuoteTotals() {
  let ventaBruta = 0, totalCosto = 0;
  quoteItems.forEach(item => {
    const costoUnit = costoUnitarioItem(item);
    ventaBruta += item.precioVenta * item.cantidad;
    totalCosto += costoUnit * item.cantidad;
  });
  quoteStickerItems.forEach(item => {
    ventaBruta += item.precioVenta * item.cantidad;
    totalCosto += item.costo * item.cantidad;
  });
  const sumServiciosExtra = quoteServiciosExtra.reduce((s, i) => s + (i.monto || 0), 0);
  ventaBruta += sumServiciosExtra;
  const descuentoPct = Math.min(15, Math.max(0, num("q-descuento-pct") || 0));
  const montoDescuento = ventaBruta * (descuentoPct / 100);
  const ventaConDescuento = ventaBruta - montoDescuento;
  const esUrgente = checked("q-urgente");
  const recargoUrgentePct = esUrgente ? (AppState.settings.recargoUrgentePct || 0) : 0;
  const montoUrgente = ventaConDescuento * (recargoUrgentePct / 100);
  const totalVenta = ventaConDescuento + montoUrgente;
  // Método de pago: si es 100% tarjeta, el monto en tarjeta es el total; si es mixto, es lo
  // que capturaron a mano; si es efectivo, no hay comisión de terminal.
  const metodoPago = val("q-metodo-pago") || "Efectivo";
  const montoTarjeta = metodoPago === "Tarjeta" ? totalVenta : (metodoPago === "Mixto" ? Math.min(totalVenta, num("q-monto-tarjeta") || 0) : 0);
  const montoEfectivo = Math.max(0, totalVenta - montoTarjeta);
  const comisionTerminal = comisionTerminalMonto(montoTarjeta, AppState.settings.comisionTerminalPct);
  // La ganancia REAL de la cotización ya descuenta la comisión de terminal — es dinero
  // que de verdad no te queda, igual que el costo de producción.
  const ganancia = totalVenta - totalCosto - comisionTerminal;
  const anticipo = Math.max(0, Math.min(totalVenta, num("q-anticipo") || 0));
  const saldoPendiente = Math.max(0, totalVenta - anticipo);
  const comision = currentQuoteCommission();
  const parteArtista = ganancia * (comision.pctArtista / 100);
  const parteEstudio = ganancia * (comision.pctEstudio / 100);
  return {
    ventaBruta, totalVenta, totalCosto, ganancia, parteArtista, parteEstudio, comision, sumServiciosExtra,
    descuentoPct, montoDescuento, esUrgente, recargoUrgentePct, montoUrgente,
    metodoPago, montoTarjeta, montoEfectivo, comisionTerminal, anticipo, saldoPendiente
  };
}
function updateQuoteSummary() {
  const t = computeQuoteTotals();
  document.getElementById("sum-venta").textContent = fmt(t.totalVenta);
  document.getElementById("sum-costo").textContent = fmt(t.totalCosto);
  document.getElementById("sum-ganancia").textContent = fmt(t.ganancia);
  document.getElementById("sum-artista").textContent = fmt(t.parteArtista);
  document.getElementById("sum-estudio").textContent = fmt(t.parteEstudio);
  const sumServiciosExtraEl = document.getElementById("sum-servicios-extra");
  if (sumServiciosExtraEl) sumServiciosExtraEl.textContent = fmt(t.sumServiciosExtra);
  const sumDescuentoEl = document.getElementById("sum-descuento");
  if (sumDescuentoEl) sumDescuentoEl.textContent = "− " + fmt(t.montoDescuento);
  const sumUrgenteEl = document.getElementById("sum-urgente");
  if (sumUrgenteEl) sumUrgenteEl.textContent = "+ " + fmt(t.montoUrgente);
  const urgenteCard = document.getElementById("sum-urgente-card");
  if (urgenteCard) urgenteCard.style.display = t.esUrgente ? "flex" : "none";
  const artistName = t.comision.nombre || "Sin artista";
  document.getElementById("sum-artista-label").textContent = `Parte de ${artistName} (${t.comision.pctArtista}%)`;
  document.getElementById("sum-estudio-label").textContent = `Parte del estudio (${t.comision.pctEstudio}%)`;
  document.getElementById("sum-artista-card").style.display = t.comision.pctArtista > 0 ? "flex" : "none";
  const comisionCard = document.getElementById("sum-comision-terminal-card");
  if (comisionCard) {
    comisionCard.style.display = t.comisionTerminal > 0 ? "flex" : "none";
    document.getElementById("sum-comision-terminal").textContent = "− " + fmt(t.comisionTerminal);
  }
  const saldoCard = document.getElementById("sum-saldo-pendiente-card");
  if (saldoCard) {
    saldoCard.style.display = t.anticipo > 0 ? "flex" : "none";
    document.getElementById("sum-saldo-pendiente").textContent = fmt(t.saldoPendiente);
  }
}
// Muestra/oculta el campo de "monto con tarjeta" y lo autocompleta según el método
// elegido: Efectivo → $0, Tarjeta → el total completo, Mixto → lo que capturen a mano.
function onQuoteMetodoPagoChange() {
  const metodo = val("q-metodo-pago");
  const wrap = document.getElementById("q-monto-tarjeta-wrap");
  if (wrap) wrap.style.display = metodo === "Mixto" ? "flex" : "none";
  updateQuoteSummary();
}
// Al elegir un cliente guardado, se autocompletan nombre y teléfono (se pueden ajustar a
// mano para esta cotización sin afectar el registro del cliente).
function onQuoteClienteSelectChange(clienteId) {
  setVal("q-cliente-id", clienteId || "");
  if (!clienteId) return;
  const c = AppState.clientes.find(x => x.id === clienteId);
  if (!c) return;
  setVal("q-cliente", c.nombre);
  if (c.telefono) setVal("q-cliente-tel", c.telefono);
}

/* -----------------------------------------------------------------
   SERVICIOS EXTRA DE LA COTIZACIÓN (planchado especial, empaque,
   envío, etc.) — se suman al total de venta de la cotización actual.
----------------------------------------------------------------- */
function openModalServicioExtra(id) {
  setVal("se-id", id || "");
  document.getElementById("modal-servicio-extra-title").textContent = id ? "Editar servicio extra" : "Nuevo servicio extra";
  if (id) {
    const s = quoteServiciosExtra.find(x => x.id === id);
    setVal("se-concepto", s.concepto); setVal("se-monto", s.monto);
  } else {
    setVal("se-concepto", ""); setVal("se-monto", 0);
  }
  openModal("modal-servicio-extra");
}
function saveServicioExtra() {
  const concepto = val("se-concepto").trim();
  if (!concepto) return showToast("Ponle un concepto al servicio extra.", "error");
  const id = val("se-id");
  const data = { concepto, monto: parseFloat(num("se-monto")) || 0 };
  if (id) {
    Object.assign(quoteServiciosExtra.find(x => x.id === id), data);
  } else {
    quoteServiciosExtra.push(Object.assign({ id: uid() }, data));
  }
  closeModal("modal-servicio-extra");
  renderServiciosExtra();
  updateQuoteSummary();
  showToast("Servicio extra guardado.");
}
function deleteServicioExtra(id) {
  quoteServiciosExtra = quoteServiciosExtra.filter(x => x.id !== id);
  renderServiciosExtra();
  updateQuoteSummary();
}
function renderServiciosExtra() {
  const body = document.getElementById("quote-servicios-extra-body");
  if (!body) return;
  const empty = document.getElementById("quote-servicios-extra-empty");
  if (empty) empty.style.display = quoteServiciosExtra.length ? "none" : "block";
  body.innerHTML = quoteServiciosExtra.map(s => `
    <tr>
      <td>${escapeHtml(s.concepto)}</td>
      <td>${fmt(s.monto)}</td>
      <td><button class="remove-row" onclick="deleteServicioExtra('${s.id}')" title="Quitar">✕</button></td>
    </tr>`).join("");
}
function resetQuoteForm() {
  quoteItems = [];
  quoteStickerItems = [];
  quoteServiciosExtra = [];
  quoteTagsOperativos = [];
  setVal("quote-editing-id", ""); setVal("q-cliente", ""); setVal("q-cliente-tel", ""); setVal("q-cliente-id", ""); setVal("q-cliente-select", ""); setVal("q-vendedor", "");
  setVal("q-fecha", new Date().toISOString().slice(0,10));
  setVal("q-artista", ""); setVal("q-comision-pct", 0); setVal("q-notas", "");
  setVal("q-tipo-venta", "Menudeo");
  setVal("q-metodo-pago", "Efectivo"); setVal("q-monto-tarjeta", 0); setVal("q-anticipo", 0);
  document.getElementById("q-monto-tarjeta-wrap").style.display = "none";
  setVal("q-descuento-pct", 0); setChecked("q-urgente", false);
  setChecked("q-venta-nula", false); setVal("q-venta-nula-motivo", "");
  document.getElementById("q-comision-custom-wrap").style.display = "none";
  document.getElementById("q-venta-nula-motivo-wrap").style.display = "none";
  document.getElementById("venta-nula-banner").style.display = "none";
  renderQuoteTagsOperativos();
  renderQuoteItems();
}
function saveQuote() {
  if (!quoteItems.length && !quoteStickerItems.length) return showToast("Agrega al menos una prenda o sticker.", "error");
  const t = computeQuoteTotals();
  const editingId = val("quote-editing-id");
  const data = {
    cliente: val("q-cliente") || "Cliente sin nombre",
    clienteId: val("q-cliente-id") || "",
    clienteTelefono: val("q-cliente-tel").trim(),
    fecha: val("q-fecha") || new Date().toISOString().slice(0,10),
    vendedor: val("q-vendedor"),
    artistaId: val("q-artista"),
    comisionPctPersonalizado: val("q-artista") === "__custom__" ? num("q-comision-pct") : null,
    tipoVenta: val("q-tipo-venta") || "Menudeo",
    bazarId: editingId ? ((AppState.cotizaciones.find(c => c.id === editingId) || {}).bazarId || "") : "",
    bazarIds: editingId ? bazarIdsDe(AppState.cotizaciones.find(c => c.id === editingId) || {}) : [],
    ventaNula: checked("q-venta-nula"),
    ventaNulaMotivo: val("q-venta-nula-motivo"),
    notas: val("q-notas"),
    items: JSON.parse(JSON.stringify(quoteItems)),
    stickers: JSON.parse(JSON.stringify(quoteStickerItems)),
    serviciosExtra: JSON.parse(JSON.stringify(quoteServiciosExtra)),
    ventaBruta: t.ventaBruta,
    descuentoPct: t.descuentoPct, montoDescuento: t.montoDescuento,
    urgente: t.esUrgente, recargoUrgentePct: t.recargoUrgentePct, montoUrgente: t.montoUrgente,
    totalVenta: t.totalVenta, totalCosto: t.totalCosto, ganancia: t.ganancia,
    parteArtista: t.parteArtista, parteEstudio: t.parteEstudio,
    comisionNombre: t.comision.nombre, pctArtista: t.comision.pctArtista, pctEstudio: t.comision.pctEstudio,
    metodoPago: t.metodoPago, montoTarjeta: t.montoTarjeta, montoEfectivo: t.montoEfectivo, comisionTerminal: t.comisionTerminal,
    anticipo: t.anticipo, saldoPendiente: t.saldoPendiente,
    tagsOperativos: JSON.parse(JSON.stringify(quoteTagsOperativos)),
    estadoProduccion: editingId ? ((AppState.cotizaciones.find(c => c.id === editingId) || {}).estadoProduccion || "Por hacer") : "Por hacer",
    estado: editingId ? (AppState.cotizaciones.find(c=>c.id===editingId)||{}).estado || "Pendiente" : "Pendiente"
  };
  if (editingId) {
    Object.assign(AppState.cotizaciones.find(c => c.id === editingId), data);
    showToast("Cotización actualizada.");
  } else {
    data.id = uid();
    data.folio = "LX-" + (1000 + AppState.cotizaciones.length + 1);
    AppState.cotizaciones.unshift(data);
    showToast("Cotización guardada.");
  }
  saveState();
  resetQuoteForm();
  renderCotizacionesGuardadas();
  switchPage("cotizaciones");
}
function exportQuotePDF() {
  if (!quoteItems.length && !quoteStickerItems.length) return showToast("Agrega al menos una prenda o sticker antes de exportar.", "error");
  const t = computeQuoteTotals();
  const html = buildQuoteHTML({
    folio: val("quote-editing-id") ? "Edición" : "Nueva",
    cliente: val("q-cliente") || "Cliente sin nombre", fecha: val("q-fecha"), vendedor: val("q-vendedor"),
    items: quoteItems, stickers: quoteStickerItems, serviciosExtra: quoteServiciosExtra, notas: val("q-notas"), ventaNula: checked("q-venta-nula"),
    tipoVenta: val("q-tipo-venta"), ...t
  });
  const container = document.getElementById("pdf-template");
  container.innerHTML = html;
  html2pdf().set({ margin: 10, filename: "cotizacion_lucxstudio.pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" } }).from(container).save();
}
// Arma el resumen de la cotización en texto plano (sin HTML — WhatsApp no lo soporta),
// usado tanto para el mensaje de WhatsApp como para la vista previa antes de compartir.
function buildQuoteWhatsAppText(q) {
  const lineas = [];
  lineas.push(`🧵 *LUCXSTUDIO* — Cotización`);
  lineas.push(`👤 Cliente: ${q.cliente}`);
  if (q.fecha) lineas.push(`📅 Fecha: ${q.fecha}`);
  if (q.tipoVenta === "Mayoreo") lineas.push(`📦 Mayoreo`);
  if (q.esUrgente) lineas.push(`🚀 Pedido urgente`);
  lineas.push("");
  lineas.push("🛍️ *Productos:*");
  q.items.forEach(item => {
    const detalle = [item.talla, colorNombre(item.colorId)].filter(v => v && v !== "—").join(", ");
    lineas.push(`• ${item.nombre || "Producto"}${detalle ? ` (${detalle})` : ""} x${item.cantidad} — ${fmt(item.precioVenta)} c/u = ${fmt(item.precioVenta * item.cantidad)}`);
  });
  (q.stickers || []).forEach(sticker => {
    lineas.push(`• 🏷️ ${sticker.nombre || "Sticker"} (${sticker.tamano || "—"}) x${sticker.cantidad} — ${fmt(sticker.precioVenta)} c/u = ${fmt(sticker.precioVenta * sticker.cantidad)}`);
  });
  if (q.serviciosExtra && q.serviciosExtra.length) {
    lineas.push("");
    lineas.push("✨ *Servicios extra:*");
    q.serviciosExtra.forEach(s => lineas.push(`• ${s.concepto} — ${fmt(s.monto)}`));
  }
  lineas.push("");
  if (q.montoDescuento) lineas.push(`Descuento (${q.descuentoPct}%): − ${fmt(q.montoDescuento)}`);
  if (q.montoUrgente) lineas.push(`Recargo por urgencia (${q.recargoUrgentePct}%): + ${fmt(q.montoUrgente)}`);
  lineas.push(`💵 *Total: ${fmt(q.totalVenta)}*`);
  if (q.metodoPago && q.metodoPago !== "Efectivo") lineas.push(`Método de pago: ${q.metodoPago === "Tarjeta" ? "💳 Tarjeta" : "💵💳 Mixto"}`);
  if (q.anticipo) {
    lineas.push(`Anticipo recibido: ${fmt(q.anticipo)}`);
    lineas.push(`*Saldo pendiente: ${fmt(q.saldoPendiente)}*`);
  }
  lineas.push("");
  lineas.push("¡Gracias por tu compra! 🖤");
  return lineas.join("\n");
}
// Arma el contexto "q" (mismo shape que usan buildQuoteHTML/buildQuoteWhatsAppText) a
// partir del formulario del cotizador que está abierto ahorita.
function buildQuoteContextDesdeForm() {
  const t = computeQuoteTotals();
  return {
    folio: val("quote-editing-id") ? "Edición" : "Nueva",
    cliente: val("q-cliente") || "Cliente sin nombre", clienteTelefono: val("q-cliente-tel"),
    fecha: val("q-fecha"), vendedor: val("q-vendedor"),
    items: quoteItems, stickers: quoteStickerItems, serviciosExtra: quoteServiciosExtra,
    notas: val("q-notas"), ventaNula: checked("q-venta-nula"), tipoVenta: val("q-tipo-venta"), ...t
  };
}
// Arma el mismo contexto pero a partir de una cotización ya guardada.
function buildQuoteContextDesdeGuardada(c) {
  return {
    folio: c.folio, cliente: c.cliente || "Cliente sin nombre", clienteTelefono: c.clienteTelefono,
    fecha: c.fecha, vendedor: c.vendedor,
    items: c.items, stickers: c.stickers, serviciosExtra: c.serviciosExtra, notas: c.notas,
    ventaNula: c.ventaNula, tipoVenta: c.tipoVenta, totalVenta: c.totalVenta, totalCosto: c.totalCosto,
    montoDescuento: c.montoDescuento, descuentoPct: c.descuentoPct, montoUrgente: c.montoUrgente,
    recargoUrgentePct: c.recargoUrgentePct, esUrgente: c.urgente,
    metodoPago: c.metodoPago, montoTarjeta: c.montoTarjeta, comisionTerminal: c.comisionTerminal,
    anticipo: c.anticipo, saldoPendiente: c.saldoPendiente
  };
}
function telParaWhatsApp(telefonoCrudo) {
  const telCrudo = (telefonoCrudo || "").replace(/\D/g, "");
  return telCrudo.length === 10 ? "52" + telCrudo : telCrudo;
}
function abrirWhatsAppConTexto(texto, telefono) {
  const url = `https://wa.me/${telParaWhatsApp(telefono)}?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}
function exportQuoteWhatsApp() {
  if (!quoteItems.length && !quoteStickerItems.length) return showToast("Agrega al menos una prenda o sticker antes de enviar.", "error");
  const q = buildQuoteContextDesdeForm();
  abrirWhatsAppConTexto(buildQuoteWhatsAppText(q), q.clienteTelefono);
}
// Igual que exportQuoteWhatsApp() pero para una cotización ya guardada (desde el modal
// "Ver cotización"), usando sus datos tal como quedaron al guardarla.
function exportQuoteWhatsAppGuardada() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  if (!c) return;
  const q = buildQuoteContextDesdeGuardada(c);
  abrirWhatsAppConTexto(buildQuoteWhatsAppText(q), q.clienteTelefono);
}
/* -----------------------------------------------------------------
   VISTA PREVIA ANTES DE COMPARTIR
   Un solo botón ("📤 Vista previa / Compartir") que muestra primero
   el mensaje exacto que se va a enviar, y desde ahí se decide si se
   descarga como PDF o se manda por WhatsApp — para no mandar nada
   a ciegas.
----------------------------------------------------------------- */
let previewQuoteContext = null;
function openPreviewCotizacion() {
  if (!quoteItems.length && !quoteStickerItems.length) return showToast("Agrega al menos una prenda o sticker antes de compartir.", "error");
  previewQuoteContext = buildQuoteContextDesdeForm();
  document.getElementById("preview-cotizacion-body").textContent = buildQuoteWhatsAppText(previewQuoteContext);
  openModal("modal-preview-cotizacion");
}
function openPreviewCotizacionGuardada() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  if (!c) return;
  previewQuoteContext = buildQuoteContextDesdeGuardada(c);
  document.getElementById("preview-cotizacion-body").textContent = buildQuoteWhatsAppText(previewQuoteContext);
  openModal("modal-preview-cotizacion");
}
function confirmarExportarPDF() {
  if (!previewQuoteContext) return;
  const html = buildQuoteHTML(previewQuoteContext);
  const container = document.getElementById("pdf-template");
  container.innerHTML = html;
  html2pdf().set({ margin: 10, filename: "cotizacion_lucxstudio.pdf", image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "pt", format: "a4", orientation: "portrait" } }).from(container).save();
  closeModal("modal-preview-cotizacion");
}
function confirmarExportarWhatsApp() {
  if (!previewQuoteContext) return;
  abrirWhatsAppConTexto(buildQuoteWhatsAppText(previewQuoteContext), previewQuoteContext.clienteTelefono);
  closeModal("modal-preview-cotizacion");
}
function buildQuoteHTML(q) {
  const rows = q.items.map(item => {
    return `<tr>
      <td>${escapeHtml(item.nombre || "—")}${item.tipo ? ` <span style="color:#888;">(${escapeHtml(item.tipo)})</span>` : ""}</td><td>${escapeHtml(item.talla)}</td><td>${colorNombre(item.colorId)}</td>
      <td>${item.cantidad}</td><td>${fmt(item.precioVenta)}</td><td>${fmt(item.precioVenta*item.cantidad)}</td>
    </tr>`;
  }).join("");
  const stickerRows = (q.stickers || []).map(sticker => `<tr>
      <td>${escapeHtml(sticker.nombre || "Sticker")} <span style="color:#888;">(${escapeHtml(sticker.tamano || "—")})</span></td><td>—</td><td>—</td>
      <td>${sticker.cantidad}</td><td>${fmt(sticker.precioVenta)}</td><td>${fmt(sticker.precioVenta * sticker.cantidad)}</td>
    </tr>`).join("");
  const metodoPagoLabel = { Efectivo: "💵 Efectivo", Tarjeta: "💳 Tarjeta", Mixto: "💵💳 Mixto" }[q.metodoPago] || "";
  return `
  <div style="font-family:Arial,sans-serif;color:#222;padding:26px;width:748px;box-sizing:border-box;background:#fff;">
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #c0242c;padding-bottom:14px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <img src="LOGO-crop.png" style="height:52px;width:auto;" onerror="this.style.display='none'">
        <div>
          <h1 style="margin:0;color:#c0242c;font-size:26px;letter-spacing:.5px;">LUCXSTUDIO</h1>
          <p style="margin:2px 0 0;font-size:12px;color:#555;">Cotización de playeras y stickers ${q.tipoVenta === "Mayoreo" ? "— Mayoreo" : ""}${q.urgente || q.esUrgente ? " — 🚀 Pedido urgente" : ""}</p>
        </div>
      </div>
      <div style="text-align:right;font-size:12px;color:#333;background:#f7f7f7;padding:8px 12px;border-radius:8px;">
        <div><b>Folio:</b> ${escapeHtml(q.folio || "—")}</div>
        <div><b>Fecha:</b> ${escapeHtml(q.fecha || "—")}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
      <p style="margin:0;"><b>Cliente:</b> ${escapeHtml(q.cliente)}${q.clienteTelefono ? ` &nbsp;·&nbsp; <b>Tel:</b> ${escapeHtml(q.clienteTelefono)}` : ""}</p>
      <p style="margin:0;"><b>Vendedor:</b> ${escapeHtml(q.vendedor || "—")}</p>
    </div>
    ${q.ventaNula ? `<p style="font-size:12px;background:#fdeeee;border:1px dashed #c0242c;border-radius:6px;padding:8px;">🎁 Cotización marcada como venta nula (regalo / cortesía).</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
      <thead><tr style="background:#c0242c;color:#fff;"><th style="padding:8px 6px;text-align:left;border-radius:6px 0 0 0;">Producto</th><th style="padding:8px 6px;">Talla</th><th style="padding:8px 6px;">Color</th><th style="padding:8px 6px;">Cant.</th><th style="padding:8px 6px;">Precio c/u</th><th style="padding:8px 6px;border-radius:0 6px 0 0;">Subtotal</th></tr></thead>
      <tbody>${rows}${stickerRows}</tbody>
    </table>
    ${q.serviciosExtra && q.serviciosExtra.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
      <thead><tr style="background:#f2f2f2;"><th style="padding:6px;text-align:left;">Servicio extra</th><th style="padding:6px;">Monto</th></tr></thead>
      <tbody>${q.serviciosExtra.map(s => `<tr><td style="padding:5px 6px;">${escapeHtml(s.concepto)}</td><td style="padding:5px 6px;">${fmt(s.monto)}</td></tr>`).join("")}</tbody>
    </table>` : ""}
    <div style="margin-top:18px;display:flex;justify-content:flex-end;">
      <table style="font-size:13px;border-collapse:collapse;min-width:280px;">
        <tr><td style="padding:3px 10px 3px 0;color:#555;">Total costo producción</td><td style="padding:3px 0;text-align:right;">${fmt(q.totalCosto)}</td></tr>
        ${q.montoDescuento ? `<tr><td style="padding:3px 10px 3px 0;color:#555;">Subtotal</td><td style="padding:3px 0;text-align:right;">${fmt(q.ventaBruta)}</td></tr>
        <tr><td style="padding:3px 10px 3px 0;color:#c0242c;">Descuento (${q.descuentoPct}%)</td><td style="padding:3px 0;text-align:right;color:#c0242c;">− ${fmt(q.montoDescuento)}</td></tr>` : ""}
        ${q.montoUrgente ? `<tr><td style="padding:3px 10px 3px 0;color:#c0242c;">Recargo por urgencia (${q.recargoUrgentePct}%)</td><td style="padding:3px 0;text-align:right;color:#c0242c;">+ ${fmt(q.montoUrgente)}</td></tr>` : ""}
        <tr><td style="padding:8px 10px 4px 0;font-size:17px;font-weight:bold;color:#c0242c;">Total</td><td style="padding:8px 0 4px;text-align:right;font-size:17px;font-weight:bold;color:#c0242c;">${fmt(q.totalVenta)}</td></tr>
        ${metodoPagoLabel ? `<tr><td style="padding:3px 10px 3px 0;color:#555;">Método de pago</td><td style="padding:3px 0;text-align:right;">${metodoPagoLabel}</td></tr>` : ""}
        ${q.anticipo ? `<tr><td style="padding:3px 10px 3px 0;color:#555;">Anticipo recibido</td><td style="padding:3px 0;text-align:right;">${fmt(q.anticipo)}</td></tr>
        <tr><td style="padding:3px 10px 3px 0;font-weight:bold;">Saldo pendiente</td><td style="padding:3px 0;text-align:right;font-weight:bold;">${fmt(q.saldoPendiente)}</td></tr>` : ""}
      </table>
    </div>
    ${q.notas ? `<p style="margin-top:16px;font-size:12px;background:#f7f7f7;padding:8px;border-radius:6px;"><b>Notas:</b> ${escapeHtml(q.notas)}</p>` : ""}
    <p style="margin-top:22px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px;">¡Gracias por tu compra! · LUCXSTUDIO — impresión DTF y playeras personalizadas</p>
  </div>`;
}

/* =================================================================
   COTIZACIONES GUARDADAS
================================================================= */
function renderCotizacionesGuardadas() {
  const estadoF = document.getElementById("filter-cot-estado").value;
  const bazarF = document.getElementById("filter-cot-bazar").value;
  const tipoF = document.getElementById("filter-cot-tipo").value;
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  let list = AppState.cotizaciones.filter(c => {
    if (estadoF !== "all" && c.estado !== estadoF) return false;
    if (bazarF !== "all" && !bazarTiene(c, bazarF)) return false;
    if (tipoF !== "all" && (c.tipoVenta || "Menudeo") !== tipoF) return false;
    if (searchTerm && !(c.cliente || "").toLowerCase().includes(searchTerm) && !(c.folio||"").toLowerCase().includes(searchTerm)) return false;
    return true;
  });
  const grid = document.getElementById("cotizaciones-grid");
  document.getElementById("cotizaciones-empty-hint").style.display = list.length ? "none" : "block";
  grid.innerHTML = list.map(c => {
    const semaforo = semaforoCotizacion(c);
    const tagsOpHtml = (c.tagsOperativos || []).map(tid => {
      const e = AppState.etiquetasOperativas.find(x => x.id === tid);
      return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
    }).join("");
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title"><span class="semaforo-dot semaforo-${semaforo.color}" title="${semaforo.label}"></span>${escapeHtml(c.folio)}</span>
        <span class="card-badge ${c.estado==='Pagado'?'badge-stock':c.estado==='Entregado'?'badge-alta':c.estado==='Confirmado'?'badge-media':'badge-baja'}">${c.estado}</span>
      </div>
      <div class="card-meta">${escapeHtml(c.cliente)} · ${c.fecha} · ${c.items.length + (c.stickers || []).length} artículo(s) · 🚦 ${escapeHtml(c.estadoProduccion || "Por hacer")}</div>
      <div class="card-tags">
        <span class="card-badge ${c.tipoVenta==='Mayoreo'?'badge-media':'badge-baja'}">${c.tipoVenta==='Mayoreo'?'📦 Mayoreo':'🛍️ Menudeo'}</span>
        ${bazarIdsDe(c).length ? `<span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(c))}</span>` : ""}
        ${c.urgente ? `<span class="card-badge badge-agotado">🚀 Urgente</span>` : ""}
        ${c.ventaNula ? `<span class="card-badge badge-agotado">🎁 Venta nula</span>` : ""}
        ${tagsOpHtml}
      </div>
      <div class="card-row"><span>Total de venta</span><span>${fmt(c.totalVenta)}</span></div>
      <div class="card-row"><span>Ganancia</span><span>${fmt(c.ganancia)}</span></div>
      <div class="card-actions">
        <button onclick="viewCotizacion('${c.id}')">👁️ Ver</button>
        <button onclick="openModalAsignarBazar('${c.id}')">🏪 Bazar</button>
        <button onclick="duplicateCotizacion('${c.id}')">📄 Duplicar</button>
      </div>
    </div>`;
  }).join("");
}
let viewingCotizacionId = null;
function viewCotizacion(id) {
  viewingCotizacionId = id;
  const c = AppState.cotizaciones.find(x => x.id === id);
  document.getElementById("ver-cot-title").textContent = c.folio + " — " + c.cliente;
  const rows = c.items.map(item => {
    const flags = [item.prendaCliente ? "🎁 prenda cliente" : "", item.dtfEspecial ? "✨ DTF especial" : "", item.modoCosteo === "gangsheet" ? "🧻 gang sheet" : ""].filter(Boolean).join(" · ");
    return `<div class="card-row"><span>${escapeHtml(item.nombre||"—")} (${escapeHtml(item.tipo||"")}, ${escapeHtml(item.talla)}, ${colorNombre(item.colorId)}) ×${item.cantidad}${flags ? " — " + flags : ""}</span><span>${fmt(item.precioVenta*item.cantidad)}</span></div>`;
  }).join("");
  const stickerRows = (c.stickers || []).map(sticker => `<div class="card-row"><span>✂️ ${escapeHtml(sticker.nombre || "Sticker")} (${escapeHtml(sticker.tamano || "—")}) ×${sticker.cantidad}</span><span>${fmt(sticker.precioVenta * sticker.cantidad)}</span></div>`).join("");
  const serviciosExtraRows = (c.serviciosExtra && c.serviciosExtra.length)
    ? c.serviciosExtra.map(s => `<div class="card-row"><span>➕ ${escapeHtml(s.concepto)}</span><span>${fmt(s.monto)}</span></div>`).join("")
    : "";
  const tagsOpHtml = (c.tagsOperativos || []).map(tid => {
    const e = AppState.etiquetasOperativas.find(x => x.id === tid);
    return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
  }).join("");
  document.getElementById("ver-cot-body").innerHTML = `
    <div class="card-meta" style="margin-bottom:10px;">Fecha: ${c.fecha} · Vendedor: ${escapeHtml(c.vendedor||"—")} · Artista: ${escapeHtml(c.comisionNombre||"Sin artista")}</div>
    <div class="card-tags" style="margin-bottom:10px;">
      <span class="card-badge ${c.tipoVenta==='Mayoreo'?'badge-media':'badge-baja'}">${c.tipoVenta==='Mayoreo'?'📦 Mayoreo':'🛍️ Menudeo'}</span>
      <span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(c))}</span>
      ${c.urgente ? `<span class="card-badge badge-agotado">🚀 Pedido urgente</span>` : ""}
      ${c.ventaNula ? `<span class="card-badge badge-agotado">🎁 Venta nula${c.ventaNulaMotivo ? ": " + escapeHtml(c.ventaNulaMotivo) : ""}</span>` : ""}
      ${tagsOpHtml}
    </div>
    ${rows}
    ${stickerRows}
    ${serviciosExtraRows}
    <div class="card-row"><span>Total costo</span><span>${fmt(c.totalCosto)}</span></div>
    ${c.montoDescuento ? `<div class="card-row"><span>Descuento (${c.descuentoPct}%)</span><span>− ${fmt(c.montoDescuento)}</span></div>` : ""}
    ${c.montoUrgente ? `<div class="card-row"><span>Recargo urgencia (${c.recargoUrgentePct}%)</span><span>+ ${fmt(c.montoUrgente)}</span></div>` : ""}
    <div class="card-row"><span><b>Total venta</b></span><span><b>${fmt(c.totalVenta)}</b></span></div>
    <div class="card-row"><span>Ganancia total</span><span>${fmt(c.ganancia)}</span></div>
    <div class="card-row"><span>Parte artista (${c.pctArtista}%)</span><span>${fmt(c.parteArtista)}</span></div>
    <div class="card-row"><span>Parte estudio (${c.pctEstudio}%)</span><span>${fmt(c.parteEstudio)}</span></div>
    ${c.notas ? `<p class="card-meta" style="margin-top:10px;">${escapeHtml(c.notas)}</p>` : ""}
  `;
  setVal("ver-cot-estado-select", c.estado);
  const produccionSel = document.getElementById("ver-cot-produccion-select");
  if (produccionSel) setVal("ver-cot-produccion-select", c.estadoProduccion || "Por hacer");
  openModal("modal-ver-cotizacion");
}
function updateCotizacionEstado() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  c.estado = val("ver-cot-estado-select");
  saveState(); renderCotizacionesGuardadas();
  showToast("Estado actualizado.");
}
// Cambia la etapa de producción de una cotización (usado tanto desde el modal "Ver
// cotización" como desde las tarjetas del tablero Kanban de Producción).
function updateCotizacionProduccion(id, nuevaEtapa) {
  const c = AppState.cotizaciones.find(x => x.id === id);
  if (!c) return;
  c.estadoProduccion = nuevaEtapa;
  saveState();
  renderCotizacionesGuardadas();
  renderProduccionKanban();
}
// Envoltura para el selector dentro del modal "Ver cotización": no se puede referenciar
// directamente la variable de módulo `viewingCotizacionId` desde un atributo HTML inline.
function updateCotizacionProduccionDesdeModal() {
  updateCotizacionProduccion(viewingCotizacionId, val("ver-cot-produccion-select"));
}
function editCotizacion() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  quoteItems = JSON.parse(JSON.stringify(c.items));
  quoteStickerItems = JSON.parse(JSON.stringify(c.stickers || []));
  quoteStickerItems.forEach(sticker => { if (!sticker.rowId) sticker.rowId = uid(); });
  quoteItems.forEach(it => {
    if (it.costoEstampadoManual === undefined) it.costoEstampadoManual = null;
    if (it.prendaCliente === undefined) it.prendaCliente = false;
    if (it.dtfEspecial === undefined) it.dtfEspecial = false;
    if (!it.tipo) it.tipo = "Playera";
    if (!it.estampados) it.estampados = [{ id: uid(), anchoCm: 0, largoCm: 0 }];
    if (!it.modoCosteo) it.modoCosteo = "area";
  });
  quoteServiciosExtra = JSON.parse(JSON.stringify(c.serviciosExtra || []));
  quoteTagsOperativos = JSON.parse(JSON.stringify(c.tagsOperativos || []));
  setVal("quote-editing-id", c.id); setVal("q-cliente", c.cliente); setVal("q-cliente-tel", c.clienteTelefono || ""); setVal("q-cliente-id", c.clienteId || ""); setVal("q-cliente-select", c.clienteId || ""); setVal("q-fecha", c.fecha);
  setVal("q-vendedor", c.vendedor); setVal("q-artista", c.artistaId || "");
  setVal("q-comision-pct", c.comisionPctPersonalizado || 0); setVal("q-notas", c.notas || "");
  setVal("q-tipo-venta", c.tipoVenta || "Menudeo");
  setVal("q-metodo-pago", c.metodoPago || "Efectivo"); setVal("q-monto-tarjeta", c.montoTarjeta || 0); setVal("q-anticipo", c.anticipo || 0);
  document.getElementById("q-monto-tarjeta-wrap").style.display = (c.metodoPago === "Mixto") ? "flex" : "none";
  setVal("q-descuento-pct", c.descuentoPct || 0); setChecked("q-urgente", !!c.urgente);
  setChecked("q-venta-nula", !!c.ventaNula); setVal("q-venta-nula-motivo", c.ventaNulaMotivo || "");
  document.getElementById("q-comision-custom-wrap").style.display = c.artistaId === "__custom__" ? "block" : "none";
  document.getElementById("q-venta-nula-motivo-wrap").style.display = c.ventaNula ? "block" : "none";
  document.getElementById("venta-nula-banner").style.display = c.ventaNula ? "block" : "none";
  closeModal("modal-ver-cotizacion");
  renderQuoteTagsOperativos();
  renderQuoteItems();
  switchPage("cotizador");
}
function duplicateCotizacion(id) {
  const c = AppState.cotizaciones.find(x => x.id === id);
  const copy = JSON.parse(JSON.stringify(c));
  copy.id = uid(); copy.folio = "LX-" + (1000 + AppState.cotizaciones.length + 1);
  copy.estado = "Pendiente"; copy.fecha = new Date().toISOString().slice(0,10);
  AppState.cotizaciones.unshift(copy);
  saveState(); renderCotizacionesGuardadas();
  showToast("Cotización duplicada.");
}
function deleteCotizacion() {
  if (!confirm("¿Eliminar esta cotización?")) return;
  AppState.cotizaciones = AppState.cotizaciones.filter(x => x.id !== viewingCotizacionId);
  saveState(); closeModal("modal-ver-cotizacion"); renderCotizacionesGuardadas();
}

/* =================================================================
   PRODUCCIÓN — SEMÁFORO KANBAN
   Tablero de columnas por etapa de producción; cada tarjeta trae un
   punto de color (semáforo) calculado a partir de la fecha del
   pedido y si es urgente.
================================================================= */
function renderProduccionKanban() {
  const board = document.getElementById("produccion-board");
  if (!board) return;
  const cotizaciones = AppState.cotizaciones.filter(c => !c.ventaNula);
  board.innerHTML = ETAPAS_PRODUCCION.map(etapa => {
    const enEtapa = cotizaciones.filter(c => (c.estadoProduccion || "Por hacer") === etapa);
    const cards = enEtapa.map(c => {
      const semaforo = semaforoCotizacion(c);
      const tagsOpHtml = (c.tagsOperativos || []).map(tid => {
        const e = AppState.etiquetasOperativas.find(x => x.id === tid);
        return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
      }).join("");
      return `
        <div class="kanban-card">
          <div class="kanban-card-top">
            <span class="semaforo-dot semaforo-${semaforo.color}" title="${semaforo.label}"></span>
            <span class="card-title" style="font-size:var(--fs-sm);cursor:pointer;" onclick="viewCotizacion('${c.id}')">${escapeHtml(c.folio)}</span>
          </div>
          <div class="card-meta">${escapeHtml(c.cliente)} · ${c.fecha}</div>
          ${tagsOpHtml ? `<div class="card-tags">${tagsOpHtml}</div>` : ""}
          <select class="form-select" onchange="updateCotizacionProduccion('${c.id}', this.value)" style="width:100%;margin-top:6px;">
            ${ETAPAS_PRODUCCION.map(e => `<option value="${e}" ${e===etapa?"selected":""}>${e}</option>`).join("")}
          </select>
        </div>`;
    }).join("") || `<p class="empty-hint">Sin pedidos aquí.</p>`;
    return `
      <div class="kanban-column">
        <div class="kanban-column-header">${escapeHtml(etapa)} <span class="card-badge badge-media">${enEtapa.length}</span></div>
        <div class="kanban-column-body">${cards}</div>
      </div>`;
  }).join("");
}

/* =================================================================
   CONSIGNACIÓN (playeras que le das a alguien más para vender)
================================================================= */
function openModalConsignacion(id) {
  setVal("cons-id", id || "");
  document.getElementById("modal-consignacion-title").textContent = id ? "Editar consignación" : "Nueva consignación";
  if (id) {
    const c = AppState.consignaciones.find(x => x.id === id);
    setVal("cons-nombre", c.nombre); setVal("cons-fecha", c.fecha || ""); setVal("cons-pct", c.pctComision ?? 30);
    setVal("cons-notas", c.notas || "");
  } else {
    setVal("cons-nombre", ""); setVal("cons-fecha", new Date().toISOString().slice(0, 10));
    setVal("cons-pct", 30); setVal("cons-notas", "");
  }
  openModal("modal-consignacion");
}
function saveConsignacion() {
  const nombre = val("cons-nombre").trim();
  if (!nombre) return showToast("Indica a quién le das la consignación.", "error");
  const id = val("cons-id");
  const data = {
    nombre, fecha: val("cons-fecha"),
    pctComision: Math.max(0, Math.min(100, parseFloat(num("cons-pct")) || 0)),
    notas: val("cons-notas")
  };
  if (id) {
    Object.assign(AppState.consignaciones.find(x => x.id === id), data);
  } else {
    AppState.consignaciones.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-consignacion"); refreshAllSelects(); renderConsignaciones();
  showToast("Consignación guardada.");
}
// Al borrar la consignación, las playeras que seguían con ella vuelven a quedar libres
// (sin consignacionId), en vez de quedar apuntando a un registro que ya no existe.
function deleteConsignacion(id) {
  if (!confirm("¿Eliminar esta consignación? Las playeras que seguían con ella quedarán libres.")) return;
  AppState.playeras.forEach(p => {
    if (p.consignacionId === id) { p.consignacionId = ""; p.consignacionEstado = ""; }
  });
  AppState.consignaciones = AppState.consignaciones.filter(x => x.id !== id);
  saveState(); refreshAllSelects(); renderConsignaciones(); renderPlayeras();
}
function renderConsignaciones() {
  const grid = document.getElementById("consignaciones-grid");
  if (!grid) return;
  document.getElementById("consignaciones-empty-hint").style.display = AppState.consignaciones.length ? "none" : "block";
  grid.innerHTML = AppState.consignaciones.map(c => {
    const stats = statsConsignacion(c);
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">🤝 ${escapeHtml(c.nombre)}</span>
        <span class="card-badge badge-media">${c.pctComision}% consignatario</span>
      </div>
      ${c.fecha ? `<div class="card-meta">📅 Desde ${escapeHtml(c.fecha)}</div>` : ""}
      <div class="card-row"><span>Piezas entregadas</span><span>${stats.piezasEntregadas}</span></div>
      <div class="card-row"><span>Vendidas</span><span>${stats.piezasVendidas}</span></div>
      <div class="card-row"><span>Devueltas</span><span>${stats.piezasDevueltas}</span></div>
      <div class="card-row"><span>Pendientes (con el consignatario)</span><span>${stats.piezasPendientes}</span></div>
      <div class="card-row"><span>Total vendido</span><span>${fmt(stats.totalVendido)}</span></div>
      <div class="card-row"><span>Parte del consignatario</span><span>${fmt(stats.parteConsignatarioTotal)}</span></div>
      <div class="card-row"><span>Parte del estudio</span><span style="color:var(--color-success);">${fmt(stats.parteEstudioTotal)}</span></div>
      ${c.notas ? `<div class="card-meta">${escapeHtml(c.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalConsignacion('${c.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteConsignacion('${c.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("");
}
// Modal para ligar UNA playera del inventario a una consignación existente (o quitarla).
function onAscConsignacionChange() {
  document.getElementById("asc-estado-wrap").style.display = val("asc-consignacion") ? "block" : "none";
}
function openModalAsignarConsignacion(playeraId) {
  setVal("asc-playera-id", playeraId);
  const sel = document.getElementById("asc-consignacion");
  sel.innerHTML = `<option value="">— Ninguna —</option>` +
    AppState.consignaciones.map(c => `<option value="${c.id}">${escapeHtml(c.nombre)} (${c.pctComision}%)</option>`).join("");
  const p = AppState.playeras.find(x => x.id === playeraId);
  setVal("asc-consignacion", (p && p.consignacionId) || "");
  setVal("asc-estado", (p && p.consignacionEstado) || "En consignación");
  document.getElementById("asc-estado-wrap").style.display = (p && p.consignacionId) ? "block" : "none";
  openModal("modal-asignar-consignacion");
}
function saveAsignarConsignacion() {
  const playeraId = val("asc-playera-id");
  const p = AppState.playeras.find(x => x.id === playeraId);
  if (!p) return;
  const consignacionId = val("asc-consignacion");
  p.consignacionId = consignacionId || "";
  p.consignacionEstado = consignacionId ? (val("asc-estado") || "En consignación") : "";
  saveState(); closeModal("modal-asignar-consignacion"); renderPlayeras(); renderConsignaciones();
  showToast(consignacionId ? "Playera asignada a la consignación." : "Playera quitada de la consignación.");
}

/* =================================================================
   CLIENTES (CRM: registro manual + historial de compras)
================================================================= */
let viewingClienteKey = null;
let clienteEtiquetaFiltro = "all";
function openModalClienteEtiqueta(id) {
  setVal("cet-id", id || "");
  document.getElementById("modal-cliente-etiqueta-title").textContent = id ? "Editar etiqueta de cliente" : "Nueva etiqueta de cliente";
  if (id) {
    const e = AppState.clienteEtiquetas.find(x => x.id === id);
    setVal("cet-nombre", e.nombre); setVal("cet-color", e.color);
  } else {
    setVal("cet-nombre", ""); setVal("cet-color", "#e3363d");
  }
  openModal("modal-cliente-etiqueta");
}
function saveClienteEtiqueta() {
  const nombre = val("cet-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre a la etiqueta.", "error");
  const id = val("cet-id");
  const data = { nombre, color: val("cet-color") };
  if (id) {
    Object.assign(AppState.clienteEtiquetas.find(x => x.id === id), data);
  } else {
    AppState.clienteEtiquetas.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-cliente-etiqueta"); renderClientes();
  showToast("Etiqueta de cliente guardada.");
}
function deleteClienteEtiqueta(id) {
  if (!confirm("¿Eliminar esta etiqueta? Se quitará de todos los clientes.")) return;
  AppState.clienteEtiquetas = AppState.clienteEtiquetas.filter(x => x.id !== id);
  AppState.clientes.forEach(c => { c.tags = (c.tags || []).filter(t => t !== id); });
  if (clienteEtiquetaFiltro === id) clienteEtiquetaFiltro = "all";
  saveState(); renderClientes();
}
function setClienteEtiquetaFiltro(id) {
  clienteEtiquetaFiltro = id;
  renderClientes();
}
function openModalCliente(id) {
  setVal("cl-id", id || "");
  document.getElementById("modal-cliente-title").textContent = id ? "Editar cliente" : "Nuevo cliente";
  const tagsContainer = document.getElementById("cl-tags-container");
  tagsContainer.innerHTML = AppState.clienteEtiquetas.map(e => `
    <label class="tag-checkbox" style="border-color:${e.color}">
      <input type="checkbox" value="${e.id}" class="cl-tag-cb"> ${escapeHtml(e.nombre)}
    </label>`).join("") || `<span class="card-meta">Crea una etiqueta primero con "🏷️ + Etiqueta de cliente".</span>`;
  if (id) {
    const c = AppState.clientes.find(x => x.id === id);
    setVal("cl-nombre", c.nombre); setVal("cl-telefono", c.telefono || ""); setVal("cl-notas", c.notas || "");
    document.querySelectorAll(".cl-tag-cb").forEach(cb => cb.checked = (c.tags || []).includes(cb.value));
  } else {
    setVal("cl-nombre", ""); setVal("cl-telefono", ""); setVal("cl-notas", "");
  }
  openModal("modal-cliente");
}
function saveCliente() {
  const nombre = val("cl-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al cliente.", "error");
  const id = val("cl-id");
  const tags = Array.from(document.querySelectorAll(".cl-tag-cb:checked")).map(cb => cb.value);
  const data = { nombre, telefono: val("cl-telefono").trim(), notas: val("cl-notas"), tags };
  if (id) {
    Object.assign(AppState.clientes.find(x => x.id === id), data);
  } else {
    AppState.clientes.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-cliente"); refreshAllSelects(); renderClientes();
  showToast("Cliente guardado.");
}
function deleteCliente(id) {
  if (!confirm("¿Eliminar este cliente? Sus cotizaciones anteriores se conservan, solo se quita el registro.")) return;
  AppState.clientes = AppState.clientes.filter(x => x.id !== id);
  saveState(); refreshAllSelects(); renderClientes();
}
// Formaliza un cliente "legacy" (que solo existía como nombre libre en cotizaciones
// viejas) como un registro completo, sin perder su historial.
function guardarClienteLegacy(nombre) {
  AppState.clientes.push({ id: uid(), nombre, telefono: "", notas: "", tags: [] });
  saveState(); refreshAllSelects(); renderClientes();
  showToast("Cliente guardado — su historial anterior ya quedó ligado por nombre.");
}
function renderClientes() {
  const grid = document.getElementById("clientes-grid");
  if (!grid) return;
  const etGrid = document.getElementById("cliente-etiquetas-grid");
  if (etGrid) {
    etGrid.innerHTML = `
      <div class="chip-item ${clienteEtiquetaFiltro === "all" ? "is-active" : ""}" style="cursor:pointer;" onclick="setClienteEtiquetaFiltro('all')">Todos</div>
      ` + AppState.clienteEtiquetas.map(e => `
      <div class="chip-item ${clienteEtiquetaFiltro === e.id ? "is-active" : ""}">
        <span class="chip-swatch" style="background:${e.color}"></span>
        <span style="cursor:pointer;" onclick="setClienteEtiquetaFiltro('${e.id}')">${escapeHtml(e.nombre)}</span>
        <button onclick="openModalClienteEtiqueta('${e.id}')" title="Editar">✏️</button>
        <button onclick="deleteClienteEtiqueta('${e.id}')" title="Eliminar">✕</button>
      </div>`).join("");
  }
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  const clientesGuardados = AppState.clientes
    .filter(c => !searchTerm || c.nombre.toLowerCase().includes(searchTerm))
    .filter(c => clienteEtiquetaFiltro === "all" || (c.tags || []).includes(clienteEtiquetaFiltro))
    .map(c => ({ cliente: c, stats: statsCliente(c) }))
    .sort((a, b) => b.stats.totalGastado - a.stats.totalGastado);
  const nombresGuardados = new Set(AppState.clientes.map(c => c.nombre.trim().toLowerCase()));
  const legacy = clienteEtiquetaFiltro === "all"
    ? agruparClientes().filter(cl => cl.nombre && !nombresGuardados.has(cl.nombre.trim().toLowerCase()) && (!searchTerm || cl.nombre.toLowerCase().includes(searchTerm)))
    : [];
  document.getElementById("clientes-empty-hint").style.display = (clientesGuardados.length || legacy.length) ? "none" : "block";
  const tagsHtmlDe = c => (c.tags || []).map(tid => {
    const e = AppState.clienteEtiquetas.find(x => x.id === tid);
    return e ? `<span class="card-badge" style="background:${e.color}22;color:${e.color}">${escapeHtml(e.nombre)}</span>` : "";
  }).join("");
  grid.innerHTML = clientesGuardados.map(({ cliente: c, stats }) => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">👤 ${escapeHtml(c.nombre)}</span>
      </div>
      ${c.telefono ? `<div class="card-meta">📱 ${escapeHtml(c.telefono)}</div>` : ""}
      <div class="card-tags">${tagsHtmlDe(c)}</div>
      <div class="card-row"><span>Pedidos</span><span>${stats.pedidos}</span></div>
      <div class="card-row"><span>Total gastado</span><span>${fmt(stats.totalGastado)}</span></div>
      <div class="card-row"><span>Última compra</span><span>${stats.ultimaFecha || "—"}</span></div>
      ${c.notas ? `<div class="card-meta">${escapeHtml(c.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalClienteDetalle('${c.id}')">📜 Ver historial</button>
        <button onclick="openModalCliente('${c.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteCliente('${c.id}')">🗑️ Eliminar</button>
      </div>
    </div>`).join("") + legacy.map(cl => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">👤 ${escapeHtml(cl.nombre)}</span>
        <span class="card-badge badge-baja">Sin registrar</span>
      </div>
      <div class="card-row"><span>Pedidos</span><span>${cl.pedidos}</span></div>
      <div class="card-row"><span>Total gastado</span><span>${fmt(cl.totalGastado)}</span></div>
      <div class="card-row"><span>Última compra</span><span>${cl.ultimaFecha || "—"}</span></div>
      <div class="card-actions">
        <button onclick="openModalClienteDetalleLegacy('${cl.nombre.replace(/'/g, "\\'")}')">📜 Ver historial</button>
        <button onclick="guardarClienteLegacy('${cl.nombre.replace(/'/g, "\\'")}')">+ Guardar como cliente</button>
      </div>
    </div>`).join("");
}
function openModalClienteDetalle(clienteId) {
  const c = AppState.clientes.find(x => x.id === clienteId);
  if (!c) return;
  viewingClienteKey = c.nombre.toLowerCase();
  document.getElementById("modal-cliente-detalle-title").textContent = "👤 " + c.nombre;
  const stats = statsCliente(c);
  const pedidos = AppState.cotizaciones.filter(cot => stats.cotizacionIds.includes(cot.id));
  const playerasVendidas = AppState.playeras.filter(p => (stats.playeraIds || []).includes(p.id));
  const filasPedidos = pedidos.map(cot => `
    <div class="card-row">
      <span>${escapeHtml(cot.folio || "")} · ${cot.fecha} · ${cot.estado}${cot.ventaNula ? " · 🎁 venta nula" : ""}</span>
      <span>${fmt(cot.totalVenta)} <button onclick="viewCotizacion('${cot.id}')" style="margin-left:6px;">👁️</button></span>
    </div>`).join("");
  const filasPlayeras = playerasVendidas.map(p => `
    <div class="card-row">
      <span>🏪 ${escapeHtml(p.nombre)} · venta directa (sin cotización)</span>
      <span>${fmt((p.precioVenta || 0) * (p.stock || 0))}</span>
    </div>`).join("");
  document.getElementById("modal-cliente-detalle-body").innerHTML = filasPedidos + filasPlayeras ||
    `<p class="empty-hint">Este cliente no tiene cotizaciones ni ventas directas.</p>`;
  openModal("modal-cliente-detalle");
}
// Historial para un cliente "legacy" (todavía sin registro guardado): se agrupa solo
// por coincidencia de nombre libre en cotizaciones viejas.
function openModalClienteDetalleLegacy(nombre) {
  viewingClienteKey = nombre.toLowerCase();
  document.getElementById("modal-cliente-detalle-title").textContent = "👤 " + nombre;
  const pedidos = AppState.cotizaciones.filter(c => ((c.cliente || "Cliente sin nombre").trim() || "Cliente sin nombre").toLowerCase() === viewingClienteKey);
  document.getElementById("modal-cliente-detalle-body").innerHTML = pedidos.map(c => `
    <div class="card-row">
      <span>${escapeHtml(c.folio || "")} · ${c.fecha} · ${c.estado}${c.ventaNula ? " · 🎁 venta nula" : ""}</span>
      <span>${fmt(c.totalVenta)} <button onclick="viewCotizacion('${c.id}')" style="margin-left:6px;">👁️</button></span>
    </div>`).join("") || `<p class="empty-hint">Este cliente no tiene cotizaciones.</p>`;
  openModal("modal-cliente-detalle");
}

/* =================================================================
   HISTORIAL DE ARTES (diseños más vendidos)
================================================================= */
function renderHistorialArtes() {
  const body = document.getElementById("artes-table-body");
  if (!body) return;
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  const artes = agruparArtes().filter(a => !searchTerm || a.nombre.toLowerCase().includes(searchTerm));
  document.getElementById("artes-empty-hint").style.display = artes.length ? "none" : "block";
  body.innerHTML = artes.map(a => `
    <tr>
      <td>${escapeHtml(a.nombre)}</td>
      <td>${a.piezas}</td>
      <td>${fmt(a.totalVendido)}</td>
      <td style="color:${a.ganancia>=0?'var(--color-success)':'var(--color-danger)'}">${fmt(a.ganancia)}</td>
    </tr>`).join("");
}

/* =================================================================
   BÚSQUEDA GLOBAL
================================================================= */
document.getElementById("global-search").addEventListener("input", () => {
  renderPlayeras(); renderStickers(); renderCotizacionesGuardadas(); renderClientes(); renderHistorialArtes();
});

/* =================================================================
   DETALLE DE UN BAZAR (métricas y gráficas de un solo bazar)
================================================================= */
let chartBazarFecha = null;
let chartBazarVendidas = null;
let chartBazarDisponibles = null;
let chartBazarEtiquetas = null;
function renderBazarDetalle() {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) { switchPage("bazares"); return; }
  document.getElementById("bd-nombre").textContent = "🏪 " + b.nombre;
  document.getElementById("bd-meta").textContent = `${b.lugar || "—"} · ${rangoBazarFecha(b)}${b.notas ? " · " + b.notas : ""}`;

  const todas = AppState.cotizaciones.filter(c => bazarTiene(c, b.id));
  const validas = todas.filter(c => !c.ventaNula);
  const nulas = todas.filter(c => c.ventaNula);
  const playerasAsignadas = AppState.playeras.filter(p => bazarTiene(p, b.id) && (p.stock || 0) > 0);

  const totalVendidoPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    return s + ((p.precioVenta || 0) * (p.stock || 0));
  }, 0);
  const gananciaVentasPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    const costoTotalUnit = costoTotalPlayera(p);
    return s + ((p.precioVenta || 0) - costoTotalUnit) * (p.stock || 0);
  }, 0);
  const perdidaPlayerasNulas = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Venta nula") return s;
    return s + costoTotalPlayera(p) * (p.stock || 0);
  }, 0);
  const totalVendido = validas.reduce((s, c) => s + c.totalVenta, 0) + totalVendidoPlayeras;
  const perdidaCotsNulas = nulas.reduce((s, c) => s + (c.totalCosto || 0), 0);
  // Ganancia ESTIMADA por catálogo: suma del margen que cada playera/cotización trae
  // calculado por su costeo de área DTF. Es solo referencia para comparar diseños,
  // nunca se resta contra el costo del bazar (eso causaba el doble conteo).
  const gananciaVentas = validas.reduce((s, c) => s + c.ganancia, 0) + gananciaVentasPlayeras - perdidaCotsNulas - perdidaPlayerasNulas;
  const totalRegalado = perdidaCotsNulas + perdidaPlayerasNulas;
  const desglose = gastosBazarPorTipo(b);
  const costoReal = costoBazarReal(b);
  const saldoPendiente = saldoBazarPendiente(b);
  const ingresosExtra = b.ingresosExtra || [];
  const sumIngresosExtra = ingresosExtra.reduce((s, i) => s + (i.monto || 0), 0);
  // Ganancia REAL en efectivo: lo que de verdad entró (ventas + extra) menos lo que
  // de verdad salió de tu bolsillo (puesto + producción + evento) y la comisión de
  // terminal de las ventas con tarjeta. No usa el costeo estimado de cada playera, así
  // que nunca duplica el gasto de DTF/tela.
  const cierre = desgloseCierreBazar(b);
  const mermasBazar = totalMermasDeBazar(b.id);
  const gananciaNeta = totalVendido + sumIngresosExtra - costoReal - cierre.comisionTerminal - mermasBazar;
  const playerasVendidas = playerasAsignadas.filter(p => (p.bazarEstado || "Disponible") === "Vendida");
  const playerasDisponibles = playerasAsignadas.filter(p => (p.bazarEstado || "Disponible") !== "Vendida");
  const unidadesVendidas = playerasVendidas.reduce((s, p) => s + (p.stock || 0), 0);
  const unidadesDisponibles = playerasDisponibles.reduce((s, p) => s + (p.stock || 0), 0);
  const unidadesTotales = unidadesVendidas + unidadesDisponibles;
  const rotacion = unidadesTotales ? Math.round((unidadesVendidas / unidadesTotales) * 100) : 0;
  const valorDisponible = playerasDisponibles.reduce((s, p) => s + (p.precioVenta || 0) * (p.stock || 0), 0);

  document.getElementById("bd-total-vendido").textContent = fmt(totalVendido);
  document.getElementById("bd-ganancia").textContent = fmt(gananciaVentas);
  document.getElementById("bd-cotizaciones").textContent = todas.length + playerasAsignadas.length;
  document.getElementById("bd-regalado").textContent = fmt(totalRegalado);
  document.getElementById("bd-costo-bazar").textContent = fmt(costoReal);
  document.getElementById("bd-costo-bazar-sub").textContent = `Pagado/apartado ${fmt(b.montoPagadoBazar || 0)} · Saldo pendiente ${fmt(saldoPendiente)} · Puesto ${fmt(b.costoBaseBazar || 0)} · 🧵 Producción ${fmt(desglose.produccion)} · 🎪 Evento ${fmt(desglose.evento)}${mermasBazar ? ` · 📉 Mermas ${fmt(mermasBazar)}` : ""}`;
  document.getElementById("bd-ingresos-extra").textContent = fmt(sumIngresosExtra);
  document.getElementById("bd-ganancia-neta").textContent = fmt(gananciaNeta);
  // Punto de equilibrio: cuánto de lo que ya entró (ventas + extra) cubre el costo real
  // del bazar. Al 100% ya cubriste gastos y todo lo que sigas vendiendo es ganancia neta.
  const ingresoAcumulado = totalVendido + sumIngresosExtra;
  const equilibrioPct = costoReal > 0 ? Math.min(100, Math.round((ingresoAcumulado / costoReal) * 100)) : (ingresoAcumulado > 0 ? 100 : 0);
  const fillEl = document.getElementById("bd-equilibrio-fill");
  const subEl = document.getElementById("bd-equilibrio-sub");
  document.getElementById("bd-equilibrio-pct").textContent = `${equilibrioPct}%`;
  if (fillEl) { fillEl.style.width = `${equilibrioPct}%`; fillEl.classList.toggle("complete", equilibrioPct >= 100); }
  if (subEl) {
    subEl.textContent = costoReal <= 0
      ? "Aún no registras costos para este bazar."
      : (equilibrioPct >= 100
        ? `🎉 ¡Ya cubriste los ${fmt(costoReal)} de costo real! Todo lo que vendas de aquí en adelante es ganancia neta.`
        : `Llevas ${fmt(ingresoAcumulado)} de ${fmt(costoReal)} para cubrir el costo real de este bazar (faltan ${fmt(costoReal - ingresoAcumulado)}).`);
  }
  document.getElementById("bd-unidades-vendidas").textContent = unidadesVendidas;
  document.getElementById("bd-unidades-disponibles").textContent = unidadesDisponibles;
  document.getElementById("bd-rotacion").textContent = `${rotacion}%`;
  document.getElementById("bd-valor-disponible").textContent = fmt(valorDisponible);

  // Cierre de caja: separa lo cobrado en efectivo de lo cobrado con tarjeta y compara el
  // efectivo esperado (fondo inicial + ventas en efectivo) contra lo que se cuente al cerrar.
  document.getElementById("bd-cierre-efectivo").textContent = fmt(cierre.ventasEfectivo);
  document.getElementById("bd-cierre-tarjeta").textContent = fmt(cierre.ventasTarjeta);
  document.getElementById("bd-cierre-comision").textContent = "− " + fmt(cierre.comisionTerminal);
  document.getElementById("bd-cierre-esperado").textContent = `${fmt(b.fondoCaja || 0)} + ${fmt(cierre.ventasEfectivo)} = ${fmt(cierre.efectivoEsperado)}`;
  setVal("bd-efectivo-contado", b.efectivoContado ?? "");
  const diferenciaEl = document.getElementById("bd-cierre-diferencia");
  if (cierre.diferencia === null) {
    diferenciaEl.textContent = "Captura el efectivo contado para ver si cuadra la caja.";
    diferenciaEl.style.color = "";
  } else if (Math.abs(cierre.diferencia) < 0.01) {
    diferenciaEl.textContent = "✅ La caja cuadra exacto.";
    diferenciaEl.style.color = "var(--color-success)";
  } else if (cierre.diferencia > 0) {
    diferenciaEl.textContent = `Sobran ${fmt(cierre.diferencia)} respecto a lo esperado.`;
    diferenciaEl.style.color = "var(--color-success)";
  } else {
    diferenciaEl.textContent = `⚠️ Faltan ${fmt(Math.abs(cierre.diferencia))} respecto a lo esperado.`;
    diferenciaEl.style.color = "var(--color-danger)";
  }

  const renderPlayerasEnBazar = (containerId, emptyId, items, esVendida) => {
    const grid = document.getElementById(containerId);
    const empty = document.getElementById(emptyId);
    grid.innerHTML = items.map(p => {
      const costoTotalUnit = costoTotalPlayera(p);
      const esNula = (p.bazarEstado || "Disponible") === "Venta nula";
      const gananciaUnit = (p.precioVenta || 0) - costoTotalUnit;
      const montoTotal = (p.precioVenta || 0) * (p.stock || 0);
      const resultadoTotal = (esNula ? -costoTotalUnit : gananciaUnit) * (p.stock || 0);
      const estadoBadge = esVendida || esNula ? "badge-agotado" : "badge-stock";
      const estadoLabel = esVendida ? " Vendida✅" : esNula ? "🎁 Venta nula" : "🟢 Disponible";
      return `
        <div class="card">
          <div class="card-top">
            <span class="card-title">${escapeHtml(p.nombre)}</span>
            <span class="card-badge ${estadoBadge}">${estadoLabel}</span>
          </div>
          <div class="card-meta">${escapeHtml(p.tipo)} · Talla ${escapeHtml(p.talla) || "—"} · ${escapeHtml(colorNombre(p.colorId))}</div>
          <div class="card-row"><span>Stock</span><span>${p.stock} pza(s)</span></div>
          <div class="card-row"><span>Precio venta</span><span>${fmt(p.precioVenta)}</span></div>
          <div class="card-row"><span>${esNula ? "Pérdida por pieza" : "Ganancia por pieza"}</span><span style="color:${resultadoTotal >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt(esNula ? -costoTotalUnit : gananciaUnit)}</span></div>
          ${esVendida ? `<div class="card-row"><span>Total vendido</span><span>${fmt(montoTotal)}</span></div>` : ""}
          ${esVendida ? `<div class="card-row"><span>Ganancia total</span><span style="color:${resultadoTotal >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt(resultadoTotal)}</span></div>` : ""}
          ${esNula ? `<div class="card-row"><span>Costo regalado</span><span style="color:var(--color-danger)">${fmt(costoTotalUnit * (p.stock || 0))}</span></div>` : ""}
          <div class="card-actions">
            <button onclick="openModalAsignarPlayeraBazar('${p.id}')">🏪 Cambiar estado</button>
          </div>
        </div>`;
    }).join("");
    empty.style.display = items.length ? "none" : "block";
  };

  renderPlayerasEnBazar("bd-playeras-vendidas-grid", "bd-playeras-vendidas-empty", playerasVendidas, true);
  renderPlayerasEnBazar("bd-playeras-disponibles-grid", "bd-playeras-disponibles-empty", playerasDisponibles, false);

  // Tabla de ingresos extra
  const ieBody = document.getElementById("bd-ingresos-extra-body");
  document.getElementById("bd-ingresos-extra-empty").style.display = ingresosExtra.length ? "none" : "block";
  ieBody.innerHTML = ingresosExtra.map(i => `
    <tr>
      <td>${escapeHtml(i.concepto)}</td>
      <td><span class="card-badge badge-alta">${escapeHtml(i.etiqueta || "Otro")}</span></td>
      <td>${fmt(i.monto)}</td>
      <td>
        <div class="bazar-row-actions">
          <button onclick="openModalIngresoExtra('${i.id}')">✏️ Editar</button>
          <button class="danger" onclick="deleteIngresoExtra('${i.id}')">🗑️ Eliminar</button>
        </div>
      </td>
    </tr>`).join("");

  // Ventas por fecha dentro de este bazar
  const porFecha = {};
  validas.forEach(c => { porFecha[c.fecha] = (porFecha[c.fecha] || 0) + c.totalVenta; });
  const fechas = Object.keys(porFecha).sort();
  const valoresFecha = fechas.map(f => porFecha[f]);
  const canvasFecha = document.getElementById("chart-bazar-fecha");
  document.getElementById("chart-bazar-fecha-empty").style.display = fechas.length ? "none" : "block";
  canvasFecha.style.display = fechas.length ? "block" : "none";
  if (chartBazarFecha) chartBazarFecha.destroy();
  if (fechas.length) {
    chartBazarFecha = new Chart(canvasFecha, {
      type: "bar",
      data: { labels: fechas, datasets: [{ label: "Vendido ($)", data: valoresFecha, backgroundColor: "#e3363d", borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  const renderBazarChart = (chart, canvasId, emptyId, labels, values, label, color) => {
    const canvas = document.getElementById(canvasId);
    const empty = document.getElementById(emptyId);
    if (chart) chart.destroy();
    canvas.style.display = labels.length ? "block" : "none";
    empty.style.display = labels.length ? "none" : "block";
    if (!labels.length) return null;
    return new Chart(canvas, {
      type: "bar",
      data: { labels, datasets: [{ label, data: values, backgroundColor: color, borderRadius: 6 }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  };

  const nombresPlayeras = items => items.map(p => p.nombre || p.tipo || "Sin nombre");
  const vendidasLabels = nombresPlayeras(playerasVendidas);
  const vendidasValores = playerasVendidas.map(p => p.stock || 0);
  const disponiblesLabels = nombresPlayeras(playerasDisponibles);
  const disponiblesValores = playerasDisponibles.map(p => p.stock || 0);
  const etiquetasVendidas = {};
  playerasVendidas.forEach(p => (p.tags || []).forEach(tagId => {
    const etiqueta = AppState.etiquetas.find(e => e.id === tagId);
    const nombre = etiqueta ? etiqueta.nombre : "Sin etiqueta";
    etiquetasVendidas[nombre] = (etiquetasVendidas[nombre] || 0) + (p.stock || 0);
  }));
  const etiquetasOrdenadas = Object.entries(etiquetasVendidas).sort((a, b) => b[1] - a[1]);
  chartBazarVendidas = renderBazarChart(chartBazarVendidas, "chart-bazar-vendidas", "chart-bazar-vendidas-empty", vendidasLabels, vendidasValores, "Playeras vendidas", "#e3363d");
  chartBazarDisponibles = renderBazarChart(chartBazarDisponibles, "chart-bazar-disponibles", "chart-bazar-disponibles-empty", disponiblesLabels, disponiblesValores, "Playeras disponibles", "#8b8b93");
  chartBazarEtiquetas = renderBazarChart(chartBazarEtiquetas, "chart-bazar-etiquetas", "chart-bazar-etiquetas-empty", etiquetasOrdenadas.map(([nombre]) => nombre), etiquetasOrdenadas.map(([, cantidad]) => cantidad), "Etiquetas vendidas", "#e0a23a");

  // Lista de cotizaciones de este bazar
  const grid = document.getElementById("bd-cotizaciones-grid");
  grid.innerHTML = todas.map(c => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(c.folio)}</span>
        <span class="card-badge ${c.estado==='Pagado'?'badge-stock':c.estado==='Entregado'?'badge-alta':c.estado==='Confirmado'?'badge-media':'badge-baja'}">${c.estado}</span>
      </div>
      <div class="card-meta">${escapeHtml(c.cliente)} · ${c.fecha} · ${c.items.length} prenda(s)</div>
      <div class="card-tags">
        <span class="card-badge ${c.tipoVenta==='Mayoreo'?'badge-media':'badge-baja'}">${c.tipoVenta==='Mayoreo'?'📦 Mayoreo':'🛍️ Menudeo'}</span>
        ${c.ventaNula ? `<span class="card-badge badge-agotado">🎁 Venta nula</span>` : ""}
      </div>
      <div class="card-row"><span>Total de venta</span><span>${fmt(c.totalVenta)}</span></div>
      <div class="card-row"><span>Ganancia</span><span>${fmt(c.ganancia)}</span></div>
      <div class="card-actions">
        <button onclick="viewCotizacion('${c.id}')">👁️ Ver</button>
      </div>
    </div>`).join("") || `<p class="empty-hint">Este bazar todavía no tiene cotizaciones ligadas. Ve a "Cotizaciones guardadas" y usa "🏪 Asignar a bazar".</p>`;
}

/* =================================================================
   ASIGNAR COTIZACIÓN / PLAYERA A UN BAZAR
================================================================= */
function openModalAsignarBazar(cotizacionId) {
  if (!cotizacionId) return;
  setVal("ab-cotizacion-id", cotizacionId);
  setVal("ab-playera-id", "");
  document.getElementById("ab-status-wrap").style.display = "none";
  document.getElementById("ab-null-sale-wrap").style.display = "block";
  const c = AppState.cotizaciones.find(x => x.id === cotizacionId);
  const assignedIds = c ? bazarIdsDe(c) : [];
  renderAssignmentBazares(assignedIds);
  setChecked("ab-venta-nula", !!(c && c.ventaNula));
  closeModal("modal-ver-cotizacion");
  openModal("modal-asignar-bazar");
}
// Envoltura para el botón "🏪 Asignar a bazar" del modal "Ver cotización": no se puede
// referenciar directamente la variable de módulo `viewingCotizacionId` desde HTML inline.
function openModalAsignarBazarDesdeVista() {
  openModalAsignarBazar(viewingCotizacionId);
}
function openModalAsignarPlayeraBazar(playeraId) {
  if (!playeraId) return;
  setVal("ab-cotizacion-id", "");
  setVal("ab-playera-id", playeraId);
  document.getElementById("ab-status-wrap").style.display = "block";
  document.getElementById("ab-null-sale-wrap").style.display = "none";
  const p = AppState.playeras.find(x => x.id === playeraId);
  const assignedIds = p ? bazarIdsDe(p) : [];
  renderAssignmentBazares(assignedIds);
  setVal("ab-status", (p && p.bazarEstado) || "Disponible");
  setVal("ab-metodo-pago", (p && p.metodoPago) || "Efectivo");
  onAbStatusChange();
  openModal("modal-asignar-bazar");
}
// Solo tiene sentido preguntar el método de pago cuando la playera se marca "Vendida".
function onAbStatusChange() {
  const wrap = document.getElementById("ab-metodo-pago-wrap");
  if (wrap) wrap.style.display = val("ab-status") === "Vendida" ? "block" : "none";
}
function saveAsignarBazar() {
  const playeraId = val("ab-playera-id");
  const cotId = val("ab-cotizacion-id");
  const selectedBazarIds = Array.from(document.querySelectorAll(".ab-bazar-option:checked"))
    .map(option => option.value);
  const bazarId = selectedBazarIds[0] || "";
  if (playeraId) {
    const p = AppState.playeras.find(x => x.id === playeraId);
    if (!p) return;
    p.bazarId = bazarId;
    p.bazarIds = selectedBazarIds;
    p.bazarEstado = val("ab-status") || "Disponible";
    // Si se vendió con tarjeta, se calcula y guarda su comisión de terminal (con el %
    // vigente al momento de la venta, para que quede fijo aunque el % cambie después).
    if (p.bazarEstado === "Vendida") {
      p.metodoPago = val("ab-metodo-pago") || "Efectivo";
      const montoVenta = (p.precioVenta || 0) * (p.stock || 0);
      p.montoTarjeta = p.metodoPago === "Tarjeta" ? montoVenta : 0;
      p.comisionTerminal = comisionTerminalMonto(p.montoTarjeta, AppState.settings.comisionTerminalPct);
    } else {
      p.metodoPago = ""; p.montoTarjeta = 0; p.comisionTerminal = 0;
    }
    saveState();
    closeModal("modal-asignar-bazar");
    renderPlayeras(); renderBazares(); renderBazarDetalle(); renderClientes();
    showToast(bazarId ? (p.bazarEstado === "Vendida" ? "Playera marcada como vendida en los bazares." : p.bazarEstado === "Venta nula" ? "Playera marcada como venta nula." : "Playera asignada como disponible en los bazares.") : "Playera sin bazar asignado.");
    return;
  }
  const c = AppState.cotizaciones.find(x => x.id === cotId);
  if (!c) return;
  c.bazarId = bazarId;
  c.bazarIds = selectedBazarIds;
  c.ventaNula = checked("ab-venta-nula");
  saveState();
  closeModal("modal-asignar-bazar");
  renderCotizacionesGuardadas(); renderBazares();
  showToast(c.bazarId ? (c.ventaNula ? "Cotización asignada como venta nula." : "Cotización asignada a los bazares.") : "Cotización sin bazar asignado.");
}

/* =================================================================
   INGRESOS EXTRA DE UN BAZAR (juegos, rifas, propinas, etc.)
================================================================= */
function openModalIngresoExtra(id) {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) return;
  setVal("ie-id", id || "");
  document.getElementById("modal-ingreso-extra-title").textContent = id ? "Editar ingreso extra" : "Nuevo ingreso extra";
  if (id) {
    const i = (b.ingresosExtra || []).find(x => x.id === id);
    setVal("ie-concepto", i.concepto); setVal("ie-etiqueta", i.etiqueta); setVal("ie-monto", i.monto);
  } else {
    setVal("ie-concepto", ""); setVal("ie-etiqueta", "Juegos"); setVal("ie-monto", 0);
  }
  openModal("modal-ingreso-extra");
}
function saveIngresoExtra() {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) return;
  const concepto = val("ie-concepto").trim();
  if (!concepto) return showToast("Ponle un concepto al ingreso extra.", "error");
  if (!b.ingresosExtra) b.ingresosExtra = [];
  const id = val("ie-id");
  const data = { concepto, etiqueta: val("ie-etiqueta").trim() || "Otro", monto: parseFloat(num("ie-monto")) || 0 };
  if (id) {
    Object.assign(b.ingresosExtra.find(x => x.id === id), data);
  } else {
    b.ingresosExtra.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-ingreso-extra"); renderBazarDetalle(); renderBazares();
  showToast("Ingreso extra guardado.");
}
function deleteIngresoExtra(id) {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) return;
  if (!confirm("¿Eliminar este ingreso extra?")) return;
  b.ingresosExtra = (b.ingresosExtra || []).filter(x => x.id !== id);
  saveState(); renderBazarDetalle(); renderBazares();
}

/* =================================================================
   ESTADÍSTICAS Y GRÁFICAS
================================================================= */
let chartBazares = null;
let recommendedChart = null;
let selectedRecommendedCombination = "etiqueta-ganancia";
const customChartInstances = {};
function getRecommendedStyle(id) {
  const saved = (AppState.recommendedChartStyles || {})[id] || {};
  const combination = RECOMMENDED_COMBINATIONS.find(item => item.id === id) || RECOMMENDED_COMBINATIONS[0];
  return { tipo: saved.tipo || combination.tipo, paleta: saved.paleta || "accent" };
}
function renderEstadisticas() {
  const validCots = AppState.cotizaciones.filter(c => !c.ventaNula);
  const nullCots = AppState.cotizaciones.filter(c => c.ventaNula);
  const playerasAsignadas = AppState.playeras.filter(p => bazarIdsDe(p).length && (p.stock || 0) > 0);
  const totalVendidoPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    return s + ((p.precioVenta || 0) * (p.stock || 0));
  }, 0);
  const totalGananciaPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    const costoTotalUnit = costoTotalPlayera(p);
    return s + ((p.precioVenta || 0) - costoTotalUnit) * (p.stock || 0);
  }, 0);
  const perdidaPlayerasNulas = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Venta nula") return s;
    return s + costoTotalPlayera(p) * (p.stock || 0);
  }, 0);
  const totalVendido = validCots.reduce((s, c) => s + c.totalVenta, 0) + totalVendidoPlayeras;
  const perdidaCotsNulas = nullCots.reduce((s, c) => s + (c.totalCosto || 0), 0);
  const totalGanancia = validCots.reduce((s, c) => s + c.ganancia, 0) + totalGananciaPlayeras - perdidaCotsNulas - perdidaPlayerasNulas;
  const totalMayoreo = validCots.filter(c => c.tipoVenta === "Mayoreo").reduce((s, c) => s + c.totalVenta, 0);
  const totalRegalado = perdidaCotsNulas + perdidaPlayerasNulas;

  document.getElementById("stat-total-vendido").textContent = fmt(totalVendido);
  document.getElementById("stat-total-ganancia").textContent = fmt(totalGanancia);
  document.getElementById("stat-total-mayoreo").textContent = fmt(totalMayoreo);
  document.getElementById("stat-total-regalado").textContent = fmt(totalRegalado);

  // Ventas por bazar
  const porBazar = {};
  validCots.forEach(c => {
    const nombre = bazarIdsDe(c).length ? nombresBazares(c) : "Sin bazar / venta directa";
    porBazar[nombre] = (porBazar[nombre] || 0) + c.totalVenta;
  });
  const bazarLabels = Object.keys(porBazar);
  const bazarValues = Object.values(porBazar);
  const chartBazarCanvas = document.getElementById("chart-bazares");
  document.getElementById("chart-bazares-empty").style.display = bazarLabels.length ? "none" : "block";
  chartBazarCanvas.style.display = bazarLabels.length ? "block" : "none";
  if (chartBazares) chartBazares.destroy();
  if (bazarLabels.length) {
    chartBazares = new Chart(chartBazarCanvas, {
      type: "bar",
      data: { labels: bazarLabels, datasets: [{ label: "Total vendido ($)", data: bazarValues, backgroundColor: "#e3363d", borderRadius: 6 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  renderCombinacionesRecomendadas();
  renderGraficasPersonalizadas();
}

function renderCombinacionesRecomendadas() {
  const list = document.getElementById("recommended-combinations");
  if (!list) return;
  list.innerHTML = RECOMMENDED_COMBINATIONS.map(combination => `
    <button class="recommended-combination${combination.id === selectedRecommendedCombination ? " active" : ""}" data-recommended-combination="${combination.id}">
      <span class="recommended-combination-title">${combination.title}</span>
      <span class="recommended-combination-meta">${combination.description}</span>
    </button>`).join("");
  list.querySelectorAll("[data-recommended-combination]").forEach(button => {
    button.addEventListener("click", () => {
      selectedRecommendedCombination = button.dataset.recommendedCombination;
      renderCombinacionesRecomendadas();
    });
  });
  renderCombinacionRecomendada(selectedRecommendedCombination);
}

function renderCombinacionRecomendada(id) {
  const combination = RECOMMENDED_COMBINATIONS.find(item => item.id === id) || RECOMMENDED_COMBINATIONS[0];
  const style = getRecommendedStyle(combination.id);
  const canvas = document.getElementById("recommended-chart");
  const empty = document.getElementById("recommended-chart-empty");
  if (!canvas || !empty) return;
  document.getElementById("recommended-chart-title").textContent = combination.title;
  document.getElementById("recommended-chart-description").textContent = combination.description;
  setVal("recommended-chart-type", style.tipo);
  setVal("recommended-chart-palette", style.paleta);
  const data = datosGrafica(combination.fuente, combination.dimension, combination.metrica);
  if (recommendedChart) recommendedChart.destroy();
  recommendedChart = null;
  const hasData = data.labels.length && data.values.some(value => Number(value) > 0);
  canvas.style.display = hasData ? "block" : "none";
  empty.style.display = hasData ? "none" : "block";
  if (!hasData) return;
  recommendedChart = new Chart(canvas, {
    type: style.tipo,
    data: {
      labels: data.labels,
      datasets: [{ label: data.label, data: data.values, backgroundColor: RECOMMENDED_PALETTES[style.paleta], borderColor: RECOMMENDED_PALETTES[style.paleta][0], borderWidth: 2, tension: .25 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: style.tipo === "doughnut" || style.tipo === "pie" ? {} : { y: { beginAtZero: true } } }
  });
}

document.getElementById("recommended-chart-apply").addEventListener("click", () => {
  if (!AppState.recommendedChartStyles) AppState.recommendedChartStyles = {};
  AppState.recommendedChartStyles[selectedRecommendedCombination] = {
    tipo: val("recommended-chart-type"),
    paleta: val("recommended-chart-palette")
  };
  saveState();
  renderCombinacionRecomendada(selectedRecommendedCombination);
  showToast("Estilo de la gráfica actualizado.");
});

function toggleGraficaInventarioOptions() {
  const options = document.getElementById("grafica-inventario-options");
  if (options) options.style.display = val("grafica-fuente") === "inventario" ? "flex" : "none";
}

function openModalGrafica(id) {
  setVal("grafica-id", id || "");
  document.getElementById("modal-grafica-title").textContent = id ? "Editar gráfica" : "Nueva gráfica";
  const grafica = id ? AppState.graficas.find(g => g.id === id) : null;
  setVal("grafica-titulo", grafica ? grafica.titulo : "");
  setVal("grafica-fuente", grafica ? grafica.fuente : "ventas-bazares");
  setVal("grafica-tipo", grafica ? grafica.tipo : "bar");
  setVal("grafica-dimension", grafica ? (grafica.dimension || "etiqueta") : "etiqueta");
  setVal("grafica-metrica", grafica ? (grafica.metrica || "stock") : "stock");
  toggleGraficaInventarioOptions();
  openModal("modal-grafica");
}

function saveGrafica() {
  const titulo = val("grafica-titulo").trim();
  if (!titulo) return showToast("Escribe un título para la gráfica.", "error");
  const id = val("grafica-id");
  const data = {
    titulo,
    fuente: val("grafica-fuente"),
    tipo: val("grafica-tipo"),
    dimension: val("grafica-dimension") || "etiqueta",
    metrica: val("grafica-metrica") || "stock"
  };
  if (id) {
    Object.assign(AppState.graficas.find(g => g.id === id), data);
  } else {
    AppState.graficas.push(Object.assign({ id: uid() }, data));
  }
  saveState();
  closeModal("modal-grafica");
  renderGraficasPersonalizadas();
  showToast(id ? "Gráfica actualizada." : "Gráfica agregada.");
}

function deleteGrafica(id) {
  if (!confirm("¿Eliminar esta gráfica?")) return;
  AppState.graficas = AppState.graficas.filter(g => g.id !== id);
  if (customChartInstances[id]) {
    customChartInstances[id].destroy();
    delete customChartInstances[id];
  }
  saveState();
  renderGraficasPersonalizadas();
  showToast("Gráfica eliminada.");
}

function renderGraficasPersonalizadas() {
  const grid = document.getElementById("custom-charts-grid");
  const empty = document.getElementById("custom-charts-empty");
  if (!grid || !empty) return;
  Object.keys(customChartInstances).forEach(id => {
    customChartInstances[id].destroy();
    delete customChartInstances[id];
  });
  empty.style.display = AppState.graficas.length ? "none" : "block";
  grid.innerHTML = AppState.graficas.map(g => `
    <div class="settings-card custom-chart-card">
      <div class="section-header" style="justify-content:space-between;margin-bottom:0;">
        <h3 class="section-title" style="font-size:1.1rem;">${escapeHtml(g.titulo)}</h3>
        <div class="bazar-row-actions">
          <button onclick="openModalGrafica('${g.id}')">✏️ Editar</button>
          <button class="danger" onclick="deleteGrafica('${g.id}')">🗑️ Borrar</button>
        </div>
      </div>
      <canvas id="custom-chart-${g.id}" class="custom-chart-canvas"></canvas>
    </div>`).join("");
  AppState.graficas.forEach(g => {
    const canvas = document.getElementById(`custom-chart-${g.id}`);
    const data = datosGrafica(g.fuente, g.dimension, g.metrica);
    customChartInstances[g.id] = new Chart(canvas, {
      type: g.tipo,
      data: {
        labels: data.labels,
        datasets: [{ label: data.label, data: data.values, backgroundColor: ["#e3363d", "#3fb87f", "#e0a23a", "#8b8b93"], borderColor: "#e3363d", borderWidth: 2, tension: .25 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, scales: g.tipo === "doughnut" || g.tipo === "pie" ? {} : { y: { beginAtZero: true } } }
    });
  });
}

/* =================================================================
   INICIALIZACIÓN
================================================================= */
export function renderAll() {
  refreshAllSelects();
  renderColores();
  renderEtiquetas();
  renderEtiquetasOperativas();
  renderTallaEtiquetas();
  renderArtistas();
  renderProveedores();
  renderGastos();
  renderMermas();
  renderComprasPendientes();
  renderBazares();
  renderConsignaciones();
  renderCaja();
  renderInteres();
  renderAjustes();
  renderPlayeras();
  renderStickers();
  renderCotizacionesGuardadas();
  resetQuoteForm();
}

/* =================================================================
   EXPOSICIÓN A WINDOW
   Necesario porque index.html usa atributos inline onclick="..." /
   onchange="..." (tanto en el HTML estático como en el HTML generado
   dinámicamente aquí mismo vía innerHTML), y en un módulo ES6 las
   funciones ya no son globales por defecto.
================================================================= */
Object.assign(window, {
  adjustTallaEtiqueta, addQuoteItem, addQuoteSticker, confirmResetAll,
  deleteArtista, deleteBazar, deleteBazarFromDetalle, deleteColor, deleteCotizacion,
  deleteEtiqueta, deleteEtiquetaOp, deleteGrafica, deleteIngresoExtra, deletePlayera, deleteProveedor,
  deleteServicioExtra, deleteSticker, deleteTallaEtiqueta,
  deleteGasto, deleteCompra, addAhorroCompra, toggleCompraComprada, desvincularCostoRealDePiezaBoton, recalcularRepartoGasto,
  deleteMerma, deleteConsignacion,
  deleteCliente, deleteClienteEtiqueta, guardarClienteLegacy,
  duplicateCotizacion, editActiveBazar, editCotizacion, exportQuotePDF, exportQuoteWhatsApp, exportQuoteWhatsAppGuardada, goToBazarDetalle,
  onAbStatusChange, onAscConsignacionChange, onArtistModeChange, onHeaderBazarChange, onMermaPlayeraChange, onPlayeraArtistChange, onPlayeraModoCosteoChange, onPlayeraNumEstampadosChange, onPlayeraTieneEtiquetaChange,
  onPrendaClienteChange, onQuoteArtistChange, onQuoteEstampadoModoChange, onQuoteItemProductChange,
  onQuoteMetodoPagoChange, onQuoteClienteSelectChange,
  onQuoteTipoVentaChange, onQuoteVentaNulaChange,
  openPreviewCotizacion, openPreviewCotizacionGuardada, confirmarExportarPDF, confirmarExportarWhatsApp,
  openModalArtista, openModalAsignarBazar, openModalAsignarBazarDesdeVista, openModalAsignarPlayeraBazar, openModalAsignarConsignacion, openModalBazar,
  openModalBazarDesdeAsignacion, openModalCliente, openModalClienteDetalle, openModalClienteDetalleLegacy, openModalClienteEtiqueta,
  openModalColor, openModalEtiqueta, openModalEtiquetaOp, openModalGrafica, openModalConsignacion, openModalMerma, openModalMermaDesdePlayera,
  openModalIngresoExtra, openModalPlayera, openModalProveedor, openModalQuoteEstampados, openModalServicioExtra,
  openModalSticker, openModalTallaEtiqueta, openModalGasto, openModalCompra, quoteStickerFromInventory,
  addBazarExpense, removeBazarExpense, updateBazarCostTotal, updateEfectivoContadoBazar, updateMermaCostoPreview,
  renderCaja, updateFondoCaja, updateEfectivoContadoCaja,
  renderInteres, openModalConsulta, onConsultaProductoChange, saveConsulta, quickAddConsulta, quickSubtractConsulta, deleteConsulta,
  openModalConsultaEtiqueta, saveConsultaEtiqueta, deleteConsultaEtiqueta,
  saveAsignarConsignacion, saveConsignacion, saveMerma,
  removeQuoteItem, removeQuoteSticker, renderCotizacionesGuardadas, renderPlayeras, renderQuoteItems,
  resetQuoteForm, saveArtista, saveAsignarBazar, saveBazar, saveCliente, saveClienteEtiqueta, saveColor, saveEtiqueta, saveEtiquetaOp,
  saveGrafica, saveIngresoExtra, savePlayera, saveProveedor, saveQuote, saveServicioExtra,
  saveSettings, saveSticker, saveGasto, saveCompra,
  saveTallaEtiqueta, setClienteEtiquetaFiltro, setPlayeraTagFilter, setStickerSizeFilter, switchPage,
  toggleGraficaInventarioOptions, toggleQuoteAreaDtfEspecial, toggleQuoteItemFlag, toggleQuoteTagOperativo, toggleGastoLigarPlayeras,
  updateCotizacionEstado, updateCotizacionProduccion, updateCotizacionProduccionDesdeModal,
  updatePlayeraEstampadoField, updatePlayeraPreview, updateGastoLigarPreview,
  updateQuoteEstampadoField, updateQuoteEstampadosCountFromModal, updateQuoteGangSheetField, updateQuoteItemField, updateQuoteStickerField, updateQuoteSummary, updateStickerCostPreview,
  viewCotizacion
});
