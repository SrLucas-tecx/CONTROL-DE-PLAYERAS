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
