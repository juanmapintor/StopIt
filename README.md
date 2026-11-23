# StopIt para YouTube

[Read in English](README.en.md)

StopIt abre tus suscripciones al entrar a YouTube o tocar Inicio y oculta los Shorts. En el teléfono funciona como un script para Safari o Firefox. También muestra tus suscripciones junto al reproductor en escritorio y debajo del video en el teléfono.

Desarrollé StopIt con ayuda de inteligencia artificial, principalmente para mi propio uso. Lo comparto para que puedas usarlo, adaptarlo a tus hábitos o distribuir tu propia versión.

¿Ya tenés StopIt instalado? [Cómo actualizar StopIt](#actualizar-stopit)

## Instalar en el teléfono

### iPhone o iPad con Safari

1. Instalá [Userscripts](https://apps.apple.com/app/userscripts/id1463298887), abrí la app una vez y activá la extensión en Safari.
2. Desde Safari, abrí el [script de StopIt](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js). Abrí **Userscripts** en el menú de extensiones de la página y confirmá la instalación. Si ya descargaste el archivo, también podés guardarlo en la carpeta que indica la app Userscripts.
3. Abrí YouTube en Safari y permití que Userscripts se ejecute en el sitio. Recargá la pestaña.

**Si StopIt solo funciona después de recargar al escribir `youtube.com` en una pestaña nueva**, en el iPhone abrí **Ajustes → Apps → Safari** (o **Ajustes → Safari** en versiones anteriores). En **Búsqueda**, desactivá **Preload Top Hit** (la opción que precarga el primer resultado). Probá de nuevo en una pestaña nueva. Safari puede mostrar una página precargada sin ejecutar Userscripts. [Incidencia de Userscripts](https://github.com/quoid/userscripts/issues/977)

### Android con Firefox y Violentmonkey

1. En Firefox para Android, instalá [Violentmonkey](https://addons.mozilla.org/android/addon/violentmonkey/).
2. Abrí el [script de StopIt](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js) en ese Firefox y confirmá la instalación en Violentmonkey. Si ya tenés el archivo local, también podés crear un script en el editor del gestor, reemplazar el contenido por el de `stopit.user.js` y guardarlo.
3. Abrí YouTube en Firefox y recargá las pestañas de YouTube que ya estaban abiertas.

### Qué vas a ver en el teléfono

Abrí [Inicio de YouTube](https://m.youtube.com/) en el navegador configurado. Vas a llegar al feed de la cuenta que uses ahí. Al abrir un video, podés recorrer tus suscripciones debajo del reproductor o tocar **Volver a mis suscripciones**. El panel marca el video actual como **Reproduciendo**. Si falla la carga, ofrece reintentar o abrir el feed.

Tocá **StopIt** en la cabecera de YouTube para abrir **Ajustes de StopIt**. Si YouTube cambia u oculta la cabecera, buscá el botón en la esquina inferior derecha. Activá **Modo estricto** para agrupar el feed y el panel en **Nuevos**, **Anteriores** y **Vistos**. **Mostrar notificaciones** controla la campana y **Mostrar botón Crear** controla el acceso de creación en la barra superior. Los tres ajustes empiezan desactivados. El gestor guarda las preferencias en el dispositivo y distingue el historial por cuenta de YouTube.

StopIt oculta las filas de Shorts que aparecen al desplazarte y las invitaciones de YouTube a instalar o abrir la app. En Safari también quita la etiqueta con la que YouTube solicita la barra de la App Store. Si Safari ya mostró esa barra antes de ejecutar Userscripts, podés cerrarla desde el navegador.

Los enlaces a Shorts llevan a Suscripciones. Para enlaces ambiguos, StopIt verifica los metadatos y ofrece reintentar si la verificación falla. Si un enlace abre la app oficial, elegí abrirlo en el navegador configurado para usar StopIt.

### Agradecimientos

- Gracias a Justin Wasack (quoid), a ACTCD y a quienes contribuyen a Userscripts. Su trabajo permite que StopIt se ejecute en Safari con la cuenta de YouTube que ya usás en el iPhone. [Repositorio de Userscripts](https://github.com/quoid/userscripts)
- Gracias a Gerald (gera2ld), a tophf y a quienes contribuyen a Violentmonkey por hacer posible que ese mismo script funcione en Firefox para Android. [Repositorio de Violentmonkey](https://github.com/violentmonkey/violentmonkey)

## Instalar en Chrome de escritorio

Necesitás Chrome 120 o posterior.

1. Descargá el archivo para Chrome de la versión que quieras instalar. Su nombre sigue el formato `stopit-v3.2.0-chrome.zip`. [Releases de StopIt](https://github.com/juanmapintor/StopIt/releases)
2. Descomprimí el ZIP en una carpeta que puedas conservar. El archivo `manifest.json` está en la raíz.
3. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
4. Elegí **Cargar extensión sin empaquetar** y seleccioná la carpeta que contiene `manifest.json`.
5. Recargá las pestañas de YouTube que ya estaban abiertas. La extensión usa la sesión de YouTube de ese perfil.

Si ya tenés una copia del repositorio, podés empezar en el paso 3 y seleccionar la carpeta `extension`. Para comprobar la instalación, abrí Inicio en YouTube. La dirección cambia a `/feed/subscriptions`.

StopIt usa el idioma de la interfaz de Chrome. Si usás español, incluida cualquier variante regional, los ajustes, las secciones y los avisos aparecen en español. Para todos los demás idiomas, StopIt usa inglés. YouTube sigue mostrando sus propios controles y contenido en el idioma que elegiste en el sitio.

## Actualizar StopIt

### iPhone o iPad con Safari y Userscripts

1. En Safari, abrí **Userscripts** desde el menú de extensiones y tocá el ícono de la nube para ver las actualizaciones. Si la lista está vacía, tocá **Check Updates**.
2. Si aparece **StopIt for YouTube**, tocá **Update**. Si preferís actualizarlo a mano, abrí el archivo en Safari, volvé a abrir **Userscripts** en esa pestaña y confirmá la instalación sobre la copia existente. [Última versión del script](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js)
3. Recargá las pestañas de YouTube. En la versión 2 podés tocar **StopIt** dentro de YouTube para abrir los ajustes.

### Android con Firefox y Violentmonkey

1. En Firefox, abrí **Violentmonkey** desde el menú de extensiones y entrá a su panel. Buscá **StopIt for YouTube** y tocá la flecha circular de su fila para buscar actualizaciones.
2. Si el gestor pide confirmación, aceptá la actualización. Al pasar de la versión 1 a la 2, StopIt solicita acceso al almacenamiento del gestor para guardar los ajustes y el historial del modo estricto. También podés abrir el archivo en Firefox y confirmar la reinstalación sobre el mismo script. [Última versión del script](https://raw.githubusercontent.com/juanmapintor/StopIt/main/mobile/stopit.user.js)
3. Recargá las pestañas de YouTube y tocá **StopIt** para abrir los ajustes.

### Chrome de escritorio

1. Descargá el ZIP que termina en `-chrome.zip` y descomprimí su contenido en la **misma carpeta** que cargaste en Chrome. Reemplazá los archivos existentes para conservar los ajustes y el historial. Si cargaste la carpeta `extension` desde Git, actualizá esa copia del repositorio. [Última versión para Chrome](https://github.com/juanmapintor/StopIt/releases/latest)
2. Abrí `chrome://extensions` y hacé clic en el botón de recarga de la tarjeta de StopIt. Comprobá que la versión que muestra coincide con la del ZIP.
3. Recargá las pestañas de YouTube.

## Qué vas a ver en Chrome de escritorio

- **Inicio y Suscripciones.** Ves primero los videos más recientes de tus canales. StopIt quita los bloques de selección por relevancia, los Shorts, los estrenos programados y las tarjetas de anuncios, listas y mixes del feed de suscripciones. Los directos se intercalan según la hora de inicio que muestra YouTube. Si la tarjeta no indica cuándo empezó el directo, se conserva el orden del feed. Las grabaciones siguen el orden de publicación. La lista se actualiza al bajar.
- **Shorts.** StopIt oculta el acceso de la barra lateral, las filas de Shorts del feed y las secciones completas de los resultados de búsqueda, también las que aparecen al seguir bajando. Quita el filtro o la pestaña Shorts en el Historial, las listas de reproducción, Ver más tarde, Videos que me gustan, las búsquedas y los canales.
- **Junto al reproductor.** El panel abre el feed de la cuenta activa, también cuando llegás por un enlace externo. Al bajar a los comentarios, el panel lateral queda debajo de la barra superior y ocupa la altura disponible, también en modo cine. Podés desplazarte dentro del panel para cargar más videos. Si el video que estás viendo aparece entre tus suscripciones, lleva la marca «Reproduciendo». Al elegir otro, se abre en la pestaña principal. También podés usar el menú del enlace para abrirlo en otra pestaña. El chat de los directos y la cola de las playlists siguen disponibles.
- **Enlaces compartidos.** Un enlace directo a Shorts te lleva a Suscripciones. Si la dirección es ambigua, StopIt verifica los metadatos del video antes de abrirlo. Esto también cubre enlaces al reproductor insertado que abras como página en una pestaña. Los videos normales conservan los parámetros de la lista y la marca de tiempo del enlace.
- **Carga y errores.** El panel muestra un indicador de carga y avisa cuando el feed está vacío. Si falta iniciar sesión, podés abrir Suscripciones para hacerlo. Si falla la verificación de un video o la carga del panel, podés reintentar o abrir Suscripciones.

El filtrado del feed utiliza los elementos de la interfaz de escritorio de YouTube. Un cambio en esa interfaz puede requerir ajustar la extensión.

## Ajustes

En el teléfono, tocá **StopIt** dentro de YouTube. En Chrome de escritorio, hacé clic en el ícono de StopIt en el menú de extensiones. Activá **Mostrar notificaciones** para ver la campana y abrir su panel en la barra superior de YouTube. Activá **Mostrar botón Crear** para recuperar el botón **Crear** en esa barra. La campana y el botón Crear están ocultos por defecto. Cada ajuste se guarda por separado y se aplica a las pestañas abiertas.

### Modo estricto

Podés activarlo desde los ajustes de StopIt. Está desactivado por defecto. Tanto Inicio como el panel al lado de un video pasan a tener tres secciones, cada una ordenada de más reciente a más antigua.

- **Nuevos** se abre al entrar si tiene videos. Si está vacía, su botón queda deshabilitado. Incluye lo publicado desde la visita anterior. Al activar el modo, el punto de partida es el momento de la activación.
- **Anteriores** se abre cuando entrás sin videos nuevos o cuando se vacía la lista de **Nuevos** que estás mirando. Incluye las publicaciones anteriores al corte, incluso las que nunca llegaste a cargar.
- **Vistos** empieza plegada y tiene prioridad. Un video pasa aquí cuando abrís su reproductor en una pestaña visible y activa, o cuando YouTube muestra progreso de reproducción en su miniatura. También cuenta un video abierto desde un enlace externo. Podés desplegar la sección para retomarlo.

Siempre hay una sola sección abierta. Si cerrás **Nuevos** o **Vistos**, volvés a **Anteriores**. Cada sección tiene su propio desplazamiento. Los tres botones quedan a la vista mientras recorrés los videos y, al volver a una sección, recuperás tu posición. Los controles se adaptan a los temas claro y oscuro y respetan la preferencia de movimiento reducido.

Una visita cuenta cuando el feed de Suscripciones carga correctamente en primer plano. Las recargas separadas por menos de cinco minutos conservan el mismo corte. Al volver con Atrás se recupera el corte de ese listado, incluso después de un video largo. Abrir el panel lateral permite consultar el feed sin adelantar la visita.

YouTube carga las tarjetas al desplazarte. StopIt clasifica cada lote en el navegador con la fecha de las tarjetas, el progreso de reproducción y el orden del feed. Para distinguir dos publicaciones que dicen «hace 1 h», toma como referencia los primeros videos de la visita anterior. Si faltan referencias y la fecha tampoco alcanza para decidir, la publicación queda en **Anteriores**. StopIt reconoce las fechas relativas que YouTube muestra en español e inglés.

StopIt recuerda localmente las visitas, los primeros identificadores del feed y los identificadores de videos vistos por cuenta de YouTube en este navegador. Al desactivar el modo vuelve el feed habitual y se detiene el registro. Si lo volvés a activar, se conserva lo registrado en Vistos y se toma la nueva hora de activación como punto de partida para Nuevos.

## Datos y permisos

La extensión carga Suscripciones desde YouTube con la sesión activa de la pestaña. Guarda en la memoria de la sesión de Chrome la clasificación de hasta 512 identificadores de video. Solicita acceso a los dominios de YouTube que usa para navegar y verificar videos, y emplea reglas de Chrome para redirigir la pestaña antes de cargar el reproductor.

## Licencia

StopIt se distribuye bajo **MIT No Attribution (MIT-0)**. Podés usar, copiar, modificar, redistribuir y vender el software, incluso sin atribución. Lo comparto tal cual, sin garantías. Cada persona lo usa bajo su propia responsabilidad. La licencia excluye la responsabilidad de los autores y titulares de derechos en la medida permitida por la ley aplicable. [Texto de la licencia](LICENSE)

## Pruebas

Desde la raíz del repositorio, ejecutá estos comandos con Node.js 22 o posterior.

```sh
npm ci
npx playwright-core install chromium firefox webkit
npm test
```

Si editás los archivos de `mobile/src` o los módulos compartidos de `extension`, ejecutá `npm run build:mobile` para regenerar `mobile/stopit.user.js`. Las pruebas comprueban que el archivo instalable coincide con sus fuentes.

Las pruebas móviles ejecutan el script en WebKit y Firefox con páginas de muestra que reproducen la navegación y el listado móvil de YouTube.

También podés indicar un ejecutable de Chrome for Testing con la variable `CHROME_FOR_TESTING`. Las pruebas cargan la extensión en un perfil temporal y usan páginas de prueba con fechas conocidas. Cubren los idiomas de la interfaz, el orden de Inicio y del panel lateral, los directos, la paginación, el modo estricto, las notificaciones, los Shorts, el historial de navegación y los errores de verificación.

## Publicar una versión en GitHub

Desde el commit que querés publicar, subí una etiqueta con el prefijo `v` seguido de la versión de `extension/manifest.json`, por ejemplo `v3.2.0`. GitHub Actions verifica la versión, empaqueta la extensión con su licencia y ejecuta las pruebas sobre el ZIP descomprimido y el script móvil. Si pasan, publica el ZIP en GitHub Releases. Los gestores móviles obtienen el script desde `main` y detectan las actualizaciones por su propio campo `@version` en `mobile/src/metadata.txt`.
