/* ============================================================
   LUCXSTUDIO — calculator.js
   Lógica financiera, áreas, márgenes y comisiones.
   Ninguna función de este archivo toca el DOM.
   ============================================================ */
import { AppState } from "./storage.js";

/* ---------------------------------------------------------------
   FORMATO Y ESCAPADO (helpers puros de texto)
--------------------------------------------------------------- */
export function fmt(n) {
  const val = Number(n) || 0;
  return "$" + val.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

/* ---------------------------------------------------------------
   CÁLCULO DE COSTOS DTF
   costo_cm2 = precio_metro_dtf / (100 * ancho_rollo_cm)
   costo_estampado = ancho * largo * costo_cm2 * num_estampados
--------------------------------------------------------------- */
export function costoPorCm2(especial) {
  const s = AppState.settings;
  if (!s.dtfAnchoRolloCm) return 0;
  const precio = especial ? (s.dtfPrecioMetroEspecial || s.dtfPrecioMetro) : s.dtfPrecioMetro;
  return precio / (100 * s.dtfAnchoRolloCm);
}
// Área total (cm²) de una lista de estampados [{anchoCm, largoCm}, ...] — permite que cada
// estampado de una misma prenda tenga su propio tamaño (p.ej. uno chico al frente y uno grande atrás).
export function areaTotalCm2(estampados) {
  return (estampados || []).reduce((sum, e) => sum + (e.anchoCm || 0) * (e.largoCm || 0), 0);
}
export function costoEstampado(estampados, especial) {
  return areaTotalCm2(estampados) * costoPorCm2(especial);
}
// Costo de un Gang Sheet: se cobra por metro lineal (el blanco sólido usa un precio más alto
// porque consume mucha más tinta blanca).
export function costoGangSheet(metros, blancoSolido) {
  const s = AppState.settings;
  const precio = blancoSolido ? (s.gangSheetBlancoSolidoPrecioMetro || 0) : (s.gangSheetPrecioMetro || 0);
  return (metros || 0) * precio;
}
// Sobrecargo por talla 2XL o mayor (en esta tienda: XXG, XXXG... o 2XL, 3XL, XXL...).
export function sobrecargoTalla(talla) {
  if (!talla) return 0;
  const t = String(talla).trim().toUpperCase();
  const esGrandeExtra = /^(XX+G|XX+L|[2-9]X(G|L))$/.test(t);
  return esGrandeExtra ? (AppState.settings.sobrecargo2XLMonto || 0) : 0;
}
// Costo de impresión de una prenda/item, respetando su modo de costeo:
// "area" (DTF por área, normal o especial) o "gangsheet" (por metro lineal).
export function costoImpresion(obj) {
  if (obj.modoCosteo === "gangsheet") {
    return costoGangSheet(obj.gangSheetMetros, obj.gangSheetBlancoSolido);
  }
  return costoEstampado(obj.estampados, obj.dtfEspecial);
}
export function costoTotalPlayera(playera) {
  const costoBase = playera.prendaCliente ? 0 : (playera.costoPlayera || 0);
  return costoBase + costoImpresion(playera) + sobrecargoTalla(playera.talla);
}
// Devuelve el costo de impresión a usar para una prenda del cotizador: si hay más de un
// estampado (modo área) y el usuario lo editó manualmente, se respeta ese valor; si no, se
// calcula con la fórmula de área × costo DTF, o con el costo de Gang Sheet si aplica.
export function getCostoEstampadoEfectivo(item) {
  if (item.modoCosteo !== "gangsheet") {
    const numEstampados = (item.estampados || []).length;
    if (numEstampados > 1 && item.costoEstampadoManual !== null && item.costoEstampadoManual !== undefined) {
      return item.costoEstampadoManual;
    }
  }
  return costoImpresion(item);
}
// Costo unitario completo de una prenda del cotizador: costo de playera (0 si es prenda del
// cliente) + costo de impresión efectivo + sobrecargo de talla 2XL+.
export function costoUnitarioItem(item) {
  const costoBase = item.prendaCliente ? 0 : (item.costoPlayera || 0);
  return costoBase + getCostoEstampadoEfectivo(item) + sobrecargoTalla(item.talla);
}

/* ---------------------------------------------------------------
   COLORES (lookups puros)
--------------------------------------------------------------- */
export function colorNombre(colorId) {
  const c = AppState.colores.find(x => x.id === colorId);
  return c ? c.nombre : "—";
}
export function colorHex(colorId) {
  const c = AppState.colores.find(x => x.id === colorId);
  return c ? c.hex : "#8b8b93";
}

/* ---------------------------------------------------------------
   BADGES (clases CSS según estado, sin tocar el DOM)
--------------------------------------------------------------- */
export function estadoBadgeClass(estado) {
  if (estado === "En stock") return "badge-stock";
  if (estado === "En proceso") return "badge-proceso";
  return "badge-agotado";
}
export function prioridadBadgeClass(p) {
  if (p === "Alta") return "badge-alta";
  if (p === "Media") return "badge-media";
  return "badge-baja";
}
export function bazarEstadoBadgeClass(estado) {
  if (estado === "Vendida") return "badge-agotado";
  return "badge-stock";
}

/* ---------------------------------------------------------------
   BAZARES: relaciones registro↔bazar y métricas
--------------------------------------------------------------- */
export function bazarNombre(bazarId) {
  const b = AppState.bazares.find(x => x.id === bazarId);
  return b ? b.nombre : "Sin bazar asignado";
}
export function bazarIdsDe(registro) {
  return registro.bazarIds || (registro.bazarId ? [registro.bazarId] : []);
}
export function bazarTiene(registro, bazarId) {
  return bazarIdsDe(registro).includes(bazarId);
}
export function nombresBazares(registro) {
  return bazarIdsDe(registro).map(bazarId => bazarNombre(bazarId)).filter(Boolean).join(", ");
}
export function getBazarVentasYGanancia(bazarId) {
  const cotsAsignadas = AppState.cotizaciones.filter(c => bazarTiene(c, bazarId));
  const cots = cotsAsignadas.filter(c => !c.ventaNula);
  const perdidaCotsNulas = cotsAsignadas.filter(c => c.ventaNula).reduce((s, c) => s + (c.totalCosto || 0), 0);
  const totalVendidoCots = cots.reduce((s, c) => s + c.totalVenta, 0);
  const gananciaVentasCots = cots.reduce((s, c) => s + c.ganancia, 0);

  const playerasAsignadas = AppState.playeras.filter(p => bazarTiene(p, bazarId) && (p.stock || 0) > 0);
  const totalVendidoPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    return s + ((p.precioVenta || 0) * (p.stock || 0));
  }, 0);
  const gananciaVentasPlayeras = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return s;
    const costoTotalUnit = costoTotalPlayera(p);
    return s + ((p.precioVenta || 0) - costoTotalUnit) * (p.stock || 0);
  }, 0);
  const perdidaPlayerasNulas = playerasAsignadas.reduce((s, p) => {
    if ((p.bazarEstado || "Disponible") !== "Venta nula") return s;
    return s + costoTotalPlayera(p) * (p.stock || 0);
  }, 0);

  return {
    totalVendido: totalVendidoCots + totalVendidoPlayeras,
    gananciaVentas: gananciaVentasCots + gananciaVentasPlayeras - perdidaCotsNulas - perdidaPlayerasNulas,
    cotsCount: cotsAsignadas.length + playerasAsignadas.length
  };
}

/* ---------------------------------------------------------------
   DATOS PARA GRÁFICAS (agregaciones puras sobre AppState)
--------------------------------------------------------------- */
export function datosGrafica(fuente, dimension, metrica) {
  const validCots = AppState.cotizaciones.filter(c => !c.ventaNula);
  if (fuente === "ventas-bazares" || fuente === "ganancias-bazares") {
    const labels = AppState.bazares.map(b => b.nombre);
    const values = AppState.bazares.map(b => {
      const stats = getBazarVentasYGanancia(b.id);
      return fuente === "ventas-bazares" ? stats.totalVendido : stats.gananciaVentas;
    });
    return { labels, values, label: fuente === "ventas-bazares" ? "Ventas ($)" : "Ganancia ($)" };
  }
  if (fuente === "tipo-venta") {
    return {
      labels: ["Menudeo", "Mayoreo"],
      values: [
        validCots.filter(c => c.tipoVenta !== "Mayoreo").reduce((s, c) => s + c.totalVenta, 0),
        validCots.filter(c => c.tipoVenta === "Mayoreo").reduce((s, c) => s + c.totalVenta, 0)
      ],
      label: "Ventas ($)"
    };
  }
  if (fuente === "estado-playeras") {
    const cantidades = { Vendida: 0, Disponible: 0, "Venta nula": 0 };
    AppState.playeras.forEach(p => {
      const estado = p.bazarEstado || "Disponible";
      cantidades[estado] = (cantidades[estado] || 0) + (p.stock || 0);
    });
    return { labels: Object.keys(cantidades), values: Object.values(cantidades), label: "Playeras" };
  }
  if (fuente === "inventario") {
    return datosInventarioGrafica(dimension || "etiqueta", metrica || "stock");
  }
  const costoCotizaciones = AppState.cotizaciones.filter(c => c.ventaNula).reduce((s, c) => s + (c.totalCosto || 0), 0);
  const costoPlayeras = AppState.playeras.filter(p => p.bazarEstado === "Venta nula")
    .reduce((s, p) => s + costoTotalPlayera(p) * (p.stock || 0), 0);
  return { labels: ["Cotizaciones", "Playeras"], values: [costoCotizaciones, costoPlayeras], label: "Costo perdido ($)" };
}

export function datosInventarioGrafica(dimension, metrica) {
  const grupos = {};
  const agregar = (grupo, playera) => {
    const cantidad = playera.stock || 0;
    const costo = costoTotalPlayera(playera) * cantidad;
    const ventas = (playera.precioVenta || 0) * cantidad;
    const ganancia = (playera.precioVenta - costoTotalPlayera(playera)) * cantidad;
    grupos[grupo] = (grupos[grupo] || 0) + ({ stock: cantidad, costo, ventas, ganancia }[metrica] || 0);
  };
  AppState.playeras.forEach(playera => {
    if (dimension === "etiqueta") {
      const etiquetas = (playera.tags || []).map(tagId => {
        const etiqueta = AppState.etiquetas.find(item => item.id === tagId);
        return etiqueta ? etiqueta.nombre : "Sin etiqueta";
      });
      (etiquetas.length ? etiquetas : ["Sin etiqueta"]).forEach(etiqueta => agregar(etiqueta, playera));
      return;
    }
    const valores = {
      color: colorNombre(playera.colorId),
      talla: playera.talla || "Sin talla",
      tipo: playera.tipo || "Sin tipo",
      prioridad: playera.prioridad || "Sin prioridad",
      estado: playera.estado || "Sin estado"
    };
    agregar(valores[dimension] || "Sin dato", playera);
  });
  const labels = Object.keys(grupos);
  const metricLabels = { stock: "Piezas", costo: "Costo ($)", ventas: "Venta potencial ($)", ganancia: "Ganancia potencial ($)" };
  return { labels, values: labels.map(label => grupos[label]), label: metricLabels[metrica] || "Inventario" };
}

/* ---------------------------------------------------------------
   PRODUCCIÓN: SEMÁFORO
   Verde = a tiempo o entregado, Amarillo = con antigüedad, Rojo =
   urgente o atrasado (3+ días sin completarse).
--------------------------------------------------------------- */
export function semaforoCotizacion(c) {
  if (c.estadoProduccion === "Entregado") return { color: "green", label: "Entregado" };
  const hoy = new Date();
  const fecha = new Date((c.fecha || "") + "T00:00:00");
  const diffDias = isNaN(fecha.getTime()) ? 0 : Math.floor((hoy - fecha) / (1000 * 60 * 60 * 24));
  if (c.urgente || diffDias >= 3) return { color: "red", label: c.urgente ? "Urgente" : "Atrasado" };
  if (diffDias >= 1) return { color: "yellow", label: "En proceso" };
  return { color: "green", label: "A tiempo" };
}

/* ---------------------------------------------------------------
   HISTORIAL DE CLIENTES
   Agrupa las cotizaciones por nombre de cliente (sin distinguir
   mayúsculas/espacios) para ver su historial de compras.
--------------------------------------------------------------- */
export function agruparClientes() {
  const grupos = {};
  AppState.cotizaciones.forEach(c => {
    const nombre = (c.cliente || "Cliente sin nombre").trim() || "Cliente sin nombre";
    const key = nombre.toLowerCase();
    if (!grupos[key]) grupos[key] = { nombre, pedidos: 0, totalGastado: 0, ultimaFecha: c.fecha || "", cotizacionIds: [] };
    grupos[key].pedidos += 1;
    if (!c.ventaNula) grupos[key].totalGastado += c.totalVenta || 0;
    if ((c.fecha || "") > grupos[key].ultimaFecha) grupos[key].ultimaFecha = c.fecha;
    grupos[key].cotizacionIds.push(c.id);
  });
  return Object.values(grupos).sort((a, b) => b.totalGastado - a.totalGastado);
}

/* ---------------------------------------------------------------
   HISTORIAL DE ARTES (diseños)
   Agrupa por nombre de diseño lo vendido en cotizaciones y las
   playeras marcadas como "Vendida" directamente en un bazar.
--------------------------------------------------------------- */
export function agruparArtes() {
  const grupos = {};
  const agregar = (nombre, piezas, monto, ganancia) => {
    const key = (nombre || "Sin nombre").trim() || "Sin nombre";
    if (!grupos[key]) grupos[key] = { nombre: key, piezas: 0, totalVendido: 0, ganancia: 0 };
    grupos[key].piezas += piezas;
    grupos[key].totalVendido += monto;
    grupos[key].ganancia += ganancia;
  };
  AppState.cotizaciones.filter(c => !c.ventaNula).forEach(c => {
    (c.items || []).forEach(item => {
      const costoUnit = costoUnitarioItem(item);
      const monto = (item.precioVenta || 0) * (item.cantidad || 0);
      const ganancia = ((item.precioVenta || 0) - costoUnit) * (item.cantidad || 0);
      agregar(item.nombre, item.cantidad || 0, monto, ganancia);
    });
  });
  AppState.playeras.forEach(p => {
    if ((p.bazarEstado || "Disponible") !== "Vendida") return;
    const monto = (p.precioVenta || 0) * (p.stock || 0);
    const ganancia = ((p.precioVenta || 0) - costoTotalPlayera(p)) * (p.stock || 0);
    agregar(p.nombre, p.stock || 0, monto, ganancia);
  });
  return Object.values(grupos).sort((a, b) => b.totalVendido - a.totalVendido);
}
