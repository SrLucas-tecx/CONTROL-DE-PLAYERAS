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
import { fmt, colorNombre, colorHex, comisionTerminalMonto, bazarIdsDe, getBazarVentasYGanancia } from "./calculator.js";

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
/* ---------------------------------------------------------------
   PRODUCTOS VENDIBLES (playeras y stickers con una "clave" p:ID / s:ID)
--------------------------------------------------------------- */
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
// Playeras que sí se pueden vender ahora: con stock, disponibles (no vendidas ni regaladas)
// y que no estén con un consignatario.
const playerasVendibles = () => AppState.playeras
  .filter(p => (p.stock || 0) > 0 && (p.bazarEstado || "Disponible") === "Disponible"
    && !(p.consignacionId && p.consignacionEstado !== "Devuelta"))
  .sort(porNombre);
const stickersVendibles = () => AppState.stickers.filter(s => (s.stock || 0) > 0).sort(porNombre);
// Devuelve { key, tipo, obj, nombre, meta, precio, stock, hex } de una clave "p:ID" / "s:ID".
function producto(key) {
  const [t, id] = String(key).split(":");
  if (t === "p") {
    const p = AppState.playeras.find(x => x.id === id);
    return p && { key, tipo: "playera", obj: p, nombre: p.nombre, meta: `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)}`, precio: p.precioVenta || 0, stock: p.stock || 0, hex: colorHex(p.colorId) };
  }
  const s = AppState.stickers.find(x => x.id === id);
  const medida = (s && (s.anchoCm || s.largoCm)) ? ` · ${s.anchoCm || 0}×${s.largoCm || 0} cm` : "";
  return s && { key, tipo: "sticker", obj: s, nombre: s.nombre, meta: `${s.tamano}${medida}`, precio: s.precioVenta || 0, stock: s.stock || 0, hex: "" };
}
const textoBusqueda = pr => norm(`${pr.nombre} ${pr.meta} ${pr.tipo === "playera" ? pr.obj.tipo : "sticker"}`);

/* ---------------------------------------------------------------
   REGISTRO DE VENTAS (compartido por venta rápida y modo bazar)
   · Playera: se crea una copia "Vendida" con la cantidad vendida y se
     descuenta del stock original (la copia guarda origenId).
   · Sticker: se agrega un registro a ventasStickers y se descuenta stock.
   lineas = [{ key, cantidad, precio }]
--------------------------------------------------------------- */
function registrarVentas(lineas, metodo, bazarId, aviso) {
  const copiaEstado = window.tomarCopiaEstado();
  if (!AppState.ventasStickers) AppState.ventasStickers = [];
  let registradas = 0;
  lineas.forEach(l => {
    const pr = producto(l.key);
    const cantidad = Math.floor(l.cantidad);
    if (!pr || cantidad < 1 || cantidad > pr.stock) return;
    const precio = Math.max(0, Number(l.precio) || 0);
    const total = precio * cantidad;
    const montoTarjeta = metodo === "Tarjeta" ? total : 0;
    const comision = comisionTerminalMonto(montoTarjeta, AppState.settings.comisionTerminalPct);
    if (pr.tipo === "playera") {
      const p = pr.obj;
      const venta = JSON.parse(JSON.stringify(p));
      Object.assign(venta, {
        id: uid(), origenId: p.id, stock: cantidad, precioVenta: precio,
        bazarId: bazarId || "", bazarIds: bazarId ? [bazarId] : [], bazarEstado: "Vendida",
        metodoPago: metodo, montoTarjeta, comisionTerminal: comision,
        consignacionId: "", consignacionEstado: "", clienteId: "",
        // La copia no vuelve a descontar etiquetas de talla ni queda ligada al gasto original.
        etiquetaTallaConsumo: null, tieneEtiquetaTalla: false, gastoVinculadoId: "",
        ventaRapida: true, fechaVenta: hoyLocal()
      });
      p.stock = Math.max(0, (p.stock || 0) - cantidad);
      if (p.stock === 0) p.estado = "Agotado";
      AppState.playeras.push(venta);
    } else {
      const s = pr.obj;
      AppState.ventasStickers.push({
        id: uid(), stickerId: s.id, nombre: s.nombre, tamano: s.tamano, cantidad,
        precioVenta: precio, costoUnitario: s.costo || 0,
        metodoPago: metodo, montoTarjeta, comisionTerminal: comision,
        bazarId: bazarId || "", bazarIds: bazarId ? [bazarId] : [], fecha: hoyLocal()
      });
      s.stock = Math.max(0, (s.stock || 0) - cantidad);
      if (s.stock === 0) s.estado = "Agotado";
    }
    registradas++;
  });
  if (!registradas) return false;
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer(aviso, copiaEstado);
  return true;
}

/* Anula una venta suelta ya registrada: regresa las piezas al stock y la borra. */
function anularVenta(tipo, id) {
  const copiaEstado = window.tomarCopiaEstado();
  let aviso = "Venta anulada — las piezas regresaron al stock.";
  if (tipo === "playera") {
    const v = AppState.playeras.find(x => x.id === id);
    if (!v) return;
    // Ventas hechas antes de que existiera origenId: se busca la pieza igual que no sea una venta.
    const origen = AppState.playeras.find(x => x.id === v.origenId) ||
      AppState.playeras.find(x => !x.ventaRapida && x.nombre === v.nombre && x.talla === v.talla && x.colorId === v.colorId && x.tipo === v.tipo);
    if (origen) {
      origen.stock = (origen.stock || 0) + (v.stock || 0);
      if (origen.estado === "Agotado") origen.estado = "En stock";
    } else {
      aviso = "Venta anulada (la playera original ya no existe, no se regresó stock).";
    }
    AppState.playeras = AppState.playeras.filter(x => x.id !== id);
  } else {
    const v = (AppState.ventasStickers || []).find(x => x.id === id);
    if (!v) return;
    const s = AppState.stickers.find(x => x.id === v.stickerId);
    if (s) {
      s.stock = (s.stock || 0) + (v.cantidad || 0);
      if (s.estado === "Agotado") s.estado = "En stock";
    } else {
      aviso = "Venta anulada (el sticker original ya no existe, no se regresó stock).";
    }
    AppState.ventasStickers = AppState.ventasStickers.filter(x => x.id !== id);
  }
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer(aviso, copiaEstado);
}

/* ===============================================================
   1) VENTA RÁPIDA (playeras y stickers)
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
        <input type="search" id="vr-buscar" class="form-input" placeholder="Buscar playera o sticker..." autocomplete="off">
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
    const fila = e.target.closest("[data-key]");
    if (fila) elegirVR(fila.dataset.key);
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
  const todos = [...playerasVendibles().map(p => producto("p:" + p.id)), ...stickersVendibles().map(s => producto("s:" + s.id))];
  const items = todos.filter(pr => !t || textoBusqueda(pr).includes(t)).slice(0, 50);
  lista.innerHTML = "";
  if (!items.length) {
    lista.appendChild(el("p", "empty-hint", (AppState.playeras.length || AppState.stickers.length) ? "Nada con stock coincide." : "Aún no tienes productos en el inventario."));
    return;
  }
  items.forEach(pr => {
    const fila = el("button", "vr-fila" + (pr.key === vr.sel ? " active" : ""));
    fila.type = "button";
    fila.dataset.key = pr.key;
    const izq = el("span", "vr-fila-main");
    izq.appendChild(el("span", "vr-fila-name", `${pr.tipo === "sticker" ? "✂️" : "👕"} ${pr.nombre}`));
    izq.appendChild(el("span", "vr-fila-meta", pr.meta));
    const der = el("span", "vr-fila-num");
    der.appendChild(el("b", "", fmt(pr.precio)));
    der.appendChild(el("span", "vr-fila-meta", `${pr.stock} pza`));
    fila.appendChild(izq); fila.appendChild(der);
    lista.appendChild(fila);
  });
}
function elegirVR(key) {
  const pr = producto(key);
  if (!pr) return;
  vr.sel = key;
  renderListaVR();
  $("vr-detalle").style.display = "block";
  $("vr-elegida").textContent = `${pr.nombre} · ${pr.meta} (quedan ${pr.stock})`;
  $("vr-cant").value = 1;
  $("vr-cant").max = pr.stock;
  $("vr-precio").value = pr.precio;
  const p = pr.tipo === "playera" ? pr.obj : null;
  llenarSelectBazar($("vr-bazar"), (p && ((p.bazarIds && p.bazarIds[0]) || p.bazarId)) || bazarActivoHeader());
  actualizarTotalVR();
}
function cambiarCantVR(delta) {
  const pr = producto(vr.sel);
  if (!pr) return;
  $("vr-cant").value = Math.min(pr.stock || 1, Math.max(1, (parseInt($("vr-cant").value) || 1) + delta));
  actualizarTotalVR();
}
function actualizarTotalVR() {
  const pr = vr.sel ? producto(vr.sel) : null;
  const ok = $("vr-ok");
  if (!pr) { ok.disabled = true; return; }
  const cant = parseInt($("vr-cant").value) || 0;
  const precio = parseFloat($("vr-precio").value) || 0;
  const valida = cant >= 1 && cant <= pr.stock;
  const total = cant * precio;
  let txt = valida ? `Total: ${fmt(total)}` : `La cantidad debe estar entre 1 y ${pr.stock}.`;
  if (valida && vr.metodo === "Tarjeta") txt += ` — comisión de terminal: ${fmt(comisionTerminalMonto(total, AppState.settings.comisionTerminalPct))}`;
  $("vr-total").textContent = txt;
  ok.disabled = !valida;
}
function confirmarVR() {
  const pr = producto(vr.sel);
  if (!pr) return;
  const cant = parseInt($("vr-cant").value) || 0;
  const precio = parseFloat($("vr-precio").value) || 0;
  const exito = registrarVentas([{ key: pr.key, cantidad: cant, precio }], vr.metodo, $("vr-bazar").value,
    `Venta registrada: ${cant} × ${pr.nombre} — ${fmt(cant * precio)}`);
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
   Pestañas Playeras / Stickers, venta mezclada, "apartadas" y
   resumen de lo vendido hoy (ventas rápidas + cotizaciones).
=============================================================== */
const mb = { ticket: {}, metodo: "Efectivo", tab: "playeras", apartadas: false };
function crearModoBazar() {
  if ($("modo-bazar")) return;
  const o = el("div", "mb-overlay");
  o.id = "modo-bazar";
  o.innerHTML = `
    <div class="mb-top">
      <b class="mb-titulo">🛍️ Modo bazar</b>
      <select id="mb-bazar" class="form-select" aria-label="Bazar"></select>
      <button type="button" class="mb-hoy" id="mb-hoy-btn" title="Ver el detalle de lo vendido hoy"><span>Vendido hoy ›</span><b id="mb-hoy">$0</b></button>
      <button type="button" class="btn-secondary" id="mb-salir">Salir</button>
    </div>
    <div class="mb-tabs">
      <button type="button" class="mb-tab active" data-tab="playeras">👕 Playeras</button>
      <button type="button" class="mb-tab" data-tab="stickers">✂️ Stickers</button>
      <label class="mb-chk" id="mb-apartadas-wrap"><input type="checkbox" id="mb-apartadas"> Ver apartadas <span id="mb-apartadas-n"></span></label>
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
  $("mb-hoy-btn").addEventListener("click", detalleHoyMB);
  o.querySelector(".mb-tabs").addEventListener("click", e => {
    const t = e.target.closest("[data-tab]");
    if (!t) return;
    mb.tab = t.dataset.tab;
    renderMB();
  });
  $("mb-apartadas").addEventListener("change", e => { mb.apartadas = e.target.checked; renderGridMB(); });
  $("mb-grid").addEventListener("click", e => {
    const ap = e.target.closest("[data-apartada]");
    if (ap) { detalleApartada(ap.dataset.apartada); return; }
    const t = e.target.closest("[data-key]");
    if (t) agregarMB(t.dataset.key, 1);
  });
  $("mb-ticket-items").addEventListener("click", e => {
    const b = e.target.closest("[data-key]");
    if (b) agregarMB(b.dataset.key, Number(b.dataset.delta));
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
function agregarMB(key, delta) {
  const pr = producto(key);
  if (!pr) return;
  const actual = mb.ticket[key] || 0;
  const nueva = Math.min(pr.stock, Math.max(0, actual + delta));
  if (nueva === 0) delete mb.ticket[key]; else mb.ticket[key] = nueva;
  renderMB();
}

/* ---- Piezas apartadas: no se pueden vender aquí, pero se ven y se explican ---- */
function motivoApartada(p) {
  if (p.consignacionId && p.consignacionEstado !== "Devuelta") {
    const c = AppState.consignaciones.find(x => x.id === p.consignacionId);
    return {
      tipo: "consignacion",
      texto: (p.consignacionEstado === "Vendida" ? "✅ Vendida en consignación" : "🤝 En consignación") + (c ? ` · ${c.nombre}` : ""),
      explica: p.consignacionEstado === "Vendida"
        ? "Esta pieza ya la vendió el consignatario, por eso no se vende de nuevo desde aquí."
        : "Esta pieza la tiene un consignatario para venderla. Si te la devolvió, márcala como devuelta y vuelve a aparecer aquí."
    };
  }
  const estado = p.bazarEstado || "Disponible";
  if (estado === "Vendida") return { tipo: "vendida", texto: "✅ Ya vendida", explica: "Esta pieza ya está marcada como vendida en un bazar." };
  if (estado === "Venta nula") return { tipo: "nula", texto: "🎁 Regalada (venta nula)", explica: "Esta pieza se marcó como regalo o cortesía, por eso no se vende desde aquí." };
  return null;
}
const playerasApartadas = () => AppState.playeras
  .filter(p => (p.stock || 0) > 0 && !p.ventaRapida)
  .map(p => ({ p, motivo: motivoApartada(p) }))
  .filter(x => x.motivo)
  .sort((a, b) => porNombre(a.p, b.p));
function detalleApartada(id) {
  const p = AppState.playeras.find(x => x.id === id);
  const m = p && motivoApartada(p);
  if (!p || !m) return;
  const acciones = [{ label: "🔍 Ver detalle", variant: m.tipo === "consignacion" && p.consignacionEstado === "En consignación" ? "secondary" : "primary", onClick: () => window.verDetallePlayera(id) }];
  if (m.tipo === "consignacion" && p.consignacionEstado === "En consignación") {
    acciones.unshift({ label: "↩️ Marcar devuelta", variant: "primary", onClick: () => devolverConsignacion(id) });
  }
  acciones.push({ label: "Cerrar" });
  window.openQuickDetail({
    icon: "👕", title: p.nombre, subtitle: m.texto,
    sections: [
      { title: "Por qué no se vende aquí", text: m.explica },
      { rows: [["Stock", `${p.stock || 0} pza`], ["Talla y color", `${p.talla || "—"} · ${colorNombre(p.colorId)}`], ["Precio", fmt(p.precioVenta)]] }
    ],
    actions: acciones
  });
}
function devolverConsignacion(id) {
  const p = AppState.playeras.find(x => x.id === id);
  if (!p) return;
  const copia = window.tomarCopiaEstado();
  p.consignacionEstado = "Devuelta";
  saveState();
  window.refrescarVistaActual();
  window.ofrecerDeshacer(`${p.nombre}: marcada como devuelta, ya se puede vender.`, copia);
}

function renderGridMB() {
  const grid = $("mb-grid");
  const t = norm($("mb-buscar").value).trim();
  const esSticker = mb.tab === "stickers";
  const lista = esSticker ? stickersVendibles().map(s => producto("s:" + s.id)) : playerasVendibles().map(p => producto("p:" + p.id));
  const items = lista.filter(pr => !t || textoBusqueda(pr).includes(t));
  grid.innerHTML = "";
  if (!items.length) {
    grid.appendChild(el("p", "empty-hint", (esSticker ? AppState.stickers.length : AppState.playeras.length) ? "Nada con stock coincide." : (esSticker ? "Aún no tienes stickers en el inventario." : "Aún no tienes playeras en el inventario.")));
  }
  items.forEach(pr => {
    const enTicket = mb.ticket[pr.key] || 0;
    const tile = el("button", "mb-tile" + (enTicket ? " active" : ""));
    tile.type = "button";
    tile.dataset.key = pr.key;
    if (pr.tipo === "playera") {
      const punto = el("span", "mb-dot");
      punto.style.background = pr.hex;
      tile.appendChild(punto);
    } else {
      tile.appendChild(el("span", "mb-glyph", "✂️"));
    }
    tile.appendChild(el("span", "mb-tile-name", pr.nombre));
    tile.appendChild(el("span", "mb-tile-meta", pr.meta));
    tile.appendChild(el("span", "mb-tile-price", fmt(pr.precio)));
    tile.appendChild(el("span", "mb-tile-stock", `quedan ${pr.stock}`));
    if (enTicket) tile.appendChild(el("span", "mb-tile-badge", "×" + enTicket));
    grid.appendChild(tile);
  });

  // Apartadas (solo en la pestaña de playeras)
  const apartadas = esSticker ? [] : playerasApartadas().filter(x => !t || norm(`${x.p.nombre} ${x.p.talla} ${colorNombre(x.p.colorId)}`).includes(t));
  const wrap = $("mb-apartadas-wrap");
  wrap.style.display = esSticker || !playerasApartadas().length ? "none" : "inline-flex";
  $("mb-apartadas-n").textContent = playerasApartadas().length ? `(${playerasApartadas().length})` : "";
  $("mb-apartadas").checked = mb.apartadas;
  if (mb.apartadas && apartadas.length) {
    grid.appendChild(el("div", "mb-seccion", `Apartadas · no se pueden vender aquí (${apartadas.length})`));
    apartadas.forEach(({ p, motivo }) => {
      const tile = el("button", "mb-tile apartada");
      tile.type = "button";
      tile.dataset.apartada = p.id;
      const punto = el("span", "mb-dot");
      punto.style.background = colorHex(p.colorId);
      tile.appendChild(punto);
      tile.appendChild(el("span", "mb-tile-name", p.nombre));
      tile.appendChild(el("span", "mb-tile-meta", `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)}`));
      tile.appendChild(el("span", "mb-tile-motivo", motivo.texto));
      tile.appendChild(el("span", "mb-tile-stock", `${p.stock} pza · toca para ver`));
      grid.appendChild(tile);
    });
  }
  document.querySelectorAll("#modo-bazar .mb-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === mb.tab));
}
function lineasMB() {
  return Object.keys(mb.ticket).map(key => {
    const pr = producto(key);
    return pr ? { pr, cantidad: mb.ticket[key] } : null;
  }).filter(Boolean);
}
function renderTicketMB() {
  const cont = $("mb-ticket-items");
  const lineas = lineasMB();
  cont.innerHTML = "";
  if (!lineas.length) cont.appendChild(el("span", "mb-ticket-vacio", "Toca un producto para agregarlo a la venta"));
  let total = 0;
  lineas.forEach(({ pr, cantidad }) => {
    total += pr.precio * cantidad;
    const chip = el("span", "mb-chip");
    const menos = el("button", "", "−"); menos.type = "button"; menos.dataset.key = pr.key; menos.dataset.delta = "-1"; menos.setAttribute("aria-label", "Quitar una");
    const mas = el("button", "", "+"); mas.type = "button"; mas.dataset.key = pr.key; mas.dataset.delta = "1"; mas.setAttribute("aria-label", "Agregar una");
    chip.appendChild(menos);
    chip.appendChild(el("span", "mb-chip-text", `${cantidad} × ${pr.tipo === "sticker" ? "✂️ " : ""}${pr.nombre}`));
    chip.appendChild(mas);
    cont.appendChild(chip);
  });
  $("mb-total").textContent = fmt(total);
  $("mb-cobrar").disabled = !lineas.length;
}

/* ---- Vendido hoy: ventas rápidas + cotizaciones del bazar elegido ---- */
function ventasDeHoy(bazarId) {
  const hoy = hoyLocal();
  const pasa = r => bazarId ? bazarIdsDe(r).includes(bazarId) : bazarIdsDe(r).length === 0;
  const playeras = AppState.playeras.filter(p => p.ventaRapida && p.fechaVenta === hoy && p.bazarEstado === "Vendida" && pasa(p));
  const stickers = (AppState.ventasStickers || []).filter(v => v.fecha === hoy && pasa(v));
  const cots = AppState.cotizaciones.filter(c => !c.ventaNula && c.fecha === hoy && pasa(c));
  const rapidas = playeras.reduce((s, p) => s + (p.precioVenta || 0) * (p.stock || 0), 0) + stickers.reduce((s, v) => s + (v.precioVenta || 0) * (v.cantidad || 0), 0);
  const tarjetaRapidas = playeras.reduce((s, p) => s + (p.montoTarjeta || 0), 0) + stickers.reduce((s, v) => s + (v.montoTarjeta || 0), 0);
  const cotizaciones = cots.reduce((s, c) => s + (c.totalVenta || 0), 0);
  const tarjetaCots = cots.reduce((s, c) => s + (c.montoTarjeta || 0), 0);
  const total = rapidas + cotizaciones;
  const tarjeta = Math.min(total, tarjetaRapidas + tarjetaCots);
  return { playeras, stickers, cots, rapidas, cotizaciones, total, tarjeta, efectivo: Math.max(0, total - tarjeta) };
}
function renderHoyMB() {
  $("mb-hoy").textContent = fmt(ventasDeHoy($("mb-bazar").value).total);
}
function detalleHoyMB() {
  const bazarId = $("mb-bazar").value;
  const d = ventasDeHoy(bazarId);
  const nombreBazar = bazarId ? ((AppState.bazares.find(b => b.id === bazarId) || {}).nombre || "Bazar") : "Sin bazar (caja general)";
  const lineas = [
    ...d.playeras.map(p => ({ tipo: "playera", id: p.id, texto: `${p.stock} × ${p.nombre}`, monto: (p.precioVenta || 0) * (p.stock || 0) })),
    ...d.stickers.map(v => ({ tipo: "sticker", id: v.id, texto: `${v.cantidad} × ✂️ ${v.nombre}`, monto: (v.precioVenta || 0) * (v.cantidad || 0) }))
  ];
  const secciones = [
    { title: "Resumen", rows: [
      ["Ventas rápidas y modo bazar", fmt(d.rapidas)],
      [`Cotizaciones (${d.cots.length})`, fmt(d.cotizaciones)],
      ["Total de hoy", fmt(d.total), "accent"]
    ] },
    { title: "Cómo se cobró", rows: [["💵 Efectivo", fmt(d.efectivo)], ["💳 Tarjeta", fmt(d.tarjeta)]] }
  ];
  if (lineas.length) {
    const visibles = lineas.slice(0, 12);
    secciones.push({
      title: "Ventas de hoy (toca Anular si te equivocaste)",
      rows: visibles.map(l => [l.texto, fmt(l.monto), "", { texto: "Anular", onClick: () => { anularVenta(l.tipo, l.id); detalleHoyMB(); } }]),
      text: lineas.length > visibles.length ? `Y ${lineas.length - visibles.length} venta(s) más.` : undefined
    });
  } else {
    secciones.push({ text: "Aún no hay ventas rápidas hoy en este lugar." });
  }
  window.openQuickDetail({ icon: "🧾", title: "Vendido hoy", subtitle: nombreBazar, sections: secciones, actions: [{ label: "Cerrar", variant: "primary" }] });
}

function renderMB() {
  if (!modoBazarAbierto()) return;
  // Si algo del ticket ya no existe o se quedó sin stock, se ajusta.
  Object.keys(mb.ticket).forEach(key => {
    const pr = producto(key);
    if (!pr || pr.stock < 1) delete mb.ticket[key];
    else if (mb.ticket[key] > pr.stock) mb.ticket[key] = pr.stock;
  });
  renderGridMB(); renderTicketMB(); renderHoyMB();
}
function cobrarMB() {
  const lineas = lineasMB();
  if (!lineas.length) return;
  const total = lineas.reduce((s, { pr, cantidad }) => s + pr.precio * cantidad, 0);
  const piezas = lineas.reduce((s, { cantidad }) => s + cantidad, 0);
  const exito = registrarVentas(
    lineas.map(({ pr, cantidad }) => ({ key: pr.key, cantidad, precio: pr.precio })),
    mb.metodo, $("mb-bazar").value,
    `Cobrado: ${piezas} pieza(s) — ${fmt(total)} (${mb.metodo === "Tarjeta" ? "tarjeta" : "efectivo"})`
  );
  if (exito) { mb.ticket = {}; renderMB(); }
}
function openModoBazar() {
  crearModoBazar();
  mb.ticket = {}; mb.metodo = "Efectivo"; mb.tab = "playeras"; mb.apartadas = false;
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
   5) SELECTOR DE BAZAR ACTIVO (desplegable con tarjetas)
   Reemplaza el menú nativo del navegador por tarjetas con el mismo
   formato de la página. El <select> original sigue existiendo
   (oculto) para que ui.js lo siga usando sin cambios.
=============================================================== */
function rangoFechasBazar(b) {
  const ini = b.fecha || b.fechaInicio || "";
  const fin = b.fechaFin || ini;
  if (!ini) return "";
  return ini === fin ? ini : `${ini} al ${fin}`;
}
function iniciarSelectorBazar() {
  const sel = $("header-bazar-activo");
  const bar = sel && sel.closest(".bazar-activo-bar");
  if (!sel || !bar || $("bazar-picker-btn")) return;
  sel.classList.add("bazar-select-oculto");
  sel.setAttribute("tabindex", "-1");
  sel.setAttribute("aria-hidden", "true");

  const btn = el("button", "bazar-picker-btn");
  btn.id = "bazar-picker-btn";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  const txt = el("span", "bazar-picker-txt");
  btn.appendChild(txt);
  btn.appendChild(el("span", "bazar-picker-flecha", "▾"));
  sel.insertAdjacentElement("afterend", btn);

  const panel = el("div", "bazar-picker-panel");
  panel.hidden = true;
  bar.appendChild(panel);

  const pintarBoton = () => {
    const o = sel.options[sel.selectedIndex];
    txt.textContent = o && o.value ? o.textContent : "Sin bazar activo";
  };
  const cerrar = () => { panel.hidden = true; btn.setAttribute("aria-expanded", "false"); };
  const elegir = id => {
    sel.value = id;
    sel.dispatchEvent(new Event("change", { bubbles: true })); // dispara onHeaderBazarChange()
    pintarBoton();
    cerrar();
  };
  const tarjeta = ({ ico, titulo, sub, etiqueta, activa, onClick, clase }) => {
    const c = el("button", "bazar-card" + (activa ? " active" : "") + (clase ? " " + clase : ""));
    c.type = "button";
    c.appendChild(el("span", "bazar-card-ico", ico));
    const t = el("span", "bazar-card-txt");
    t.appendChild(el("span", "bazar-card-name", titulo));
    if (sub) t.appendChild(el("span", "bazar-card-meta", sub));
    c.appendChild(t);
    if (etiqueta) c.appendChild(el("span", activa ? "bazar-card-tag" : "bazar-card-monto", etiqueta));
    c.addEventListener("click", onClick);
    return c;
  };
  const pintarPanel = () => {
    panel.innerHTML = "";
    panel.appendChild(el("div", "bazar-picker-titulo", "¿Dónde estás vendiendo?"));
    panel.appendChild(tarjeta({
      ico: "➖", titulo: "Sin bazar activo", sub: "Las ventas van a la caja general",
      activa: !sel.value, etiqueta: !sel.value ? "Activo" : "", onClick: () => elegir("")
    }));
    AppState.bazares.forEach(b => {
      const activa = sel.value === b.id;
      const vendido = getBazarVentasYGanancia(b.id).totalVendido;
      panel.appendChild(tarjeta({
        ico: "🏪", titulo: b.nombre,
        sub: [b.lugar, rangoFechasBazar(b)].filter(Boolean).join(" · "),
        activa, etiqueta: activa ? "Activo" : (vendido ? fmt(vendido) : ""), onClick: () => elegir(b.id)
      }));
    });
    panel.appendChild(tarjeta({
      ico: "＋", titulo: "Nuevo bazar", sub: "", activa: false, clase: "bazar-card-nuevo",
      onClick: () => { cerrar(); window.openModalBazar(); }
    }));
  };

  btn.addEventListener("click", () => {
    if (panel.hidden) { pintarPanel(); panel.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    else cerrar();
  });
  document.addEventListener("click", ev => { if (!panel.hidden && !bar.contains(ev.target)) cerrar(); });
  document.addEventListener("keydown", ev => { if (ev.key === "Escape" && !panel.hidden) cerrar(); });
  sel.addEventListener("change", pintarBoton);
  // ui.js vuelve a llenar las opciones cuando cambian los bazares
  new MutationObserver(() => { pintarBoton(); if (!panel.hidden) pintarPanel(); }).observe(sel, { childList: true });
  pintarBoton();
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
  iniciarSelectorBazar();
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
