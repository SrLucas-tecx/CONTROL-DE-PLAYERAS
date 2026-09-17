/* ============================================================
   LUCXSTUDIO — app.js
   Punto de entrada, inicialización y coordinación
   ============================================================ */
import { loadState } from "./storage.js";
import { applySavedTheme, renderAll } from "./ui.js";

applySavedTheme();
loadState();
renderAll();
