# Librería El Estante — Global Programación III

Aplicación web **integrada** para la Evaluación Global de Programación III:
las pantallas del primer parcial (HTML, CSS y JavaScript nativos) conectadas a la
API de la Librería (FastAPI + PostgreSQL) y desplegadas con Docker en Easypanel.

El frontend ya no simula datos: consulta el catálogo, registra libros y clientes y
confirma ventas **contra la API**; los registros y los importes viven en PostgreSQL.

## Integrantes

- Xavier Pappalardo
- Lautaro Gómez
- Nicolás Ibáñez
- Maximiliano Reinoso
- Martín Sisterna
- Benjamín Arrollo

## Estructura del repositorio

```
libreria-global/
├── frontend/
│   ├── Dockerfile               Imagen Nginx del frontend
│   ├── .dockerignore
│   ├── default.conf.template    Plantilla de Nginx (proxy /api/ -> backend)
│   ├── env.example              Variable API_UPSTREAM de ejemplo
│   └── public/
│       ├── index.html
│       ├── css/                 base.css, layout.css, componentes.css, styles.css
│       └── js/app.js            Cliente HTTP e integración con la API
├── backend/
│   ├── app/                     Código FastAPI (módulos por dominio)
│   ├── requirements.txt
│   ├── Dockerfile               Imagen de la API
│   ├── .dockerignore
│   ├── env.example              Variables de ejemplo (DATABASE_URL, ...)
│   ├── pytest.ini
│   └── tests/
├── README.md
├── DEPLOY.md
└── evidencia/                   Capturas de los casos G-01 a G-07
```

## Cómo funciona la integración

- El navegador siempre llama a la **base pública `/api`** con `fetch`
  (por ejemplo `fetch("/api/libros/")`). Se conserva la barra final de las rutas
  que la traen.
- Nginx sirve `frontend/public/` y **reenvía `/api/`** al backend con
  `proxy_pass http://${API_UPSTREAM}/;`. La barra final hace que `/api/libros/`
  llegue a FastAPI como `/libros/`.
- La dirección interna del backend (`API_UPSTREAM`) se configura **en Nginx**
  (variable de entorno del contenedor), no en el JavaScript.

### Consultas por ID (decisión documentada)

La API no expone listados de **autores** ni de **clientes**; sólo consultas
individuales. Por eso, siguiendo la consigna:

- Los autores de una autoría se verifican con **`GET /autores/{id}`** antes de
  agregarlos al alta de un libro (se muestra el nombre devuelto).
- El cliente de una venta se verifica con **`GET /clientes/{id}`** antes de
  confirmarla (se muestra el nombre devuelto).
- Editoriales y géneros sí se cargan desde sus listados
  (`GET /editoriales/` y `GET /generos/`).

## Requisitos

- Docker (para el frontend y el backend) y, opcionalmente, Python 3.12 y
  PostgreSQL para desarrollo local sin Docker.
- Una base PostgreSQL (local o la asignada por Easypanel).

## Ejecutar en local

### 1. Backend (API)

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt

# Crear .env a partir de env.example y completar la cadena de conexión
# DATABASE_URL=postgresql+asyncpg://<usuario>:<password>@localhost:5432/<base>

# Al iniciar, la aplicación crea las tablas que falten (create_all)
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verificar salud: `GET http://127.0.0.1:8000/health/ready` → `200`.

### 2. Cargar los datos de prueba

Con el entorno virtual activo y la base configurada (en otra terminal):

```bash
cd backend
python -m app.seed
```

El comando es **idempotente**: si un registro ya existe no lo duplica. Con una base
vacía deja, entre otros:

- Editoriales: Sudamericana (1), Alfaguara (2)
- Géneros: Novela (1), Ensayo (2)
- Autores: Julio Cortázar (1), Adolfo Bioy Casares (2), Silvina Ocampo (3), Ricardo Piglia (4)
- Libros: Rayuela (1, $25.000), Los que aman odian (2), Bestiario (3), Respiración artificial (4, $27.000)
- Clientes: Ana Gómez (1, con perfil), Tomás Ríos (2)

Venta de ejemplo (dos renglones, total **$77.000**):

```json
{ "cliente_id": 2, "renglones": [ { "libro_id": 1, "cantidad": 2 }, { "libro_id": 4, "cantidad": 1 } ] }
```

### 3. Frontend (Nginx en Docker) contra el backend local

Desde `frontend/`, con el backend escuchando en el puerto 8000:

```bash
docker build -t libreria-frontend .
docker run --rm --name libreria-frontend -p 127.0.0.1:8080:80 ^
  --add-host=host.docker.internal:host-gateway ^
  -e API_UPSTREAM=host.docker.internal:8000 libreria-frontend
```

En PowerShell, poné el comando en una sola línea. En Docker Desktop podés omitir
`--add-host`. Luego abrí <http://127.0.0.1:8080> y comprobá que
<http://127.0.0.1:8080/api/health/ready> responde `200`.

## Uso de la interfaz

- **Catálogo**: buscar por título (parcial, sin distinguir mayúsculas) y paginar
  con *Anterior* / *Siguiente* (envía `limit` y `offset`; al cambiar el filtro se
  reinicia el desplazamiento). *Ver detalle* consulta `GET /libros/{id}` para
  mostrar los autores.
- **Libros**: alta con título, ISBN, precio, stock, editorial, género opcional y
  al menos una autoría (autor verificado por ID + rol). ISBN repetido → `409`.
- **Clientes**: alta con nombre y email. Email repetido → `409`.
- **Ventas**: verificar el cliente por ID, agregar renglones (un libro por
  renglón), confirmar. El botón se deshabilita durante el envío y el borrador se
  conserva si el servidor rechaza (`409`/`422`).
- **Historial**: listado paginado (`GET /ventas/?limit&offset`) y detalle
  histórico (`GET /ventas/{id}`) con los importes guardados por la API.

## Verificación y despliegue

Los casos **G-01 a G-07** y los pasos de despliegue en Easypanel están en
[`DEPLOY.md`](DEPLOY.md); las capturas, en [`evidencia/`](evidencia/).
