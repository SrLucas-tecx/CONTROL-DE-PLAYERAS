/* ============================================================
   LUCXSTUDIO — steps.js  (Rediseño · Sprint 3)
   Cotizador por pasos: Cliente → Prendas → Extras y pago → Resumen.
   Solo controla qué panel se ve; la lógica de costos sigue en ui.js.
   ui.js le avisa los totales con window.actualizarPasosCotizador().
   ============================================================ */
import { showToast } from "./ui.js";

const TOTAL_PASOS = 4;
let paso = 1;
const info = { prendas: 0, stickers: 0, extras: 0, total: "$0.00", ganancia: "$0.00" };

const $ = id => document.getElementById(id);

function pintar() {
  document.querySelectorAll("#page-cotizador .quote-step").forEach(panel => {
    panel.classList.toggle("active", Number(panel.dataset.step) === paso);
  });
  document.querySelectorAll("#quote-stepper .qstep").forEach(btn => {
    const n = Number(btn.dataset.step);
    btn.classList.toggle("active", n === paso);
    btn.classList.toggle("done", n < paso);
    if (n === paso) btn.setAttribute("aria-current", "step"); else btn.removeAttribute("aria-current");
  });

  // Contadores en las pestañas de paso
  const piezas = info.prendas + info.stickers;
  const b2 = $("qstep-badge-2");
  if (b2) { b2.textContent = piezas ? String(piezas) : ""; b2.style.display = piezas ? "inline-flex" : "none"; }
  const b3 = $("qstep-badge-3");
  if (b3) { b3.textContent = info.extras ? String(info.extras) : ""; b3.style.display = info.extras ? "inline-flex" : "none"; }

  // Barra inferior
  const prev = $("qb-prev"), next = $("qb-next");
  if (prev) prev.style.visibility = paso > 1 ? "visible" : "hidden";
  if (next) next.style.display = paso < TOTAL_PASOS ? "inline-block" : "none";
  if ($("qb-total")) $("qb-total").textContent = info.total;
  if ($("qb-ganancia")) $("qb-ganancia").textContent = info.ganancia;
}

export function irAPaso(n, opciones) {
  const destino = Math.min(TOTAL_PASOS, Math.max(1, Number(n) || 1));
  paso = destino;
  pintar();
  if (!opciones || opciones.scroll !== false) window.scrollTo({ top: 0, behavior: "smooth" });
}

function siguiente() {
  if (paso === 2 && info.prendas + info.stickers === 0) {
    showToast("Agrega al menos una prenda o sticker para continuar.", "error");
    return;
  }
  irAPaso(paso + 1);
}

export function actualizarPasos(parcial) {
  Object.assign(info, parcial || {});
  pintar();
}

function iniciar() {
  document.querySelectorAll("#quote-stepper .qstep").forEach(btn => {
    btn.addEventListener("click", () => irAPaso(btn.dataset.step));
  });
  const prev = $("qb-prev"), next = $("qb-next");
  if (prev) prev.addEventListener("click", () => irAPaso(paso - 1));
  if (next) next.addEventListener("click", siguiente);
  pintar();
}
iniciar();

Object.assign(window, { irAPasoCotizador: irAPaso, actualizarPasosCotizador: actualizarPasos });
