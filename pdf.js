/* ============================================================
   LUCXSTUDIO — pdf.js
   Generador del PDF de la cotización (se descarga o se imprime).
   Usa los logos que ya están en el proyecto: LOGO-crop.png,
   Letras-crop.png (letras blancas) y OJITOS-crop.png.
   ============================================================ */
import { fmt, escapeHtml, colorNombre, resumenPagoCotizacion, etiquetaMetodoPago } from "./calculator.js";
import { showToast } from "./ui.js";

/* ---------------------------------------------------------------
   IMÁGENES: se reducen y se convierten a data URL
--------------------------------------------------------------- */
const cacheImg = {};
function imagenChica(src, anchoMax) {
  if (cacheImg[src] !== undefined) return Promise.resolve(cacheImg[src]);
  return new Promise(resolve => {
    let listo = false;
    const fin = valor => { if (listo) return; listo = true; cacheImg[src] = valor; resolve(valor); };
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, anchoMax / img.naturalWidth);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        fin(c.toDataURL("image/png"));
      } catch (e) { fin(""); }
    };
    img.onerror = () => fin("");
    setTimeout(() => fin(""), 5000);
    img.src = src;
  });
}

/* ---------------------------------------------------------------
   HTML DE LA HOJA
--------------------------------------------------------------- */
const fechaCorta = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || "");
};
const ROJO = "#c0242c", NEGRO = "#121214";

function bloquePago(q) {
  if (q.ventaNula) return "";
  const p = resumenPagoCotizacion(q);
  if (!p.total) return "";

  const fila = (a, b, extra) => `<tr><td style="padding:5px 0;color:#555;">${a}</td><td style="padding:5px 0;text-align:right;font-weight:700;${extra || ""}">${b}</td></tr>`;
  const filas = [fila("Método de pago", escapeHtml(etiquetaMetodoPago(q.metodoPago, false)))];
  filas.push(fila("Anticipo", p.anticipo > 0 ? fmt(p.anticipo) : "$0.00 (sin anticipo)"));

  let banner = "";
  if (p.completo) {
    if (p.anticipo > 0) filas.push(fila("Liquidación", fmt(p.liquidado)));
    if (p.fechaPago) filas.push(fila("Fecha de pago", fechaCorta(p.fechaPago)));
    const fechaTxt = p.fechaPago ? (" · " + fechaCorta(p.fechaPago)) : "";
    banner = `<div style="margin-top:10px;background:#1f9d63;color:#fff;text-align:center;font-weight:800;letter-spacing:1px;padding:10px;border-radius:8px;font-size:15px;">PAGO COMPLETO${fechaTxt}</div>`;
  } else {
    filas.push(fila("Resta por liquidar", fmt(p.resta), `color:${ROJO};font-size:15px;`));
    banner = `<div style="margin-top:10px;background:#fff4e0;color:#8a5a00;border:1px solid #e0a23a;text-align:center;font-weight:800;padding:9px;border-radius:8px;font-size:13px;">PAGO PENDIENTE · se liquida con ${fmt(p.resta)}</div>`;
  }

  return `
    <div style="margin-top:18px;border:1px solid #e3e3e3;border-radius:10px;padding:14px 16px;background:#fafafa;page-break-inside:avoid;box-sizing:border-box;">
      <div style="font-weight:800;font-size:12px;letter-spacing:.8px;color:${ROJO};margin-bottom:6px;">ESTADO DEL PAGO</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">${filas.join("")}</table>
      ${banner}
    </div>`;
}

function construirHoja(q, img) {
  const th = (t, ancho, izq) => `<th style="padding:8px 6px;${izq ? "text-align:left;" : ""}${ancho ? `width:${ancho};` : ""}">${t}</th>`;
  const td = (t, extra) => `<td style="padding:7px 6px;border-bottom:1px solid #eee;${extra || ""}">${t}</td>`;

  const filas = (q.items || []).map(i => {
    const tipo = i.tipo ? ` <span style="color:#888;">(${escapeHtml(i.tipo)})</span>` : "";
    const prod = escapeHtml(i.nombre || "—") + tipo;
    return `<tr>
      ${td(prod)}
      ${td(escapeHtml(i.talla || "—"), "text-align:center;")}
      ${td(escapeHtml(colorNombre(i.colorId)), "text-align:center;")}
      ${td(i.cantidad, "text-align:center;")}
      ${td(fmt(i.precioVenta), "text-align:right;")}
      ${td(fmt((i.precioVenta || 0) * (i.cantidad || 0)), "text-align:right;font-weight:700;")}
    </tr>`;
  }).join("");

  const filasSt = (q.stickers || []).map(s => {
    const nom = escapeHtml(s.nombre || "Sticker") + ` <span style="color:#888;">(sticker ${escapeHtml(s.tamano || "—")})</span>`;
    return `<tr>
      ${td(nom)}
      ${td("—", "text-align:center;")}
      ${td("—", "text-align:center;")}
      ${td(s.cantidad, "text-align:center;")}
      ${td(fmt(s.precioVenta), "text-align:right;")}
      ${td(fmt((s.precioVenta || 0) * (s.cantidad || 0)), "text-align:right;font-weight:700;")}
    </tr>`;
  }).join("");

  const extras = (q.serviciosExtra && q.serviciosExtra.length) ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:12px;">
      <thead><tr style="background:#f2f2f2;">${th("Servicio extra", "", true)}${th("Monto", "120px")}</tr></thead>
      <tbody>${q.serviciosExtra.map(s => `<tr>${td(escapeHtml(s.concepto))}${td(fmt(s.monto), "text-align:right;")}</tr>`).join("")}</tbody>
    </table>` : "";

  const filaTot = (a, b, extra) => `<tr><td style="padding:3px 14px 3px 0;color:#555;${extra || ""}">${a}</td><td style="padding:3px 0;text-align:right;${extra || ""}">${b}</td></tr>`;

  const marca = img.letras
    ? `<img src="${img.letras}" style="height:30px;width:auto;display:block;">`
    : `<div style="color:#fff;font-weight:800;font-size:24px;letter-spacing:1px;">LUCXSTUDIO</div>`;

  const urgente = q.urgente || q.esUrgente;
  const tagsHeader = [q.tipoVenta === "Mayoreo" ? "Mayoreo" : "", urgente ? "Pedido urgente" : ""].filter(Boolean).join(" · ");
  const bannerTags = tagsHeader ? `<div style="font-size:12px;color:${ROJO};font-weight:700;margin-bottom:6px;">${tagsHeader}</div>` : "";

  const telTxt = q.clienteTelefono ? ` &nbsp;·&nbsp; <b>Tel:</b> ${escapeHtml(q.clienteTelefono)}` : "";
  const subtotalRow = q.montoDescuento ? filaTot("Subtotal", fmt(q.ventaBruta)) + filaTot(`Descuento (${q.descuentoPct}%)`, "- " + fmt(q.montoDescuento), `color:${ROJO};`) : "";
  const urgenteRow = q.montoUrgente ? filaTot(`Recargo por urgencia (${q.recargoUrgentePct}%)`, "+ " + fmt(q.montoUrgente), `color:${ROJO};`) : "";

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#222;width:680px;background:#fff;box-sizing:border-box;margin:0 auto;">
    <div style="background:${NEGRO};border-bottom:5px solid ${ROJO};padding:18px 24px;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
      <div style="display:flex;align-items:center;gap:14px;">
        ${img.logo ? `<img src="${img.logo}" style="height:58px;width:58px;object-fit:contain;display:block;">` : ""}
        <div>${marca}<div style="color:#b5b3b8;font-size:11px;margin-top:5px;">Impresión DTF y playeras personalizadas</div></div>
      </div>
      <div style="text-align:right;color:#fff;">
        <div style="font-size:11px;letter-spacing:1.5px;color:#b5b3b8;">COTIZACIÓN</div>
        <div style="font-size:20px;font-weight:800;">${escapeHtml(q.folio || "—")}</div>
        <div style="font-size:12px;color:#d6d4d8;">${escapeHtml(fechaCorta(q.fecha) || "—")}</div>
      </div>
    </div>
    <div style="padding:20px 24px 18px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;margin-bottom:6px;">
        <div><b>Cliente:</b> ${escapeHtml(q.cliente || "Cliente sin nombre")}${telTxt}</div>
        <div><b>Vendedor:</b> ${escapeHtml(q.vendedor || "—")}</div>
      </div>
      ${bannerTags}
      ${q.ventaNula ? `<p style="font-size:12px;background:#fdeeee;border:1px dashed ${ROJO};border-radius:6px;padding:8px;">Cotización marcada como venta nula (regalo / cortesía).</p>` : ""}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px;">
        <thead><tr style="background:${ROJO};color:#fff;">${th("Producto", "", true)}${th("Talla", "50px")}${th("Color", "70px")}${th("Cant.", "45px")}${th("Precio c/u", "85px")}${th("Subtotal", "90px")}</tr></thead>
        <tbody>${filas}${filasSt}</tbody>
      </table>
      ${extras}
      <div style="margin-top:16px;display:flex;justify-content:flex-end;">
        <table style="font-size:13px;border-collapse:collapse;min-width:260px;">
          ${subtotalRow}
          ${urgenteRow}
          <tr><td style="padding:8px 14px 2px 0;font-size:18px;font-weight:800;color:${ROJO};">Total</td><td style="padding:8px 0 2px;text-align:right;font-size:18px;font-weight:800;color:${ROJO};">${fmt(q.totalVenta)}</td></tr>
        </table>
      </div>
      ${bloquePago(q)}
      ${q.notas ? `<p style="margin-top:16px;font-size:12px;background:#f7f7f7;padding:9px;border-radius:6px;"><b>Notas:</b> ${escapeHtml(q.notas)}</p>` : ""}
    </div>
    <div style="background:${NEGRO};padding:12px 24px;display:flex;align-items:center;justify-content:center;gap:12px;box-sizing:border-box;">
      ${img.ojitos ? `<img src="${img.ojitos}" style="height:26px;width:auto;display:block;">` : ""}
      <span style="color:#d6d4d8;font-size:12px;">¡Gracias por tu compra! · LUCXSTUDIO</span>
    </div>
  </div>`;
}

/* ---------------------------------------------------------------
   RESPALDO: vista de impresión (Guardar como PDF)
--------------------------------------------------------------- */
function abrirImpresion(html, titulo) {
  const w = window.open("", "_blank");
  if (!w) { showToast("El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo otra vez.", "error"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
    <style>@page{size:A4;margin:10mm}body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head>
    <body>${html}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}

/* ---------------------------------------------------------------
   API PÚBLICA
--------------------------------------------------------------- */
export async function generarPdfCotizacion(q) {
  const [logo, letras, ojitos] = await Promise.all([
    imagenChica("LOGO-crop.png", 260), imagenChica("Letras-crop.png", 560), imagenChica("OJITOS-crop.png", 260)
  ]);
  const html = construirHoja(q, { logo, letras, ojitos });
  const slug = String(q.cliente || "cliente").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const nombre = `cotizacion_${String(q.folio || "nueva").toLowerCase()}_${slug || "cliente"}`;

  if (typeof html2pdf === "undefined") {
    showToast("No cargó el generador de PDF (¿sin internet?). Se abre la vista para imprimir como PDF.", "success", { duracion: 6000 });
    return abrirImpresion(html, nombre);
  }
  const caja = document.createElement("div");
  caja.innerHTML = html;
  const hoja = caja.firstElementChild;
  try {
    await html2pdf().set({
      margin: [8, 8, 8, 8], filename: nombre + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ["tr"] }
    }).from(hoja).save();
    showToast("PDF descargado.");
  } catch (e) {
    console.error("Error generando el PDF:", e);
    showToast("No se pudo generar el PDF; se abre la vista para imprimir.", "error");
    abrirImpresion(html, nombre);
  }
}

Object.assign(window, { generarPdfCotizacion });