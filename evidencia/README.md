# Evidencia — Casos G-01 a G-07

Capturas y salidas de los casos de verificación ejecutados con datos ficticios.
Ocultá contraseñas y valores privados antes de guardarlas.

Las capturas se tomaron sobre el frontend servido por Nginx
(`http://127.0.0.1:8081`) reenviando `/api/` al backend FastAPI por la red
interna de Docker, y sobre la URL pública del backend por HTTPS.

## Archivos capturados

| Caso | Archivo | Qué muestra |
|---|---|---|
| G-01 | `g-01-catalogo-busqueda.png` | Catálogo con búsqueda por título |
| G-01 | `g-01-catalogo-sin-coincidencias.png` | Búsqueda sin resultados |
| G-01 | `g-01-libro-detalle.png` | Detalle de un libro con sus autores |
| G-02 | `g-02-alta-libro-201.png` | Alta de libro (`201`) con autoría |
| G-02 | `g-02-libro-isbn-409.png` | ISBN repetido → `409` |
| G-03 | `g-03-cliente-201.png` | Alta de cliente (`201`) |
| G-03 | `g-03-cliente-email-409.png` | Email repetido → `409` |
| G-04 | `g-04-venta-2-renglones-201.png` | Venta con dos renglones (`201`) |
| G-04 | `g-04-venta-detalle.png` | Detalle reabierto tras recargar |
| G-05 | `g-05-patch-precio.txt` | `PATCH /libros/1` y venta anterior con importes históricos |
| G-05 | `g-05-catalogo-precio-nuevo.png` | Catálogo con el precio actualizado |
| G-05 | `g-05-venta-importes-conservados.png` | Historial conservando los importes originales |
| G-06 | `g-06-rechazos.txt` | `409` por ID inexistente y `422` por renglones repetidos |
| G-06 | `g-06-id-inexistente-404.png` | Frontend mostrando un ID inexistente |
| G-06 | `g-06-historial-intacto.png` | Historial sin cambios tras los rechazos |
| G-07 | `g-07-despliegue.txt` | Build del frontend, salud `200` y datos tras el redespliegue |
| G-07 | `g-07-datos-tras-redespliegue.png` | UI con los datos disponibles tras el redespliegue |

## Notas

- **G-05 y G-06** se ejercitan contra la API (no hay formulario de PATCH en el
  frontend); la salida textual queda en `g-05-patch-precio.txt` y
  `g-06-rechazos.txt`.
- El estado del historial se conserva igual tras los rechazos de G-06 (una sola
  venta registrada).

Completá la tabla de la sección 9 de [`../DEPLOY.md`](../DEPLOY.md) a medida que
guardás cada captura.
