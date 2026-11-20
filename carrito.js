const CLAVE_CARRITO = 'rule34-carrito';
const listaCarrito = document.getElementById('items-carrito');
const totalCarrito = document.getElementById('total-carrito');
const metodosPago = document.getElementById('metodos-pago');
const mensaje = document.getElementById('mensaje');
const resumen = document.getElementById('resumen-carrito');
const opcionesPago = document.getElementById('opciones-pago');
const botonContinuar = document.getElementById('continuar-pago');
let itemsCarrito = [];

function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.className = 'mensaje error';
    mensaje.hidden = false;
}

function leerCarrito() {
    const contenido = localStorage.getItem(CLAVE_CARRITO);
    if (!contenido) return [];

    const items = JSON.parse(contenido);
    if (!Array.isArray(items)) {
        throw new Error('El carrito guardado tiene un formato inválido.');
    }
    return items;
}

async function inicializarCarrito() {
    const respuesta = await fetch('productos.json');
    if (!respuesta.ok) {
        throw new Error(`No se pudo cargar productos.json (HTTP ${respuesta.status}).`);
    }

    const data = await respuesta.json();
    if (!data || !Array.isArray(data.products)) {
        throw new Error('productos.json no contiene una lista de productos válida.');
    }
    Inventario.inicializar(data.products);

    const productos = new Map(data.products.map(producto => [String(producto.id), producto]));
    const itemsGuardados = leerCarrito();
    const items = itemsGuardados.map(item => {
        const producto = productos.get(String(item.id));
        if (!producto || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
            throw new Error('Hay un artículo inválido en el carrito. Regresa a la tienda y agrégalo otra vez.');
        }

        const versiones = producto.type === 'oferta'
            ? ['Oferta']
            : (producto.colors || []).map(color => color.name);
        if (!versiones.includes(item.color)) {
            throw new Error(`La versión del producto "${producto.name}" ya no está disponible.`);
        }
        const disponibles = Inventario.obtener(producto.id);
        if (item.cantidad > disponibles) {
            throw new Error(
                `Solo hay ${disponibles} unidades disponibles de "${producto.name}". Regresa a la tienda y ajusta la cantidad.`
            );
        }

        return {
            id: String(producto.id),
            nombre: producto.name,
            precio: producto.price,
            color: item.color,
            cantidad: item.cantidad
        };
    });
    itemsCarrito = items;

    listaCarrito.replaceChildren();
    let total = 0;
    items.forEach(item => {
        const subtotal = item.precio * item.cantidad;
        total += subtotal;

        const fila = document.createElement('li');
        const descripcion = document.createElement('span');
        descripcion.textContent = `${item.nombre} — ${item.color} × ${item.cantidad}`;
        const precio = document.createElement('strong');
        precio.textContent = `$${subtotal.toLocaleString('es-MX')} MXN`;
        fila.append(descripcion, precio);
        listaCarrito.appendChild(fila);
    });

    totalCarrito.textContent = total.toLocaleString('es-MX');
    resumen.hidden = items.length === 0;
    opcionesPago.hidden = items.length === 0;
    metodosPago.hidden = items.length === 0;
    if (items.length === 0) {
        mensaje.textContent = 'Tu carrito está vacío.';
        mensaje.className = 'mensaje';
        mensaje.hidden = false;
    }
}

botonContinuar.addEventListener('click', () => {
    const metodo = document.querySelector('input[name="metodo"]:checked');
    if (!metodo) {
        mostrarError('Selecciona un método de pago para continuar.');
        return;
    }

    if (metodo.value === 'tarjeta') {
        window.location.href = 'pagot.html';
        return;
    }

    const tiendas = {
        oxxo: 'OXXO',
        walmart: 'Walmart',
        seven_eleven: '7-Eleven'
    };
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    const referencia = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    try {
        Inventario.descontar(itemsCarrito);
        localStorage.removeItem(CLAVE_CARRITO);
    } catch (error) {
        console.error('No se pudo completar el pago en tienda:', error);
        mostrarError(error.message || 'No se pudo completar la compra. Intenta de nuevo.');
        return;
    }

    mensaje.textContent = ` Elegiste pagar en ${tiendas[metodo.value]}. Usa esta referencia para pagar en fisico: ${referencia}.`;
    mensaje.className = 'mensaje confirmacion';
    mensaje.hidden = false;
    listaCarrito.replaceChildren();
    totalCarrito.textContent = '0';
    resumen.hidden = true;
    opcionesPago.hidden = true;
});

inicializarCarrito().catch(error => {
    console.error('Error al cargar el carrito:', error);
    mostrarError(error.message);
});
