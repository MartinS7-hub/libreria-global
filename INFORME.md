# Informe de entrega – Librería El Estante

**Materia:** Programación III – Evaluación Global  
**Proyecto:** Librería El Estante (aplicación web integrada)  
**Repositorio:** https://github.com/MartinS7-hub/libreria-global  
**Rama:** `main`  
**Fecha del informe:** 16/11/2026

## 1. Integrantes
- Xavier Pappalardo
- Lautaro Gómez
- Nicolás Ibáñez
- Maximiliano Reinoso
- Martín Sisterna
- Benjamín Arrollo

## 2. Objetivo
Desarrollar e integrar una aplicación web para la gestión de una librería, conectando las pantallas del frontend (HTML, CSS y JavaScript nativos) con una API REST desarrollada en FastAPI y una base de datos PostgreSQL. El sistema permite consultar el catálogo, registrar libros y clientes, y confirmar ventas, persistiendo registros e importes en la base de datos y desplegando la solución con Docker en EasyPanel.

## 3. Alcance y funcionalidades
La aplicación cubre los siguientes flujos, verificados mediante los casos G-01 a G-07:

| Caso | Funcionalidad | Resultado esperado |
|---|---|---|
| G-01 | Catálogo | Búsqueda por título, paginación (`limit`/`offset`), mensaje sin coincidencias y detalle de libro con sus autores. |
| G-02 | Alta de libro | Alta con stock, género y autorías (`201`); ISBN repetido rechazado (`409`). |
| G-03 | Alta de cliente | Alta y consulta por ID (`201`); email repetido rechazado (`409`). |
| G-04 | Venta | Confirmación con dos renglones (`201`), total correcto y detalle conservado tras recargar. |
| G-05 | Precio histórico | `PATCH /libros/{id}` actualiza el catálogo; la venta anterior conserva sus importes originales (`precio_unitario` histórico). |
| G-06 | Rechazos | Libro/cliente inexistente (`409`) y renglones repetidos (`422`); mensajes del servidor y historial intacto. |
| G-07 | Despliegue | Imagen construida, frontend accesible por HTTPS, `/api/health/ready` en `200` y datos persistentes tras redespliegue. |

## 4. Arquitectura y tecnologías

### 4.1 Arquitectura general
- **Cliente (navegador):** consume la aplicación vía HTTPS desde el dominio público del frontend.
- **Frontend (Nginx, contenedor Docker):** sirve los archivos estáticos de `frontend/public/` y actúa como proxy inverso de `/api/` hacia el backend en la red interna.
- **Backend (FastAPI + Uvicorn, contenedor Docker):** expone la API REST y la lógica de negocio.
- **Base de datos (PostgreSQL):** almacena la información de catálogo, clientes y ventas.

Flujo: `Navegador → HTTPS → Nginx (frontend) → /api → Uvicorn (backend:8000) → PostgreSQL`.

### 4.2 Tecnologías utilizadas
- **Frontend:** HTML5, CSS3, JavaScript nativo (ES modules/`fetch`), Nginx 1.30 (alpine).
- **Backend:** Python, FastAPI, SQLModel, SQLAlchemy (asyncio), `asyncpg`, Pydantic Settings, Uvicorn.
- **Base de datos:** PostgreSQL.
- **Contenedores y despliegue:** Docker, Docker Desktop (build local de imagen), EasyPanel (orquestación/hosting de servicios).
- **Pruebas:** `pytest`, `pytest-asyncio`, `httpx`, `aiosqlite`.

## 5. Estructura del repositorio
```
libreria-global/
├── frontend/
│   ├── Dockerfile
│   ├── default.conf.template      # Proxy Nginx: /api/ -> backend (API_UPSTREAM)
│   ├── env.example
│   ├── dev-proxy.mjs              # Servidor local de desarrollo (proxy /api)
│   └── public/
│       ├── index.html
│       ├── css/ (base, layout, componentes, styles)
│       └── js/app.js              # Cliente HTTP e integración con la API
├── backend/
│   ├── app/                       # FastAPI (core, módulos por dominio, seed)
│   │   └── modules/ (autores, clientes, editoriales, generos, health, libros, ventas)
│   ├── tests/                     # Pruebas automatizadas
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pytest.ini
├── evidencia/                     # Capturas y salidas G-01 a G-07
├── README.md
├── DEPLOY.md
└── INFORME.md
```

## 6. Integración frontend–backend
- El frontend consume la API usando la base pública **`/api`** (p. ej. `fetch("/api/libros/")`), conservando la barra final de las rutas que la traen.
- Nginx reenvía `/api/` al backend mediante `proxy_pass http://${API_UPSTREAM}/;`, por lo que el prefijo se recorta al llegar a FastAPI. La dirección interna del backend se configura con la variable de entorno `API_UPSTREAM` (formato `host:puerto`, sin esquema ni barra final).
- **Decisiones de integración documentadas:**
  - La API no expone listados de autores ni de clientes: se validan por consulta individual (`GET /autores/{id}`, `GET /clientes/{id}`) antes de registrar autorías/ventas, mostrando el nombre devuelto.
  - Editoriales y géneros se obtienen desde sus listados (`GET /editoriales/`, `GET /generos/`).
  - Las ventas almacenan su propio `precio_unitario`, por lo que cambios posteriores de precio en el catálogo no modifican importes históricos (G-05).

## 7. Backend y base de datos
- **API:** FastAPI con módulos por dominio (autores, clientes, editoriales, géneros, libros, ventas y health). Manejo centralizado de errores de integridad.
- **Ciclo de vida:** al iniciar, la aplicación crea el motor/fábrica de sesiones y ejecuta `SQLModel.metadata.create_all`, generando las tablas faltantes (enfoque idempotente, sin migraciones Alembic).
- **Datos de prueba:** script `python -m app.seed` (idempotente) que carga editoriales, géneros, autores, libros y clientes de ejemplo (IDs alineados a la consigna para reproducir la venta de referencia por $77.000).
- **Salud:** endpoint `GET /health/ready` para verificar disponibilidad de la aplicación y conexión a la base de datos.

## 8. Despliegue
El despliegue se realizó en **EasyPanel** con dos servicios dentro del mismo proyecto:

| Servicio | Build Path | Puerto interno | Configuración destacada |
|---|---|---|---|
| Backend | `/backend` | 8000 | `DATABASE_URL`, `SQL_ECHO=false`, red interna |
| Frontend | `/frontend` | 80 | Dominio HTTPS público, `API_UPSTREAM=<proyecto>_<servicio_backend>:8000` |

### 8.1 URLs públicas
- **Frontend:** https://app-grupo2-libreria-frontend.ldb9fn.easypanel.host/
- **Backend:** https://app-grupo2-libreria-backend.ldb9fn.easypanel.host
- **Documentación API (Swagger):** https://app-grupo2-libreria-backend.ldb9fn.easypanel.host/docs
- **Verificación de salud vía frontend:** https://app-grupo2-libreria-frontend.ldb9fn.easypanel.host/api/health/ready → `{"estado":"listo","database":"conectada"}`

### 8.2 Publicación del frontend
Para garantizar el despliegue del frontend en EasyPanel, se construyó la imagen Docker localmente con Docker Desktop a partir de `frontend/Dockerfile` y se publicó en Docker Hub (`263027/libreria-frontend:latest`), configurando el servicio en EasyPanel con origen **Docker Image**. El servicio quedó operativo y accesible públicamente, con el proxy `/api` funcionando contra el backend.

## 9. Verificación y evidencia
La verificación funcional y de despliegue se documenta en `DEPLOY.md` y en la carpeta `evidencia/` (casos G-01 a G-07), incluyendo capturas y salidas de las operaciones realizadas (altas, consultas, ventas, rechazos, actualización de precio y comprobaciones de salud/despliegue). Las verificaciones de G-07 confirman la construcción de la imagen, la respuesta `200` de salud y la disponibilidad/persistencia de datos, con el frontend publicado y verificado en EasyPanel el 16/11/2026.

## 10. Dificultades y resoluciones
- **Servicio frontend no disponible inicialmente en EasyPanel (falso positivo en G-07):** el backend se encontraba operativo, pero el servicio frontend no estaba levantado. Se resolvió construyendo y publicando la imagen Docker del frontend y configurando el servicio en EasyPanel (puerto 80, dominio HTTPS y `API_UPSTREAM` apuntando al backend interno), verificando acceso público y salud vía `/api/health/ready`.
- **Vinculación del repositorio en EasyPanel:** ante inconvenientes de validación/conexión del repositorio en el panel, se optó por el despliegue mediante **imagen Docker** desde un registro, lo que permitió publicar el servicio de forma confiable.
- **Pruebas locales contra backend remoto:** dado que el proxy Nginx del contenedor está orientado a la red interna HTTP, se utilizó un servidor de desarrollo (`frontend/dev-proxy.mjs`) para servir el frontend localmente y proxiar `/api` al backend público HTTPS durante las verificaciones.

## 11. Conclusiones
El proyecto cumple con la integración solicitada entre frontend, API y base de datos, permitiendo ejecutar los flujos de catálogo, altas y ventas con persistencia y validaciones acordes a las reglas de negocio verificadas (G-01 a G-06). Asimismo, la solución se encuentra desplegada y operativa en EasyPanel, con frontend y backend accesibles públicamente y comunicación correcta a través del proxy `/api` (G-07). La documentación (`README.md`, `DEPLOY.md`), la evidencia y el presente informe respaldan el estado final de la entrega.
