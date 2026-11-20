import ipaddress
import json
import os
import re
import socket
import sys
import tempfile
import time
from decimal import Decimal, InvalidOperation
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from urllib.robotparser import RobotFileParser


USER_AGENT = 'Rule34StoreCatalogBot/1.0 (manual product catalog import)'
PROJECT_DIR = Path(__file__).resolve().parent
PRODUCTS_FILE = PROJECT_DIR / 'productos.json'
PLACEHOLDER_IMAGE = 'producto-placeholder.svg'
PRODUCTS_TO_ADD = 5
MAX_PAGE_BYTES = 5 * 1024 * 1024
REQUEST_TIMEOUT = 15
class PublicRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        destination = urljoin(request.full_url, new_url)
        validar_url(destination)
        return super().redirect_request(request, file, code, message, headers, destination)


opener = build_opener(PublicRedirectHandler)
robots_cache = {}
crawl_delays = {}
last_request_by_host = {}


class ProductPageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.json_ld = []
        self.meta = {}
        self.title = ''
        self._inside_json_ld = False
        self._inside_title = False
        self._script_parts = []
        self._title_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == 'meta':
            key = (attributes.get('property') or attributes.get('name') or '').lower()
            content = attributes.get('content')
            if key and content:
                self.meta[key] = content.strip()
        elif tag == 'script' and 'ld+json' in attributes.get('type', '').lower():
            self._inside_json_ld = True
            self._script_parts = []
        elif tag == 'title':
            self._inside_title = True
            self._title_parts = []

    def handle_data(self, data):
        if self._inside_json_ld:
            self._script_parts.append(data)
        if self._inside_title:
            self._title_parts.append(data)

    def handle_endtag(self, tag):
        if tag == 'script' and self._inside_json_ld:
            self.json_ld.append(''.join(self._script_parts))
            self._inside_json_ld = False
        elif tag == 'title' and self._inside_title:
            self.title = ' '.join(''.join(self._title_parts).split())
            self._inside_title = False


def validar_url(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('Usa una URL pública que empiece con http:// o https://.')
    if parsed.username or parsed.password:
        raise ValueError('No se permiten URLs con usuario o contraseña.')

    host = parsed.hostname.lower()
    if host == 'localhost' or host.endswith(('.localhost', '.local')):
        raise ValueError('Solo se permiten sitios públicos, no direcciones locales.')
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        try:
            addresses = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == 'https' else 80))
        except OSError as error:
            raise ValueError(f'No se pudo resolver el dominio: {error}') from error
        if not addresses or any(not ipaddress.ip_address(entry[4][0]).is_global for entry in addresses):
            raise ValueError('El dominio debe resolver únicamente a direcciones públicas.')
    else:
        if not address.is_global:
            raise ValueError('Solo se permiten direcciones IP públicas.')
    return parsed


def normalizar_url(url):
    valor = url.strip().strip('<>').strip('"\'')
    if valor and not urlsplit(valor).scheme:
        valor = 'https://' + valor
    return valor


def solicitar(url, max_bytes=MAX_PAGE_BYTES):
    validar_url(url)
    parsed = urlsplit(url)
    host = parsed.netloc.lower()
    origin = f'{parsed.scheme}://{parsed.netloc}'
    delay = crawl_delays.get(origin, 1)
    elapsed = time.monotonic() - last_request_by_host.get(host, 0)
    if elapsed < delay:
        time.sleep(delay - elapsed)

    request = Request(
        url,
        headers={
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/ld+json;q=0.9,*/*;q=0.5',
        },
    )
    last_request_by_host[host] = time.monotonic()
    with opener.open(request, timeout=REQUEST_TIMEOUT) as response:
        body = response.read(max_bytes + 1)
        if len(body) > max_bytes:
            raise ValueError('La página excede el límite de tamaño permitido.')
        charset = response.headers.get_content_charset() or 'utf-8'
        final_url = response.geturl()
    return body.decode(charset, errors='replace'), final_url


def comprobar_robots(url):
    parsed = urlsplit(url)
    origin = f'{parsed.scheme}://{parsed.netloc}'
    if origin not in robots_cache:
        robots_url = urljoin(origin, '/robots.txt')
        try:
            contenido, _ = solicitar(robots_url, max_bytes=1024 * 1024)
        except HTTPError as error:
            if 400 <= error.code < 500 and error.code not in (401, 403):
                contenido = ''
            else:
                raise ValueError(f'No se pudo autorizar la consulta de robots.txt (HTTP {error.code}).') from error
        except (URLError, OSError) as error:
            raise ValueError(f'No se pudo consultar robots.txt: {error}') from error

        parser = RobotFileParser()
        parser.set_url(robots_url)
        parser.parse(contenido.splitlines())
        robots_cache[origin] = parser
        crawl_delays[origin] = max(
            1,
            parser.crawl_delay(USER_AGENT) or parser.crawl_delay('*') or 1,
        )

    if not robots_cache[origin].can_fetch(USER_AGENT, url):
        raise ValueError('robots.txt no permite consultar esta página; no se intentará evitar la restricción.')


def recorrer_productos(valor):
    if isinstance(valor, list):
        for elemento in valor:
            yield from recorrer_productos(elemento)
    elif isinstance(valor, dict):
        tipo = valor.get('@type', [])
        tipos = [tipo] if isinstance(tipo, str) else tipo
        if any(str(item).lower().endswith('product') for item in tipos):
            yield valor
        for clave in ('@graph', 'mainEntity', 'itemListElement'):
            if clave in valor:
                yield from recorrer_productos(valor[clave])


def leer_valor(valor):
    if isinstance(valor, dict):
        return valor.get('value') or valor.get('name') or valor.get('@value') or ''
    return valor if isinstance(valor, (str, int, float)) else ''


def valores_adicionales(producto):
    adicionales = producto.get('additionalProperty', [])
    if isinstance(adicionales, dict):
        adicionales = [adicionales]
    return [
        (str(item.get('name', '')).strip().lower(), str(leer_valor(item)).strip())
        for item in adicionales
        if isinstance(item, dict) and item.get('name')
    ]


def valor_propiedad(adicionales, palabras):
    for nombre, valor in adicionales:
        if valor and any(palabra in nombre for palabra in palabras):
            return valor
    return ''


def extraer_producto(parser):
    candidatos = []
    for texto in parser.json_ld:
        try:
            candidatos.extend(recorrer_productos(json.loads(texto)))
        except json.JSONDecodeError:
            continue
    if not candidatos:
        return {
            'name': str(
                parser.meta.get('og:title')
                or parser.meta.get('twitter:title')
                or parser.title
            ).strip(),
            'brand': str(parser.meta.get('og:brand') or parser.meta.get('product:brand') or '').strip(),
            'price': parser.meta.get('product:price:amount'),
            'currency': str(parser.meta.get('product:price:currency') or '').upper(),
            'specifications': '',
            'ram': '',
            'rear_camera': '',
            'front_camera': '',
        }

    producto = max(
        candidatos,
        key=lambda item: sum(bool(item.get(campo)) for campo in ('name', 'brand', 'offers', 'image')),
    )
    adicionales = valores_adicionales(producto)
    marca = producto.get('brand', '')
    if isinstance(marca, dict):
        marca = marca.get('name', '')

    ofertas = producto.get('offers', {})
    if isinstance(ofertas, list):
        ofertas = ofertas[0] if ofertas else {}
    if not isinstance(ofertas, dict):
        ofertas = {}
    precio = ofertas.get('price')
    moneda = ofertas.get('priceCurrency', '')

    especificaciones = valor_propiedad(
        adicionales, ('storage', 'almacenamiento', 'internal memory', 'rom')
    )
    ram = valor_propiedad(adicionales, ('ram', 'working memory', 'system memory'))
    camara_trasera = valor_propiedad(
        adicionales, ('rear camera', 'back camera', 'cámara trasera', 'camara trasera', 'main camera')
    )
    camara_frontal = valor_propiedad(
        adicionales, ('front camera', 'selfie camera', 'cámara frontal', 'camara frontal')
    )

    return {
        'name': str(producto.get('name') or parser.meta.get('og:title') or parser.title).strip(),
        'brand': str(marca).strip(),
        'price': precio,
        'currency': str(moneda).upper(),
        'specifications': especificaciones,
        'ram': ram,
        'rear_camera': camara_trasera,
        'front_camera': camara_frontal,
    }


def pedir_texto(etiqueta, sugerencia=''):
    while True:
        indicacion = f' [{sugerencia}]' if sugerencia else ''
        respuesta = input(f'{etiqueta}{indicacion}: ').strip()
        valor = respuesta or sugerencia
        if valor:
            return valor
        print('Este campo es necesario. Si no está publicado, escribe "No especificado".')


def pedir_precio(precio, moneda):
    sugerencia = ''
    if precio is not None and moneda == 'MXN':
        try:
            sugerencia = str(int(Decimal(str(precio)).quantize(Decimal('1'))))
        except (InvalidOperation, ValueError):
            sugerencia = ''
    while True:
        respuesta = input(
            f'Precio en MXN{f" [{sugerencia}]" if sugerencia else ""}: '
        ).strip().replace(',', '')
        if not respuesta and sugerencia:
            return int(sugerencia)
        try:
            valor = Decimal(respuesta)
            if valor > 0:
                return int(valor.quantize(Decimal('1')))
        except (InvalidOperation, ValueError):
            pass
        print('Escribe un precio positivo en pesos mexicanos.')


def pedir_stock():
    while True:
        respuesta = input('Existencias iniciales [10]: ').strip() or '10'
        if respuesta.isdigit():
            return int(respuesta)
        print('Escribe un número entero igual o mayor que cero.')


def normalizar_marca(marca):
    valor = marca.strip().lower()
    if any(nombre in valor for nombre in ('xiaomi', 'redmi', 'poco')):
        return 'xiaomi'
    if 'samsung' in valor:
        return 'samsung'
    if 'apple' in valor:
        return 'apple'
    if 'motorola' in valor:
        return 'motorola'
    return valor


def obtener_datos_productos(url):
    comprobar_robots(url)
    html, url_final = solicitar(url)
    parser = ProductPageParser()
    parser.feed(html)
    producto = extraer_producto(parser)
    producto['image'] = PLACEHOLDER_IMAGE
    producto['sourceUrl'] = url_final
    return producto


def completar_producto(datos, product_id):
    nombre = pedir_texto('Nombre', datos['name'])
    marca = pedir_texto('Marca', datos['brand'])
    especificaciones = pedir_texto('Especificaciones/almacenamiento', datos['specifications'])
    ram = pedir_texto('RAM', datos['ram'])
    camara_trasera = pedir_texto('Cámaras traseras', datos['rear_camera'])
    camara_frontal = pedir_texto('Cámara frontal', datos['front_camera'])
    precio = pedir_precio(datos['price'], datos['currency'])
    stock = pedir_stock()

    return {
        'id': product_id,
        'type': 'catalogo',
        'name': nombre,
        'brand': normalizar_marca(marca),
        'specifications': especificaciones,
        'price': precio,
        'stock': stock,
        'ram': ram,
        'cameras': {
            'rear': camara_trasera,
            'front': camara_frontal,
        },
        'image': PLACEHOLDER_IMAGE,
        'colors': [{'name': 'Único', 'image': PLACEHOLDER_IMAGE}],
        'sourceUrl': datos['sourceUrl'],
    }


def fin_arreglo_productos(texto):
    coincidencia = re.search(r'"products"\s*:\s*\[', texto)
    if not coincidencia:
        raise ValueError('productos.json no contiene el arreglo "products".')

    inicio = coincidencia.end() - 1
    nivel = 0
    dentro_cadena = False
    escape = False
    for indice in range(inicio, len(texto)):
        caracter = texto[indice]
        if dentro_cadena:
            if escape:
                escape = False
            elif caracter == '\\':
                escape = True
            elif caracter == '\"':
                dentro_cadena = False
        elif caracter == '\"':
            dentro_cadena = True
        elif caracter == '[':
            nivel += 1
        elif caracter == ']':
            nivel -= 1
            if nivel == 0:
                return indice
    raise ValueError('No se encontró el cierre del arreglo de productos.')


def guardar_productos(nuevos):
    texto = PRODUCTS_FILE.read_text(encoding='utf-8')
    datos = json.loads(texto)
    existentes = datos.get('products')
    if not isinstance(existentes, list):
        raise ValueError('productos.json no contiene una lista de productos.')

    nombres = {str(item.get('name', '')).casefold() for item in existentes}
    for producto in nuevos:
        if producto['name'].casefold() in nombres:
            raise ValueError(f'El producto "{producto["name"]}" ya existe en productos.json.')
        nombres.add(producto['name'].casefold())

    fin = fin_arreglo_productos(texto)
    prefijo = texto[:fin].rstrip()
    entradas = ',\n'.join(
        '    ' + json.dumps(producto, ensure_ascii=False) for producto in nuevos
    )
    separador = ',\n' if prefijo and not prefijo.endswith('[') else '\n    '
    texto_actualizado = prefijo + separador + entradas + '\n' + texto[fin:]
    validacion = json.loads(texto_actualizado)
    if len(validacion['products']) != len(existentes) + len(nuevos):
        raise ValueError('La validación de productos.json no coincide con lo esperado.')

    archivo_temporal = None
    try:
        with tempfile.NamedTemporaryFile(
            mode='w',
            encoding='utf-8',
            newline='',
            dir=PRODUCTS_FILE.parent,
            delete=False,
        ) as temporal:
            temporal.write(texto_actualizado)
            archivo_temporal = temporal.name
        os.replace(archivo_temporal, PRODUCTS_FILE)
    finally:
        if archivo_temporal and os.path.exists(archivo_temporal):
            os.remove(archivo_temporal)


def main():
    if not PRODUCTS_FILE.is_file():
        raise FileNotFoundError(f'No se encontró {PRODUCTS_FILE}.')

    datos_actuales = json.loads(PRODUCTS_FILE.read_text(encoding='utf-8'))
    productos_actuales = datos_actuales.get('products', [])
    ids = [int(item['id']) for item in productos_actuales if str(item.get('id', '')).isdigit()]
    siguiente_id = max(ids, default=0) + 1
    nombres_existentes = {str(item.get('name', '')).casefold() for item in productos_actuales}
    nuevos = []

    print('Importador local de 5 productos desde páginas públicas.')
    print('Respeta robots.txt, no inicia sesión ni evita restricciones.')
    print('La imagen queda como placeholder: usa una imagen propia o con permiso de uso.')

    while len(nuevos) < PRODUCTS_TO_ADD:
        numero = len(nuevos) + 1
        url = normalizar_url(
            input(f'URL pública del producto {numero} de {PRODUCTS_TO_ADD}: ')
        )
        try:
            if not url:
                raise ValueError('Pega la dirección de una página de producto.')
            datos = obtener_datos_productos(url)
            producto = completar_producto(datos, siguiente_id)
            if producto['name'].casefold() in nombres_existentes:
                raise ValueError(f'El producto "{producto["name"]}" ya existe en el catálogo.')
        except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError) as error:
            print(f'No se pudo procesar esa URL: {error}')
            print('Usa el enlace directo de un producto público; no se omiten bloqueos de robots.txt.')
            continue

        nuevos.append(producto)
        nombres_existentes.add(producto['name'].casefold())
        siguiente_id += 1
        print(f'Listo: {producto["name"]}')

    guardar_productos(nuevos)
    print(f'Agregados {len(nuevos)} productos a {PRODUCTS_FILE.name}.')
    print('La página los leerá automáticamente desde productos.json.')
    print('Para publicarlos en GitHub Pages, sube el archivo productos.json actualizado.')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('\nImportación cancelada; no se guardaron los productos.')
        sys.exit(1)
