
const selectoresColor = document.querySelectorAll('.cambiar-color');

selectoresColor.forEach(selector => {
    selector.addEventListener('change', function () {
        const targetId = this.getAttribute('data-target');
        const imagenProducto = document.getElementById(`img-${targetId}`);

        if (imagenProducto) {
            if (this.selectedIndex === 0) {
                imagenProducto.src = this.getAttribute('data-img1');
            } else {
                imagenProducto.src = this.getAttribute('data-img2');
            }
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
let carrito = [];

const btnCarrito = document.getElementById('btn-carrito');
const modalCarrito = document.getElementById('modal-carrito');
const cerrarCarrito = document.getElementById('cerrar-carrito');
const listaCarrito = document.getElementById('items-carrito');
const contadorCarrito = document.getElementById('contador-carrito');
const totalCarrito = document.getElementById('total-carrito');
const btnVaciar = document.getElementById('btn-vaciar');
const btnComprar = document.getElementById('btn-comprar');
const botonesAgregar = document.querySelectorAll('.btn-agregar');

function actualizarCarritoUI() {
    if (!listaCarrito) return;
    listaCarrito.innerHTML = '';

    let total = 0;
    let cantidadTotal = 0;

    carrito.forEach((item, index) => {
        total += item.precio * item.cantidad;
        cantidadTotal += item.cantidad;

        const li = document.createElement('li');
        li.innerHTML = `
            <div>
                <strong>${item.nombre}</strong> (${item.color})<br>
                <small>$${item.precio.toLocaleString('es-MX')} MXN x ${item.cantidad}</small>
            </div>
            <button class="btn-eliminar-item" data-index="${index}" title="Eliminar">✖</button>
        `;
        listaCarrito.appendChild(li);
    });

    if (contadorCarrito) contadorCarrito.textContent = cantidadTotal;
    if (totalCarrito) totalCarrito.textContent = total.toLocaleString('es-MX');

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
        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({ id, nombre, precio, color, cantidad: 1 });
        }

        actualizarCarritoUI();

        const textoOriginal = this.textContent;
        this.textContent = '✓ Agregado';
        setTimeout(() => {
            this.textContent = textoOriginal;
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
        alert('¡Gracias por tu compra en RULE 34 Store Phones! Tu pedido ha sido registrado.');
        carrito = [];
        actualizarCarritoUI();
        if (modalCarrito) modalCarrito.classList.add('oculto');
    });
}
