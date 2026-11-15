# Protocolo de El Puntero (v1)

Entre la app de Android (este repo) y la app de escritorio (`tools/puntero/app` de
[pc-toolkit](https://github.com/ikerlorente11/pc-toolkit)). Todo por la red local, puerto TCP **47810**.

## Descubrir

`GET http://<ip>:47810/info` →
`{"app":"puntero","v":1,"id":"<id del PC>","name":"<nombre>","version":"0.1.0","pairing":true}`

El móvil pregunta a todas las direcciones de su /24 a la vez (sin UDP, funciona en Expo Go). `pairing` dice si la
ventana del PC está abierta (solo entonces se puede emparejar).

## QR de emparejado

`puntero://pair?v=1&id=<id>&n=<nombre>&p=<puerto>&h=<ip>,<ip>…&k=<64 hex>`

`k` es una clave aleatoria de 32 bytes que cambia cada 10 minutos, tras emparejar y tras 5 fallos. Con el
código de 6 cifras, la clave es `SHA-512("puntero-pair-v1:" + código)[0..32]` (más débil: por eso el QR es lo
recomendado).

## Sesión

WebSocket `ws://<ip>:47810/ws`.

1. PC → texto: `{"t":"hi","app":"puntero","v":1,"c":"<reto base64, 16 bytes>","name":…,"id":…}`
2. Móvil → texto, una de:
   - `{"t":"hello","dev":"<id del móvil>","box":"<base64 de caja(clave del móvil, {c, name})>"}`
   - `{"t":"pair","dev":…,"via":"qr"|"code","box":"<base64 de caja(clave de emparejado, {c, name, key})>"}`
     donde `key` es la clave nueva del móvil para ese PC (base64, 32 bytes, la genera el móvil).
3. PC → binario: caja(clave del móvil, `{"t":"welcome","name","id","version","v","paired"?}`),
   o texto `{"t":"denied","why":"unknown"|"closed"|"badcode"|"expired"|"bad"}` y cierra.
4. A partir de ahí, cada mensaje en ambos sentidos es binario: una caja con un objeto JSON.

**Caja** = nonce aleatorio de 24 bytes + `secretbox` de NaCl (XSalsa20-Poly1305): `tweetnacl` en el móvil,
`crypto_secretbox` en Rust. El reto `c` dentro de la caja impide repetir una sesión grabada.

El móvil manda `ping` cada 4 s; el PC corta tras 20 s sin nada y suelta los botones y teclas que siguieran pulsados.

## Mensajes del móvil

| `t` | Campos | Qué hace |
|---|---|---|
| `m` | `x`, `y` (px, con decimales) | Mueve el puntero (las fracciones se acumulan) |
| `btn` | `b`: left/right/middle/x1/x2, `a`: click/down/up/dbl | Botones |
| `scroll` | `x`, `y` (120 = un paso de rueda; y > 0 sube) | Rueda, suave |
| `zoom` | `d` (pasos; > 0 acerca) | Ctrl + rueda |
| `text` | `s` | Escribe el texto (Unicode); `\n` Intro, `\t` Tab, `\b` Retroceso |
| `key` | `k` (nombre), `mods` (ctrl/alt/shift/win), `a` | Tecla o atajo. Nombres: a–z, 0–9, f1–f24, enter, esc, tab, space, backspace, delete, insert, home, end, pageup, pagedown, up/down/left/right, win, menu, printscreen, playpause, next, prev, stop, volup, voldown, mute, browserback…, plus, minus, comma, period |
| `vol` | `v` (0–1)?, `mute`? | Volumen; sin campos, solo pregunta |
| `url` | `u` | Abre una web (solo http/https; sin esquema, https; con espacios, búsqueda) |
| `apps` | | Pide las apps del menú Inicio |
| `launch` | `id` | Abre una app de esa lista |
| `windows` | | Pide las ventanas abiertas |
| `win` | `id`, `a`: focus/close/minimize/maximize | Actúa sobre una ventana |
| `power` | `a`: lock/sleep/shutdown/restart/logoff/screenoff | Encendido |
| `clip` | `s` | Pone el texto en el portapapeles del PC |
| `clipget` | | Pide el portapapeles del PC |
| `ping` | `n` | Responde `pong` con el mismo `n` |

## Mensajes del PC

`welcome`, `vol {v, mute}`, `apps {items:[{id,name}]}`, `windows {items:[{id,title,exe,active}]}`, `clip {s}`,
`pong {n}`, `error {msg}` (en castellano, para enseñarlo).
