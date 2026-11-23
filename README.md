# StopIt para YouTube

Extensión para Chrome de escritorio. Al entrar a YouTube o tocar Inicio, abre tus suscripciones. Al abrir un video, el panel lateral muestra ese mismo feed. StopIt oculta los accesos a Shorts y te lleva a Suscripciones cuando abrís uno.

## Instalar en Chrome

1. Abrí `chrome://extensions`.
2. Activá **Modo de desarrollador** y elegí **Cargar extensión sin empaquetar**.
3. Seleccioná la carpeta **extension** de este proyecto, donde está `manifest.json`.
4. Recargá las pestañas de YouTube que ya estaban abiertas. La extensión usa la sesión de YouTube de ese perfil.

La carpeta contiene la extensión lista para usar. Para aplicar cambios posteriores, usá el botón de recarga de StopIt en la página de extensiones y recargá YouTube.

## Qué vas a ver

- **Inicio y Suscripciones.** Las publicaciones conservan el orden cronológico del feed nativo. StopIt quita los bloques de selección por relevancia, los Shorts y los estrenos programados. Los directos entran en la lista según su hora de inicio. Las grabaciones siguen el orden de publicación. La lista se actualiza al bajar.
- **Búsqueda.** StopIt oculta las secciones de Shorts de los resultados, también cuando aparecen al seguir bajando.
- **Junto al reproductor.** El panel abre el feed de la cuenta activa, también cuando llegás por un enlace externo. Podés desplazarte dentro del panel para cargar más videos. Si el video que estás viendo aparece entre tus suscripciones, lleva la marca «Reproduciendo». Al elegir otro, se abre en la pestaña principal. El chat de los directos y la cola de las playlists siguen disponibles.
- **Enlaces compartidos.** Para una dirección de video ambigua, StopIt consulta sus metadatos en YouTube antes de abrir el reproductor. Los Shorts llevan a Suscripciones. Los videos normales conservan los parámetros de la lista y la marca de tiempo del enlace.
- **Sin sesión o sin conexión.** YouTube ofrece iniciar sesión cuando abrís tus suscripciones sin una cuenta activa. Si un enlace de video no se puede verificar, StopIt muestra las opciones de reintentar o ir a Suscripciones.

El filtrado del feed utiliza los elementos de la interfaz de escritorio de YouTube. Un cambio en esa interfaz puede requerir ajustar la extensión. Si el panel no puede cargar el feed, podés reintentar o abrir Suscripciones desde el mensaje de error.

## Ajustes

Hacé clic en el ícono de StopIt en el menú de extensiones de Chrome. Activá **Mostrar notificaciones** para ver la campana y abrir su panel en la barra superior de YouTube. Por defecto están ocultos. La elección se guarda en este perfil y se aplica a las pestañas abiertas.

StopIt también oculta el filtro **Shorts** en el Historial, las listas de reproducción (incluidos Ver más tarde y Videos que me gustan), los filtros de búsqueda y las pestañas de los canales.

## Datos y permisos

La extensión carga Suscripciones desde YouTube con la sesión activa de la pestaña. Guarda en la memoria de la sesión de Chrome la clasificación de hasta 512 identificadores de video. Solicita acceso a los dominios de YouTube que usa para navegar y verificar videos, y emplea reglas de Chrome para redirigir la pestaña antes de cargar el reproductor.

## Pruebas

Con Node.js 22 o posterior, ejecutá:

```sh
npm ci
npx playwright-core install chromium
npm test
```

También podés indicar un ejecutable de Chrome for Testing con la variable `CHROME_FOR_TESTING`. Las pruebas cargan la extensión en un perfil temporal y usan páginas de prueba con fechas conocidas. Comparan Inicio con el panel al abrir un enlace externo en un perfil nuevo. También cubren la paginación, el orden de los directos, los enlaces a Shorts, el historial y los errores de verificación.
