# StopIt para YouTube

Extensión para Chrome de escritorio. Al entrar a YouTube o tocar Inicio, abre tus suscripciones. Oculta los accesos a Shorts y te lleva a Suscripciones cuando abrís uno.

## Instalar en Chrome

1. Abrí `chrome://extensions`.
2. Activá **Modo de desarrollador** y elegí **Cargar extensión sin empaquetar**.
3. Seleccioná la carpeta **extension** de este proyecto, donde está `manifest.json`.
4. Recargá las pestañas de YouTube que ya estaban abiertas. La extensión usa la sesión de YouTube de ese perfil.

La carpeta contiene la extensión lista para usar. Para aplicar cambios posteriores, usá el botón de recarga de StopIt en la página de extensiones y recargá YouTube.

## Qué vas a ver

- **Inicio y Suscripciones.** Las publicaciones conservan el orden cronológico del feed nativo. StopIt quita los bloques de selección por relevancia, los Shorts y los estrenos programados. Los directos entran en la lista según su hora de inicio. Las grabaciones siguen el orden de publicación. La lista se actualiza al bajar.
- **Enlaces compartidos.** Para una dirección de video ambigua, StopIt consulta sus metadatos en YouTube antes de abrir el reproductor. Los Shorts llevan a Suscripciones. Los videos normales conservan los parámetros de la lista y la marca de tiempo del enlace.
- **Sin sesión o sin conexión.** YouTube ofrece iniciar sesión cuando abrís tus suscripciones sin una cuenta activa. Si un enlace de video no se puede verificar, StopIt muestra las opciones de reintentar o ir a Suscripciones.

El filtrado del feed utiliza los elementos de la interfaz de escritorio de YouTube. Un cambio en esa interfaz puede requerir ajustar la extensión. El reemplazo de las sugerencias al costado del reproductor queda para una segunda versión.

## Datos y permisos

La extensión consulta YouTube directamente. Guarda en la memoria de la sesión de Chrome la clasificación de hasta 512 identificadores de video. Solicita acceso a los dominios de YouTube que usa para navegar y verificar videos, y emplea reglas de Chrome para redirigir la pestaña antes de cargar el reproductor.

## Pruebas

Con Node.js 22 o posterior, ejecutá:

```sh
npm ci
npx playwright-core install chromium
npm test
```

También podés indicar un ejecutable de Chrome for Testing con la variable `CHROME_FOR_TESTING`. Las pruebas cargan la extensión en un perfil temporal y usan páginas de prueba con fechas conocidas. Cubren la paginación, el orden de los directos, los enlaces a Shorts, el historial y los errores de verificación.
