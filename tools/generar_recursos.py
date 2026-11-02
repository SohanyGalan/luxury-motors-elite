"""
Genera los recursos derivados de vehiculo.json (fuente única de verdad):

  js/pdf_thumbnails.js     -> window.PDF_THUMBNAILS { ruta: dataURI base64 }
  js/catalogo_respaldo.js  -> window.CATALOGO_RESPALDO (copia embebida para file://)

Uso (desde la raíz del proyecto):  python tools/generar_recursos.py
Requiere: Pillow (pip install pillow)
"""
import base64, io, json, os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = "assets/logo_pagina.png"


def data_uri(path, size, fmt):
    im = Image.open(os.path.join(ROOT, path))
    buf = io.BytesIO()
    if fmt == "PNG":
        im = im.convert("RGBA")
        im.thumbnail(size, Image.LANCZOS)
        im.save(buf, "PNG", optimize=True)
        mime = "image/png"
    else:
        im = im.convert("RGB")
        im.thumbnail(size, Image.LANCZOS)
        im.save(buf, "JPEG", quality=74, optimize=True)
        mime = "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    with open(os.path.join(ROOT, "vehiculo.json"), encoding="utf-8") as fh:
        catalogo = json.load(fh)

    thumbs = {LOGO: data_uri(LOGO, (200, 200), "PNG")}
    for item in catalogo["vehiculos"] + catalogo["motos"]:
        thumbs[item["imagen"]] = data_uri(item["imagen"], (240, 150), "JPEG")

    os.makedirs(os.path.join(ROOT, "js"), exist_ok=True)
    with open(os.path.join(ROOT, "js", "pdf_thumbnails.js"), "w", encoding="utf-8") as fh:
        fh.write("/* Archivo autogenerado por tools/generar_recursos.py — no editar a mano.\n")
        fh.write("   Miniaturas Base64 para html2pdf: evitan errores CORS/taint y lienzos en blanco. */\n")
        fh.write("window.PDF_THUMBNAILS = ")
        json.dump(thumbs, fh, indent=1)
        fh.write(";\n")

    with open(os.path.join(ROOT, "js", "catalogo_respaldo.js"), "w", encoding="utf-8") as fh:
        fh.write("/* Archivo autogenerado por tools/generar_recursos.py — copia de vehiculo.json.\n")
        fh.write("   Se usa solo si fetch() falla (por ejemplo al abrir index.html con file://). */\n")
        fh.write("window.CATALOGO_RESPALDO = ")
        json.dump(catalogo, fh, indent=2, ensure_ascii=False)
        fh.write(";\n")

    print(f"OK: {len(thumbs)} miniaturas, {len(catalogo['vehiculos'])} vehículos, {len(catalogo['motos'])} motos")


if __name__ == "__main__":
    main()
