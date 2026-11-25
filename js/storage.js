/* ============================================================
   LUCXSTUDIO — storage.js
   Funciones CRUD para interactuar con localStorage
   ============================================================ */
import { STORAGE_KEY, SECTION_LABELS, defaultState } from "./config.js?v=202611252220";

/* ---------------------------------------------------------------
   ESTADO EN MEMORIA (binding vivo — los módulos que hagan
   `import { AppState } from "./storage.js?v=202611252220"` ven siempre el valor
   más reciente, incluso después de un reassign hecho aquí adentro)
--------------------------------------------------------------- */
export let AppState = defaultState();

/* ---------------------------------------------------------------
   HELPERS DE ID
--------------------------------------------------------------- */
export function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------------------------------------------------------------
   PERSISTENCIA
--------------------------------------------------------------- */
export function loadState() {
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
  // Las copias por sección duplicaban todo el almacenamiento; ya se generan al exportar.
  try { Object.keys(SECTION_LABELS).forEach(s => localStorage.removeItem(`${STORAGE_KEY}_section_${s}`)); } catch (e) { /* sin almacenamiento */ }
  migrarDatosAntiguos();
}

// Convierte los registros guardados con el modelo viejo (anchoCm/largoCm/numEstampados
// planos) al modelo nuevo de estampados[] con áreas individuales, sin tocar los que ya
// están migrados. Corre siempre al cargar, así que es segura de ejecutar de más.
function migrarEstampadosDe(registro) {
  if (!registro || registro.estampados) return;
  const n = registro.numEstampados || 1;
  registro.estampados = Array.from({ length: Math.max(1, n) }, () => ({
    id: uid(), anchoCm: registro.anchoCm || 0, largoCm: registro.largoCm || 0
  }));
  delete registro.anchoCm;
  delete registro.largoCm;
  delete registro.numEstampados;
}
function migrarDatosAntiguos() {
  if (!Array.isArray(AppState.juegos)) AppState.juegos = [];
  if (!Array.isArray(AppState.maletaPlantilla)) AppState.maletaPlantilla = defaultState().maletaPlantilla;
  // Los juegos antes vivían dentro de cada bazar: ahora son una lista propia con bazarId.
  (AppState.bazares || []).forEach(b => {
    if (Array.isArray(b.juegos) && b.juegos.length) {
      b.juegos.forEach(j => AppState.juegos.push({
        id: j.id || uid(), nombre: j.nombre || "Juego", tipo: "Otro", precio: Number(j.precio) || 0, bazarId: b.id,
        jugadas: Number(j.jugadas) || 0, porDia: {}, costoPremios: Number(j.costoPremios) || 0, socioId: "", pctSocio: 0
      }));
    }
    delete b.juegos;
  });
  (AppState.playeras || []).forEach(migrarEstampadosDe);
  (AppState.cotizaciones || []).forEach(c => {
    (c.items || []).forEach(migrarEstampadosDe);
    if (!c.estadoProduccion) {
      c.estadoProduccion = (c.estado === "Entregado" || c.estado === "Pagado") ? "Entregado" : "Por hacer";
    }
    if (!c.tagsOperativos) c.tagsOperativos = [];
  });
}

// ui.js registra aquí su showToast() al iniciar, para poder avisar
// al usuario sin que storage.js tenga que importar ui.js (dependencia circular).
let toastHandler = null;
export function setToastHandler(fn) { toastHandler = fn; }

export function saveState(opciones) {
  try {
    AppState.ultimaModificacion = new Date().toISOString();   // sirve para comparar respaldos entre dispositivos
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
    // Aviso para sheets.js (antes nadie lo emitía y los cambios no se subían solos)
    document.dispatchEvent(new CustomEvent("lucx:guardado", { detail: { sinRefresco: !!(opciones && opciones.sinRefresco) } }));
  } catch (e) {
    console.error("Error guardando estado:", e);
    if (toastHandler) toastHandler("No se pudo guardar (almacenamiento lleno).", "error");
  }
}

export function getSectionData(section) {
  const sections = {
    cotizaciones: { cotizaciones: AppState.cotizaciones },
    inventario: { playeras: AppState.playeras, bloquesInventario: AppState.bloquesInventario, stickers: AppState.stickers, ventasStickers: AppState.ventasStickers },
    catalogo: { colores: AppState.colores, etiquetas: AppState.etiquetas, tiposPrenda: AppState.tiposPrenda, tallaEtiquetas: AppState.tallaEtiquetas, artistas: AppState.artistas, proveedores: AppState.proveedores, etiquetasOperativas: AppState.etiquetasOperativas },
    clientes: { clientes: AppState.clientes, clienteEtiquetas: AppState.clienteEtiquetas },
    finanzas: { gastos: AppState.gastos, comprasPendientes: AppState.comprasPendientes, mermas: AppState.mermas },
    bazares: { bazares: AppState.bazares, juegos: AppState.juegos, maletaPlantilla: AppState.maletaPlantilla, consignaciones: AppState.consignaciones, socios: AppState.socios, cajaGeneral: AppState.cajaGeneral, turnosCaja: AppState.turnosCaja },
    reportes: { graficas: AppState.graficas, consultas: AppState.consultas, consultaEtiquetas: AppState.consultaEtiquetas, recommendedChartStyles: AppState.recommendedChartStyles },
    ajustes: { settings: AppState.settings }
  };
  return sections[section] || {};
}

/* ---------------------------------------------------------------
   IMPORTAR / REINICIAR
--------------------------------------------------------------- */
export function importData(parsed) {
  // Respaldo completo con datos de contexto (dispositivo, fecha...): se usa solo su contenido.
  if (parsed && parsed.tipo === "respaldo-completo" && parsed.datos) parsed = parsed.datos;
  if (parsed.tipo === "respaldo-seccion" && parsed.datos) {
    Object.assign(AppState, parsed.datos);
    if (parsed.seccion === "ajustes") {
      AppState.settings = Object.assign(defaultState().settings, parsed.datos.settings || {});
    }
    migrarDatosAntiguos();
    return { seccion: parsed.seccion };
  }
  AppState = Object.assign(defaultState(), parsed);
  AppState.settings = Object.assign(defaultState().settings, parsed.settings || {});
  migrarDatosAntiguos();
  return { seccion: null };
}

export function resetState() {
  AppState = defaultState();
}
