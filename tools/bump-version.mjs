/* Cambia la versión de los archivos (HTML, JS y CSS) para que el navegador no use copias viejas.
   Uso:  npm run bump            (usa la fecha y hora actual)
         npm run bump -- 20261201a   (o una versión que tú elijas) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indice = path.join(raiz, "index.html");
const html = fs.readFileSync(indice, "utf8");
const actual = (html.match(/<meta name="app-version" content="([^"]+)"/) || [])[1];
if (!actual) { console.error("No encontré <meta name=\"app-version\"> en index.html."); process.exit(1); }
const nueva = process.argv[2] || new Date().toISOString().replace(/\D/g, "").slice(0, 12);

const archivos = [indice, ...fs.readdirSync(path.join(raiz, "js")).filter(f => f.endsWith(".js")).map(f => path.join(raiz, "js", f))];
let cambiados = 0;
for (const archivo of archivos) {
  const texto = fs.readFileSync(archivo, "utf8");
  if (!texto.includes(actual)) continue;
  fs.writeFileSync(archivo, texto.split(actual).join(nueva));
  cambiados++;
}
console.log(`Versión ${actual} -> ${nueva} (${cambiados} archivos). Recuerda correr: npm run build:css`);
