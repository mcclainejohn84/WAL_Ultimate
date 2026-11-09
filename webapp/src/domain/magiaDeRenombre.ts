// ============================================================================
// LA MAGIA DE LOS PERSONAJES DE RENOMBRE: niveles de senda, habilidades
// mágicas, saberes arcanos y pergaminos, con lo que cuesta cada cosa en
// experiencia.
//
// Vive en el código por lo mismo que el catálogo de habilidades y el de
// cicatrices (ver domain/habilidadesDeRenombre): es el reglamento, no datos
// del grupo. La base guarda solo QUÉ tiene cada personaje, por la `clave`
// estable de cada entrada.
//
// DÓNDE SE GUARDA CADA COSA:
//   - Las sendas y su nivel, en `unit_magic_paths` (ver magicRepository).
//   - Las habilidades, las avanzadas, los saberes y los pergaminos, en
//     `unit_skills`, la misma tabla que las habilidades de personaje: son lo
//     mismo —algo que se compra con experiencia y deja apunte en el libro— y
//     lo que las distingue es el prefijo de su clave.
//
// LO QUE LA APLICACIÓN NO PUEDE SABER son los edificios: la Torre de Alta
// Hechicería y el Gremio de Magos son del jugador, no del personaje, y aquí
// no hay ejércitos de campaña. Lo que las requiere lo dice y se puede comprar
// igual: quien lleva la campaña sabe si tiene la torre.
// ============================================================================

export type TipoDeMagia = 'habilidad' | 'avanzada' | 'saber' | 'pergamino'

export const ETIQUETAS_DE_MAGIA: Record<TipoDeMagia, string> = {
  habilidad: 'Habilidades mágicas',
  avanzada: 'Habilidades mágicas avanzadas',
  saber: 'Saberes arcanos',
  pergamino: 'Pergaminos de magia',
}

export interface HabilidadMagica {
  /** Clave estable, la que se guarda en la base. NUNCA se cambia. */
  clave: string
  nombre: string
  tipo: TipoDeMagia
  coste: number
  descripcion: string
  /** Clave de la habilidad que hace falta tener antes (solo en las avanzadas). */
  requiere?: string
  /** Nivel del saber arcano (1 a 4). Marca además el nivel de senda que hace falta. */
  nivel?: number
  /** Dificultad de lanzamiento del saber arcano. */
  dificultad?: string
  /** Si hace falta la Torre de Alta Hechicería (saberes) o el Gremio de Magos (pergaminos). */
  edificio?: string
}

/** El prefijo dice de qué lista es una clave sin tener que mirar el catálogo. */
export const PREFIJO_DE_MAGIA: Record<TipoDeMagia, string> = {
  habilidad: 'magia:',
  avanzada: 'magia-av:',
  saber: 'saber:',
  pergamino: 'pergamino:',
}

/** ¿Esta clave de `unit_skills` es de magia? Lo contrario son las de personaje. */
export function esClaveDeMagia(clave: string): boolean {
  return Object.values(PREFIJO_DE_MAGIA).some((p) => clave.startsWith(p))
}

export const TORRE = 'Requiere Torre de Alta Hechicería'
export const GREMIO = 'Requiere Gremio de Magos'

// ---------------------------------------------------------------------------
// Habilidades mágicas
// ---------------------------------------------------------------------------
const HABILIDADES: HabilidadMagica[] = [
  {
    clave: 'magia:vidente',
    nombre: 'Vidente',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El mago tiene el poder de la premonición, puede concentrarse en una unidad y saber qué posición va a ocupar en el campo de batalla. El jugador podrá saber el lugar de despliegue de una unidad enemiga elegida por él.',
  },
  {
    clave: 'magia:aura-mental',
    nombre: 'Aura mental',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El mago se rodea con defensas mentales destinadas a proteger a su unidad y a sí mismo de los ataques mágicos enemigos. El hechicero enemigo tendrá +1 a la dificultad de todos los hechizos que pretenda lanzar contra la unidad en que se encuentre el mago con esta habilidad.',
  },
  {
    clave: 'magia:erudito',
    nombre: 'Erudito',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El hechicero tiene grandes conocimientos sobre la magia en general y es capaz de realizar hechizos sencillos de otras sendas. El mago podrá cambiar cualquier hechizo por un hechizo de nivel 1 de cualquier senda. Deberá elegirlo antes de cualquier batalla.',
  },
  {
    clave: 'magia:autocontrol',
    nombre: 'Autocontrol',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El mago guarda una parte de su energía para evitar ser destruido si el hechizo fracasa. Suma +1 a la tabla de disfunciones mágicas (el resultado mayor siempre es el 6).',
  },
  {
    clave: 'magia:caminar-umbra',
    nombre: 'Caminar en la Umbra',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El hechicero puede traspasar la barrera entre el mundo físico y el mundo de los espíritus. El mago podrá entrar o salir del mundo etéreo al principio de su fase de magia con un resultado de 4+ en 1D6. Una vez dentro del reino espiritual no tendrá la penalización de -1 al lanzar su 2º hechizo. Permanecer en ese estado agota sus fuerzas: al final de cada fase de magia propia en la que se encuentre en el mundo de los espíritus deberá tirar 1D6 y, con un resultado de 1, regresará al mundo físico y sufrirá una herida. No podrá utilizar esta habilidad si tan solo le queda una herida.',
  },
  {
    clave: 'magia:poder-arcano',
    nombre: 'Poder arcano',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El hechicero lanza un hechizo de saber arcano por batalla sin contar como uno de los dos hechizos que puede lanzar en su fase de magia.',
  },
  {
    clave: 'magia:implacable',
    nombre: 'Implacable',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El hechicero tiene un magistral control de la magia que le permite doblegar con extrema facilidad a otros magos de menor rango. Contra hechizos lanzados por magos de menor rango, podrá repetir la tirada de dispersión.',
  },
  {
    clave: 'magia:dominio-elemental',
    nombre: 'Dominio de la magia elemental',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El hechicero es capaz de dominar los elementos con una facilidad asombrosa. El mago que posea esta habilidad tendrá -1 a la dificultad para lanzar cualquier hechizo de nivel 1 o 2 de su senda.',
  },
  {
    clave: 'magia:reunir-energia',
    nombre: 'Reunir energía',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El mago puede reunir energía para lanzar un hechizo. Antes de lanzarlo deberá decir que va a reunir energía, y lo conseguirá con un resultado de 4+. Si lo consigue, resta -2 a la dificultad del hechizo; si no lo consigue, tendrá +1 a la dificultad para lanzar ese hechizo. Solo puede hacerse una vez por turno.',
  },
  {
    clave: 'magia:druida',
    nombre: 'Druida',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El hechicero tiene una afinidad especial con las bestias. Todas las monturas en contacto peana con peana con el hechicero no atacarán ni a él ni a su unidad, y deberán superar un chequeo de liderazgo para poder cargar a la unidad en que se encuentre.',
  },
  {
    clave: 'magia:magia-curativa',
    nombre: 'Magia curativa',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El hechicero es especialista en curación. Al inicio de su fase de magia podrá sanar 1 herida de una miniatura caída en su unidad con 6+. Puede renunciar a tirar hechizos ese turno para utilizar esta habilidad con éxito. No puede aplicarse a personajes.',
  },
  {
    clave: 'magia:defensa-magica',
    nombre: 'Defensa mágica',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El mago es experto en realizar dispersiones y disipar magia. Será capaz de dispersar un hechizo enemigo con un resultado de 4+.',
  },
  {
    clave: 'magia:poder-absoluto',
    nombre: 'Poder absoluto',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El hechicero posee un aura de poder impresionante; los enemigos más terribles se acobardan ante su presencia. El mago tiene -1 a la dificultad de todos los hechizos.',
  },
  {
    clave: 'magia:dominio-arcano',
    nombre: 'Dominio arcano',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El hechicero es especialista en las invocaciones arcanas y tiene -1 a la dificultad de lanzar todos los Saberes Arcanos.',
  },
  {
    clave: 'magia:maestro',
    nombre: 'Maestro',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El hechicero tiene un control absoluto sobre todos los Saberes Arcanos. Puede lanzar todos los hechizos de saberes arcanos dos veces por batalla, en lugar de una sola vez.',
  },
  {
    clave: 'magia:conocimiento-arcano',
    nombre: 'Conocimiento arcano',
    tipo: 'habilidad',
    coste: 25,
    descripcion:
      'El mago tiene altos conocimientos sobre magia, de forma que puede dispersar 2 hechizos por turno en vez de uno.',
  },
  {
    clave: 'magia:aprendiz-de-mago',
    nombre: 'Aprendiz de mago',
    tipo: 'habilidad',
    coste: 25,
    descripcion:
      'El hechicero que adquiera esta habilidad deberá ser Archimago en al menos una de las sendas de magia. Cada Archimago podrá tener únicamente un aprendiz. El aprendiz se considera un hechicero iniciado de nivel 1 y podrá escoger cualquiera de las sendas permitidas por su raza. Además, el aprendiz podrá aprender una de las habilidades de su maestro por la mitad de su coste.',
  },
]

// ---------------------------------------------------------------------------
// Habilidades mágicas avanzadas: cada una pide otra habilidad antes.
// ---------------------------------------------------------------------------
const AVANZADAS: HabilidadMagica[] = [
  {
    clave: 'magia-av:alquimia',
    nombre: 'Alquimia',
    tipo: 'avanzada',
    coste: 15,
    requiere: 'magia:erudito',
    descripcion:
      'El conjurador es experto en elaborar raras pociones con las que mejorar sus habilidades para el combate. Una vez por batalla podrá tomar una poción al inicio de su fase de magia y sumará +1 a su fuerza y a su resistencia. Cada turno, al finalizar su fase de magia, se tira un dado y con un resultado de 1 se anulan los efectos. No puede combinarse con ningún hechizo que mejore los atributos del hechicero.',
  },
  {
    clave: 'magia-av:escudo-de-mana',
    nombre: 'Escudo de maná',
    tipo: 'avanzada',
    coste: 15,
    requiere: 'magia:poder-absoluto',
    descripcion:
      'El hechicero se envuelve en un potente escudo mágico que absorbe los impactos. Absorberá la primera herida sufrida por el hechicero en la batalla antes de desvanecerse.',
  },
  {
    clave: 'magia-av:adivinacion',
    nombre: 'Adivinación',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:vidente',
    descripcion:
      'Cuando ataque, el ejército del que forme parte el hechicero podrá elegir el lugar de despliegue con un resultado de 3+ en 1D6, solo si el escenario es "Batalla Frontal" y siempre que se juegue en terreno llano. Si en una misma batalla dos hechiceros poseen esta habilidad, el ejército defensor podrá escoger la zona de despliegue.',
  },
  {
    clave: 'magia-av:regeneracion',
    nombre: 'Regeneración',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:magia-curativa',
    descripcion:
      'El hechicero puede utilizar sus habilidades curativas para restaurar sus heridas. Solo puede utilizar esta habilidad una sola vez por batalla.',
  },
  {
    clave: 'magia-av:memorizar-hechizo',
    nombre: 'Memorizar hechizo',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:aura-mental',
    descripcion:
      'Si la unidad en la que está el hechicero es el objetivo de un hechizo, el mago podrá memorizarlo e intentar lanzarlo una única vez en turnos posteriores. Solo puede usarse una vez por batalla. No perderá ese hechizo hasta que lo lance con éxito.',
  },
  {
    clave: 'magia-av:concentracion',
    nombre: 'Concentración',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:autocontrol',
    descripcion: 'El mago podrá ignorar la primera disfunción mágica sufrida en la batalla.',
  },
  {
    clave: 'magia-av:viaje-astral',
    nombre: 'Viaje astral',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:caminar-umbra',
    descripcion:
      'Mientras se encuentra en el mundo espiritual, el mago podrá aparecerse a 40 cm. de su posición en el campo de batalla y lanzar hechizos normalmente desde su nueva posición. Al finalizar su fase de magia volverá al lugar donde estuviera inicialmente. Solo puede usarse una vez cada vez que el hechicero entre en el mundo espiritual.',
  },
  {
    clave: 'magia-av:potenciar-hechizo',
    nombre: 'Potenciar hechizo',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:reunir-energia',
    descripcion: 'El hechicero podrá lanzar un hechizo con energía total una vez por batalla.',
  },
  {
    clave: 'magia-av:ojos-de-halcon',
    nombre: 'Ojos de halcón',
    tipo: 'avanzada',
    coste: 20,
    requiere: 'magia:druida',
    descripcion: 'Durante un turno por batalla, el alcance de los conjuros del hechicero será ilimitado.',
  },
  {
    clave: 'magia-av:reflejar-hechizo',
    nombre: 'Reflejar hechizo',
    tipo: 'avanzada',
    coste: 30,
    requiere: 'magia:defensa-magica',
    descripcion:
      'Cuando obtenga un 6 en la tirada para dispersar un hechizo, el hechicero podrá utilizar dicho hechizo a su voluntad, pero esta habilidad se habrá agotado hasta el final de la batalla.',
  },
  {
    clave: 'magia-av:pacto-oscuro',
    nombre: 'Pacto oscuro',
    tipo: 'avanzada',
    coste: 30,
    requiere: 'magia:implacable',
    descripcion:
      'Al inicio de la batalla, el mago podrá cambiar uno de sus hechizos por otro del mismo nivel dentro de su categoría de magia. Deberá tirar un dado: con 4, 5 ó 6 lo cambia con éxito; con 2 ó 3 no podrá cambiarlo; con 1 perderá su hechizo.',
  },
  {
    clave: 'magia-av:disipacion-de-magia',
    nombre: 'Disipación de magia',
    tipo: 'avanzada',
    coste: 30,
    requiere: 'magia:conocimiento-arcano',
    descripcion:
      'En la fase de magia del hechicero, cada hechizo que permanezca activo a 30 cm. del mago será dispersado. Solo puede ser usado una vez por batalla.',
  },
]

// ---------------------------------------------------------------------------
// Saberes arcanos: hechizos adicionales que se compran con experiencia, de una
// sola vez por batalla cada uno.
// ---------------------------------------------------------------------------
const SABERES: HabilidadMagica[] = [
  {
    clave: 'saber:piel-de-piedra',
    nombre: 'Piel de piedra',
    tipo: 'saber',
    coste: 6,
    nivel: 1,
    dificultad: '5+',
    edificio: TORRE,
    descripcion:
      'Puede usarse con miniaturas de tamaño humano. Suma +1 a la resistencia de la miniatura a la que se lance. Alcance 45 cm. No requiere línea de visión. Permanece activo. Puede usarse tanto en combate cuerpo a cuerpo como fuera de él.',
  },
  {
    clave: 'saber:espiritus-del-bosque',
    nombre: 'Espíritus del bosque',
    tipo: 'saber',
    coste: 8,
    nivel: 1,
    dificultad: '5+',
    edificio: TORRE,
    descripcion:
      'El hechicero designa un bosque y puede ver las tropas ocultas en su interior. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:maldicion-de-cedenor',
    nombre: 'Maldición de Cédenor',
    tipo: 'saber',
    coste: 8,
    nivel: 1,
    dificultad: '5+',
    edificio: TORRE,
    descripcion:
      'El mago invoca su poder mágico y ralentiza el avance de una unidad, que no podrá marchar ese turno. Alcance 60 cm. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:llamaradas',
    nombre: 'Llamaradas',
    tipo: 'saber',
    coste: 16,
    nivel: 2,
    dificultad: '6+',
    edificio: TORRE,
    descripcion:
      'El mago extiende la mano y de cada uno de sus dedos emite un proyectil de fuego. Causa 5 impactos de F4. Alcance 60 cm. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:proteccion-magica',
    nombre: 'Protección mágica',
    tipo: 'saber',
    coste: 16,
    nivel: 2,
    dificultad: '6+',
    edificio: TORRE,
    descripcion:
      'Proporciona a la unidad una tirada de salvación especial de 6+. No se puede combinar con ninguna otra, ya sea especial o por armadura. Permanece activo. Puede usarse tanto en combate cuerpo a cuerpo como fuera de él.',
  },
  {
    clave: 'saber:drenar-mana',
    nombre: 'Drenar maná',
    tipo: 'saber',
    coste: 14,
    nivel: 2,
    dificultad: '6+',
    edificio: TORRE,
    descripcion:
      'El hechicero consume el maná de otro mago en juego, que pierde un hechizo, y puede tirar un hechizo adicional ese turno. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:manto-de-sombras',
    nombre: 'Manto de sombras',
    tipo: 'saber',
    coste: 14,
    nivel: 3,
    dificultad: '7+',
    edificio: TORRE,
    descripcion:
      'El hechicero lanza esta invocación a una unidad de proyectiles, que sufrirá una penalización de -2 al impactar cuando dispara. Alcance 75 cm. Permanece activo. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:congelar-agua',
    nombre: 'Congelar agua',
    tipo: 'saber',
    coste: 14,
    nivel: 3,
    dificultad: '7+',
    edificio: TORRE,
    descripcion:
      'El mago puede congelar una sección de río. Se lanza cuando el mago y su unidad estén en contacto con el agua y, si tiene éxito, el hechicero y la unidad moverán adicionalmente para situarse automáticamente en el otro extremo de la sección de río. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:deflagracion',
    nombre: 'Deflagración',
    tipo: 'saber',
    coste: 18,
    nivel: 3,
    dificultad: '7+',
    edificio: TORRE,
    descripcion:
      'El hechicero lanza un rayo mágico que atraviesa a una unidad. Por cada fila que tenga la unidad, ésta sufrirá un impacto de F6, con -1 en fuerza por cada fila. Alcance 60 cm. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:putrefaccion',
    nombre: 'Putrefacción',
    tipo: 'saber',
    coste: 20,
    nivel: 4,
    dificultad: '8+',
    edificio: TORRE,
    descripcion:
      'El mago invoca un viento envenenado que lanza sobre una unidad a 60 cm. o menos. Cada miniatura de la unidad debe tirar un dado y los resultados de 1 serán bajas, sin tiradas de salvación. No afecta a no-muertos. Este hechizo puede usarse únicamente fuera del combate cuerpo a cuerpo.',
  },
  {
    clave: 'saber:invocar-elemental',
    nombre: 'Invocar elemental',
    tipo: 'saber',
    coste: 20,
    nivel: 4,
    dificultad: '8+',
    edificio: TORRE,
    descripcion:
      'El hechicero invoca una criatura elemental a 15 cm. o menos. Permanece activo. Solo fuera del combate cuerpo a cuerpo. La criatura tiene M12, HA3, HP3, F5, R5, H4, I1, A4, L10 y salvación 5+; no puede ser invocada en un combate cuerpo a cuerpo, es criatura grande, inmune al veneno e inmune a desmoralización. Cada vez que sea dispersado, el elemental perderá una herida.',
  },
  {
    clave: 'saber:armaduras-de-takhisis',
    nombre: 'Armaduras de Takhisis',
    tipo: 'saber',
    coste: 30,
    nivel: 4,
    dificultad: '8+',
    edificio: TORRE,
    descripcion:
      'El mago bendice las armaduras de los soldados de la unidad en la que se encuentre: la unidad obtiene +1 a la tirada de salvación por armadura. Permanece activo. Puede usarse tanto en combate cuerpo a cuerpo como fuera de él.',
  },
]

export const CATALOGO_DE_MAGIA: HabilidadMagica[] = [...HABILIDADES, ...AVANZADAS, ...SABERES]

export const MAGIA_POR_CLAVE = new Map(CATALOGO_DE_MAGIA.map((h) => [h.clave, h]))

export function magiaDeTipo(tipo: TipoDeMagia): HabilidadMagica[] {
  return CATALOGO_DE_MAGIA.filter((h) => h.tipo === tipo)
}

// ---------------------------------------------------------------------------
// NIVELES DE SENDA
// ---------------------------------------------------------------------------

/** Cómo se llama cada nivel de magia. */
export const NOMBRE_DEL_NIVEL: Record<number, string> = {
  1: 'Iniciado',
  2: 'Hechicero de batalla',
  3: 'Gran hechicero',
  4: 'Archimago',
}

/** Lo que cuesta de tabla cada nivel, sin recargos. El nivel 1 solo se paga en las sendas NUEVAS. */
export const COSTE_DEL_NIVEL: Record<number, number> = { 1: 30, 2: 30, 3: 40, 4: 50 }

/**
 * EL RECARGO DE LAS SENDAS NUEVAS, acumulativo.
 *
 * "A medida que los hechiceros acumulan más poder deben emplear tiempo en
 * repasar lo que ya conocen": cada senda nueva que se abre encarece los
 * niveles de las siguientes. Es +5 (niveles 1 y 2) o +6 (3 y 4) por senda
 * nueva si es de SU MISMA DISCIPLINA, y +10 / +12 si es de otra.
 *
 * Disciplina = el GRUPO del catálogo (Elementales, Místicas, Oscuras,
 * Manuscritos) de la senda con la que empezó la campaña, que es la primera que
 * aprendió.
 */
const RECARGO = {
  misma: { bajo: 5, alto: 6 },
  otra: { bajo: 10, alto: 12 },
}

export interface CosteDeNivel {
  /** Lo que hay que pagar en total. */
  total: number
  /** Lo que pone la tabla. */
  base: number
  /** Lo que se suma por ser una senda nueva (0 en la senda inicial). */
  recargo: number
}

/**
 * Lo que cuesta SUBIR una senda a `nivel`.
 *
 * `ordenDeSendaNueva` es el puesto de la senda entre las NUEVAS (1 la primera
 * que se abrió después de la inicial, 2 la siguiente...); 0 en la senda
 * inicial, que no lleva recargo. `mismaDisciplina` compara su grupo con el de
 * la senda inicial.
 */
export function costeDeNivel(nivel: number, ordenDeSendaNueva: number, mismaDisciplina: boolean): CosteDeNivel {
  const base = COSTE_DEL_NIVEL[nivel] ?? 0
  const tramo = nivel <= 2 ? 'bajo' : 'alto'
  const porSenda = (mismaDisciplina ? RECARGO.misma : RECARGO.otra)[tramo]
  const recargo = ordenDeSendaNueva > 0 ? porSenda * ordenDeSendaNueva : 0
  return { total: base + recargo, base, recargo }
}

/**
 * EL TOPE DE LAS SENDAS NUEVAS: ninguna puede pasar del nivel de la senda con
 * la que se empezó la campaña. Unos magos buscan el control absoluto de un
 * elemento y otros repartirse entre varios, pero nadie domina una senda
 * aprendida después mejor que la suya.
 */
export function nivelMaximoDeSenda(esInicial: boolean, nivelDeLaInicial: number): number {
  return esInicial ? 4 : Math.min(4, nivelDeLaInicial)
}

// ---------------------------------------------------------------------------
// COSTE DE LAS HABILIDADES MÁGICAS
// ---------------------------------------------------------------------------

/** Cuántas habilidades se compran a precio de tabla antes de que empiece el recargo. */
export const HABILIDADES_SIN_RECARGO = 3

/** Lo que sube el recargo por cada habilidad de más. */
export const RECARGO_POR_HABILIDAD = 5

/**
 * Lo que cuesta la habilidad mágica que hace el número `cuantasTiene + 1`.
 *
 * Las tres primeras van a precio de tabla. A partir de ahí cada una cuesta 5
 * puntos más que la anterior (+5 la cuarta, +10 la quinta...), y cada senda
 * que llegue a ARCHIMAGO regala una habilidad más a precio de tabla.
 *
 * Los saberes arcanos y los pergaminos NO cuentan aquí: el recargo es de la
 * lista de habilidades mágicas, no de todo lo que se compra con experiencia.
 */
export function costeDeHabilidadMagica(base: number, cuantasTiene: number, sendasArchimago: number): number {
  const sinRecargo = HABILIDADES_SIN_RECARGO + sendasArchimago
  const puesto = cuantasTiene + 1
  const pasadas = Math.max(0, puesto - sinRecargo)
  return base + pasadas * RECARGO_POR_HABILIDAD
}

/**
 * Lo que se DEVUELVE al quitar una: el precio de la ÚLTIMA comprada, no el de
 * la siguiente. Mismo criterio que las características sociales (ver
 * habilidadesDeRenombre): devolver el precio de la siguiente regalaba puntos
 * cada vez que algo entraba y salía.
 */
export function devolucionDeHabilidadMagica(base: number, cuantasTiene: number, sendasArchimago: number): number {
  return costeDeHabilidadMagica(base, cuantasTiene - 1, sendasArchimago)
}

/**
 * ¿Se puede comprar ya este saber arcano? Hace falta tener al menos tantos
 * saberes de CADA nivel inferior como los que quedarían de este.
 */
export function faltanSaberesPorDebajo(nivel: number, saberesPorNivel: Record<number, number>): boolean {
  const destino = (saberesPorNivel[nivel] ?? 0) + 1
  for (let inferior = 1; inferior < nivel; inferior++) {
    if ((saberesPorNivel[inferior] ?? 0) < destino) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// PERGAMINOS: hechizos sueltos de nivel 1 o 2 que el mago compra con
// experiencia. Se guardan por el id del hechizo del catálogo, así que lo que
// hace cada uno se lee de la senda a la que pertenece.
// ---------------------------------------------------------------------------
export const COSTE_DEL_PERGAMINO: Record<number, number> = { 1: 1, 2: 2 }

/** El nivel más alto de hechizo que se puede comprar como pergamino. */
export const NIVEL_MAXIMO_DE_PERGAMINO = 2

export function claveDePergamino(spellId: number): string {
  return `${PREFIJO_DE_MAGIA.pergamino}${spellId}`
}

export function spellIdDePergamino(clave: string): number | null {
  if (!clave.startsWith(PREFIJO_DE_MAGIA.pergamino)) return null
  const id = Number(clave.slice(PREFIJO_DE_MAGIA.pergamino.length))
  return Number.isFinite(id) ? id : null
}
