/* ============================================================
   LUCXSTUDIO — ui.js
   Manipulación del DOM, renderizado de tarjetas, modales y alertas
   ============================================================ */
import { SECTION_LABELS, ARTIST_PRESETS, ARTIST_MODE_LABEL, TIPOS_PRENDA, ETAPAS_PRODUCCION, RECOMMENDED_COMBINATIONS, RECOMMENDED_PALETTES } from "./config.js";
import { AppState, uid, saveState, getSectionData, importData, resetState, setToastHandler } from "./storage.js";
import {
  fmt, escapeHtml, costoTotalPlayera, getCostoEstampadoEfectivo, sobrecargoTalla, costoUnitarioItem,
  areaTotalCm2, costoImpresion,
  colorNombre, colorHex, estadoBadgeClass, prioridadBadgeClass, bazarEstadoBadgeClass,
  bazarIdsDe, bazarTiene, nombresBazares, getBazarVentasYGanancia,
  datosGrafica, datosInventarioGrafica, semaforoCotizacion, agruparClientes, agruparArtes
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
  bazares: "Mis Bazares",
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
    setVal("b-nombre", b.nombre); setVal("b-lugar", b.lugar); setVal("b-fecha", b.fecha);
    setVal("b-costo", b.costoBazar || 0); setVal("b-notas", b.notas || "");
  } else {
    setVal("b-nombre", ""); setVal("b-lugar", ""); setVal("b-fecha", new Date().toISOString().slice(0,10));
    setVal("b-costo", 0); setVal("b-notas", "");
  }
  openModal("modal-bazar");
}
function saveBazar() {
  const nombre = val("b-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al bazar.", "error");
  const id = val("b-id");
  const data = {
    nombre, lugar: val("b-lugar"), fecha: val("b-fecha"),
    costoBazar: parseFloat(num("b-costo")) || 0, notas: val("b-notas")
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
function renderBazares() {
  const body = document.getElementById("bazares-table-body");
  document.getElementById("bazares-empty-hint").style.display = AppState.bazares.length ? "none" : "block";
  body.innerHTML = AppState.bazares.map(b => {
    const stats = getBazarVentasYGanancia(b.id);
    const costoBazar = b.costoBazar || 0;
    const sumIngresosExtra = (b.ingresosExtra || []).reduce((s, i) => s + (i.monto || 0), 0);
    const gananciaNeta = stats.gananciaVentas + sumIngresosExtra - costoBazar;
    const esActivo = activeBazarId === b.id;
    return `
    <tr class="${esActivo ? "is-active" : ""}">
      <td>
        <div class="bazar-name-cell">🏪 ${escapeHtml(b.nombre)} ${esActivo ? `<span class="card-badge badge-alta">Activo</span>` : ""}</div>
        <div class="card-meta">${escapeHtml(b.lugar || "—")} · ${b.fecha || "—"}${costoBazar ? ` · Costo: ${fmt(costoBazar)}` : ""}</div>
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
  // Artista select en cotizador
  const qArtista = document.getElementById("q-artista");
  qArtista.innerHTML = `<option value="">Sin artista (100% estudio)</option>` +
    AppState.artistas.map(a => `<option value="${a.id}">${escapeHtml(a.nombre)} (${a.pctArtista}%)</option>`).join("") +
    `<option value="__custom__">Personalizado...</option>`;
  // Etiquetas operativas en el cotizador (Urgente, Retrabajo, etc.)
  renderQuoteTagsOperativos();
  // Selector global de bazar activo (header)
  renderHeaderBazarSelect();
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
  }
  document.getElementById("p-costo-playera").disabled = checked("p-prenda-cliente");
  renderPlayeraEstampadosList();
  onPlayeraModoCosteoChange();
  openModal("modal-playera");
}
function onPrendaClienteChange() {
  const esCliente = checked("p-prenda-cliente");
  const input = document.getElementById("p-costo-playera");
  input.disabled = esCliente;
  if (esCliente) input.value = 0;
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
  const cTotal = costoBase + cEst + sobrecargo;
  const ganancia = num("p-precio-venta") - cTotal;
  const etiquetaCosto = draft.modoCosteo === "gangsheet" ? "Costo Gang Sheet" : "Costo del estampado";
  document.getElementById("p-cost-preview").innerHTML =
    `${etiquetaCosto}: <b>${fmt(cEst)}</b>${sobrecargo ? ` — Sobrecargo talla: <b>${fmt(sobrecargo)}</b>` : ""} — Costo total: <b>${fmt(cTotal)}</b> — Ganancia estimada: <b>${fmt(ganancia)}</b>`;
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
    bazarId: (existing && existing.bazarId) || "",
    bazarIds: (existing && bazarIdsDe(existing)) || [],
    bazarEstado: (existing && existing.bazarEstado) || "Disponible",
    tags, notas: val("p-notas")
  };
  if (id) {
    Object.assign(existing, data);
  } else {
    AppState.playeras.push(Object.assign({ id: uid() }, data));
  }
  saveState(); closeModal("modal-playera"); refreshAllSelects(); renderPlayeras();
  showToast("Playera guardada.");
}
function deletePlayera(id) {
  if (!confirm("¿Eliminar esta playera del inventario?")) return;
  AppState.playeras = AppState.playeras.filter(x => x.id !== id);
  saveState(); renderPlayeras();
}
function renderPlayeras() {
  renderPlayeraTagChips();
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
  const grid = document.getElementById("playeras-grid");
  document.getElementById("playeras-empty-hint").style.display = list.length ? "none" : "block";
  grid.innerHTML = list.map(p => {
    const cEst = costoImpresion(p);
    const cTotal = costoTotalPlayera(p);
    const ganancia = p.precioVenta - cTotal;
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
        ${p.tieneEtiquetaTalla ? "·<span>🏷️ con etiqueta</span>" : ""}
      </div>
      <div class="card-row"><span>Stock</span><span>${p.stock} pza(s)</span></div>
      <div class="card-row"><span>Costo playera</span><span>${p.prendaCliente ? "🎁 Prenda del cliente ($0.00)" : fmt(p.costoPlayera)}</span></div>
      <div class="card-row"><span>${etiquetaImpresion}</span><span>${fmt(cEst)}</span></div>
      <div class="card-row"><span>Costo total</span><span>${fmt(cTotal)}</span></div>
      <div class="card-row"><span>Precio de venta</span><span>${fmt(p.precioVenta)}</span></div>
      ${p.precioMayoreo ? `<div class="card-row"><span>Precio mayoreo</span><span>${fmt(p.precioMayoreo)}</span></div>` : ""}
      <div class="card-row"><span>Ganancia</span><span style="color:${ganancia >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt(ganancia)}</span></div>
      <div class="card-tags">
        <span class="card-badge ${estadoBadgeClass(p.estado)}">${p.estado}</span>
        <span class="card-badge ${prioridadBadgeClass(p.prioridad)}">${p.prioridad}</span>
        ${bazarEstado ? `<span class="card-badge ${bazarEstadoBadgeClass(bazarEstado)}">${bazarEstado === "Vendida" ? "✅ Vendida" : bazarEstado === "Venta nula" ? "🎁 Venta nula" : "🟢 En bazar"}</span>` : ""}
        ${bazarIdsDe(p).length ? `<span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(p))}</span>` : ""}
        ${p.prendaCliente ? `<span class="card-badge badge-media">🎁 Prenda del cliente</span>` : ""}
        ${esGangSheet ? `<span class="card-badge badge-alta">🧻 Gang Sheet</span>` : (p.dtfEspecial ? `<span class="card-badge badge-alta">✨ DTF especial</span>` : "")}
        ${stockBajo ? `<span class="card-badge badge-agotado">⚠️ Stock bajo</span>` : ""}
        ${tagsHtml}
      </div>
      <div class="card-actions">
        <button onclick="openModalPlayera('${p.id}')">✏️ Editar</button>
        <button onclick="openModalAsignarPlayeraBazar('${p.id}')">🏪 Bazar</button>
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
  if (id) {
    const s = AppState.stickers.find(x => x.id === id);
    setVal("s-nombre", s.nombre); setVal("s-tamano", s.tamano); setVal("s-costo", s.costo);
    setVal("s-stock", s.stock); setVal("s-stock-minimo", s.stockMinimo ?? AppState.settings.stockMinimoDefault ?? 0);
    setVal("s-prioridad", s.prioridad); setVal("s-estado", s.estado);
    setVal("s-notas", s.notas || "");
  } else {
    setVal("s-nombre", ""); setVal("s-tamano", "Chico"); setVal("s-costo", 10);
    setVal("s-stock", 1); setVal("s-stock-minimo", AppState.settings.stockMinimoDefault || 0);
    setVal("s-prioridad", "Media"); setVal("s-estado", "En stock"); setVal("s-notas", "");
  }
  openModal("modal-sticker");
}
function saveSticker() {
  const nombre = val("s-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al estampado.", "error");
  const id = val("s-id");
  const data = {
    nombre, tamano: val("s-tamano"), costo: parseFloat(num("s-costo")) || 0,
    stock: parseInt(num("s-stock")) || 0, stockMinimo: parseInt(num("s-stock-minimo")) || 0,
    prioridad: val("s-prioridad"), estado: val("s-estado"),
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
    return `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(s.nombre)}</span>
        <span class="card-badge badge-media">${s.tamano}</span>
      </div>
      <div class="card-row"><span>Costo</span><span>${fmt(s.costo)}</span></div>
      <div class="card-row"><span>Stock</span><span>${s.stock} pza(s)</span></div>
      <div class="card-tags">
        <span class="card-badge ${estadoBadgeClass(s.estado)}">${s.estado}</span>
        <span class="card-badge ${prioridadBadgeClass(s.prioridad)}">${s.prioridad}</span>
        ${stockBajo ? `<span class="card-badge badge-agotado">⚠️ Stock bajo</span>` : ""}
      </div>
      ${s.notas ? `<div class="card-meta">${escapeHtml(s.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalSticker('${s.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteSticker('${s.id}')">🗑️ Eliminar</button>
      </div>
    </div>`;
  }).join("");
}

/* =================================================================
   COTIZADOR RÁPIDO
================================================================= */
let quoteItems = [];
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
  document.getElementById("quote-empty-hint").style.display = quoteItems.length ? "none" : "block";
  const addSpace = document.getElementById("quote-add-space");
  if (addSpace) addSpace.style.display = quoteItems.length ? "none" : "flex";
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
        <select onchange="onQuoteItemProductChange('${item.rowId}', this.value)">
          <option value="">— Manual / personalizado —</option>
          ${playeraOptions}
        </select>
        ${!item.playeraId ? `<input type="text" placeholder="Nombre" value="${escapeHtml(item.nombre)}" style="margin-top:4px;" onchange="updateQuoteItemField('${item.rowId}','nombre',this.value)">` : `<div class="card-meta" style="margin-top:4px;">${escapeHtml(item.nombre)}</div>`}
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
  const sumServiciosExtra = quoteServiciosExtra.reduce((s, i) => s + (i.monto || 0), 0);
  ventaBruta += sumServiciosExtra;
  const descuentoPct = Math.min(15, Math.max(0, num("q-descuento-pct") || 0));
  const montoDescuento = ventaBruta * (descuentoPct / 100);
  const ventaConDescuento = ventaBruta - montoDescuento;
  const esUrgente = checked("q-urgente");
  const recargoUrgentePct = esUrgente ? (AppState.settings.recargoUrgentePct || 0) : 0;
  const montoUrgente = ventaConDescuento * (recargoUrgentePct / 100);
  const totalVenta = ventaConDescuento + montoUrgente;
  const ganancia = totalVenta - totalCosto;
  const comision = currentQuoteCommission();
  const parteArtista = ganancia * (comision.pctArtista / 100);
  const parteEstudio = ganancia * (comision.pctEstudio / 100);
  return {
    ventaBruta, totalVenta, totalCosto, ganancia, parteArtista, parteEstudio, comision, sumServiciosExtra,
    descuentoPct, montoDescuento, esUrgente, recargoUrgentePct, montoUrgente
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
  quoteServiciosExtra = [];
  quoteTagsOperativos = [];
  setVal("quote-editing-id", ""); setVal("q-cliente", ""); setVal("q-vendedor", "");
  setVal("q-fecha", new Date().toISOString().slice(0,10));
  setVal("q-artista", ""); setVal("q-comision-pct", 0); setVal("q-notas", "");
  setVal("q-tipo-venta", "Menudeo");
  setVal("q-descuento-pct", 0); setChecked("q-urgente", false);
  setChecked("q-venta-nula", false); setVal("q-venta-nula-motivo", "");
  document.getElementById("q-comision-custom-wrap").style.display = "none";
  document.getElementById("q-venta-nula-motivo-wrap").style.display = "none";
  document.getElementById("venta-nula-banner").style.display = "none";
  renderQuoteTagsOperativos();
  renderQuoteItems();
}
function saveQuote() {
  if (!quoteItems.length) return showToast("Agrega al menos una prenda.", "error");
  const t = computeQuoteTotals();
  const editingId = val("quote-editing-id");
  const data = {
    cliente: val("q-cliente") || "Cliente sin nombre",
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
    serviciosExtra: JSON.parse(JSON.stringify(quoteServiciosExtra)),
    ventaBruta: t.ventaBruta,
    descuentoPct: t.descuentoPct, montoDescuento: t.montoDescuento,
    urgente: t.esUrgente, recargoUrgentePct: t.recargoUrgentePct, montoUrgente: t.montoUrgente,
    totalVenta: t.totalVenta, totalCosto: t.totalCosto, ganancia: t.ganancia,
    parteArtista: t.parteArtista, parteEstudio: t.parteEstudio,
    comisionNombre: t.comision.nombre, pctArtista: t.comision.pctArtista, pctEstudio: t.comision.pctEstudio,
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
  if (!quoteItems.length) return showToast("Agrega al menos una prenda antes de exportar.", "error");
  const t = computeQuoteTotals();
  const html = buildQuoteHTML({
    folio: val("quote-editing-id") ? "Edición" : "Nueva",
    cliente: val("q-cliente") || "Cliente sin nombre", fecha: val("q-fecha"), vendedor: val("q-vendedor"),
    items: quoteItems, serviciosExtra: quoteServiciosExtra, notas: val("q-notas"), ventaNula: checked("q-venta-nula"),
    tipoVenta: val("q-tipo-venta"), ...t
  });
  const container = document.getElementById("pdf-template");
  container.innerHTML = html;
  html2pdf().set({ margin: 10, filename: "cotizacion_lucxstudio.pdf", html2canvas: { scale: 2 } }).from(container).save();
}
function buildQuoteHTML(q) {
  const rows = q.items.map(item => {
    return `<tr>
      <td>${escapeHtml(item.nombre || "—")}${item.tipo ? ` <span style="color:#888;">(${escapeHtml(item.tipo)})</span>` : ""}</td><td>${escapeHtml(item.talla)}</td><td>${colorNombre(item.colorId)}</td>
      <td>${item.cantidad}</td><td>${fmt(item.precioVenta)}</td><td>${fmt(item.precioVenta*item.cantidad)}</td>
    </tr>`;
  }).join("");
  return `
  <div style="font-family:Arial,sans-serif;color:#222;padding:10px;">
    <div style="display:flex;justify-content:space-between;border-bottom:3px solid #c0242c;padding-bottom:10px;margin-bottom:16px;">
      <div><h1 style="margin:0;color:#c0242c;">LUCXSTUDIO</h1><p style="margin:2px 0;font-size:12px;">Cotización de playeras ${q.tipoVenta === "Mayoreo" ? "— Mayoreo" : ""}${q.urgente || q.esUrgente ? " — 🚀 Pedido urgente" : ""}</p></div>
      <div style="text-align:right;font-size:12px;"><b>Folio:</b> ${q.folio}<br><b>Fecha:</b> ${q.fecha}</div>
    </div>
    <p style="font-size:13px;"><b>Cliente:</b> ${escapeHtml(q.cliente)} &nbsp;&nbsp; <b>Vendedor:</b> ${escapeHtml(q.vendedor||"—")}</p>
    ${q.ventaNula ? `<p style="font-size:12px;background:#fdeeee;border:1px dashed #c0242c;padding:6px;">🎁 Cotización marcada como venta nula (regalo / cortesía).</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
      <thead><tr style="background:#f2f2f2;"><th style="padding:6px;text-align:left;">Producto</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Precio c/u</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${q.serviciosExtra && q.serviciosExtra.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
      <thead><tr style="background:#f2f2f2;"><th style="padding:6px;text-align:left;">Servicio extra</th><th>Monto</th></tr></thead>
      <tbody>${q.serviciosExtra.map(s => `<tr><td>${escapeHtml(s.concepto)}</td><td>${fmt(s.monto)}</td></tr>`).join("")}</tbody>
    </table>` : ""}
    <div style="margin-top:16px;text-align:right;font-size:13px;">
      <p>Total costo producción: ${fmt(q.totalCosto)}</p>
      ${q.montoDescuento ? `<p>Subtotal: ${fmt(q.ventaBruta)}</p><p style="color:#c0242c;">Descuento (${q.descuentoPct}%): − ${fmt(q.montoDescuento)}</p>` : ""}
      ${q.montoUrgente ? `<p style="color:#c0242c;">Recargo por urgencia (${q.recargoUrgentePct}%): + ${fmt(q.montoUrgente)}</p>` : ""}
      <p style="font-size:16px;font-weight:bold;color:#c0242c;">Total de venta: ${fmt(q.totalVenta)}</p>
      <p>Ganancia total: ${fmt(q.ganancia)}</p>
    </div>
    ${q.notas ? `<p style="margin-top:14px;font-size:12px;"><b>Notas:</b> ${escapeHtml(q.notas)}</p>` : ""}
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
      <div class="card-meta">${escapeHtml(c.cliente)} · ${c.fecha} · ${c.items.length} prenda(s) · 🚦 ${escapeHtml(c.estadoProduccion || "Por hacer")}</div>
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
  setVal("quote-editing-id", c.id); setVal("q-cliente", c.cliente); setVal("q-fecha", c.fecha);
  setVal("q-vendedor", c.vendedor); setVal("q-artista", c.artistaId || "");
  setVal("q-comision-pct", c.comisionPctPersonalizado || 0); setVal("q-notas", c.notas || "");
  setVal("q-tipo-venta", c.tipoVenta || "Menudeo");
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
          <select onchange="updateCotizacionProduccion('${c.id}', this.value)" style="width:100%;margin-top:6px;">
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
   HISTORIAL DE CLIENTES
================================================================= */
let viewingClienteKey = null;
function renderClientes() {
  const grid = document.getElementById("clientes-grid");
  if (!grid) return;
  const searchTerm = document.getElementById("global-search").value.trim().toLowerCase();
  const clientes = agruparClientes().filter(cl => !searchTerm || cl.nombre.toLowerCase().includes(searchTerm));
  document.getElementById("clientes-empty-hint").style.display = clientes.length ? "none" : "block";
  grid.innerHTML = clientes.map(cl => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">👤 ${escapeHtml(cl.nombre)}</span>
      </div>
      <div class="card-row"><span>Pedidos</span><span>${cl.pedidos}</span></div>
      <div class="card-row"><span>Total gastado</span><span>${fmt(cl.totalGastado)}</span></div>
      <div class="card-row"><span>Última compra</span><span>${cl.ultimaFecha || "—"}</span></div>
      <div class="card-actions">
        <button onclick="openModalClienteDetalle('${cl.nombre.replace(/'/g, "\\'")}')">📜 Ver historial</button>
      </div>
    </div>`).join("");
}
function openModalClienteDetalle(nombre) {
  viewingClienteKey = nombre.toLowerCase();
  document.getElementById("modal-cliente-detalle-title").textContent = "👤 " + nombre;
  const pedidos = AppState.cotizaciones.filter(c => ((c.cliente || "Cliente sin nombre").trim() || "Cliente sin nombre").toLowerCase() === viewingClienteKey);
  document.getElementById("modal-cliente-detalle-body").innerHTML = pedidos.map(c => `
    <div class="card-row">
      <span>${escapeHtml(c.folio)} · ${c.fecha} · ${c.estado}${c.ventaNula ? " · 🎁 venta nula" : ""}</span>
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
let chartBazarTipo = null;
function renderBazarDetalle() {
  const b = AppState.bazares.find(x => x.id === activeBazarId);
  if (!b) { switchPage("bazares"); return; }
  document.getElementById("bd-nombre").textContent = "🏪 " + b.nombre;
  document.getElementById("bd-meta").textContent = `${b.lugar || "—"} · ${b.fecha || "—"}${b.notas ? " · " + b.notas : ""}`;

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
  const gananciaVentas = validas.reduce((s, c) => s + c.ganancia, 0) + gananciaVentasPlayeras - perdidaCotsNulas - perdidaPlayerasNulas;
  const totalRegalado = perdidaCotsNulas + perdidaPlayerasNulas;
  const costoBazar = b.costoBazar || 0;
  const ingresosExtra = b.ingresosExtra || [];
  const sumIngresosExtra = ingresosExtra.reduce((s, i) => s + (i.monto || 0), 0);
  const gananciaNeta = gananciaVentas + sumIngresosExtra - costoBazar;
  const playerasVendidas = playerasAsignadas.filter(p => (p.bazarEstado || "Disponible") === "Vendida");
  const playerasDisponibles = playerasAsignadas.filter(p => (p.bazarEstado || "Disponible") !== "Vendida");

  document.getElementById("bd-total-vendido").textContent = fmt(totalVendido);
  document.getElementById("bd-ganancia").textContent = fmt(gananciaVentas);
  document.getElementById("bd-cotizaciones").textContent = todas.length + playerasAsignadas.length;
  document.getElementById("bd-regalado").textContent = fmt(totalRegalado);
  document.getElementById("bd-costo-bazar").textContent = fmt(costoBazar);
  document.getElementById("bd-ingresos-extra").textContent = fmt(sumIngresosExtra);
  document.getElementById("bd-ganancia-neta").textContent = fmt(gananciaNeta);

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
      const estadoLabel = esVendida ? "✅ Vendida" : esNula ? "🎁 Venta nula" : "🟢 Disponible";
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

  // Menudeo vs mayoreo dentro de este bazar
  const totalMenudeo = validas.filter(c => c.tipoVenta !== "Mayoreo").reduce((s, c) => s + c.totalVenta, 0);
  const totalMayoreo = validas.filter(c => c.tipoVenta === "Mayoreo").reduce((s, c) => s + c.totalVenta, 0);
  if (chartBazarTipo) chartBazarTipo.destroy();
  chartBazarTipo = new Chart(document.getElementById("chart-bazar-tipo"), {
    type: "doughnut",
    data: { labels: ["Menudeo", "Mayoreo"], datasets: [{ data: [totalMenudeo, totalMayoreo], backgroundColor: ["#8b8b93", "#e3363d"] }] },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });

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
  openModal("modal-asignar-bazar");
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
    saveState();
    closeModal("modal-asignar-bazar");
    renderPlayeras(); renderBazares(); renderBazarDetalle();
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
  renderBazares();
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
  adjustTallaEtiqueta, addQuoteItem, confirmResetAll,
  deleteArtista, deleteBazar, deleteBazarFromDetalle, deleteColor, deleteCotizacion,
  deleteEtiqueta, deleteEtiquetaOp, deleteGrafica, deleteIngresoExtra, deletePlayera, deleteProveedor,
  deleteServicioExtra, deleteSticker, deleteTallaEtiqueta,
  duplicateCotizacion, editActiveBazar, editCotizacion, exportQuotePDF, goToBazarDetalle,
  onArtistModeChange, onHeaderBazarChange, onPlayeraModoCosteoChange, onPlayeraNumEstampadosChange,
  onPrendaClienteChange, onQuoteArtistChange, onQuoteEstampadoModoChange, onQuoteItemProductChange,
  onQuoteTipoVentaChange, onQuoteVentaNulaChange,
  openModalArtista, openModalAsignarBazar, openModalAsignarBazarDesdeVista, openModalAsignarPlayeraBazar, openModalBazar,
  openModalBazarDesdeAsignacion, openModalClienteDetalle, openModalColor, openModalEtiqueta, openModalEtiquetaOp, openModalGrafica,
  openModalIngresoExtra, openModalPlayera, openModalProveedor, openModalQuoteEstampados, openModalServicioExtra,
  openModalSticker, openModalTallaEtiqueta,
  removeQuoteItem, renderCotizacionesGuardadas, renderPlayeras, renderQuoteItems,
  resetQuoteForm, saveArtista, saveAsignarBazar, saveBazar, saveColor, saveEtiqueta, saveEtiquetaOp,
  saveGrafica, saveIngresoExtra, savePlayera, saveProveedor, saveQuote, saveServicioExtra,
  saveSettings, saveSticker,
  saveTallaEtiqueta, setPlayeraTagFilter, setStickerSizeFilter, switchPage,
  toggleGraficaInventarioOptions, toggleQuoteAreaDtfEspecial, toggleQuoteItemFlag, toggleQuoteTagOperativo,
  updateCotizacionEstado, updateCotizacionProduccion, updateCotizacionProduccionDesdeModal,
  updatePlayeraEstampadoField, updatePlayeraPreview,
  updateQuoteEstampadoField, updateQuoteEstampadosCountFromModal, updateQuoteGangSheetField, updateQuoteItemField, updateQuoteSummary,
  viewCotizacion
});
