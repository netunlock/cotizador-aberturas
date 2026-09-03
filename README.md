# Landing Page — Cotizador de Aberturas

Sitio estático (HTML + CSS + JS, sin backend) publicado en GitHub Pages.

```
landing-cotizador/
├── index.html            Estructura y textos de la página
├── styles.css            Diseño y los DOS temas (Blanco / Silver)
├── script.js             Versiones, datos de contacto y formulario de descarga
├── favicon.svg           Ícono de la pestaña
├── img/                  Fotos de la galería  ← reemplazables (ver punto 5)
├── apps-script/
│   └── Codigo.gs         Script de Google: base de datos + mail con el link
└── README.md             Este archivo
```

- **Repositorio:** https://github.com/netunlock/cotizador-aberturas
- **Web online:** https://netunlock.github.io/cotizador-aberturas/

---

## 1. Actualizar la web

Pages está configurado como *Deploy from a branch* → rama **main**, carpeta **/ (root)**.
Todo lo que se suba a `main` sale online en 1 o 2 minutos.

**Desde el navegador** (rápido para un texto o un color): entrás al archivo en GitHub, clic en el
lápiz ✏️, editás y **Commit changes**.

**Desde esta carpeta:**

```bash
git add -A
git commit -m "Nueva version 3.1.0"
git push
```

---

## 2. Cómo funciona la descarga

1. El visitante toca *Descargar* y se abre un formulario: nombre y apellido, localidad,
   email y WhatsApp.
2. La página valida el formato (nombre con apellido, mail bien escrito, WhatsApp argentino
   de 10 dígitos) y descarta los correos temporales tipo `mailinator.com`.
3. Los datos se mandan al script de Google, que **guarda la fila en tu planilla** y
   **le envía el link de MediaFire al mail que dejó**.
4. Vos recibís un aviso con sus datos para poder contactarlo.

**Por qué el link llega por mail y no aparece en pantalla:** es la única verificación real
posible en un sitio sin servidor. Validar el formato del mail con JavaScript no prueba nada —
cualquiera escribe `juan@gmail.com`. Si el correo es falso, el link nunca le llega.

El link tampoco está en el código de la página: vive únicamente dentro del script de Google.

---

## 3. LA BASE DE DATOS: dónde la ves

La base de datos es **una planilla de Google Sheets tuya**, en tu propia cuenta
`fgpereyra.92@gmail.com`. No hay ningún servidor ni servicio de terceros de por medio.

**Dónde entrar**, de las tres formas:

- Desde la compu: [sheets.google.com](https://sheets.google.com) → aparece
  **Descargas — Cotizador** entre tus planillas.
- Desde [drive.google.com](https://drive.google.com), como cualquier archivo.
- Desde el celular: app **Google Sheets** (Android/iOS), con la misma cuenta.

La hoja se llama **Descargas** y cada persona que pide el programa entra como una fila nueva,
**en el momento**. Las columnas son:

| Columna | Qué trae |
|---|---|
| **Fecha** | Día y hora del pedido |
| **Nombre** | Nombre y apellido que cargó |
| **Localidad** | De dónde es (te sirve para ordenar por zona) |
| **Email** | El correo al que le llegó el link — está verificado, porque si fuera falso no lo habría recibido |
| **WhatsApp** | Número normalizado, en formato internacional |
| **Escribirle** | Un link que dice *Escribir*: lo tocás y se abre el chat de WhatsApp con esa persona |
| **Versión** | Qué versión descargó |
| **Estado** | Desplegable: Nuevo · Contactado · Probando · Interesado · Vendido · Descartado |
| **Notas** | Para lo que quieras anotar de cada contacto |

La fila de encabezados tiene **filtro activado**: podés ordenar por localidad, ver sólo los
"Nuevo", o buscar a alguien por nombre. Y siempre la podés bajar a Excel con
*Archivo → Descargar → Microsoft Excel*.

Además de la planilla, **cada pedido te llega también por mail** a
`cotizadoraberturas@gmail.com`, con el nombre, la localidad, el mail, el WhatsApp y un link
directo para escribirle. Así te enterás en el momento aunque no estés mirando la planilla.

---

## 4. Puesta en marcha (una sola vez)

### 4.1 Subir los .zip a MediaFire

1. Entrá a [mediafire.com](https://www.mediafire.com) con tu cuenta.
2. Botón **SUBIR** → *Añadir archivo* → elegí los `.zip` de la carpeta `entregas/`.
3. Cuando terminen de subir, en cada archivo → **Copiar vínculo**. Queda así:

```
https://www.mediafire.com/file/abc123xyz/CotizadorAberturas_v3.0.0.zip/file
```

### 4.2 Crear la planilla y el script

1. Creá una planilla nueva en [sheets.new](https://sheets.new) y llamala
   **Descargas — Cotizador**.
2. Menú **Extensiones → Apps Script**. Se abre el editor.
3. Borrá lo que haya y pegá **todo** el contenido de `apps-script/Codigo.gs`.
4. Arriba del archivo, en el objeto `LINKS`, reemplazá cada `PEGAR_ACA_EL_LINK_...`
   por el vínculo de MediaFire correspondiente.
5. Guardá (💾).
6. Probá: elegí la función **probar** en el desplegable y tocá **▶ Ejecutar**.
   La primera vez Google pide permiso: *Revisar permisos* → tu cuenta → *Configuración avanzada*
   → *Ir a (nombre del proyecto)* → **Permitir**. Si salió bien, aparece una fila en la planilla
   y te llegan dos mails.

### 4.3 Publicar el script

1. Botón azul **Implementar → Nueva implementación**.
2. Engranaje ⚙️ → tipo **Aplicación web**.
3. *Ejecutar como*: **Yo** · *Quién tiene acceso*: **Cualquier usuario** ← imprescindible.
4. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

### 4.4 Conectar la página con el script

En `script.js`, **BLOQUE 3**, pegá la URL:

```js
const ENDPOINT = "https://script.google.com/macros/s/AKfy...../exec";
```

`git push` y listo.

> Mientras `ENDPOINT` esté vacío, el formulario valida los datos igual pero le ofrece al
> visitante pedirte el link por WhatsApp: la página nunca queda rota.

**Cada vez que edites el script** (por ejemplo para sumar una versión a `LINKS`), acordate de
**Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar**, o los
cambios no salen a producción.

---

## 5. IMÁGENES: rutas y nombres exactos

Todas viven en la carpeta **`img/`**. Para poner tus propias fotos, guardalas con
**exactamente estos nombres** y reemplazá los archivos. No hay que tocar nada de código.

| Ruta y nombre exacto | Dónde se ve | Medida ideal |
|---|---|---|
| `img/galeria-01-ventana-corrediza.jpg` | Galería, 1° | 1200 × 900 px |
| `img/galeria-02-puerta-abrir.jpg` | Galería, 2° | 1200 × 900 px |
| `img/galeria-03-pano-fijo.jpg` | Galería, 3° | 1200 × 900 px |
| `img/galeria-04-perfiles-aluminio.jpg` | Galería, 4° | 1200 × 900 px |
| `img/galeria-05-vidrio-dvh.jpg` | Galería, 5° | 1200 × 900 px |
| `img/galeria-06-taller.jpg` | Galería, 6° | 1200 × 900 px |
| `img/portada.jpg` | Miniatura al compartir el link por WhatsApp o Facebook | 1200 × 630 px |

Reglas para que salgan bien:

- **Formato `.jpg`** y el nombre en minúsculas, igual al de la tabla (Windows no distingue
  mayúsculas, pero el servidor de GitHub sí: `Galeria-01.JPG` no lo encuentra).
- **Apaisadas** (más anchas que altas). Las de la galería se recortan solas a 4:3 con
  `object-fit: cover`, centradas: **nunca se deforman**, sólo se recorta lo que sobra
  de los bordes. Por eso conviene que el motivo esté centrado.
- Podés subir fotos más grandes sin problema; **más chicas que 1200 px de ancho se ven
  borrosas** en pantallas grandes.
- Pesá las fotos antes de subirlas (idealmente menos de 300 KB cada una): la página carga
  más rápido. Las de la galería ya se cargan de a poco (`loading="lazy"`).

Para cambiar el **texto** que aparece sobre cada foto, editá el `<figcaption>` de esa imagen
en `index.html`, sección `<section id="galeria">`.

Para agregar o sacar fotos, copiá o borrá un bloque `<figure class="galeria__item">` entero:
la grilla se reacomoda sola (3 columnas en escritorio, 2 en tablet, 1 en celular).

---

## 6. Los dos temas: Blanco y Silver

El selector está en la barra de arriba y usa **las mismas paletas del programa**
(`ui/tema.py`): *Blanco* es la paleta `claro` y *Silver* es la paleta `silver`.
La elección de cada visitante queda guardada en su navegador.

Los colores están en `styles.css`, arriba de todo, en dos bloques:

```css
:root, :root[data-tema="blanco"] { ... }   /* paleta claro  */
:root[data-tema="silver"]        { ... }   /* paleta silver */
```

**Si cambiás un color, cambialo en los dos bloques**, con el mismo nombre de variable; si no,
un tema queda desparejo. Los principales:

| Variable | Para qué sirve |
|---|---|
| `--color-primary` | Color de marca: botones, links, ícono del logo |
| `--color-primary-hover` | El mismo, al pasar el mouse |
| `--color-primary-soft` | Fondo suave de íconos y etiquetas |
| `--color-sobre-primario` | Color del texto que va encima del color de marca |
| `--color-accent` | Segundo color del degradé del título |
| `--color-warning` | Cartel del aviso de licencia |
| `--color-text` / `--color-text-body` | Títulos / párrafos |
| `--color-bg` / `--color-bg-alt` | Fondo general / secciones alternadas |
| `--color-surface` | Tarjetas |
| `--color-campo` | Fondo de los campos del formulario |

Si cambiás `--color-primary`, cambiá también el `fill="#2563eb"` de `favicon.svg` y el color
del botón del mail (`#2563eb` en `apps-script/Codigo.gs`).

---

## 7. Publicar una versión nueva del programa

Son dos lugares:

1. **`apps-script/Codigo.gs`** → agregá el link de MediaFire al objeto `LINKS`
   (y re-implementá el script, ver punto 4.4).

```js
var LINKS = {
  "3.1.0": "https://www.mediafire.com/file/.../CotizadorAberturas_v3.1.0.zip/file",
  "3.0.0": "...",
};
```

2. **`script.js`, BLOQUE 2** → copiá un bloque `{ ... }`, pegalo arriba de todo y poné
   `destacada: true` en el nuevo (sacáselo al anterior):

```js
{
  version:   "3.1.0",            // tiene que coincidir EXACTO con la clave de LINKS
  fecha:     "2026-09-15",       // AAAA-MM-DD
  estado:    "estable",          // "estable" o "beta"
  tamano:    "32 MB",
  destacada: true,
  notas: ["Novedad principal", "Otra novedad"]
},
```

Con eso se actualizan solos la tarjeta grande de descarga, el cartel del hero y el historial.

---

## 8. Otros textos

- **Teléfono, mail y mensajes automáticos:** `script.js`, BLOQUE 1 (objeto `CONTACTO`).
  Cambiándolo ahí se actualizan todos los botones y textos de la página.
- **Características:** cada una es un `<article class="card">` en `index.html`.
- **Preguntas frecuentes:** cada una es un `<details class="faq__item">`.
- **Aviso de licencia:** sección `#descargas`, bloque `<div class="alert">`.
- **Formulario de descarga:** al final del `index.html`, en `<div class="modal" id="modalDescarga">`.

---

## 9. Probarlo en tu PC antes de subirlo

```bash
python -m http.server 8010
```

y abrí `http://localhost:8010`.

---

## 10. Límites que conviene tener presentes

- **Mails por día:** una cuenta de Gmail común permite ~100 destinatarios por día desde Apps
  Script. Para el volumen esperado sobra.
- **MediaFire gratuito** muestra publicidad y una pantalla intermedia antes de la descarga.
  No rompe nada, pero es lo que va a ver el interesado.
- **El link se puede reenviar.** No importa: sin licencia el programa no se usa, y para la
  licencia te tienen que escribir igual. La puerta sirve para tener el registro de quién lo pidió.
