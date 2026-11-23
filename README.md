# StopIt para YouTube

[Read in English](README.en.md)

Extensión para Chrome de escritorio. Al entrar a YouTube o tocar Inicio, abre tus suscripciones. Al abrir un video, el panel lateral muestra ese mismo feed. StopIt oculta los accesos a Shorts y te lleva a Suscripciones cuando abrís uno.

Desarrollé StopIt con ayuda de inteligencia artificial, principalmente para mi propio uso. Lo comparto para que puedas usarlo, adaptarlo a tus hábitos o distribuir tu propia versión.

## Instalar en Chrome

Necesitás Chrome 120 o posterior.

1. Descargá el archivo para Chrome de la versión que quieras instalar. Su nombre sigue el formato `stopit-v3.1.0-chrome.zip`. [Releases de StopIt](https://github.com/juanmapintor/StopIt/releases)
2. Descomprimí el ZIP en una carpeta que puedas conservar. El archivo `manifest.json` está en la raíz.
3. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
4. Elegí **Cargar extensión sin empaquetar** y seleccioná la carpeta que contiene `manifest.json`.
5. Recargá las pestañas de YouTube que ya estaban abiertas. La extensión usa la sesión de YouTube de ese perfil.

Si ya tenés una copia del repositorio, podés empezar en el paso 3 y seleccionar la carpeta `extension`. Para comprobar la instalación, abrí Inicio en YouTube. La dirección cambia a `/feed/subscriptions`.

Para actualizar, reemplazá los archivos de la extensión en la misma carpeta con los de la nueva versión. Usá el botón de recarga de StopIt en la página de extensiones y recargá YouTube.

StopIt usa el idioma de la interfaz de Chrome. Si usás español, incluida cualquier variante regional, los ajustes, las secciones y los avisos aparecen en español. Para todos los demás idiomas, StopIt usa inglés. YouTube sigue mostrando sus propios controles y contenido en el idioma que elegiste en el sitio.

## Qué vas a ver

- **Inicio y Suscripciones.** Ves primero los videos más recientes de tus canales. StopIt quita los bloques de selección por relevancia, los Shorts, los estrenos programados y las tarjetas de anuncios, listas y mixes del feed de suscripciones. Los directos se intercalan según la hora de inicio que muestra YouTube. Si la tarjeta no indica cuándo empezó el directo, se conserva el orden del feed. Las grabaciones siguen el orden de publicación. La lista se actualiza al bajar.
- **Shorts.** StopIt oculta el acceso de la barra lateral, las filas de Shorts del feed y las secciones completas de los resultados de búsqueda, también las que aparecen al seguir bajando. Quita el filtro o la pestaña Shorts en el Historial, las listas de reproducción, Ver más tarde, Videos que me gustan, las búsquedas y los canales.
- **Junto al reproductor.** El panel abre el feed de la cuenta activa, también cuando llegás por un enlace externo. Al bajar a los comentarios, el panel lateral queda debajo de la barra superior y ocupa la altura disponible, también en modo cine. Podés desplazarte dentro del panel para cargar más videos. Si el video que estás viendo aparece entre tus suscripciones, lleva la marca «Reproduciendo». Al elegir otro, se abre en la pestaña principal. También podés usar el menú del enlace para abrirlo en otra pestaña. El chat de los directos y la cola de las playlists siguen disponibles.
- **Enlaces compartidos.** Un enlace directo a Shorts te lleva a Suscripciones. Si la dirección es ambigua, StopIt verifica los metadatos del video antes de abrirlo. Esto también cubre enlaces al reproductor insertado que abras como página en una pestaña. Los videos normales conservan los parámetros de la lista y la marca de tiempo del enlace.
- **Carga y errores.** El panel muestra un indicador de carga y avisa cuando el feed está vacío. Si falta iniciar sesión, podés abrir Suscripciones para hacerlo. Si falla la verificación de un video o la carga del panel, podés reintentar o abrir Suscripciones.

El filtrado del feed utiliza los elementos de la interfaz de escritorio de YouTube. Un cambio en esa interfaz puede requerir ajustar la extensión.

## Ajustes

Hacé clic en el ícono de StopIt en el menú de extensiones de Chrome. Activá **Mostrar notificaciones** para ver la campana y abrir su panel en la barra superior de YouTube. Por defecto están ocultos. La elección se guarda en este perfil y se aplica a las pestañas abiertas.

### Modo estricto

Podés activarlo desde los ajustes de StopIt. Está desactivado por defecto. Tanto Inicio como el panel al lado de un video pasan a tener tres secciones, cada una ordenada de más reciente a más antigua.

- **Nuevos** se abre al entrar si tiene videos. Si está vacía, su botón queda deshabilitado. Incluye lo publicado desde la visita anterior. Al activar el modo, el punto de partida es el momento de la activación.
- **Anteriores** se abre cuando entrás sin videos nuevos o cuando se vacía la lista de **Nuevos** que estás mirando. Incluye las publicaciones anteriores al corte, incluso las que nunca llegaste a cargar.
- **Vistos** empieza plegada y tiene prioridad. Un video pasa aquí cuando abrís su reproductor en una pestaña visible y activa, o cuando YouTube muestra progreso de reproducción en su miniatura. También cuenta un video abierto desde un enlace externo. Podés desplegar la sección para retomarlo.

Siempre hay una sola sección abierta. Si cerrás **Nuevos** o **Vistos**, volvés a **Anteriores**. Cada sección tiene su propio desplazamiento. Los tres botones quedan a la vista mientras recorrés los videos y, al volver a una sección, recuperás tu posición. Los controles se adaptan a los temas claro y oscuro y respetan la preferencia de movimiento reducido.

Una visita cuenta cuando el feed de Suscripciones carga correctamente en primer plano. Las recargas separadas por menos de cinco minutos conservan el mismo corte. Al volver con Atrás se recupera el corte de ese listado, incluso después de un video largo. Abrir el panel lateral permite consultar el feed sin adelantar la visita.

YouTube carga las tarjetas al desplazarte. StopIt clasifica cada lote en el navegador con la fecha de las tarjetas, el progreso de reproducción y el orden del feed. Para distinguir dos publicaciones que dicen «hace 1 h», toma como referencia los primeros videos de la visita anterior. Si faltan referencias y la fecha tampoco alcanza para decidir, la publicación queda en **Anteriores**. StopIt reconoce las fechas relativas que YouTube muestra en español e inglés.

StopIt recuerda localmente las visitas, los primeros identificadores del feed y los identificadores de videos vistos por cuenta de YouTube en este perfil de Chrome. Al desactivar el modo vuelve el feed habitual y se detiene el registro. Si lo volvés a activar, se conserva lo registrado en Vistos y se toma la nueva hora de activación como punto de partida para Nuevos.

## Datos y permisos

La extensión carga Suscripciones desde YouTube con la sesión activa de la pestaña. Guarda en la memoria de la sesión de Chrome la clasificación de hasta 512 identificadores de video. Solicita acceso a los dominios de YouTube que usa para navegar y verificar videos, y emplea reglas de Chrome para redirigir la pestaña antes de cargar el reproductor.

## Licencia

StopIt se distribuye bajo **MIT No Attribution (MIT-0)**. Podés usar, copiar, modificar, redistribuir y vender el software, incluso sin atribución. Lo comparto tal cual, sin garantías. Cada persona lo usa bajo su propia responsabilidad. La licencia excluye la responsabilidad de los autores y titulares de derechos en la medida permitida por la ley aplicable. [Texto de la licencia](LICENSE)

## Pruebas

Desde la raíz del repositorio, ejecutá estos comandos con Node.js 22 o posterior.

```sh
npm ci
npx playwright-core install chromium
npm test
```

También podés indicar un ejecutable de Chrome for Testing con la variable `CHROME_FOR_TESTING`. Las pruebas cargan la extensión en un perfil temporal y usan páginas de prueba con fechas conocidas. Cubren los idiomas de la interfaz, el orden de Inicio y del panel lateral, los directos, la paginación, el modo estricto, las notificaciones, los Shorts, el historial de navegación y los errores de verificación.

## Publicar una versión en GitHub

Desde el commit que querés publicar, subí una etiqueta con el prefijo `v` seguido de la versión de `extension/manifest.json`, por ejemplo `v3.1.0`. GitHub Actions verifica la versión, empaqueta la extensión con su licencia y ejecuta las pruebas en Chromium sobre el ZIP descomprimido. Si pasan, publica el paquete en GitHub Releases.
