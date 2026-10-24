# Spec — kitforweb · Utilidades para desarrolladores web

> **Estado:** borrador para revisión. La sección 3 (catálogo de herramientas) incluye una casilla **Decisión** por entrada para marcar qué entra y qué no antes de pasar este documento a Claude Code.
>
> **Nombre:** **kitforweb** (dominio ya comprado). El nombre y el dominio viven en una única constante de configuración (`src/config/site.ts`), de modo que ningún otro archivo los escribe a mano.

---

## 1. Visión

Una web de utilidades para desarrolladores web (sobre todo frontend, con un bloque de back) que:

- **Se ejecuta 100% en el navegador.** Ningún dato que pega el usuario sale de su máquina. Es el argumento principal de confianza: se puede pegar un JWT o un certificado de producción sin miedo.
- **Va al grano.** Cada entrada del menú es una herramienta concreta con el nombre que el usuario ya busca ("JSON ↔ CSV", "JWT Decoder"). Nada de cajones genéricos tipo "Datos".
- **Está pensada para posicionar** en buscadores y en IAs: una URL por herramienta e idioma, con contenido indexable propio.
- **Parece un IDE**: modo oscuro, acentos cian neón, vanguardista pero con una usabilidad muy simple.

## 2. Stack y decisiones técnicas

| Ámbito           | Decisión                                                                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------- |
| Framework        | Next.js (App Router), TypeScript estricto                                                             |
| Render           | SSG/SSR para la "carcasa" y el contenido SEO de cada página; las herramientas son componentes cliente |
| Estilos          | Tailwind CSS                                                                                          |
| Componentes      | shadcn/ui (Sidebar, Command, Resizable, Tabs, Popover, Dialog, Tooltip…)                              |
| Editor de código | CodeMirror 6, compartido por todas las herramientas                                                   |
| i18n             | `next-intl`, rutas `/en`, `/es`, `/fr`, `/pt` (pt = `pt-BR`), inglés como `x-default`                 |
| Hosting          | Vercel                                                                                                |
| Backend          | **Ninguno.** Prohibido añadir API routes que procesen datos del usuario                               |
| Analítica        | Sin cookies (Vercel Analytics o Plausible) + Google Search Console + Bing Webmaster                   |
| Donaciones       | Botón a Ko-fi vinculado a PayPal (solo donaciones puntuales, que no llevan comisión de plataforma)    |
| Tests            | Vitest para funciones puras, Playwright E2E por herramienta, Lighthouse CI                            |

### Reglas técnicas obligatorias

1. **Librerías pesadas** (Mermaid, quicktype, CodeMirror, SVGO, PGlite si se usara…) se cargan con `next/dynamic` y `ssr: false`, solo en la página que las usa.
2. **El contenido SEO de cada herramienta nunca va dentro de un componente con `ssr: false`**: debe estar en el HTML que sirve el servidor.
3. **Procesos costosos** (quicktype, diff grandes, optimizar imágenes) en Web Workers para no congelar la interfaz.
4. **Nada sensible en la URL.** El contenido de las herramientas sensibles (JWT, hashes, claves, certificados, bcrypt, contraseñas, `.env`) nunca va a la URL ni se comparte por enlace.
5. **Persistencia local** del último input por herramienta en `localStorage` (con `try/catch`), desactivable; las herramientas sensibles no persisten por defecto.

## 3. Catálogo de herramientas

Cada fila es **una entrada del menú lateral** y **una página propia** con URL por idioma. Los bloques se separan en el menú con una línea fina, sin título.

Marca la columna **Decisión** con ✅ (entra) o ❌ (fuera).

### 3.0 Inicio

| Entrada | Qué hace                                                                                                                                                                                                                                                                | Decisión |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Inicio  | Explica qué es la web y su argumento de privacidad. Incluye el **detector inteligente** (sección 5), el listado de todas las herramientas con una línea de descripción y enlace, y un adelanto de "Sobre mí" con el botón de donación. Es la página principal para SEO. | ☐        |

### 3.1 JSON

| Entrada           | Qué hace                                                                                                                                                                                                                                    | Librería                     | Decisión |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------- |
| Formatear JSON    | Formatea, minifica y valida un JSON. Los errores salen **subrayados en la línea y columna exactas**, con el motivo al pasar el ratón (falta una coma, llave sin cerrar…), y se muestran todos, no solo el primero. Vista en árbol plegable. | `jsonc-parser`               | ☐        |
| JSON → TypeScript | Genera interfaces o types de TypeScript a partir de un JSON de ejemplo, detectando campos opcionales, nulos y arrays de tipos mixtos. Permite nombrar el tipo raíz.                                                                         | `quicktype-core` (en Worker) | ☐        |
| JSON → Zod        | Igual que el anterior, pero genera un esquema de validación Zod listo para usar.                                                                                                                                                            | `quicktype-core`             | ☐        |
| JSON → Mock       | A partir de un JSON de ejemplo genera N registros falsos pero realistas (nombres, emails, fechas, IDs…) respetando la estructura. Ideal para datos de prueba.                                                                               | `@faker-js/faker`            | ☐        |
| JSON Diff         | Compara dos JSON y muestra las diferencias por ruta (`user.address.city`): añadidos, eliminados y modificados, ignorando el orden de las claves.                                                                                            | `jsondiffpatch`              | ☐        |
| JSON ↔ YAML       | Convierte de JSON a YAML y al revés. Útil para GitHub Actions, docker-compose, OpenAPI… Marca errores de indentación del YAML.                                                                                                              | `yaml`                       | ☐        |
| JSON ↔ CSV        | Convierte un array de objetos JSON a CSV (para abrir en Excel) y al revés. Los objetos anidados se aplanan con notación de punto (`address.city`) y se reconstruyen al volver. Elección de separador.                                       | `papaparse`                  | ☐        |

### 3.2 Codificación y tokens

| Entrada        | Qué hace                                                                                                                                                                                                                                                                                            | Librería                   | Decisión |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------- |
| JWT Decoder    | Decodifica un JWT: cabecera, payload y firma por separado, con `exp`, `iat` y `nbf` en fecha legible y aviso si está caducado. Opcionalmente verifica la firma con un secreto o clave pública.                                                                                                      | `jose`                     | ☐        |
| JWT Generator  | Crea y firma un JWT de prueba: eliges algoritmo (HS256, RS256, ES256…), escribes el payload y la clave, y obtienes el token.                                                                                                                                                                        | `jose`                     | ☐        |
| Parámetros URL | Desglosa una URL (aunque sea enorme) en tabla clave/valor decodificada, con buscador de parámetros. Muestra claves repetidas, parámetros del fragmento `#`, URLs anidadas (`redirect_uri`) desplegables y detecta valores JSON, Base64 o JWT. Se puede editar cualquier valor y reconstruir la URL. | nativo (`URL`)             | ☐        |
| Base64         | Codifica y decodifica Base64 y Base64URL, de texto y de archivos (con vista previa si es imagen).                                                                                                                                                                                                   | nativo                     | ☐        |
| URL Encode     | Codifica y decodifica texto para URLs, mostrando la diferencia entre `encodeURIComponent` y `encodeURI`.                                                                                                                                                                                            | nativo                     | ☐        |
| HTML Entities  | Convierte caracteres especiales a entidades HTML (`&amp;`, `&lt;`, `&#233;`) y al revés.                                                                                                                                                                                                            | `he`                       | ☐        |
| Unicode        | Muestra el código Unicode de cada carácter, sus escapes (`é`, `\u{1F600}`) y sus bytes UTF-8. Útil para caracteres invisibles o raros.                                                                                                                                                              | nativo                     | ☐        |
| Hex ↔ Binario  | Convierte texto y números entre texto, hexadecimal, binario, octal y decimal.                                                                                                                                                                                                                       | nativo                     | ☐        |
| Punycode       | Convierte dominios con tildes, ñ o caracteres no latinos a su forma ASCII (`xn--…`) y al revés.                                                                                                                                                                                                     | `punycode` / `URL`         | ☐        |
| Gzip           | Comprime o descomprime texto con gzip/deflate y lo pasa a Base64. Para destripar payloads comprimidos de APIs o cookies.                                                                                                                                                                            | `CompressionStream` nativo | ☐        |

### 3.3 Seguridad

| Entrada                  | Qué hace                                                                                                                                                | Librería                          | Decisión |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------- |
| Hash                     | Calcula el hash de un texto o archivo en MD5, SHA-1, SHA-256, SHA-384 y SHA-512 a la vez. Útil para comprobar integridad de descargas.                  | Web Crypto + `spark-md5` para MD5 | ☐        |
| HMAC                     | Calcula la firma HMAC de un mensaje con una clave (SHA-256/384/512). Para depurar firmas de webhooks (Stripe, GitHub…).                                 | Web Crypto                        | ☐        |
| UUID                     | Genera UUID v4 y v7 (uno o en lote) y valida/identifica la versión de un UUID pegado.                                                                   | `crypto.randomUUID` + `uuid`      | ☐        |
| Bcrypt                   | Genera el hash bcrypt de una contraseña con el coste elegido y verifica si una contraseña coincide con un hash dado.                                    | `bcryptjs`                        | ☐        |
| Generador de contraseñas | Genera contraseñas y secretos seguros (longitud, símbolos, sin caracteres ambiguos) y claves aleatorias en hex/Base64 para `.env`. Muestra la entropía. | `crypto.getRandomValues`          | ☐        |
| Claves RSA/EC            | Genera pares de claves RSA o de curva elíptica y las exporta en PEM y JWK, con conversión entre ambos formatos.                                         | Web Crypto                        | ☐        |
| Certificados X.509       | Pegas un certificado `.pem` y muestra emisor, sujeto, dominios (SAN), fechas de validez con aviso de caducidad, algoritmo y huella.                     | `@peculiar/x509`                  | ☐        |

### 3.4 Regex

| Entrada       | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Librería                 | Decisión |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| Regex Builder | Constructor visual: el usuario **arrastra bloques** en lenguaje natural ("empieza por", "dígito", "repetir de 2 a 4", "uno de", "grupo", "o bien"…) a un lienzo y la regex se genera en vivo. Bloques anidables, configurables con un clic, deshacer/rehacer. También al revés: pega una regex y la ve convertida en bloques. Exporta para JS/TS, atributo `pattern` de HTML, Zod y `Validators.pattern` de Angular. En móvil, tocar añade el bloque al final. | `dnd-kit`, `regexp-tree` | ☐        |
| Regex Tester  | Escribes una regex y una lista de textos de prueba; cada texto sale en verde o rojo, con coincidencias y grupos capturados resaltados y explicación de la regex parte por parte.                                                                                                                                                                                                                                                                               | nativo + `regexp-tree`   | ☐        |
| Regex comunes | Biblioteca de patrones listos y explicados: email, URL, DNI/NIE, IBAN, teléfono, código postal, contraseña segura, fecha, hex de color… Cada uno abre en el Tester o el Builder.                                                                                                                                                                                                                                                                               | —                        | ☐        |

### 3.5 Tiempo

| Entrada              | Qué hace                                                                                                                                                 | Librería                   | Decisión |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -------- |
| Timestamp            | Convierte entre epoch (segundos y milisegundos), ISO 8601 y fecha legible en el idioma del usuario. Muestra el timestamp actual en vivo.                 | `Intl` nativo              | ☐        |
| Zonas horarias       | Muestra una fecha/hora en varias zonas a la vez (con buscador de ciudades) para cuadrar reuniones o depurar fechas de servidores.                        | `Intl` nativo              | ☐        |
| Diferencia de fechas | Calcula el tiempo entre dos fechas (días, horas, días laborables) y suma o resta duraciones a una fecha.                                                 | `date-fns`                 | ☐        |
| Cron                 | Explica en lenguaje natural una expresión cron ("cada lunes a las 9:00") y muestra las próximas ejecuciones; también un constructor visual para crearla. | `cronstrue`, `cron-parser` | ☐        |

### 3.6 Web y HTTP

| Entrada        | Qué hace                                                                                                                                                                                                               | Librería        | Decisión |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------- |
| cURL → fetch   | Convierte un comando cURL (el que copias de las DevTools) a código `fetch`, `axios` o `HttpClient` de Angular.                                                                                                         | `curlconverter` | ☐        |
| Códigos HTTP   | Chuleta buscable de todos los códigos de estado HTTP con explicación clara y cuándo usar cada uno.                                                                                                                     | —               | ☐        |
| Cabeceras HTTP | Pegas las cabeceras de una respuesta y explica cada una (caché, CORS, cookies, seguridad), con avisos de lo que falta (CSP, HSTS, `X-Content-Type-Options`…).                                                          | —               | ☐        |
| Meta tags      | Rellenas título, descripción e imagen y ves cómo queda tu página en Google, LinkedIn, X y WhatsApp, con aviso si el título o la descripción se cortarán. Genera las etiquetas `<meta>` y Open Graph listas para pegar. | —               | ☐        |
| User-Agent     | Desglosa un User-Agent en navegador, versión, motor, sistema operativo y tipo de dispositivo. Muestra el del propio usuario por defecto.                                                                               | `ua-parser-js`  | ☐        |
| Semver         | Comprueba si una versión cumple un rango (`¿^1.2.3 acepta 1.4.0?`), explica qué significan `^`, `~`, `>=`… y ordena listas de versiones.                                                                               | `semver`        | ☐        |

### 3.7 Back: SQL y APIs

| Entrada               | Qué hace                                                                                                                                                                            | Librería                                                                    | Decisión |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| SQL Formatter         | Formatea consultas SQL ilegibles (palabras clave en mayúsculas, una cláusula por línea) o las compacta en una línea. Selector de dialecto (PostgreSQL, MySQL, SQL Server, SQLite…). | `sql-formatter`                                                             | ☐        |
| SQL → Diagrama ER     | Pegas sentencias `CREATE TABLE` y genera el diagrama entidad-relación (tablas, columnas, claves y relaciones) con Mermaid, exportable a SVG/PNG.                                    | parser propio + `mermaid`                                                   | ☐        |
| OpenAPI Viewer        | Pegas o subes un OpenAPI/Swagger (YAML o JSON) y lo muestra como documentación navegable (endpoints, parámetros, esquemas), con los errores de la especificación marcados.          | `@scalar/api-reference` o `swagger-ui-react`, `@apidevtools/swagger-parser` | ☐        |
| JSON Schema Validator | Valida un JSON contra un JSON Schema y señala exactamente qué campo falla y por qué. También puede generar un esquema a partir de un JSON.                                          | `ajv`                                                                       | ☐        |
| XML ↔ JSON            | Convierte XML a JSON y al revés, conservando atributos. Para APIs B2B y SOAP.                                                                                                       | `fast-xml-parser`                                                           | ☐        |
| Formatear XML         | Formatea, minifica y valida XML, marcando dónde está el error.                                                                                                                      | `fast-xml-parser`                                                           | ☐        |

### 3.8 Back: infraestructura

| Entrada              | Qué hace                                                                                                                                           | Librería           | Decisión |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------- |
| docker run → compose | Convierte un comando `docker run` con sus flags en el bloque equivalente de `docker-compose.yml`.                                                  | `composerize`      | ☐        |
| Subredes CIDR        | Dado un rango CIDR (`10.0.0.0/24`) muestra máscara, primera y última IP, número de hosts y si una IP pertenece al rango.                           | `ip-cidr` o propio | ☐        |
| chmod                | Calculadora de permisos Unix: marcas casillas (lectura/escritura/ejecución por usuario, grupo y otros) y obtienes `755` / `rwxr-xr-x`, y al revés. | propio             | ☐        |
| .env ↔ JSON          | Convierte un archivo `.env` a JSON y al revés, detectando claves duplicadas y valores mal entrecomillados.                                         | `dotenv` (parser)  | ☐        |

### 3.9 Texto y código

| Entrada                | Qué hace                                                                                                                                                                                          | Librería                                          | Decisión |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | -------- |
| Markdown               | Editor de Markdown con vista previa en vivo, sabor GitHub (tablas, listas de tareas, código resaltado) y diagramas Mermaid incrustados. Para preparar README o descripciones de PR. Exporta HTML. | `react-markdown`, `remark-gfm`, `rehype-sanitize` | ☐        |
| HTML → JSX             | Convierte HTML a JSX válido (`class` → `className`, `style` a objeto, etiquetas autocerradas…).                                                                                                   | `htmltojsx` o propio                              | ☐        |
| camelCase / snake_case | Convierte texto o listas de identificadores entre camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE y Title Case.                                                                      | `change-case`                                     | ☐        |
| Diff de texto          | Compara dos textos o fragmentos de código lado a lado o en línea, con las diferencias resaltadas por línea y por palabra.                                                                         | `diff`                                            | ☐        |
| Teclado                | Pulsas cualquier tecla y muestra `event.key`, `event.code`, `keyCode` y modificadores, para programar atajos de teclado.                                                                          | nativo                                            | ☐        |

### 3.10 CSS

| Entrada              | Qué hace                                                                                                                                                                                            | Librería | Decisión |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- |
| clamp()              | Das tamaño mínimo y máximo y los dos anchos de pantalla, y genera el `clamp()` fluido (mezclando `rem` + `vw` para respetar el zoom). Vista previa donde arrastras el ancho y ves escalar el texto. | propio   | ☐        |
| Escala tipográfica   | A partir de un tamaño base y una proporción genera la escala fluida completa (de `small` a `h1`), exportable como variables CSS o tema de Tailwind.                                                 | propio   | ☐        |
| Conversor de colores | Convierte entre HEX, RGB, HSL, OKLCH y nombre CSS, con selector visual.                                                                                                                             | `culori` | ☐        |
| Escala de colores    | De un color base genera la gama 50–950 al estilo Tailwind, exportable como variables CSS o tema.                                                                                                    | `culori` | ☐        |
| Contraste            | Comprueba el contraste entre color de texto y fondo según WCAG (AA/AAA) y sugiere el ajuste mínimo para cumplir.                                                                                    | `culori` | ☐        |
| box-shadow           | Generador visual de sombras (varias capas, inset) con vista previa y el CSS listo.                                                                                                                  | propio   | ☐        |
| Gradientes           | Generador visual de gradientes lineales, radiales y cónicos con varios puntos de color.                                                                                                             | propio   | ☐        |
| cubic-bezier         | Editor de curvas de animación arrastrando los puntos, con presets y previsualización de la animación.                                                                                               | propio   | ☐        |
| px ↔ rem             | Convierte entre px, rem y em según el tamaño base, también en lote.                                                                                                                                 | propio   | ☐        |

### 3.11 Imagen

| Entrada       | Qué hace                                                                                                                                                                                             | Librería          | Decisión |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------- |
| Optimizar SVG | Limpia y reduce un SVG (metadatos, decimales, grupos sobrantes) mostrando el ahorro y la vista previa antes/después.                                                                                 | `svgo` (browser)  | ☐        |
| SVG → React   | Convierte un SVG en un componente React/TSX con props (`size`, `color`) y `currentColor`.                                                                                                            | `@svgr/core`      | ☐        |
| Favicon       | Subes una imagen y genera todos los iconos (`favicon.ico` 16/32/48, `favicon.svg`, `apple-touch-icon` 180, PWA 192/512 y maskable), el `site.webmanifest` y las etiquetas `<link>`. Descarga en ZIP. | `canvas`, `jszip` | ☐        |
| WebP          | Convierte imágenes a WebP (y AVIF si el navegador lo soporta) con calidad ajustable, comparando tamaño y aspecto.                                                                                    | `canvas`          | ☐        |
| QR            | Genera códigos QR de texto, URL, WiFi o contacto, con colores y logo, exportables a PNG/SVG.                                                                                                         | `qrcode`          | ☐        |

### 3.12 Editores en vivo

| Entrada    | Qué hace                                                                                                                                                                                                                                                                      | Librería  | Decisión |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | -------- |
| Mermaid    | Editor de código Mermaid a la izquierda y diagrama a la derecha (paneles redimensionables), renderizado en vivo con error si la sintaxis falla, zoom, plantillas de cada tipo y exportación a SVG/PNG. Compartible por enlace.                                                | `mermaid` | ☐        |
| Playground | Editores HTML, CSS y JS con vista previa en un `iframe` aislado (`sandbox="allow-scripts"`, sin `allow-same-origin`), consola propia que captura `console.log`, librerías por CDN (jsDelivr, unpkg, cdnjs) con lista rápida e import maps vía esm.sh. Compartible por enlace. | —         | ☐        |

### 3.13 Cierre

| Entrada  | Qué hace                                                                                                                                                               | Decisión |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Sobre mí | Página de autor: quién está detrás, por qué existe la web, enlaces (GitHub, LinkedIn, portfolio) y el botón de **invítame a un café** (Ko-fi). Lleva JSON-LD `Person`. | ☐        |

## 4. Diseño: un IDE en el navegador

### Estructura de la interfaz (inspirada en VS Code)

- **Barra de actividad** (izquierda, solo iconos): inicio, buscador, favoritos, recientes, ajustes.
- **Panel explorador**: el menú de herramientas con **buscador fijo arriba** que filtra al escribir, favoritos y recientes anclados al principio, y separadores finos sin título entre bloques.
- **Pestañas** arriba para tener varias herramientas abiertas.
- **Barra de estado** abajo: "100% local · 0 bytes enviados", tipo de dato detectado, línea/columna, caracteres y bytes.
- **Command palette** (Ctrl+K) para saltar a cualquier herramienta.

### Estética

- Fondo casi negro azulado, superficies en capas ligeramente más claras.
- **Cian neón como único acento**, con brillo solo en elementos activos (foco, pestaña abierta, botón principal). Si brilla todo, cansa.
- Tipografía: monoespaciada tipo JetBrains Mono para código y títulos; Geist o Inter para la interfaz.
- Todos los colores como tokens CSS (variables), para poder ajustar la paleta en un solo sitio.
- Modo claro disponible, pero oscuro por defecto.

### Usabilidad

- **Todas las herramientas comparten esqueleto** (`ToolShell`): entrada a la izquierda, resultado a la derecha y barra de acciones fija (copiar, limpiar, intercambiar, cargar ejemplo). Aprendes una, sabes usarlas todas.
- Procesado **en vivo** mientras se escribe (con debounce), sin botones de "convertir".
- En móvil: paneles apilados y la barra de actividad pasa a navegación inferior.
- Accesibilidad: contraste WCAG AA, navegación por teclado completa, `prefers-reduced-motion` respetado.

## 5. Detector inteligente ("pega y listo")

En la Home, en el buscador Ctrl+K y al pulsar Ctrl+V en la Home sin nada seleccionado.

### Funcionamiento

1. Detectores como **funciones puras**, cada uno devuelve un tipo y una confianza.
2. Se evalúan de más específico a más general:
   `cURL` → `docker run` → JWT → certificado PEM → URL → cabeceras HTTP → timestamp (10/13 dígitos en rango razonable) → fecha ISO → UUID → color → cron → Mermaid → SQL → XML → JSON (válido o empezando por `{`/`[`, que lleva al validador con el error marcado) → HTML → `.env` → texto codificado (`%XX`, `&amp;`) → Base64 (último recurso).
3. Un resultado con confianza alta → navega directamente a la herramienta con el contenido cargado. Varios posibles → chips para elegir ("Parece un timestamp · ¿o un número JSON?").
4. El contenido viaja a la herramienta por un **store en memoria**, nunca por la URL.
5. Cada detector con su batería de tests de casos reales y casos trampa.

## 6. SEO

- **Una URL por herramienta e idioma**, generada estática con `generateStaticParams`. Slugs traducidos (`/es/formatear-json`, `/fr/formater-json`, `/pt/formatar-json`, `/en/json-formatter`).
- `generateMetadata` por página: título, descripción, canonical, `alternates.languages` con `hreflang` de los 4 idiomas + `x-default`.
- **Contenido indexable bajo cada herramienta** (renderizado en servidor): qué hace, cómo usarla, ejemplos y preguntas frecuentes. Archivos MDX por herramienta e idioma en `src/content/<tool>/<locale>.mdx`.
- **JSON-LD**: `WebApplication` por herramienta, `BreadcrumbList`, `FAQPage`, `Person` en "Sobre mí", `WebSite` con `SearchAction` en Inicio.
- `sitemap.ts` con todas las URLs y sus alternativas de idioma; `robots.ts` permitiendo explícitamente rastreadores de IA (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).
- `llms.txt` en la raíz con el resumen de la web y el listado de herramientas.
- Imágenes Open Graph generadas por herramienta e idioma (`opengraph-image.tsx`).
- Redirección por `Accept-Language` **solo** en `/`; nunca en páginas internas.
- Objetivo Core Web Vitals en verde en todas las páginas (Lighthouse CI con umbrales).

## 7. Internacionalización

- Idiomas: inglés (por defecto, `x-default`), español, francés y portugués de Brasil.
- Textos de interfaz en `src/i18n/messages/{en,es,fr,pt}.json`.
- Fechas, números y zonas horarias con `Intl` en el idioma activo.
- Selector de idioma en la barra de estado y en Ajustes, enlazando a la página equivalente en el otro idioma.
- Fase de lanzamiento: **inglés y español revisados**; francés y portugués después, revisados al menos en las herramientas principales.

## 8. Compartir por enlace

Solo en Mermaid, Playground, Regex Builder/Tester y generadores CSS: el contenido se comprime (`lz-string`) en el **hash** de la URL (`#…`), que no llega a ningún servidor. Desactivado en todas las herramientas marcadas como `sensitive`.

## 9. Arquitectura del código

```
src/
├── app/
│   └── [locale]/
│       ├── page.tsx                 Inicio
│       ├── about/page.tsx           Sobre mí
│       ├── [slug]/page.tsx          Página genérica de herramienta (resuelve por slug + locale)
│       ├── sitemap.ts, robots.ts
│       └── layout.tsx
├── components/
│   ├── ui/                          Piezas base de shadcn (sin lógica de negocio)
│   ├── layout/                      ActivityBar, Explorer, TabBar, StatusBar, CommandPalette
│   ├── shared/                      CodeEditor, SplitPane, ToolShell, CopyButton, FileDrop, DonateButton
│   └── tools/<tool-id>/             Componentes propios de cada herramienta
├── lib/
│   └── utils/<dominio>/             Funciones puras: json, encoding, jwt, url, time, regex, css, sql, crypto, detect…
├── config/
│   ├── site.ts                      Nombre, dominio, enlaces, Ko-fi
│   └── tools.ts                     Registro de herramientas (menú, rutas, SEO, buscador, detector)
├── content/<tool-id>/<locale>.mdx   Contenido SEO
├── i18n/messages/                   en, es, fr, pt
├── hooks/
├── workers/
├── types/
└── tests/e2e/
```

### Reglas

1. `lib/utils` **nunca importa React** ni nada del DOM salvo APIs estándar (Web Crypto, `TextEncoder`…). Todo testeable con Vitest.
2. **Una herramienta nunca importa de otra.** Lo común sube a `components/shared` o `lib/utils`.
3. **Añadir una herramienta** = crear `components/tools/<id>/`, sus utilidades, su contenido MDX y una entrada en `config/tools.ts`. El layout, el menú, el sitemap, el buscador y el detector la recogen solos.

### Registro de herramientas (verificado con `tsc --strict`)

```ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

export const locales = ["en", "es", "fr", "pt"] as const;
export type Locale = (typeof locales)[number];

export type ToolId = "json-format" | "jwt-decoder"; /* | … resto de ids */

export interface ToolDefinition {
  id: ToolId;
  group: number; // bloque del menú (separador)
  icon: LucideIcon;
  slugs: Record<Locale, string>; // slug por idioma
  keywords: string[]; // buscador y Ctrl+K
  sensitive: boolean; // sin persistencia ni enlace compartido
  shareable: boolean; // contenido en el hash de la URL
  load: () => Promise<{ default: ComponentType }>;
}

export interface Detection {
  toolId: ToolId;
  confidence: number; // 0..1
}

export type Detector = (input: string) => Detection | null;

export const detectJwt: Detector = (input) => {
  const parts = input.trim().split(".");
  if (parts.length !== 3) return null;
  try {
    const header: unknown = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof header === "object" && header !== null && "alg" in header
      ? { toolId: "jwt-decoder", confidence: 0.95 }
      : null;
  } catch {
    return null;
  }
};
```

> Nota para la implementación: `atob` puede fallar con Base64URL sin relleno en algunos entornos; la versión final debe añadir el `=` de padding antes de decodificar y tener test para ello.

## 10. Donaciones, legal y analítica

- **Ko-fi**: botón en Inicio y Sobre mí, vinculado a PayPal. Solo donaciones puntuales (las mensuales llevan comisión en el plan gratuito). Sin SDK: un enlace.
- **Privacidad del autor**: en PayPal, correo principal en el dominio de la web (reenvío con ImprovMX o Forward Email); nunca publicar teléfono ni correo personal. Sin Bizum.
- **Páginas legales**: Aviso legal y Política de privacidad, en los 4 idiomas, enlazadas en el pie.
- **Analítica sin cookies** (sin banner de consentimiento) + Search Console + Bing Webmaster.
- **Código abierto** en GitHub, enlazado desde la web ("comprueba que no enviamos tus datos").

## 11. Calidad

- Vitest para todas las funciones de `lib/utils`, incluidos todos los detectores.
- Playwright: un test E2E por herramienta (cargar ejemplo → resultado esperado) en al menos un idioma, y navegación entre idiomas.
- Lighthouse CI en cada PR con umbrales mínimos (rendimiento ≥ 90, accesibilidad ≥ 95, SEO = 100).
- ESLint + Prettier + TypeScript `strict`; CI en GitHub Actions.

## 12. Fases de construcción

Hitos cerrados y verificables, en este orden:

1. **Base**: proyecto Next + Tailwind + shadcn, tokens de diseño, layout IDE completo (barra de actividad, explorador con buscador, pestañas, barra de estado, Ctrl+K), i18n con `next-intl`, registro de herramientas, plantilla `[slug]` con metadatos, JSON-LD, sitemap, robots y `llms.txt`.
2. **Componentes compartidos**: `ToolShell`, `CodeEditor` (CodeMirror), `SplitPane`, `CopyButton`, `FileDrop`.
3. **Herramientas de referencia** (una de cada patrón): Formatear JSON (editor + errores), JWT Decoder (sensible), clamp() (generador visual), Mermaid (editor en vivo + compartir).
4. **Inicio con detector inteligente** y **Sobre mí** con donación.
5. **Resto de herramientas por bloques**, en el orden de la sección 3, cada bloque con sus tests y contenido MDX en inglés y español.
6. **Regex Builder** (drag and drop) y **Playground**, por su complejidad.
7. **Francés y portugués**, páginas legales, analítica, Lighthouse CI y despliegue en Vercel con el dominio `kitforweb`.

## 13. Pendientes

- [x] Nombre y dominio: `kitforweb`, comprado.
- [ ] Conectar el dominio al proyecto en Vercel y, si se compraron varias extensiones, redirigir las secundarias a la principal con 301.
- [ ] Revisar la columna **Decisión** de la sección 3.
- [ ] Crear cuenta de Ko-fi y reenvío de correo del dominio.
- [ ] Crear organización/repositorio `kitforweb` en GitHub.
