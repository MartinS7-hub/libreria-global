# DEPLOY.md â€” Despliegue de la LibrerÃ­a integrada en Easypanel

Documento de despliegue y verificaciÃ³n de la EvaluaciÃ³n Global de ProgramaciÃ³n III.

> ReemplazÃ¡ los valores entre `Â«...Â»` al completar el despliegue (URL del
> frontend, revisiÃ³n, dÃ­a y hora). No incluyas contraseÃ±as ni cadenas de
> conexiÃ³n reales en este archivo ni en las capturas.

## 1. Resumen

| Dato | Valor |
|---|---|
| AplicaciÃ³n | LibrerÃ­a El Estante (frontend + API) |
| Repositorio | `https://github.com/MartinS7-hub/libreria-global` |
| Rama desplegada | `main` |
| RevisiÃ³n (commit) | `283c1b0` |
| Fecha y hora del despliegue | `15/11/2026 20:18` (frontend en EasyPanel verificado 16/11/2026) |
| URL pǧblica del frontend | `https://app-grupo2-libreria-frontend.ldb9fn.easypanel.host` |
| URL pÃºblica del backend | `https://app-grupo2-libreria-backend.ldb9fn.easypanel.host` |
| Swagger de la API | `https://app-grupo2-libreria-backend.ldb9fn.easypanel.host/docs` |

## 2. Arquitectura del despliegue

```
Navegador â”€â”€HTTPSâ”€â”€> [Easypanel] â”€â”€HTTP:80â”€â”€> Nginx (frontend)
                                                  â”‚  sirve public/
                                                  â””â”€â”€/api/â”€â”€HTTPâ”€â”€> Uvicorn (backend):8000
                                                                        â”‚
                                                                        â””â”€â”€> PostgreSQL
```

- **Nginx (servicio `frontend`)**: sirve los archivos estÃ¡ticos y reenvÃ­a `/api/`
  al backend por la red interna. El navegador sÃ³lo conoce el dominio del frontend.
- **Uvicorn (servicio `backend`)**: la API FastAPI. No necesita dominio pÃºblico.
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
| Dominio | *(quitar el dominio automÃ¡tico; queda en la red interna)* |

Variables de entorno del backend (`Environment`):

| Nombre | DescripciÃ³n |
|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://<usuario>:<password>@<host>:<puerto>/<base>` |
| `SQL_ECHO` | `false` en producciÃ³n |

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

| Nombre | DescripciÃ³n | Ejemplo |
|---|---|---|
| `API_UPSTREAM` | Host y puerto internos del backend, **sin** `http://` ni barra final | `app_grup02_libreria_backend:8000` |

El nombre interno sigue el patrÃ³n `<proyecto>_<servicio>`. En este despliegue el
proyecto es `app_grup02` y el servicio del backend es `libreria_backend`, por lo
que el valor es `app_grup02_libreria_backend:8000`. RevisÃ¡ el nombre exacto en
Easypanel (pestaÃ±a **Resumen** del servicio backend).

## 4. Proxy y variables (cÃ³mo encaja cada pieza)

- `frontend/default.conf.template` contiene
  `location /api/ { proxy_pass http://${API_UPSTREAM}/; }`.
- El `Dockerfile` del frontend define `NGINX_ENVSUBST_FILTER=^API_UPSTREAM$`, de
  modo que Nginx sÃ³lo sustituye `API_UPSTREAM` al arrancar y no toca `$uri`,
  `$host`, etc.
- La **barra final** de `proxy_pass` recorta el prefijo: `/api/libros/` llega a
  FastAPI como `/libros/`. El cliente HTTP usa `/api` como base y conserva la
  barra final de las rutas del backend.

## 5. Esquema de base de datos (sin Alembic)

El backend **no usa migraciones** (`alembic.ini` / `migrations/` no forman parte
del proyecto). Al arrancar, el `lifespan` de `app/main.py` ejecuta
`SQLModel.metadata.create_all`, que **crea sÃ³lo las tablas que faltan**. Esto se
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
ejecutarlo sobre una base con datos, revisÃ¡ quÃ© tablas modifica.

## 7. ComprobaciÃ³n de salud

En la Shell del servicio `backend`:

```bash
URL=http://127.0.0.1:8000/health/ready
python -c "from urllib.request import urlopen; print(urlopen('$URL').status)"
# 200
```

Desde el navegador, sobre el dominio del frontend:

```
https://Â«URL-DEL-FRONTENDÂ»/api/health/ready   -> 200
```

## 8. ActualizaciÃ³n (redespliegue)

1. Subir los cambios a la rama desplegada.
2. En Easypanel, servicio `backend` â†’ **Deploy**; esperar el build y revisar logs.
3. Servicio `frontend` â†’ **Deploy**; esperar el build.
4. Verificar que `/api/health/ready` sigue en `200` y que **los datos siguen
   disponibles** (el historial conserva las ventas previas).

## 9. Casos de verificaciÃ³n (G-01 a G-07)

Ejecutar **desde la URL pÃºblica del frontend**, con datos ficticios. Registrar
pasos, resultado observado y captura en `evidencia/`. Ocultar valores privados.

| Caso | Pasos | Resultado esperado | Estado | Evidencia |
|---|---|---|---|---|
| **G-01 Â· CatÃ¡logo** | Buscar por tÃ­tulo; avanzar con *Siguiente* (`limit`/`offset`); buscar algo sin coincidencias; *Ver detalle* de un libro | Lista paginada, mensaje de "sin coincidencias" y autores del libro | â˜‘ | `evidencia/g-01-catalogo-busqueda.png`, `g-01-catalogo-sin-coincidencias.png`, `g-01-libro-detalle.png` |
| **G-02 Â· Alta de libro** | Alta con stock, gÃ©nero y autorÃ­as; consultar detalle; repetir ISBN | `201` y libro creado; el ISBN repetido devuelve `409` | â˜‘ | `evidencia/g-02-alta-libro-201.png`, `g-02-libro-isbn-409.png` |
| **G-03 Â· Alta de cliente** | Alta de cliente; recuperarlo por ID; repetir email | `201` y cliente creado; el email repetido devuelve `409` | â˜‘ | `evidencia/g-03-cliente-201.png`, `g-03-cliente-email-409.png` |
| **G-04 Â· Venta** | Venta con dos renglones; recargar y abrir el detalle | `201`, total correcto y el detalle se conserva tras recargar | â˜‘ | `evidencia/g-04-venta-2-renglones-201.png`, `g-04-venta-detalle.png` |
| **G-05 Â· Precio histÃ³rico** | `PATCH /libros/{id}` con nuevo precio; abrir la venta anterior | La venta conserva sus importes originales | â˜‘ | `evidencia/g-05-patch-precio.txt`, `g-05-catalogo-precio-nuevo.png`, `g-05-venta-importes-conservados.png` |
| **G-06 Â· Rechazo** | Venta con libro inexistente (`409`) y con renglones repetidos (`422`) | Se muestran los mensajes del servidor y el historial no cambia | â˜‘ | `evidencia/g-06-rechazos.txt`, `g-06-id-inexistente-404.png`, `g-06-historial-intacto.png` |
| **G-07 Â· Despliegue** | Build del frontend; abrir la URL por HTTPS; `/api/health/ready`; redesplegar | La imagen se construye, la API responde `200` y los datos siguen tras el redespliegue | â˜‘ | `evidencia/g-07-despliegue.txt`, `g-07-datos-tras-redespliegue.png` |

Resultados observados (detalle):

- **G-01**: catÃ¡logo paginado con `limit`/`offset`; bÃºsqueda "ra" filtra a los
  libros que coinciden; bÃºsqueda "zzzz" muestra el mensaje de sin coincidencias;
  el detalle lista editorial, gÃ©nero, autores y precio.
- **G-02**: alta de Â«El TÃºnelÂ» â†’ `201` (ID 5) con autorÃ­a verificada por ID;
  repetir el ISBN `978-950-00-9999-1` â†’ `409`
  (`Conflicto de integridadâ€¦`).
- **G-03**: alta de Â«LucÃ­a FernÃ¡ndezÂ» â†’ `201` (ID 3); repetir su email â†’ `409`.
- **G-04**: venta del cliente 2 con 2 renglones (Rayuela Ã—2 + RespiraciÃ³n
  artificial Ã—1) â†’ `201`, total `$ 77.000,00`; el detalle se conserva tras
  recargar la pÃ¡gina.
- **G-05**: `PATCH /libros/1` cambia el precio `25000.00 â†’ 30000.00` (`200`); la
  venta anterior mantiene `precio_unitario 25000.00` y total `77000.00`.
- **G-06**: `libro_id`/`cliente_id` inexistente â†’ `409`; renglones con el mismo
  libro â†’ `422`; el historial sigue con una sola venta.
- **G-07**: la imagen del frontend se construye (`docker build` ��' exit 0); la API
  responde `200` en salud (local y pǧblico por HTTPS); tras el redespliegue los
  libros (5) y la venta (1) siguen disponibles. Frontend publicado en EasyPanel
  (`263027/libreria-frontend:latest`) y verificado 16/11/2026:
  `https://app-grupo2-libreria-frontend.ldb9fn.easypanel.host/` → `200` y
  `/api/health/ready` → `{"estado":"listo","database":"conectada"}`.

### Notas para G-05 y G-06

- **G-05**: el precio se cambia con `PATCH /libros/{id}` (por ejemplo desde
  `/docs`). Las ventas guardan su propio `precio_unitario`, por lo que no cambian.
- **G-06**: un `cliente_id`/`libro_id` inexistente produce `409` (violaciÃ³n de
  clave forÃ¡nea); renglones repetidos producen `422` (validaciÃ³n del esquema). El
  frontend muestra el `detail` del servidor y conserva el borrador.

## 10. DiagnÃ³stico rÃ¡pido

| SÃ­ntoma | Revisar |
|---|---|
| Falla un `COPY` del frontend | Build Path `/frontend`, nombres exactos y la carpeta `public/` |
| Nginx no arranca o `/api/` da `502` | Logs del frontend, `API_UPSTREAM`, nombre interno y puerto, backend en ejecuciÃ³n |
| `/api/health/ready` falla | Logs del backend, `DATABASE_URL` y conexiÃ³n a PostgreSQL |
| Una peticiÃ³n de la API da `404` | En la pestaÃ±a Red: prefijo `/api` y la barra final de la ruta |
