# Dashboard Interactivo — Cronograma Maestro Azzorti & Livva

Aplicación web interactiva (Diagrama de Gantt y Matriz de Fechas) para visualizar, filtrar y actualizar el cronograma de desarrollo, abastecimiento, producción y facturación de **Azzorti** y **Livva** (desde **C1-4 2027** hasta **C7-10 2029**, con soporte opcional para campañas 2026).

## Archivos del proyecto

- `index.html`: Interfaz principal del dashboard.
- `styles.css`: Hoja de estilos del panel de control, diagrama de Gantt y matriz de fechas.
- `app.js`: Lógica de filtrado (Marca, Proceso, Área, Campaña), cálculo de días hábiles (`DH`), lector nativo de archivos Excel (`.xlsx` / `.csv`) y exportación a `.ics` / `.csv`.
- `datos_cronograma.js`: Base de datos inicial con las 259 actividades y 52 campañas.

## Uso

1. Abre `index.html` directamente en cualquier navegador web.
2. Para actualizar las fechas con una nueva versión del cronograma, haz clic en **"📂 Subir nueva versión Excel (.xlsx / .csv)"** o arrastra el archivo sobre la ventana.
