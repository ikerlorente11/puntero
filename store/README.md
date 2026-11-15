# Ficha de Google Play

Lo que pide Play Console para publicar El Puntero (paquete `com.ikerlorente11.puntero`).

## Gráficos

| Archivo | Para qué |
| --- | --- |
| `icono-512.png` | Icono de la aplicación: 512 × 512, PNG sin transparencia (Play aplica su máscara) |
| `grafico-destacado-1024x500.png` | Gráfico destacado: 1024 × 500, PNG de 24 bits |
| `capturas-movil/01…08-*.png` | Capturas de teléfono: 1080 × 1920 (9:16), en el orden en que se suben |
| `capturas-tablet/01…08-*.png` | Capturas de tablet de 7" y 10": 1440 × 2560 (9:16, la tablet en vertical) |

`make_store.py` (común a todas las apps, con Pillow y Segoe UI) rehace `icono-512.png`, el gráfico destacado y las
capturas enmarcadas a partir de `icono-fuente.png` (el `assets/icon.png` de la app), las capturas en bruto de
`crudas/movil` y `crudas/tablet` (emuladores Pixel 7 y Pixel Tablet, Android 15) y `store.json` (colores, lema y
titular de cada captura): `python make_store.py`.

Las capturas en bruto se hacen contra el PC de demostración, `node scripts/demo-pc.mjs` (habla el protocolo de
verdad con ventanas, apps y volumen inventados; desde el emulador el PC es `10.0.2.2`, y se empareja con el código
`123456`), para no enseñar nada de un PC real. Hay que parar antes El Puntero de verdad, que usa el mismo puerto.

## Textos

Descripción breve, descripción completa y notas de cada versión, listas para pegar: **`ficha.txt`**.

**Nombre:** El Puntero

**Categoría:** Herramientas (Tools). **Etiquetas:** mando a distancia, ratón, teclado.

**Contacto:** el correo de desarrollador de la cuenta de Play Console.

## Política de privacidad

Publicada (repo `privacy_policies`, GitHub Pages):
https://ikerlorente11.github.io/privacy_policies/puntero/privacy-policy.html

En resumen:

> El Puntero no recoge, guarda ni comparte datos personales. Solo se comunica, por tu red local y cifrado, con los PCs que emparejas. La cámara se usa solo para leer el QR de emparejado y el giroscopio solo en el modo aire. Sin cuentas, anuncios ni analíticas.

## Seguridad de los datos (formulario de Play)

- ¿Recoge o comparte datos de usuario? **No** (lo que se envía va al PC del propio usuario por la red local, no a
  terceros ni a servidores del desarrollador).
- ¿Los datos se cifran en tránsito? **Sí** (XSalsa20-Poly1305 con una clave por móvil, ver `PROTOCOL.md`).
- ¿Se pueden borrar? No hay datos en servidores nuestros: todo está en el dispositivo y se borra al olvidar el PC o
  desinstalar.

## Clasificación de contenido

Utilidad sin contenido propio: «Herramientas», sin violencia, sexo, apuestas ni interacción entre usuarios.

## Permisos que Play puede preguntar

- **Cámara**: leer el QR de emparejado.
- **Sensores de alta frecuencia** (`HIGH_SAMPLING_RATE_SENSORS`): el modo aire lee el giroscopio a 100 Hz.

## Primera subida

La primera versión se sube a mano en Play Console (la API no deja crear la primera): el AAB de la build de EAS
(`npm run release` sin `--auto-submit`, o `eas build -p android --profile production`). Después, `eas submit` con
`credentials/play-service-account.json` (la misma clave de servicio que las otras apps) sube las siguientes a la
pista `internal` (ver `eas.json`), y lo que sea solo JavaScript va por OTA con `npm run update`.
