/* ============================================================
   LUCXSTUDIO — nav.js  (Rediseño · Sprint 1)
   - Menú lateral de 6 secciones + pestañas por sección
   - Pulido de modales (ESC, bloqueo de scroll, enfoque)
   - Pop-up reutilizable de "detalle rápido": openQuickDetail()
   - Pop-up de confirmación bonito: confirmPopup()
   No modifica ui.js: se engancha al DOM y a switchPage().
   ============================================================ */

/* ---------------------------------------------------------------
   MAPA DEL MENÚ
--------------------------------------------------------------- */
const SECCIONES = [
  { id: "ventas",     icon: "🧮", label: "Ventas",     paginas: ["cotizador", "cotizaciones", "clientes"] },
  { id: "produccion", icon: "🚦", label: "Producción", paginas: ["produccion", "artes"] },
  { id: "inventario", icon: "👕", label: "Inventario", paginas: ["playeras", "stickers", "etiquetas", "mermas"] },
  { id: "negocio",    icon: "🏪", label: "Negocio",    paginas: ["bazares", "consignaciones", "caja", "gastos", "compras", "artistas", "proveedores"] },
  { id: "reportes",   icon: "📊", label: "Reportes",   paginas: ["estadisticas", "interes"] },
  { id: "ajustes",    icon: "⚙️", label: "Ajustes",    paginas: ["ajustes"] }
];
const TAB_LABEL = {
  cotizador: "🧮 Cotizador", cotizaciones: "📁 Guardadas", clientes: "👥 Clientes",
  produccion: "🚦 Kanban", artes: "🎨 Artes",
  playeras: "👕 Playeras", stickers: "✂️ Stickers", etiquetas: "🏷️ Etiquetas", mermas: "📉 Mermas",
  bazares: "🏪 Bazares", consignaciones: "🤝 Consignaciones", caja: "💰 Caja", gastos: "💸 Gastos",
  compras: "🎯 Compras", artistas: "🎨 Artistas", proveedores: "🚚 Proveedores",
  estadisticas: "📊 Estadísticas", interes: "❓ Interés",
  ajustes: "⚙️ Costos"
};
const SECCION_DE = {};
SECCIONES.forEach(s => s.paginas.forEach(p => { SECCION_DE[p] = s; }));
SECCION_DE["bazar-detalle"] = SECCION_DE["bazares"];

const ultimaPagina = {};      // última pestaña visitada por sección
let seccionPintada = "";      // sección cuyas pestañas están dibujadas

/* ---------------------------------------------------------------
   HELPERS
--------------------------------------------------------------- */
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function paginaActual() {
  const s = document.querySelector(".page-section.active");
  return s ? s.id.replace("page-", "") : "cotizador";
}
function irA(pagina) {
  if (typeof window.switchPage === "function") window.switchPage(pagina);
}

/* ---------------------------------------------------------------
   CSS DEL REDISEÑO (se carga sin tocar index.html)
--------------------------------------------------------------- */
function cargarCss() {
  if (document.getElementById("redesign-css")) return;
  const link = document.createElement("link");
  link.id = "redesign-css";
  link.rel = "stylesheet";
  link.href = "redesign.css";
  document.head.appendChild(link);
}

/* ---------------------------------------------------------------
   MENÚ LATERAL (6 secciones)
--------------------------------------------------------------- */
function construirSidebar() {
  const nav = document.querySelector(".sidebar-nav");
  if (!nav) return;
  nav.innerHTML = "";
  SECCIONES.forEach(sec => {
    const b = el("button", "nav-item");
    b.type = "button";
    b.dataset.section = sec.id;
    b.appendChild(el("span", "nav-ico", sec.icon));
    b.appendChild(el("span", "nav-text", sec.label));
    b.addEventListener("click", () => irA(ultimaPagina[sec.id] || sec.paginas[0]));
    nav.appendChild(b);
  });
}

/* ---------------------------------------------------------------
   PESTAÑAS DE LA SECCIÓN ACTUAL
--------------------------------------------------------------- */
function asegurarSubnav() {
  let bar = document.getElementById("subnav");
  if (!bar) {
    bar = el("div", "subnav");
    bar.id = "subnav";
    bar.setAttribute("role", "tablist");
    const cont = document.getElementById("page-content");
    if (cont) cont.insertBefore(bar, cont.firstChild);
  }
  return bar;
}
function pintarPestanas(sec) {
  const bar = asegurarSubnav();
  bar.innerHTML = "";
  bar.style.display = sec.paginas.length > 1 ? "flex" : "none";
  sec.paginas.forEach(p => {
    const t = el("button", "subnav-tab", TAB_LABEL[p] || p);
    t.type = "button";
    t.dataset.page = p;
    t.setAttribute("role", "tab");
    t.addEventListener("click", () => irA(p));
    bar.appendChild(t);
  });
  seccionPintada = sec.id;
}
function sincronizar() {
  const pagina = paginaActual();
  const sec = SECCION_DE[pagina];
  if (!sec) return;
  const tab = pagina === "bazar-detalle" ? "bazares" : pagina;
  ultimaPagina[sec.id] = tab;
  document.querySelectorAll(".sidebar-nav .nav-item").forEach(b => {
    b.classList.toggle("active", b.dataset.section === sec.id);
  });
  if (seccionPintada !== sec.id) pintarPestanas(sec);
  document.querySelectorAll("#subnav .subnav-tab").forEach(t => {
    const activa = t.dataset.page === tab;
    t.classList.toggle("active", activa);
    t.setAttribute("aria-selected", activa ? "true" : "false");
    if (activa && t.scrollIntoView) t.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}
function observarPaginas() {
  const mo = new MutationObserver(sincronizar);
  document.querySelectorAll(".page-section").forEach(s =>
    mo.observe(s, { attributes: true, attributeFilter: ["class"] }));
}

/* ---------------------------------------------------------------
   PULIDO DE MODALES
--------------------------------------------------------------- */
const overlays = () => Array.from(document.querySelectorAll(".modal-overlay"));
function actualizarBloqueoScroll() {
  document.body.classList.toggle("modal-open", overlays().some(o => o.classList.contains("open")));
}
function enfocarPrimerCampo(overlay) {
  if (window.innerWidth <= 900) return; // en celular no abrimos el teclado solos
  setTimeout(() => {
    const campo = overlay.querySelector(
      ".modal-body input:not([type=hidden]):not([type=color]):not([type=checkbox]):not([readonly]):not([disabled]), .modal-body textarea"
    );
    if (campo) campo.focus();
  }, 60);
}
const moModales = new MutationObserver(muts => {
  actualizarBloqueoScroll();
  muts.forEach(m => {
    const o = m.target;
    if (o.classList.contains("open") && !(m.oldValue || "").split(" ").includes("open")) enfocarPrimerCampo(o);
  });
});
function observarOverlay(o) {
  moModales.observe(o, { attributes: true, attributeFilter: ["class"], attributeOldValue: true });
}
function iniciarModales() {
  overlays().forEach(observarOverlay);
  // ESC cierra la ventana que esté arriba de todas
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const abiertos = overlays().filter(o => o.classList.contains("open"));
    if (!abiertos.length) return;
    abiertos[abiertos.length - 1].classList.remove("open");
    e.preventDefault();
  });
}

/* ---------------------------------------------------------------
   POP-UP: DETALLE RÁPIDO
   openQuickDetail({
     icon: "👕", title: "Miku", subtitle: "Playera · MD · Negro",
     sections: [{ title: "Costos", rows: [["Costo total", "$120.00"], ["Ganancia", "$80.00", "good"]] }],
     actions: [{ label: "Editar", variant: "primary", onClick: () => {} }]
   })
   Tonos de fila: "good" (verde), "bad" (rojo), "accent" (rojo marca).
   Todo el texto se inserta con textContent: es seguro con datos del usuario.
--------------------------------------------------------------- */
function crearModalDetalle() {
  if (document.getElementById("modal-quick-detail")) return;
  const o = document.createElement("div");
  o.className = "modal-overlay";
  o.id = "modal-quick-detail";
  o.innerHTML = `
    <div class="modal-box modal-box-sm qd-box">
      <div class="modal-header">
        <h2 class="modal-title" id="qd-title"></h2>
        <button class="modal-close" data-modal="modal-quick-detail" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body" id="qd-body"></div>
      <div class="modal-footer" id="qd-footer"></div>
    </div>`;
  document.body.appendChild(o);
  observarOverlay(o);
}
export function openQuickDetail(cfg) {
  crearModalDetalle();
  const c = cfg || {};
  document.getElementById("qd-title").textContent = c.title || "Detalle";
  const body = document.getElementById("qd-body");
  body.innerHTML = "";
  if (c.icon || c.subtitle) {
    const hero = el("div", "qd-hero");
    if (c.icon) hero.appendChild(el("span", "qd-icon", c.icon));
    if (c.subtitle) hero.appendChild(el("span", "qd-subtitle", c.subtitle));
    body.appendChild(hero);
  }
  (c.sections || []).forEach(sec => {
    const box = el("div", "qd-section");
    if (sec.title) box.appendChild(el("div", "qd-section-title", sec.title));
    (sec.rows || []).forEach(r => {
      const row = el("div", "qd-row" + (r[2] ? " tone-" + r[2] : ""));
      row.appendChild(el("span", "qd-label", r[0]));
      row.appendChild(el("span", "qd-value", r[1]));
      box.appendChild(row);
    });
    if (sec.text) box.appendChild(el("p", "qd-text", sec.text));
    body.appendChild(box);
  });
  const footer = document.getElementById("qd-footer");
  footer.innerHTML = "";
  const acciones = (c.actions && c.actions.length) ? c.actions : [{ label: "Cerrar", variant: "secondary" }];
  acciones.forEach(a => {
    const b = el("button", a.variant === "danger" ? "btn-danger" : a.variant === "primary" ? "btn-primary" : "btn-secondary", a.label);
    b.type = "button";
    b.addEventListener("click", () => {
      if (!a.keepOpen) document.getElementById("modal-quick-detail").classList.remove("open");
      if (typeof a.onClick === "function") a.onClick();
    });
    footer.appendChild(b);
  });
  document.getElementById("modal-quick-detail").classList.add("open");
}

/* ---------------------------------------------------------------
   POP-UP: CONFIRMACIÓN (reemplaza confirm() del navegador)
   const ok = await confirmPopup({ title, message, confirmLabel, danger });
--------------------------------------------------------------- */
let confirmPendiente = null;
function resolverConfirm(valor) {
  const r = confirmPendiente;
  confirmPendiente = null;
  if (r) r(valor);
}
function crearModalConfirm() {
  if (document.getElementById("modal-confirm-popup")) return;
  const o = document.createElement("div");
  o.className = "modal-overlay confirm-overlay";
  o.id = "modal-confirm-popup";
  o.innerHTML = `
    <div class="modal-box modal-box-sm confirm-box">
      <div class="modal-header">
        <h2 class="modal-title" id="cf-title"></h2>
      </div>
      <div class="modal-body"><p class="qd-text" id="cf-message"></p></div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="cf-cancel"></button>
        <button type="button" id="cf-ok"></button>
      </div>
    </div>`;
  document.body.appendChild(o);
  observarOverlay(o);
  // Si se cierra por ESC o clic fuera, cuenta como "cancelar"
  new MutationObserver(() => {
    if (!o.classList.contains("open") && confirmPendiente) resolverConfirm(false);
  }).observe(o, { attributes: true, attributeFilter: ["class"] });
  document.getElementById("cf-cancel").addEventListener("click", () => o.classList.remove("open"));
  document.getElementById("cf-ok").addEventListener("click", () => {
    resolverConfirm(true);
    o.classList.remove("open");
  });
}
export function confirmPopup(opts) {
  crearModalConfirm();
  const o = opts || {};
  return new Promise(resolve => {
    if (confirmPendiente) resolverConfirm(false);
    confirmPendiente = resolve;
    document.getElementById("cf-title").textContent = o.title || "¿Seguro?";
    document.getElementById("cf-message").textContent = o.message || "";
    document.getElementById("cf-cancel").textContent = o.cancelLabel || "Cancelar";
    const ok = document.getElementById("cf-ok");
    ok.textContent = o.confirmLabel || "Confirmar";
    ok.className = o.danger ? "btn-danger" : "btn-primary";
    document.getElementById("modal-confirm-popup").classList.add("open");
  });
}

/* ---------------------------------------------------------------
   TIP DE BIENVENIDA (una sola vez)
--------------------------------------------------------------- */
const TIP_KEY = "LUCXSTUDIO_TIP_MENU_V1";
function mostrarTipMenu() {
  try { if (localStorage.getItem(TIP_KEY)) return; } catch (e) { return; }
  setTimeout(() => {
    openQuickDetail({
      icon: "✨",
      title: "Menú renovado",
      subtitle: "Ahora todo está en 6 secciones",
      sections: [{
        title: "Cómo moverte",
        rows: [
          ["Menú lateral", "Elige la sección"],
          ["Pestañas de arriba", "Pantallas de esa sección"],
          ["Tecla ESC", "Cierra cualquier ventana"]
        ]
      }],
      actions: [{ label: "Entendido", variant: "primary" }]
    });
    try { localStorage.setItem(TIP_KEY, "1"); } catch (e) { /* sin almacenamiento */ }
  }, 700);
}

/* ---------------------------------------------------------------
   INICIO
--------------------------------------------------------------- */
function iniciar() {
  cargarCss();
  construirSidebar();
  asegurarSubnav();
  observarPaginas();
  iniciarModales();
  crearModalDetalle();
  crearModalConfirm();
  sincronizar();
  mostrarTipMenu();
}
iniciar();

Object.assign(window, { openQuickDetail, confirmPopup });
