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
export function costoPorCm2() {
  const s = AppState.settings;
  if (!s.dtfAnchoRolloCm) return 0;
  return s.dtfPrecioMetro / (100 * s.dtfAnchoRolloCm);
}
export function costoEstampado(anchoCm, largoCm, numEstampados) {
  return (anchoCm || 0) * (largoCm || 0) * costoPorCm2() * (numEstampados || 1);
}
export function costoTotalPlayera(playera) {
  return (playera.costoPlayera || 0) + costoEstampado(playera.anchoCm || 0, playera.largoCm || 0, playera.numEstampados || 1);
}
// Devuelve el costo de estampado a usar: si hay más de un estampado y el usuario lo editó
// manualmente, se respeta ese valor; si no, se calcula con la fórmula de área × costo DTF.
export function getCostoEstampadoEfectivo(item) {
  if (item.numEstampados > 1 && item.costoEstampadoManual !== null && item.costoEstampadoManual !== undefined) {
    return item.costoEstampadoManual;
  }
  return costoEstampado(item.anchoCm, item.largoCm, item.numEstampados);
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
