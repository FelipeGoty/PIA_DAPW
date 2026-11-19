const selectoresColor = document.querySelectorAll('.cambiar-color');

selectoresColor.forEach(selector => {
    selector.addEventListener('change', function() {
        const targetId = this.getAttribute('data-target');
        const imagenProducto = document.getElementById(`img-${targetId}`);

        if (this.selectedIndex === 0) {
            imagenProducto.src = this.getAttribute('data-img1');
        } else {
            imagenProducto.src = this.getAttribute('data-img2');
        }
    });
});
