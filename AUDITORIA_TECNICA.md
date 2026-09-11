# AUDITORÍA TÉCNICA PROFUNDA — FORO COTIZADOR

## 1. INCONSISTENCIAS LÓGICAS ENCONTRADAS

### 1.1 Identidad Visual Confusa
- **Problema**: Tiene características genéricas modernas (sombras, bordes redondeados, paleta neón/minimalista)
- **Impacto**: No se parece a un foro clásico; se ve como "generado por IA"
- **Resolución**: Transformar a tabla-based layout tipo phpBB/vBulletin con avatares y estructura densa

### 1.2 Falta de Paginación
- **Problema**: Se carga solo `LIMIT 50` preguntas sin mecanismo de paginación
- **Impacto**: Navegación confusa en foros grandes; potencial rendimiento degradado
- **Resolución**: Implementar paginación con offset/cursor + botones "Siguiente/Anterior"

### 1.3 Ausencia de Estructura de Hilos (Threading)
- **Problema**: Respuestas son planas, no hay anidamiento; no hay "hilo de conversación"
- **Impacto**: Difícil seguir conversaciones complejas
- **Resolución**: Mantener estructura actual pero mejorar visualización con indentación y estructura de árbol CSS

### 1.4 Falta de Modelos de Usuario (Roles/Permisos)
- **Problema**: No hay diferenciaciónentre moderadores, admins y usuarios comunes en el frontend
- **Impacto**: Imposible implementar acciones de moderación (banear, cerrar hilos, etc.)
- **Resolución**: Agregar tabla de roles, validar en backend, mostrar insignias en frontend

### 1.5 Inconsistencia: Votos en Preguntas vs Respuestas
- **Problema**: Sistema de votos duplicado; cada uno maneja up/down
- **Impacto**: Código repetido; difícil de mantener
- **Resolución**: Unificar en un sistema de votos genérico con tipo (pregunta/respuesta)

### 1.6 Falta de Timestamps Correctos
- **Problema**: Fechas se guardan pero no se actualizan con "última actividad"
- **Impacto**: No se sabe cuándo fue el último comentario en un hilo
- **Resolución**: Agregar `fecha_actualizada` en preguntas; mostrar "Actualizado hace 5min"

### 1.7 Problema: Búsqueda Funciona Pero No Persiste en UI
- **Problema**: `buscar()` ejecuta pero la UI no muestra claramente el estado de búsqueda
- **Impacto**: Usuario no sabe si está en "búsqueda" o listado normal
- **Resolución**: Mostrar "X resultados para 'término'" como encabezado visible

### 1.8 Ausencia de Validación de Seguridad en Admin Delete
- **Problema**: El endpoint DELETE en `/api/admin/preguntas/:id` no valida token de admin
- **Impacto**: Potencial vulnerabilidad; cualquiera puede deletear
- **Resolución**: Agregar validación `if (!isAdmin) return 401`

### 1.9 Modales Hardcodeados en HTML
- **Problema**: Modales de auth/nueva pregunta están inline en HTML con display:none
- **Impacto**: HTML inflado; difícil de mantener
- **Resolución**: Generar dinámicamente con funciones dedicadas

### 1.10 Falta de Rate Limiting
- **Problema**: Sin límite de posts por usuario/tiempo
- **Impacto**: Spam potencial
- **Resolución**: Implementar contador de posts en última hora

---

## 2. CAMBIOS DE DISEÑO CSS/HTML PARA "FORO CLÁSICO"

### 2.1 Eliminar Diseño Moderno
- ❌ Sombras exageradas (`box-shadow: 0 2px 8px`)
- ❌ Bordes redondeados (`border-radius: 8px, 12px`)
- ❌ Gradientes y colores neón
- ❌ Grid/Flexbox excesivos

### 2.2 Adoptar Estructura Clásica
- ✅ Tablas para listado de hilos (imitando phpBB)
- ✅ Avatares 48x48px a la izquierda de cada post
- ✅ Bordes `1px solid #ccc` (minimalista pero denso)
- ✅ Menú de navegación tipo barra gris
- ✅ Backgrounds blanco/gris claros
- ✅ Tipografía serif/sans-serif pequeña (10-12px para meta)
- ✅ Números de post, firmas, insignias de usuario
- ✅ Contador de posts/último acceso por usuario

### 2.3 Elementos Visuales Clave
- **Hilo**: Tabla con 5 columnas (avatar, tema, respuestas, vistas, último post)
- **Post**: Caja con avatar a la izquierda, contenido a la derecha, firma abajo
- **Insignias**: Pequeños iconos para moderador/admin/usuario verificado
- **Estados**: Visualmente diferente si está cerrado, fijado, etc.

---

## 3. REFACTORIZACIÓN PLANIFICADA

### Fase 1: Backend (worker.js)
- [ ] Agregar `updated_at` a preguntas y respuestas
- [ ] Crear tabla de roles/permisos
- [ ] Implementar paginación (offset + count)
- [ ] Agregar validación de admin en endpoints sensibles
- [ ] Unificar sistema de votos

### Fase 2: Schema (schema.sql)
- [ ] Agregar campos: `updated_at`, `is_locked`, `is_pinned`, `role`
- [ ] Crear índices en `fecha`, `categoria_id`
- [ ] Agregar constraints de validación

### Fase 3: Frontend (foro.html)
- [ ] Reescribir CSS a tabla-based layout
- [ ] Crear template de "hilo" (table row)
- [ ] Crear template de "post" (avatar + contenido + firma)
- [ ] Agregar paginación + nav
- [ ] Mostrar estado de búsqueda
- [ ] Eliminar modales genéricos, reemplazar con tablas

---

## CONCLUSIÓN

El foro es **funcional pero estructuralmente frágil** para un verdadero sistema de comunidad clásico.
Necesita:
1. Rediseño visual completo (tabla/avatar/firma)
2. Refactorización de modelo de datos (roles, timestamps)
3. Mejora de UX (paginación, búsqueda visible)
4. Seguridad (validación de permisos, rate limiting)
