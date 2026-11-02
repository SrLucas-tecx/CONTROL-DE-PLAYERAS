/* ============================================================
   LUCXSTUDIO — sheets.js
   Sincronización con Google Sheets (backend vía Apps Script).
   - localStorage sigue siendo la fuente principal (funciona offline).
   - Cada guardado se sube a la hoja (con 2.5 s de espera).
   - Si la hoja cambió desde otro dispositivo, pregunta qué versión usar.
   - Ajustes: estado de la conexión, subir cambios y configuración.
   ============================================================ */
import { AppState, importData, saveState } from "./storage.js";
import { showToast } from "./ui.js";

const URL_POR_DEFECTO = "https://script.google.com/macros/s/AKfycbzcWxTNSP9jr2vHd14OoXr_Q_vaAp1-xBsUqaNSiRR9wtQt_4vqNdD363k7BWR2-zT9/exec";

const $ = id => document.getElementById(id);
const K = {
  url: "LUCXSTUDIO_SHEETS_URL", token: "LUCXSTUDIO_SHEETS_TOKEN",
  on: "LUCXSTUDIO_SHEETS_ON", ts: "LUCXSTUDIO_SHEETS_TS", pend: "LUCXSTUDIO_SHEETS_PEND"
};
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
};

let aplicando = false;      // true mientras se aplican datos traídos de la hoja
let enVuelo = false;        // hay una subida en curso
let pendientePush = false;  // se guardó algo mientras subía
let enConflicto = false;    // esperando que decidas qué versión usar
let temporizador = null;

const configurado = () => !!(ls.get(K.url) && ls.get(K.token) && ls.get(K.on) === "1");
const hayPendientes = () => configurado() && ls.get(K.pend) === "1";
const fechaTxt = iso => {
  const d = new Date(iso || "");
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
};

/* ---------------- estado de la conexión (semáforo) ---------------- */
// nivel: "gris" | "verde" | "amarillo" | "rojo"
let conn = { nivel: "gris", titulo: "Sin conectar", detalle: "Pega la URL y el token abajo para activar el respaldo en Google Sheets.", cargando: false };

function estado(nivel, titulo, detalle, cargando) {
  conn = { nivel, titulo, detalle: detalle || "", cargando: !!cargando };
  pintar();
}
function errorApi(codigo) {
  if (codigo === "token") estado("rojo", "Token incorrecto", "El token no coincide con el de Code.gs. Revísalo y vuelve a conectar.");
  else estado("rojo", "Error en la hoja", "Respuesta inesperada: " + String(codigo));
}

function pintar() {
  if (!$("sh-wrap")) return;
  const conf = configurado();
  const pend = hayPendientes();

  $("sh-dot").className = "sh-dot " + conn.nivel + (conn.cargando ? " cargando" : "");
  $("sh-titulo").textContent = conn.titulo;
  $("sh-detalle").textContent = conn.detalle;
  $("sh-ultima").textContent = conf && ls.get(K.ts) ? fechaTxt(ls.get(K.ts)) : "—";

  const pendEl = $("sh-pend");
  pendEl.textContent = !conf ? "—" : pend ? "Sí, sin subir" : "No, todo subido";
  pendEl.className = "sh-valor" + (conf ? (pend ? " alerta" : " ok") : "");

  const aviso = $("sh-subir-aviso");
  aviso.className = "sh-aviso " + (!conf ? "gris" : pend ? "amarillo" : "verde");
  aviso.textContent = !conf
    ? "Conecta tu hoja para poder subir cambios."
    : enVuelo ? "⏳ Subiendo cambios..."
    : pend ? "⚠️ Tienes cambios sin subir a Google Sheets."
    : "✅ Todo está subido a Google Sheets.";

  $("sh-subir").disabled = !conf || enVuelo;
  $("sh-subir").textContent = enVuelo ? "⏳ Subiendo..." : "⬆️ Subir cambios ahora";
  $("sh-traer").disabled = !conf || enVuelo;
  $("sh-verificar").disabled = !conf;
  $("sh-desconectar").disabled = !conf;
}

/* ---------------- llamadas a Apps Script ---------------- */
async function leer(accion) {
  const r = await fetch(`${ls.get(K.url)}?accion=${accion}&token=${encodeURIComponent(ls.get(K.token) || "")}`);
  return r.json();
}
async function escribir(force) {
  // Sin cabecera application/json para evitar el preflight de CORS (Apps Script no lo soporta).
  const r = await fetch(ls.get(K.url), {
    method: "POST",
    body: JSON.stringify({ token: ls.get(K.token), baseTs: ls.get(K.ts) || "", force: !!force, datos: AppState })
  });
  return r.json();
}

/* ---------------- verificar conexión ---------------- */
async function verificar() {
  if (!configurado()) {
    estado("gris", "Sin conectar", "Pega la URL y el token abajo para activar el respaldo en Google Sheets.");
    return;
  }
  estado("gris", "Verificando conexión...", "", true);
  try {
    const m = await leer("meta");
    if (m.ok) estado("verde", "Conectado con Google Sheets", "La hoja respondió correctamente.");
    else errorApi(m.error);
  } catch (e) {
    estado("rojo", "Sin conexión", "No se pudo llegar a Google Sheets. Revisa tu internet o la URL.");
  }
}

/* ---------------- subir ---------------- */
async function empujar(force) {
  if (!configurado()) return false;
  if (enVuelo) { pendientePush = true; return false; }
  enVuelo = true;
  estado("amarillo", "Subiendo cambios...", "Enviando tus datos a Google Sheets.", true);
  let exito = false;
  try {
    const r = await escribir(force);
    if (r.ok) {
      ls.set(K.ts, r.ts);
      if (!pendientePush) ls.set(K.pend, "0");
      enConflicto = false;
      exito = true;
      estado("verde", "Conectado con Google Sheets", "Cambios subidos correctamente.");
    } else if (r.error === "conflicto") {
      dialogoConflicto(r.ts);
    } else {
      errorApi(r.error);
    }
  } catch (e) {
    estado("rojo", "Sin conexión", "Tus cambios están a salvo en este dispositivo y se subirán cuando vuelva la conexión.");
  } finally {
    enVuelo = false;
    pintar();
    if (pendientePush) { pendientePush = false; programarPush(); }
  }
  return exito;
}
function programarPush() {
  if (!configurado() || aplicando || enConflicto) return;
  ls.set(K.pend, "1");
  pintar();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => empujar(false), 2500);
}

/* ---------------- traer ---------------- */
async function traer() {
  enConflicto = false;
  if (!configurado()) return;
  estado("gris", "Descargando de Google Sheets...", "", true);
  try {
    const r = await leer("pull");
    if (!r.ok) { errorApi(r.error); return; }
    if (!r.datos) { estado("verde", "Conectado con Google Sheets", "La hoja todavía está vacía."); return; }
    const copia = window.tomarCopiaEstado();
    aplicando = true;
    try { importData(r.datos); saveState(); } finally { aplicando = false; }
    ls.set(K.ts, r.ts);
    ls.set(K.pend, "0");
    window.refrescarVistaActual();
    window.ofrecerDeshacer("Datos traídos de Google Sheets.", copia);
    estado("verde", "Conectado con Google Sheets", "Datos traídos de la hoja correctamente.");
  } catch (e) {
    estado("rojo", "Sin conexión", "No se pudo descargar. Revisa tu internet.");
  }
}

/* ---------------- conflicto ---------------- */
function dialogoConflicto(tsHoja) {
  enConflicto = true;
  estado("amarillo", "La hoja tiene otra versión", "Elige cuál usar: traer la de la hoja o subir la de este dispositivo.");
  window.openQuickDetail({
    icon: "☁️", title: "La hoja tiene otra versión",
    subtitle: "Puede que hayas usado la app en otro dispositivo",
    sections: [{
      rows: [["Última subida a la hoja", fechaTxt(tsHoja)], ["Último cambio en este dispositivo", fechaTxt(AppState.ultimaModificacion)]],
      text: "Traer la hoja reemplaza lo de este dispositivo (podrás deshacer). Subir lo mío sobrescribe lo que hay en la hoja."
    }],
    actions: [
      { label: "⬇️ Traer lo de la hoja", variant: "primary", onClick: () => traer() },
      { label: "⬆️ Subir lo mío", variant: "danger", onClick: () => { enConflicto = false; empujar(true); } },
      { label: "Decidir después" }
    ]
  });
}

/* ---------------- arranque ---------------- */
async function arranque() {
  if (!configurado()) { pintar(); return; }
  estado("gris", "Verificando conexión...", "", true);
  try {
    const m = await leer("meta");
    if (!m.ok) { errorApi(m.error); return; }
    const local = ls.get(K.ts) || "";
    const pend = ls.get(K.pend) === "1";
    if (!m.ts) { await empujar(true); return; }                 // hoja vacía: primera subida
    if (m.ts === local) {
      if (pend) await empujar(false);
      else estado("verde", "Conectado con Google Sheets", "Todo al día.");
      return;
    }
    if (pend || !local) { dialogoConflicto(m.ts); return; }     // cambios locales sin subir, o primera conexión
    await traer();                                              // la hoja es más nueva y aquí no hay nada pendiente
  } catch (e) {
    estado("rojo", "Sin conexión", "No se pudo llegar a Google Sheets. Revisa tu internet o la URL.");
  }
}

/* ---------------- estilos de la sección ---------------- */
function inyectarEstilos() {
  if ($("sh-estilos")) return;
  const s = document.createElement("style");
  s.id = "sh-estilos";
  s.textContent = `
    .sh-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-4);margin-bottom:var(--space-4);}
    .sh-panel{max-width:none;min-width:0;}
    .sh-head{display:flex;align-items:center;gap:var(--space-3);}
    .sh-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;background:var(--color-gray);box-shadow:0 0 0 4px var(--color-gray-soft);}
    .sh-dot.verde{background:var(--color-success);box-shadow:0 0 0 4px var(--color-success-soft);}
    .sh-dot.amarillo{background:var(--color-warning);box-shadow:0 0 0 4px var(--color-warning-soft);}
    .sh-dot.rojo{background:var(--color-danger);box-shadow:0 0 0 4px var(--color-danger-soft);}
    .sh-dot.cargando{animation:sh-pulso 1s ease-in-out infinite;}
    @keyframes sh-pulso{50%{opacity:.35;}}
    .sh-titulo{font-family:var(--font-display);font-weight:700;font-size:var(--fs-md);line-height:1.25;}
    .sh-detalle{font-size:var(--fs-sm);line-height:1.5;color:var(--color-text-muted);margin-top:2px;}
    .sh-filas{display:flex;flex-direction:column;}
    .sh-fila{display:flex;justify-content:space-between;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-top:1px dashed var(--color-border);font-size:var(--fs-sm);}
    .sh-fila>span:first-child{color:var(--color-text-muted);}
    .sh-valor{font-weight:700;text-align:right;}
    .sh-valor.ok{color:var(--color-success);}
    .sh-valor.alerta{color:var(--color-warning);}
    .sh-aviso{padding:var(--space-3) var(--space-4);border-radius:var(--radius-md);font-size:var(--fs-sm);font-weight:700;line-height:1.4;border:1px solid var(--color-border);background:var(--color-surface-alt);}
    .sh-aviso.verde{background:var(--color-success-soft);border-color:var(--color-success);}
    .sh-aviso.amarillo{background:var(--color-warning-soft);border-color:var(--color-warning);}
    .sh-nota{font-size:var(--fs-xs);line-height:1.5;color:var(--color-text-muted);}
    .sh-acciones{display:flex;flex-wrap:wrap;gap:var(--space-3);}
    .sh-btn-grande{width:100%;min-height:48px;font-size:var(--fs-base);}
    .sh-acciones button:disabled,.sh-btn-grande:disabled{opacity:.5;cursor:not-allowed;}
    @media (max-width:760px){.sh-grid{grid-template-columns:minmax(0,1fr);}}
    @media (max-width:560px){.sh-acciones button{flex:1 1 100%;min-height:44px;}.sh-fila{flex-direction:column;align-items:flex-start;gap:2px;}.sh-valor{text-align:left;}}
    @media (prefers-reduced-motion:reduce){.sh-dot.cargando{animation:none;}}
  `;
  document.head.appendChild(s);
}

/* ---------------- secciones en Ajustes ---------------- */
function crearSecciones() {
  const pagina = $("page-ajustes");
  if (!pagina || $("sh-wrap")) return;
  inyectarEstilos();

  const wrap = document.createElement("div");
  wrap.id = "sh-wrap";
  wrap.innerHTML = `
    <div class="section-header" style="margin-top:32px;">
      <div>
        <h2 class="section-title">☁️ Google Sheets (backend)</h2>
        <p class="section-sub">Respaldo automático de tus datos en una hoja de Google. Revisa aquí si está conectado y sube tus cambios cuando quieras.</p>
      </div>
    </div>

    <div class="sh-grid">
      <div class="settings-card sh-panel" id="sh-estado-card">
        <div class="sh-head">
          <span class="sh-dot gris" id="sh-dot" aria-hidden="true"></span>
          <div>
            <div class="sh-titulo" id="sh-titulo" role="status" aria-live="polite">Sin conectar</div>
            <div class="sh-detalle" id="sh-detalle"></div>
          </div>
        </div>
        <div class="sh-filas">
          <div class="sh-fila"><span>Última sincronización</span><span class="sh-valor" id="sh-ultima">—</span></div>
          <div class="sh-fila"><span>Cambios pendientes</span><span class="sh-valor" id="sh-pend">—</span></div>
        </div>
        <div class="sh-acciones">
          <button type="button" class="btn-secondary" id="sh-verificar">🔄 Verificar conexión</button>
        </div>
      </div>

      <div class="settings-card sh-panel" id="sh-subir-card">
        <div>
          <h3 class="settings-panel-title">Subir cambios</h3>
          <p class="settings-panel-description">Tus cambios se suben solos unos segundos después de guardar. Usa este botón si quieres forzar la subida.</p>
        </div>
        <div class="sh-aviso gris" id="sh-subir-aviso" role="status" aria-live="polite">Conecta tu hoja para poder subir cambios.</div>
        <button type="button" class="btn-primary sh-btn-grande" id="sh-subir">⬆️ Subir cambios ahora</button>
        <button type="button" class="btn-secondary" id="sh-traer">⬇️ Traer de la hoja</button>
        <p class="sh-nota">“Traer de la hoja” reemplaza los datos de este dispositivo por los de Google Sheets (podrás deshacerlo).</p>
      </div>
    </div>

    <div class="settings-card" id="sh-card">
      <div>
        <h3 class="settings-panel-title">Configuración de la conexión</h3>
        <p class="settings-panel-description">La URL y el token se guardan solo en este navegador.</p>
      </div>
      <div class="form-group">
        <label class="form-label" for="sh-url">URL de la aplicación web (Apps Script)</label>
        <input type="url" id="sh-url" class="form-input" placeholder="https://script.google.com/macros/s/.../exec">
      </div>
      <div class="form-group">
        <label class="form-label" for="sh-token">Token (el mismo de Code.gs)</label>
        <input type="password" id="sh-token" class="form-input" autocomplete="off">
      </div>
      <div class="sh-acciones">
        <button type="button" class="btn-primary" id="sh-conectar">🔗 Guardar y conectar</button>
        <button type="button" class="btn-danger" id="sh-desconectar">Desconectar</button>
      </div>
    </div>`;
  pagina.appendChild(wrap);

  $("sh-url").value = ls.get(K.url) || URL_POR_DEFECTO;
  $("sh-token").value = ls.get(K.token) || "";

  $("sh-conectar").addEventListener("click", async () => {
    const url = $("sh-url").value.trim();
    const token = $("sh-token").value.trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url) || !token) {
      return showToast("Pega la URL completa (termina en /exec) y el token.", "error");
    }
    ls.set(K.url, url); ls.set(K.token, token); ls.set(K.on, "1");
    await arranque();
    showToast("Conexión guardada.");
  });
  $("sh-verificar").addEventListener("click", verificar);
  $("sh-subir").addEventListener("click", async () => {
    if (!configurado()) return showToast("Primero conecta tu hoja.", "error");
    enConflicto = false;
    const ok = await empujar(false);
    if (ok) showToast("Cambios subidos a Google Sheets.");
  });
  $("sh-traer").addEventListener("click", async () => {
    if (!configurado()) return showToast("Primero conecta tu hoja.", "error");
    const ok = await window.confirmPopup({
      title: "Traer de Google Sheets",
      message: "Se reemplazarán los datos de este dispositivo con los de la hoja. Podrás deshacerlo.",
      confirmLabel: "Traer", danger: true
    });
    if (ok) traer();
  });
  $("sh-desconectar").addEventListener("click", () => {
    [K.url, K.token, K.on, K.ts, K.pend].forEach(ls.del);
    $("sh-url").value = URL_POR_DEFECTO; $("sh-token").value = "";
    enConflicto = false;
    estado("gris", "Sin conectar", "Pega la URL y el token abajo para activar el respaldo en Google Sheets.");
    showToast("Desconectado. Tus datos locales no se tocaron.");
  });

  pintar();
}

function iniciar() {
  crearSecciones();
  document.addEventListener("lucx:guardado", programarPush);

  window.addEventListener("offline", () => {
    if (configurado()) estado("rojo", "Sin internet", "Tus cambios se guardan en este dispositivo y se subirán al volver la conexión.");
  });
  window.addEventListener("online", () => {
    if (!configurado() || enConflicto) return;
    if (hayPendientes()) empujar(false); else verificar();
  });

  if (configurado()) estado("gris", "Verificando conexión...", "", true);
  setTimeout(arranque, 3000);
}
iniciar();

Object.assign(window, { sheetsSubir: () => empujar(false), sheetsTraer: traer, sheetsVerificar: verificar });