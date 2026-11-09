const EMOJI_A_ICONO = new Map([
  ["↔", "arrow-left-right"], ["↗", "arrow-up-right"], ["↩", "undo-2"],
  ["⏳", "hourglass"], ["⏱", "clock"], ["⏰", "alarm-clock"],
  ["📋", "clipboard-list"], ["📝", "notebook-pen"], ["📌", "pin"],
  ["🛒", "shopping-cart"], ["▦", "layout-grid"],
  ["☀", "sun"], ["☁", "cloud"], ["⚖", "scale"],
  ["⚙", "settings"], ["⚠", "triangle-alert"], ["⚡", "zap"], ["✂", "scissors"],
  ["✅", "check"], ["✍", "pen-line"], ["✏", "pencil"], ["✨", "sparkles"],
  ["❓", "circle-help"], ["➕", "plus"], ["➖", "minus"], ["➡", "arrow-right"],
  ["⬆", "arrow-up"], ["⬇", "arrow-down"], ["🌙", "moon"], ["🎁", "gift"],
  ["🎉", "party-popper"], ["🎨", "palette"], ["🎪", "tent"], ["🎯", "target"],
  ["🏆", "trophy"], ["🏠", "house"], ["🏦", "landmark"], ["🏪", "store"],
  ["🏷", "tag"], ["👁", "eye"], ["👕", "shirt"], ["👤", "user-round"],
  ["👥", "users"], ["💡", "lightbulb"], ["💬", "message-circle"],
  ["💰", "wallet"], ["💳", "credit-card"], ["💵", "banknote"], ["💸", "hand-coins"],
  ["💾", "save"], ["📁", "folder"], ["📄", "file-text"], ["📅", "calendar"],
  ["📈", "chart-no-axes-column-increasing"], ["📉", "trending-down"],
  ["📊", "chart-no-axes-column-increasing"], ["📍", "map-pin"], ["📐", "ruler"],
  ["📚", "book-open"], ["📜", "scroll"], ["📞", "phone"], ["📤", "upload"],
  ["📥", "download"], ["📦", "package"], ["📱", "smartphone"], ["🔀", "shuffle"],
  ["🔁", "repeat"], ["🔄", "refresh-cw"], ["🔍", "search"], ["🔎", "search"],
  ["🔒", "lock"], ["🔓", "unlock"], ["🔗", "link"], ["🔥", "flame"],
  ["🔴", "circle"], ["🟡", "circle"], ["🟢", "circle"],
  ["🖤", "heart"], ["🖨", "printer"], ["🗂", "folders"],
  ["🗑", "trash-2"], ["🚀", "rocket"], ["🚚", "truck"], ["🚦", "traffic-cone"],
  ["🛍", "shopping-bag"],
  ["🤝", "handshake"], ["🧮", "calculator"], ["🧵", "spool"],
  ["🧻", "package"], ["🧾", "receipt-text"], ["✕", "x"], ["✖", "x"],
  ["✔", "check"], ["☰", "menu"], ["＋", "plus"]
]);

const EMOJI = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[☰✕✖✔＋▦]|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?\p{Emoji_Modifier}?)*)/gu;
const EMOJI_DETECTOR = /(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|[☰✕✖✔＋▦]|\p{Extended_Pictographic})/u;
const TEXT_ONLY = new Set(["SCRIPT", "STYLE", "TEXTAREA", "OPTION", "CODE", "PRE"]);
const COLOR_EMOJI = {
  "🔴": "var(--color-danger)",
  "🟡": "var(--color-warning)",
  "🟢": "var(--color-success)"
};

function iconName(emoji) {
  const normalizado = emoji.replace(/\uFE0F/g, "");
  return EMOJI_A_ICONO.get(normalizado) || "sparkles";
}

function reemplazarEmoji(nodo) {
  const texto = nodo.nodeValue;
  if (!EMOJI_DETECTOR.test(texto)) return false;
  EMOJI_DETECTOR.lastIndex = 0;
  const padre = nodo.parentElement;
  if (padre && TEXT_ONLY.has(padre.tagName)) {
    if (padre.tagName === "OPTION") nodo.nodeValue = texto.replace(EMOJI, "");
    return false;
  }

  const fragmento = document.createDocumentFragment();
  let anterior = 0;
  for (const coincidencia of texto.matchAll(EMOJI)) {
    if (coincidencia.index > anterior) {
      fragmento.appendChild(document.createTextNode(texto.slice(anterior, coincidencia.index)));
    }
    const icono = document.createElement("i");
    icono.className = "lucide-inline lucide-emoji";
    icono.dataset.lucide = iconName(coincidencia[0]);
    const color = COLOR_EMOJI[coincidencia[0].replace(/\uFE0F/g, "")];
    if (color) {
      icono.style.color = color;
      icono.classList.add("lucide-dot");
    }
    icono.setAttribute("aria-hidden", "true");
    fragmento.appendChild(icono);
    anterior = coincidencia.index + coincidencia[0].length;
  }
  if (anterior === 0) return false;
  if (anterior < texto.length) fragmento.appendChild(document.createTextNode(texto.slice(anterior)));
  nodo.replaceWith(fragmento);
  return true;
}

function procesarNodo(nodo) {
  let cambio = false;
  let contieneIcono = false;
  const revisar = actual => {
    if (actual.nodeType === Node.TEXT_NODE) {
      cambio = reemplazarEmoji(actual) || cambio;
      return;
    }
    if (actual.nodeType !== Node.ELEMENT_NODE || actual.matches("svg,script,style,textarea,code,pre")) return;
    contieneIcono = contieneIcono || actual.matches("i[data-lucide]") || !!actual.querySelector("i[data-lucide]");
    const caminante = document.createTreeWalker(actual, NodeFilter.SHOW_TEXT);
    const textos = [];
    while (caminante.nextNode()) textos.push(caminante.currentNode);
    textos.forEach(texto => { cambio = reemplazarEmoji(texto) || cambio; });
  };
  revisar(nodo);
  if (cambio || contieneIcono) {
    if (window.lucide) window.lucide.createIcons();
  }
}

procesarNodo(document.body);
new MutationObserver(cambios => {
  cambios.forEach(cambio => {
    if (cambio.type === "characterData") procesarNodo(cambio.target);
    else cambio.addedNodes.forEach(procesarNodo);
  });
}).observe(document.body, { childList: true, characterData: true, subtree: true });
