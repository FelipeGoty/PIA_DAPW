(function () {
    const clave = 'rule34-inventario';
    let productos = new Map();
    let existencias = {};

    function validarExistencias(valor) {
        if (!valor || typeof valor !== 'object' || Array.isArray(valor)) {
            throw new Error('El inventario guardado tiene un formato inválido.');
        }

        Object.entries(valor).forEach(([id, cantidad]) => {
            if (!/^\d+$/.test(id) || !Number.isInteger(cantidad) || cantidad < 0) {
                throw new Error('El inventario guardado contiene una existencia inválida.');
            }
        });
        return valor;
    }

    function leerExistencias() {
        const contenido = localStorage.getItem(clave);
        if (contenido === null) return null;

        try {
            return validarExistencias(JSON.parse(contenido));
        } catch (error) {
            throw new Error(`No se pudo leer el inventario: ${error.message}`);
        }
    }

    function guardarExistencias(nuevasExistencias) {
        localStorage.setItem(clave, JSON.stringify(nuevasExistencias));
        existencias = nuevasExistencias;
    }

    function inicializar(listaProductos) {
        if (!Array.isArray(listaProductos)) {
            throw new Error('No se pudo inicializar el inventario de productos.');
        }

        productos = new Map();
        listaProductos.forEach(producto => {
            const id = String(producto.id);
            if (!/^\d+$/.test(id) || !Number.isInteger(producto.stock) || producto.stock < 0) {
                throw new Error(`El producto "${producto.name}" no tiene existencias válidas.`);
            }
            productos.set(id, producto);
        });

        const almacenadas = leerExistencias() || {};
        listaProductos.forEach(producto => {
            const id = String(producto.id);
            if (!Object.prototype.hasOwnProperty.call(almacenadas, id)) {
                almacenadas[id] = producto.stock;
            }
        });
        guardarExistencias(almacenadas);
        return { ...existencias };
    }

    function obtener(productoId) {
        const id = String(productoId);
        if (!productos.has(id) || !Object.prototype.hasOwnProperty.call(existencias, id)) {
            throw new Error('No se encontró la existencia de este producto.');
        }
        return existencias[id];
    }

    function sincronizar() {
        const almacenadas = leerExistencias();
        if (!almacenadas) {
            throw new Error('No se encontró el inventario guardado en este navegador.');
        }

        productos.forEach((producto, id) => {
            if (!Object.prototype.hasOwnProperty.call(almacenadas, id)) {
                throw new Error(`No se encontró la existencia de "${producto.name}".`);
            }
        });
        existencias = almacenadas;
        return { ...existencias };
    }

    function descontar(items) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('No hay productos para descontar del inventario.');
        }

        const almacenadas = leerExistencias();
        if (!almacenadas) {
            throw new Error('No se encontró el inventario guardado en este navegador.');
        }

        const cantidadesSolicitadas = new Map();
        items.forEach(item => {
            const id = String(item.id);
            if (!productos.has(id) || !Number.isInteger(item.cantidad) || item.cantidad < 1) {
                throw new Error('Hay un artículo inválido en el carrito.');
            }
            cantidadesSolicitadas.set(
                id,
                (cantidadesSolicitadas.get(id) || 0) + item.cantidad
            );
        });

        cantidadesSolicitadas.forEach((cantidad, id) => {
            const disponibles = almacenadas[id];
            if (!Number.isInteger(disponibles)) {
                throw new Error(`No se encontró la existencia de "${productos.get(id).name}".`);
            }
            if (disponibles < cantidad) {
                const nombre = productos.get(id).name;
                throw new Error(
                    `No hay suficientes unidades de "${nombre}". Disponibles: ${disponibles}.`
                );
            }
        });

        const nuevasExistencias = { ...almacenadas };
        cantidadesSolicitadas.forEach((cantidad, id) => {
            nuevasExistencias[id] -= cantidad;
        });
        guardarExistencias(nuevasExistencias);
        return { ...existencias };
    }

    window.Inventario = Object.freeze({
        clave,
        inicializar,
        obtener,
        sincronizar,
        descontar
    });
})();
