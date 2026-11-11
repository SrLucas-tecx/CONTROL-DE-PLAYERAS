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
import { fmt, escapeHtml, colorNombre, colorHex, comisionTerminalMonto, bazarIdsDe, getBazarVentasYGanancia, playerasDisponibles, clienteNombre, bazaresOrdenados } from "./calculator.js";
import { showToast } from "./ui.js";

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
  bazaresOrdenados().forEach(b => sel.appendChild(opt(b.id, b.nombre)));
  sel.value = AppState.bazares.some(b => b.id === valor) ? valor : "";
}
function llenarSelectCliente(sel, valor = "") {
  sel.innerHTML = "";
  sel.appendChild(opt("", "Sin cliente asignado"));
  AppState.clientes.forEach(c => sel.appendChild(opt(c.id, c.nombre)));
  sel.value = AppState.clientes.some(c => c.id === valor) ? valor : "";
}
// Piezas que sí se pueden vender ahora: con stock, no vendidas ni regaladas, y que no estén con un consignatario.
/* ---------------------------------------------------------------
   PRODUCTOS VENDIBLES (playeras y stickers con una "clave" p:ID / s:ID)
--------------------------------------------------------------- */
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
// Playeras que todavía tienen stock disponible y no están regaladas ni en consignación.
const playerasVendibles = () => playerasDisponibles()
  .filter(p => (p.stock || 0) > 0
    && !(p.consignacionId && p.consignacionEstado !== "Devuelta"))
  .sort(porNombre);
const stickersVendibles = () => AppState.stickers.filter(s => (s.stock || 0) > 0).sort(porNombre);
// Devuelve { key, tipo, obj, nombre, meta, precio, stock, hex } de una clave "p:ID" / "s:ID".
function producto(key) {
  const [t, id] = String(key).split(":");
  if (t === "c") {
    const [, consignacionId, productoId, ubicacionId] = String(key).split(":");
    const consignacion = AppState.consignaciones.find(item => item.id === consignacionId);
    const item = consignacion?.productos?.find(producto => producto.id === productoId);
    if (!consignacion || !item) return null;
    const bazarId = ubicacionId === "general" ? "" : ubicacionId;
    const asignaciones = item.asignaciones || [];
    const asignacion = asignaciones.find(actual => (actual.bazarId || "") === bazarId);
    const asignado = asignaciones.reduce((total, actual) => total + (Number(actual.cantidadEntregada) || 0), 0);
    const stock = asignacion
      ? Math.max(0, (Number(asignacion.cantidadEntregada) || 0) - (Number(asignacion.cantidadVendida) || 0) - (Number(asignacion.cantidadDevuelta) || 0))
      : bazarId ? 0 : Math.max(0, (Number(item.cantidadRecibida) || 0) - asignado);
    if (!stock) return null;
    const bazar = bazarId ? AppState.bazares.find(actual => actual.id === bazarId) : null;
    return {
      key, tipo: "consignacion", obj: { consignacion, producto: item, asignacion, bazarId },
      nombre: item.nombre, meta: `${consignacion.nombre}${bazar ? ` · ${bazar.nombre}` : " · Caja general"}`,
      precio: Number(item.precioVenta) || 0, stock, hex: ""
    };
  }
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
   · Consignación: se registra la venta y el pago en la asignación del bazar.
   lineas = [{ key, cantidad, precio }]
--------------------------------------------------------------- */
function registrarVentas(lineas, pago, bazarId, aviso, turnoCajaId = "", clienteId = "") {
  const totalVenta = lineas.reduce((total, linea) => total + Math.max(0, Number(linea.precio) || 0) * Math.floor(Number(linea.cantidad) || 0), 0);
  const pagoNormalizado = typeof pago === "string"
    ? { metodo: pago, montoTarjeta: pago === "Tarjeta" ? totalVenta : 0, efectivoRecibido: pago === "Efectivo" ? totalVenta : 0 }
    : pago || {};
  const montoTarjetaTotal = Number(pagoNormalizado.montoTarjeta) || 0;
  const ventaId = uid();
  const cantidades = new Map();
  const lineasValidas = lineas.map(linea => {
    const pr = producto(linea.key);
    const cantidad = Number(linea.cantidad);
    const precio = Number(linea.precio);
    if (pr && Number.isInteger(cantidad) && cantidad > 0) cantidades.set(linea.key, (cantidades.get(linea.key) || 0) + cantidad);
    return pr && Number.isInteger(cantidad) && cantidad > 0 && Number.isFinite(precio) && precio >= 0;
  });
  if (!lineasValidas.length || lineasValidas.some(esValida => !esValida)) {
    showToast("No se registró la venta: revisa el stock y los precios del carrito.", "error");
    return false;
  }
  if ([...cantidades].some(([key, cantidad]) => cantidad > (producto(key)?.stock || 0))) {
    showToast("No se registró la venta: el stock cambió. Revisa el carrito.", "error");
    return false;
  }
  if (clienteId && !AppState.clientes.some(cliente => cliente.id === clienteId)) {
    showToast("No se registró la venta: el cliente seleccionado ya no existe.", "error");
    return false;
  }
  if (!Number.isFinite(montoTarjetaTotal) || montoTarjetaTotal < 0 || montoTarjetaTotal > totalVenta
    || !Number.isFinite(Number(pagoNormalizado.efectivoRecibido))
    || Number(pagoNormalizado.efectivoRecibido) < totalVenta - montoTarjetaTotal) {
    showToast("El pago no cubre el total de la venta.", "error");
    return false;
  }
  const copiaEstado = window.tomarCopiaEstado();
  if (!AppState.ventasStickers) AppState.ventasStickers = [];
  let registradas = 0;
  let tarjetaRestante = montoTarjetaTotal;
  lineas.forEach((l, indice) => {
    const pr = producto(l.key);
    const cantidad = Math.floor(l.cantidad);
    const precio = Math.max(0, Number(l.precio) || 0);
    const lista = Number(l.precioLista) || precio;   // precio sin descuento
    const total = precio * cantidad;
    const montoTarjeta = Math.min(total, tarjetaRestante);
    tarjetaRestante = Math.max(0, tarjetaRestante - montoTarjeta);
    const montoEfectivo = total - montoTarjeta;
    const metodo = pagoNormalizado.metodo || "Efectivo";
    const comision = comisionTerminalMonto(montoTarjeta, AppState.settings.comisionTerminalPct);
    if (pr.tipo === "consignacion") {
      const { producto: item, bazarId } = pr.obj;
      let asignacion = pr.obj.asignacion;
      if (!asignacion) {
        const cantidadAsignada = (item.asignaciones || []).reduce((total, actual) => total + (Number(actual.cantidadEntregada) || 0), 0);
        asignacion = { bazarId, cantidadEntregada: Math.max(0, (Number(item.cantidadRecibida) || 0) - cantidadAsignada), cantidadVendida: 0, cantidadDevuelta: 0, ventas: [] };
        item.asignaciones = [...(item.asignaciones || []), asignacion];
      }
      asignacion.cantidadVendida = (Number(asignacion.cantidadVendida) || 0) + cantidad;
      asignacion.ventas = [...(asignacion.ventas || []), {
        id: uid(), ventaId, turnoCajaId, cantidad, precioVenta: precio, precioLista: lista, total, metodoPago: metodo,
        montoEfectivo, montoTarjeta, comisionTerminal: comision,
        efectivoRecibido: indice === 0 ? Number(pagoNormalizado.efectivoRecibido) || 0 : 0,
        cambio: indice === 0 ? Math.max(0, (Number(pagoNormalizado.efectivoRecibido) || 0) - (totalVenta - montoTarjetaTotal)) : 0,
        fecha: hoyLocal()
      }];
      registradas++;
      return;
    }
    if (pr.tipo === "playera") {
      const p = pr.obj;
      const venta = JSON.parse(JSON.stringify(p));
      Object.assign(venta, {
        id: uid(), origenId: p.id, stock: cantidad, precioVenta: precio, precioLista: lista, stockMinimo: 0,
        bazarId: bazarId || "", bazarIds: bazarId ? [bazarId] : [], bazarEstado: "Vendida",
        metodoPago: metodo, montoEfectivo, montoTarjeta, comisionTerminal: comision, turnoCajaId, ventaId,
        efectivoRecibido: indice === 0 ? Number(pagoNormalizado.efectivoRecibido) || 0 : 0,
        cambio: indice === 0 ? Math.max(0, (Number(pagoNormalizado.efectivoRecibido) || 0) - (totalVenta - montoTarjetaTotal)) : 0,
        consignacionId: "", consignacionEstado: "", clienteId,
        stockDescontadoVenta: cantidad,
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
        precioVenta: precio, precioLista: lista, costoUnitario: s.costo || 0,
        metodoPago: metodo, montoEfectivo, montoTarjeta, comisionTerminal: comision, turnoCajaId, ventaId,
        efectivoRecibido: indice === 0 ? Number(pagoNormalizado.efectivoRecibido) || 0 : 0,
        cambio: indice === 0 ? Math.max(0, (Number(pagoNormalizado.efectivoRecibido) || 0) - (totalVenta - montoTarjetaTotal)) : 0,
        bazarId: bazarId || "", bazarIds: bazarId ? [bazarId] : [], fecha: hoyLocal(), clienteId
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
  if (tipo === "consignacion") {
    let encontrada = false;
    (AppState.consignaciones || []).forEach(consignacion => (consignacion.productos || []).forEach(item =>
      (item.asignaciones || []).forEach(asignacion => {
        const ventas = asignacion.ventas || [];
        const venta = ventas.find(actual => actual.id === id);
        if (!venta) return;
        asignacion.cantidadVendida = Math.max(0, (Number(asignacion.cantidadVendida) || 0) - (Number(venta.cantidad) || 0));
        asignacion.ventas = ventas.filter(actual => actual.id !== id);
        encontrada = true;
      })));
    if (!encontrada) return;
    aviso = "Venta consignada anulada — las unidades volvieron a estar disponibles.";
  } else if (tipo === "playera") {
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
          <div class="form-group" id="vr-cliente-wrap" style="display:none;">
            <label class="form-label">Cliente (opcional)</label>
            <select id="vr-cliente" class="form-select"></select>
            <span class="form-hint">La venta se agregará al historial de compras del cliente.</span>
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
  $("vr-cliente-wrap").style.display = pr.tipo !== "consignacion" ? "block" : "none";
  if (pr.tipo === "consignacion") $("vr-cliente").value = "";
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
  const dif = precio - pr.precio;
  let txt = valida ? `Total: ${fmt(total)}` : `La cantidad debe estar entre 1 y ${pr.stock}.`;
  if (valida && Math.abs(dif) > 0.004) txt += ` — lista ${fmt(pr.precio)} (${dif < 0 ? "−" : "+"}${fmt(Math.abs(dif))} c/u)`;
  if (valida && vr.metodo === "Tarjeta") txt += ` — comisión de terminal: ${fmt(comisionTerminalMonto(total, AppState.settings.comisionTerminalPct))}`;
  $("vr-total").textContent = txt;
  ok.disabled = !valida;
}
async function confirmarVR() {
  const pr = producto(vr.sel);
  if (!pr) return;
  const cant = parseInt($("vr-cant").value) || 0;
  const precio = parseFloat($("vr-precio").value) || 0;
  const dif = precio - pr.precio;
  const ok = await window.confirmPopup({
    title: "Confirmar venta rápida",
    message: `${cant} × ${pr.nombre} a ${fmt(precio)} c/u = ${fmt(cant * precio)} (${vr.metodo.toLowerCase()})` +
      (Math.abs(dif) > 0.004 ? ` · precio de lista ${fmt(pr.precio)}, diferencia ${dif < 0 ? "−" : "+"}${fmt(Math.abs(dif))} c/u` : "") +
      ". ¿Registrar la venta?",
    confirmLabel: "Registrar venta", danger: false
  });
  if (!ok) return;
  const exito = registrarVentas([{ key: pr.key, cantidad: cant, precio, precioLista: pr.precio }], vr.metodo, $("vr-bazar").value,
    `Venta registrada: ${cant} × ${pr.nombre} — ${fmt(cant * precio)}`, "", $("vr-cliente").value);
  if (exito) $("modal-venta-rapida").classList.remove("open");
}
function openVentaRapida() {
  crearModalVR();
  vr.sel = ""; vr.metodo = "Efectivo";
  $("vr-buscar").value = "";
  $("vr-detalle").style.display = "none";
  $("vr-ok").disabled = true;
  $("vr-pago").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.metodo === "Efectivo"));
  llenarSelectCliente($("vr-cliente"));
  $("vr-cliente-wrap").style.display = "none";
  renderListaVR();
  $("modal-venta-rapida").classList.add("open");
}

/* ===============================================================
   2) MODO BAZAR (pantalla completa, botones grandes)
   Pestañas Playeras / Stickers, venta mezclada, "apartadas" y
   resumen de lo vendido hoy (ventas rápidas + cotizaciones).
=============================================================== */
const mb = { ticket: {}, desc: {}, metodo: "Efectivo", tab: "playeras", apartadas: false };
const turnoActivoMB = bazarId => (AppState.turnosCaja || []).find(turno =>
  turno.estado === "abierta" && (turno.bazarId || "") === (bazarId || "")
);
function resumenTurnoMB(turno) {
  const ventas = [
    ...(AppState.playeras || []).filter(venta => venta.turnoCajaId === turno.id),
    ...(AppState.ventasStickers || []).filter(venta => venta.turnoCajaId === turno.id),
    ...(AppState.consignaciones || []).flatMap(consignacion => (consignacion.productos || []).flatMap(item =>
      (item.asignaciones || []).flatMap(asignacion => (asignacion.ventas || []).filter(venta => venta.turnoCajaId === turno.id))))
  ];
  const tarjeta = ventas.reduce((total, venta) => total + (Number(venta.montoTarjeta) || 0), 0);
  const efectivo = ventas.reduce((total, venta) => total + (Number(venta.montoEfectivo) || 0), 0);
  return { efectivo, tarjeta, total: efectivo + tarjeta, esperado: (Number(turno.fondoInicial) || 0) + efectivo };
}
function actualizarEstadoCajaMB() {
  const bazarId = $("mb-bazar").value;
  const turno = turnoActivoMB(bazarId);
  const boton = $("mb-caja-state");
  boton.textContent = turno ? "🔒 Caja abierta · cerrar turno" : "🔓 Abrir caja";
  boton.classList.toggle("active", !!turno);
  $("mb-bazar").disabled = !!turno;
  $("mb-cobrar").disabled = !turno || !lineasMB().length;
  $("mb-limpiar").disabled = !lineasMB().length;
}
function crearModoBazar() {
  if ($("modo-bazar")) return;
  const o = el("div", "mb-overlay");
  o.id = "modo-bazar";
  o.innerHTML = `
    <div class="mb-top">
      <b class="mb-titulo">🛍️ Modo bazar</b>
      <select id="mb-bazar" class="form-select" aria-label="Bazar"></select>
      <button type="button" class="mb-hoy" id="mb-hoy-btn" title="Ver el detalle de lo vendido hoy"><span>Vendido hoy ›</span><b id="mb-hoy">$0</b></button>
      <button type="button" class="btn-secondary" id="mb-caja-state">🔓 Abrir caja</button>
      <button type="button" class="btn-secondary" id="mb-salir">Salir</button>
    </div>
    <div class="mb-tabs">
      <button type="button" class="mb-tab active" data-tab="playeras">👕 Playeras</button>
      <button type="button" class="mb-tab" data-tab="stickers">✂️ Stickers</button>
      <button type="button" class="mb-tab" data-tab="consignacion">🤝 Consignación</button>
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
          <button type="button" data-metodo="Mixto">💵💳 Mixto</button>
        </div>
        <div class="mb-total"><span>Total</span><b id="mb-total">$0.00</b></div>
        <button type="button" class="btn-secondary" id="mb-limpiar">Limpiar</button>
        <button type="button" class="btn-primary mb-cobrar" id="mb-cobrar" disabled>Cobrar</button>
      </div>
    </div>`;
  document.body.appendChild(o);

  $("mb-salir").addEventListener("click", cerrarModoBazar);
  $("mb-buscar").addEventListener("input", renderGridMB);
  $("mb-bazar").addEventListener("change", () => { mb.ticket = {}; mb.desc = {}; renderMB(); });
  $("mb-caja-state").addEventListener("click", abrirDialogoCajaMB);
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
    const d = e.target.closest("[data-desc]");
    if (d) { abrirDescuentoMB(d.dataset.desc); return; }
    const b = e.target.closest("[data-key]");
    if (b) agregarMB(b.dataset.key, Number(b.dataset.delta));
  });
  $("mb-pago").addEventListener("click", e => {
    const b = e.target.closest("[data-metodo]");
    if (!b) return;
    mb.metodo = b.dataset.metodo;
    $("mb-pago").querySelectorAll("button").forEach(x => x.classList.toggle("active", x === b));
  });
  $("mb-limpiar").addEventListener("click", async () => {
    if (lineasMB().length) {
      const ok = await window.confirmPopup({ title: "Vaciar el carrito", message: "Se quitarán todos los productos de esta venta. ¿Seguro?", confirmLabel: "Vaciar", danger: true });
      if (!ok) return;
    }
    mb.ticket = {}; mb.desc = {}; renderMB();
  });
  $("mb-cobrar").addEventListener("click", cobrarMB);
}
const modoBazarAbierto = () => { const o = $("modo-bazar"); return !!o && o.classList.contains("open"); };
function agregarMB(key, delta) {
  if (!turnoActivoMB($("mb-bazar").value)) {
    showToast("Abre la caja de este bazar antes de agregar productos al cobro.", "error");
    return;
  }
  const pr = producto(key);
  if (!pr) return;
  const actual = mb.ticket[key] || 0;
  const nueva = Math.min(pr.stock, Math.max(0, actual + delta));
  if (nueva === 0) delete mb.ticket[key]; else mb.ticket[key] = nueva;
  renderMB();
}

function crearDialogoCajaMB() {
  if ($("mb-caja-dialog")) return;
  const dialogo = el("div", "mb-dialog-backdrop");
  dialogo.id = "mb-caja-dialog";
  dialogo.innerHTML = `
    <section class="mb-dialog" role="dialog" aria-modal="true" aria-labelledby="mb-caja-title">
      <h2 id="mb-caja-title">Caja</h2>
      <div id="mb-caja-body"></div>
      <div class="mb-dialog-actions">
        <button type="button" class="btn-secondary" id="mb-caja-cancelar">Cancelar</button>
        <button type="button" class="btn-primary" id="mb-caja-confirmar"></button>
      </div>
    </section>`;
  document.body.appendChild(dialogo);
  $("mb-caja-cancelar").addEventListener("click", () => dialogo.classList.remove("open"));
  $("mb-caja-confirmar").addEventListener("click", confirmarAccionCajaMB);
  $("mb-caja-body").addEventListener("input", actualizarPreviewCierreMB);
}
function abrirDialogoCajaMB() {
  crearDialogoCajaMB();
  const bazarId = $("mb-bazar").value;
  const turno = turnoActivoMB(bazarId);
  const nombre = escapeHtml(bazarId ? AppState.bazares.find(bazar => bazar.id === bazarId)?.nombre || "Bazar" : "Caja general");
  $("mb-caja-title").textContent = turno ? "Cerrar turno de caja" : "Abrir turno de caja";
  $("mb-caja-body").innerHTML = turno
    ? `<p class="mb-dialog-copy">${nombre} · abierto desde ${new Date(turno.fechaApertura).toLocaleString("es-MX")}</p>
       <div class="mb-dialog-summary"><span>Fondo inicial</span><b>${fmt(turno.fondoInicial)}</b><span>Ventas en efectivo</span><b id="mb-caja-efectivo">$0</b><span>Ventas con tarjeta</span><b id="mb-caja-tarjeta">$0</b><span>Efectivo esperado</span><b id="mb-caja-esperado">$0</b></div>
       <label class="form-label" for="mb-caja-contado">Efectivo contado al cierre</label>
       <input id="mb-caja-contado" class="form-input" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00">
       <p id="mb-caja-diferencia" class="mb-dialog-copy">Captura el efectivo contado para comparar.</p>`
    : `<p class="mb-dialog-copy">${nombre} · Captura el efectivo que dejas como fondo inicial para dar cambio.</p>
       <label class="form-label" for="mb-caja-fondo">Fondo inicial</label>
       <input id="mb-caja-fondo" class="form-input" type="number" min="0" step="0.01" inputmode="decimal" value="${bazarId ? Number(AppState.bazares.find(bazar => bazar.id === bazarId)?.fondoCaja) || 0 : Number(AppState.cajaGeneral?.fondoCaja) || 0}">`;
  $("mb-caja-confirmar").textContent = turno ? "Cerrar caja" : "Abrir caja";
  $("mb-caja-confirmar").dataset.action = turno ? "close" : "open";
  if (turno) {
    const resumen = resumenTurnoMB(turno);
    $("mb-caja-efectivo").textContent = fmt(resumen.efectivo);
    $("mb-caja-tarjeta").textContent = fmt(resumen.tarjeta);
    $("mb-caja-esperado").textContent = fmt(resumen.esperado);
  }
  $("mb-caja-dialog").classList.add("open");
}
function actualizarPreviewCierreMB() {
  const turno = turnoActivoMB($("mb-bazar").value);
  const input = $("mb-caja-contado");
  if (!turno || !input) return;
  const contado = Number(input.value);
  const diferencia = contado - resumenTurnoMB(turno).esperado;
  $("mb-caja-diferencia").textContent = input.value === ""
    ? "Captura el efectivo contado para comparar."
    : Math.abs(diferencia) < 0.01
      ? "✅ La caja cuadra exacto."
      : diferencia > 0 ? `Sobran ${fmt(diferencia)}.` : `Faltan ${fmt(Math.abs(diferencia))}.`;
}
async function confirmarAccionCajaMB() {
  const bazarId = $("mb-bazar").value;
  const turno = turnoActivoMB(bazarId);
  if (!turno) {
    const otroTurno = (AppState.turnosCaja || []).find(actual => actual.estado === "abierta");
    if (otroTurno) {
      const nombre = otroTurno.bazarId
        ? AppState.bazares.find(bazar => bazar.id === otroTurno.bazarId)?.nombre || "otro bazar"
        : "la caja general";
      showToast(`Cierra primero el turno abierto en ${nombre}.`, "error");
      return;
    }
    const fondoInicial = Number($("mb-caja-fondo").value);
    if (!Number.isFinite(fondoInicial) || fondoInicial < 0) {
      showToast("El fondo inicial debe ser un importe válido.", "error");
      return;
    }
    if (!AppState.turnosCaja) AppState.turnosCaja = [];
    AppState.turnosCaja.push({
      id: uid(), bazarId, estado: "abierta", fechaApertura: new Date().toISOString(),
      fondoInicial, efectivoContado: null
    });
    saveState();
    $("mb-caja-dialog").classList.remove("open");
    showToast("Caja abierta. Ya puedes registrar ventas.");
    renderMB();
    return;
  }
  if (lineasMB().length) {
    showToast("Cobra o limpia el carrito antes de cerrar el turno.", "error");
    return;
  }
  const contado = Number($("mb-caja-contado").value);
  if ($("mb-caja-contado").value === "" || !Number.isFinite(contado) || contado < 0) {
    showToast("Captura el efectivo contado para cerrar la caja.", "error");
    return;
  }
  const resumen = resumenTurnoMB(turno);
  const diferencia = contado - resumen.esperado;
  const mensaje = `Efectivo esperado: ${fmt(resumen.esperado)}. Efectivo contado: ${fmt(contado)}. ${Math.abs(diferencia) < 0.01 ? "La caja cuadra." : diferencia > 0 ? `Sobran ${fmt(diferencia)}.` : `Faltan ${fmt(Math.abs(diferencia))}.`} Se cerrará el turno y no se podrán registrar más ventas en esta caja.`;
  const confirmado = typeof window.confirmPopup === "function"
    ? await window.confirmPopup({ title: "Confirmar cierre de caja", message: mensaje, confirmLabel: "Cerrar caja", danger: true })
    : confirm(mensaje);
  if (!confirmado) return;
  turno.estado = "cerrada";
  turno.fechaCierre = new Date().toISOString();
  turno.efectivoContado = contado;
  turno.efectivoEsperado = resumen.esperado;
  turno.totalVentas = resumen.total;
  turno.ventasEfectivo = resumen.efectivo;
  turno.ventasTarjeta = resumen.tarjeta;
  turno.diferencia = diferencia;
  saveState();
  $("mb-caja-dialog").classList.remove("open");
  showToast("Turno cerrado. El corte quedó guardado.");
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
      { rows: [["Stock", `${p.stock || 0} pza`], ["Talla y color", `${p.talla || "—"} · ${colorNombre(p.colorId)}`], ["Precio", fmt(p.precioConsignacion ?? p.precioVenta)]] }
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
  const bazarId = $("mb-bazar").value;
  const lista = esSticker
    ? stickersVendibles().map(s => producto("s:" + s.id))
    : mb.tab === "consignacion"
      ? AppState.consignaciones.flatMap(consignacion => (consignacion.productos || []).map(item =>
        producto(`c:${consignacion.id}:${item.id}:${bazarId || "general"}`)).filter(Boolean))
      : playerasVendibles().map(p => producto("p:" + p.id));
  const items = lista.filter(pr => !t || textoBusqueda(pr).includes(t));
  grid.innerHTML = "";
  if (!items.length) {
    const emptyText = mb.tab === "consignacion"
      ? "No hay productos consignados disponibles en esta ubicación."
      : esSticker
        ? (AppState.stickers.length ? "Nada con stock coincide." : "Aún no tienes stickers en el inventario.")
        : (AppState.playeras.length ? "Nada con stock coincide." : "Aún no tienes playeras en el inventario.");
    grid.appendChild(el("p", "empty-hint", emptyText));
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
    } else tile.appendChild(el("span", "mb-glyph", pr.tipo === "sticker" ? "✂️" : "🤝"));
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
/* ---- Descuento por línea ---- */
// Precio final por pieza de un producto del ticket, ya con su descuento (% o $ por pieza).
function calcularFinal(precio, tipo, valor) {
  if (tipo === "precio") return Math.max(0, Math.round(valor * 100) / 100);
  const menos = tipo === "pct" ? precio * Math.min(100, Math.max(0, valor)) / 100 : Math.max(0, valor);
  return Math.max(0, Math.round((precio - menos) * 100) / 100);
}
function precioFinalMB(pr) {
  const d = mb.desc[pr.key];
  return d ? calcularFinal(pr.precio, d.tipo, d.valor) : pr.precio;
}
const mbd = { key: "", tipo: "pct" };
function crearModalDescMB() {
  if ($("modal-mb-desc")) return;
  const o = el("div", "modal-overlay");
  o.id = "modal-mb-desc";
  o.innerHTML = `
    <div class="modal-box modal-box-sm">
      <div class="modal-header">
        <h2 class="modal-title">🏷️ Descuento o precio</h2>
        <button class="modal-close" data-modal="modal-mb-desc" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="vr-elegida" id="mbd-prod"></div>
        <div class="pay-toggle" id="mbd-tipo" style="grid-template-columns:repeat(3,minmax(0,1fr));">
          <button type="button" data-tipo="pct" class="active">% Descuento</button>
          <button type="button" data-tipo="monto">$ Descuento</button>
          <button type="button" data-tipo="precio">$ Precio final</button>
        </div>
        <div class="form-group" style="margin-top:var(--space-4);">
          <label class="form-label" id="mbd-label" for="mbd-valor">Descuento (%)</label>
          <input type="number" id="mbd-valor" class="form-input" min="0" step="any" inputmode="decimal">
        </div>
        <div class="mbd-rapidos" id="mbd-rapidos">
          <button type="button" data-pct="5">5%</button><button type="button" data-pct="10">10%</button>
          <button type="button" data-pct="15">15%</button><button type="button" data-pct="20">20%</button>
          <button type="button" data-pct="50">50%</button>
        </div>
        <label class="tag-checkbox" style="margin-bottom:var(--space-3);">
          <input type="checkbox" id="mbd-guardar"> Guardar como nuevo precio de lista del producto
        </label>
        <p class="cost-preview" id="mbd-preview">—</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="mbd-quitar">Quitar cambio</button>
        <button type="button" class="btn-primary" id="mbd-ok">Aplicar</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  $("mbd-tipo").addEventListener("click", ev => {
    const b = ev.target.closest("[data-tipo]");
    if (!b) return;
    mbd.tipo = b.dataset.tipo;
    pintarTipoDescMB();
    previewDescMB();
  });
  $("mbd-rapidos").addEventListener("click", ev => {
    const b = ev.target.closest("[data-pct]");
    if (!b) return;
    $("mbd-valor").value = b.dataset.pct;
    previewDescMB();
  });
  $("mbd-valor").addEventListener("input", previewDescMB);
  $("mbd-ok").addEventListener("click", aplicarDescMB);
  $("mbd-quitar").addEventListener("click", () => {
    delete mb.desc[mbd.key];
    $("modal-mb-desc").classList.remove("open");
    renderMB();
  });
}
function pintarTipoDescMB() {
  $("mbd-tipo").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.tipo === mbd.tipo));
  $("mbd-label").textContent = mbd.tipo === "pct" ? "Descuento (%)" : mbd.tipo === "monto" ? "Descuento por pieza ($)" : "Precio final por pieza ($)";
  $("mbd-rapidos").style.display = mbd.tipo === "pct" ? "flex" : "none";
}
function previewDescMB() {
  const pr = producto(mbd.key);
  const ok = $("mbd-ok");
  if (!pr) { ok.disabled = true; return; }
  const texto = $("mbd-valor").value;
  const valor = parseFloat(texto);
  const vacio = texto === "" || isNaN(valor);
  const invalido = vacio || valor < 0 || (mbd.tipo === "pct" && valor > 100) || (mbd.tipo === "monto" && valor > pr.precio);
  const cant = mb.ticket[pr.key] || 1;
  if (invalido) {
    $("mbd-preview").textContent = vacio ? `Precio de lista: ${fmt(pr.precio)}. Escribe un valor.`
      : mbd.tipo === "pct" ? "El porcentaje debe estar entre 0 y 100."
      : mbd.tipo === "monto" ? `El descuento no puede ser mayor al precio (${fmt(pr.precio)}).` : "El precio no puede ser negativo.";
  } else {
    const final = calcularFinal(pr.precio, mbd.tipo, valor);
    const dif = final - pr.precio;
    $("mbd-preview").textContent = `Lista ${fmt(pr.precio)} → ${fmt(final)} c/u (${Math.abs(dif) < 0.005 ? "sin cambio" : (dif < 0 ? "−" : "+") + fmt(Math.abs(dif))}) · ${cant} pza(s): ${fmt(final * cant)}`;
  }
  ok.disabled = invalido;
}
function abrirDescuentoMB(key) {
  const pr = producto(key);
  if (!pr) return;
  crearModalDescMB();
  const actual = mb.desc[key];
  mbd.key = key;
  mbd.tipo = actual ? actual.tipo : "pct";
  $("mbd-prod").textContent = `${pr.nombre} · ${pr.meta} · precio de lista ${fmt(pr.precio)}`;
  $("mbd-valor").value = actual ? actual.valor : "";
  $("mbd-guardar").checked = !!(actual && actual.guardar);
  pintarTipoDescMB();
  previewDescMB();
  $("modal-mb-desc").classList.add("open");
}
function aplicarDescMB() {
  const valor = parseFloat($("mbd-valor").value);
  if (isNaN(valor)) return;
  if (mbd.tipo === "precio" || valor > 0) mb.desc[mbd.key] = { tipo: mbd.tipo, valor, guardar: $("mbd-guardar").checked };
  else delete mb.desc[mbd.key];
  $("modal-mb-desc").classList.remove("open");
  renderMB();
}
// Guarda el precio editado como nuevo precio de lista (playera, sticker o producto consignado).
function actualizarPrecioProducto(key, precio) {
  const [t, a, b] = String(key).split(":");
  if (t === "p") { const p = AppState.playeras.find(i => i.id === a); if (p) p.precioVenta = precio; }
  else if (t === "s") { const s = AppState.stickers.find(i => i.id === a); if (s) s.precioVenta = precio; }
  else if (t === "c") {
    const c = AppState.consignaciones.find(i => i.id === a);
    const it = c && (c.productos || []).find(i => i.id === b);
    if (it) { it.precioVenta = precio; it.precioTotal = (Number(it.cantidadRecibida) || 0) * precio; }
  }
}

function renderTicketMB() {
  const cont = $("mb-ticket-items");
  const lineas = lineasMB();
  cont.innerHTML = "";
  if (!lineas.length) cont.appendChild(el("span", "mb-ticket-vacio", "Toca un producto para agregarlo a la venta"));
  let total = 0;
  lineas.forEach(({ pr, cantidad }) => {
    const final = precioFinalMB(pr);
    const conDesc = Math.abs(final - pr.precio) > 0.004;
    total += final * cantidad;
    const chip = el("span", "mb-chip");
    const menos = el("button", "", "−"); menos.type = "button"; menos.dataset.key = pr.key; menos.dataset.delta = "-1"; menos.setAttribute("aria-label", "Quitar una");
    const mas = el("button", "", "+"); mas.type = "button"; mas.dataset.key = pr.key; mas.dataset.delta = "1"; mas.setAttribute("aria-label", "Agregar una");
    chip.appendChild(menos);
    chip.appendChild(el("span", "mb-chip-text", `${cantidad} × ${pr.tipo === "sticker" ? "✂️ " : ""}${pr.nombre}${conDesc ? ` · ${fmt(final)} c/u` : ""}`));
    chip.appendChild(mas);
    {
      const desc = el("button", "mb-chip-desc" + (conDesc ? " on" : ""), "🏷️"); desc.type = "button"; desc.dataset.desc = pr.key; desc.setAttribute("aria-label", "Descuento o precio"); desc.title = "Descuento o precio";
      chip.appendChild(desc);
    }
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
  const consignaciones = [];
  (AppState.consignaciones || []).forEach(consignacion => (consignacion.productos || []).forEach(item =>
    (item.asignaciones || []).forEach(asignacion => {
      if ((bazarId ? asignacion.bazarId !== bazarId : !!asignacion.bazarId)) return;
      (asignacion.ventas || []).filter(venta => venta.fecha === hoy).forEach(venta => consignaciones.push({
        tipo: "consignacion", id: venta.id, consignacionId: consignacion.id, productoId: item.id,
        nombre: item.nombre, cantidad: venta.cantidad || 0, precio: venta.precioVenta || item.precioVenta || 0,
        total: venta.total || 0, metodoPago: venta.metodoPago || "Efectivo",
        montoTarjeta: venta.montoTarjeta || 0, comisionTerminal: venta.comisionTerminal || 0,
        bazarId: asignacion.bazarId || ""
      }));
    })));
  const cots = AppState.cotizaciones.filter(c => !c.ventaNula && c.fecha === hoy && pasa(c));
  const rapidas = playeras.reduce((s, p) => s + (p.precioVenta || 0) * (p.stock || 0), 0) +
    stickers.reduce((s, v) => s + (v.precioVenta || 0) * (v.cantidad || 0), 0) +
    consignaciones.reduce((s, v) => s + v.total, 0);
  const tarjetaRapidas = playeras.reduce((s, p) => s + (p.montoTarjeta || 0), 0) +
    stickers.reduce((s, v) => s + (v.montoTarjeta || 0), 0) +
    consignaciones.reduce((s, v) => s + v.montoTarjeta, 0);
  const cotizaciones = cots.reduce((s, c) => s + (c.totalVenta || 0), 0);
  const tarjetaCots = cots.reduce((s, c) => s + (c.montoTarjeta || 0), 0);
  const total = rapidas + cotizaciones;
  const tarjeta = Math.min(total, tarjetaRapidas + tarjetaCots);
  return { playeras, stickers, consignaciones, cots, rapidas, cotizaciones, total, tarjeta, efectivo: Math.max(0, total - tarjeta) };
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
    ...d.stickers.map(v => ({ tipo: "sticker", id: v.id, texto: `${v.cantidad} × ✂️ ${v.nombre}`, monto: (v.precioVenta || 0) * (v.cantidad || 0) })),
    ...d.consignaciones.map(v => ({ tipo: "consignacion", id: v.id, texto: `${v.cantidad} × 🤝 ${v.nombre}`, monto: v.total }))
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
      rows: visibles.map(l => [l.texto, fmt(l.monto), "", { texto: "Anular", onClick: async () => {
        const ok = await window.confirmPopup({ title: "Anular venta", message: "Se borrará esta venta y las piezas regresarán al stock. ¿Seguro?", confirmLabel: "Anular", danger: true });
        if (ok) { anularVenta(l.tipo, l.id); detalleHoyMB(); }
      } }]),
      text: lineas.length > visibles.length ? `Y ${lineas.length - visibles.length} venta(s) más.` : undefined
    });
  } else {
    secciones.push({ text: "Aún no hay ventas rápidas hoy en este lugar." });
  }
  window.openQuickDetail({ icon: "🧾", title: "Vendido hoy", subtitle: nombreBazar, sections: secciones, actions: [{ label: "Ver historial completo", variant: "primary", onClick: () => { cerrarModoBazar(); window.switchPage("ventas-rapidas"); } }, { label: "Cerrar" }] });
}

function renderMB() {
  if (!modoBazarAbierto()) return;
  // Si algo del ticket ya no existe o se quedó sin stock, se ajusta.
  Object.keys(mb.ticket).forEach(key => {
    const pr = producto(key);
    if (!pr || pr.stock < 1) delete mb.ticket[key];
    else if (mb.ticket[key] > pr.stock) mb.ticket[key] = pr.stock;
  });
  Object.keys(mb.desc).forEach(k => { if (!mb.ticket[k]) delete mb.desc[k]; });
  renderGridMB(); renderTicketMB(); renderHoyMB(); actualizarEstadoCajaMB();
}
const cobroMB = { metodo: "Efectivo" };
function crearDialogoCobroMB() {
  if ($("mb-cobro-dialog")) return;
  const dialogo = el("div", "mb-dialog-backdrop");
  dialogo.id = "mb-cobro-dialog";
  dialogo.innerHTML = `
    <section class="mb-dialog" role="dialog" aria-modal="true" aria-labelledby="mb-cobro-title">
      <h2 id="mb-cobro-title">Confirmar cobro</h2>
      <p class="mb-dialog-total">Total a cobrar <b id="mb-cobro-total">$0</b></p>
      <div class="pay-toggle mb-cobro-metodos" id="mb-cobro-metodos">
        <button type="button" data-metodo="Efectivo">💵 Efectivo</button>
        <button type="button" data-metodo="Tarjeta">💳 Tarjeta</button>
        <button type="button" data-metodo="Mixto">💵💳 Mixto</button>
      </div>
      <div class="form-group" id="mb-cobro-tarjeta-wrap">
        <label class="form-label" for="mb-cobro-tarjeta">Importe con tarjeta</label>
        <input id="mb-cobro-tarjeta" class="form-input" type="number" min="0" step="0.01" inputmode="decimal">
      </div>
      <div class="form-group" id="mb-cobro-recibido-wrap">
        <label class="form-label" for="mb-cobro-recibido">Efectivo recibido</label>
        <input id="mb-cobro-recibido" class="form-input" type="number" min="0" step="0.01" inputmode="decimal">
      </div>
      <div class="form-group" id="mb-cobro-cliente-wrap" style="display:none;">
        <label class="form-label" for="mb-cobro-cliente">Cliente (opcional, para playeras y stickers)</label>
        <select id="mb-cobro-cliente" class="form-select"></select>
      </div>
      <p id="mb-cobro-resumen" class="mb-dialog-copy"></p>
      <div class="mb-dialog-actions">
        <button type="button" class="btn-secondary" id="mb-cobro-cancelar">Volver</button>
        <button type="button" class="btn-primary" id="mb-cobro-confirmar">Confirmar venta</button>
      </div>
    </section>`;
  document.body.appendChild(dialogo);
  $("mb-cobro-cancelar").addEventListener("click", () => dialogo.classList.remove("open"));
  $("mb-cobro-confirmar").addEventListener("click", confirmarCobroMB);
  $("mb-cobro-tarjeta").addEventListener("input", actualizarResumenCobroMB);
  $("mb-cobro-recibido").addEventListener("input", actualizarResumenCobroMB);
  $("mb-cobro-metodos").addEventListener("click", event => {
    const boton = event.target.closest("[data-metodo]");
    if (!boton) return;
    cobroMB.metodo = boton.dataset.metodo;
    document.querySelectorAll("#mb-cobro-metodos [data-metodo]").forEach(actual =>
      actual.classList.toggle("active", actual === boton));
    actualizarCamposCobroMB();
  });
}
function actualizarCamposCobroMB() {
  const total = lineasMB().reduce((suma, linea) => suma + precioFinalMB(linea.pr) * linea.cantidad, 0);
  const mixto = cobroMB.metodo === "Mixto";
  $("mb-cobro-tarjeta-wrap").style.display = mixto ? "block" : "none";
  $("mb-cobro-recibido-wrap").style.display = cobroMB.metodo === "Tarjeta" ? "none" : "block";
  $("mb-cobro-tarjeta").value = cobroMB.metodo === "Tarjeta" ? total.toFixed(2) : mixto ? (total / 2).toFixed(2) : "0";
  const tarjeta = Number($("mb-cobro-tarjeta").value) || 0;
  $("mb-cobro-recibido").value = (total - tarjeta).toFixed(2);
  document.querySelectorAll("#mb-cobro-metodos [data-metodo]").forEach(boton =>
    boton.classList.toggle("active", boton.dataset.metodo === cobroMB.metodo));
  actualizarResumenCobroMB();
}
function actualizarResumenCobroMB() {
  const total = lineasMB().reduce((suma, linea) => suma + precioFinalMB(linea.pr) * linea.cantidad, 0);
  const tarjeta = cobroMB.metodo === "Tarjeta" ? total : cobroMB.metodo === "Mixto" ? Number($("mb-cobro-tarjeta").value) : 0;
  const efectivoDebido = total - tarjeta;
  const recibido = cobroMB.metodo === "Tarjeta" ? 0 : Number($("mb-cobro-recibido").value);
  const valido = tarjeta >= 0 && tarjeta <= total && Number.isFinite(recibido) && recibido >= efectivoDebido;
  const cambio = valido ? recibido - efectivoDebido : 0;
  $("mb-cobro-total").textContent = fmt(total);
  $("mb-cobro-resumen").textContent = !valido
    ? `El efectivo recibido debe cubrir ${fmt(efectivoDebido)} y el pago con tarjeta no puede exceder ${fmt(total)}.`
    : `${fmt(efectivoDebido)} en efectivo · ${fmt(tarjeta)} con tarjeta · Cambio: ${fmt(cambio)}`;
  $("mb-cobro-confirmar").disabled = !valido || !turnoActivoMB($("mb-bazar").value);
}
function cobrarMB() {
  if (!lineasMB().length) return;
  if (!turnoActivoMB($("mb-bazar").value)) {
    showToast("Abre la caja antes de cobrar.", "error");
    return;
  }
  crearDialogoCobroMB();
  llenarSelectCliente($("mb-cobro-cliente"));
  $("mb-cobro-cliente-wrap").style.display = lineasMB().some(l => l.pr.tipo === "playera" || l.pr.tipo === "sticker") ? "block" : "none";
  cobroMB.metodo = mb.metodo;
  actualizarCamposCobroMB();
  $("mb-cobro-dialog").classList.add("open");
}
async function confirmarCobroMB() {
  const turno = turnoActivoMB($("mb-bazar").value);
  const lineas = lineasMB();
  if (!turno || !lineas.length) {
    showToast("La caja está cerrada o el carrito quedó vacío.", "error");
    return;
  }
  const total = lineas.reduce((suma, linea) => suma + precioFinalMB(linea.pr) * linea.cantidad, 0);
  const montoTarjeta = cobroMB.metodo === "Tarjeta" ? total
    : cobroMB.metodo === "Mixto" ? Number($("mb-cobro-tarjeta").value) : 0;
  const efectivoRecibido = cobroMB.metodo === "Tarjeta" ? 0 : Number($("mb-cobro-recibido").value);
  const cambio = Math.max(0, efectivoRecibido - (total - montoTarjeta));
  if (!Number.isFinite(montoTarjeta) || !Number.isFinite(efectivoRecibido)
    || montoTarjeta < 0 || montoTarjeta > total || efectivoRecibido < total - montoTarjeta) {
    actualizarResumenCobroMB();
    return;
  }
  const confirmado = typeof window.confirmPopup === "function"
    ? await window.confirmPopup({
      title: "Confirmar venta",
      message: `Total ${fmt(total)} · Efectivo ${fmt(total - montoTarjeta)} · Tarjeta ${fmt(montoTarjeta)}${cambio ? ` · Cambio ${fmt(cambio)}` : ""}. ¿Registrar el cobro y descontar el inventario?`,
      confirmLabel: "Confirmar y cobrar"
    })
    : confirm(`Cobrar ${fmt(total)} y descontar el inventario?`);
  if (!confirmado) return;
  const piezas = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
  const clienteId = $("mb-cobro-cliente") ? $("mb-cobro-cliente").value : "";
  const guardados = lineas.filter(l => mb.desc[l.pr.key] && mb.desc[l.pr.key].guardar)
    .map(l => ({ key: l.pr.key, precio: precioFinalMB(l.pr) }));
  const exito = registrarVentas(
    lineas.map(({ pr, cantidad }) => ({ key: pr.key, cantidad, precio: precioFinalMB(pr), precioLista: pr.precio })),
    { metodo: cobroMB.metodo, montoTarjeta, efectivoRecibido }, $("mb-bazar").value,
    `Cobrado: ${piezas} pieza(s) — ${fmt(total)} · Cambio: ${fmt(cambio)}`, turno.id, clienteId
  );
  if (exito && guardados.length) {
    guardados.forEach(g => actualizarPrecioProducto(g.key, g.precio));
    saveState();
    window.refrescarVistaActual();
    showToast(`Precio de lista actualizado en ${guardados.length} producto(s).`);
  }
  if (exito) {
    $("mb-cobro-dialog").classList.remove("open");
    mb.ticket = {}; mb.desc = {};
    renderMB();
  }
}
function openModoBazar() {
  crearModoBazar();
  mb.ticket = {}; mb.desc = {}; mb.metodo = "Efectivo"; mb.tab = "playeras"; mb.apartadas = false;
  $("mb-pago").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.metodo === "Efectivo"));
  const turnoAbierto = (AppState.turnosCaja || []).find(turno => turno.estado === "abierta");
  llenarSelectBazar($("mb-bazar"), turnoAbierto ? turnoAbierto.bazarId : bazarActivoHeader());
  $("mb-buscar").value = "";
  $("modo-bazar").classList.add("open");
  document.body.classList.add("modo-bazar-activo");
  renderMB();
}
function cerrarModoBazar() {
  if (lineasMB().length && !confirm("Hay productos en el carrito. ¿Salir y descartar esta venta sin cobrar?")) return;
  const o = $("modo-bazar");
  if (o) o.classList.remove("open");
  document.body.classList.remove("modo-bazar-activo");
  mb.ticket = {}; mb.desc = {};
}

/* ===============================================================
   HISTORIAL DE VENTAS RÁPIDAS (pantalla completa, cualquier fecha)
=============================================================== */
/* ===============================================================
   EDITAR EL PRECIO DE UNA VENTA YA REGISTRADA
   Recalcula total, parte en tarjeta/efectivo y comisión de terminal.
   El precio de lista original se conserva para poder comparar.
=============================================================== */
const ep = { tipo: "", id: "" };
function localizarVenta(tipo, id) {
  if (tipo === "playera") {
    const v = AppState.playeras.find(i => i.id === id && i.ventaRapida);
    return v ? { v, tipo, nombre: v.nombre, cantidad: v.stock || 0, precio: v.precioVenta || 0, total: (v.precioVenta || 0) * (v.stock || 0) } : null;
  }
  if (tipo === "sticker") {
    const v = (AppState.ventasStickers || []).find(i => i.id === id);
    return v ? { v, tipo, nombre: v.nombre, cantidad: v.cantidad || 0, precio: v.precioVenta || 0, total: (v.precioVenta || 0) * (v.cantidad || 0) } : null;
  }
  for (const c of AppState.consignaciones || []) {
    for (const it of c.productos || []) {
      for (const a of it.asignaciones || []) {
        const v = (a.ventas || []).find(i => i.id === id);
        if (v) return { v, tipo, nombre: it.nombre, cantidad: v.cantidad || 0, precio: v.precioVenta || 0, total: v.total != null ? v.total : (v.precioVenta || 0) * (v.cantidad || 0) };
      }
    }
  }
  return null;
}
function aplicarPrecioVenta(r, nuevoPrecio) {
  const v = r.v;
  const nuevoTotal = Math.round(nuevoPrecio * r.cantidad * 100) / 100;
  const metodo = v.metodoPago || "Efectivo";
  const tarjetaAnt = Number(v.montoTarjeta) || 0;
  let tarjeta;
  if (metodo === "Tarjeta") tarjeta = nuevoTotal;
  else if (metodo === "Efectivo") tarjeta = 0;
  else tarjeta = r.total > 0 ? Math.min(nuevoTotal, Math.round(nuevoTotal * tarjetaAnt / r.total * 100) / 100) : 0;   // mixto: misma proporción
  if (v.precioLista == null) v.precioLista = r.precio;          // conserva la lista original para comparar
  v.precioVenta = nuevoPrecio;
  if (r.tipo === "consignacion") v.total = nuevoTotal;
  v.montoTarjeta = tarjeta;
  v.montoEfectivo = Math.max(0, Math.round((nuevoTotal - tarjeta) * 100) / 100);
  v.comisionTerminal = comisionTerminalMonto(tarjeta, AppState.settings.comisionTerminalPct);
}
function crearModalEP() {
  if ($("modal-editar-precio")) return;
  const o = el("div", "modal-overlay");
  o.id = "modal-editar-precio";
  o.innerHTML = `
    <div class="modal-box modal-box-sm">
      <div class="modal-header">
        <h2 class="modal-title">✏️ Editar precio de la venta</h2>
        <button class="modal-close" data-modal="modal-editar-precio" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <div class="vr-elegida" id="ep-prod"></div>
        <div class="form-group">
          <label class="form-label" for="ep-precio">Precio c/u ($)</label>
          <input type="number" id="ep-precio" class="form-input" min="0" step="0.01" inputmode="decimal">
        </div>
        <p class="cost-preview" id="ep-preview">—</p>
        <p class="form-hint">Se recalculan el total, la parte en tarjeta, la comisión de terminal, el corte de caja y la ganancia. Puedes deshacerlo desde el aviso.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" data-modal="modal-editar-precio">Cancelar</button>
        <button type="button" class="btn-primary" id="ep-ok">Guardar precio</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  $("ep-precio").addEventListener("input", previewEP);
  $("ep-ok").addEventListener("click", guardarEP);
}
function previewEP() {
  const r = localizarVenta(ep.tipo, ep.id);
  if (!r) return;
  const texto = $("ep-precio").value;
  const nuevo = parseFloat(texto);
  if (texto === "" || isNaN(nuevo) || nuevo < 0) {
    $("ep-preview").textContent = "Escribe un precio válido (0 o mayor).";
    $("ep-ok").disabled = true;
    return;
  }
  const nTotal = nuevo * r.cantidad;
  const dif = nTotal - r.total;
  const lista = r.v.precioLista != null ? r.v.precioLista : r.precio;
  $("ep-preview").textContent = `Antes: ${fmt(r.precio)} c/u · ${fmt(r.total)} → Ahora: ${fmt(nuevo)} c/u · ${fmt(nTotal)} (${Math.abs(dif) < 0.005 ? "sin cambio" : (dif < 0 ? "−" : "+") + fmt(Math.abs(dif))}) · Lista: ${fmt(lista)}`;
  $("ep-ok").disabled = false;
}
function editarPrecioVenta(tipo, id) {
  const r = localizarVenta(tipo, id);
  if (!r) return showToast("No se encontró la venta.", "error");
  crearModalEP();
  ep.tipo = tipo; ep.id = id;
  $("ep-prod").textContent = `${r.nombre} · ${r.cantidad} pza(s) · ${r.v.metodoPago || "Efectivo"}`;
  $("ep-precio").value = r.precio;
  previewEP();
  $("modal-editar-precio").classList.add("open");
}
async function guardarEP() {
  const r = localizarVenta(ep.tipo, ep.id);
  const nuevo = parseFloat($("ep-precio").value);
  if (!r || isNaN(nuevo) || nuevo < 0) return;
  if (Math.abs(nuevo - r.precio) < 0.005) { $("modal-editar-precio").classList.remove("open"); return; }
  const turno = (AppState.turnosCaja || []).find(t => t.id === r.v.turnoCajaId);
  const avisoTurno = turno && turno.estado === "cerrada" ? " Ojo: esta venta pertenece a un turno de caja ya cerrado; el corte guardado de ese turno no se modifica." : "";
  const ok = await window.confirmPopup({
    title: "Cambiar el precio de la venta",
    message: `El precio pasará de ${fmt(r.precio)} a ${fmt(nuevo)} c/u (total ${fmt(r.total)} → ${fmt(nuevo * r.cantidad)}). Cambian el total vendido, la comisión de terminal y la ganancia.${avisoTurno} ¿Continuar?`,
    confirmLabel: "Cambiar precio", danger: false
  });
  if (!ok) return;
  const copia = window.tomarCopiaEstado();
  aplicarPrecioVenta(r, nuevo);
  saveState();
  $("modal-editar-precio").classList.remove("open");
  window.refrescarVistaActual();
  window.ofrecerDeshacer(`Precio actualizado: ${r.nombre} ahora ${fmt(nuevo)} c/u.`, copia);
}

function ventasSueltas() {
  const playeras = AppState.playeras.filter(p => p.ventaRapida && p.bazarEstado === "Vendida").map(p => ({
    tipo: "playera", id: p.id, fecha: p.fechaVenta || "", nombre: p.nombre,
    meta: `Talla ${p.talla || "—"} · ${colorNombre(p.colorId)}`, cantidad: p.stock || 0,
    precio: p.precioVenta || 0, lista: p.precioLista != null ? p.precioLista : (p.precioVenta || 0),
    metodo: p.metodoPago || "Efectivo", montoEfectivo: p.montoEfectivo, montoTarjeta: p.montoTarjeta,
    comision: p.comisionTerminal || 0, bazarIds: bazarIdsDe(p), clienteId: p.clienteId || ""
  }));
  const stickers = (AppState.ventasStickers || []).map(v => ({
    tipo: "sticker", id: v.id, fecha: v.fecha || "", nombre: v.nombre, meta: v.tamano || "Sticker",
    cantidad: v.cantidad || 0, precio: v.precioVenta || 0, lista: v.precioLista != null ? v.precioLista : (v.precioVenta || 0),
    metodo: v.metodoPago || "Efectivo", montoEfectivo: v.montoEfectivo, montoTarjeta: v.montoTarjeta,
    comision: v.comisionTerminal || 0, bazarIds: bazarIdsDe(v), clienteId: v.clienteId || ""
  }));
  const consignaciones = (AppState.consignaciones || []).flatMap(consignacion =>
    (consignacion.productos || []).flatMap(item =>
      (item.asignaciones || []).flatMap(asignacion =>
        (asignacion.ventas || []).map(venta => ({
          tipo: "consignacion", id: venta.id, fecha: venta.fecha || "", nombre: item.nombre,
          meta: consignacion.nombre, cantidad: venta.cantidad || 0, precio: venta.precioVenta || item.precioVenta || 0,
          lista: venta.precioLista != null ? venta.precioLista : (venta.precioVenta || item.precioVenta || 0), total: venta.total || 0,
          metodo: venta.metodoPago || "Efectivo", montoEfectivo: venta.montoEfectivo,
          montoTarjeta: venta.montoTarjeta, comision: venta.comisionTerminal || 0,
          bazarIds: asignacion.bazarId ? [asignacion.bazarId] : []
        })))));
  return [...playeras, ...stickers, ...consignaciones];
}
function etiquetaDia(fecha) {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha + "T00:00:00");
  if (isNaN(d.getTime())) return fecha;
  const t = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (fecha === hoyLocal() ? "Hoy · " : "") + t.charAt(0).toUpperCase() + t.slice(1);
}
function renderVentasRapidas() {
  const lista = $("vs-lista");
  if (!lista) return;
  const sel = $("vs-bazar");
  const previo = sel.value || "all";
  sel.innerHTML = "";
  sel.appendChild(opt("all", "Todos los lugares"));
  sel.appendChild(opt("none", "Sin bazar (caja general)"));
  AppState.bazares.forEach(b => sel.appendChild(opt(b.id, "🏪 " + b.nombre)));
  sel.value = ["all", "none", ...AppState.bazares.map(b => b.id)].includes(previo) ? previo : "all";

  const hoy = hoyLocal();
  const periodo = $("vs-periodo").value;
  let desde = "";
  if (periodo === "hoy") desde = hoy;
  else if (periodo === "semana") { const d = new Date(); d.setDate(d.getDate() - 6); desde = d.toLocaleDateString("sv-SE"); }
  else if (periodo === "mes") desde = hoy.slice(0, 7) + "-01";
  const metodo = $("vs-metodo").value;
  const t = norm($("vs-buscar").value).trim();
  const bz = sel.value;

  const ventas = ventasSueltas().filter(v =>
    (!desde || v.fecha >= desde) &&
    (metodo === "all" || v.metodo === metodo) &&
    (bz === "all" || (bz === "none" ? v.bazarIds.length === 0 : v.bazarIds.includes(bz))) &&
    (!t || norm(`${v.nombre} ${v.meta}`).includes(t))
  );

  const monto = v => v.tipo === "consignacion" ? v.total : v.precio * v.cantidad;
  const total = ventas.reduce((s, v) => s + monto(v), 0);
  const tarjeta = ventas.reduce((s, v) => s + (Number(v.montoTarjeta) || (v.metodo === "Tarjeta" ? monto(v) : 0)), 0);
  const comision = ventas.reduce((s, v) => s + v.comision, 0);
  $("vs-total").textContent = fmt(total);
  $("vs-total-sub").textContent = `${ventas.length} venta(s)`;
  $("vs-efectivo").textContent = fmt(total - tarjeta);
  $("vs-tarjeta").textContent = fmt(tarjeta);
  $("vs-tarjeta-sub").textContent = `comisión: ${fmt(comision)}`;
  $("vs-piezas").textContent = String(ventas.reduce((s, v) => s + v.cantidad, 0));

  lista.innerHTML = "";
  if (!ventas.length) {
    const hayAlgo = ventasSueltas().length > 0;
    lista.innerHTML = `<div class="empty-state"><div class="empty-ico">🧾</div><strong>${hayAlgo ? "Ninguna venta coincide" : "Aún no hay ventas rápidas"}</strong><span>${hayAlgo ? "Prueba con otro periodo, lugar o búsqueda." : "Las ventas que hagas con ⚡ Venta rápida o 🛍️ Modo bazar aparecerán aquí."}</span>${hayAlgo ? "" : '<button type="button" class="btn-primary" onclick="openVentaRapida()">⚡ Venta rápida</button>'}</div>`;
    return;
  }
  const LIMITE = 400;
  const visibles = [...ventas].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "") || b.id.localeCompare(a.id)).slice(0, LIMITE);
  const porDia = new Map();
  visibles.forEach(v => { if (!porDia.has(v.fecha)) porDia.set(v.fecha, []); porDia.get(v.fecha).push(v); });
  porDia.forEach((items, fecha) => {
    const cab = el("div", "vs-dia");
    cab.appendChild(el("span", "vs-dia-nombre", etiquetaDia(fecha)));
    cab.appendChild(el("b", "vs-dia-total", fmt(items.reduce((s, v) => s + monto(v), 0))));
    lista.appendChild(cab);
    items.forEach(v => {
      const fila = el("div", "vs-row");
      const main = el("div", "vs-main");
      const icono = v.tipo === "sticker" ? "✂️" : v.tipo === "consignacion" ? "🤝" : "👕";
      main.appendChild(el("span", "vs-name", `${icono} ${v.nombre}`));
      const b = v.bazarIds.length ? AppState.bazares.find(x => x.id === v.bazarIds[0]) : null;
      main.appendChild(el("span", "vs-meta", `${v.meta} · ${b ? "🏪 " + b.nombre : "Caja general"}${v.clienteId ? " · 👤 " + (clienteNombre(v.clienteId) || "Cliente") : ""}`));
      fila.appendChild(main);
      const mid = el("div", "vs-mid");
      mid.appendChild(el("span", "vs-qty", `${v.cantidad} × ${fmt(v.precio)}`));
      if (Math.abs(v.lista - v.precio) > 0.001) mid.appendChild(el("span", "vs-desc", `🏷️ ${v.lista > v.precio ? "−" : "+"}${fmt(Math.abs(v.lista - v.precio))} c/u vs. lista`));
      fila.appendChild(mid);
      const der = el("div", "vs-der");
      der.appendChild(el("b", "", fmt(monto(v))));
      der.appendChild(el("span", "vs-metodo", v.metodo === "Tarjeta" ? "💳 Tarjeta" : v.metodo === "Mixto" ? "💵💳 Mixto" : "💵 Efectivo"));
      fila.appendChild(der);
      const acciones = el("div", "vs-acciones");
      const bp = el("button", "qd-row-btn vs-precio", "Editar precio");
      bp.type = "button"; bp.dataset.precio = v.id; bp.dataset.tipo = v.tipo;
      acciones.appendChild(bp);
      if (v.tipo !== "consignacion") {
        const bc = el("button", "qd-row-btn vs-cliente", v.clienteId ? "Cambiar cliente" : "Cliente");
        bc.type = "button"; bc.dataset.cliente = v.id; bc.dataset.tipo = v.tipo;
        acciones.appendChild(bc);
      }
      const btn = el("button", "qd-row-btn vs-anular", "Anular");
      btn.type = "button"; btn.dataset.anular = v.id; btn.dataset.tipo = v.tipo;
      acciones.appendChild(btn);
      fila.appendChild(acciones);
      lista.appendChild(fila);
    });
  });
  if (ventas.length > LIMITE) lista.appendChild(el("p", "empty-hint", `Se muestran las ${LIMITE} ventas más recientes de ${ventas.length}. Usa los filtros para acotar.`));
}
async function pedirAnular(tipo, id) {
  const mensaje = "Se borrará esta venta y las piezas regresarán al stock. ¿Seguro?";
  const ok = typeof window.confirmPopup === "function"
    ? await window.confirmPopup({ title: "Anular venta", message: mensaje, confirmLabel: "Anular", danger: true })
    : confirm(mensaje);
  if (ok) anularVenta(tipo, id);
}
function iniciarHistorial() {
  ["vs-periodo", "vs-bazar", "vs-metodo"].forEach(id => { const x = $(id); if (x) x.addEventListener("change", renderVentasRapidas); });
  const b = $("vs-buscar");
  if (b) b.addEventListener("input", renderVentasRapidas);
  const lista = $("vs-lista");
  if (lista) lista.addEventListener("click", ev => {
    const a = ev.target.closest("[data-anular]");
    if (a) { pedirAnular(a.dataset.tipo, a.dataset.anular); return; }
    const c = ev.target.closest("[data-cliente]");
    if (c) { window.openModalAsignarCliente(c.dataset.cliente, c.dataset.tipo); return; }
    const p = ev.target.closest("[data-precio]");
    if (p) editarPrecioVenta(p.dataset.tipo, p.dataset.precio);
  });
}

/* ===============================================================
   3) BUSCADOR GLOBAL (Ctrl + K)
=============================================================== */
const PAGINAS = [
  ["inicio", "🏠", "Inicio"], ["cotizador", "🧮", "Cotizador"], ["cotizaciones", "📁", "Cotizaciones guardadas"],
  ["ventas-rapidas", "🧾", "Ventas rápidas"], ["clientes", "👥", "Clientes"], ["produccion", "🚦", "Producción (Kanban)"], ["artes", "🎨", "Historial de artes"],
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
  grupo("Playeras", tope(AppState.playeras.filter(p => !p.ventaRapida && coincide(p.nombre, p.talla, p.tipo, colorNombre(p.colorId))).map(p => ({
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
const PALETAS = [
  { id: "vampiro", nombre: "Vampiro / Contraste Alto", colores: { azul: "#000000", amarillo: "#FF0000", rojo: "#BC0202" } },
  { id: "cereza-nocturna", nombre: "Cereza Nocturna", colores: { azul: "#111F35", amarillo: "#F63049", rojo: "#D02752" } },
  { id: "menta-profunda", nombre: "Menta Profunda", colores: { azul: "#124170", amarillo: "#67C090", rojo: "#AAFFC7" } },
  { id: "lavanda-te", nombre: "Lavanda y Té", colores: { azul: "#281C59", amarillo: "#EDF7BD", rojo: "#4E8D9C" } },
  { id: "atardecer-purpura", nombre: "Atardecer Púrpura", colores: { azul: "#522D60", amarillo: "#FFD38B", rojo: "#F2A67B" } },
  { id: "bosque-esmeralda", nombre: "Bosque Esmeralda", colores: { azul: "#1F6F5F", amarillo: "#6FCF97", rojo: "#2FA084" } },
  { id: "magma-oscuro", nombre: "Magma Oscuro", colores: { azul: "#22092C", amarillo: "#F05941", rojo: "#BE3144" } },
  { id: "carmesi-neon", nombre: "Carmesí Neón", colores: { azul: "#00224D", amarillo: "#FF204E", rojo: "#A0153E" } },
  {
    id: "ciruela-mistica",
    nombre: "Ciruela Mística",
    colores: { azul: "#290044", amarillo: "#EEE3B0", rojo: "#D77FC4" },
    // Tonos exactos de esta paleta (el resto se calcula solo)
    tonos: {
      fondoHondo: "#1B0030", fondo: "#290044", tarjetas: "#500071", campos: "#8A2A78",
      textoSuave: "#EEE3B0", botones: "#EEE3B0", pestanas: "#D77FC4"
    }
  }
];
const ACENTO_KEY = "LUCXSTUDIO_ACENTO";
const PALETA_KEY = "LUCXSTUDIO_PALETA";
const COLORES_PERSONALIZADOS_KEY = "LUCXSTUDIO_COLORES_PERSONALIZADOS";
const COLORES_PERSONALIZADOS_DEFAULT = { azul: "#111113", amarillo: "#e3363d", rojo: "#e3363d" };
function hexARgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function limitar(n, min, max) { return Math.min(max, Math.max(min, n)); }
function hexAHsl(hex) {
  const [r, g, b] = hexARgb(hex).map(canal => canal / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), diferencia = max - min;
  const l = (max + min) / 2;
  const s = diferencia === 0 ? 0 : diferencia / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (diferencia !== 0) {
    if (max === r) h = ((g - b) / diferencia) % 6;
    else if (max === g) h = (b - r) / diferencia + 2;
    else h = (r - g) / diferencia + 4;
  }
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}
function hslAHex({ h, s, l }) {
  s = limitar(s, 0, 100) / 100;
  l = limitar(l, 0, 100) / 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const canal = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [canal(0), canal(8), canal(4)].map(valor => Math.round(valor * 255).toString(16).padStart(2, "0")).join("");
}
function esHexColor(valor) { return typeof valor === "string" && /^#[\da-f]{6}$/i.test(valor); }
function coloresPersonalizadosGuardados() {
  try {
    const guardados = JSON.parse(localStorage.getItem(COLORES_PERSONALIZADOS_KEY) || "null");
    return guardados && ["azul", "amarillo", "rojo"].every(clave => esHexColor(guardados[clave]))
      ? { azul: guardados.azul, amarillo: guardados.amarillo, rojo: guardados.rojo }
      : null;
  } catch (e) { return null; }
}
const ETIQUETAS_TONOS = [
  ["fondoHondo", "Fondo hondo"], ["fondo", "Fondo"], ["tarjetas", "Tarjetas"], ["campos", "Campos"],
  ["bordes", "Bordes"], ["textoSuave", "Texto suave"], ["amarilloClaro", "Amarillo claro"], ["botones", "Botones"],
  ["botonHover", "Botón al pasar"], ["rojoClaro", "Rojo claro"], ["pestanas", "Pestañas"], ["rojoOscuro", "Rojo oscuro"]
];
// Calcula las 12 tonalidades a partir de los 3 colores base. `fijos` permite forzar tonos exactos.
function calcularTonos(colores, fijos) {
  const azul = hexAHsl(colores.azul), amarillo = hexAHsl(colores.amarillo), rojo = hexAHsl(colores.rojo);
  const satBase = azul.s < 8 ? 0 : limitar(azul.s, 25, 70);   // fondos grises si el azul es casi neutro
  const fondo = (l, k) => hslAHex({ h: azul.h, s: satBase * k, l });
  const tinte = (color, ajuste, max) => hslAHex({ h: color.h, s: color.s, l: limitar(color.l + ajuste, 0, max) });
  return Object.assign({
    fondoHondo: fondo(2.5, 0.5), fondo: fondo(5.5, 0.55), tarjetas: fondo(9.5, 0.6), campos: fondo(14, 0.65),
    bordes: fondo(22, 0.7), textoSuave: fondo(74, 0.8),
    amarilloClaro: tinte(amarillo, 22, 88), botones: colores.amarillo, botonHover: tinte(amarillo, -12, 100),
    rojoClaro: tinte(rojo, 18, 85), pestanas: colores.rojo, rojoOscuro: tinte(rojo, -16, 100)
  }, fijos || {});
}
// Aplica TODAS las tonalidades como variables CSS (las usa el resto de la interfaz).
function aplicarTonos(t) {
  const r = document.documentElement.style;
  const set = (k, v) => r.setProperty(k, v);
  set("--color-bg-deep", t.fondoHondo);
  set("--color-bg", t.fondo);
  set("--color-surface", t.tarjetas);
  set("--color-surface-alt", t.campos);
  set("--color-input-bg", colorConOpacidad(t.campos, 0.45));
  set("--color-border", t.bordes);
  set("--color-text-muted", t.textoSuave);
  set("--color-accent", t.botones);
  set("--color-accent-dark", t.botonHover);
  set("--color-accent-light", t.amarilloClaro);
  set("--color-accent-soft", colorConOpacidad(t.botones, 0.15));
  set("--color-accent-contrast", colorTextoContraste(t.botones));
  set("--color-tabs", t.pestanas);
  set("--color-tabs-light", t.rojoClaro);
  set("--color-tabs-dark", t.rojoOscuro);
  set("--color-tab-soft", colorConOpacidad(t.pestanas, 0.15));
  set("--color-danger", "#e3363d");
  set("--color-danger-soft", "rgba(227,54,61,.15)");
  r.removeProperty("--appearance-deep-bg");
}
// Tonalidades del modo activo (colores propios, paleta o acento).
function tonosActuales() {
  const propios = coloresPersonalizadosGuardados();
  if (propios) return calcularTonos(propios);
  const paleta = PALETAS.find(item => item.id === paletaGuardada());
  if (paleta) return calcularTonos(paleta.colores, paleta.tonos);
  const acento = ACENTOS.find(item => item.id === acentoGuardado()) || ACENTOS[0];
  return calcularTonos({ azul: "#121214", amarillo: acento.hex, rojo: acento.hex }, {
    fondoHondo: "#121214", fondo: "#121214", tarjetas: "#1b1b1e", campos: "#232327", bordes: "#313136", textoSuave: "#a3a1a6"
  });
}
function tonosDerivados(colores, fijos) {
  const t = calcularTonos(colores, fijos);
  return ETIQUETAS_TONOS.map(([clave, nombre]) => [nombre, t[clave]]);
}
function coloresEditorActuales() {
  const personalizados = coloresPersonalizadosGuardados();
  if (personalizados) return personalizados;
  const paleta = PALETAS.find(item => item.id === paletaGuardada());
  if (paleta) return { azul: paleta.colores.azul, amarillo: paleta.colores.amarillo, rojo: paleta.colores.rojo };
  const acento = ACENTOS.find(item => item.id === acentoGuardado()) || ACENTOS[0];
  return { ...COLORES_PERSONALIZADOS_DEFAULT, rojo: acento.hex };
}
function aplicarColoresPersonalizados(colores) {
  aplicarTonos(calcularTonos(colores));
}
function renderTonosApariencia(colores, fijos) {
  const contenedor = $("appearance-tones");
  if (!contenedor) return;
  const tonos = colores ? calcularTonos(colores, fijos) : tonosActuales();
  contenedor.replaceChildren();
  ETIQUETAS_TONOS.forEach(([clave, nombre]) => {
    const hex = tonos[clave];
    const tono = el("span", "appearance-tone");
    tono.style.backgroundColor = hex;
    tono.style.color = colorTextoContraste(hex);
    tono.title = `${nombre}: ${hex}`;
    tono.appendChild(el("span", "", nombre));
    tono.appendChild(el("small", "", hex.toUpperCase()));
    contenedor.appendChild(tono);
  });
}
function actualizarVistaPreviaApariencia() {
  const colores = {
    azul: $("appearance-color-blue").value,
    amarillo: $("appearance-color-yellow").value,
    rojo: $("appearance-color-red").value
  };
  renderTonosApariencia(colores);
  const boton = $("appearance-preview-button");
  boton.style.backgroundColor = colores.amarillo;
  boton.style.color = colorTextoContraste(colores.amarillo);
  const pestanaActiva = $("appearance-preview-active-tab");
  pestanaActiva.style.color = colores.rojo;
  pestanaActiva.style.borderBottomColor = colores.rojo;
  pestanaActiva.style.backgroundColor = colorConOpacidad(colores.rojo, 0.14);
  const pestana = $("appearance-preview-tab");
  pestana.style.color = colores.azul;
  pestana.style.borderColor = colores.azul;
}
function cargarColoresEditor(colores = coloresEditorActuales()) {
  $("appearance-color-blue").value = colores.azul;
  $("appearance-color-yellow").value = colores.amarillo;
  $("appearance-color-red").value = colores.rojo;
  actualizarVistaPreviaApariencia();
}
function iniciarEditorApariencia() {
  const entradas = ["appearance-color-blue", "appearance-color-yellow", "appearance-color-red"];
  entradas.forEach(id => $(id).addEventListener("input", actualizarVistaPreviaApariencia));
  cargarColoresEditor();
  renderTonosApariencia();
  $("appearance-save").addEventListener("click", () => {
    const colores = {
      azul: $("appearance-color-blue").value,
      amarillo: $("appearance-color-yellow").value,
      rojo: $("appearance-color-red").value
    };
    if (!Object.values(colores).every(esHexColor)) {
      showToast("Elige colores válidos para aplicar la paleta.", "error");
      return;
    }
    try {
      localStorage.setItem(COLORES_PERSONALIZADOS_KEY, JSON.stringify(colores));
      localStorage.removeItem(PALETA_KEY);
      localStorage.removeItem(ACENTO_KEY);
    } catch (e) {
      showToast("No se pudieron guardar los colores en este navegador.", "error");
      return;
    }
    aplicarColoresPersonalizados(colores);
    renderPaletas();
    renderAcentos();
    showToast("Colores guardados.");
  });
  $("appearance-reset").addEventListener("click", () => {
    try {
      localStorage.removeItem(COLORES_PERSONALIZADOS_KEY);
      localStorage.removeItem(PALETA_KEY);
      localStorage.setItem(ACENTO_KEY, "rojo");
    } catch (e) {
      showToast("No se pudieron restablecer los colores guardados.", "error");
      return;
    }
    aplicarAcento("rojo");
    cargarColoresEditor(COLORES_PERSONALIZADOS_DEFAULT);
    renderPaletas();
    renderAcentos();
    showToast("Se restableció el color de acento original.");
  });
}
function oscurecer(hex, f) {
  const [r, g, b] = hexARgb(hex).map(v => Math.round(v * (1 - f)));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function aclarar(hex, f) {
  const [r, g, b] = hexARgb(hex).map(v => Math.round(v + (255 - v) * f));
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function colorTextoContraste(hex) {
  const luminancia = hexARgb(hex).map(v => {
    const canal = v / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  }).reduce((suma, canal, index) => suma + canal * [0.2126, 0.7152, 0.0722][index], 0);
  const contrasteClaro = 1.05 / (luminancia + 0.05);
  const contrasteOscuro = (luminancia + 0.05) / 0.05;
  return contrasteOscuro > contrasteClaro ? "#17161a" : "#ffffff";
}
function colorConOpacidad(hex, alpha) {
  const [r, g, b] = hexARgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
function paletaGuardada() {
  try {
    const id = localStorage.getItem(PALETA_KEY);
    return PALETAS.some(paleta => paleta.id === id) ? id : "";
  } catch (e) { return ""; }
}
function aplicarAcento(id) {
  const a = ACENTOS.find(x => x.id === id) || ACENTOS[0];
  const root = document.documentElement.style;
  ["--appearance-deep-bg", "--color-bg-deep", "--color-accent-light", "--color-tabs-light", "--color-tabs-dark"]
    .forEach(p => root.removeProperty(p));
  root.setProperty("--color-bg", "#121214");
  root.setProperty("--color-surface", "#1b1b1e");
  root.setProperty("--color-surface-alt", "#232327");
  root.setProperty("--color-border", "#313136");
  root.setProperty("--color-input-bg", "rgba(255,255,255,.04)");
  root.setProperty("--color-text-muted", "#a3a1a6");
  root.setProperty("--color-danger", "#e3363d");
  root.setProperty("--color-danger-soft", "rgba(227,54,61,.15)");
  root.setProperty("--color-accent", a.hex);
  root.setProperty("--color-accent-dark", oscurecer(a.hex, 0.22));
  root.setProperty("--color-accent-soft", colorConOpacidad(a.hex, 0.15));
  root.setProperty("--color-accent-contrast", colorTextoContraste(a.hex));
  root.setProperty("--color-tabs", a.hex);
  root.setProperty("--color-tab-soft", colorConOpacidad(a.hex, 0.15));
  return a.id;
}
function aplicarPaleta(id) {
  const paleta = PALETAS.find(item => item.id === id);
  if (!paleta) return "";
  aplicarTonos(calcularTonos(paleta.colores, paleta.tonos));
  return paleta.id;
}
function acentoGuardado() { try { return localStorage.getItem(ACENTO_KEY) || "rojo"; } catch (e) { return "rojo"; } }
function renderPaletas() {
  const cont = $("palette-swatches");
  if (!cont) return;
  const actual = paletaGuardada();
  cont.innerHTML = "";
  PALETAS.forEach(paleta => {
    const b = el("button", "palette-swatch" + (paleta.id === actual ? " active" : ""));
    b.type = "button";
    b.setAttribute("aria-label", paleta.nombre);
    b.setAttribute("aria-pressed", String(paleta.id === actual));
    b.title = paleta.nombre;
    const muestras = el("span", "palette-colors");
    ["azul", "amarillo", "rojo"].forEach(nombre => {
      const punto = el("span", "palette-color");
      punto.style.background = paleta.colores[nombre];
      punto.setAttribute("aria-hidden", "true");
      muestras.appendChild(punto);
    });
    b.appendChild(muestras);
    b.appendChild(el("span", "accent-name", paleta.nombre));
    b.addEventListener("click", () => {
      aplicarPaleta(paleta.id);
      try {
        localStorage.setItem(PALETA_KEY, paleta.id);
        localStorage.removeItem(COLORES_PERSONALIZADOS_KEY);
      } catch (e) { /* sin almacenamiento */ }
      cargarColoresEditor({ azul: paleta.colores.azul, amarillo: paleta.colores.amarillo, rojo: paleta.colores.rojo });
      renderTonosApariencia();
      renderPaletas();
      renderAcentos();
    });
    cont.appendChild(b);
  });
}
function renderAcentos() {
  const cont = $("accent-swatches");
  if (!cont) return;
  const actual = acentoGuardado();
  const paletaActiva = paletaGuardada();
  const coloresPersonalizados = !!coloresPersonalizadosGuardados();
  cont.innerHTML = "";
  ACENTOS.forEach(a => {
    const b = el("button", "accent-swatch" + (!paletaActiva && !coloresPersonalizados && a.id === actual ? " active" : ""));
    b.type = "button";
    b.setAttribute("aria-label", a.nombre);
    b.setAttribute("aria-pressed", String(!paletaActiva && !coloresPersonalizados && a.id === actual));
    b.title = a.nombre;
    const punto = el("span", "accent-dot");
    punto.style.background = a.hex;
    b.appendChild(punto);
    b.appendChild(el("span", "accent-name", a.nombre));
    b.addEventListener("click", () => {
      aplicarAcento(a.id);
      try {
        localStorage.setItem(ACENTO_KEY, a.id);
        localStorage.removeItem(PALETA_KEY);
        localStorage.removeItem(COLORES_PERSONALIZADOS_KEY);
      } catch (e) { /* sin almacenamiento */ }
      cargarColoresEditor({ ...COLORES_PERSONALIZADOS_DEFAULT, rojo: a.hex });
      renderTonosApariencia();
      renderPaletas();
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
    bazaresOrdenados().forEach(b => {
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
  iniciarHistorial();
  const coloresPersonalizados = coloresPersonalizadosGuardados();
  if (coloresPersonalizados) aplicarColoresPersonalizados(coloresPersonalizados);
  else if (!aplicarPaleta(paletaGuardada())) aplicarAcento(acentoGuardado());
  renderPaletas();
  renderAcentos();
  iniciarEditorApariencia();
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

Object.assign(window, { openVentaRapida, openModoBazar, abrirBuscador, renderVentasRapidas, anularVenta, editarPrecioVenta });
