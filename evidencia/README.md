# Evidencia — Casos G-01 a G-07

Capturas de los casos de verificación ejecutados **desde la URL pública del
frontend**. Ocultá contraseñas y valores privados antes de guardarlas.

## Convención de nombres

```
g-01-catalogo-busqueda.png
g-01-catalogo-sin-coincidencias.png
g-02-alta-libro-201.png
g-02-libro-isbn-409.png
g-03-alta-cliente-201.png
g-03-cliente-email-409.png
g-04-venta-201-dos-renglones.png
g-04-venta-detalle-tras-recargar.png
g-05-precio-historico.png
g-06-rechazo-409.png
g-06-rechazo-422.png
g-07-url-https.png
g-07-health-ready-200.png
g-07-datos-tras-redespliegue.png
```

## Qué debe mostrar cada captura

- **G-01**: catálogo con paginación, una búsqueda sin coincidencias y el detalle
  de un libro con sus autores.
- **G-02**: mensaje de éxito del alta (`201`) y el mensaje del servidor al repetir
  el ISBN (`409`).
- **G-03**: alta de cliente (`201`), recuperación por ID y el `409` al repetir el
  email.
- **G-04**: venta con dos renglones (`201`) y el detalle reabierto **después de
  recargar** la página.
- **G-05**: `PATCH /libros/{id}` con el nuevo precio y la venta anterior
  conservando sus importes.
- **G-06**: mensaje del servidor con un ID inexistente (`409`) y con renglones
  repetidos (`422`), e historial sin cambios.
- **G-07**: la URL pública por HTTPS, `/api/health/ready` en `200` y los datos
  disponibles tras el redespliegue.

Completá la tabla de la sección 9 de [`../DEPLOY.md`](../DEPLOY.md) a medida que
guardás cada captura.
