/* ============================================================
   LUCXSTUDIO — storage.js
   Funciones CRUD para interactuar con localStorage
   ============================================================ */
import { STORAGE_KEY, SECTION_LABELS, defaultState } from "./config.js";

/* ---------------------------------------------------------------
   ESTADO EN MEMORIA (binding vivo — los módulos que hagan
   `import { AppState } from "./storage.js"` ven siempre el valor
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
}

// ui.js registra aquí su showToast() al iniciar, para poder avisar
// al usuario sin que storage.js tenga que importar ui.js (dependencia circular).
let toastHandler = null;
export function setToastHandler(fn) { toastHandler = fn; }

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(AppState));
    Object.keys(SECTION_LABELS).forEach(section => {
      localStorage.setItem(`${STORAGE_KEY}_section_${section}`, JSON.stringify(getSectionData(section)));
    });
  } catch (e) {
    console.error("Error guardando estado:", e);
    if (toastHandler) toastHandler("No se pudo guardar (almacenamiento lleno).", "error");
  }
}

export function getSectionData(section) {
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

/* ---------------------------------------------------------------
   IMPORTAR / REINICIAR
--------------------------------------------------------------- */
export function importData(parsed) {
  if (parsed.tipo === "respaldo-seccion" && parsed.datos) {
    Object.assign(AppState, parsed.datos);
    if (parsed.seccion === "ajustes") {
      AppState.settings = Object.assign(defaultState().settings, parsed.datos.settings || {});
    }
    return { seccion: parsed.seccion };
  }
  AppState = Object.assign(defaultState(), parsed);
  AppState.settings = Object.assign(defaultState().settings, parsed.settings || {});
  return { seccion: null };
}

export function resetState() {
  AppState = defaultState();
}
