# El Puntero

<img src="assets/icon.png" width="72" align="right" alt="">

Usa el móvil como ratón y teclado del PC, por la wifi. Esta es la app de **Android** (Expo); la parte del PC es la
herramienta **El Puntero** de [PC Toolkit](https://github.com/ikerlorente11/pc-toolkit), que también tiene su
instalador propio en las releases de ese repo.

## El PC

En el PC (Windows 10 u 11) hace falta el programa **El Puntero**, gratis y sin permisos de administrador:

- **[⬇ Descargar el instalador](https://github.com/ikerlorente11/pc-toolkit/releases?q=puntero-v&expanded=true)**
  (el `El Puntero_x.y.z_x64-setup.exe` de la release más reciente), o
- con [PC Toolkit](https://github.com/ikerlorente11/pc-toolkit), herramienta **El Puntero** (se instala y se actualiza sola).

Ábrelo (se queda en la bandeja), y en el móvil pulsa **Escanear el QR del PC**. La primera vez Windows pregunta si
puede usar la red: permítelo en redes privadas.

## Qué hace

- **Ratón**: touchpad que ocupa la pantalla, con aceleración (lento es preciso, rápido cruza la pantalla).
  - Tocar = clic · tocar y volver a tocar moviendo = arrastrar · tocar dos veces = doble clic
  - Mantener pulsado = agarrar (arrastrar sin trucos)
  - Dos dedos: desplazar (con inercia) · pellizcar = zoom · tocar con dos = clic derecho · con tres = clic central
  - Tres dedos: ← → cambia de app, ↑ vista de tareas, ↓ escritorio · cuatro dedos ← → escritorios virtuales
  - Tira de desplazamiento a la derecha y botones de verdad abajo (izquierdo, rueda, derecho) que se pueden mantener
    con un dedo mientras otro mueve: un único área táctil reparte cada dedo por zonas.
- **Modo aire**: el giroscopio mueve el puntero, sujetes el móvil como lo sujetes (el giro se mide respecto a la
  vertical). Por defecto solo mientras el pulgar descansa en el touchpad, como el botón de un puntero láser.
- **Teclado** en directo: lo que escribes aparece en el PC al momento, con autocorrector, escritura deslizando,
  dictado y emojis; Ctrl/Alt/Mayús/Win fijos para atajos; flechas, F1–F12 y demás; modo «Redactar» para enviar de una vez.
- **Multimedia**: reproducir/pausa y pistas, volumen del PC sincronizado, teclas de vídeo y de presentaciones.
- **Apps**: ventanas abiertas (traer, minimizar, cerrar), apps instaladas (abrir, fijar), webs (favoritos, recientes).
- **Más**: bloquear, apagar pantalla, suspender, reiniciar, apagar; atajos de Windows y del navegador; portapapeles
  en los dos sentidos; ajustes.
- Se empareja escaneando el QR del PC (o con un código de 6 cifras) y **todo va cifrado** ([PROTOCOL.md](PROTOCOL.md)).

## Desarrollo

```bash
npm install
npm test                 # lógica pura de src/core (gestos, cifrado, protocolo…)
npx tsc --noEmit
npx expo start           # se prueba en Expo Go (SDK 58): no hay módulos nativos propios
```

Con el PC (debug de `pc-toolkit/tools/puntero/app`): `PUNTERO_DEV_LINK=<archivo> el-puntero.exe --hidden` y
`PUNTERO_DEV_LINK=<archivo> npx vitest run tests/server.test.ts` empareja, mueve el puntero, pide ventanas, apps y
volumen contra el PC real. Con un móvil por USB: `adb reverse tcp:8081 tcp:8081` y abrir `exp://localhost:8081`.

- Actualización OTA: `npm run update` (canal production). Compilación: `npm run release` (EAS, a Play interno) o
  `npm run build:apk`.
- `runtimeVersion` sigue a `version`: cambiar de versión obliga a una compilación nueva; si solo cambia JS, OTA.
