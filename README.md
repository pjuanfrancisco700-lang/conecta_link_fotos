# ConectaLink Fotos

Aplicación web móvil para que los invitados de una boda, cumpleaños, convivio u otro evento compartan fotografías mediante un enlace o código QR, sin crear una cuenta visible.

La aplicación utiliza autenticación anónima de Firebase, carga las imágenes en Cloud Storage y registra únicamente el resumen de cada envío completo en Cloud Firestore. Está construida con HTML, CSS y JavaScript modular, sin React, npm, PHP ni servidor propio.

---

## 1. Arquitectura

Flujo principal:

1. El invitado abre la URL publicada en GitHub Pages.
2. Firebase Authentication inicia una sesión anónima.
3. El invitado escribe su nombre y selecciona fotografías.
4. El navegador valida, crea vistas previas e intenta optimizar JPEG, PNG y WebP.
5. Las fotografías se suben a Cloud Storage con `uploadBytesResumable` y máximo 2 cargas simultáneas.
6. Si todas terminan correctamente, se crea un documento en la colección `subidas` de Firestore.
7. La aplicación no obtiene URLs de descarga, no vuelve a leer las fotografías y no guarda imágenes en Firestore ni localStorage.

Ruta de cada fotografía:

```text
eventos/{eventoId}/{usuarioId}/{nombreArchivo}
```

Ejemplo:

```text
eventos/boda-darwin-dilma/UID_DEL_INVITADO/1721840050-a1b2c3d4-foto.jpg
```

Documento creado en `subidas` solamente al completar todo el envío:

```js
{
  usuarioId: "UID_DEL_INVITADO",
  eventoId: "boda-darwin-dilma",
  nombreInvitado: "Carlos López",
  cantidadFotos: 8,
  creadoEn: serverTimestamp()
}
```

---

## 2. Archivos incluidos

```text
ConectaLink-Fotos/
├── index.html
├── styles.css
├── app.js
├── firebase-config.js
├── manifest.json
├── sw.js
├── README.md
└── assets/
    ├── icon-192.png
    ├── icon-512.png
    └── portada-evento.jpg
```

### Función de cada archivo

- `index.html`: estructura visual, accesibilidad, metadatos móviles y plantillas de tarjetas.
- `styles.css`: diseño premium móvil, safe areas, scroll interno, estados, animaciones y adaptación responsive.
- `app.js`: configuración del evento, autenticación, selección, validación, compresión, subida, reintentos y registro en Firestore.
- `firebase-config.js`: configuración pública e inicialización de Firebase.
- `manifest.json`: configuración instalable de la PWA.
- `sw.js`: caché exclusiva de archivos estáticos.
- `assets/icon-192.png`: icono PWA de 192 × 192.
- `assets/icon-512.png`: icono PWA de 512 × 512.
- `assets/portada-evento.jpg`: portada de ejemplo del evento.

---

## 3. Pegar la configuración real de Firebase

1. Abre Firebase Console.
2. Entra al proyecto `conectalink-fotos`.
3. Ve a **Configuración del proyecto**.
4. En **Tus apps**, abre o registra una aplicación web.
5. Copia el objeto de configuración del SDK.
6. Abre `firebase-config.js`.
7. Reemplaza únicamente los valores que comienzan con `PEGAR_`.

Configuración preparada:

```js
export const firebaseConfig = {
  apiKey: "PEGAR_API_KEY",
  authDomain: "conectalink-fotos.firebaseapp.com",
  projectId: "conectalink-fotos",
  storageBucket: "conectalink-fotos.firebasestorage.app",
  messagingSenderId: "PEGAR_MESSAGING_SENDER_ID",
  appId: "PEGAR_APP_ID",
  measurementId: "PEGAR_MEASUREMENT_ID"
};
```

No agregues una cuenta de servicio, contraseña, clave administrativa ni credenciales privadas. El objeto `firebaseConfig` es público; la protección real depende de Authentication y de las reglas de Firebase.

`measurementId` es opcional. Los campos esenciales son `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` y `appId`.

---

## 4. Agregar el dominio de GitHub Pages a Authentication

Para evitar errores de dominio no autorizado:

1. Abre Firebase Console.
2. Ve a **Authentication**.
3. Abre **Settings** o **Configuración**.
4. En **Authorized domains / Dominios autorizados**, agrega tu dominio de GitHub Pages.

Ejemplo:

```text
tuusuario.github.io
```

No agregues la ruta del repositorio, únicamente el dominio.

También confirma que el proveedor **Anonymous / Anónimo** esté habilitado en **Sign-in method**.

---

## 5. Cambiar el evento

Abre `app.js` y edita el objeto situado al inicio:

```js
const EVENT_CONFIG = {
  eventoId: "boda-darwin-dilma",
  titulo: "Darwin & Dilma",
  subtitulo: "Comparte tus mejores momentos",
  mensaje: "Ayúdanos a guardar cada recuerdo de este día tan especial.",
  fecha: "15 de agosto de 2026",
  imagenPortada: "./assets/portada-evento.jpg",
  maxFotosPorEnvio: 20,
  maxPesoPorFotoMB: 10
};
```

### Recomendaciones para `eventoId`

- Usa un valor único por evento.
- Usa letras minúsculas, números y guiones.
- No uses barras `/`, puntos `..` ni espacios.
- Ejemplos válidos:

```text
boda-darwin-dilma
cumpleanos-sofia-2026
convivio-equipo-julio
```

La aplicación vuelve a sanitizar el valor para evitar rutas peligrosas.

---

## 6. Cambiar la portada

1. Prepara una imagen JPG optimizada.
2. Recomendación: 1600 × 1000 píxeles o una proporción similar.
3. Intenta mantenerla por debajo de 600 KB para que cargue rápido con datos móviles.
4. Reemplaza:

```text
assets/portada-evento.jpg
```

Conserva exactamente el mismo nombre o modifica `imagenPortada` en `EVENT_CONFIG`.

La portada incluida es solo un marcador visual y debe sustituirse por la fotografía o diseño real del evento.

---

## 7. Cambiar iconos

Debes conservar estos tamaños:

```text
assets/icon-192.png  → 192 × 192 px
assets/icon-512.png  → 512 × 512 px
```

Recomendaciones:

- PNG cuadrado.
- Fondo sólido, sin transparencia en los bordes principales.
- Deja un margen interno de seguridad de aproximadamente 15 %.
- Evita texto pequeño.
- El diseño debe funcionar como icono normal y como icono maskable.

Después de reemplazarlos, cambia la versión de caché en `sw.js` para que los teléfonos reciban los nuevos archivos.

---

## 8. Cambiar colores

Abre `styles.css`. Los colores principales están en `:root`:

```css
:root {
  --background: #f6f2ec;
  --surface: rgba(255, 255, 255, 0.92);
  --text: #1d1c1a;
  --text-soft: #69645e;
  --accent: #78634f;
  --accent-dark: #5d4a38;
  --success: #2f7a58;
  --danger: #b64545;
}
```

Para mantener buen contraste, usa un `--accent-dark` suficientemente oscuro para texto y botones.

También actualiza los colores de `manifest.json` y la etiqueta `theme-color` de `index.html` si cambias el fondo general.

---

## 9. Reglas recomendadas de Cloud Storage

Estas reglas son una referencia compatible con el flujo de la aplicación. Revísalas antes de publicar porque deben adaptarse a tu proyecto y política de privacidad.

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /eventos/{eventoId}/{usuarioId}/{fileName} {
      allow create: if request.auth != null
                    && request.auth.uid == usuarioId
                    && request.resource.size <= 10 * 1024 * 1024
                    && request.resource.contentType.matches('image/.*')
                    && request.resource.metadata.eventoId == eventoId
                    && request.resource.metadata.usuarioId == usuarioId
                    && request.resource.metadata.nombreInvitado is string
                    && request.resource.metadata.fechaCarga is string;

      allow read, update, delete: if false;
    }
  }
}
```

La aplicación no utiliza `getDownloadURL`, no lista archivos y no intenta borrar ni modificar fotografías.

---

## 10. Reglas recomendadas de Cloud Firestore

Referencia para permitir únicamente la creación de documentos completos en `subidas`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /subidas/{documentId} {
      allow create: if request.auth != null
                    && request.resource.data.keys().hasOnly([
                      'usuarioId',
                      'eventoId',
                      'nombreInvitado',
                      'cantidadFotos',
                      'creadoEn'
                    ])
                    && request.resource.data.usuarioId == request.auth.uid
                    && request.resource.data.eventoId is string
                    && request.resource.data.nombreInvitado is string
                    && request.resource.data.nombreInvitado.size() >= 2
                    && request.resource.data.nombreInvitado.size() <= 80
                    && request.resource.data.cantidadFotos is int
                    && request.resource.data.cantidadFotos >= 1
                    && request.resource.data.cantidadFotos <= 20
                    && request.resource.data.creadoEn == request.time;

      allow read, update, delete: if false;
    }
  }
}
```

Si tus reglas existentes utilizan App Check, roles administrativos u otra estructura, no las reemplaces sin revisar esa integración.

---

## 11. Probar localmente

No abras `index.html` directamente con doble clic. Una dirección que comienza con `file://` no funciona correctamente con:

- módulos JavaScript;
- Firebase Authentication;
- service workers;
- manifest PWA;
- políticas de origen del navegador.

Debes usar un servidor local.

### Opción A: Live Server en Visual Studio Code

1. Instala la extensión **Live Server**.
2. Abre la carpeta `ConectaLink-Fotos` en Visual Studio Code.
3. Haz clic derecho sobre `index.html`.
4. Selecciona **Open with Live Server**.
5. Abre la dirección mostrada, normalmente:

```text
http://127.0.0.1:5500/
```

Firebase suele incluir `localhost` como dominio autorizado. Si usas una IP local diferente, agrégala cuando Firebase lo permita o prueba con `localhost`.

### Opción B: servidor simple incluido en Python

Solo para probar archivos estáticos, desde la carpeta del proyecto:

```bash
python -m http.server 8080
```

Luego abre:

```text
http://localhost:8080/
```

No se necesita Node.js ni npm.

---

## 12. Verificar Authentication

1. Abre la aplicación desde el servidor local.
2. Espera a que la insignia superior diga **Conexión segura**.
3. En Firebase Console abre **Authentication > Users**.
4. Debe aparecer un usuario con proveedor anónimo.
5. Recarga la página. Mientras el navegador conserve la sesión, Firebase puede reutilizar el usuario anónimo.

Si aparece `auth/operation-not-allowed`, habilita el proveedor anónimo.

Si aparece un error de dominio, agrega el dominio en **Authorized domains**.

---

## 13. Verificar Storage

1. Escribe un nombre válido.
2. Selecciona una o varias fotografías menores de 10 MB.
3. Presiona **Compartir fotografías**.
4. Abre Firebase Console > **Storage > Files**.
5. Revisa la estructura:

```text
eventos/
└── boda-darwin-dilma/
    └── UID_ANONIMO/
        └── archivo-unico.jpg o archivo-unico.webp
```

6. Abre la metadata del archivo y verifica:

```text
contentType
nombreInvitado
eventoId
usuarioId
fechaCarga
```

La aplicación no descarga la fotografía después de subirla.

---

## 14. Verificar Firestore

1. Completa un envío donde todas las fotografías terminen correctamente.
2. Abre Firebase Console > **Firestore Database**.
3. Entra en la colección:

```text
subidas
```

4. Debe existir un documento nuevo con exactamente:

```text
usuarioId
eventoId
nombreInvitado
cantidadFotos
creadoEn
```

Si una fotografía falla, no debe crearse el documento hasta que se reintenten las fallidas y todas finalicen.

---

## 15. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub, por ejemplo:

```text
conectalink-fotos
```

2. Sube el contenido de esta carpeta a la raíz del repositorio. `index.html` debe quedar en la raíz.
3. Abre el repositorio en GitHub.
4. Ve a **Settings > Pages**.
5. En **Build and deployment**, elige **Deploy from a branch**.
6. Selecciona la rama `main` y la carpeta `/ (root)`.
7. Guarda.
8. Espera a que GitHub muestre la URL publicada.

Ejemplo:

```text
https://tuusuario.github.io/conectalink-fotos/
```

9. Agrega `tuusuario.github.io` a los dominios autorizados de Firebase Authentication.
10. Abre la URL desde Android y iPhone y realiza una prueba real.

Las rutas del proyecto son relativas (`./`), por lo que funcionan tanto en un dominio raíz como dentro de la ruta de un repositorio de GitHub Pages.

---

## 16. Crear el código QR

1. Publica primero la aplicación.
2. Copia la URL completa de GitHub Pages.
3. Pega esa URL en el generador de QR de tu preferencia.
4. Descarga el QR en buena resolución.
5. Antes de imprimirlo, pruébalo con Android y iPhone.
6. Confirma que abre exactamente la URL HTTPS publicada.

No uses una URL local como `localhost`, `127.0.0.1` o una dirección `file://` para el QR final.

---

## 17. Actualizar el service worker

El service worker usa esta versión en `sw.js`:

```js
const APP_VERSION = "conectalink-fotos-v1.0.0";
```

Cada vez que publiques cambios importantes, cambia el número. Ejemplo:

```js
const APP_VERSION = "conectalink-fotos-v1.0.1";
```

Luego sube el archivo actualizado a GitHub.

Para comprobar una actualización:

1. Abre DevTools del navegador.
2. Ve a **Application > Service Workers**.
3. Presiona **Update** o recarga la página.
4. Si el teléfono conserva una versión anterior, cierra completamente la PWA y vuelve a abrirla.
5. Como último recurso de prueba, elimina los datos del sitio y abre nuevamente la URL.

No agregues rutas de Firebase, respuestas de Firestore ni fotografías al arreglo `STATIC_ASSETS`.

---

## 18. Errores comunes

### “Firebase no está configurado”

Todavía existen valores `PEGAR_...` en `firebase-config.js`.

### “La autenticación anónima no está habilitada”

Activa **Authentication > Sign-in method > Anonymous**.

### “Dominio no autorizado”

Agrega `tuusuario.github.io` en **Authentication > Settings > Authorized domains**.

### “Permiso denegado” al subir

Revisa que:

- el usuario esté autenticado;
- la ruta coincida con `request.auth.uid`;
- Storage permita `create`;
- el archivo sea una imagen;
- el archivo no supere 10 MB;
- la metadata esperada esté permitida.

### Las fotos suben, pero no aparece confirmación

Revisa las reglas de Firestore. La app mostrará **Completar confirmación** y no volverá a subir las fotografías.

### HEIC no muestra vista previa

Algunos navegadores no pueden mostrar o convertir HEIC. La aplicación intenta subir el original si pesa menos de 10 MB y su tipo se reconoce como imagen. Las reglas de Storage deben aceptar ese `contentType`.

### La portada no aparece

Confirma que exista exactamente:

```text
assets/portada-evento.jpg
```

Los nombres de archivo distinguen mayúsculas y minúsculas en GitHub Pages.

### La PWA no se puede instalar

Comprueba:

- la página usa HTTPS;
- `manifest.json` abre sin error;
- los iconos existen;
- el service worker está activo;
- `start_url` y `scope` corresponden a la ruta publicada.

### La página muestra una versión anterior

Incrementa `APP_VERSION` en `sw.js`, sube el cambio y vuelve a cargar.

### Error por cuota o almacenamiento

Revisa en Firebase Console el uso y la facturación del proyecto. Una regla correcta no evita límites de cuota o plan.

---

## 19. Privacidad y mantenimiento

- Informa a los invitados para qué se utilizarán y cuánto tiempo se conservarán las fotografías.
- Define quién tendrá acceso administrativo al álbum.
- La app de invitados no incluye lectura, listado, modificación ni eliminación.
- Para descargar o administrar las fotografías crea un panel separado con reglas administrativas adecuadas.
- Elimina eventos antiguos y cuentas anónimas conforme a tu política.
- Activa alertas de presupuesto y revisa el consumo de Storage, Authentication y Firestore.
- No publiques reglas abiertas como `allow read, write: if true`.

---

## 20. Lista de comprobación final

- [ ] Reemplacé todos los valores `PEGAR_...` en `firebase-config.js`.
- [ ] Authentication anónima está habilitada.
- [ ] El dominio de GitHub Pages está autorizado.
- [ ] Cloud Storage está creado y sus reglas permiten únicamente `create` autenticado.
- [ ] Firestore está creado y la colección `subidas` permite únicamente documentos válidos.
- [ ] Cambié `EVENT_CONFIG` con los datos reales.
- [ ] Reemplacé `assets/portada-evento.jpg`.
- [ ] Reemplacé o aprobé los iconos de 192 y 512 px.
- [ ] Probé el nombre mínimo, máximo y nombres con símbolos.
- [ ] Probé una foto mayor de 10 MB.
- [ ] Probé más de 20 fotografías.
- [ ] Probé archivos duplicados.
- [ ] Probé una carga con conexión móvil lenta.
- [ ] Probé desconectar internet durante una carga y reintentar fallidas.
- [ ] Confirmé que Storage usa `eventos/{eventoId}/{uid}/...`.
- [ ] Confirmé que Firestore registra solo al terminar todo el envío.
- [ ] Confirmé que la app no intenta leer las fotografías.
- [ ] Probé scroll, teclado, cámara y galería en Android.
- [ ] Probé scroll, teclado, cámara y galería en iPhone.
- [ ] Probé instalación PWA en Android.
- [ ] Probé agregar a pantalla de inicio en iPhone.
- [ ] Incrementé `APP_VERSION` antes de una actualización importante.
- [ ] Generé el QR con la URL HTTPS final.
