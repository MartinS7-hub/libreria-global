# DEPLOY.md — Despliegue de la Librería integrada en Easypanel

Documento de despliegue y verificación de la Evaluación Global de Programación III.

> Reemplazá los valores entre `«...»` al completar el despliegue (URL del
> frontend, revisión, día y hora). No incluyas contraseñas ni cadenas de
> conexión reales en este archivo ni en las capturas.

## 1. Resumen

| Dato | Valor |
|---|---|
| Aplicación | Librería El Estante (frontend + API) |
| Repositorio | `«URL-DEL-REPOSITORIO»` |
| Rama desplegada | `«rama»` |
| Revisión (commit) | `«hash-corto»` |
| Fecha y hora del despliegue | `«dd/mm/aaaa hh:mm»` |
| URL pública del frontend | `«https://...easypanel.host»` |
| URL pública del backend | `https://app-grupo2-libreria-backend.ldb9fn.easypanel.host` |
| Swagger de la API | `https://app-grupo2-libreria-backend.ldb9fn.easypanel.host/docs` |

## 2. Arquitectura del despliegue

```
Navegador ──HTTPS──> [Easypanel] ──HTTP:80──> Nginx (frontend)
                                                  │  sirve public/
                                                  └──/api/──HTTP──> Uvicorn (backend):8000
                                                                        │
                                                                        └──> PostgreSQL
```

- **Nginx (servicio `frontend`)**: sirve los archivos estáticos y reenvía `/api/`
  al backend por la red interna. El navegador sólo conoce el dominio del frontend.
- **Uvicorn (servicio `backend`)**: la API FastAPI. No necesita dominio público.
- **PostgreSQL**: base asignada al proyecto; el puerto queda privado.

## 3. Dos servicios App del mismo proyecto

### 3.1 Servicio `backend`

| Ajuste | Valor |
|---|---|
| Tipo | App |
| Build Path | `/backend` |
| Builder | Dockerfile |
| Ruta del Dockerfile | `Dockerfile` |
| Puerto interno | `8000` |
| Dominio | *(quitar el dominio automático; queda en la red interna)* |

Variables de entorno del backend (`Environment`):

| Nombre | Descripción |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://<usuario>:<password>@<host>:<puerto>/<base>` |
| `SQL_ECHO` | `false` en producción |

`env.example` del backend muestra la forma de estas variables (sin valores reales).

### 3.2 Servicio `frontend`

| Ajuste | Valor |
|---|---|
| Tipo | App |
| Build Path | `/frontend` |
| Builder | Dockerfile |
| Ruta del Dockerfile | `Dockerfile` |
| Puerto interno / destino | `80` |
| Protocolo interno | HTTP |
| Dominio | HTTPS asignado por Easypanel |

Variables de entorno del frontend (`Environment`):

| Nombre | Descripción | Ejemplo |
|---|---|---|
| `API_UPSTREAM` | Host y puerto internos del backend, **sin** `http://` ni barra final | `grupo5_backend:8000` |

El nombre interno depende de la instalación: para el proyecto `grupo5` y el
servicio `backend`, el valor es `grupo5_backend:8000`. Revisá el nombre exacto en
Easypanel.

## 4. Proxy y variables (cómo encaja cada pieza)

- `frontend/default.conf.template` contiene
  `location /api/ { proxy_pass http://${API_UPSTREAM}/; }`.
- El `Dockerfile` del frontend define `NGINX_ENVSUBST_FILTER=^API_UPSTREAM$`, de
  modo que Nginx sólo sustituye `API_UPSTREAM` al arrancar y no toca `$uri`,
  `$host`, etc.
- La **barra final** de `proxy_pass` recorta el prefijo: `/api/libros/` llega a
  FastAPI como `/libros/`. El cliente HTTP usa `/api` como base y conserva la
  barra final de las rutas del backend.

## 5. Esquema de base de datos (sin Alembic)

El backend **no usa migraciones** (`alembic.ini` / `migrations/` no forman parte
del proyecto). Al arrancar, el `lifespan` de `app/main.py` ejecuta
`SQLModel.metadata.create_all`, que **crea sólo las tablas que faltan**. Esto se
verifica en los logs del servicio `backend` con `Application startup complete.`.

Al ser `create_all` idempotente, un redespliegue no borra datos: las tablas
existentes y sus filas quedan intactas.

## 6. Carga inicial de datos (una vez)

Desde la **Shell** del servicio `backend` (o desde una terminal con la misma
`DATABASE_URL`):

```bash
python -m app.seed
```

Es idempotente y deja los datos ficticios de prueba (ver el `README.md`). Antes de
ejecutarlo sobre una base con datos, revisá qué tablas modifica.

## 7. Comprobación de salud

En la Shell del servicio `backend`:

```bash
URL=http://127.0.0.1:8000/health/ready
python -c "from urllib.request import urlopen; print(urlopen('$URL').status)"
# 200
```

Desde el navegador, sobre el dominio del frontend:

```
https://«URL-DEL-FRONTEND»/api/health/ready   -> 200
```

## 8. Actualización (redespliegue)

1. Subir los cambios a la rama desplegada.
2. En Easypanel, servicio `backend` → **Deploy**; esperar el build y revisar logs.
3. Servicio `frontend` → **Deploy**; esperar el build.
4. Verificar que `/api/health/ready` sigue en `200` y que **los datos siguen
   disponibles** (el historial conserva las ventas previas).

## 9. Casos de verificación (G-01 a G-07)

Ejecutar **desde la URL pública del frontend**, con datos ficticios. Registrar
pasos, resultado observado y captura en `evidencia/`. Ocultar valores privados.

| Caso | Pasos | Resultado esperado | Estado | Evidencia |
|---|---|---|---|---|
| **G-01 · Catálogo** | Buscar por título; avanzar con *Siguiente* (`limit`/`offset`); buscar algo sin coincidencias; *Ver detalle* de un libro | Lista paginada, mensaje de "sin coincidencias" y autores del libro | ☑ | `evidencia/g-01-catalogo-busqueda.png`, `g-01-catalogo-sin-coincidencias.png`, `g-01-libro-detalle.png` |
| **G-02 · Alta de libro** | Alta con stock, género y autorías; consultar detalle; repetir ISBN | `201` y libro creado; el ISBN repetido devuelve `409` | ☑ | `evidencia/g-02-alta-libro-201.png`, `g-02-libro-isbn-409.png` |
| **G-03 · Alta de cliente** | Alta de cliente; recuperarlo por ID; repetir email | `201` y cliente creado; el email repetido devuelve `409` | ☑ | `evidencia/g-03-cliente-201.png`, `g-03-cliente-email-409.png` |
| **G-04 · Venta** | Venta con dos renglones; recargar y abrir el detalle | `201`, total correcto y el detalle se conserva tras recargar | ☑ | `evidencia/g-04-venta-2-renglones-201.png`, `g-04-venta-detalle.png` |
| **G-05 · Precio histórico** | `PATCH /libros/{id}` con nuevo precio; abrir la venta anterior | La venta conserva sus importes originales | ☑ | `evidencia/g-05-patch-precio.txt`, `g-05-catalogo-precio-nuevo.png`, `g-05-venta-importes-conservados.png` |
| **G-06 · Rechazo** | Venta con libro inexistente (`409`) y con renglones repetidos (`422`) | Se muestran los mensajes del servidor y el historial no cambia | ☑ | `evidencia/g-06-rechazos.txt`, `g-06-id-inexistente-404.png`, `g-06-historial-intacto.png` |
| **G-07 · Despliegue** | Build del frontend; abrir la URL por HTTPS; `/api/health/ready`; redesplegar | La imagen se construye, la API responde `200` y los datos siguen tras el redespliegue | ☑ | `evidencia/g-07-despliegue.txt`, `g-07-datos-tras-redespliegue.png` |

Resultados observados (detalle):

- **G-01**: catálogo paginado con `limit`/`offset`; búsqueda "ra" filtra a los
  libros que coinciden; búsqueda "zzzz" muestra el mensaje de sin coincidencias;
  el detalle lista editorial, género, autores y precio.
- **G-02**: alta de «El Túnel» → `201` (ID 5) con autoría verificada por ID;
  repetir el ISBN `978-950-00-9999-1` → `409`
  (`Conflicto de integridad…`).
- **G-03**: alta de «Lucía Fernández» → `201` (ID 3); repetir su email → `409`.
- **G-04**: venta del cliente 2 con 2 renglones (Rayuela ×2 + Respiración
  artificial ×1) → `201`, total `$ 77.000,00`; el detalle se conserva tras
  recargar la página.
- **G-05**: `PATCH /libros/1` cambia el precio `25000.00 → 30000.00` (`200`); la
  venta anterior mantiene `precio_unitario 25000.00` y total `77000.00`.
- **G-06**: `libro_id`/`cliente_id` inexistente → `409`; renglones con el mismo
  libro → `422`; el historial sigue con una sola venta.
- **G-07**: la imagen del frontend se construye (`docker build` → exit 0); la API
  responde `200` en salud (local y público por HTTPS); tras el redespliegue los
  libros (5) y la venta (1) siguen disponibles.

### Notas para G-05 y G-06

- **G-05**: el precio se cambia con `PATCH /libros/{id}` (por ejemplo desde
  `/docs`). Las ventas guardan su propio `precio_unitario`, por lo que no cambian.
- **G-06**: un `cliente_id`/`libro_id` inexistente produce `409` (violación de
  clave foránea); renglones repetidos producen `422` (validación del esquema). El
  frontend muestra el `detail` del servidor y conserva el borrador.

## 10. Diagnóstico rápido

| Síntoma | Revisar |
|---|---|
| Falla un `COPY` del frontend | Build Path `/frontend`, nombres exactos y la carpeta `public/` |
| Nginx no arranca o `/api/` da `502` | Logs del frontend, `API_UPSTREAM`, nombre interno y puerto, backend en ejecución |
| `/api/health/ready` falla | Logs del backend, `DATABASE_URL` y conexión a PostgreSQL |
| Una petición de la API da `404` | En la pestaña Red: prefijo `/api` y la barra final de la ruta |
