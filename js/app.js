/* ============================================================
   LUCXSTUDIO — app.js
   Punto de entrada, inicialización y coordinación
   ============================================================ */
import { loadState } from "./storage.js";
import { applySavedTheme, renderAll } from "./ui.js";
import "./icons.js";
import "./nav.js";   // Rediseño Sprint 1: menú por secciones, pestañas y pop-ups
import "./steps.js"; // Rediseño Sprint 3: cotizador por pasos
import "./inicio.js"; // Rediseño Sprint 4: panel de inicio
import "./respaldo.js"; // Respaldo entre dispositivos y descarga de caja
import "./pdf.js";    // Generador del PDF de la cotización
import "./extras.js"; // Rediseño Sprint 6: venta rápida, modo bazar, buscador Ctrl+K y color de acento
import "./sheets.js"; // Backend: sincronización con Google Sheets
import { iniciarGuiaTallas } from "./guia-tallas.js"; // Guía de medidas de playeras y PDF para clientes

applySavedTheme();
loadState();
renderAll();
iniciarGuiaTallas();
if (window.lucide) window.lucide.createIcons();

// --- PESTAÑAS DE AJUSTES ---
window.switchAjustesTab = function (tabId, btnElement) {
  document.querySelectorAll("#page-ajustes .ajustes-tab-content").forEach(tab => { tab.style.display = "none"; });
  document.querySelectorAll("#ajustes-tabs .settings-nav-tab").forEach(btn => {
    btn.classList.remove("active");
    btn.setAttribute("aria-selected", "false");
  });
  const destino = document.getElementById(tabId);
  if (destino) destino.style.display = "block";
  if (btnElement) {
    btnElement.classList.add("active");
    btnElement.setAttribute("aria-selected", "true");
  }
  if (window.lucide) window.lucide.createIcons();
};
