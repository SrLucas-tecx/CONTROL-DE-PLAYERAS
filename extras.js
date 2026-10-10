/* ============================================================
   LUCXSTUDIO — extras.js  (Rediseño · Sprint 6)
   1) ⚡ Venta rápida (botón flotante + pop-up)
   2) 🛍️ Modo bazar (pantalla completa con botones grandes)
   3) 🔎 Buscador global (Ctrl + K)
   4) 🎨 Color de acento (Ajustes → Apariencia)
   Las ventas se registran como "playera vendida" dentro de un bazar
   (o en la caja general), igual que las que marcas a mano, y se
   pueden deshacer desde el aviso.
   ============================================================ */
import { AppState, uid, saveState } from "./storage.js";
import { fmt, colorNombre, colorHex, comisionTerminalMonto, bazarIdsDe } from "./calculator.js";

const $ = id => document.getElementById(id);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}
function opt(value, label) { const o = document.createElement("option"); o.value = value; o.textContent = label; return o; }
const hoyLocal = () => new Date().toLocaleDateString("sv-SE");
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const bazarActivoHeader = () => { const s = $("header-bazar-activo"); return s ? s.value : ""; };
function llenarSelectBazar(sel, valor) {
  sel.innerHTML = "";
  sel.appendChild(opt("", "Sin bazar (caja general)"));
  AppState.bazares.forEach(b => sel.appendChild(opt(b.id, b.nombre)));
  sel.value = AppState.bazares.some(b => b.id === valor) ? valor : "";
}
// Piezas que sí se pueden vender ahora: con stock, no vendidas ni regaladas, y que no estén con un consignatario.
const playerasEnStock = () => AppState.playeras
  .filter(p => (p.stock || 0) > 0
    && (p.bazarEstado || "Disponible") === "Disponible"
    && !(p.consignacionId && p.consignacionEstado !== "Devuelta"))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));

/* ---------------------------------------------------------------
   REGISTRO DE VENTAS (compartido por venta rápida y modo bazar)
   Cada venta crea una copia "Vendida" de la playera con la cantidad
   vendida y descuenta esa cantidad del stock original.
--------------------------------------------------------------- */
function registrarVentas(lineas, metodo, bazarId, aviso) {
  const copiaEstado = window.tomarCopiaEstado();
  let registradas = 0;
  lineas.forEach(l => {
    const p = AppState.playeras.find(x => x.id === l.playeraId);
    const cantidad = Math.floor(l.cantidad);
    if (!p || cantidad < 1 || cantidad > (p.stock || 0)) return;
    const precio = Math.max(0, Number(l.precio) || 0);
    const total = precio * cantidad;
    const venta = JSON.parse(JSON.stringify(p));
    Object.assign(venta, {
      id: uid(), stock: cantidad, precioVenta: precio,
      bazarId: bazarId || "", bazarIds: bazarId ? [bazarId] : [], bazarEstado: "Vendida",
      metodoPago: metodo, montoTarjeta: metodo === "Tarjeta" ? total : 0,
      comisionTerminal: comisionTerminalMonto(metodo === "Tarjeta" ? total : 0, AppState.settings.comisionTerminalPct),
      consignacionId: "", consignacionEstado: "", clienteId: "",
      // La copia no vuelve a descontar etiquetas de talla ni queda ligada al gasto original.
      etiquetaTallaConsumo: null, tieneEtiquetaTalla: false, gastoVinculadoId: "",
      ventaRapida: true, fechaVenta: hoyLocal()
    });
    p.stock = Math.max(0, (p.stock || 0) - cantidad);
    if (p.stock === 0) p.estado = "Agotado";
    AppState.playeras.push(venta);
    registradas++;
  });
  if (!registradas) return false;
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer(aviso, copiaEstado);
  return true;
}

/* ===============================================================
   1) VENTA RÁPIDA
=============================================================== */
const vr = { sel: "", metodo: "Efectivo" };
function crearModalVR() {
  if ($("modal-venta-rapida")) return;
  const o = el("div", "modal-overlay");
  o.id = "modal-venta-rapida";
  o.innerHTML = `
    <div class="modal-box modal-box-sm vr-box">
      <div class="modal-header">
        <h2 class="modal-title">⚡ Venta rápida</h2>
        <button class="modal-close" data-modal="modal-venta-rapida" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <input type="search" id="vr-buscar" class="form-input" placeholder="Buscar playera..." autocomplete="off">
        <div id="vr-lista" class="vr-lista"></div>
        <div id="vr-detalle" class="vr-detalle" style="display:none;">
          <div class="vr-elegida" id="vr-elegida"></div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cantidad</label>
              <div class="stepper">
                <button type="button" id="vr-menos" aria-label="Menos">−</button>
                <input type="number" id="vr-cant" min="1" step="1" value="1">
                <button type="button" id="vr-mas" aria-label="Más">+</button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Precio c/u ($)</label>
              <input type="number" id="vr-precio" class="form-input" min="0" step="0.01">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Método de pago</label>
            <div class="pay-toggle" id="vr-pago">
              <button type="button" data-metodo="Efectivo" class="active">💵 Efectivo</button>
              <button type="button" data-metodo="Tarjeta">💳 Tarjeta</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Bazar</label>
            <select id="vr-bazar" class="form-select"></select>
          </div>
          <p class="cost-preview" id="vr-total">—</p>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-modal="modal-venta-rapida">Cancelar</button>
        <button type="button" class="btn-primary" id="vr-ok" disabled>Registrar venta</button>
      </div>
    </div>`;
  document.body.appendChild(o);

  $("vr-buscar").addEventListener("input", renderListaVR);
  $("vr-lista").addEventListener("click", e => {
    const fila = e.target.closest("[data-id]");
    if (fila) elegirVR(fila.dataset.id);
  });
  $("vr-menos").addEventListener("click", () => cambiarCantVR(-1));
  $("vr-mas").addEventListener("click", () => cambiarCantVR(1));
  $("vr-cant").addEventListener("input", actualizarTotalVR);
  $("vr-precio").addEventListener("input", actualizarTotalVR);
  $("vr-pago").addEventListener("click", e => {
    const b = e.target.closest("[data-metodo]");
    if (!b) return;
    vr.metodo = b.dataset.metodo;
    $("vr-pago").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
    actualizarTotalVR();
  });
  $("vr-ok").addEventListener("click", confirmarVR);
}
function renderListaVR() {
  const lista = $("vr-lista");
  if (!lista) return;
  const t = norm($("vr-buscar").value).trim();
  const items = playerasEnStock().filter(p => !t || norm(`${p.nombre} ${p.talla} ${p.tipo} ${colorNombre(p.colorId)}`).includes(t)).slice(0, 40);
  lista.innerHTML = "";
  if (!items.length) {
    lista.appendChild(el("p", "empty-hint", AppState.playeras.length ? "Ninguna playera con stock coincide." : "Aún no tienes playeras en el inventario."));
    return;
  }
  items.forEach(p => {
    const fila = el("button", "vr-fila" + (p.id === vr.sel ? " active" : ""));
    fila.type = "button";
    fila.dataset.id = p.id;
    const izq = el("span", "vr-fila-main");
    izq.appendChild(el("span", "vr-fila-name", p.nombre));
    izq.appendChild(el("span", "vr-fila-meta", `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)}`));
    const der = el("span", "vr-fila-num");
    der.appendChild(el("b", "", fmt(p.precioVenta)));
    der.appendChild(el("span", "vr-fila-meta", `${p.stock} pza`));
    fila.appendChild(izq); fila.appendChild(der);
    lista.appendChild(fila);
  });
}
function elegirVR(id) {
  const p = AppState.playeras.find(x => x.id === id);
  if (!p) return;
  vr.sel = id;
  renderListaVR();
  $("vr-detalle").style.display = "block";
  $("vr-elegida").textContent = `${p.nombre} · Talla ${p.talla || "—"} · ${colorNombre(p.colorId)} (quedan ${p.stock})`;
  $("vr-cant").value = 1;
  $("vr-cant").max = p.stock;
  $("vr-precio").value = p.precioVenta || 0;
  llenarSelectBazar($("vr-bazar"), (p.bazarIds && p.bazarIds[0]) || p.bazarId || bazarActivoHeader());
  actualizarTotalVR();
}
function cambiarCantVR(delta) {
  const p = AppState.playeras.find(x => x.id === vr.sel);
  if (!p) return;
  const nueva = Math.min(p.stock || 1, Math.max(1, (parseInt($("vr-cant").value) || 1) + delta));
  $("vr-cant").value = nueva;
  actualizarTotalVR();
}
function actualizarTotalVR() {
  const p = AppState.playeras.find(x => x.id === vr.sel);
  const ok = $("vr-ok");
  if (!p) { ok.disabled = true; return; }
  const cant = parseInt($("vr-cant").value) || 0;
  const precio = parseFloat($("vr-precio").value) || 0;
  const valida = cant >= 1 && cant <= (p.stock || 0);
  const total = cant * precio;
  let txt = valida ? `Total: ${fmt(total)}` : `La cantidad debe estar entre 1 y ${p.stock}.`;
  if (valida && vr.metodo === "Tarjeta") txt += ` — comisión de terminal: ${fmt(comisionTerminalMonto(total, AppState.settings.comisionTerminalPct))}`;
  $("vr-total").textContent = txt;
  ok.disabled = !valida;
}
function confirmarVR() {
  const p = AppState.playeras.find(x => x.id === vr.sel);
  if (!p) return;
  const cant = parseInt($("vr-cant").value) || 0;
  const precio = parseFloat($("vr-precio").value) || 0;
  const exito = registrarVentas([{ playeraId: p.id, cantidad: cant, precio }], vr.metodo, $("vr-bazar").value,
    `Venta registrada: ${cant} × ${p.nombre} — ${fmt(cant * precio)}`);
  if (exito) $("modal-venta-rapida").classList.remove("open");
}
function openVentaRapida() {
  crearModalVR();
  vr.sel = ""; vr.metodo = "Efectivo";
  $("vr-buscar").value = "";
  $("vr-detalle").style.display = "none";
  $("vr-ok").disabled = true;
  $("vr-pago").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.metodo === "Efectivo"));
  renderListaVR();
  $("modal-venta-rapida").classList.add("open");
}

/* ===============================================================
   2) MODO BAZAR (pantalla completa, botones grandes)
=============================================================== */
const mb = { ticket: {}, metodo: "Efectivo" };
function crearModoBazar() {
  if ($("modo-bazar")) return;
  const o = el("div", "mb-overlay");
  o.id = "modo-bazar";
  o.innerHTML = `
    <div class="mb-top">
      <b class="mb-titulo">🛍️ Modo bazar</b>
      <select id="mb-bazar" class="form-select" aria-label="Bazar"></select>
      <div class="mb-hoy"><span>Vendido hoy</span><b id="mb-hoy">$0</b></div>
      <button type="button" class="btn-secondary" id="mb-salir">Salir</button>
    </div>
    <div class="mb-search"><input type="search" id="mb-buscar" class="form-input" placeholder="Buscar diseño, talla o color..." autocomplete="off"></div>
    <div class="mb-grid" id="mb-grid"></div>
    <div class="mb-ticket">
      <div class="mb-ticket-items" id="mb-ticket-items"></div>
      <div class="mb-ticket-pay">
        <div class="pay-toggle" id="mb-pago">
          <button type="button" data-metodo="Efectivo" class="active">💵 Efectivo</button>
          <button type="button" data-metodo="Tarjeta">💳 Tarjeta</button>
        </div>
        <div class="mb-total"><span>Total</span><b id="mb-total">$0.00</b></div>
        <button type="button" class="btn-secondary" id="mb-limpiar">Limpiar</button>
        <button type="button" class="btn-primary mb-cobrar" id="mb-cobrar" disabled>Cobrar</button>
      </div>
    </div>`;
  document.body.appendChild(o);

  $("mb-salir").addEventListener("click", cerrarModoBazar);
  $("mb-buscar").addEventListener("input", renderGridMB);
  $("mb-bazar").addEventListener("change", renderHoyMB);
  $("mb-grid").addEventListener("click", e => {
    const t = e.target.closest("[data-id]");
    if (t) agregarMB(t.dataset.id, 1);
  });
  $("mb-ticket-items").addEventListener("click", e => {
    const b = e.target.closest("[data-id]");
    if (b) agregarMB(b.dataset.id, Number(b.dataset.delta));
  });
  $("mb-pago").addEventListener("click", e => {
    const b = e.target.closest("[data-metodo]");
    if (!b) return;
    mb.metodo = b.dataset.metodo;
    $("mb-pago").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
  });
  $("mb-limpiar").addEventListener("click", () => { mb.ticket = {}; renderMB(); });
  $("mb-cobrar").addEventListener("click", cobrarMB);
}
const modoBazarAbierto = () => { const o = $("modo-bazar"); return !!o && o.classList.contains("open"); };
function agregarMB(id, delta) {
  const p = AppState.playeras.find(x => x.id === id);
  if (!p) return;
  const actual = mb.ticket[id] || 0;
  const nueva = Math.min(p.stock || 0, Math.max(0, actual + delta));
  if (nueva === 0) delete mb.ticket[id]; else mb.ticket[id] = nueva;
  renderMB();
}
function renderGridMB() {
  const grid = $("mb-grid");
  const t = norm($("mb-buscar").value).trim();
  const items = playerasEnStock().filter(p => !t || norm(`${p.nombre} ${p.talla} ${p.tipo} ${colorNombre(p.colorId)}`).includes(t));
  grid.innerHTML = "";
  if (!items.length) {
    grid.appendChild(el("p", "empty-hint", AppState.playeras.length ? "Ninguna playera con stock coincide." : "Aún no tienes playeras en el inventario."));
    return;
  }
  items.forEach(p => {
    const enTicket = mb.ticket[p.id] || 0;
    const tile = el("button", "mb-tile" + (enTicket ? " active" : ""));
    tile.type = "button";
    tile.dataset.id = p.id;
    const punto = el("span", "mb-dot");
    punto.style.background = colorHex(p.colorId);
    tile.appendChild(punto);
    tile.appendChild(el("span", "mb-tile-name", p.nombre));
    tile.appendChild(el("span", "mb-tile-meta", `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)}`));
    tile.appendChild(el("span", "mb-tile-price", fmt(p.precioVenta)));
    tile.appendChild(el("span", "mb-tile-stock", `quedan ${p.stock}`));
    if (enTicket) tile.appendChild(el("span", "mb-tile-badge", "×" + enTicket));
    grid.appendChild(tile);
  });
}
function lineasMB() {
  return Object.keys(mb.ticket).map(id => {
    const p = AppState.playeras.find(x => x.id === id);
    return p ? { p, cantidad: mb.ticket[id] } : null;
  }).filter(Boolean);
}
function renderTicketMB() {
  const cont = $("mb-ticket-items");
  const lineas = lineasMB();
  cont.innerHTML = "";
  if (!lineas.length) cont.appendChild(el("span", "mb-ticket-vacio", "Toca una playera para agregarla a la venta"));
  let total = 0;
  lineas.forEach(({ p, cantidad }) => {
    total += (p.precioVenta || 0) * cantidad;
    const chip = el("span", "mb-chip");
    const menos = el("button", "", "−"); menos.type = "button"; menos.dataset.id = p.id; menos.dataset.delta = "-1"; menos.setAttribute("aria-label", "Quitar una");
    const mas = el("button", "", "+"); mas.type = "button"; mas.dataset.id = p.id; mas.dataset.delta = "1"; mas.setAttribute("aria-label", "Agregar una");
    chip.appendChild(menos);
    chip.appendChild(el("span", "mb-chip-text", `${cantidad} × ${p.nombre} (${p.talla || "—"})`));
    chip.appendChild(mas);
    cont.appendChild(chip);
  });
  $("mb-total").textContent = fmt(total);
  $("mb-cobrar").disabled = !lineas.length;
}
function renderHoyMB() {
  const bazarId = $("mb-bazar").value;
  const hoy = hoyLocal();
  const total = AppState.playeras
    .filter(p => p.ventaRapida && p.fechaVenta === hoy && (p.bazarEstado === "Vendida"))
    .filter(p => bazarId ? bazarIdsDe(p).includes(bazarId) : bazarIdsDe(p).length === 0)
    .reduce((s, p) => s + (p.precioVenta || 0) * (p.stock || 0), 0);
  $("mb-hoy").textContent = fmt(total);
}
function renderMB() {
  if (!modoBazarAbierto()) return;
  // Si algo del ticket ya no existe o se quedó sin stock, se ajusta.
  Object.keys(mb.ticket).forEach(id => {
    const p = AppState.playeras.find(x => x.id === id);
    if (!p || (p.stock || 0) < 1) delete mb.ticket[id];
    else if (mb.ticket[id] > p.stock) mb.ticket[id] = p.stock;
  });
  renderGridMB(); renderTicketMB(); renderHoyMB();
}
function cobrarMB() {
  const lineas = lineasMB();
  if (!lineas.length) return;
  const total = lineas.reduce((s, { p, cantidad }) => s + (p.precioVenta || 0) * cantidad, 0);
  const piezas = lineas.reduce((s, { cantidad }) => s + cantidad, 0);
  const exito = registrarVentas(
    lineas.map(({ p, cantidad }) => ({ playeraId: p.id, cantidad, precio: p.precioVenta || 0 })),
    mb.metodo, $("mb-bazar").value,
    `Cobrado: ${piezas} pieza(s) — ${fmt(total)} (${mb.metodo === "Tarjeta" ? "tarjeta" : "efectivo"})`
  );
  if (exito) { mb.ticket = {}; renderMB(); }
}
function openModoBazar() {
  crearModoBazar();
  mb.ticket = {}; mb.metodo = "Efectivo";
  $("mb-pago").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.metodo === "Efectivo"));
  llenarSelectBazar($("mb-bazar"), bazarActivoHeader());
  $("mb-buscar").value = "";
  $("modo-bazar").classList.add("open");
  document.body.classList.add("modo-bazar-activo");
  renderMB();
}
function cerrarModoBazar() {
  const o = $("modo-bazar");
  if (o) o.classList.remove("open");
  document.body.classList.remove("modo-bazar-activo");
  mb.ticket = {};
}

/* ===============================================================
   3) BUSCADOR GLOBAL (Ctrl + K)
=============================================================== */
const PAGINAS = [
  ["inicio", "🏠", "Inicio"], ["cotizador", "🧮", "Cotizador"], ["cotizaciones", "📁", "Cotizaciones guardadas"],
  ["clientes", "👥", "Clientes"], ["produccion", "🚦", "Producción (Kanban)"], ["artes", "🎨", "Historial de artes"],
  ["playeras", "👕", "Playeras"], ["stickers", "✂️", "Stickers"], ["etiquetas", "🏷️", "Etiquetas y colores"], ["mermas", "📉", "Mermas"],
  ["bazares", "🏪", "Mis bazares"], ["consignaciones", "🤝", "Consignaciones"], ["caja", "💰", "Caja"], ["gastos", "💸", "Gastos generales"],
  ["compras", "🎯", "Próximas compras"], ["artistas", "🎨", "Artistas y comisiones"], ["proveedores", "🚚", "Proveedores"],
  ["estadisticas", "📊", "Estadísticas"], ["interes", "❓", "Interés por producto"], ["ajustes", "⚙️", "Ajustes de costos"]
];
const ACCIONES = [
  ["🧮", "Nueva cotización", () => window.switchPage("cotizador")],
  ["⚡", "Venta rápida", () => openVentaRapida()],
  ["🛍️", "Modo bazar", () => openModoBazar()],
  ["👕", "Nueva playera", () => window.openModalPlayera()],
  ["❓", "Registrar consulta", () => window.openModalConsulta()],
  ["💸", "Nuevo gasto", () => window.openModalGasto()],
  ["🏪", "Nuevo bazar", () => window.openModalBazar()]
];
let sp = { items: [], activo: 0 };
function crearBuscador() {
  if ($("modal-buscador")) return;
  const o = el("div", "modal-overlay buscador-overlay");
  o.id = "modal-buscador";
  o.innerHTML = `
    <div class="modal-box buscador-box" role="dialog" aria-label="Buscador">
      <div class="buscador-input-wrap">
        <span aria-hidden="true">🔎</span>
        <input type="search" id="sp-input" placeholder="Busca playeras, clientes, cotizaciones, bazares o pantallas..." autocomplete="off">
        <kbd>Esc</kbd>
      </div>
      <div class="buscador-lista" id="sp-lista"></div>
    </div>`;
  document.body.appendChild(o);
  $("sp-input").addEventListener("input", () => { sp.activo = 0; renderBuscador(); });
  $("sp-input").addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); moverBuscador(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moverBuscador(-1); }
    else if (e.key === "Enter") { e.preventDefault(); ejecutarBuscador(sp.activo); }
  });
  $("sp-lista").addEventListener("click", e => {
    const fila = e.target.closest("[data-i]");
    if (fila) ejecutarBuscador(Number(fila.dataset.i));
  });
}
function construirResultados(q) {
  const t = norm(q).trim();
  const r = [];
  const coincide = (...campos) => !t || norm(campos.join(" ")).includes(t);
  const tope = (arr) => arr.slice(0, 6);
  const grupo = (nombre, filas) => filas.forEach(f => r.push(Object.assign({ grupo: nombre }, f)));

  grupo("Acciones", tope(ACCIONES.filter(a => coincide(a[1])).map(a => ({ ico: a[0], texto: a[1], sub: "", run: a[2] }))));
  if (!t) return r;
  grupo("Playeras", tope(AppState.playeras.filter(p => coincide(p.nombre, p.talla, p.tipo, colorNombre(p.colorId))).map(p => ({
    ico: "👕", texto: p.nombre, sub: `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)} · ${p.stock || 0} pza · ${fmt(p.precioVenta)}`, run: () => window.verDetallePlayera(p.id)
  }))));
  grupo("Stickers", tope(AppState.stickers.filter(s => coincide(s.nombre, s.tamano)).map(s => ({
    ico: "✂️", texto: s.nombre, sub: `${s.tamano} · ${s.stock || 0} pza · ${fmt(s.precioVenta)}`, run: () => window.openModalSticker(s.id)
  }))));
  grupo("Cotizaciones", tope(AppState.cotizaciones.filter(c => coincide(c.folio, c.cliente)).map(c => ({
    ico: "🧾", texto: `${c.folio || ""} · ${c.cliente || "Cliente sin nombre"}`, sub: `${c.fecha || ""} · ${fmt(c.totalVenta)}`, run: () => window.viewCotizacion(c.id)
  }))));
  grupo("Clientes", tope(AppState.clientes.filter(c => coincide(c.nombre, c.telefono)).map(c => ({
    ico: "👤", texto: c.nombre, sub: c.telefono || "", run: () => window.openModalClienteDetalle(c.id)
  }))));
  grupo("Bazares", tope(AppState.bazares.filter(b => coincide(b.nombre, b.lugar)).map(b => ({
    ico: "🏪", texto: b.nombre, sub: b.lugar || "", run: () => window.goToBazarDetalle(b.id)
  }))));
  grupo("Pantallas", tope(PAGINAS.filter(p => coincide(p[2])).map(p => ({ ico: p[1], texto: p[2], sub: "", run: () => window.switchPage(p[0]) }))));
  return r;
}
function renderBuscador() {
  const lista = $("sp-lista");
  sp.items = construirResultados($("sp-input").value);
  lista.innerHTML = "";
  if (!sp.items.length) {
    lista.appendChild(el("p", "empty-hint", "Sin resultados. Prueba con otra palabra."));
    return;
  }
  let grupoActual = "";
  sp.items.forEach((it, i) => {
    if (it.grupo !== grupoActual) { grupoActual = it.grupo; lista.appendChild(el("div", "sp-grupo", grupoActual)); }
    const fila = el("button", "sp-fila" + (i === sp.activo ? " active" : ""));
    fila.type = "button";
    fila.dataset.i = String(i);
    fila.appendChild(el("span", "sp-ico", it.ico));
    const txt = el("span", "sp-txt");
    txt.appendChild(el("span", "sp-main", it.texto));
    if (it.sub) txt.appendChild(el("span", "sp-sub", it.sub));
    fila.appendChild(txt);
    lista.appendChild(fila);
  });
}
function moverBuscador(delta) {
  if (!sp.items.length) return;
  sp.activo = (sp.activo + delta + sp.items.length) % sp.items.length;
  renderBuscador();
  const activa = $("sp-lista").querySelector(".sp-fila.active");
  if (activa && activa.scrollIntoView) activa.scrollIntoView({ block: "nearest" });
}
function ejecutarBuscador(i) {
  const it = sp.items[i];
  if (!it) return;
  $("modal-buscador").classList.remove("open");
  setTimeout(() => it.run(), 0);
}
function abrirBuscador() {
  crearBuscador();
  $("sp-input").value = "";
  sp.activo = 0;
  renderBuscador();
  $("modal-buscador").classList.add("open");
  setTimeout(() => $("sp-input").focus(), 40);
}

/* ===============================================================
   4) COLOR DE ACENTO
=============================================================== */
const ACENTOS = [
  { id: "rojo", nombre: "Rojo señal", hex: "#e3363d" },
  { id: "naranja", nombre: "Naranja", hex: "#f07a2b" },
  { id: "verde", nombre: "Verde", hex: "#2fb67c" },
  { id: "azul", nombre: "Azul", hex: "#4f8df5" },
  { id: "violeta", nombre: "Violeta", hex: "#9b6bf2" },
  { id: "rosa", nombre: "Rosa", hex: "#e8508f" }
];
const ACENTO_KEY = "LUCXSTUDIO_ACENTO";
function hexARgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function oscurecer(hex, f) {
  const [r, g, b] = hexARgb(hex).map(v => Math.round(v * (1 - f)));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function aplicarAcento(id) {
  const a = ACENTOS.find(x => x.id === id) || ACENTOS[0];
  const root = document.documentElement.style;
  const [r, g, b] = hexARgb(a.hex);
  root.setProperty("--color-accent", a.hex);
  root.setProperty("--color-accent-dark", oscurecer(a.hex, 0.22));
  root.setProperty("--color-accent-soft", `rgba(${r},${g},${b},.15)`);
  return a.id;
}
function acentoGuardado() { try { return localStorage.getItem(ACENTO_KEY) || "rojo"; } catch (e) { return "rojo"; } }
function renderAcentos() {
  const cont = $("accent-swatches");
  if (!cont) return;
  const actual = acentoGuardado();
  cont.innerHTML = "";
  ACENTOS.forEach(a => {
    const b = el("button", "accent-swatch" + (a.id === actual ? " active" : ""));
    b.type = "button";
    b.setAttribute("aria-label", a.nombre);
    b.title = a.nombre;
    const punto = el("span", "accent-dot");
    punto.style.background = a.hex;
    b.appendChild(punto);
    b.appendChild(el("span", "accent-name", a.nombre));
    b.addEventListener("click", () => {
      aplicarAcento(a.id);
      try { localStorage.setItem(ACENTO_KEY, a.id); } catch (e) { /* sin almacenamiento */ }
      renderAcentos();
    });
    cont.appendChild(b);
  });
}

/* ===============================================================
   BOTÓN FLOTANTE Y ATAJOS
=============================================================== */
function crearFab() {
  if ($("fab-venta")) return;
  const b = el("button", "fab", "⚡");
  b.id = "fab-venta";
  b.type = "button";
  b.title = "Venta rápida";
  b.setAttribute("aria-label", "Venta rápida");
  b.addEventListener("click", openVentaRapida);
  document.body.appendChild(b);
}
function actualizarFab() {
  const fab = $("fab-venta");
  if (!fab) return;
  const s = document.querySelector(".page-section.active");
  const pagina = s ? s.id.replace("page-", "") : "";
  fab.style.display = pagina === "cotizador" ? "none" : "flex"; // en el cotizador estorba a la barra de totales
}
function insertarBotonesMenu() {
  const pie = document.querySelector(".sidebar-footer");
  if (!pie || $("btn-buscador")) return;
  const buscar = el("button", "btn-icon");
  buscar.id = "btn-buscador"; buscar.type = "button";
  buscar.appendChild(document.createTextNode("🔎 "));
  buscar.appendChild(el("span", "", "Buscar"));
  buscar.appendChild(el("kbd", "kbd-hint", "Ctrl K"));
  buscar.addEventListener("click", abrirBuscador);
  const bazar = el("button", "btn-icon");
  bazar.id = "btn-modo-bazar"; bazar.type = "button";
  bazar.appendChild(document.createTextNode("🛍️ "));
  bazar.appendChild(el("span", "", "Modo bazar"));
  bazar.addEventListener("click", openModoBazar);
  pie.insertBefore(bazar, pie.firstChild);
  pie.insertBefore(buscar, pie.firstChild);
}

function iniciar() {
  aplicarAcento(acentoGuardado());
  renderAcentos();
  insertarBotonesMenu();
  crearFab();
  actualizarFab();
  const mo = new MutationObserver(actualizarFab);
  document.querySelectorAll(".page-section").forEach(s => mo.observe(s, { attributes: true, attributeFilter: ["class"] }));

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const abierto = $("modal-buscador") && $("modal-buscador").classList.contains("open");
      if (abierto) $("modal-buscador").classList.remove("open"); else abrirBuscador();
      return;
    }
    if (e.key === "Escape" && modoBazarAbierto() && !document.querySelector(".modal-overlay.open")) cerrarModoBazar();
  });
  // Cuando cambian los datos (deshacer, venta registrada) se redibujan las pantallas propias
  document.addEventListener("lucx:estado-cambio", () => {
    renderMB();
    const vrAbierto = $("modal-venta-rapida") && $("modal-venta-rapida").classList.contains("open");
    if (vrAbierto) renderListaVR();
    renderAcentos();
  });
}
iniciar();

Object.assign(window, { openVentaRapida, openModoBazar, abrirBuscador });
