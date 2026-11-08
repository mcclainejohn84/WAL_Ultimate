// ============================================================================
// EL CATÁLOGO DE CICATRICES DE LOS PERSONAJES DE RENOMBRE.
//
// Lo que le queda a un personaje después de una mala tirada: un ojo menos, una
// muñeca aplastada, un pulmón perforado. NO CUESTAN EXPERIENCIA —no se
// compran, se sufren—, así que aquí no hay precios ni nada que descontar: una
// cicatriz se apunta y ya está.
//
// Vive en el código por lo mismo que el catálogo de habilidades (ver
// domain/habilidadesDeRenombre): es el reglamento, no datos del grupo. La base
// guarda solo qué cicatrices tiene cada personaje, por su `clave`.
//
// EL EFECTO NO SE APLICA SOLO. "Pierde –1 Iniciativa" no toca la ficha del
// personaje: la ficha es del catálogo y la comparten todas las listas, y una
// cicatriz es de ESTE personaje. Se escribe aquí, sale en su hoja y en el PDF
// del ejército, y en la mesa se cuenta a mano, que es como se juega.
// ============================================================================

export interface CicatrizDeRenombre {
  /** Clave estable, la que se guarda en la base. NUNCA se cambia. */
  clave: string
  nombre: string
  descripcion: string
}

export const CATALOGO_DE_CICATRICES: CicatrizDeRenombre[] = [
  {
    clave: 'cicatriz:tuerto',
    nombre: 'Tuerto',
    descripcion:
      'Recibe un golpe en el rostro, los reflejos del personaje se ven mermados. El personaje pierde –1 en su atributo de Iniciativa.',
  },
  {
    clave: 'cicatriz:muneca-fracturada',
    nombre: 'Muñeca fracturada',
    descripcion:
      'Su muñeca ha sido aplastada y sus secuelas aún se notan. El personaje ve reducido en 1 su atributo de HA y HP.',
  },
  {
    clave: 'cicatriz:hueso-fracturado',
    nombre: 'Hueso fracturado',
    descripcion:
      'Una de sus extremidades se rompió y no pudo ser completamente restablecida. Sufre dolencias permanentes. El personaje pierde –1 Ataque.',
  },
  {
    clave: 'cicatriz:craneo-desnudo',
    nombre: 'Cráneo desnudo',
    descripcion:
      'El personaje recibe un brutal golpe en la cabeza; está desfigurado y sus tropas le miran con horror. El personaje resta –1 a su atributo de Liderazgo.',
  },
  {
    clave: 'cicatriz:brazo-amputado',
    nombre: 'Brazo amputado',
    descripcion: 'Pierde un brazo y eso se refleja en el equipo que puede llevar el personaje.',
  },
  {
    clave: 'cicatriz:pierna-amputada',
    nombre: 'Pierna amputada',
    descripcion:
      'Un fuerte tajo cercena tu extremidad. El personaje no puede montar ninguna montura y a pie su Movimiento se ve reducido en –2 cm.',
  },
  {
    clave: 'cicatriz:pulmon-perforado',
    nombre: 'Pulmón perforado',
    descripcion: 'Le atraviesan el pecho con una estocada. Pierde –1 a Resistencia.',
  },
  {
    clave: 'cicatriz:intestinos-arrancados',
    nombre: 'Intestinos arrancados',
    descripcion:
      'Un impacto en el vientre rompe su armadura y desparrama parte de sus intestinos, una cicatriz horrible que nunca sanará del todo; los dolores y los vómitos dejan al personaje con un –1 en su atributo de Heridas.',
  },
  {
    clave: 'cicatriz:muerto',
    nombre: 'Muerto',
    descripcion: 'Tu personaje se retira como una baja del juego.',
  },
]

export const CICATRIZ_POR_CLAVE = new Map(CATALOGO_DE_CICATRICES.map((c) => [c.clave, c]))
