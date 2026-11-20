# RULE 34 Store Phones

Sitio estático para GitHub Pages: no requiere Flask, Python ni instalación de dependencias. El carrito y el pago de demostración usan JavaScript y `localStorage` del navegador. No se realizan cobros ni se envían ni guardan datos reales de tarjeta.

## Publicar en GitHub Pages

1. Crea un repositorio público en GitHub y sube los archivos del proyecto.
2. En **Settings → Pages**, elige **Deploy from a branch**, la rama `main` y la carpeta `/ (root)`.
3. Abre la URL que GitHub Pages genere; `index.html` redirige a `PIA.html`.

Para probarlo localmente, usa Live Server en VS Code. No abras las páginas directamente con `file://`, porque el navegador puede bloquear la lectura de `productos.json`.

Las imágenes de productos se referencian desde `productos.json`. Si los archivos de imagen no están en el repositorio, se mostrará `producto-placeholder.svg`; agrega las imágenes junto a los HTML para ver las fotos reales.

Las fichas técnicas muestran marca, RAM y cámaras a partir de las especificaciones publicadas por Apple, Samsung, Xiaomi/POCO y Motorola. Apple no publica la RAM, por lo que esos valores se identifican como datos de terceros. Las configuraciones de RAM pueden variar según región y versión; modelos sin identificación o especificaciones confirmables aparecen como no confirmados.

## Importar 5 productos con Python

Ejecuta `python scrapear_productos.py` en la carpeta del proyecto y proporciona cinco URLs públicas de páginas de producto. El importador usa solo la biblioteca estándar de Python, respeta `robots.txt` y toma metadatos estructurados JSON-LD cuando están disponibles; te pedirá completar o confirmar datos que falten. Guarda las imágenes como `producto-placeholder.svg` para que agregues imágenes propias o con permiso de uso.

Al terminar, `productos.json` conserva los productos existentes y añade los cinco nuevos. La tienda los muestra al leer ese archivo; para GitHub Pages, sube el `productos.json` actualizado. Python solo se necesita para ejecutar el importador localmente, no para publicar la página.

## Inventario de demostración

Cada producto define su existencia inicial en `productos.json`. Las compras de demostración descuentan unidades y guardan el inventario en `localStorage` del navegador. El inventario no se comparte entre personas o dispositivos, y borrar los datos del sitio lo reinicia a los valores iniciales del JSON. El pago en tienda se considera completado al generar la referencia simulada; no se verifica un pago físico real.
