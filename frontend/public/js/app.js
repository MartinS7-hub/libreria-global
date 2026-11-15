// Librería El Estante — Global Programación III.
// Integración del frontend (HTML/CSS/JS nativo) con la API FastAPI.
// Base pública de la API: /api (Nginx reenvía /api/ -> backend).
// Se conserva la barra final de las rutas que la traen (por ejemplo /api/libros/).

const API_BASE = "/api";

// ============================================================
// 1. Cliente HTTP centralizado
// ============================================================

class ErrorDeApi extends Error {
  constructor(mensaje, status, cuerpo) {
    super(mensaje);
    this.name = "ErrorDeApi";
    this.status = status;
    this.cuerpo = cuerpo;
  }
}

// Traduce el cuerpo de error del backend a un mensaje legible.
// El backend responde 409 con {"detail": "..."} y 422 con {"detail": [...]}.
function mensajeDeRespuesta(status, cuerpo) {
  const detalle = cuerpo && cuerpo.detail !== undefined ? cuerpo.detail : null;

  if (typeof detalle === "string") return detalle;

  if (Array.isArray(detalle)) {
    const partes = detalle
      .map(item => (item && item.msg ? String(item.msg) : JSON.stringify(item)))
      .filter(Boolean);
    if (partes.length) return partes.join(" · ");
  }

  if (status === 404) return "No se encontró el recurso solicitado (404).";
  if (status === 409) return "Conflicto: el dato ya existe o la referencia no es válida (409).";
  if (status === 422) return "Los datos enviados no son válidos (422).";
  return `La operación falló (HTTP ${status}).`;
}

// pedir("/libros/") -> GET; pedir("/libros/", { cuerpo }) -> POST con JSON.
async function pedir(ruta, opciones = {}) {
  const { cuerpo, ...resto } = opciones;
  const config = { ...resto };

  if (cuerpo !== undefined) {
    config.method = config.method || "POST";
    config.body = JSON.stringify(cuerpo);
    config.headers = { "Content-Type": "application/json", ...(config.headers || {}) };
  }

  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE}${ruta}`, config);
  } catch (error) {
    throw new ErrorDeApi(
      "No se pudo conectar con el servidor. Verificá que la API esté disponible.",
      0
    );
  }

  const texto = await respuesta.text();
  let datos = null;
  if (texto) {
    try {
      datos = JSON.parse(texto);
    } catch (error) {
      datos = null;
    }
  }

  if (!respuesta.ok) {
    throw new ErrorDeApi(mensajeDeRespuesta(respuesta.status, datos), respuesta.status, datos);
  }
  return datos;
}

// ============================================================
// 2. Utilidades de interfaz
// ============================================================

const formateadorPrecio = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2
});

function formatearPrecio(valor) {
  const numero = Number(valor);
  return formateadorPrecio.format(Number.isFinite(numero) ? numero : 0);
}

function formatearFecha(iso) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? String(iso) : fecha.toLocaleString("es-AR");
}

function mostrar(elemento) {
  const el = typeof elemento === "string" ? document.querySelector(elemento) : elemento;
  if (el) el.hidden = false;
}

function ocultar(elemento) {
  const el = typeof elemento === "string" ? document.querySelector(elemento) : elemento;
  if (el) el.hidden = true;
}

function mostrarTexto(elemento, texto) {
  const el = typeof elemento === "string" ? document.querySelector(elemento) : elemento;
  if (!el) return;
  el.textContent = texto;
  el.hidden = false;
}

// ============================================================
// 3. Estado en memoria
// ============================================================

const estado = {
  catalogo: { titulo: "", limit: 20, offset: 0 },
  historial: { limit: 20, offset: 0 },
  editoriales: [],
  generos: [],
  librosPorId: new Map(),
  autorias: [], // [{ autor_id, nombre, rol }]  (orden = posición + 1)
  clienteVenta: null, // { id, nombre }
  renglones: [], // [{ libro_id, titulo, cantidad }]
  clientesConocidos: new Map() // id -> { id, nombre, email }
};

// ============================================================
// 4. Catálogo (Ejercicio 1)
// ============================================================

async function cargarCatalogo() {
  const { titulo, limit, offset } = estado.catalogo;
  mostrar("#catalogo-cargando");
  ocultar("#catalogo-error");
  ocultar("#catalogo-vacio");
  ocultar("#catalogo-sin-resultados");

  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (titulo) params.set("titulo", titulo);

    const libros = await pedir(`/libros/?${params.toString()}`);
    libros.forEach(libro => estado.librosPorId.set(libro.id, libro));
    renderCatalogo(libros);
    actualizarPaginacionCatalogo(libros);
  } catch (error) {
    document.getElementById("catalogo-listado").replaceChildren();
    mostrarTexto("#catalogo-error", error.message);
    ocultar("#catalogo-paginacion");
  } finally {
    ocultar("#catalogo-cargando");
  }
}

function renderCatalogo(libros) {
  const contenedor = document.getElementById("catalogo-listado");
  const plantilla = document.getElementById("plantilla-libro");
  contenedor.replaceChildren();

  if (libros.length === 0) {
    if (estado.catalogo.titulo) mostrar("#catalogo-sin-resultados");
    else mostrar("#catalogo-vacio");
    return;
  }

  ocultar("#catalogo-vacio");
  ocultar("#catalogo-sin-resultados");

  libros.forEach(libro => {
    const clone = plantilla.content.cloneNode(true);
    const article = clone.querySelector(".libro");

    article.querySelector(".libro__titulo").textContent = libro.titulo;
    article.querySelector(".libro__isbn").textContent = libro.isbn;
    article.querySelector(".libro__editorial").textContent = libro.editorial
      ? libro.editorial.nombre
      : "—";
    article.querySelector(".libro__genero").textContent = libro.genero
      ? libro.genero.nombre
      : "Sin clasificar";
    article.querySelector(".libro__precio").textContent = formatearPrecio(libro.precio);

    // Los autores se cargan al abrir el detalle (GET /libros/{id}).
    const celdaAutores = article.querySelector(".libro__autores");
    celdaAutores.textContent = "Consultá el detalle";

    const boton = article.querySelector(".boton--detalle");
    boton.addEventListener("click", () => mostrarDetalleLibro(libro.id, celdaAutores, boton));

    contenedor.appendChild(clone);
  });
}

async function mostrarDetalleLibro(libroId, celda, boton) {
  boton.disabled = true;
  boton.textContent = "Cargando…";
  try {
    const libro = await pedir(`/libros/${libroId}`);
    estado.librosPorId.set(libro.id, libro);
    celda.textContent = nombresAutores(libro) || "Sin autores registrados";
    boton.textContent = "Detalle cargado";
  } catch (error) {
    celda.textContent = `Error: ${error.message}`;
    boton.disabled = false;
    boton.textContent = "Reintentar detalle";
  }
}

function nombresAutores(libro) {
  if (!libro || !Array.isArray(libro.autorias)) return "";
  return libro.autorias
    .map(a => (a.autor && a.autor.nombre ? a.autor.nombre : `Autor #${a.autor_id}`))
    .join(", ");
}

function actualizarPaginacionCatalogo(libros) {
  const { limit, offset } = estado.catalogo;

  // Sin resultados no hay nada que paginar: se oculta el bloque completo.
  if (libros.length === 0) {
    ocultar("#catalogo-paginacion");
    return;
  }

  const pagina = Math.floor(offset / limit) + 1;
  document.getElementById("catalogo-pagina").textContent =
    `Página ${pagina} · ${libros.length} libro(s)`;
  document.getElementById("catalogo-anterior").disabled = offset <= 0;
  document.getElementById("catalogo-siguiente").disabled = libros.length < limit;
  mostrar("#catalogo-paginacion");
}

function inicializarCatalogo() {
  const buscador = document.getElementById("buscador-titulo");
  let temporizador = null;

  const buscar = () => {
    estado.catalogo.titulo = buscador.value.trim();
    estado.catalogo.offset = 0; // al cambiar el filtro, se reinicia el desplazamiento
    cargarCatalogo();
  };

  buscador.addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(buscar, 300);
  });

  document.getElementById("form-busqueda").addEventListener("submit", evento => {
    evento.preventDefault();
    clearTimeout(temporizador);
    buscar();
  });

  document.getElementById("catalogo-anterior").addEventListener("click", () => {
    estado.catalogo.offset = Math.max(0, estado.catalogo.offset - estado.catalogo.limit);
    cargarCatalogo();
  });

  document.getElementById("catalogo-siguiente").addEventListener("click", () => {
    estado.catalogo.offset += estado.catalogo.limit;
    cargarCatalogo();
  });
}

// ============================================================
// 5. Catálogos auxiliares: editoriales y géneros (Ejercicio 2)
// ============================================================

async function cargarCatalogosAuxiliares() {
  try {
    const [editoriales, generos] = await Promise.all([
      pedir("/editoriales/?limit=100&offset=0"),
      pedir("/generos/")
    ]);
    estado.editoriales = editoriales;
    estado.generos = generos;
    poblarSelectEditorial();
    poblarSelectGenero();
  } catch (error) {
    console.warn("[catálogos] No se pudieron cargar editoriales/géneros:", error.message);
  }
}

function agregarOpcion(select, valor, texto) {
  const opcion = document.createElement("option");
  opcion.value = valor;
  opcion.textContent = texto;
  select.appendChild(opcion);
}

function poblarSelectEditorial() {
  const select = document.getElementById("libro-editorial");
  select.replaceChildren();
  agregarOpcion(select, "", "Seleccioná una editorial");
  estado.editoriales.forEach(editorial =>
    agregarOpcion(select, String(editorial.id), editorial.nombre)
  );
}

function poblarSelectGenero() {
  const select = document.getElementById("libro-genero");
  select.replaceChildren();
  agregarOpcion(select, "", "Sin clasificar");
  estado.generos.forEach(genero => agregarOpcion(select, String(genero.id), genero.nombre));
}

// ============================================================
// 6. Autorías por ID de autor (GET /autores/{id}) — Ejercicio 2
// ============================================================

async function agregarAutoria() {
  const mensaje = document.getElementById("libro-autoria-mensaje");
  ocultar(mensaje);

  const autorId = Number(document.getElementById("libro-autor-id").value.trim());
  const rol = document.getElementById("libro-autor-rol").value;

  if (!Number.isInteger(autorId) || autorId <= 0) {
    mostrarTexto(mensaje, "Ingresá un ID de autor entero mayor que cero.");
    return;
  }

  // La clave primaria de libro_autor es (libro_id, autor_id): un autor no puede repetirse.
  if (estado.autorias.some(a => a.autor_id === autorId)) {
    mostrarTexto(mensaje, "Ese autor ya está cargado en la lista.");
    return;
  }

  try {
    const autor = await pedir(`/autores/${autorId}`);
    estado.autorias.push({ autor_id: autor.id, nombre: autor.nombre, rol });
    document.getElementById("libro-autor-id").value = "";
    renderAutorias();
  } catch (error) {
    mostrarTexto(
      mensaje,
      error.status === 404 ? `No existe un autor con ID ${autorId} (404).` : error.message
    );
  }
}

function renderAutorias() {
  const cuerpo = document.getElementById("tabla-autorias-cuerpo");
  const plantilla = document.getElementById("plantilla-autoria");
  cuerpo.replaceChildren();

  estado.autorias.forEach((autoria, indice) => {
    const clone = plantilla.content.cloneNode(true);
    const fila = clone.querySelector(".fila-autoria");

    fila.querySelector(".fila-autoria__autor").textContent =
      `${autoria.nombre} (#${autoria.autor_id})`;
    fila.querySelector(".fila-autoria__rol").textContent = autoria.rol;
    fila.querySelector(".fila-autoria__orden").textContent = String(indice + 1);
    fila.querySelector(".boton--quitar").addEventListener("click", () => {
      estado.autorias.splice(indice, 1);
      renderAutorias();
    });

    cuerpo.appendChild(clone);
  });
}

// ============================================================
// 7. Alta de libros (POST /libros/) — Ejercicio 2
// ============================================================

async function registrarLibro(evento) {
  evento.preventDefault();
  const exito = document.getElementById("libro-mensaje-exito");
  const error = document.getElementById("libro-mensaje-error");
  const boton = document.querySelector("#form-libro button[type=submit]");
  ocultar(exito);
  ocultar(error);

  const titulo = document.getElementById("libro-titulo").value.trim();
  const isbn = document.getElementById("libro-isbn").value.trim();
  const precioTexto = document.getElementById("libro-precio").value.trim();
  const precio = precioTexto === "" ? NaN : Number(precioTexto);
  const stockTexto = document.getElementById("libro-stock").value.trim();
  const stock = stockTexto === "" ? 0 : Number(stockTexto);
  const editorialTexto = document.getElementById("libro-editorial").value;
  const generoTexto = document.getElementById("libro-genero").value;

  const problemas = [];
  if (!titulo) problemas.push("El título no puede estar vacío.");
  if (!isbn) problemas.push("El ISBN no puede estar vacío.");
  if (!Number.isFinite(precio) || precio <= 0) {
    problemas.push("El precio debe ser un número mayor que cero.");
  }
  if (!Number.isInteger(stock) || stock < 0) {
    problemas.push("El stock debe ser un entero mayor o igual que cero.");
  }
  if (!editorialTexto) problemas.push("Seleccioná una editorial.");
  if (estado.autorias.length === 0) problemas.push("Cargá al menos una autoría.");

  if (problemas.length) {
    mostrarTexto(error, problemas.join(" "));
    return;
  }

  const cuerpo = {
    isbn,
    titulo,
    precio,
    stock,
    editorial_id: Number(editorialTexto),
    genero_id: generoTexto ? Number(generoTexto) : null,
    autores: estado.autorias.map((autoria, indice) => ({
      autor_id: autoria.autor_id,
      rol: autoria.rol,
      orden: indice + 1
    }))
  };

  boton.disabled = true;
  boton.textContent = "Registrando…";
  try {
    const libro = await pedir("/libros/", { cuerpo });
    document.getElementById("form-libro").reset();
    estado.autorias = [];
    renderAutorias();
    mostrarTexto(exito, `Libro registrado: «${libro.titulo}» (ID ${libro.id}).`);
    await Promise.all([cargarCatalogo(), cargarLibrosParaVenta()]);
  } catch (err) {
    mostrarTexto(error, err.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Registrar libro";
  }
}

// ============================================================
// 8. Alta de clientes (POST /clientes/) — Ejercicio 2
// ============================================================

function registrarClienteConocido(cliente) {
  estado.clientesConocidos.set(cliente.id, {
    id: cliente.id,
    nombre: cliente.nombre,
    email: cliente.email
  });
  renderClientes();
}

function renderClientes() {
  const cuerpo = document.getElementById("tabla-clientes-cuerpo");
  cuerpo.replaceChildren();

  [...estado.clientesConocidos.values()].forEach(cliente => {
    const fila = document.createElement("tr");
    [String(cliente.id), cliente.nombre, cliente.email].forEach(texto => {
      const celda = document.createElement("td");
      celda.textContent = texto;
      fila.appendChild(celda);
    });
    cuerpo.appendChild(fila);
  });
}

async function registrarCliente(evento) {
  evento.preventDefault();
  const exito = document.getElementById("cliente-mensaje-exito");
  const error = document.getElementById("cliente-mensaje-error");
  const boton = document.querySelector("#form-cliente button[type=submit]");
  ocultar(exito);
  ocultar(error);

  const nombre = document.getElementById("cliente-nombre").value.trim();
  const email = document.getElementById("cliente-email").value.trim();

  const problemas = [];
  if (!nombre) problemas.push("El nombre no puede estar vacío.");
  if (!email) problemas.push("El email no puede estar vacío.");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    problemas.push("El email no tiene un formato válido.");
  }

  if (problemas.length) {
    mostrarTexto(error, problemas.join(" "));
    return;
  }

  boton.disabled = true;
  boton.textContent = "Registrando…";
  try {
    const cliente = await pedir("/clientes/", { cuerpo: { nombre, email } });
    document.getElementById("form-cliente").reset();
    registrarClienteConocido(cliente);
    mostrarTexto(exito, `Cliente registrado: ${cliente.nombre} (ID ${cliente.id}).`);
  } catch (err) {
    mostrarTexto(error, err.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Registrar cliente";
  }
}

// ============================================================
// 9. Ventas (Ejercicio 3)
// ============================================================

async function cargarLibrosParaVenta() {
  try {
    const libros = await pedir("/libros/?limit=100&offset=0");
    libros.forEach(libro => estado.librosPorId.set(libro.id, libro));

    const select = document.getElementById("renglon-libro");
    select.replaceChildren();
    agregarOpcion(select, "", "Seleccioná un libro");
    libros.forEach(libro =>
      agregarOpcion(select, String(libro.id), `${libro.titulo} — ${libro.isbn}`)
    );
  } catch (error) {
    console.warn("[ventas] No se pudo cargar el catálogo para ventas:", error.message);
  }
}

// Verifica el cliente con GET /clientes/{id} y muestra su nombre (consigna).
async function verificarCliente() {
  const estadoCliente = document.getElementById("venta-cliente-nombre");
  const clienteId = Number(document.getElementById("venta-cliente-id").value.trim());

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    estado.clienteVenta = null;
    estadoCliente.className = "mensaje mensaje--error";
    mostrarTexto(estadoCliente, "Ingresá un ID de cliente entero mayor que cero.");
    return;
  }

  try {
    const cliente = await pedir(`/clientes/${clienteId}`);
    estado.clienteVenta = { id: cliente.id, nombre: cliente.nombre };
    estadoCliente.className = "mensaje mensaje--exito";
    mostrarTexto(estadoCliente, `Cliente verificado: ${cliente.nombre} (ID ${cliente.id}).`);
    registrarClienteConocido(cliente);
  } catch (error) {
    estado.clienteVenta = null;
    estadoCliente.className = "mensaje mensaje--error";
    mostrarTexto(
      estadoCliente,
      error.status === 404 ? `No existe un cliente con ID ${clienteId} (404).` : error.message
    );
  }
}

function agregarRenglon() {
  const exito = document.getElementById("venta-mensaje-exito");
  const error = document.getElementById("venta-mensaje-error");
  ocultar(exito);
  ocultar(error);

  const libroId = Number(document.getElementById("renglon-libro").value);
  const cantidadTexto = document.getElementById("renglon-cantidad").value.trim();
  const cantidad = cantidadTexto === "" ? NaN : Number(cantidadTexto);

  if (!Number.isInteger(libroId) || libroId <= 0) {
    mostrarTexto(error, "Seleccioná un libro del catálogo.");
    return;
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    mostrarTexto(error, "La cantidad debe ser un número entero mayor que cero.");
    return;
  }

  const libro = estado.librosPorId.get(libroId);
  const existente = estado.renglones.find(renglon => renglon.libro_id === libroId);

  if (existente) {
    // Un solo renglón por libro: se acumula la cantidad.
    existente.cantidad += cantidad;
  } else {
    estado.renglones.push({
      libro_id: libroId,
      titulo: libro ? libro.titulo : `Libro #${libroId}`,
      cantidad
    });
  }

  document.getElementById("renglon-cantidad").value = "";
  renderRenglones();
}

function modificarRenglon(indice) {
  const renglon = estado.renglones[indice];
  if (!renglon) return;

  const respuesta = window.prompt("Ingresá la nueva cantidad:", String(renglon.cantidad));
  if (respuesta === null) return;

  const cantidad = Number(String(respuesta).trim());
  const error = document.getElementById("venta-mensaje-error");
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    mostrarTexto(error, "La cantidad debe ser un número entero mayor que cero.");
    return;
  }

  renglon.cantidad = cantidad;
  ocultar(error);
  renderRenglones();
}

function quitarRenglon(indice) {
  if (indice < 0 || indice >= estado.renglones.length) return;
  estado.renglones.splice(indice, 1);
  renderRenglones();
}

function precioDeLibro(libroId) {
  const libro = estado.librosPorId.get(libroId);
  const precio = libro ? Number(libro.precio) : NaN;
  return Number.isFinite(precio) ? precio : null;
}

function totalEnCurso() {
  return estado.renglones.reduce((total, renglon) => {
    const precio = precioDeLibro(renglon.libro_id);
    return total + (precio === null ? 0 : precio * renglon.cantidad);
  }, 0);
}

function renderRenglones() {
  const cuerpo = document.getElementById("tabla-renglones-cuerpo");
  const plantilla = document.getElementById("plantilla-renglon");
  cuerpo.replaceChildren();

  estado.renglones.forEach((renglon, indice) => {
    const precio = precioDeLibro(renglon.libro_id);
    const clone = plantilla.content.cloneNode(true);
    const fila = clone.querySelector(".fila-renglon");

    fila.querySelector(".fila-renglon__libro").textContent = renglon.titulo;
    fila.querySelector(".fila-renglon__cantidad").textContent = String(renglon.cantidad);
    fila.querySelector(".fila-renglon__precio-unitario").textContent =
      precio === null ? "—" : formatearPrecio(precio);
    fila.querySelector(".fila-renglon__subtotal").textContent =
      precio === null ? "—" : formatearPrecio(precio * renglon.cantidad);

    fila.querySelector(".boton--quitar").addEventListener("click", () => quitarRenglon(indice));
    fila.querySelector(".boton--modificar").addEventListener("click", () => modificarRenglon(indice));

    cuerpo.appendChild(clone);
  });

  document.getElementById("venta-total").textContent = formatearPrecio(totalEnCurso());
}

function limpiarVenta() {
  estado.clienteVenta = null;
  estado.renglones = [];
  document.getElementById("venta-cliente-id").value = "";
  const estadoCliente = document.getElementById("venta-cliente-nombre");
  estadoCliente.className = "mensaje mensaje--vacio";
  mostrarTexto(estadoCliente, "Todavía no verificaste un cliente.");
  renderRenglones();
}

async function confirmarVenta(evento) {
  evento.preventDefault();
  const exito = document.getElementById("venta-mensaje-exito");
  const error = document.getElementById("venta-mensaje-error");
  const boton = document.getElementById("boton-confirmar-venta");
  ocultar(exito);
  ocultar(error);

  if (!estado.clienteVenta) {
    mostrarTexto(error, "Verificá un cliente válido antes de confirmar la venta.");
    return;
  }
  if (estado.renglones.length === 0) {
    mostrarTexto(error, "Agregá al menos un renglón a la venta.");
    return;
  }
  if (estado.renglones.some(r => !Number.isInteger(r.cantidad) || r.cantidad <= 0)) {
    mostrarTexto(error, "Todas las cantidades deben ser enteros mayores que cero.");
    return;
  }

  const cuerpo = {
    cliente_id: estado.clienteVenta.id,
    renglones: estado.renglones.map(r => ({ libro_id: r.libro_id, cantidad: r.cantidad }))
  };

  // Se deshabilita el botón mientras se procesa el envío.
  boton.disabled = true;
  boton.textContent = "Procesando…";
  try {
    const venta = await pedir("/ventas/", { cuerpo });
    mostrarTexto(
      exito,
      `Venta #${venta.id} registrada. Total: ${formatearPrecio(venta.total)}.`
    );
    limpiarVenta();
    estado.historial.offset = 0;
    await cargarHistorial();
    // Muestra el detalle de la venta recién confirmada con los importes de la API.
    renderDetalleVenta(venta);
  } catch (err) {
    // El borrador se conserva ante 409/422 para poder corregir y reintentar.
    mostrarTexto(error, err.message);
  } finally {
    boton.disabled = false;
    boton.textContent = "Confirmar venta";
  }
}

// ============================================================
// 10. Historial (GET /ventas/?limit&offset y GET /ventas/{id}) — Ejercicio 3
// ============================================================

async function cargarHistorial() {
  const { limit, offset } = estado.historial;
  mostrar("#historial-cargando");
  ocultar("#historial-error");

  try {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const ventas = await pedir(`/ventas/?${params.toString()}`);
    renderHistorial(ventas);
    actualizarPaginacionHistorial(ventas);
  } catch (error) {
    document.getElementById("tabla-historial-cuerpo").replaceChildren();
    mostrarTexto("#historial-error", error.message);
    ocultar("#historial-paginacion");
    document.getElementById("historial-vacio").hidden = true;
  } finally {
    ocultar("#historial-cargando");
  }
}

function renderHistorial(ventas) {
  const cuerpo = document.getElementById("tabla-historial-cuerpo");
  cuerpo.replaceChildren();
  document.getElementById("historial-vacio").hidden = ventas.length > 0;

  ventas.forEach(venta => {
    const fila = document.createElement("tr");
    const nombreCliente = venta.cliente
      ? venta.cliente.nombre
      : `Cliente #${venta.cliente_id}`;

    [String(venta.id), formatearFecha(venta.fecha), nombreCliente, formatearPrecio(venta.total)]
      .forEach(texto => {
        const celda = document.createElement("td");
        celda.textContent = texto;
        fila.appendChild(celda);
      });

    const celdaDetalle = document.createElement("td");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "boton boton--secundario";
    boton.textContent = "Ver detalle";
    boton.addEventListener("click", () => abrirDetalleVenta(venta.id));
    celdaDetalle.appendChild(boton);
    fila.appendChild(celdaDetalle);

    cuerpo.appendChild(fila);
  });
}

function actualizarPaginacionHistorial(ventas) {
  const { limit, offset } = estado.historial;

  // Sin ventas no hay nada que paginar: se oculta el bloque completo.
  if (ventas.length === 0) {
    ocultar("#historial-paginacion");
    return;
  }

  const pagina = Math.floor(offset / limit) + 1;
  document.getElementById("historial-pagina").textContent =
    `Página ${pagina} · ${ventas.length} venta(s)`;
  document.getElementById("historial-anterior").disabled = offset <= 0;
  document.getElementById("historial-siguiente").disabled = ventas.length < limit;
  mostrar("#historial-paginacion");
}

async function abrirDetalleVenta(ventaId) {
  try {
    const venta = await pedir(`/ventas/${ventaId}`);
    renderDetalleVenta(venta);
  } catch (error) {
    const vacio = document.getElementById("historial-detalle-vacio");
    vacio.className = "mensaje mensaje--error";
    mostrarTexto(vacio, error.message);
  }
}

function renderDetalleVenta(venta) {
  const cuerpo = document.getElementById("tabla-detalle-cuerpo");
  const vacio = document.getElementById("historial-detalle-vacio");
  const total = document.getElementById("historial-detalle-total");
  cuerpo.replaceChildren();

  (venta.renglones || []).forEach(renglon => {
    const libro = estado.librosPorId.get(renglon.libro_id);
    const titulo =
      renglon.titulo || (libro ? libro.titulo : `Libro #${renglon.libro_id}`);

    const fila = document.createElement("tr");
    [
      titulo,
      String(renglon.cantidad),
      formatearPrecio(renglon.precio_unitario),
      formatearPrecio(renglon.subtotal)
    ].forEach(texto => {
      const celda = document.createElement("td");
      celda.textContent = texto;
      fila.appendChild(celda);
    });
    cuerpo.appendChild(fila);
  });

  vacio.hidden = true;
  document.getElementById("historial-detalle-total-valor").textContent = formatearPrecio(
    venta.total
  );
  total.hidden = false;
}

// ============================================================
// 11. Arranque
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  inicializarCatalogo();

  document.getElementById("form-libro").addEventListener("submit", registrarLibro);
  document.getElementById("boton-agregar-autoria").addEventListener("click", agregarAutoria);
  document.getElementById("form-cliente").addEventListener("submit", registrarCliente);

  document.getElementById("boton-verificar-cliente").addEventListener("click", verificarCliente);
  document.getElementById("boton-agregar-renglon").addEventListener("click", agregarRenglon);
  document.getElementById("form-venta").addEventListener("submit", confirmarVenta);

  document.getElementById("historial-anterior").addEventListener("click", () => {
    estado.historial.offset = Math.max(0, estado.historial.offset - estado.historial.limit);
    cargarHistorial();
  });
  document.getElementById("historial-siguiente").addEventListener("click", () => {
    estado.historial.offset += estado.historial.limit;
    cargarHistorial();
  });

  renderAutorias();
  renderRenglones();

  // Cargas iniciales contra la API.
  cargarCatalogosAuxiliares();
  cargarCatalogo();
  cargarLibrosParaVenta();
  cargarHistorial();
});
