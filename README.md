# Landing Page — Cotizador de Aberturas

Sitio estático (HTML + CSS + JS, sin backend) listo para publicar en GitHub Pages.

```
landing-cotizador/
├── index.html      Estructura y textos de la página
├── styles.css      Diseño. Los colores están arriba de todo, en :root
├── script.js       Lista de versiones + datos de contacto
├── favicon.svg     Ícono de la pestaña del navegador
└── README.md       Este archivo
```

---

## 1. Dónde está publicado

- **Repositorio:** https://github.com/netunlock/cotizador-aberturas
- **Web online:** https://netunlock.github.io/cotizador-aberturas/

Pages está configurado como *Deploy from a branch* → rama **main**, carpeta **/ (root)**.
Cada vez que se sube un cambio a `main`, la web se actualiza sola en 1 o 2 minutos.

### Para actualizar la web

**Opción A — desde el navegador (rápido para un texto o un color):** entrás al archivo en GitHub,
clic en el lápiz ✏️, editás y **Commit changes**.

**Opción B — desde esta carpeta con git:**

```bash
git add -A
git commit -m "Nueva version 3.1.0"
git push
```

---

## 2. Dónde subir el .zip del programa

**No subas el ejecutable como archivo del repo**: GitHub rechaza archivos de más de 100 MB y el
repo se vuelve pesado. Usá **Releases**, que además te arma el historial solo:

1. En el repo, columna derecha → **Releases** → **Create a new release**.
2. *Tag*: `v3.0.0` · *Title*: `Versión 3.0.0`.
3. En **Attach binaries** arrastrá el `.zip` (por ejemplo `CotizadorAberturas_v3.0.0.zip`).
4. **Publish release**.
5. Botón derecho sobre el archivo publicado → **Copiar dirección del enlace**. Ese link es el que
   va en el campo `url` de `script.js`.

Queda con esta forma:

```
https://github.com/netunlock/cotizador-aberturas/releases/download/v3.0.0/CotizadorAberturas_v3.0.0.zip
```

---

## 3. Qué editar en el código

### Agregar una versión nueva → `script.js`, BLOQUE 2

Copiá un bloque `{ ... }` y pegalo **arriba de todo** de la lista `VERSIONES`
(el primero es el más nuevo). Poné `destacada: true` en el nuevo y sacáselo al anterior:

```js
{
  version:   "3.1.0",
  fecha:     "2026-09-15",       // AAAA-MM-DD
  estado:    "estable",          // "estable" o "beta"
  tamano:    "70 MB",
  url:       "https://github.com/.../CotizadorAberturas_v3.1.0.zip",
  destacada: true,               // ← esta es la del botón grande
  notas: [
    "Novedad principal",
    "Otra novedad"
  ]
},
```

La versión destacada arma sola la tarjeta grande de descarga y el cartel del hero
("Versión 3.1.0 disponible"). El resto se acomoda en el historial, que aparece con el botón
*Ver versiones anteriores*.

### Cambiar teléfono, mail o mensajes → `script.js`, BLOQUE 1

En `CONTACTO` está el número de WhatsApp (formato internacional, sin +, sin 0 y sin 15), el mail
y los mensajes que aparecen ya escritos cuando el visitante toca un botón. Con cambiarlo ahí, se
actualizan todos los botones y textos de la página.

### Cambiar los colores → `styles.css`, bloque `:root` (arriba de todo)

Cambiá sólo los valores HEX de ese bloque; el resto de la hoja los toma solos.
Los principales:

| Variable | Para qué sirve |
|---|---|
| `--color-primary` | Color de marca: botones, links, ícono del logo |
| `--color-primary-dark` | El mismo, más oscuro (hover de los botones) |
| `--color-primary-soft` | Fondo suave de íconos y etiquetas |
| `--color-accent` | Segundo color del degradé del título |
| `--color-warning` | Cartel del aviso de licencia |
| `--color-text` | Títulos |
| `--color-bg-alt` | Fondo de las secciones grises |
| `--color-footer-bg` | Fondo del pie |

Si cambiás `--color-primary`, cambiá también el `fill="#2563eb"` de `favicon.svg` para que el
ícono de la pestaña quede en el mismo tono.

### Textos, características y preguntas frecuentes → `index.html`

- Cada característica es un bloque `<article class="card">`: copialo o borralo.
- Cada pregunta frecuente es un bloque `<details class="faq__item">`: mismo criterio.
- El aviso de licencia está en la sección `#descargas`, bloque `<div class="alert">`.

---

## 4. Probarlo en tu PC antes de subirlo

Doble clic en `index.html` alcanza para ver casi todo. Si querés verlo tal cual va a quedar
online, desde la carpeta:

```bash
python -m http.server 8010
```

y abrí `http://localhost:8010` en el navegador.
