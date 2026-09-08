/* ============================================================
   LUCXSTUDIO — app.js
   Control de playeras, estampados y cotizaciones
   ============================================================ */

const STORAGE_KEY = "LUCXSTUDIO_APP_STATE";

/* ---------------------------------------------------------------
   1. ESTADO INICIAL
--------------------------------------------------------------- */
function defaultState() {
  return {
    settings: {
      dtfPrecioMetro: 190,
      dtfAnchoRolloCm: 58,
      moneda: "MXN"
    },
    colores: [
      { id: "c1", nombre: "Negro", hex: "#111113" },
      { id: "c2", nombre: "Rojo", hex: "#c0242c" },
      { id: "c3", nombre: "Gris", hex: "#8b8b93" },
      { id: "c4", nombre: "Blanco", hex: "#f2f0ee" }
    ],
    etiquetas: [
      { id: "e1", nombre: "Anime", color: "#e3363d" },
      { id: "e2", nombre: "Oversize", color: "#8b8b93" },
      { id: "e3", nombre: "Bolsa sorpresa", color: "#e0a23a" }
    ],
    tallaEtiquetas: [
      { id: "te1", talla: "CH", color: "Negro", cantidad: 0 },
      { id: "te2", talla: "MD", color: "Negro", cantidad: 0 },
      { id: "te3", talla: "G", color: "Negro", cantidad: 0 },
      { id: "te4", talla: "CH", color: "Blanco", cantidad: 0 },
      { id: "te5", talla: "MD", color: "Blanco", cantidad: 0 },
      { id: "te6", talla: "G", color: "Blanco", cantidad: 0 }
    ],
    playeras: [],
    stickers: [],
    artistas: [
      { id: "a1", nombre: "SrLucas", modo: "ninguno", pctArtista: 0, pctEstudio: 100, notas: "Estudio principal" },
      { id: "a2", nombre: "Obake", modo: "venta", pctArtista: 30, pctEstudio: 70, notas: "" }
    ],
    bazares: [],
    cotizaciones: [],
    graficas: [],
    recommendedChartStyles: {}
  };
}

let AppState = defaultState();
let uiFilters = { playeraTag: "all", stickerSize: "all" };
let activeBazarId = "";
let assignmentModalContext = null;

/* ---------------------------------------------------------------
   2. PERSISTENCIA
--------------------------------------------------------------- */
function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      AppState = Object.assign(defaultState(), parsed);
      // merge nested settings in case new fields were added later
      AppState.settings = Object.assign(defaultState().settings, parsed.settings || {});
    }
  } catch (e) {
    console.error("Error cargando estado:", e);
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
    Object.keys(SECTION_LABELS).forEach(section => {
      localStorage.setItem(`${STORAGE_KEY}_section_${section}`, JSON.stringify(getSectionData(section)));
    });
  } catch (e) {
    console.error("Error guardando estado:", e);
    showToast("No se pudo guardar (almacenamiento lleno).", "error");
  }
}

/* ---------------------------------------------------------------
   3. HELPERS GENERALES
--------------------------------------------------------------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function fmt(n) {
  const val = Number(n) || 0;
  return "$" + val.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function num(id) { const el = document.getElementById(id); return el ? (parseFloat(el.value) || 0) : 0; }
function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function checked(id) { const el = document.getElementById(id); return el ? el.checked : false; }
function setChecked(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }

function showToast(message, type = "success") {
  const box = document.getElementById("toast");
  const item = document.createElement("div");
  item.className = "toast-item " + type;
  item.textContent = message;
  box.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-modal]")) closeModal(e.target.getAttribute("data-modal"));
  if (e.target.classList.contains("modal-overlay")) e.target.classList.remove("open");
});

/* ---------------------------------------------------------------
   4. CÁLCULO DE COSTOS DTF
   costo_cm2 = precio_metro_dtf / (100 * ancho_rollo_cm)
   costo_estampado = ancho * largo * costo_cm2 * num_estampados
--------------------------------------------------------------- */
function costoPorCm2() {
  const s = AppState.settings;
  if (!s.dtfAnchoRolloCm) return 0;
  return s.dtfPrecioMetro / (100 * s.dtfAnchoRolloCm);
}
function costoEstampado(anchoCm, largoCm, numEstampados) {
  return (anchoCm || 0) * (largoCm || 0) * costoPorCm2() * (numEstampados || 1);
}
function costoTotalPlayera(playera) {
  return (playera.costoPlayera || 0) + costoEstampado(playera.anchoCm || 0, playera.largoCm || 0, playera.numEstampados || 1);
}

/* ---------------------------------------------------------------
   5. NAVEGACIÓN
--------------------------------------------------------------- */
const PAGE_TITLES = {
  cotizador: "Cotizador rápido",
  cotizaciones: "Cotizaciones guardadas",
  playeras: "Inventario de playeras",
  stickers: "Estampados y stickers",
  etiquetas: "Etiquetas y colores",
  artistas: "Artistas y comisiones",
  bazares: "Mis Bazares",
  "bazar-detalle": "Detalle de bazar",
  estadisticas: "Estadísticas",
  ajustes: "Ajustes de costos"
};
function switchPage(page) {
  document.querySelectorAll(".page-section").forEach(s => s.classList.remove("active"));
  document.getElementById("page-" + page).classList.add("active");
  const navHighlight = page === "bazar-detalle" ? "bazares" : page;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === navHighlight));
  document.getElementById("page-title").textContent = PAGE_TITLES[page] || "LUCXSTUDIO";
  document.getElementById("header-cta").style.display = page === "cotizador" ? "none" : "inline-block";
  if (page === "bazares") renderBazares();
  if (page === "estadisticas") renderEstadisticas();
  closeSidebarMobile();
}
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => switchPage(btn.dataset.page));
});
document.getElementById("header-cta").addEventListener("click", () => switchPage("cotizador"));

/* ---------------------------------------------------------------
   5b. SELECTOR GLOBAL DE "BAZAR ACTIVO" (barra del header)
--------------------------------------------------------------- */
function renderHeaderBazarSelect() {
  const sel = document.getElementById("header-bazar-activo");
  sel.innerHTML = `<option value="">Sin bazar activo</option>` +
    AppState.bazares.map(b => `<option value="${b.id}">${escapeHtml(b.nombre)}</option>`).join("");
  sel.value = activeBazarId || "";
}
function onHeaderBazarChange() {
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
   6. MODO OSCURO / CLARO
--------------------------------------------------------------- */
document.getElementById("dark-mode-btn").addEventListener("click", () => {
  document.body.classList.toggle("light");
  localStorage.setItem("LUCXSTUDIO_THEME", document.body.classList.contains("light") ? "light" : "dark");
});
function applySavedTheme() {
  if (localStorage.getItem("LUCXSTUDIO_THEME") === "light") document.body.classList.add("light");
}

/* ---------------------------------------------------------------
   7. RESPALDO JSON
--------------------------------------------------------------- */
function exportarJSON() {
  const blob = new Blob([JSON.stringify(AppState, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lucxstudio_respaldo_" + new Date().toISOString().slice(0, 10) + ".json";
  a.click();
  showToast("Respaldo descargado.");
}
const SECTION_LABELS = {
  cotizaciones: "Cotizaciones",
  inventario: "Inventario",
  catalogo: "Catalogo",
  bazares: "Bazares",
  reportes: "Reportes",
  ajustes: "Ajustes"
};
function getSectionData(section) {
  const sections = {
    cotizaciones: { cotizaciones: AppState.cotizaciones },
    inventario: { playeras: AppState.playeras, stickers: AppState.stickers },
    catalogo: { colores: AppState.colores, etiquetas: AppState.etiquetas, tallaEtiquetas: AppState.tallaEtiquetas, artistas: AppState.artistas },
    bazares: { bazares: AppState.bazares },
    reportes: { graficas: AppState.graficas },
    ajustes: { settings: AppState.settings }
  };
  return sections[section] || {};
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
      if (parsed.tipo === "respaldo-seccion" && parsed.datos) {
        Object.assign(AppState, parsed.datos);
        if (parsed.seccion === "ajustes") {
          AppState.settings = Object.assign(defaultState().settings, parsed.datos.settings || {});
        }
        showToast(`Sección ${SECTION_LABELS[parsed.seccion] || parsed.seccion} importada correctamente.`);
      } else {
        AppState = Object.assign(defaultState(), parsed);
        AppState.settings = Object.assign(defaultState().settings, parsed.settings || {});
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
function confirmResetAll() {
  if (confirm("¿Seguro que quieres borrar TODOS los datos? Esta acción no se puede deshacer. Te recomendamos descargar un respaldo antes.")) {
    AppState = defaultState();
    saveState();
    renderAll();
    showToast("Datos reiniciados.");
  }
}

/* =================================================================
   8. COLORES
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
   9. ETIQUETAS DE FILTRADO
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
   10. ETIQUETAS DE TALLA (stock físico)
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
   11. ARTISTAS
================================================================= */
const ARTIST_PRESETS = {
  ninguno:      { pctArtista: 0,  pctEstudio: 100 },
  venta:        { pctArtista: 30, pctEstudio: 70 },
  diseno:       { pctArtista: 35, pctEstudio: 65 },
  disenoventa:  { pctArtista: 40, pctEstudio: 60 }
};
const ARTIST_MODE_LABEL = {
  ninguno: "Sin comisión", venta: "Solo venta", diseno: "Diseño propio",
  disenoventa: "Diseño propio + venta", personalizado: "Personalizado"
};
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
   12. AJUSTES DE COSTOS (DTF)
================================================================= */
function renderAjustes() {
  setVal("set-dtf-precio", AppState.settings.dtfPrecioMetro);
  setVal("set-dtf-ancho", AppState.settings.dtfAnchoRolloCm);
  setVal("set-moneda", AppState.settings.moneda);
  updateCostPreview();
}
function updateCostPreview() {
  const precio = parseFloat(document.getElementById("set-dtf-precio").value) || 0;
  const ancho = parseFloat(document.getElementById("set-dtf-ancho").value) || 1;
  const cm2 = precio / (100 * ancho);
  document.getElementById("preview-costo-cm2").textContent = "$" + cm2.toFixed(4);
  document.getElementById("preview-costo-ejemplo").textContent = fmt(cm2 * 30 * 40);
}
document.getElementById("set-dtf-precio").addEventListener("input", updateCostPreview);
document.getElementById("set-dtf-ancho").addEventListener("input", updateCostPreview);
function saveSettings() {
  AppState.settings.dtfPrecioMetro = parseFloat(num("set-dtf-precio")) || 0;
  AppState.settings.dtfAnchoRolloCm = parseFloat(num("set-dtf-ancho")) || 1;
  AppState.settings.moneda = val("set-moneda") || "MXN";
  saveState();
  showToast("Ajustes guardados. Los costos se recalculan automáticamente.");
  renderPlayeras(); renderQuoteItems();
}

/* =================================================================
   12b. BAZARES / LUGARES DE VENTA
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
function bazarNombre(bazarId) {
  const b = AppState.bazares.find(x => x.id === bazarId);
  return b ? b.nombre : "Sin bazar asignado";
}
function bazarIdsDe(registro) {
  return registro.bazarIds || (registro.bazarId ? [registro.bazarId] : []);
}
function bazarTiene(registro, bazarId) {
  return bazarIdsDe(registro).includes(bazarId);
}
function nombresBazares(registro) {
  return bazarIdsDe(registro).map(bazarId => bazarNombre(bazarId)).filter(Boolean).join(", ");
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
function getBazarVentasYGanancia(bazarId) {
  const cotsAsignadas = AppState.cotizaciones.filter(c => bazarTiene(c, bazarId));
  const cots = cotsAsignadas.filter(c => !c.ventaNula);
  const perdidaCotsNulas = cotsAsignadas.filter(c => c.ventaNula).reduce((s, c) => s + (c.totalCosto || 0), 0);
  const totalVendidoCots = cots.reduce((s, c) => s + c.totalVenta, 0);
  const gananciaVentasCots = cots.reduce((s, c) => s + c.ganancia, 0);

  const playerasAsignadas = AppState.playeras.filter(p => bazarTiene(p, bazarId) && (p.stock || 0) > 0);
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

  return {
    totalVendido: totalVendidoCots + totalVendidoPlayeras,
    gananciaVentas: gananciaVentasCots + gananciaVentasPlayeras - perdidaCotsNulas - perdidaPlayerasNulas,
    cotsCount: cotsAsignadas.length + playerasAsignadas.length
  };
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
   13. INVENTARIO DE PLAYERAS
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

function openModalPlayera(id) {
  setVal("p-id", id || "");
  document.getElementById("modal-playera-title").textContent = id ? "Editar playera" : "Nueva playera";
  refreshAllSelects();
  if (id) {
    const p = AppState.playeras.find(x => x.id === id);
    setVal("p-nombre", p.nombre); setVal("p-tipo", p.tipo); setVal("p-talla", p.talla);
    setVal("p-color", p.colorId); setVal("p-stock", p.stock);
    setVal("p-costo-playera", p.costoPlayera); setVal("p-num-estampados", p.numEstampados);
    setVal("p-ancho", p.anchoCm); setVal("p-largo", p.largoCm);
    setChecked("p-tiene-etiqueta", p.tieneEtiquetaTalla);
    setVal("p-precio-venta", p.precioVenta); setVal("p-precio-mayoreo", p.precioMayoreo || ""); setVal("p-prioridad", p.prioridad); setVal("p-estado", p.estado);
    setVal("p-notas", p.notas || "");
    document.querySelectorAll(".p-tag-cb").forEach(cb => cb.checked = (p.tags || []).includes(cb.value));
  } else {
    ["p-nombre","p-notas"].forEach(f => setVal(f, ""));
    setVal("p-tipo", "Playera"); setVal("p-talla", ""); setVal("p-stock", 1);
    setVal("p-costo-playera", 47.5); setVal("p-num-estampados", 1);
    setVal("p-ancho", ""); setVal("p-largo", ""); setChecked("p-tiene-etiqueta", true);
    setVal("p-precio-venta", ""); setVal("p-precio-mayoreo", ""); setVal("p-prioridad", "Media"); setVal("p-estado", "En stock");
  }
  updatePlayeraPreview();
  openModal("modal-playera");
}
function updatePlayeraPreview() {
  const cEst = costoEstampado(num("p-ancho"), num("p-largo"), num("p-num-estampados"));
  const cTotal = num("p-costo-playera") + cEst;
  const ganancia = num("p-precio-venta") - cTotal;
  document.getElementById("p-cost-preview").innerHTML =
    `Costo del estampado: <b>${fmt(cEst)}</b> — Costo total: <b>${fmt(cTotal)}</b> — Ganancia estimada: <b>${fmt(ganancia)}</b>`;
}
function savePlayera() {
  const nombre = val("p-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al diseño.", "error");
  const id = val("p-id");
  const existing = id ? AppState.playeras.find(x => x.id === id) : null;
  const tags = Array.from(document.querySelectorAll(".p-tag-cb:checked")).map(cb => cb.value);
  const data = {
    nombre, tipo: val("p-tipo"), talla: val("p-talla").trim(), colorId: val("p-color"),
    stock: parseInt(num("p-stock")) || 0,
    costoPlayera: parseFloat(num("p-costo-playera")) || 0,
    numEstampados: parseInt(num("p-num-estampados")) || 1,
    anchoCm: parseFloat(num("p-ancho")) || 0, largoCm: parseFloat(num("p-largo")) || 0,
    tieneEtiquetaTalla: checked("p-tiene-etiqueta"),
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
function colorNombre(colorId) {
  const c = AppState.colores.find(x => x.id === colorId);
  return c ? c.nombre : "—";
}
function colorHex(colorId) {
  const c = AppState.colores.find(x => x.id === colorId);
  return c ? c.hex : "#8b8b93";
}
function estadoBadgeClass(estado) {
  if (estado === "En stock") return "badge-stock";
  if (estado === "En proceso") return "badge-proceso";
  return "badge-agotado";
}
function prioridadBadgeClass(p) {
  if (p === "Alta") return "badge-alta";
  if (p === "Media") return "badge-media";
  return "badge-baja";
}
function bazarEstadoBadgeClass(estado) {
  if (estado === "Vendida") return "badge-agotado";
  return "badge-stock";
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
    const cEst = costoEstampado(p.anchoCm, p.largoCm, p.numEstampados);
    const cTotal = p.costoPlayera + cEst;
    const ganancia = p.precioVenta - cTotal;
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
      <div class="card-row"><span>Costo playera</span><span>${fmt(p.costoPlayera)}</span></div>
      <div class="card-row"><span>Costo estampado (${p.anchoCm}×${p.largoCm}cm ×${p.numEstampados})</span><span>${fmt(cEst)}</span></div>
      <div class="card-row"><span>Costo total</span><span>${fmt(cTotal)}</span></div>
      <div class="card-row"><span>Precio de venta</span><span>${fmt(p.precioVenta)}</span></div>
      ${p.precioMayoreo ? `<div class="card-row"><span>Precio mayoreo</span><span>${fmt(p.precioMayoreo)}</span></div>` : ""}
      <div class="card-row"><span>Ganancia</span><span style="color:${ganancia >= 0 ? "var(--color-success)" : "var(--color-danger)"}">${fmt(ganancia)}</span></div>
      <div class="card-tags">
        <span class="card-badge ${estadoBadgeClass(p.estado)}">${p.estado}</span>
        <span class="card-badge ${prioridadBadgeClass(p.prioridad)}">${p.prioridad}</span>
        ${bazarEstado ? `<span class="card-badge ${bazarEstadoBadgeClass(bazarEstado)}">${bazarEstado === "Vendida" ? "✅ Vendida" : bazarEstado === "Venta nula" ? "🎁 Venta nula" : "🟢 En bazar"}</span>` : ""}
        ${bazarIdsDe(p).length ? `<span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(p))}</span>` : ""}
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
   14. INVENTARIO DE STICKERS
================================================================= */
function openModalSticker(id) {
  setVal("s-id", id || "");
  document.getElementById("modal-sticker-title").textContent = id ? "Editar estampado" : "Nuevo estampado";
  if (id) {
    const s = AppState.stickers.find(x => x.id === id);
    setVal("s-nombre", s.nombre); setVal("s-tamano", s.tamano); setVal("s-costo", s.costo);
    setVal("s-stock", s.stock); setVal("s-prioridad", s.prioridad); setVal("s-estado", s.estado);
    setVal("s-notas", s.notas || "");
  } else {
    setVal("s-nombre", ""); setVal("s-tamano", "Chico"); setVal("s-costo", 10);
    setVal("s-stock", 1); setVal("s-prioridad", "Media"); setVal("s-estado", "En stock"); setVal("s-notas", "");
  }
  openModal("modal-sticker");
}
function saveSticker() {
  const nombre = val("s-nombre").trim();
  if (!nombre) return showToast("Ponle un nombre al estampado.", "error");
  const id = val("s-id");
  const data = {
    nombre, tamano: val("s-tamano"), costo: parseFloat(num("s-costo")) || 0,
    stock: parseInt(num("s-stock")) || 0, prioridad: val("s-prioridad"), estado: val("s-estado"),
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
  grid.innerHTML = list.map(s => `
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
      </div>
      ${s.notas ? `<div class="card-meta">${escapeHtml(s.notas)}</div>` : ""}
      <div class="card-actions">
        <button onclick="openModalSticker('${s.id}')">✏️ Editar</button>
        <button class="danger" onclick="deleteSticker('${s.id}')">🗑️ Eliminar</button>
      </div>
    </div>`).join("");
}

/* =================================================================
   15. COTIZADOR RÁPIDO
================================================================= */
let quoteItems = [];

function blankQuoteItem() {
  return { rowId: uid(), playeraId: "", nombre: "", talla: "", colorId: "", cantidad: 1,
    anchoCm: 0, largoCm: 0, numEstampados: 1, costoPlayera: 0, precioVenta: 0, costoEstampadoManual: null };
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
      item.nombre = p.nombre; item.talla = p.talla; item.colorId = p.colorId;
      item.anchoCm = p.anchoCm; item.largoCm = p.largoCm; item.numEstampados = p.numEstampados;
      item.costoPlayera = p.costoPlayera;
      item.precioVenta = esMayoreo ? (p.precioMayoreo || p.precioVenta || item.precioVenta) : (p.precioVenta || item.precioVenta);
      item.costoEstampadoManual = null;
    }
  }
  renderQuoteItems();
}
// Campos que solo se recalculan cuando el usuario da clic fuera del campo (evento "change"),
// así se pueden escribir decimales sin que la tabla se refresque en cada tecla.
function updateQuoteItemField(rowId, field, value) {
  const item = quoteItems.find(i => i.rowId === rowId);
  if (!item) return;
  const numericFields = ["cantidad","anchoCm","largoCm","numEstampados","costoPlayera","precioVenta","costoEstampadoManual"];
  item[field] = numericFields.includes(field) ? (parseFloat(value) || 0) : value;
  // si cambian las medidas o el número de estampados, se vuelve a calcular el costo automáticamente
  if (["anchoCm","largoCm","numEstampados"].includes(field)) item.costoEstampadoManual = null;
  renderQuoteItems();
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
// Devuelve el costo de estampado a usar: si hay más de un estampado y el usuario lo editó
// manualmente, se respeta ese valor; si no, se calcula con la fórmula de área × costo DTF.
function getCostoEstampadoEfectivo(item) {
  if (item.numEstampados > 1 && item.costoEstampadoManual !== null && item.costoEstampadoManual !== undefined) {
    return item.costoEstampadoManual;
  }
  return costoEstampado(item.anchoCm, item.largoCm, item.numEstampados);
}
function renderQuoteItems() {
  const body = document.getElementById("quote-items-body");
  document.getElementById("quote-empty-hint").style.display = quoteItems.length ? "none" : "block";
  const addSpace = document.getElementById("quote-add-space");
  if (addSpace) addSpace.style.display = quoteItems.length ? "none" : "flex";
  const playeraOptions = AppState.playeras.map(p => `<option value="${p.id}">${escapeHtml(p.nombre)}</option>`).join("");

  body.innerHTML = quoteItems.map(item => {
    const cEst = getCostoEstampadoEfectivo(item);
    const cTotalUnit = item.costoPlayera + cEst;
    const gananciaUnit = item.precioVenta - cTotalUnit;
    const cEstCellHtml = item.numEstampados > 1
      ? `<input type="number" min="0" step="0.01" value="${cEst}" title="Costo del estampado (editable, hay más de un estampado)"
           onchange="updateQuoteItemField('${item.rowId}','costoEstampadoManual',this.value)" style="width:85px;">`
      : `<span class="readonly-cell">${fmt(cEst)}</span>`;
    return `
    <tr>
      <td>
        <select onchange="onQuoteItemProductChange('${item.rowId}', this.value)">
          <option value="">— Manual / personalizado —</option>
          ${playeraOptions}
        </select>
        ${!item.playeraId ? `<input type="text" placeholder="Nombre" value="${escapeHtml(item.nombre)}" style="margin-top:4px;" onchange="updateQuoteItemField('${item.rowId}','nombre',this.value)">` : `<div class="card-meta" style="margin-top:4px;">${escapeHtml(item.nombre)}</div>`}
      </td>
      <td><input type="text" value="${escapeHtml(item.talla)}" onchange="updateQuoteItemField('${item.rowId}','talla',this.value)"></td>
      <td>
        <select onchange="updateQuoteItemField('${item.rowId}','colorId',this.value)">
          <option value="">—</option>
          ${AppState.colores.map(c => `<option value="${c.id}" ${item.colorId===c.id?"selected":""}>${escapeHtml(c.nombre)}</option>`).join("")}
        </select>
      </td>
      <td><input type="number" min="1" step="1" value="${item.cantidad}" onchange="updateQuoteItemField('${item.rowId}','cantidad',this.value)" style="width:60px;"></td>
      <td><input type="number" min="0" step="0.01" value="${item.anchoCm}" onchange="updateQuoteItemField('${item.rowId}','anchoCm',this.value)" style="width:70px;"></td>
      <td><input type="number" min="0" step="0.01" value="${item.largoCm}" onchange="updateQuoteItemField('${item.rowId}','largoCm',this.value)" style="width:70px;"></td>
      <td><input type="number" min="1" step="1" value="${item.numEstampados}" onchange="updateQuoteItemField('${item.rowId}','numEstampados',this.value)" style="width:60px;"></td>
      <td><input type="number" min="0" step="0.01" value="${item.costoPlayera}" onchange="updateQuoteItemField('${item.rowId}','costoPlayera',this.value)" style="width:80px;"></td>
      <td>${cEstCellHtml}</td>
      <td><input type="number" min="0" step="0.01" value="${item.precioVenta}" onchange="updateQuoteItemField('${item.rowId}','precioVenta',this.value)" style="width:85px;"></td>
      <td class="readonly-cell" style="color:${gananciaUnit>=0?'var(--color-success)':'var(--color-danger)'}">${fmt(gananciaUnit * item.cantidad)}</td>
      <td><button class="remove-row" onclick="removeQuoteItem('${item.rowId}')" title="Quitar">✕</button></td>
    </tr>`;
  }).join("");

  updateQuoteSummary();
}
function computeQuoteTotals() {
  let totalVenta = 0, totalCosto = 0;
  quoteItems.forEach(item => {
    const cEst = getCostoEstampadoEfectivo(item);
    const cTotalUnit = item.costoPlayera + cEst;
    totalVenta += item.precioVenta * item.cantidad;
    totalCosto += cTotalUnit * item.cantidad;
  });
  const ganancia = totalVenta - totalCosto;
  const comision = currentQuoteCommission();
  const parteArtista = ganancia * (comision.pctArtista / 100);
  const parteEstudio = ganancia * (comision.pctEstudio / 100);
  return { totalVenta, totalCosto, ganancia, parteArtista, parteEstudio, comision };
}
function updateQuoteSummary() {
  const t = computeQuoteTotals();
  document.getElementById("sum-venta").textContent = fmt(t.totalVenta);
  document.getElementById("sum-costo").textContent = fmt(t.totalCosto);
  document.getElementById("sum-ganancia").textContent = fmt(t.ganancia);
  document.getElementById("sum-artista").textContent = fmt(t.parteArtista);
  document.getElementById("sum-estudio").textContent = fmt(t.parteEstudio);
  const artistName = t.comision.nombre || "Sin artista";
  document.getElementById("sum-artista-label").textContent = `Parte de ${artistName} (${t.comision.pctArtista}%)`;
  document.getElementById("sum-estudio-label").textContent = `Parte del estudio (${t.comision.pctEstudio}%)`;
  document.getElementById("sum-artista-card").style.display = t.comision.pctArtista > 0 ? "flex" : "none";
}
function resetQuoteForm() {
  quoteItems = [];
  setVal("quote-editing-id", ""); setVal("q-cliente", ""); setVal("q-vendedor", "");
  setVal("q-fecha", new Date().toISOString().slice(0,10));
  setVal("q-artista", ""); setVal("q-comision-pct", 0); setVal("q-notas", "");
  setVal("q-tipo-venta", "Menudeo");
  setChecked("q-venta-nula", false); setVal("q-venta-nula-motivo", "");
  document.getElementById("q-comision-custom-wrap").style.display = "none";
  document.getElementById("q-venta-nula-motivo-wrap").style.display = "none";
  document.getElementById("venta-nula-banner").style.display = "none";
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
    totalVenta: t.totalVenta, totalCosto: t.totalCosto, ganancia: t.ganancia,
    parteArtista: t.parteArtista, parteEstudio: t.parteEstudio,
    comisionNombre: t.comision.nombre, pctArtista: t.comision.pctArtista, pctEstudio: t.comision.pctEstudio,
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
    items: quoteItems, notas: val("q-notas"), ventaNula: checked("q-venta-nula"),
    tipoVenta: val("q-tipo-venta"), ...t
  });
  const container = document.getElementById("pdf-template");
  container.innerHTML = html;
  html2pdf().set({ margin: 10, filename: "cotizacion_lucxstudio.pdf", html2canvas: { scale: 2 } }).from(container).save();
}
function buildQuoteHTML(q) {
  const rows = q.items.map(item => {
    return `<tr>
      <td>${escapeHtml(item.nombre || "—")}</td><td>${escapeHtml(item.talla)}</td><td>${colorNombre(item.colorId)}</td>
      <td>${item.cantidad}</td><td>${fmt(item.precioVenta)}</td><td>${fmt(item.precioVenta*item.cantidad)}</td>
    </tr>`;
  }).join("");
  return `
  <div style="font-family:Arial,sans-serif;color:#222;padding:10px;">
    <div style="display:flex;justify-content:space-between;border-bottom:3px solid #c0242c;padding-bottom:10px;margin-bottom:16px;">
      <div><h1 style="margin:0;color:#c0242c;">LUCXSTUDIO</h1><p style="margin:2px 0;font-size:12px;">Cotización de playeras ${q.tipoVenta === "Mayoreo" ? "— Mayoreo" : ""}</p></div>
      <div style="text-align:right;font-size:12px;"><b>Folio:</b> ${q.folio}<br><b>Fecha:</b> ${q.fecha}</div>
    </div>
    <p style="font-size:13px;"><b>Cliente:</b> ${escapeHtml(q.cliente)} &nbsp;&nbsp; <b>Vendedor:</b> ${escapeHtml(q.vendedor||"—")}</p>
    ${q.ventaNula ? `<p style="font-size:12px;background:#fdeeee;border:1px dashed #c0242c;padding:6px;">🎁 Cotización marcada como venta nula (regalo / cortesía).</p>` : ""}
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
      <thead><tr style="background:#f2f2f2;"><th style="padding:6px;text-align:left;">Producto</th><th>Talla</th><th>Color</th><th>Cant.</th><th>Precio c/u</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:16px;text-align:right;font-size:13px;">
      <p>Total costo producción: ${fmt(q.totalCosto)}</p>
      <p style="font-size:16px;font-weight:bold;color:#c0242c;">Total de venta: ${fmt(q.totalVenta)}</p>
      <p>Ganancia total: ${fmt(q.ganancia)}</p>
    </div>
    ${q.notas ? `<p style="margin-top:14px;font-size:12px;"><b>Notas:</b> ${escapeHtml(q.notas)}</p>` : ""}
  </div>`;
}

/* =================================================================
   16. COTIZACIONES GUARDADAS
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
  grid.innerHTML = list.map(c => `
    <div class="card">
      <div class="card-top">
        <span class="card-title">${escapeHtml(c.folio)}</span>
        <span class="card-badge ${c.estado==='Pagado'?'badge-stock':c.estado==='Entregado'?'badge-alta':c.estado==='Confirmado'?'badge-media':'badge-baja'}">${c.estado}</span>
      </div>
      <div class="card-meta">${escapeHtml(c.cliente)} · ${c.fecha} · ${c.items.length} prenda(s)</div>
      <div class="card-tags">
        <span class="card-badge ${c.tipoVenta==='Mayoreo'?'badge-media':'badge-baja'}">${c.tipoVenta==='Mayoreo'?'📦 Mayoreo':'🛍️ Menudeo'}</span>
        ${bazarIdsDe(c).length ? `<span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(c))}</span>` : ""}
        ${c.ventaNula ? `<span class="card-badge badge-agotado">🎁 Venta nula</span>` : ""}
      </div>
      <div class="card-row"><span>Total de venta</span><span>${fmt(c.totalVenta)}</span></div>
      <div class="card-row"><span>Ganancia</span><span>${fmt(c.ganancia)}</span></div>
      <div class="card-actions">
        <button onclick="viewCotizacion('${c.id}')">👁️ Ver</button>
        <button onclick="openModalAsignarBazar('${c.id}')">🏪 Bazar</button>
        <button onclick="duplicateCotizacion('${c.id}')">📄 Duplicar</button>
      </div>
    </div>`).join("");
}
let viewingCotizacionId = null;
function viewCotizacion(id) {
  viewingCotizacionId = id;
  const c = AppState.cotizaciones.find(x => x.id === id);
  document.getElementById("ver-cot-title").textContent = c.folio + " — " + c.cliente;
  const rows = c.items.map(item => {
    return `<div class="card-row"><span>${escapeHtml(item.nombre||"—")} (${escapeHtml(item.talla)}, ${colorNombre(item.colorId)}) ×${item.cantidad}</span><span>${fmt(item.precioVenta*item.cantidad)}</span></div>`;
  }).join("");
  document.getElementById("ver-cot-body").innerHTML = `
    <div class="card-meta" style="margin-bottom:10px;">Fecha: ${c.fecha} · Vendedor: ${escapeHtml(c.vendedor||"—")} · Artista: ${escapeHtml(c.comisionNombre||"Sin artista")}</div>
    <div class="card-tags" style="margin-bottom:10px;">
      <span class="card-badge ${c.tipoVenta==='Mayoreo'?'badge-media':'badge-baja'}">${c.tipoVenta==='Mayoreo'?'📦 Mayoreo':'🛍️ Menudeo'}</span>
      <span class="card-badge badge-alta">🏪 ${escapeHtml(nombresBazares(c))}</span>
      ${c.ventaNula ? `<span class="card-badge badge-agotado">🎁 Venta nula${c.ventaNulaMotivo ? ": " + escapeHtml(c.ventaNulaMotivo) : ""}</span>` : ""}
    </div>
    ${rows}
    <div class="card-row"><span>Total costo</span><span>${fmt(c.totalCosto)}</span></div>
    <div class="card-row"><span><b>Total venta</b></span><span><b>${fmt(c.totalVenta)}</b></span></div>
    <div class="card-row"><span>Ganancia total</span><span>${fmt(c.ganancia)}</span></div>
    <div class="card-row"><span>Parte artista (${c.pctArtista}%)</span><span>${fmt(c.parteArtista)}</span></div>
    <div class="card-row"><span>Parte estudio (${c.pctEstudio}%)</span><span>${fmt(c.parteEstudio)}</span></div>
    ${c.notas ? `<p class="card-meta" style="margin-top:10px;">${escapeHtml(c.notas)}</p>` : ""}
  `;
  setVal("ver-cot-estado-select", c.estado);
  openModal("modal-ver-cotizacion");
}
function updateCotizacionEstado() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  c.estado = val("ver-cot-estado-select");
  saveState(); renderCotizacionesGuardadas();
  showToast("Estado actualizado.");
}
function editCotizacion() {
  const c = AppState.cotizaciones.find(x => x.id === viewingCotizacionId);
  quoteItems = JSON.parse(JSON.stringify(c.items));
  quoteItems.forEach(it => { if (it.costoEstampadoManual === undefined) it.costoEstampadoManual = null; });
  setVal("quote-editing-id", c.id); setVal("q-cliente", c.cliente); setVal("q-fecha", c.fecha);
  setVal("q-vendedor", c.vendedor); setVal("q-artista", c.artistaId || "");
  setVal("q-comision-pct", c.comisionPctPersonalizado || 0); setVal("q-notas", c.notas || "");
  setVal("q-tipo-venta", c.tipoVenta || "Menudeo");
  setChecked("q-venta-nula", !!c.ventaNula); setVal("q-venta-nula-motivo", c.ventaNulaMotivo || "");
  document.getElementById("q-comision-custom-wrap").style.display = c.artistaId === "__custom__" ? "block" : "none";
  document.getElementById("q-venta-nula-motivo-wrap").style.display = c.ventaNula ? "block" : "none";
  document.getElementById("venta-nula-banner").style.display = c.ventaNula ? "block" : "none";
  closeModal("modal-ver-cotizacion");
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
   17. BÚSQUEDA GLOBAL
================================================================= */
document.getElementById("global-search").addEventListener("input", () => {
  renderPlayeras(); renderStickers(); renderCotizacionesGuardadas();
});

/* =================================================================
   17c. DETALLE DE UN BAZAR (métricas y gráficas de un solo bazar)
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
    </div>`).join("") || `<p class="empty-hint">Este bazar todavía no tiene cotizaciones ligadas. Ve a “Cotizaciones guardadas” y usa “🏪 Asignar a bazar”.</p>`;
}

/* =================================================================
   17d. ASIGNAR COTIZACIÓN A UN BAZAR
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
   17e. INGRESOS EXTRA DE UN BAZAR (juegos, rifas, propinas, etc.)
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
   17b. ESTADÍSTICAS Y GRÁFICAS
================================================================= */
let chartBazares = null;
let recommendedChart = null;
let selectedRecommendedCombination = "etiqueta-ganancia";
const customChartInstances = {};
const RECOMMENDED_COMBINATIONS = [
  { id: "etiqueta-ganancia", title: "Etiqueta + ganancia", description: "Identifica las etiquetas que dejan más ganancia potencial.", fuente: "inventario", dimension: "etiqueta", metrica: "ganancia", tipo: "bar" },
  { id: "color-ventas", title: "Color + ventas", description: "Descubre qué colores tienen mayor venta potencial.", fuente: "inventario", dimension: "color", metrica: "ventas", tipo: "bar" },
  { id: "talla-stock", title: "Talla + stock", description: "Detecta las tallas que debes reponer o producir.", fuente: "inventario", dimension: "talla", metrica: "stock", tipo: "bar" },
  { id: "prioridad-ganancia", title: "Prioridad + ganancia", description: "Comprueba si tus diseños prioritarios realmente son rentables.", fuente: "inventario", dimension: "prioridad", metrica: "ganancia", tipo: "bar" },
  { id: "bazar-ganancia", title: "Bazar + ganancia", description: "Compara en qué bazares te conviene vender.", fuente: "ganancias-bazares", tipo: "bar" },
  { id: "tipo-venta", title: "Tipo de venta + ingreso", description: "Compara si te conviene vender más en menudeo o mayoreo.", fuente: "tipo-venta", tipo: "doughnut" }
];
const RECOMMENDED_PALETTES = {
  accent: ["#e3363d", "#b91f26", "#e0a23a", "#8b8b93", "#3fb87f", "#5d8bd8"],
  fresh: ["#3fb87f", "#5d8bd8", "#e0a23a", "#e3363d", "#8b8b93", "#c56bdb"],
  mono: ["#424247", "#5b5b63", "#74747d", "#8b8b93", "#a6a6ad", "#c1c1c5"]
};
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

function datosGrafica(fuente, dimension, metrica) {
  const validCots = AppState.cotizaciones.filter(c => !c.ventaNula);
  if (fuente === "ventas-bazares" || fuente === "ganancias-bazares") {
    const labels = AppState.bazares.map(b => b.nombre);
    const values = AppState.bazares.map(b => {
      const stats = getBazarVentasYGanancia(b.id);
      return fuente === "ventas-bazares" ? stats.totalVendido : stats.gananciaVentas;
    });
    return { labels, values, label: fuente === "ventas-bazares" ? "Ventas ($)" : "Ganancia ($)" };
  }
  if (fuente === "tipo-venta") {
    return {
      labels: ["Menudeo", "Mayoreo"],
      values: [
        validCots.filter(c => c.tipoVenta !== "Mayoreo").reduce((s, c) => s + c.totalVenta, 0),
        validCots.filter(c => c.tipoVenta === "Mayoreo").reduce((s, c) => s + c.totalVenta, 0)
      ],
      label: "Ventas ($)"
    };
  }
  if (fuente === "estado-playeras") {
    const cantidades = { Vendida: 0, Disponible: 0, "Venta nula": 0 };
    AppState.playeras.forEach(p => {
      const estado = p.bazarEstado || "Disponible";
      cantidades[estado] = (cantidades[estado] || 0) + (p.stock || 0);
    });
    return { labels: Object.keys(cantidades), values: Object.values(cantidades), label: "Playeras" };
  }
  if (fuente === "inventario") {
    return datosInventarioGrafica(dimension || "etiqueta", metrica || "stock");
  }
  const costoCotizaciones = AppState.cotizaciones.filter(c => c.ventaNula).reduce((s, c) => s + (c.totalCosto || 0), 0);
  const costoPlayeras = AppState.playeras.filter(p => p.bazarEstado === "Venta nula")
    .reduce((s, p) => s + costoTotalPlayera(p) * (p.stock || 0), 0);
  return { labels: ["Cotizaciones", "Playeras"], values: [costoCotizaciones, costoPlayeras], label: "Costo perdido ($)" };
}

function datosInventarioGrafica(dimension, metrica) {
  const grupos = {};
  const agregar = (grupo, playera) => {
    const cantidad = playera.stock || 0;
    const costo = costoTotalPlayera(playera) * cantidad;
    const ventas = (playera.precioVenta || 0) * cantidad;
    const ganancia = (playera.precioVenta - costoTotalPlayera(playera)) * cantidad;
    grupos[grupo] = (grupos[grupo] || 0) + ({ stock: cantidad, costo, ventas, ganancia }[metrica] || 0);
  };
  AppState.playeras.forEach(playera => {
    if (dimension === "etiqueta") {
      const etiquetas = (playera.tags || []).map(tagId => {
        const etiqueta = AppState.etiquetas.find(item => item.id === tagId);
        return etiqueta ? etiqueta.nombre : "Sin etiqueta";
      });
      (etiquetas.length ? etiquetas : ["Sin etiqueta"]).forEach(etiqueta => agregar(etiqueta, playera));
      return;
    }
    const valores = {
      color: colorNombre(playera.colorId),
      talla: playera.talla || "Sin talla",
      tipo: playera.tipo || "Sin tipo",
      prioridad: playera.prioridad || "Sin prioridad",
      estado: playera.estado || "Sin estado"
    };
    agregar(valores[dimension] || "Sin dato", playera);
  });
  const labels = Object.keys(grupos);
  const metricLabels = { stock: "Piezas", costo: "Costo ($)", ventas: "Venta potencial ($)", ganancia: "Ganancia potencial ($)" };
  return { labels, values: labels.map(label => grupos[label]), label: metricLabels[metrica] || "Inventario" };
}

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
   18. UTIL
================================================================= */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* =================================================================
   19. INICIALIZACIÓN
================================================================= */
function renderAll() {
  refreshAllSelects();
  renderColores();
  renderEtiquetas();
  renderTallaEtiquetas();
  renderArtistas();
  renderBazares();
  renderAjustes();
  renderPlayeras();
  renderStickers();
  renderCotizacionesGuardadas();
  resetQuoteForm();
}
applySavedTheme();
loadState();
renderAll();