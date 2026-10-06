# Landing Page — Cotizador de Aberturas

Sitio estático (HTML + CSS + JS) publicado en GitHub Pages. El foro suma un backend chico
aparte, en Cloudflare (ver punto 11).

```
landing-cotizador/
├── index.html              Estructura y textos de la página
├── landing.css             Forma de la página: tipografía, espacios y componentes
├── css/
│   └── variables-brand.css Colores de la página: la paleta del programa (Blanco / Silver)
├── script.js               Versiones, datos de contacto y formulario de descarga
├── styles.css              Estilos viejos: ya sólo los usa el panel admin.html
├── favicon.svg             Ícono de la pestaña
├── img/                    portada.jpg (miniatura al compartir el link) y fotos del foro
├── apps-script/
│   └── Codigo.gs           Script de Google: base de datos + mail con el link
├── foro.html / foro.js     Foro de Carpinteros (ver punto 11)
├── admin.html / admin.js   Panel de moderación del foro
├── src/                    Backend del foro: Cloudflare Worker
├── schema.sql              Esquema completo de la base del foro (para una base nueva)
├── migraciones/            Pasos para llevar la base que ya existe hasta ese esquema
├── wrangler.toml           Configuración del worker (sin secretos)
└── README.md               Este archivo
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

> **Estado actual:** el formulario todavía no está conectado (`ENDPOINT` vacío en `script.js`),
> así que la página ofrece el botón **Descargar** con el link directo a MediaFire, sin pedir
> datos. Lo que sigue describe el esquema con formulario, que se activa con el punto 4.

1. El visitante toca *Recibir el link por mail* y se abre un formulario: nombre y apellido,
   localidad, email y WhatsApp.
2. La página valida el formato (nombre con apellido, mail bien escrito, WhatsApp argentino
   de 10 dígitos) y descarta los correos temporales tipo `mailinator.com`.
3. Los datos se mandan al script de Google, que **guarda la fila en tu planilla** y
   **le envía el link de MediaFire al mail que dejó**.
4. Vos recibís un aviso con sus datos para poder contactarlo.

**Por qué el link llega por mail y no aparece en pantalla:** es la única verificación real
posible en un sitio sin servidor. Validar el formato del mail con JavaScript no prueba nada —
cualquiera escribe `juan@gmail.com`. Si el correo es falso, el link nunca le llega.

Ojo: con el formulario conectado, sacá el campo `enlace` de la versión destacada en `script.js`.
Mientras esté, el botón «Descargar» muestra el link directo y la gente se saltea el formulario.

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

> Mientras `ENDPOINT` esté vacío, la página no muestra el botón «Recibir el link por mail» ni la
> pregunta frecuente del formulario: la descarga es sólo el botón «Descargar» (link directo a
> MediaFire). Al pegar la URL, aparecen solos.

**Cada vez que edites el script** (por ejemplo para sumar una versión a `LINKS`), acordate de
**Implementar → Administrar implementaciones → ✏️ → Versión: Nueva → Implementar**, o los
cambios no salen a producción.

---

## 5. Imágenes

La página ya no lleva galería de fotos: lo que muestra el producto son los dos videos. Queda una
sola imagen en uso, **`img/portada.jpg`** (1200 × 630 px, formato `.jpg`, nombre en minúsculas):
es la miniatura que se ve al compartir el link por WhatsApp o Facebook. Para cambiarla,
reemplazá el archivo con el mismo nombre.

Las fotos `img/galeria-*.jpg` ya no se muestran en la página; quedaron en la carpeta por si las
querés volver a usar.

---

## 6. Los dos temas: Blanco y Silver

El selector está en la barra de arriba y usa **las mismas paletas del programa**
(`ui/tema.py`): *Blanco* es la paleta `claro` y *Silver* es la paleta `silver`.
La elección de cada visitante queda guardada en su navegador.

Los colores están en **`css/variables-brand.css`**, en dos bloques:

```css
:root                { ... }   /* Blanco (paleta claro)  */
[data-tema="silver"] { ... }   /* Silver (paleta silver) */
```

**Si cambiás un color, cambialo en los dos bloques**, con el mismo nombre de variable; si no,
un tema queda desparejo. Los principales:

| Variable | Para qué sirve |
|---|---|
| `--color-brand-primary` / `-primary-hover` | Botones y raya de los títulos |
| `--color-brand-on-primary` | Texto que va encima del color primario |
| `--color-brand-accent` / `-accent-hover` | Links, tildes y etiquetas |
| `--color-brand-bg` | Fondo de la página |
| `--color-brand-surface` / `-surface-2` | Franjas y cuadros |
| `--color-brand-border` / `-border-soft` | Bordes |
| `--color-brand-text` / `-text-muted` | Títulos y párrafos / textos secundarios |
| `--color-brand-header-bg` / `-header-text` | Barra superior y pie |
| `--color-brand-field` / `-field-border` | Campos del formulario de descarga |

`landing.css` no tiene colores propios, salvo el verde de WhatsApp. El foro y el panel de
moderación tienen sus propios estilos (`foro.html` y `styles.css`): no cambian con este archivo.

Si cambiás `--color-brand-primary`, cambiá también el `fill` de `favicon.svg` y el color del
botón del mail en `apps-script/Codigo.gs`.

---

## 7. Publicar una versión nueva del programa de escritorio

1. Subí el `.zip` a MediaFire y copiá el vínculo.
2. En **`script.js`, BLOQUE 2**, copiá un bloque `{ ... }`, pegalo arriba de todo, pegá el
   vínculo en `enlace` y poné `destacada: true` en el nuevo (sacáselo al anterior):

```js
{
  version:   "3.4.0",
  fecha:     "2026-10-20",          // AAAA-MM-DD
  estado:    "estable",             // "estable" o "beta"
  tamano:    "32 MB",
  destacada: true,
  enlace:    "https://www.mediafire.com/file/.../CotizadorAberturas_v3.4.0.zip/file",
  notas: ["Novedad principal", "Otra novedad"]     // puede quedar vacía: []
},
```

Con eso se actualizan solos la fila de descarga del programa y el historial de versiones.

3. **Sólo si conectaste el formulario** (`ENDPOINT`, punto 4.4): sumá el mismo link al objeto
   `LINKS` de `apps-script/Codigo.gs`, con la misma clave de versión, y re-implementá el script.

```js
var LINKS = {
  "3.4.0": "https://www.mediafire.com/file/.../CotizadorAberturas_v3.4.0.zip/file",
  "3.3.0": "...",
};
```

---

## 8. Otros textos y links

- **Teléfono, mail y mensajes automáticos:** `script.js`, BLOQUE 1 (objeto `CONTACTO`).
  Cambiándolo ahí se actualizan todos los botones y textos de la página, incluido el botón
  flotante de WhatsApp (`msgGeneral`).
- **Versión web:** los links «Ingresar a la versión web» y «Probar la demo» están en
  `index.html`, sección `id="web"`.
- **Videos:** son los dos `<iframe>` de las secciones `id="web"` e `id="escritorio"`. El código
  largo de la URL (`.../file/d/CODIGO/preview`) es el id del archivo de Google Drive, que tiene
  que estar compartido como «Cualquier persona con el vínculo».
- **Manual y catálogo de Herrero:** links directos a MediaFire en la sección `id="descargas"`
  de `index.html` (buscá `Manual_del_Cotizador` y `linea_Herrero_Aluar`).
- **Preguntas frecuentes:** cada una es un `<details>` dentro de `<div class="faq">`.
- **Formulario de descarga:** al final del `index.html`, en `<div class="modal" id="modalDescarga">`.
  Sólo aparece si `ENDPOINT` está conectado.

---

## 9. Probarlo en tu PC antes de subirlo

```bash
python -m http.server 8010
```

y abrí `http://localhost:8010`. Para probar también el foro con su API local, ver el punto 11.5.

> Evitá los puertos que Chrome bloquea por seguridad (por ejemplo 5060, 5061 o 6000): la página
> simplemente no abre y no dice por qué.

---

## 10. Límites que conviene tener presentes

- **Mails por día:** una cuenta de Gmail común permite ~100 destinatarios por día desde Apps
  Script. Para el volumen esperado sobra.
- **MediaFire gratuito** muestra publicidad y una pantalla intermedia antes de la descarga.
  No rompe nada, pero es lo que va a ver el interesado.
- **El link se puede reenviar.** No importa: sin licencia el programa no se usa, y para la
  licencia te tienen que escribir igual. La puerta sirve para tener el registro de quién lo pidió.

---

## 11. El foro: backend, sesiones y secretos

`foro.html` y `admin.html` son páginas estáticas como el resto, pero leen y escriben en una API
propia: un **Cloudflare Worker** (carpeta `src/`) con una base **D1** llamada `cotizador-forum`.

- **API:** https://cotizador-forum.fgpereyra-92.workers.dev
- **Todas las rutas**, explicadas, están arriba de todo en `src/worker.js`.

### 11.1 Cómo se sabe quién escribe

1. Al entrar (login, registro o "responder anónimamente"), el worker devuelve un **token de sesión
   firmado** con HMAC-SHA256 y el secreto `SESSION_SECRET`. Vence a los 30 días (7 si es invitado).
2. `foro.js` lo guarda en el navegador y lo manda en el header `Authorization` cada vez que alguien
   pregunta, responde o vota.
3. El worker verifica la firma y el vencimiento, y **toma el usuario del token**. Si alguien manda un
   `usuario_id` a mano, se ignora.

Leer el foro no pide sesión. Los invitados sólo pueden responder: preguntar y votar pide cuenta.

Las contraseñas se guardan con **PBKDF2-SHA256 y sal**. Las cuentas creadas antes (SHA-256 sin sal)
se pasan solas al formato nuevo la próxima vez que entran.

### 11.2 El panel de administración

`admin.html` pide una sola contraseña, que el worker compara con el secreto `ADMIN_PASSWORD`. Si
coincide, devuelve un token de admin que vence a las 8 horas y se borra al cerrar la pestaña.
**Ninguna credencial está escrita en el código ni en el repo**, porque el repo es público.

Tener `rol = 'admin'` en la tabla `usuarios` sólo muestra la insignia "Admin" en el foro: no da
acceso al panel.

### 11.3 Los secretos

| Secreto | Para qué sirve | Cómo se carga |
|---|---|---|
| `SESSION_SECRET` | Firma las sesiones. Cambiarlo cierra **todas** las sesiones abiertas. | `wrangler secret put SESSION_SECRET` |
| `ADMIN_PASSWORD` | Contraseña del panel. Mínimo 12 caracteres; mejor 20 al azar, guardada en un gestor de contraseñas. | `wrangler secret put ADMIN_PASSWORD` |

Nunca van en `wrangler.toml` ni en el código. Si falta alguno, el worker rechaza los logins en vez
de usar un valor por defecto. `wrangler secret put` pide el valor sin mostrarlo en pantalla.

### 11.4 Imágenes

El navegador achica cada foto (lado mayor de 1600 px) antes de subirla. El worker comprueba que sea
de verdad JPG, PNG o WebP y la guarda en la tabla `imagenes`: hasta 3 por mensaje y 1 MB cada una.
Al borrar un mensaje desde el panel se borran también sus imágenes.

### 11.5 Probar el foro en tu PC sin tocar la base real

1. Creá un archivo `.dev.vars` en esta carpeta (ya está en `.gitignore`) con valores **de prueba**:

   ```
   SESSION_SECRET="un-texto-de-prueba-de-al-menos-32-caracteres"
   ADMIN_PASSWORD="contraseña-de-prueba"
   ```

2. Creá la base local. Si ya tenías una de antes, borrá primero la carpeta `.wrangler/state`:

   ```bash
   wrangler d1 execute cotizador-forum --local --file schema.sql
   ```

3. Levantá la API local, que queda en `http://127.0.0.1:8787`:

   ```bash
   wrangler dev --local
   ```

4. En otra terminal, levantá la web (punto 9) y abrí `http://localhost:8010/foro.html`.

Abiertas desde `localhost`, `foro.js` y `admin.js` usan solas la API local.
**Nunca pruebes con `--remote`**: eso lee y escribe la base de producción.

### 11.6 Publicar cambios del foro

- **`foro.html`, `foro.js`, `admin.html` o `admin.js`:** `git push`, como el resto de la web.
- **`src/`:** `wrangler deploy`.
- **La base:** primero un respaldo **fuera del repo** (tiene emails y hashes) y después el archivo
  de `migraciones/` que corresponda:

  ```bash
  wrangler d1 export cotizador-forum --remote --output "../respaldos/foro-AAAA-MM-DD.sql"
  wrangler d1 execute cotizador-forum --remote --file migraciones/NOMBRE.sql
  ```

`schema.sql` es el esquema completo para una base nueva; `migraciones/` son los pasos para llevar
la base que ya existe hasta ese esquema.
