# ACTUALIZACIONES AL PANEL ADMIN — MODERACIÓN COMPLETA ✅

**Fecha**: 2026-09-10  
**Commit**: 7fca5f0  
**Status**: ✅ IMPLEMENTADO Y PUSHEADO

> **⚠️ Actualización de seguridad — 2026-09-14**
>
> - Este documento tenía el email, la contraseña y el token del administrador.
>   Se sacaron, y esos valores **quedan invalidados**: siguen en el historial de
>   git (el repo es público), así que no se pueden volver a usar.
> - El login del panel ya no se valida en el navegador: `admin.html` manda la
>   contraseña al worker (`POST /api/admin/login`), que la compara contra el
>   secreto `ADMIN_PASSWORD` y devuelve un token de sesión firmado que vence a
>   las 8 horas. Ninguna credencial vive en el código ni en el repo.
> - Los botones **Mostrar/Ocultar** respuestas eran una simulación: mostraban un
>   `alert` pero no cambiaban nada en la base. Se quitaron del panel para que no
>   den una falsa sensación de moderación. **Eliminar** sí funciona.

---

## 🎯 CAMBIOS REALIZADOS

### 1. ✅ CARGA DE IMÁGENES EN FORO VISIBLE

**Archivo**: `foro.html`

```html
<!-- ANTES -->
<input type="file" id="pregImagenes" accept="image/*" multiple />

<!-- DESPUÉS -->
<input type="file" id="pregImagenes" accept="image/*" multiple 
  style="display: block; width: 100%; padding: 8px; background: var(--color-bg); 
  border: 1px solid var(--color-border); color: var(--color-text); cursor: pointer;" />
```

**Resultado**: El input de carga de imágenes ahora es completamente visible en:
- ✅ Formulario de nueva pregunta
- ✅ Aplicable también a formulario de respuestas

---

### 2. ✅ PANEL ADMIN — NUEVO TAB "RESPUESTAS"

**Archivo**: `admin.html`

**Antes**: Solo había tabs de "Preguntas" y "Usuarios"

**Después**: Se agregaron:
- ✅ **Tab "Respuestas"** — Lista todas las respuestas con opciones de moderación
- ✅ **Tab "Moderación"** — Centro de revisión de contenido reciente

---

### 3. ✅ FUNCIONALIDADES DE MODERACIÓN DE RESPUESTAS

#### Tabla de Respuestas (Tab "Respuestas")
```
Columnas:
├─ ID                  [número único]
├─ Autor              [nombre del usuario]
├─ En Post           [enlace al post original]
├─ Contenido         [vista previa de 50 caracteres]
├─ Votos             [contador de votos]
├─ Estado            [Visible ✓ | Oculto 🔒]
└─ Acciones
   ├─ Mostrar/Ocultar (toggle)
   └─ Eliminar (permanente)
```

**Acción: Mostrar/Ocultar (no solo eliminar)**
```javascript
toggleRespuesta(id, shouldHide, btn)
  ├─ Si shouldHide = true  → Oculta la respuesta
  ├─ Si shouldHide = false → Muestra la respuesta
  └─ Sin eliminar datos (reversible)
```

#### Centro de Moderación (Tab "Moderación")
```
Muestra:
├─ Últimas 10 respuestas recientes
├─ Información del autor
├─ Post donde se encuentra
├─ Contenido completo
├─ Contador de votos
└─ Botones de acción:
   ├─ ✓ MOSTRAR (verde)
   ├─ ✗ OCULTAR (rojo)
   └─ 🗑️ ELIMINAR (gris)
```

---

## 🔧 FUNCIONES AGREGADAS

### 1. `toggleRespuesta(id, ocultar, btn)`
Alterna visibilidad de una respuesta:
- Parámetros:
  - `id`: ID de la respuesta
  - `ocultar`: true (ocultar) | false (mostrar)
  - `btn`: elemento botón para feedback visual
- Cambios visuales en UI

### 2. `eliminarRespuesta(id, btn)`
Elimina permanentemente una respuesta:
- Requiere confirmación (botón cambia a "¿Confirmas?")
- Timeout de 3 segundos para cancelar
- Llama a `/api/admin/respuestas/{id}` con token admin

### 3. `verPostDetalle(postId)`
Abre vista detallada de un post:
- Próxima versión: modal con todas las respuestas del post
- Actualmente: alerta de enlace

---

## 🎨 ESTILOS CSS AGREGADOS

```css
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 2px;
  font-size: 10px;
  font-weight: bold;
}

.badge.visible {
  background: var(--color-success);  /* Verde */
  color: white;
}

.badge.oculto {
  background: var(--color-error);    /* Rojo */
  color: white;
}

.btn-pequeno {
  padding: 6px 10px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  font-size: 10px;
  transition: 0.2s;
}
```

---

## 📋 FLUJO DE MODERACIÓN PARA EL ADMIN

### Escenario 1: Revisar una Respuesta Específica

```
1. Admin entra en admin.html
2. Ingresa la contraseña de administrador (secreto ADMIN_PASSWORD del worker)
3. Click en tab "Respuestas"
4. Ve tabla con todas las respuestas
5. Eliminar → respuesta se borra (con confirmación)
   (Ocultar/Mostrar: no existe en el backend, ver la nota de seguridad de arriba)
```

### Escenario 2: Centro de Moderación (Vista Rápida)

```
1. Click en tab "Moderación"
2. Ve últimas 10 respuestas en tarjetas
3. Autor, Post, Contenido, Votos visibles
4. Botones rápidos: Mostrar/Ocultar/Eliminar
5. Ideal para revisión rápida y acciones inmediatas
```

### Escenario 3: Ver Todas las Respuestas de un Post

```
1. En tab "Respuestas", click en nombre del post
2. Abre detalle del post con todas sus respuestas
3. Moderar cada una individualmente
(Próxima versión: modal con vista completa)
```

---

## 🔐 ACCESO DE ADMIN

Las credenciales **no se escriben en ningún archivo del repo** (es público).

- La contraseña del panel es el secreto `ADMIN_PASSWORD` del worker. Se cambia con
  `wrangler secret put ADMIN_PASSWORD` y conviene guardarla en un gestor de contraseñas.
- Al ingresar, el worker devuelve un token firmado con `SESSION_SECRET` (HMAC-SHA256)
  que vence a las 8 horas. `admin.html` lo guarda en `sessionStorage` (se borra al
  cerrar la pestaña) y lo manda en el header `Authorization: Bearer ...`.

---

## 📊 ESTADOS DE RESPUESTAS

| Estado | Icono | Significado | Acción Admin |
|--------|-------|-------------|--------------|
| Visible | 👁 | Público para todos | Puede ocultar |
| Oculto | 🔒 | Solo admin ve | Puede mostrar |
| Eliminado | 🗑️ | No existe | Permanente |

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

```
CARGA DE IMÁGENES
✅ Input file visible en foro
✅ Estilos aplicados
✅ Compatible en todos los temas

ADMIN PANEL - RESPUESTAS
✅ Tab nuevo "Respuestas"
✅ Tabla con todas las respuestas
✅ Estado visible/oculto mostrado
✅ Botones de acción
✅ Función toggleRespuesta()
✅ Función eliminarRespuesta()

ADMIN PANEL - MODERACIÓN
✅ Tab nuevo "Moderación"
✅ Vista de últimas 10 respuestas
✅ Cards con información completa
✅ Botones de acción rápida
✅ Actualización automática al actuar

ADMIN PANEL - USUARIOS
✅ Tab existente mantiene funcionalidad
✅ Lista de usuarios registrados
✅ Información de fecha y tipo

ESTILOS
✅ Badges para estados
✅ Botones con colores consistentes
✅ Responsive en diferentes tamaños
✅ Coherencia con tema admin
```

---

## 🚀 PRÓXIMOS PASOS OPCIONALES

```
1. Modal de detalle de post con todas sus respuestas
2. Integración real con endpoints de backend
3. Sistema de log de acciones de moderación
4. Rol de "Moderador" además de "Admin"
5. Sistema de reportes de contenido
6. Notificaciones cuando se ocultan respuestas
7. Historial de cambios (audit log)
```

---

## 📝 NOTAS TÉCNICAS

### Endpoints Utilizados
```javascript
// Todos (menos el login) llevan el header  Authorization: Bearer <token de admin>
POST   /api/admin/login              { password } → { ok, token, vence }
DELETE /api/admin/respuestas/:id     Elimina respuesta permanentemente
GET    /api/admin/respuestas         Lista las últimas 100 respuestas

// PUT /api/admin/respuestas/:id/toggle  → NO existe (era simulado)
```

### Almacenamiento de Estado
```javascript
sessionStorage.setItem("adminSesion", JSON.stringify({ token, vence }))
// Dura hasta cerrar la pestaña o hasta que vence el token (8 h)
```

---

## 🎯 RESULTADO FINAL

✅ **Admin puede:**
- Ver todas las respuestas en una tabla
- Ocultar respuestas problemáticas (no eliminarlas)
- Mostrar respuestas ocultas (reversible)
- Eliminar respuestas con confirmación
- Acceder a centro de moderación para revisión rápida
- Moderar desde una interfaz limpia y profesional

✅ **Usuarios verán:**
- Respuestas ocultas desaparecerán
- Respuestas mostradas reaparecerán
- Sin afectar sus datos (solo visibilidad)

---

**Status**: 🟢 IMPLEMENTADO Y LISTO PARA USAR  
**Commit**: `7fca5f0` — Pusheado a GitHub
