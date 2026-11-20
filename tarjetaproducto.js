const detalle = document.getElementById('detalle');
const error = document.getElementById('error');
const imagenProducto = document.getElementById('imagen-producto');
const versionesContenedor = document.getElementById('versiones-contenedor');
const versiones = document.getElementById('versiones');
const botonOferta = document.getElementById('comprar-oferta');
const disponibilidad = document.getElementById('disponibles-producto');
let productoActual;

function nombreMarcaVisible(producto) {
    const nombre = producto.name.toLowerCase();
    if (nombre.startsWith('poco ')) return 'POCO';
    if (nombre.startsWith('redmi ')) return 'Redmi';
    return producto.brand.charAt(0).toUpperCase() + producto.brand.slice(1);
}

function mostrarError(mensaje) {
    error.textContent = mensaje;
    error.hidden = false;
}

imagenProducto.addEventListener('error', () => {
    if (imagenProducto.dataset.fallbackApplied === 'true') return;
    imagenProducto.dataset.fallbackApplied = 'true';
    imagenProducto.src = 'producto-placeholder.svg';
    imagenProducto.alt = 'Imagen del producto no disponible';
});

async function cargarDetalleProducto() {
    const productId = new URLSearchParams(window.location.search).get('id');
    if (!productId) {
        throw new Error('No se indicó qué producto quieres consultar.');
    }

    const response = await fetch('productos.json');
    if (!response.ok) {
        throw new Error(`No se pudo cargar productos.json (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.products)) {
        throw new Error('El archivo productos.json no contiene una lista de productos válida.');
    }
    Inventario.inicializar(data.products);

    const producto = data.products.find(item => String(item.id) === productId);
    if (!producto) {
        throw new Error('No se encontró el producto solicitado.');
    }
    productoActual = producto;

    document.title = `${producto.name} | RULE 34 Store Phones`;
    document.getElementById('tipo-producto').textContent =
        producto.type === 'oferta' ? 'Oferta especial' : 'Catálogo';
    document.getElementById('nombre-producto').textContent = producto.name;
    document.getElementById('marca-producto').textContent = nombreMarcaVisible(producto);
    document.getElementById('especificaciones-producto').textContent = producto.specifications;
    document.getElementById('ram-producto').textContent = producto.ram || 'No especificada';
    const camarasTraseras = producto.cameras && producto.cameras.rear
        ? producto.cameras.rear
        : 'No especificadas';
    const camaraFrontal = producto.cameras && producto.cameras.front
        ? producto.cameras.front
        : 'No especificada';
    document.getElementById('camaras-producto').textContent =
        `Traseras: ${camarasTraseras}; frontal: ${camaraFrontal}`;
    document.getElementById('precio-producto').textContent =
        `$${producto.price.toLocaleString('es-MX')} MXN`;
    actualizarDisponibilidad();

    if (producto.originalPrice !== undefined) {
        const precioAnterior = document.getElementById('precio-anterior');
        precioAnterior.textContent = `Antes: $${producto.originalPrice.toLocaleString('es-MX')} MXN`;
        precioAnterior.hidden = false;

        const descuento = document.getElementById('descuento');
        descuento.textContent = `-${producto.discountPercent}%`;
        descuento.hidden = false;
    }

    if (producto.type === 'oferta') {
        botonOferta.hidden = false;
        botonOferta.addEventListener('click', () => {
            try {
                Inventario.sincronizar();
                if (Inventario.obtener(producto.id) < 1) {
                    actualizarDisponibilidad();
                    mostrarError('Este producto ya no tiene existencias.');
                    return;
                }
            } catch (errorInventario) {
                mostrarError(errorInventario.message);
                return;
            }
            window.location.href = `PIA.html?agregar=${encodeURIComponent(producto.id)}#ofertas`;
        });
    }

    imagenProducto.src = producto.image;
    imagenProducto.alt = producto.name;

    if (producto.type !== 'oferta' && Array.isArray(producto.colors) && producto.colors.length > 0) {
        producto.colors.forEach(color => {
            const opcion = document.createElement('option');
            opcion.value = color.image;
            opcion.textContent = color.name;
            versiones.appendChild(opcion);
        });

        const versionInicial = producto.colors.find(color => color.image === producto.image)
            || producto.colors[0];
        versiones.value = versionInicial.image;
        imagenProducto.dataset.fallbackApplied = 'false';
        imagenProducto.src = versionInicial.image;
        versiones.addEventListener('change', () => {
            const versionSeleccionada = producto.colors.find(color => color.image === versiones.value);
            if (versionSeleccionada) {
                imagenProducto.dataset.fallbackApplied = 'false';
                imagenProducto.src = versionSeleccionada.image;
                imagenProducto.alt = `${producto.name} - ${versionSeleccionada.name}`;
            }
        });
        versionesContenedor.hidden = false;
    }

    detalle.hidden = false;
}

function actualizarDisponibilidad() {
    if (!productoActual) return;
    const disponibles = Inventario.obtener(productoActual.id);
    disponibilidad.textContent = `${disponibles} ${disponibles === 1 ? 'unidad disponible' : 'unidades disponibles'}`;
    if (productoActual.type === 'oferta') {
        botonOferta.disabled = disponibles === 0;
        botonOferta.textContent = disponibles === 0
            ? 'Agotado'
            : '¡En oferta, cómpralo ya o se va!';
    }
}

window.addEventListener('storage', event => {
    if (event.key !== Inventario.clave) return;
    try {
        Inventario.sincronizar();
        actualizarDisponibilidad();
    } catch (errorInventario) {
        mostrarError(errorInventario.message);
    }
});

window.addEventListener('pageshow', event => {
    if (!event.persisted || !productoActual) return;
    try {
        Inventario.sincronizar();
        actualizarDisponibilidad();
    } catch (errorInventario) {
        mostrarError(errorInventario.message);
    }
});

cargarDetalleProducto().catch(errorCarga => {
    console.error('Error al cargar los detalles del producto:', errorCarga);
    mostrarError(errorCarga.message);
});
