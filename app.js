/* ============================================================
   LUCXSTUDIO — app.js
   Punto de entrada, inicialización y coordinación
   ============================================================ */
import { loadState } from "./storage.js";
import { applySavedTheme, renderAll } from "./ui.js";
import "./nav.js";   // Rediseño Sprint 1: menú por secciones, pestañas y pop-ups
import "./steps.js"; // Rediseño Sprint 3: cotizador por pasos

applySavedTheme();
loadState();
renderAll();
