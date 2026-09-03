# Landing Page — Cotizador de Aberturas

Sitio estático (HTML + CSS + JS, sin backend) publicado en GitHub Pages.

```
landing-cotizador/
├── index.html            Estructura y textos de la página
├── styles.css            Diseño. Los colores están arriba de todo, en :root
├── script.js             Versiones, datos de contacto y formulario de descarga
├── favicon.svg           Ícono de la pestaña
├── apps-script/
│   └── Codigo.gs         Script de Google que guarda los datos y manda el mail
└── README.md             Este archivo
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

## 2. Cómo funciona la descarga

La descarga es gratuita pero **pide los datos primero**. El circuito es:

1. El visitante toca *Descargar* y se abre un formulario: nombre y apellido, localidad,
   email y WhatsApp.
2. La página valida el formato (nombre con apellido, mail bien escrito, WhatsApp argentino
   de 10 dígitos) y descarta los correos temporales tipo `mailinator.com`.
3. Los datos se mandan al script de Google, que **guarda la fila en tu planilla** y
   **le envía el link de descarga al mail que dejó**.
4. Vos recibís un aviso con sus datos para poder contactarlo.

**Por qué el link llega por mail y no aparece en pantalla:** es la única verificación real
posible en un sitio sin servidor. Validar el formato del mail con JavaScript no prueba nada —
cualquiera escribe `juan@gmail.com`. Si el correo es falso, el link nunca le llega, y punto.

Por eso también **el link no está en el código de la página**: vive únicamente dentro del
script de Google. Si estuviera en `script.js`, alcanzaría con abrir el código fuente para
saltearse el formulario.

> El .zip **no debe subirse a un Release público de GitHub**: los releases son visibles para
> cualquiera y el formulario dejaría de filtrar. Va en Drive, compartido por link.

---

## 3. Puesta en marcha (una sola vez)

### 3.1 Subir los .zip a Google Drive

1. Entrá a [drive.google.com](https://drive.google.com) y creá una carpeta,
   por ejemplo **Cotizador — Descargas**.
2. Arrastrá adentro los `.zip` de la carpeta `entregas/`.
3. Botón derecho sobre cada archivo → **Compartir** → en *Acceso general* poné
   **Cualquier persona con el enlace · Lector** → **Copiar vínculo**.
4. De ese vínculo te interesa el ID:

```
https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing
                                └────── el ID ──────┘
```

### 3.2 Crear la planilla y el script

1. Creá una planilla nueva en [sheets.new](https://sheets.new) y llamala
   **Descargas — Cotizador**.
2. Menú **Extensiones → Apps Script**. Se abre el editor.
3. Borrá lo que haya y pegá **todo** el contenido de `apps-script/Codigo.gs`.
4. Arriba del archivo, en el objeto `LINKS`, reemplazá cada `PEGAR_ACA_EL_ID_...`
   por el ID de Drive que copiaste en el paso anterior.
5. Guardá (💾).
6. Probá que funcione: elegí la función **probar** en el desplegable y tocá **▶ Ejecutar**.
   La primera vez Google te va a pedir permiso para enviar mails y escribir la planilla:
   *Revisar permisos* → elegí tu cuenta → *Configuración avanzada* → *Ir a (nombre del proyecto)*
   → **Permitir**. Si todo está bien, aparece una fila en la planilla y te llegan dos mails.

### 3.3 Publicar el script

1. En el editor, botón azul **Implementar → Nueva implementación**.
2. Engranaje ⚙️ → tipo **Aplicación web**.
3. Completá:
   - *Ejecutar como*: **Yo** (tu cuenta)
   - *Quién tiene acceso*: **Cualquier usuario** ← imprescindible, si no la página no puede escribirle
4. **Implementar** y copiá la **URL de la aplicación web** (termina en `/exec`).

### 3.4 Conectar la página con el script

Abrí `script.js`, buscá el **BLOQUE 3** y pegá la URL:

```js
const ENDPOINT = "https://script.google.com/macros/s/AKfy...../exec";
```

Subí el cambio con `git push` y listo: el formulario ya manda los mails.

> Mientras `ENDPOINT` esté vacío, el formulario valida los datos igual pero le ofrece al
> visitante pedirte el link por WhatsApp, así la página nunca queda rota.

**Cada vez que edites el script** (por ejemplo para agregar una versión nueva a `LINKS`),
acordate de **Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar**,
o los cambios no salen a producción.

---

## 4. Qué editar en el código

### Publicar una versión nueva

Son dos lugares:

1. **`apps-script/Codigo.gs`** → agregá el ID del nuevo .zip al objeto `LINKS`:

```js
var LINKS = {
  "3.1.0": "1NUEVO_ID_DE_DRIVE",
  "3.0.0": "1A2B3C4D5E6F7G8H9I",
  ...
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
  notas: [
    "Novedad principal",
    "Otra novedad"
  ]
},
```

Con eso se actualizan solos la tarjeta grande de descarga, el cartel del hero
("Versión 3.1.0 disponible") y el historial.

### Teléfono, mail o mensajes → `script.js`, BLOQUE 1

En `CONTACTO` está el WhatsApp (formato internacional, sin +, sin 0 y sin 15), el mail y los
mensajes que aparecen ya escritos cuando el visitante toca un botón.

### Colores → `styles.css`, bloque `:root` (arriba de todo)

Cambiá sólo los valores HEX de ese bloque; el resto de la hoja los toma solos.

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

Si cambiás `--color-primary`, cambiá también el `fill="#2563eb"` de `favicon.svg` y el color
del botón dentro del mail (`#2563eb` en `apps-script/Codigo.gs`).

### Textos, características y preguntas frecuentes → `index.html`

- Cada característica es un bloque `<article class="card">`: copialo o borralo.
- Cada pregunta frecuente es un bloque `<details class="faq__item">`: mismo criterio.
- El aviso de licencia está en la sección `#descargas`, bloque `<div class="alert">`.
- El formulario de descarga está al final, en `<div class="modal" id="modalDescarga">`.

---

## 5. Probarlo en tu PC antes de subirlo

Desde esta carpeta:

```bash
python -m http.server 8010
```

y abrí `http://localhost:8010` en el navegador.

---

## 6. Límites que conviene tener presentes

- **Mails por día:** una cuenta de Gmail común permite ~100 destinatarios por día desde Apps
  Script. Para el volumen esperado sobra.
- **Archivos grandes en Drive:** arriba de 25 MB, la descarga directa muestra un aviso de
  "no se pudo analizar en busca de virus". Por eso el mail lleva a la pantalla normal de Drive,
  con su botón *Descargar*, que no tiene ese problema.
- **El link se puede reenviar.** Quien lo recibe puede pasárselo a otro. La puerta sirve para
  saber quién pide el programa, no para impedir que circule.
