# 🌧️ GOTAIA 2.0 - Plataforma Agrícola Técnica con IA

GOTAIA 2.0 es una plataforma SaaS de agricultura de precisión diseñada para productores técnicos y empresas agrícolas en Bolivia. El sistema realiza diagnósticos técnicos de riego combinando climatología en tiempo real, características texturales del suelo, etapas fenológicas de los cultivos y un asistente inteligente de IA con memoria conversacional y chat de voz.

---

## 🚀 Requisitos e Instalación

Para ejecutar este proyecto de forma local en tu computadora:

1. **Instalar Node.js** (Versión 18 o superior recomendada, testeado en v24.15.0).
2. **Abrir la carpeta del proyecto** en tu terminal.
3. **Instalar las dependencias**:
   ```bash
   npm install
   ```
4. **Iniciar el servidor**:
   ```bash
   node server.js
   ```
5. **Abrir en tu navegador**: Ingresa a [http://localhost:3000](http://localhost:3000).

---

## ⚙️ Variables de Entorno

Puedes crear un archivo `.env` en la raíz del proyecto para cargar las API Keys de manera segura y automática en el backend (compatible con la carga nativa de variables en Node.js):

```env
PORT=3000
GEMINI_API_KEY=tu_google_gemini_api_key_aqui
WEATHER_API_KEY=tu_weather_api_key_aqui
```

* **`GEMINI_API_KEY`**: Permite al Asistente Técnico IA utilizar el modelo `gemini-1.5-flash` para generar observaciones agrónomas contextualizadas e hiper-personalizadas en tiempo real.
* **`WEATHER_API_KEY`**: Clave de API requerida si seleccionas un proveedor externo como **WeatherAPI.com**, **OpenWeatherMap.org** o **Visual Crossing**.

*Nota: También puedes configurar y guardar estas claves directamente desde la pantalla de **Configuración** en la interfaz web, las cuales se persistirán localmente en `database.json`.*

---

## 📦 Planes de Suscripción y Control de Acceso

La plataforma integra una lógica centralizada de permisos (`canAccess(userPlan, feature)`) para controlar el acceso a los módulos en base al nivel de suscripción:

### 1. PLAN SEMILLITA — GRATIS
* **Acceso básico**: Consulta limitada a 3 cultivos principales (Maíz, Soya, Lechuga) y 3 municipios (Santa Cruz, Montero, Warnes).
* **Informe técnico básico**: Diagnóstico simplificado de riego.
* **Sin Asistente IA / Sin Chat de Voz / Sin Exportaciones Office / Sin Módulo de Agua**.

### 2. PLAN CEBOLLITA — PLUS (Mensual)
* **Asistente Técnico IA**: Chatea con el asesor técnico con memoria de conversación (texto).
* **Informe técnico intermedio**: Incluye prioridades y desglose textural del suelo.
* **Historial técnico básico**: Guarda y visualiza tus informes anteriores.
* **Sin Chat de Voz / Sin Exportaciones Office / Sin Módulo de Agua**.

### 3. PLAN MAIZINGO — PLUS (Anual - 20% Descuento)
* **Asistente Técnico IA**: Acceso completo por texto.
* **Chat de Voz a Voz**: Habla directamente con la IA y escucha sus respuestas agrónomas con síntesis de voz (Web Speech API).
* **Informe técnico avanzado**: Diagnóstico completo con observaciones detalladas de la IA.
* **Historial completo**: Guarda reportes y logs de conversaciones de IA.
* **Sin Exportaciones Office / Sin Módulo de Agua**.

### 4. PLAN AGROPRO — EMPRESARIAL (Anual)
* **Todo lo del Plan Maizingo** más:
* **Módulo de Agua para Riego**: Registro de consumo de riego acumulado, comparación de agua disponible frente a recomendada y alertas visuales de déficit hídrico crítico en acuíferos.
* **Exportaciones Profesionales**: Descarga informes técnicos en formato **Word (.doc)** y hojas de cálculo **Excel (.csv)**.
* **Análisis completo e Historial Técnico completo** (informes, chats y registros de agua).

---

## 🛠️ Endpoints de API (Backend)

El servidor Express expone los siguientes endpoints técnicos para integraciones:

### Planes y Suscripción
* `GET /api/plans`: Retorna la lista de planes, precios y permisos.
* `GET /api/subscription/current`: Retorna el plan de suscripción activo del usuario.
* `POST /api/subscription/current`: Cambia el plan del usuario actual en tiempo real para simulación de permisos.

### Catálogos Técnicos
* `GET /api/crops`: Obtiene los parámetros de los 20 cultivos mínimos configurados (Maíz, Soya, Arroz, Trigo, Papa, Tomate, etc.).
* `GET /api/municipalities`: Obtiene los 39 municipios agrícolas de Bolivia (Santa Cruz, Montero, Warnes, Cochabamba, Tarija, El Alto, Trinidad, etc.).

### Clima
* `GET /api/weather?municipio=key`: Obtiene la climatología estándar en tiempo real usando el proveedor activo.
* `GET /api/weather/providers`: Obtiene la lista de proveedores climáticos soportados y el activo.
* `POST /api/weather/providers`: Guarda la configuración de API keys y el proveedor activo.

### Diagnósticos e Informes
* `POST /api/irrigation/report`: Procesa variables del predio y calcula el índice de riesgo hídrico GOTAIA y recomendación volumétrica.
* `GET /api/reports/history`: Retorna la bitácora de informes técnicos previos.

### Control de Consumo de Agua (AgroPro)
* `GET /api/irrigation/water-tracking`: Obtiene los registros históricos del consumo acumulado.
* `POST /api/irrigation/water-tracking`: Añade un registro de riego de campaña.

### Asistente IA & Voz
* `POST /api/assistant/chat`: Interactúa con el modelo conversacional agrónomo de Gemini (o simulador local) con historial.
* `GET /api/assistant/history`: Obtiene el historial de chats del usuario.
* `POST /api/assistant/memory`: Limpia el historial y reinicia la memoria de contexto de la IA.
* `POST /api/assistant/voice`: Procesa consultas cortas optimizadas para respuestas de audio por voz.

### Exportaciones
* `POST /api/reports/export/word`: Exporta un informe agrónomo en formato legible por Microsoft Word (.doc).
* `POST /api/reports/export/excel`: Exporta las columnas técnicas del reporte en formato legible por Microsoft Excel (.csv en TSV UTF-8 BOM).

---

## 💾 Persistencia de Datos local

El proyecto utiliza un archivo `database.json` autogenerado en la raíz para almacenar la configuración de las APIs, el historial de consultas de IA, la bitácora de reportes de riego y los consumos de agua. La arquitectura orientada a la clase `DatabaseService` permite cambiar el almacenamiento a motores relacionales o NoSQL como **PostgreSQL, Supabase, Firebase o MongoDB** reemplazando los métodos de carga y guardado correspondientes.

## Enlaces del proyecto
- Video/demo: PEGA_AQUI_TU_LINK
