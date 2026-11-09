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

const URL_POR_DEFECTO = "https://script.google.com/macros/s/AKfycbwQXPSYkhxRT0xbzIo8Hvlz2t_gBweqHCORF8ATnyTli3gws6KOQF4YFX-KkFxJ__Fd/exec";

const $ = id => document.getElementById(id);
const K = {
  url: "LUCXSTUDIO_SHEETS_URL", token: "LUCXSTUDIO_SHEETS_TOKEN",
  on: "LUCXSTUDIO_SHEETS_ON", ts: "LUCXSTUDIO_SHEETS_TS", pend: "LUCXSTUDIO_SHEETS_PEND", hash: "LUCXSTUDIO_SHEETS_HASH"
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
  const conError = conf && conn.nivel === "rojo";
  aviso.className = "sh-aviso " + (!conf ? "gris" : (conError || pend) ? "amarillo" : "verde");
  aviso.textContent = !conf
    ? "Conecta tu hoja para poder subir cambios."
    : enVuelo ? "⏳ Subiendo cambios..."
    : conError ? "⚠️ No se pudieron subir los cambios. Mira el estado de la conexión."
    : pend ? "⚠️ Tienes cambios sin subir a Google Sheets."
    : "✅ Todo está subido a Google Sheets.";

  $("sh-subir").disabled = !conf || enVuelo;
  $("sh-subir").textContent = enVuelo ? "⏳ Subiendo..." : "⬆️ Subir cambios ahora";
  $("sh-traer").disabled = !conf || enVuelo;
  $("sh-verificar").disabled = !conf;
  $("sh-desconectar").disabled = !conf;
}

/* ---------------- sincronización v2: por secciones, comprimida ----------------
   · Solo se suben las secciones (playeras, cotizaciones, ...) que cambiaron.
   · Cada sección viaja en gzip+base64 (≈ 85 % menos).
   · La hoja guarda UNA fila por sección y la sobrescribe: nunca crece con el tiempo.
   · Cada 30 s (y al volver a la pestaña) se revisa si otro dispositivo cambió algo.
------------------------------------------------------------------------- */
const NO_SYNC = new Set(["ultimaModificacion"]);
function hashTexto(t) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + "." + t.length.toString(36);
}
const hashesSync = () => { try { return JSON.parse(ls.get(K.hash) || "{}"); } catch (e) { return {}; } };
const guardarHashesSync = h => ls.set(K.hash, JSON.stringify(h));
function serializarLocal() {
  const ser = {}, hash = {};
  Object.keys(AppState).filter(k => !NO_SYNC.has(k)).forEach(k => {
    ser[k] = JSON.stringify(AppState[k] === undefined ? null : AppState[k]);
    hash[k] = hashTexto(ser[k]);
  });
  return { ser, hash };
}
async function comprimir(texto) {
  if (typeof CompressionStream === "undefined") return "raw:" + texto;
  const flujo = new Blob([texto]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(flujo).arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return "gz:" + btoa(bin);
}
async function descomprimir(payload) {
  if (payload.startsWith("raw:")) return payload.slice(4);
  const bin = atob(payload.slice(3));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(flujo).text();
}

/* ---------------- llamadas a Apps Script ---------------- */
async function parsear(respuesta) {
  const texto = await respuesta.text();
  try { return JSON.parse(texto); }
  catch (e) {
    const err = new Error("no-json");
    err.html = texto.slice(0, 300);
    throw err;
  }
}
async function llamar(accion, extra) {
  const r = await fetch(`${ls.get(K.url)}?accion=${accion}&token=${encodeURIComponent(ls.get(K.token) || "")}${extra || ""}`);
  return parsear(r);
}
async function enviar(cuerpo) {
  // Sin cabecera application/json para evitar el preflight de CORS (Apps Script no lo soporta).
  const r = await fetch(ls.get(K.url), { method: "POST", body: JSON.stringify(Object.assign({ token: ls.get(K.token) }, cuerpo)) });
  return parsear(r);
}
function diagnostico(e) {
  if (e && e.message === "no-json") {
    return {
      titulo: "El script de Google falló",
      detalle: "La hoja respondió una página de error en vez de datos. Abre Apps Script → Ejecuciones y revisa el error de doPost/doGet."
    };
  }
  if (navigator.onLine === false) {
    return { titulo: "Sin internet", detalle: "Tus cambios se guardan en este dispositivo y se subirán al volver la conexión." };
  }
  return {
    titulo: "No se pudo conectar con la hoja",
    detalle: "Tienes internet, pero Google no dejó pasar la petición. Revisa que la URL sea la de la implementación vigente (termina en /exec) y que el acceso sea “Cualquier persona”."
  };
}
function manejarError(e) {
  if (e && e.codigo) return errorApi(e.codigo);
  const d = diagnostico(e);
  estado("rojo", d.titulo, d.detalle);
}
const AVISO_SCRIPT = ["Script desactualizado", "Pega el nuevo Code.gs en Apps Script y publica una versión nueva de la implementación."];

async function verificar() {
  if (!configurado()) {
    estado("gris", "Sin conectar", "Pega la URL y el token abajo para activar el respaldo en Google Sheets.");
    return;
  }
  estado("gris", "Verificando conexión...", "", true);
  try {
    const m = await llamar("meta");
    if (!m.ok) errorApi(m.error);
    else if (!m.hashes) estado("rojo", ...AVISO_SCRIPT);
    else estado("verde", "Conectado con Google Sheets", "La hoja respondió correctamente.");
  } catch (e) { manejarError(e); }
}

/* ---------------- subir / traer ---------------- */
async function subir(claves, ser, hash, baseTs, force) {
  const cambios = {}, hs = {};
  for (const k of claves) { cambios[k] = await comprimir(ser[k]); hs[k] = hash[k]; }
  return enviar({ baseTs, force: !!force, cambios, hashes: hs });
}
// Baja secciones de la hoja. completo=true reemplaza todo; si no, mezcla solo esas secciones.
async function traerDeHoja(claves, completo) {
  const r = await llamar("pull", claves && claves.length ? "&claves=" + encodeURIComponent(claves.join(",")) : "");
  if (!r.ok) throw Object.assign(new Error("api"), { codigo: r.error });
  const nuevos = {};
  for (const k of Object.keys(r.datos || {})) nuevos[k] = JSON.parse(await descomprimir(r.datos[k]));
  if (!Object.keys(nuevos).length) return null;
  const copia = window.tomarCopiaEstado();
  aplicando = true;
  try { importData(completo ? nuevos : Object.assign({}, AppState, nuevos)); saveState(); } finally { aplicando = false; }
  const { hash } = serializarLocal();
  const sync = completo ? {} : hashesSync();
  Object.keys(nuevos).forEach(k => { sync[k] = hash[k]; });
  guardarHashesSync(sync);
  ls.set(K.ts, r.ts);
  ls.set(K.pend, "0");
  return copia;
}
async function traer() {                       // botón "Traer de la hoja": reemplaza todo
  enConflicto = false;
  if (!configurado()) return;
  estado("gris", "Descargando de Google Sheets...", "", true);
  try {
    const copia = await traerDeHoja(null, true);
    if (!copia) { estado("verde", "Conectado con Google Sheets", "La hoja todavía está vacía."); return; }
    window.refrescarVistaActual();
    window.ofrecerDeshacer("Datos traídos de Google Sheets.", copia);
    estado("verde", "Conectado con Google Sheets", "Datos traídos de la hoja correctamente.");
  } catch (e) { manejarError(e); }
}
async function subirTodo() {                   // "Subir lo mío": sobrescribe la hoja
  if (!configurado()) return false;
  enConflicto = false;
  if (enVuelo) { pendientePush = true; return false; }
  enVuelo = true;
  estado("amarillo", "Subiendo cambios...", "Enviando tus datos a Google Sheets.", true);
  try {
    const { ser, hash } = serializarLocal();
    const r = await subir(Object.keys(ser), ser, hash, "", true);
    if (!r.ok) { errorApi(r.error); return false; }
    guardarHashesSync(hash); ls.set(K.ts, r.ts); ls.set(K.pend, "0");
    estado("verde", "Conectado con Google Sheets", "Cambios subidos correctamente.");
    return true;
  } catch (e) { ls.set(K.pend, "1"); manejarError(e); return false; }
  finally { enVuelo = false; pintar(); }
}

/* ---------------- sincronización automática ---------------- */
async function sincronizar(visible) {
  if (!configurado() || aplicando || enConflicto) return false;
  if (enVuelo) { pendientePush = true; return false; }
  enVuelo = true;
  if (visible) estado("amarillo", "Sincronizando...", "Comparando con Google Sheets.", true);
  let exito = false, subidas = 0, bajadas = 0;
  try {
    for (let intento = 0; intento < 3 && !exito; intento++) {
      const m = await llamar("meta");
      if (!m.ok) { errorApi(m.error); return false; }
      if (!m.hashes) { estado("rojo", ...AVISO_SCRIPT); return false; }
      const { ser, hash } = serializarLocal();
      const remoto = m.hashes;

      if (!m.ts) {                                   // hoja vacía: primera subida
        const r = await subir(Object.keys(ser), ser, hash, "", true);
        if (!r.ok) { errorApi(r.error); return false; }
        guardarHashesSync(hash); ls.set(K.ts, r.ts);
        subidas = Object.keys(ser).length; exito = true; break;
      }
      let sync = hashesSync();
      if (!Object.keys(sync).length) {               // primera conexión de este dispositivo
        if (Object.keys(remoto).some(k => remoto[k] !== hash[k])) { dialogoConflicto(m.ts); return false; }
        Object.keys(remoto).forEach(k => { sync[k] = remoto[k]; });
      }
      const remotoCambio = Object.keys(remoto).filter(k => remoto[k] !== sync[k]);
      const localCambio = Object.keys(hash).filter(k => hash[k] !== sync[k]);
      const choque = remotoCambio.filter(k => localCambio.includes(k) && remoto[k] !== hash[k]);
      if (choque.length) { dialogoConflicto(m.ts); return false; }

      const soloRemoto = remotoCambio.filter(k => !localCambio.includes(k));
      let baseTs = m.ts;
      if (soloRemoto.length) {
        await traerDeHoja(soloRemoto, false);
        bajadas = soloRemoto.length; baseTs = ls.get(K.ts) || m.ts;
      }
      sync = hashesSync();
      remotoCambio.filter(k => localCambio.includes(k)).forEach(k => { sync[k] = hash[k]; });   // ya iguales
      const aSubir = localCambio.filter(k => remoto[k] !== hash[k]);
      if (aSubir.length) {
        const r = await subir(aSubir, ser, hash, baseTs, false);
        if (r.error === "conflicto") continue;       // alguien subió justo ahora: se reintenta
        if (!r.ok) { errorApi(r.error); return false; }
        aSubir.forEach(k => { sync[k] = hash[k]; });
        ls.set(K.ts, r.ts); subidas = aSubir.length;
      } else {
        ls.set(K.ts, baseTs);
      }
      guardarHashesSync(sync); exito = true;
    }
    if (exito) {
      ls.set(K.pend, "0");
      estado("verde", "Conectado con Google Sheets",
        subidas || bajadas ? `Sincronizado: ${subidas} sección(es) subida(s), ${bajadas} bajada(s).` : "Todo al día.");
      if (bajadas) { window.refrescarVistaActual(); showToast("Se actualizaron datos desde otro dispositivo."); }
    } else {
      estado("amarillo", "La hoja cambió mientras subías", "Se reintentará automáticamente en unos segundos.");
      pendientePush = true;
    }
  } catch (e) {
    ls.set(K.pend, "1");
    manejarError(e);
  } finally {
    enVuelo = false;
    pintar();
    if (pendientePush) { pendientePush = false; if (!enConflicto) programarPush(); }
  }
  return exito;
}
function programarPush() {
  if (!configurado() || aplicando || enConflicto) return;
  ls.set(K.pend, "1");
  pintar();
  clearTimeout(temporizador);
  temporizador = setTimeout(() => sincronizar(false), 2500);
}
const empujar = force => (force ? subirTodo() : sincronizar(true));
const arranque = () => sincronizar(false);

/* ---------------- conflicto ---------------- */
function dialogoConflicto(tsHoja) {
  enConflicto = true;
  estado("amarillo", "La hoja tiene otra versión", "Elige cuál usar: traer la de la hoja o subir la de este dispositivo.");
  window.openQuickDetail({
    icon: "☁️", title: "La hoja tiene otra versión",
    subtitle: "Se editó lo mismo en dos dispositivos, o es la primera conexión",
    sections: [{
      rows: [["Última subida a la hoja", fechaTxt(tsHoja)], ["Último cambio en este dispositivo", fechaTxt(AppState.ultimaModificacion)]],
      text: "Traer la hoja reemplaza lo de este dispositivo (podrás deshacer). Subir lo mío sobrescribe lo que hay en la hoja."
    }],
    actions: [
      { label: "⬇️ Traer lo de la hoja", variant: "primary", onClick: () => traer() },
      { label: "⬆️ Subir lo mío", variant: "danger", onClick: () => subirTodo() },
      { label: "Decidir después" }
    ]
  });
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
  (document.getElementById("sh-mount") || document.getElementById("tab-respaldo") || pagina).appendChild(wrap);

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
    [K.url, K.token, K.on, K.ts, K.pend, K.hash].forEach(ls.del);
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
  // "Tiempo real": revisa la hoja cada 30 s mientras la pestaña está a la vista y al volver a ella.
  setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine !== false) sincronizar(false); }, 30000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sincronizar(false); });
}
iniciar();

Object.assign(window, { sheetsSubir: () => empujar(false), sheetsTraer: traer, sheetsVerificar: verificar });