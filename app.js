/* ============================================================
   LUCXSTUDIO — app.js
   Punto de entrada, inicialización y coordinación
   ============================================================ */
import { loadState } from "./storage.js";
import { applySavedTheme, renderAll } from "./ui.js";
import "./nav.js";   // Rediseño Sprint 1: menú por secciones, pestañas y pop-ups
import "./steps.js"; // Rediseño Sprint 3: cotizador por pasos
import "./inicio.js"; // Rediseño Sprint 4: panel de inicio
import "./extras.js"; // Rediseño Sprint 6: venta rápida, modo bazar, buscador Ctrl+K y color de acento

applySavedTheme();
loadState();
renderAll();
