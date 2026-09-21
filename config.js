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
      dtfPrecioMetroEspecial: 260,
      dtfAnchoRolloCm: 58,
      sobrecargo2XLMonto: 15,
      stockMinimoDefault: 2,
      gangSheetPrecioMetro: 190,
      gangSheetBlancoSolidoPrecioMetro: 230,
      recargoUrgentePct: 20,
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
    proveedores: [],
    gastos: [],
    comprasPendientes: [],
    etiquetasOperativas: [
      { id: "eo1", nombre: "Urgente", color: "#e3363d" },
      { id: "eo2", nombre: "Retrabajo", color: "#e0a23a" },
      { id: "eo3", nombre: "Cliente VIP", color: "#c56bdb" },
      { id: "eo4", nombre: "Pendiente de pago", color: "#8b8b93" }
    ],
    recommendedChartStyles: {}
  };
}

/* ---------------------------------------------------------------
   TIPOS DE PRENDA (compartido entre inventario y cotizador)
--------------------------------------------------------------- */
export const TIPOS_PRENDA = [
  "Playera", "Playera Oversize", "Manga larga", "Sudadera", "Cuello V Mujer",
  "Cuello V Hombre", "Sudadera sin capucha", "Playera de tirantes",
  "Playera sin mangas", "Corte de Relog", "Niños", "Bolsa Sorpresa"
];

/* ---------------------------------------------------------------
   GASTOS GENERALES DEL NEGOCIO
--------------------------------------------------------------- */
export const GASTOS_CATEGORIAS = [
  "Materiales", "DTF / Insumos de impresión", "Herramientas y equipo",
  "Renta", "Servicios", "Transporte", "Empaque", "Publicidad", "Otro"
];

/* ---------------------------------------------------------------
   TIPOS DE GASTO DE UN BAZAR
   "produccion" = material/DTF/playeras que compraste para hacer las
   piezas (aunque ya estén costeadas por área en cada playera, aquí
   se anota lo que REALMENTE pagaste, para tu control de efectivo).
   "evento" = costo de estar en el bazar (puesto, transporte, etc).
   Ambos se suman siempre al costo real del bazar; la etiqueta es
   solo para que veas el desglose, nunca deja de contarse ninguno.
--------------------------------------------------------------- */
export const GASTOS_BAZAR_TIPOS = [
  { id: "produccion", label: "🧵 Producción (material / DTF)" },
  { id: "evento", label: "🎪 Evento (puesto / transporte)" }
];

/* ---------------------------------------------------------------
   PRODUCCIÓN (semáforo Kanban)
--------------------------------------------------------------- */
export const ETAPAS_PRODUCCION = ["Por hacer", "En DTF", "Armando", "Listo", "Entregado"];

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
  finanzas: "Gastos y compras pendientes",
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
