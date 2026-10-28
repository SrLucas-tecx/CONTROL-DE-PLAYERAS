import { GUIA_TALLAS_DEFAULTS } from "./config.js";
import { AppState, saveState } from "./storage.js";
import { showToast } from "./ui.js";

const TALLAS_KEY = "guiaTallasMulti";
let prendaActual = "playera"; // Opciones: 'playera', 'dama', 'oversize', 'cuello_v', 'manga_larga', 'polo', 'sudadera_crew', 'sudadera_hoodie'

// Catálogo de prendas con diagramas y medidas oficiales convertidas a centímetros
const PRENDAS_DATOS = {
  playera: {
    nombre: "Playera Unisex",
    subtitulo: "Corte clásico unisex",
    tallas: [
      { talla: "CHI", ancho: 45.7, largo: 70.5 },
      { talla: "MED", ancho: 50.8, largo: 73.0 },
      { talla: "GDE", ancho: 55.9, largo: 75.6 },
      { talla: "EXG", ancho: 61.0, largo: 78.1 },
      { talla: "2EG", ancho: 66.0, largo: 80.6 },
      { talla: "3EG", ancho: 69.9, largo: 83.2 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M95 30 L65 42 L35 60 L12 105 L40 128 L62 110 L62 250 Q140 260 218 250 L218 110 L240 128 L268 105 L245 60 L215 42 L185 30 Q180 55 140 55 T95 30 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M95 30 Q140 62 185 30 M98 34 Q140 54 182 34" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M64 125 H216" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 33 V248" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="78" cy="112" r="11" fill="#0b3674"/><text x="78" y="116" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="85" r="11" fill="#0b3674"/><text x="152" y="89" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  dama: {
    nombre: "Playera Corte Dama",
    subtitulo: "Corte siluetado para mujer",
    tallas: [
      { talla: "CHI", ancho: 43.2, largo: 62.2 },
      { talla: "MED", ancho: 47.0, largo: 64.1 },
      { talla: "GDE", ancho: 50.8, largo: 66.0 },
      { talla: "EXG", ancho: 54.6, largo: 67.9 },
      { talla: "2EG", ancho: 69.9, largo: 69.9 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M98 32 L72 45 L45 62 L22 102 L48 122 L68 108 C66 140 76 180 72 248 Q140 256 208 248 C204 180 214 140 212 108 L232 122 L258 102 L235 62 L208 45 L182 32 Q176 58 140 58 T98 32 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M98 32 Q140 60 182 32 M100 36 Q140 52 180 36" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M70 120 H210" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 35 V246" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="82" cy="108" r="11" fill="#0b3674"/><text x="82" y="112" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="85" r="11" fill="#0b3674"/><text x="152" y="89" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  oversize: {
    nombre: "Playera Oversize",
    subtitulo: "Corte holgado / hombro caído",
    tallas: [
      { talla: "CHI", ancho: 58.4, largo: 69.2 },
      { talla: "MED", ancho: 62.2, largo: 71.8 },
      { talla: "GDE", ancho: 66.0, largo: 74.3 },
      { talla: "EXG", ancho: 69.9, largo: 76.8 },
      { talla: "2EG", ancho: 71.1, largo: 78.7 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M90 30 L50 45 L15 72 L5 130 L45 142 L55 125 L55 252 Q140 262 225 252 L225 125 L235 142 L275 130 L265 72 L230 45 L190 30 Q180 52 140 52 T90 30 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M90 30 Q140 60 190 30 M92 34 Q140 52 188 34" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M57 135 H223" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 33 V250" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="72" cy="122" r="11" fill="#0b3674"/><text x="72" y="126" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="85" r="11" fill="#0b3674"/><text x="152" y="89" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  cuello_v: {
    nombre: "Playera Cuello V",
    subtitulo: "Cuello en 'V' unisex",
    tallas: [
      { talla: "CHI", ancho: 45.7, largo: 70.5 },
      { talla: "MED", ancho: 50.8, largo: 73.0 },
      { talla: "GDE", ancho: 55.9, largo: 75.6 },
      { talla: "EXG", ancho: 61.0, largo: 78.1 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M95 30 L65 42 L35 60 L12 105 L40 128 L62 110 L62 250 Q140 260 218 250 L218 110 L240 128 L268 105 L245 60 L215 42 L185 30 L140 85 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M95 30 L140 85 L185 30 M98 32 L140 80 L182 32" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M64 125 H216" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 33 V248" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="78" cy="112" r="11" fill="#0b3674"/><text x="78" y="116" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="100" r="11" fill="#0b3674"/><text x="152" y="104" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  manga_larga: {
    nombre: "Playera Manga Larga",
    subtitulo: "Playera con puño y manga larga",
    tallas: [
      { talla: "CHI", ancho: 45.7, largo: 70.5 },
      { talla: "MED", ancho: 50.8, largo: 73.0 },
      { talla: "GDE", ancho: 55.9, largo: 75.6 },
      { talla: "EXG", ancho: 61.0, largo: 78.1 },
      { talla: "2EG", ancho: 66.0, largo: 80.6 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M95 30 L62 42 L22 105 L12 215 L38 222 L52 135 L62 120 L62 250 Q140 260 218 250 L218 120 L228 135 L242 222 L268 215 L258 105 L218 42 L185 30 Q180 55 140 55 T95 30 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M95 30 Q140 62 185 30 M98 34 Q140 54 182 34" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M12 215 L38 222 M242 222 L268 215" stroke="#18181b" stroke-width="2.5"/>
        <path d="M64 125 H216" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 33 V248" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="78" cy="112" r="11" fill="#0b3674"/><text x="78" y="116" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="85" r="11" fill="#0b3674"/><text x="152" y="89" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  polo: {
    nombre: "Playera Tipo Polo",
    subtitulo: "Cuello de tejido con aletilla y botones",
    tallas: [
      { talla: "CHI", ancho: 45.7, largo: 71.8 },
      { talla: "MED", ancho: 50.8, largo: 74.3 },
      { talla: "GDE", ancho: 55.9, largo: 76.8 },
      { talla: "EXG", ancho: 61.0, largo: 79.4 },
      { talla: "2EG", ancho: 66.0, largo: 81.9 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M95 30 L65 42 L35 60 L12 105 L40 128 L62 110 L62 250 Q140 260 218 250 L218 110 L240 128 L268 105 L245 60 L215 42 L185 30 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M95 30 L122 70 L140 45 L158 70 L185 30" fill="#fff" stroke="#18181b" stroke-width="2.5"/>
        <path d="M127 65 V125 H153 V65" fill="#fff" stroke="#18181b" stroke-width="2"/>
        <circle cx="140" cy="82" r="2.5" fill="#18181b"/>
        <circle cx="140" cy="102" r="2.5" fill="#18181b"/>
        <path d="M64 125 H216" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M165 33 V248" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="78" cy="112" r="11" fill="#0b3674"/><text x="78" y="116" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="152" cy="138" r="11" fill="#0b3674"/><text x="152" y="142" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  sudadera_crew: {
    nombre: "Sudadera Cuello Redondo",
    subtitulo: "Sudadera tipo Crewneck sin capucha",
    tallas: [
      { talla: "CHI", ancho: 49.5, largo: 67.9 },
      { talla: "MED", ancho: 54.6, largo: 70.5 },
      { talla: "GDE", ancho: 59.7, largo: 71.8 },
      { talla: "EXG", ancho: 64.8, largo: 74.3 },
      { talla: "2EG", ancho: 69.9, largo: 76.8 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M95 35 L62 48 L22 110 L12 218 L38 226 L52 138 L65 125 L65 240 L215 240 L215 125 L228 138 L242 226 L268 218 L258 110 L218 48 L185 35 Q180 52 140 52 T95 35 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M95 35 Q140 56 185 35 M98 38 Q140 48 182 38" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M65 240 H215 M65 248 H215 M12 218 L38 226 M242 226 L268 218" stroke="#18181b" stroke-width="2.5"/>
        <path d="M67 135 H213" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M168 38 V244" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="82" cy="122" r="11" fill="#0b3674"/><text x="82" y="126" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="154" cy="85" r="11" fill="#0b3674"/><text x="154" y="89" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  },
  sudadera_hoodie: {
    nombre: "Sudadera con Capucha",
    subtitulo: "Sudadera estilo Hoodie con bolsa cangurera",
    tallas: [
      { talla: "CHI", ancho: 50.8, largo: 68.6 },
      { talla: "MED", ancho: 55.9, largo: 71.1 },
      { talla: "GDE", ancho: 61.0, largo: 73.7 },
      { talla: "EXG", ancho: 66.0, largo: 76.2 },
      { talla: "2EG", ancho: 71.1, largo: 78.7 }
    ],
    svg: `
      <svg viewBox="0 0 280 280" xmlns="http://www.w3.org/2000/svg" width="240" height="240">
        <defs><marker id="g-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#e3363d"/></marker></defs>
        <path d="M140 12 C100 12 92 48 95 72 L62 82 L22 135 L12 225 L38 232 L52 158 L65 145 L65 248 L215 248 L215 145 L228 158 L242 232 L268 225 L258 135 L218 82 L185 72 C188 48 180 12 140 12 Z" fill="#fff" stroke="#18181b" stroke-width="3.5" stroke-linejoin="round"/>
        <path d="M140 12 V76 M115 74 Q140 86 165 74" fill="none" stroke="#18181b" stroke-width="2.5"/>
        <path d="M125 76 Q122 110 118 125 M155 76 Q158 110 162 125" fill="none" stroke="#18181b" stroke-width="2"/>
        <path d="M85 180 H195 L205 235 H75 Z" fill="#fff" stroke="#18181b" stroke-width="2.5"/>
        <path d="M67 150 H213" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <path d="M172 75 V246" stroke="#e3363d" stroke-width="3.5" marker-start="url(#g-arrow)" marker-end="url(#g-arrow)"/>
        <circle cx="82" cy="136" r="11" fill="#0b3674"/><text x="82" y="140" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">1</text>
        <circle cx="158" cy="105" r="11" fill="#0b3674"/><text x="158" y="109" fill="#fff" font-family="Arial,sans-serif" font-size="13" font-weight="700" text-anchor="middle">2</text>
      </svg>`
  }
};

function getTallas(tipo = prendaActual) {
  const guardadasObj = AppState.settings[TALLAS_KEY] || {};
  const guardadasPrenda = guardadasObj[tipo];
  const defaults = PRENDAS_DATOS[tipo]?.tallas || PRENDAS_DATOS.playera.tallas;

  if (!Array.isArray(guardadasPrenda)) return defaults.map(item => ({ ...item }));

  return defaults.map(defecto => {
    const guardada = guardadasPrenda.find(item => item.talla === defecto.talla);
    return {
      talla: defecto.talla,
      ancho: Number.isFinite(Number(guardada?.ancho)) ? Number(guardada.ancho) : defecto.ancho,
      largo: Number.isFinite(Number(guardada?.largo)) ? Number(guardada.largo) : defecto.largo
    };
  });
}

function formatoMedida(valor) {
  return Number(valor).toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

function renderTallas() {
  const infoPrenda = PRENDAS_DATOS[prendaActual];
  const tallas = getTallas(prendaActual);

  // 1. Actualizar Diagrama SVG
  const contenedorSvg = document.querySelector(".guia-tallas-diagrama .guia-tallas-shirt, .guia-tallas-diagrama svg, #guia-svg-contenedor");
  if (contenedorSvg) {
    contenedorSvg.outerHTML = `<div id="guia-svg-contenedor" style="height:260px;display:flex;align-items:center;justify-content:center;">${infoPrenda.svg}</div>`;
  }

  // 2. Renderizar Tabla interactiva en Pantalla
  const tbody = document.querySelector(".guia-tallas-tabla tbody");
  const thead = document.querySelector(".guia-tallas-tabla thead tr");

  if (thead && tbody) {
    thead.innerHTML = `<th scope="col">Medida</th>` + tallas.map(t => `<th scope="col">${t.talla}</th>`).join("");

    tbody.innerHTML = `
      <tr>
        <th scope="row">
          <span class="guia-medida-numero">1</span>
          <span><strong>Ancho</strong><small>Axila a axila</small></span>
        </th>
        ${tallas.map(t => `<td><input type="number" min="0" step="0.1" value="${t.ancho}" data-guia-talla="${t.talla}" data-guia-medida="ancho"></td>`).join("")}
      </tr>
      <tr>
        <th scope="row">
          <span class="guia-medida-numero">2</span>
          <span><strong>Largo</strong><small>Hombro al bajo</small></span>
        </th>
        ${tallas.map(t => `<td><input type="number" min="0" step="0.1" value="${t.largo}" data-guia-talla="${t.talla}" data-guia-medida="largo"></td>`).join("")}
      </tr>
    `;
  }
}

function guardarMedida(input) {
  const texto = input.value.trim();
  const valor = Number(texto);
  if (!texto || !Number.isFinite(valor) || valor < 0) {
    showToast("Ingresa una medida válida mayor o igual a cero.", "error");
    renderTallas();
    return;
  }

  const tallas = getTallas(prendaActual);
  const talla = tallas.find(item => item.talla === input.dataset.guiaTalla);
  if (!talla || !["ancho", "largo"].includes(input.dataset.guiaMedida)) {
    showToast("No se pudo identificar la talla a actualizar.", "error");
    renderTallas();
    return;
  }

  talla[input.dataset.guiaMedida] = Math.round(valor * 10) / 10;
  if (!AppState.settings[TALLAS_KEY]) AppState.settings[TALLAS_KEY] = {};
  AppState.settings[TALLAS_KEY][prendaActual] = tallas;
  saveState();
  input.value = talla[input.dataset.guiaMedida];
}

function restaurarMedidas() {
  if (!AppState.settings[TALLAS_KEY]) AppState.settings[TALLAS_KEY] = {};
  AppState.settings[TALLAS_KEY][prendaActual] = PRENDAS_DATOS[prendaActual].tallas.map(t => ({ ...t }));
  saveState();
  renderTallas();
  showToast(`Se restauraron las medidas originales de: ${PRENDAS_DATOS[prendaActual].nombre}`);
}

function filasTablaPdf(tallas) {
  return ["ancho", "largo"].map((medida, indice) => `
    <tr>
      <th style="padding:16px 14px;text-align:left;background:#f1f3f6;color:#242832;border:1px solid #dfe2e7;">
        <span style="display:inline-block;width:25px;height:25px;margin-right:8px;border-radius:50%;background:#0b3674;color:#fff;text-align:center;line-height:25px;font-weight:700;">${indice + 1}</span>
        <strong>${medida === "ancho" ? "Ancho" : "Largo"}</strong>
        <div style="padding-left:34px;margin-top:2px;color:#717784;font-size:12px;">${medida === "ancho" ? "De axila a axila" : "Del punto más alto al bajo"}</div>
      </th>
      ${tallas.map(talla => `<td style="padding:16px 6px;text-align:center;border:1px solid #dfe2e7;font-size:16px;font-weight:700;color:#20232a;">${formatoMedida(talla[medida])}</td>`).join("")}
    </tr>`).join("");
}

function construirPdf(tallas, logo, letras) {
  const infoPrenda = PRENDAS_DATOS[prendaActual];
  const wordmark = letras
    ? `<img src="${letras}" alt="LUCXSTUDIO" style="display:block;width:220px;height:auto;max-height:42px;object-fit:contain;object-position:left center;">`
    : `<div style="font-size:25px;font-weight:900;letter-spacing:1px;color:#fff;">LUCXSTUDIO</div>`;

  return `
  <div style="width:1080px;height:720px;margin:0 auto;background:#fff;color:#191a1f;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;overflow:hidden;">
    <header style="height:112px;padding:20px 34px;background:#121214;border-bottom:7px solid #e3363d;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:15px;">
        ${logo ? `<img src="${logo}" alt="" style="width:65px;height:65px;object-fit:contain;">` : ""}
        <div>${wordmark}<p style="margin:5px 0 0;color:#b8b7bd;font-size:12px;">PLAYERAS · SUDADERAS · DISEÑO</p></div>
      </div>
      <div style="text-align:right;color:#fff;">
        <p style="margin:0;color:#e3363d;font-size:12px;font-weight:700;letter-spacing:2px;">GUÍA DE TALLAS / ${infoPrenda.nombre.toUpperCase()}</p>
        <h1 style="margin:5px 0 0;font-size:27px;letter-spacing:-.5px;">Encuentra tu talla ideal</h1>
      </div>
    </header>
    <main style="padding:22px 34px 18px;box-sizing:border-box;">
      <p style="margin:0 0 16px;color:#626875;font-size:14px;">Mide una prenda que ya te quede bien, extendida sobre una superficie plana. Todas las medidas están expresadas en centímetros.</p>
      <div style="display:flex;align-items:stretch;gap:24px;height:440px;">
        <section style="width:32%;padding:18px;background:#f5f6f8;border:1px solid #e3e5e9;border-radius:14px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <h2 style="margin:0;color:#121214;font-size:18px;">Cómo tomar las medidas</h2>
            <p style="margin:4px 0 0;color:#717784;font-size:12px;">${infoPrenda.subtitulo}</p>
          </div>
          <div style="height:250px;display:flex;align-items:center;justify-content:center;">${infoPrenda.svg}</div>
          <div>
            <p style="margin:0 0 6px;font-size:13px;"><b style="color:#e3363d;">1 · Ancho:</b> mide de axila a axila.</p>
            <p style="margin:0;font-size:13px;"><b style="color:#e3363d;">2 · Largo:</b> mide del punto más alto del hombro hasta el bajo.</p>
          </div>
        </section>
        <section style="flex:1;min-width:0;padding:18px;border:1px solid #e3e5e9;border-radius:14px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <h2 style="margin:0;font-size:18px;">Tabla de medidas — ${infoPrenda.nombre}</h2>
              <span style="padding:6px 10px;background:#f1f3f6;border-radius:999px;color:#525866;font-size:11px;font-weight:700;">VALORES EN CM</span>
            </div>
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
              <thead><tr style="background:#121214;color:#fff;">
                <th style="width:30%;padding:12px 10px;text-align:left;font-size:12px;">MEDIDA</th>
                ${tallas.map(talla => `<th style="padding:12px 3px;text-align:center;font-size:12px;border-left:1px solid #45454a;">${talla.talla}</th>`).join("")}
              </tr></thead>
              <tbody>${filasTablaPdf(tallas)}</tbody>
            </table>
          </div>
          <div style="padding:12px 14px;border-left:4px solid #e3363d;background:#faf4f4;color:#4f535d;font-size:12px;line-height:1.45;">
            <b>Tolerancia:</b> Las medidas pueden variar por corte: largo ± 2.5 cm (1") y ancho ± 1.9 cm (3/4").
          </div>
        </section>
      </div>
    </main>
    <footer style="height:42px;padding:0 34px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid #ececef;color:#858893;font-size:11px;">
      <span>Guía de referencia · LUCXSTUDIO</span><strong style="color:#e3363d;letter-spacing:1px;">VISTE TU ESTILO</strong>
    </footer>
  </div>`;
}

function imagenDataUrl(src, anchoMax) {
  return new Promise(resolve => {
    const imagen = new Image();
    imagen.onload = () => {
      try {
        const escala = Math.min(1, anchoMax / imagen.naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
        canvas.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
        canvas.getContext("2d").drawImage(imagen, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error(`No se pudo preparar la imagen ${src} para el PDF:`, error);
        resolve("");
      }
    };
    imagen.onerror = () => {
      console.error(`No se pudo cargar la imagen ${src} para el PDF.`);
      resolve("");
    };
    imagen.src = src;
  });
}

function imprimirPdf(html) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    showToast("El navegador bloqueó la ventana de impresión. Permite ventanas emergentes e inténtalo otra vez.", "error");
    return;
  }
  ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Guía de tallas LUCXSTUDIO</title>
    <style>@page{size:A4 landscape;margin:8mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}img,svg{max-width:100%}</style>
    </head><body>${html}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  ventana.document.close();
}

async function descargarPdf() {
  const tallas = getTallas(prendaActual);
  const [logo, letras] = await Promise.all([
    imagenDataUrl("LOGO-crop.png", 180),
    imagenDataUrl("Letras-crop.png", 600)
  ]);
  const html = construirPdf(tallas, logo, letras);

  if (typeof html2pdf === "undefined") {
    showToast("No cargó el generador de PDF; se abrirá la impresión.", "success");
    imprimirPdf(html);
    return;
  }

  const contenedor = document.createElement("div");
  contenedor.innerHTML = html.trim();
  const hoja = contenedor.firstElementChild;

  hoja.style.position = "fixed";
  hoja.style.left = "0px";
  hoja.style.top = "0px";
  hoja.style.zIndex = "-9999";
  hoja.style.opacity = "1";
  hoja.style.visibility = "visible";
  hoja.style.background = "#ffffff";

  document.body.appendChild(hoja);

  await new Promise(resolve => setTimeout(resolve, 250));

  try {
    await html2pdf().set({
      margin: [5, 5, 5, 5],
      filename: `guia_tallas_${prendaActual}_lucxstudio.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        width: 1080,
        height: 720,
        windowWidth: 1080,
        windowHeight: 720,
        logging: false
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      pagebreak: { mode: ["css", "legacy"] }
    }).from(hoja).save();

    showToast("Guía de tallas descargada.");
  } catch (error) {
    console.error("Error generando el PDF:", error);
    showToast("No se pudo generar el PDF; se abrirá la opción de impresión.", "error");
    imprimirPdf(html);
  } finally {
    hoja.remove();
  }
}

function crearSelectorPrendas() {
  const contenedorAcciones = document.querySelector(".guia-tallas-actions");
  if (!contenedorAcciones || document.getElementById("guia-tallas-prenda-select")) return;

  const selector = document.createElement("select");
  selector.id = "guia-tallas-prenda-select";
  selector.className = "form-select";
  selector.style.cssText = "width:auto;font-weight:700;padding:6px 12px;margin-right:10px;";
  
  Object.keys(PRENDAS_DATOS).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = PRENDAS_DATOS[key].nombre;
    if (key === prendaActual) opt.selected = true;
    selector.appendChild(opt);
  });

  selector.addEventListener("change", (e) => {
    prendaActual = e.target.value;
    renderTallas();
  });

  contenedorAcciones.insertBefore(selector, contenedorAcciones.firstChild);
}

export function iniciarGuiaTallas() {
  const pagina = document.getElementById("page-guia-tallas");
  if (!pagina) return;

  crearSelectorPrendas();
  renderTallas();

  pagina.addEventListener("change", event => {
    const input = event.target.closest("[data-guia-talla][data-guia-medida]");
    if (input) guardarMedida(input);
  });

  document.getElementById("guia-tallas-descargar")?.addEventListener("click", descargarPdf);
  document.getElementById("guia-tallas-restaurar")?.addEventListener("click", restaurarMedidas);
}