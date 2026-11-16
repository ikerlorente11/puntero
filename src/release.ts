// The version Ajustes shows and what changed in each one. It goes up with every update, OTA ones too
// (the native version in app.json only changes with a new build).
export const RELEASE = '0.1.1'

export const CHANGES: { version: string; date: string; items: string[] }[] = [
  {
    version: '0.1.1',
    date: '16 nov 2026',
    items: [
      'Ajustes generales desde la pantalla de los PCs, sin tener que conectarte antes.',
      'Solo aparecen los PCs a los que te puedes conectar ahora; los demás quedan aparte.',
      'Si «Conectar al último PC al abrir» está activado, la app entra directa también al volver a ella.',
      'Nuevo ajuste «Invertir la rueda»: cambia el sentido de la tira de desplazamiento y de la rueda.',
      'Encuentra el PC aunque Windows le haya quitado su puerto habitual (hace falta El Puntero 0.1.1 en el PC).',
    ],
  },
  {
    version: '0.1.0',
    date: '15 nov 2026',
    items: ['Primera versión: touchpad, modo aire, teclado, multimedia, apps y ventanas, encendido y portapapeles.'],
  },
]
