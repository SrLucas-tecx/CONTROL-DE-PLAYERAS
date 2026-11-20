# CONTROL-DE-PLAYERAS

Panel de control de playeras para LUCXSTUDIO.

## Estructura del proyecto

- `index.html`: página principal de la aplicación.
- `js/`: módulos JavaScript de la aplicación.
- `css/`: hojas de estilo fuente.
- `dist/`: CSS compilado que carga la página.
- `assets/images/`: logotipos e iconos.
- `assets/docs/`: documentos PDF.
- `site.webmanifest`: configuración de la aplicación instalable.

## Compilar CSS

Instala las dependencias y compila los estilos con Tailwind CSS CLI:

```bash
npm install
npm run build:css
```

La compilación toma `css/styles.css` y `css/redesign-bundle.css`, que importa
`css/redesign.css` seguido de `css/layout-fix.css`, y genera `dist/styles.css`
y `dist/redesign.css`, que son los archivos que carga la aplicación. Ejecuta
`npm run build:css` después de cambiar los CSS fuente.

## Caja del Modo Bazar

Selecciona el bazar (o caja general) y abre el turno indicando el fondo inicial.
Agrega productos al carrito y pulsa **Cobrar** para capturar efectivo recibido,
pago con tarjeta o una combinación de ambos; el sistema calcula el cambio y
actualiza el inventario después de confirmar. Al terminar el turno, cierra la
caja capturando el efectivo contado para comparar el corte. Los pagos con
tarjeta se registran en la aplicación, pero no se procesan con una terminal
bancaria.

Al registrar una playera con **Venta rápida**, puedes elegir opcionalmente un
cliente; la venta queda marcada como **Vendida**, se descuenta del stock y se
agrega al historial de compras de ese cliente. También puedes asociar un cliente
desde el formulario de la playera en Inventario; al marcarla como vendida,
aparecerá en el mismo historial. Las cotizaciones siguen apareciendo por separado.

## Bloques de inventario para bazares

En **Inventario → Bloques para bazar** puedes crear listas por temática, asignarlas
a un bazar, definir una meta de playeras y elegir etiquetas existentes para indicar
cuántas planeas llevar de cada una. También puedes elegir **Otros** para crear una
etiqueta con nombre y color desde el mismo bloque. La vista muestra el
avance, una barra roja/amarilla/verde según el avance, una temática a la vez con
opción para ver el resto y el stock actual por temática. Estos bloques son solo
registros de planeación: no reservan ni descuentan stock y no afectan ventas.
También puedes agregar de una vez todas las playeras disponibles o las
consignaciones: playeras propias en consignación y productos externos recibidos.
En estos últimos se incluyen unidades asignadas a bazares y las que siguen sin
asignar. Si una playera tiene varias etiquetas, elige una para evitar contarla en
más de una temática; las que no tienen etiqueta quedan agrupadas como
**Sin etiqueta**.
En **Ver detalles** puedes cambiar la temática de una playera para ese bloque;
esto no modifica sus etiquetas en el inventario.

Para agregar otra temática, crea una etiqueta desde el mismo bloque o en
**Inventario → Etiquetas y colores** y elige su color. La etiqueta se guarda aunque
todavía no tenga playeras; puedes asignarlas después desde el formulario de cada
prenda. Los cambios se reflejan de inmediato en los filtros y bloques, también en
otras pestañas abiertas del mismo navegador. Usa **Ver detalles** para consultar las playeras, los productos
consignados y las unidades agregadas a cada temática.

## Respaldos JSON

La aplicación guarda los cambios en el almacenamiento del navegador. Para crear
un archivo transferible, abre **Respaldo de datos** y selecciona **Descargar
todo (JSON)**. El respaldo completo incluye los datos guardados de todas las
secciones, como clientes, cotizaciones, inventario, finanzas, bazares y ajustes.
También puedes descargar secciones individuales, incluida la de clientes y
finanzas. Para restaurar o transferir datos, importa el archivo JSON desde el
menú de respaldo y elige combinar o reemplazar cuando se solicite.

Descarga periódicamente el respaldo completo y conserva una copia fuera de este
dispositivo; el archivo descargado no se actualiza automáticamente.
