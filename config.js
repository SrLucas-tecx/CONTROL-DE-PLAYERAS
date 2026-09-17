/* ============================================================
   LUCXSTUDIO — config.js
   Variables globales, tabuladores, catálogos fijos
   ============================================================ */

export const STORAGE_KEY = "LUCXSTUDIO_APP_STATE";

/* ---------------------------------------------------------------
   ESTADO INICIAL
--------------------------------------------------------------- */
export function defaultState() {
  return {
    settings: {
      dtfPrecioMetro: 190,
      dtfAnchoRolloCm: 58,
      moneda: "MXN"
    },
    colores: [
      { id: "c1", nombre: "Negro", hex: "#111113" },
      { id: "c2", nombre: "Rojo", hex: "#c0242c" },
      { id: "c3", nombre: "Gris", hex: "#8b8b93" },
      { id: "c4", nombre: "Blanco", hex: "#f2f0ee" }
    ],
    etiquetas: [
      { id: "e1", nombre: "Anime", color: "#e3363d" },
      { id: "e2", nombre: "Oversize", color: "#8b8b93" },
      { id: "e3", nombre: "Bolsa sorpresa", color: "#e0a23a" }
    ],
    tallaEtiquetas: [
      { id: "te1", talla: "CH", color: "Negro", cantidad: 0 },
      { id: "te2", talla: "MD", color: "Negro", cantidad: 0 },
      { id: "te3", talla: "G", color: "Negro", cantidad: 0 },
      { id: "te4", talla: "CH", color: "Blanco", cantidad: 0 },
      { id: "te5", talla: "MD", color: "Blanco", cantidad: 0 },
      { id: "te6", talla: "G", color: "Blanco", cantidad: 0 }
    ],
    playeras: [],
    stickers: [],
    artistas: [
      { id: "a1", nombre: "SrLucas", modo: "ninguno", pctArtista: 0, pctEstudio: 100, notas: "Estudio principal" },
      { id: "a2", nombre: "Obake", modo: "venta", pctArtista: 30, pctEstudio: 70, notas: "" }
    ],
    bazares: [],
    cotizaciones: [],
    graficas: [],
    recommendedChartStyles: {}
  };
}

/* ---------------------------------------------------------------
   ARTISTAS / COMISIONES
--------------------------------------------------------------- */
export const ARTIST_PRESETS = {
  ninguno:      { pctArtista: 0,  pctEstudio: 100 },
  venta:        { pctArtista: 30, pctEstudio: 70 },
  diseno:       { pctArtista: 35, pctEstudio: 65 },
  disenoventa:  { pctArtista: 40, pctEstudio: 60 }
};
export const ARTIST_MODE_LABEL = {
  ninguno: "Sin comisión", venta: "Solo venta", diseno: "Diseño propio",
  disenoventa: "Diseño propio + venta", personalizado: "Personalizado"
};

/* ---------------------------------------------------------------
   RESPALDOS POR SECCIÓN
--------------------------------------------------------------- */
export const SECTION_LABELS = {
  cotizaciones: "Cotizaciones",
  inventario: "Inventario",
  catalogo: "Catalogo",
  bazares: "Bazares",
  reportes: "Reportes",
  ajustes: "Ajustes"
};

/* ---------------------------------------------------------------
   GRÁFICAS RECOMENDADAS
--------------------------------------------------------------- */
export const RECOMMENDED_COMBINATIONS = [
  { id: "etiqueta-ganancia", title: "Etiqueta + ganancia", description: "Identifica las etiquetas que dejan más ganancia potencial.", fuente: "inventario", dimension: "etiqueta", metrica: "ganancia", tipo: "bar" },
  { id: "color-ventas", title: "Color + ventas", description: "Descubre qué colores tienen mayor venta potencial.", fuente: "inventario", dimension: "color", metrica: "ventas", tipo: "bar" },
  { id: "talla-stock", title: "Talla + stock", description: "Detecta las tallas que debes reponer o producir.", fuente: "inventario", dimension: "talla", metrica: "stock", tipo: "bar" },
  { id: "prioridad-ganancia", title: "Prioridad + ganancia", description: "Comprueba si tus diseños prioritarios realmente son rentables.", fuente: "inventario", dimension: "prioridad", metrica: "ganancia", tipo: "bar" },
  { id: "bazar-ganancia", title: "Bazar + ganancia", description: "Compara en qué bazares te conviene vender.", fuente: "ganancias-bazares", tipo: "bar" },
  { id: "tipo-venta", title: "Tipo de venta + ingreso", description: "Compara si te conviene vender más en menudeo o mayoreo.", fuente: "tipo-venta", tipo: "doughnut" }
];
export const RECOMMENDED_PALETTES = {
  accent: ["#e3363d", "#b91f26", "#e0a23a", "#8b8b93", "#3fb87f", "#5d8bd8"],
  fresh: ["#3fb87f", "#5d8bd8", "#e0a23a", "#e3363d", "#8b8b93", "#c56bdb"],
  mono: ["#424247", "#5b5b63", "#74747d", "#8b8b93", "#a6a6ad", "#c1c1c5"]
};
