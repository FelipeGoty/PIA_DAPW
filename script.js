
function nombreMarcaVisible(producto) {
    const nombre = producto.name.toLowerCase();
    if (nombre.startsWith('poco ')) return 'POCO';
    if (nombre.startsWith('redmi ')) return 'Redmi';
    return producto.brand.charAt(0).toUpperCase() + producto.brand.slice(1);
}

function crearTarjetaProducto(producto, esOferta) {
    const tarjeta = document.createElement('article');
    tarjeta.className = esOferta
        ? 'tarjeta-producto tarjeta-oferta'
        : 'tarjeta-producto';
    tarjeta.dataset.marca = producto.brand;
    tarjeta.dataset.productId = producto.id;
    tarjeta.setAttribute('role', 'link');
    tarjeta.tabIndex = 0;
    tarjeta.setAttribute('aria-label', `Ver detalles de ${producto.name}`);

    const abrirDetalle = () => {
        window.location.href = `tarjetaproducto.html?id=${encodeURIComponent(producto.id)}`;
    };

    tarjeta.addEventListener('click', event => {
        if (event.target.closest('button, select, label, a')) return;
        abrirDetalle();
    });

    tarjeta.addEventListener('keydown', event => {
        if (event.target !== tarjeta || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        abrirDetalle();
    });

    if (esOferta) {
        const descuento = document.createElement('span');
        descuento.className = 'etiqueta-descuento';
        descuento.textContent = `-${producto.discountPercent}% OFF`;
        tarjeta.appendChild(descuento);
    }

    const imagen = document.createElement('img');
    imagen.src = producto.image;
    imagen.alt = producto.name;
    imagen.className = 'imagen-producto';
    imagen.id = `img-${producto.id}`;
    imagen.addEventListener('error', () => {
        if (imagen.dataset.fallbackApplied === 'true') return;
        imagen.dataset.fallbackApplied = 'true';
        imagen.src = 'producto-placeholder.svg';
        imagen.alt = `Imagen no disponible: ${producto.name}`;
    });
    tarjeta.appendChild(imagen);

    const nombre = document.createElement('h3');
    nombre.textContent = producto.name;
    tarjeta.appendChild(nombre);

    const marca = document.createElement('p');
    marca.className = 'datos-tecnicos';
    marca.textContent = `Marca: ${nombreMarcaVisible(producto)}`;
    tarjeta.appendChild(marca);

    const especificaciones = document.createElement('p');
    especificaciones.className = 'especificaciones';
    especificaciones.textContent = producto.specifications;
    tarjeta.appendChild(especificaciones);

    const ram = document.createElement('p');
    ram.className = 'datos-tecnicos';
    ram.textContent = `RAM: ${producto.ram || 'No especificada'}`;
    tarjeta.appendChild(ram);

    const camaras = document.createElement('p');
    camaras.className = 'datos-tecnicos camaras-producto';
    const camarasTraseras = producto.cameras && producto.cameras.rear
        ? producto.cameras.rear
        : 'No especificadas';
    const camaraFrontal = producto.cameras && producto.cameras.front
        ? producto.cameras.front
        : 'No especificada';
    camaras.textContent = `Cámaras: Trasera ${camarasTraseras}; frontal ${camaraFrontal}`;
    tarjeta.appendChild(camaras);

    const disponibilidad = document.createElement('p');
    disponibilidad.className = 'disponibilidad';
    disponibilidad.dataset.stockId = producto.id;
    disponibilidad.setAttribute('aria-live', 'polite');
    tarjeta.appendChild(disponibilidad);

    if (!esOferta && Array.isArray(producto.colors) && producto.colors.length > 0) {
        const selectorColor = document.createElement('div');
        selectorColor.className = 'selector-color';

        const etiquetaColor = document.createElement('label');
        etiquetaColor.textContent = 'Color:';
        selectorColor.appendChild(etiquetaColor);

        const select = document.createElement('select');
        select.className = 'cambiar-color';
        select.dataset.target = producto.id;
        producto.colors.forEach(color => {
            const opcion = document.createElement('option');
            opcion.value = color.name;
            opcion.textContent = color.name;
            opcion.dataset.image = color.image;
            select.appendChild(opcion);
        });
        selectorColor.appendChild(select);
        tarjeta.appendChild(selectorColor);
    }

    if (esOferta) {
        const precioAnterior = document.createElement('p');
        precioAnterior.className = 'precio-anterior';
        precioAnterior.textContent = `$${producto.originalPrice.toLocaleString('es-MX')} MXN`;
        tarjeta.appendChild(precioAnterior);
    }

    const precio = document.createElement('p');
    precio.className = 'precio';
    precio.textContent = `$${producto.price.toLocaleString('es-MX')} MXN`;
    tarjeta.appendChild(precio);

    const botonAgregar = document.createElement('button');
    botonAgregar.className = esOferta
        ? 'btn-agregar btn-agregar-oferta'
        : 'btn-agregar';
    botonAgregar.dataset.id = producto.id;
    botonAgregar.dataset.nombre = producto.name;
    botonAgregar.dataset.precio = producto.price;
    botonAgregar.textContent = esOferta
        ? '¡En oferta, cómpralo ya o se va!'
        : 'Agregar';
    botonAgregar.dataset.textoOriginal = botonAgregar.textContent;
    tarjeta.appendChild(botonAgregar);

    return tarjeta;
}

async function cargarProductos() {
    const response = await fetch('productos.json');
    if (!response.ok) {
        throw new Error(`No se pudo cargar productos.json (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.products)) {
        throw new Error('El archivo productos.json no contiene una lista "products" válida.');
    }
    Inventario.inicializar(data.products);

    const listaOfertas = document.getElementById('lista-ofertas');
    const listaProductos = document.getElementById('lista-productos');
    if (!listaOfertas || !listaProductos) {
        throw new Error('No se encontraron los contenedores de productos en PIA.html.');
    }

    data.products
        .filter(producto => producto.type === 'oferta')
        .forEach(producto => listaOfertas.appendChild(crearTarjetaProducto(producto, true)));
    data.products
        .filter(producto => producto.type === 'catalogo')
        .forEach(producto => listaProductos.appendChild(crearTarjetaProducto(producto, false)));
}

function mostrarErrorCarga(error) {
    console.error('Error al cargar los productos:', error);
    const mensaje = document.getElementById('sin-resultados');
    if (mensaje) {
        mensaje.textContent = error.message || 'No se pudieron cargar los productos.';
        mensaje.classList.remove('oculto');
    }
}

const CLAVE_CARRITO = 'rule34-carrito';

function cargarCarritoGuardado() {
    try {
        const contenido = localStorage.getItem(CLAVE_CARRITO);
        if (!contenido) return [];

        const items = JSON.parse(contenido);
        const itemsValidos = Array.isArray(items) && items.every(item =>
            item &&
            typeof item.id === 'string' &&
            typeof item.nombre === 'string' &&
            Number.isFinite(item.precio) &&
            typeof item.color === 'string' &&
            Number.isInteger(item.cantidad) &&
            item.cantidad > 0
        );
        if (!itemsValidos) throw new Error('El carrito guardado tiene un formato inválido.');
        return items;
    } catch (error) {
        console.error('No se pudo leer el carrito guardado:', error);
        alert('No se pudo recuperar el carrito guardado en este navegador.');
        return [];
    }
}

function guardarCarrito(items) {
    try {
        localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
    } catch (error) {
        console.error('No se pudo guardar el carrito en este navegador:', error);
        alert('No se pudo guardar el carrito en este navegador.');
    }
}

function inicializarTienda() {
const selectoresColor = document.querySelectorAll('.cambiar-color');

selectoresColor.forEach(selector => {
    selector.addEventListener('change', function () {
        const targetId = this.getAttribute('data-target');
        const imagenProducto = document.getElementById(`img-${targetId}`);

        if (imagenProducto) {
            imagenProducto.dataset.fallbackApplied = 'false';
            imagenProducto.src = this.options[this.selectedIndex].dataset.image;
        }
    });
});

const buscador = document.getElementById('buscador');
const filtroMarca = document.getElementById('filtro-marca');
const ordenarPrecio = document.getElementById('ordenar-precio');
const listaProductos = document.getElementById('lista-productos');
const sinResultados = document.getElementById('sin-resultados');

const tarjetasCatalogo = listaProductos
    ? Array.from(listaProductos.querySelectorAll('.tarjeta-producto'))
    : [];

function filtrarYOrdenarCatalogo() {
    if (!listaProductos) return;

    const textoBusqueda = buscador ? buscador.value.toLowerCase().trim() : '';
    const marcaSeleccionada = filtroMarca ? filtroMarca.value : 'todos';
    const ordenSeleccionado = ordenarPrecio ? ordenarPrecio.value : 'defecto';

    let tarjetasOrdenadas = [...tarjetasCatalogo];

    if (ordenSeleccionado === 'menor-mayor' || ordenSeleccionado === 'mayor-menor') {
        tarjetasOrdenadas.sort((a, b) => {
            const precioA = parseFloat(a.querySelector('.btn-agregar').getAttribute('data-precio'));
            const precioB = parseFloat(b.querySelector('.btn-agregar').getAttribute('data-precio'));
            return ordenSeleccionado === 'menor-mayor' ? precioA - precioB : precioB - precioA;
        });
    }

    let visibles = 0;

    tarjetasOrdenadas.forEach(tarjeta => {
        const nombre = tarjeta.querySelector('h3').textContent.toLowerCase();
        const specs = tarjeta.querySelector('.especificaciones').textContent.toLowerCase();
        const marca = tarjeta.getAttribute('data-marca');

        const coincideTexto = nombre.includes(textoBusqueda) || specs.includes(textoBusqueda);
        const coincideMarca = marcaSeleccionada === 'todos' || marca === marcaSeleccionada;

        if (coincideTexto && coincideMarca) {
            tarjeta.style.display = 'flex';
            visibles++;
        } else {
            tarjeta.style.display = 'none';
        }

        listaProductos.appendChild(tarjeta);
    });

    if (sinResultados) {
        if (visibles === 0) {
            sinResultados.classList.remove('oculto');
        } else {
            sinResultados.classList.add('oculto');
        }
    }
}

if (buscador) buscador.addEventListener('input', filtrarYOrdenarCatalogo);
if (filtroMarca) filtroMarca.addEventListener('change', filtrarYOrdenarCatalogo);
if (ordenarPrecio) ordenarPrecio.addEventListener('change', filtrarYOrdenarCatalogo);

// 3. Carrito de compras (funciona tanto en Catálogo como en Ofertas)
let carrito = cargarCarritoGuardado();

const btnCarrito = document.getElementById('btn-carrito');
const modalCarrito = document.getElementById('modal-carrito');
const cerrarCarrito = document.getElementById('cerrar-carrito');
const listaCarrito = document.getElementById('items-carrito');
const contadorCarrito = document.getElementById('contador-carrito');
const totalCarrito = document.getElementById('total-carrito');
const btnVaciar = document.getElementById('btn-vaciar');
const btnComprar = document.getElementById('btn-comprar');
const botonesAgregar = document.querySelectorAll('.btn-agregar');

function actualizarDisponibilidadProductos() {
    document.querySelectorAll('.tarjeta-producto').forEach(tarjeta => {
        const id = tarjeta.dataset.productId;
        const disponibles = Inventario.obtener(id);
        const enCarrito = carrito
            .filter(item => item.id === id)
            .reduce((cantidad, item) => cantidad + item.cantidad, 0);
        const etiqueta = tarjeta.querySelector('.disponibilidad');
        const boton = tarjeta.querySelector('.btn-agregar');

        if (etiqueta) {
            etiqueta.textContent = `Disponibles: ${disponibles}`;
        }
        if (boton) {
            boton.disabled = disponibles === 0 || enCarrito >= disponibles;
            boton.textContent = disponibles === 0
                ? 'Agotado'
                : enCarrito >= disponibles
                    ? 'Máximo disponible en el carrito'
                    : boton.dataset.textoOriginal;
        }
    });
}

function actualizarCarritoUI() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = '';

    let total = 0;
    let cantidadTotal = 0;

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        cantidadTotal += item.cantidad;

        const li = document.createElement('li');
        const detalles = document.createElement('div');
        const nombre = document.createElement('strong');
        nombre.textContent = item.nombre;
        const color = document.createTextNode(` (${item.color})`);
        const salto = document.createElement('br');
        const precio = document.createElement('small');
        precio.textContent = `$${item.precio.toLocaleString('es-MX')} MXN x ${item.cantidad}`;
        detalles.append(nombre, color, salto, precio);

        const botonEliminar = document.createElement('button');
        botonEliminar.className = 'btn-eliminar-item';
        botonEliminar.dataset.index = index;
        botonEliminar.title = 'Eliminar';
        botonEliminar.textContent = '✖';
        li.append(detalles, botonEliminar);
        listaCarrito.appendChild(li);
    });

    if (contadorCarrito) contadorCarrito.textContent = cantidadTotal;
    if (totalCarrito) totalCarrito.textContent = total.toLocaleString('es-MX');
    guardarCarrito(carrito);
    actualizarDisponibilidadProductos();

    document.querySelectorAll('.btn-eliminar-item').forEach(btn => {
        btn.addEventListener('click', function () {
            const idx = parseInt(this.getAttribute('data-index'), 10);
            carrito.splice(idx, 1);
            actualizarCarritoUI();
        });
    });
}

botonesAgregar.forEach(boton => {
    boton.addEventListener('click', function () {
        const tarjeta = this.closest('.tarjeta-producto');
        const id = this.getAttribute('data-id');
        const nombre = this.getAttribute('data-nombre');
        const precio = parseFloat(this.getAttribute('data-precio'));
        const selectColor = tarjeta ? tarjeta.querySelector('.cambiar-color') : null;
        const color = selectColor ? selectColor.options[selectColor.selectedIndex].text : 'Oferta';

        const existente = carrito.find(item => item.id === id && item.color === color);
        const cantidadEnCarrito = carrito
            .filter(item => item.id === id)
            .reduce((cantidad, item) => cantidad + item.cantidad, 0);
        const disponibles = Inventario.obtener(id);
        if (cantidadEnCarrito >= disponibles) {
            alert(`No puedes agregar más unidades. Disponibles: ${disponibles}.`);
            actualizarDisponibilidadProductos();
            return;
        }

        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({ id, nombre, precio, color, cantidad: 1 });
        }

        actualizarCarritoUI();
        if (tarjeta && tarjeta.classList.contains('tarjeta-oferta') && modalCarrito) {
            modalCarrito.classList.remove('oculto');
        }

        const textoOriginal = this.textContent;
        this.textContent = '✓ Agregado';
        setTimeout(() => {
            this.textContent = textoOriginal;
            actualizarDisponibilidadProductos();
        }, 900);
    });
});

if (btnCarrito && modalCarrito) {
    btnCarrito.addEventListener('click', () => modalCarrito.classList.remove('oculto'));
}

if (cerrarCarrito && modalCarrito) {
    cerrarCarrito.addEventListener('click', () => modalCarrito.classList.add('oculto'));
}

if (modalCarrito) {
    modalCarrito.addEventListener('click', (e) => {
        if (e.target === modalCarrito) {
            modalCarrito.classList.add('oculto');
        }
    });
}

if (btnVaciar) {
    btnVaciar.addEventListener('click', () => {
        carrito = [];
        actualizarCarritoUI();
    });
}

if (btnComprar) {
    btnComprar.addEventListener('click', () => {
        if (carrito.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }

        window.location.href = 'carrito.html';
    });
}

actualizarCarritoUI();

function sincronizarCarritoGuardado() {
    Inventario.sincronizar();
    carrito = cargarCarritoGuardado();
    actualizarCarritoUI();
}

window.addEventListener('pageshow', event => {
    if (event.persisted) sincronizarCarritoGuardado();
});

window.addEventListener('storage', event => {
    if (event.key === CLAVE_CARRITO || event.key === Inventario.clave) {
        sincronizarCarritoGuardado();
    }
});

const idParaAgregar = new URLSearchParams(window.location.search).get('agregar');
if (idParaAgregar) {
    const botonProducto = Array.from(botonesAgregar)
        .find(boton => boton.dataset.id === idParaAgregar);

    if (!botonProducto) {
        console.error(`No se encontró el producto ${idParaAgregar} para agregar al carrito.`);
        alert('No se pudo agregar el producto al carrito.');
    } else {
        const url = new URL(window.location.href);
        url.searchParams.delete('agregar');
        window.history.replaceState({}, '', url);
        botonProducto.click();
        if (modalCarrito) modalCarrito.classList.remove('oculto');
    }
}
}

cargarProductos().then(inicializarTienda).catch(mostrarErrorCarga);