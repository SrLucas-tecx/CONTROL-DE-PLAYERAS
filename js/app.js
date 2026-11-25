/* ============================================================
   LUCXSTUDIO — app.js
   Punto de entrada, inicialización y coordinación
   ============================================================ */
import { loadState } from "./storage.js?v=202611252220";
import { applySavedTheme, renderAll, showToast } from "./ui.js?v=202611252220";
import { APP_VERSION } from "./config.js?v=202611252220";
import "./icons.js?v=202611252220";
import "./nav.js?v=202611252220";   // Rediseño Sprint 1: menú por secciones, pestañas y pop-ups
import "./steps.js?v=202611252220"; // Rediseño Sprint 3: cotizador por pasos
import "./inicio.js?v=202611252220"; // Rediseño Sprint 4: panel de inicio
import "./respaldo.js?v=202611252220"; // Respaldo entre dispositivos y descarga de caja
import "./pdf.js?v=202611252220";    // Generador del PDF de la cotización
import "./extras.js?v=202611252220"; // Rediseño Sprint 6: venta rápida, modo bazar, buscador Ctrl+K y color de acento
import "./sheets.js?v=202611252220"; // Backend: sincronización con Google Sheets
import { iniciarGuiaTallas } from "./guia-tallas.js?v=202611252220"; // Guía de medidas de playeras y PDF para clientes

applySavedTheme();
loadState();
renderAll();
iniciarGuiaTallas();
// Aviso si el navegador mezcla archivos viejos y nuevos (pasa cuando el caché guarda una versión anterior).
const versionHtml = document.querySelector('meta[name="app-version"]')?.content;
if (versionHtml !== APP_VERSION) {
  showToast("Hay archivos desactualizados en el navegador. Presiona Ctrl + Shift + R para recargar.", "error", { duracion: 12000 });
}
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
