const CLAVE_CARRITO = 'rule34-carrito';
const error = document.getElementById('error-pago');
const formulario = document.getElementById('datos-pago');
const botonPagar = document.getElementById('simular-pago');
const confirmacion = document.getElementById('confirmacion-pago');
let itemsPago = [];

function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = false;
}

async function cargarTotal() {
    const contenido = localStorage.getItem(CLAVE_CARRITO);
    if (!contenido) {
        throw new Error('No hay productos en el carrito. Regresa a la tienda para agregarlos.');
    }

    const items = JSON.parse(contenido);
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No hay productos en el carrito. Regresa a la tienda para agregarlos.');
    }

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
    let total = 0;
    items.forEach(item => {
        const producto = productos.get(String(item.id));
        if (!producto || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
            throw new Error('Hay un artículo inválido en el carrito.');
        }
        const disponibles = Inventario.obtener(producto.id);
        if (item.cantidad > disponibles) {
            throw new Error(
                `Solo hay ${disponibles} unidades disponibles de "${producto.name}". Regresa a la tienda y ajusta la cantidad.`
            );
        }
        total += producto.price * item.cantidad;
    });

    itemsPago = items;
    document.getElementById('total-pago').textContent = `$${total.toLocaleString('es-MX')} MXN`;
}

botonPagar.addEventListener('click', () => {
    const nombre = document.getElementById('nombre').value.trim();
    const apellido = document.getElementById('apellido').value.trim();
    const edad = Number(document.getElementById('edad').value);
    const direccion = document.getElementById('direccion').value.trim();

    if (!nombre || !apellido || !direccion || !Number.isInteger(edad) || edad < 1 || edad > 120) {
        mostrarError('Completa nombre, apellido, edad y dirección con datos válidos.');
        return;
    }

    try {
        Inventario.descontar(itemsPago);
        localStorage.removeItem(CLAVE_CARRITO);
    } catch (errorCompra) {
        console.error('No se pudo completar el pago de demostración:', errorCompra);
        mostrarError(errorCompra.message || 'No se pudo completar la compra. Intenta de nuevo.');
        return;
    }

    formulario.hidden = true;
    confirmacion.textContent = 'Pago completado.';
    confirmacion.hidden = false;
});

cargarTotal().catch(errorCarga => {
    console.error('Error al cargar el pago:', errorCarga);
    mostrarError(errorCarga.message);
    formulario.hidden = true;
});
