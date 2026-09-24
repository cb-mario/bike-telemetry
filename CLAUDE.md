# Contexto del Proyecto: BikeTelemetry / Cycling Analytics

Aplicación web personal para registrar entrenamientos y rutas en bicicleta, analizar métricas de rendimiento (pulsaciones medias/máximas, distancia, desnivel acumulado, tiempo, cadencia/potencia opcional) y visualizar la evolución a lo largo del tiempo.

---

## 🛠️ Stack Tecnológico
- **Backend:** Node.js + Express (JavaScript / TypeScript)
- **Base de Datos:** SQLite / PostgreSQL local (ORM/Query Builder: Prisma o Knex / pg)
- **Frontend:** HTML/Tailwind CSS con templates (o Astro / React según convención acordada)
- **Autenticación:** JWT o cookies de sesión (bcrypt para hashing de contraseñas)
- **Control de Versiones:** Git

---

## 💻 Comandos Frecuentes
- Arrancar en desarrollo: `npm run dev`
- Ejecutar migraciones/BD: `npx prisma migrate dev` (o script equivalente)
- Ejecutar tests: `npm test`
- Linter / Formato: `npm run lint`

---

## 📁 Convenciones de Arquitectura y Carpetas
Seguir un patrón por capas claro y desacoplado:

/src
  ├── /controllers   # Manejo de peticiones HTTP, validación y respuestas
  ├── /routes        # Definición de rutas y endpoints REST
  ├── /services      # Lógica de negocio (cálculo de promedios, zonas de pulso, etc.)
  ├── /models        # Esquemas de datos y acceso a base de datos
  ├── /middlewares   # Verificación de autenticación (authMiddleware) y errores
  └── server.js      # Punto de entrada de la aplicación

---

## 🔒 Reglas de Desarrollo y Buenas Prácticas
1. **Paso a paso e incremental:** No implementes múltiples módulos a la vez. Desarrolla y valida primero la base de datos y la autenticación antes de pasar a la visualización de rutas o métricas.
2. **Seguridad básica:**
   - Nunca almacenar contraseñas en texto plano; usar siempre hashing con salt (bcrypt / argon2).
   - Proteger los endpoints privados mediante el middleware de autenticación.
   - Usar variables de entorno (`.env`) para secrets (JWT_SECRET, puertos, credenciales de BD) y no comitearlas al repositorio.
3. **Manejo de Errores:**
   - Devolver respuestas JSON uniformes (`{ "error": "Mensaje descriptivo" }`) con los códigos de estado HTTP adecuados (400, 401, 403, 404, 500).
4. **Validación de Datos:**
   - Validar los datos de entrada antes de guardarlos (duraciones positivas, fechas válidas, rangos lógicos de frecuencia cardíaca, ej. 40-220 bpm).
5. **No romper código existente:** Antes de modificar un archivo, comprueba las funciones y modelos actuales para evitar duplicar lógica o renombrar imports.
## 🎨 Dirección de Diseño (UI/UX)
- **Estética:** Minimalista inspirada en Apple / dashboard moderno.
- **Paleta:** Modo oscuro limpio (fondos oscuros neutros `#09090b` o `#0f172a`), bordes sutiles de 1px (`border-neutral-800`), acentos funcionales discretos.
- **Componentes:** Inspirados en shadcn/ui (tarjetas con bordes finos, tipografía sobria, espaciado amplio y métricas destacadas en grande).
- **Herramienta de estilos:** Tailwind CSS.
