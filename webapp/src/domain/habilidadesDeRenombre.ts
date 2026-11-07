// ============================================================================
// EL CATÁLOGO DE HABILIDADES DE LOS PERSONAJES DE RENOMBRE.
//
// Rangos, mejoras de atributo, habilidades y características sociales, con lo
// que cuesta cada una en puntos de experiencia y lo que hace.
//
// POR QUÉ VIVE EN EL CÓDIGO Y NO EN LA BASE DE DATOS. Porque es el reglamento,
// no datos del grupo: no lo edita nadie desde el programa, es el mismo para
// todas las partidas y no cambia salvo que cambie el libro. En una tabla
// obligaría a una migración con 131 filas de texto, a mantenerlo sincronizado
// y a que una base sin migrar dejara la pantalla vacía. Aquí viaja con la
// aplicación y está siempre completo.
//
// LO QUE SÍ VA A LA BASE es qué habilidades tiene CADA personaje: eso sí es
// dato del grupo, y vive en `unit_skills` (ver specialCharacterRepository).
// De ahí que cada entrada tenga una `clave` estable: es lo que se guarda, así
// que renombrar una habilidad aquí no puede cambiarla nunca.
// ============================================================================

export type TipoDeHabilidad = 'rango' | 'atributo' | 'habilidad' | 'social'

export const ETIQUETAS_DE_TIPO: Record<TipoDeHabilidad, string> = {
  rango: 'Rangos',
  atributo: 'Atributos',
  habilidad: 'Habilidades',
  social: 'Características sociales',
}

export interface HabilidadDeRenombre {
  /** Clave estable, la que se guarda en la base. NUNCA se cambia. */
  clave: string
  nombre: string
  tipo: TipoDeHabilidad
  /**
   * Puntos de experiencia que cuesta. `null` en las características sociales,
   * cuyo precio no lo pone la característica sino CUÁNTAS llevas ya (ver
   * `costeDeSocial`): la primera son 8 y las siguientes 12.
   */
  coste: number | null
  descripcion: string | null
}

/**
 * CUÁNTAS CARACTERÍSTICAS SOCIALES puede llegar a tener un personaje. Dos, y no
 * es una recomendación: el reglamento solo pone precio a la primera y a la
 * segunda, así que una tercera no existe y la pantalla no la ofrece.
 */
export const TOPE_DE_SOCIALES = 2

/**
 * Lo que cuesta la SIGUIENTE característica social de un personaje: la primera
 * 8 puntos de experiencia y la segunda 12, que son las dos que hay (ver
 * TOPE_DE_SOCIALES).
 *
 * Sirve también para saber qué DEVOLVER al quitar una: quien llama pasa
 * `cuantasYaTiene - 1` y recupera el precio de la última, no el de la
 * siguiente.
 */
export function costeDeSocial(cuantasYaTiene: number): number {
  return cuantasYaTiene <= 0 ? 8 : 12
}

export const CATALOGO_DE_HABILIDADES: HabilidadDeRenombre[] = [
  // ---- RANGOS ------------------------------------------------------------
  {
    clave: 'rango:campeon-veterano',
    nombre: 'Campeón veterano',
    tipo: 'rango',
    coste: 10,
    descripcion: null,
  },
  {
    clave: 'rango:heroe',
    nombre: 'Héroe',
    tipo: 'rango',
    coste: 30,
    descripcion: null,
  },
  {
    clave: 'rango:comandante',
    nombre: 'Comandante',
    tipo: 'rango',
    coste: 35,
    descripcion: null,
  },
  // ---- ATRIBUTOS ---------------------------------------------------------
  {
    clave: 'atributo:iniciativa',
    nombre: '+1 Iniciativa',
    tipo: 'atributo',
    coste: 7,
    descripcion: null,
  },
  {
    clave: 'atributo:hp',
    nombre: '+1 HP',
    tipo: 'atributo',
    coste: 8,
    descripcion: null,
  },
  {
    clave: 'atributo:ha',
    nombre: '+1 HA',
    tipo: 'atributo',
    coste: 12,
    descripcion: null,
  },
  {
    clave: 'atributo:herida',
    nombre: '+1 Herida*',
    tipo: 'atributo',
    coste: 14,
    descripcion: null,
  },
  {
    clave: 'atributo:resistencia',
    nombre: '+1 Resistencia*',
    tipo: 'atributo',
    coste: 15,
    descripcion: null,
  },
  {
    clave: 'atributo:liderazgo',
    nombre: '+1 Liderazgo',
    tipo: 'atributo',
    coste: 16,
    descripcion: null,
  },
  {
    clave: 'atributo:ataque',
    nombre: '+1 Ataque*',
    tipo: 'atributo',
    coste: 18,
    descripcion: null,
  },
  {
    clave: 'atributo:fuerza',
    nombre: '+1 Fuerza*',
    tipo: 'atributo',
    coste: 30,
    descripcion: null,
  },
  // ---- HABILIDADES -------------------------------------------------------
  {
    clave: 'habilidad:terco',
    nombre: 'Terco',
    tipo: 'habilidad',
    coste: 5,
    descripcion:
      'El personaje posee un carácter agrio y se encoleriza cuando ve flaquear a sus hombres ante la presencia del enemigo. El personaje y la unidad en la que se encuentre pueden repetir los chequeos de psicología fallados.',
  },
  {
    clave: 'habilidad:vigilante',
    nombre: 'Vigilante',
    tipo: 'habilidad',
    coste: 7,
    descripcion:
      'El personaje está siempre alerta vigilando los movimientos del enemigo en sus fronteras para evitar ser cogido desprevenido. El jugador enemigo tiene un +1 a la dificultad para hacer una incursión o para pasar sin ser visto por el territorio en el que se encuentra este personaje.',
  },
  {
    clave: 'habilidad:explorador',
    nombre: 'Explorador',
    tipo: 'habilidad',
    coste: 7,
    descripcion:
      'El personaje y la unidad en la que se encuentra no sufren penalizaciones por moverse en terreno difícil.',
  },
  {
    clave: 'habilidad:viajero',
    nombre: 'Viajero',
    tipo: 'habilidad',
    coste: 7,
    descripcion:
      'El personaje es un solitario e incansable caminante que está acostumbrado a moverse y pasar desapercibido en tierras hostiles. El personaje podrá pasar por territorios enemigos sin ser detectado.',
  },
  {
    clave: 'habilidad:fuerza-bruta',
    nombre: 'Fuerza bruta',
    tipo: 'habilidad',
    coste: 8,
    descripcion:
      'El personaje es conocido entre los suyos por su fuerza. En batalla es capaz de reunir toda su fuerza en un único golpe que resulta demoledor. El personaje efectúa un impacto con +1 a su fuerza, el cual causará 1D3 heridas.',
  },
  {
    clave: 'habilidad:huida',
    nombre: 'Huida',
    tipo: 'habilidad',
    coste: 8,
    descripcion:
      'El personaje es conocido por su prudencia y piensa que una retirada a tiempo puede ser una victoria, por lo que sus tropas tienen mucha experiencia en este tipo de maniobras. Las unidades a 30 cm del personaje, que no estén huyendo desmoralizadas de un combate cuerpo a cuerpo, se reagruparán automáticamente al principio de su turno.',
  },
  {
    clave: 'habilidad:defensor',
    nombre: 'Defensor',
    tipo: 'habilidad',
    coste: 8,
    descripcion:
      'El personaje prefiere defenderse antes que atacar, y él y sus guerreros tienen mucha experiencia en resistir los embates del enemigo por muy terrible que este sea. Cuando su unidad recibe una carga obtiene +1 a su atributo de liderazgo durante ese turno.',
  },
  {
    clave: 'habilidad:disciplina',
    nombre: 'Disciplina',
    tipo: 'habilidad',
    coste: 8,
    descripcion:
      'El personaje es un renombrado general de su ejército. Sus guerreros cumplen sus órdenes fielmente e incluso cuando se ven rodeados luchan manteniendo la formación en todo momento. Cuando la unidad sea envuelta por los flancos, el enemigo no obtendrá el bonificador de +1 por ello. Además, cuando reciba una carga por los flancos el oponente tampoco recibirá ese bonificador durante ese turno.',
  },
  {
    clave: 'habilidad:jinete',
    nombre: 'Jinete',
    tipo: 'habilidad',
    coste: 8,
    descripcion:
      'El personaje tiene una gran fuerza de voluntad y un dominio natural para con las criaturas salvajes. El personaje puede montar una bestia.',
  },
  {
    clave: 'habilidad:nomada',
    nombre: 'Nómada',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje ha sobrevivido siempre en tierras hostiles de fronteras poco definidas y rodeadas de numerosos enemigos, en las que la guerra por el territorio, las venganzas, el pillaje o la simple demostración de fuerza son algo habitual. Está acostumbrado a las pequeñas escaramuzas. El ejército tiene un -1 a la dificultad en la tirada para determinar si es descubierto en una incursión.',
  },
  {
    clave: 'habilidad:montaraz',
    nombre: 'Montaraz',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje suele emplear la rapidez en sus maniobras y es capaz de responder rápidamente frente a los movimientos de las unidades enemigas durante la batalla. El personaje y su unidad obtendrán +2 a su movimiento cuando la unidad marche (pero no cuando cargue); además, la unidad ignora la penalización por mover a través de territorio difícil. Esta regla solo puede aplicarse a unidades ligeras.',
  },
  {
    clave: 'habilidad:fortaleza-de-hierro',
    nombre: 'Fortaleza de hierro',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje goza de una salud y una fortaleza excepcionales. Un personaje que disponga de esta habilidad podrá restar -1 a la tirada de cicatrices de guerra. Además, el personaje no cae enfermo.',
  },
  {
    clave: 'habilidad:furia-asesina',
    nombre: 'Furia asesina',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje entra en combate dominado por una sed de sangre incontrolada. El personaje está sujeto a la regla Furia Asesina.',
  },
  {
    clave: 'habilidad:rencor',
    nombre: 'Rencor',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje siente profunda aversión por el enemigo. El jugador debe elegir un ejército enemigo cuando adquiera esta habilidad: el personaje tendrá +1 al Liderazgo cuando se enfrente a unidades de ese ejército. Si luchan en una batalla como aliados deberán ser ejércitos independientes si el personaje es el general del ejército. Además, si el personaje no es el general, su unidad no podrá beneficiarse del liderazgo ni del estandarte de batalla del aliado. Tampoco deberá efectuar chequeos de pánico cuando huyan o sean aniquiladas unidades aliadas.',
  },
  {
    clave: 'habilidad:guerrero',
    nombre: 'Guerrero',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje es un veterano luchador con gran experiencia en el combate. Cuando el personaje esté equipado con arma de mano y escudo puede decidir golpear a su enemigo con el escudo. Cada turno tira un dado: con 4+, el personaje obtiene un ataque más, pero no podrá beneficiarse de la tirada de salvación que otorga luchar con arma de mano y escudo (aunque no pierde la T.S. por llevar escudo).',
  },
  {
    clave: 'habilidad:embaucador',
    nombre: 'Embaucador',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje es un líder carismático con gran habilidad de palabra que no duda en recurrir al engaño para salvar su vida. La unidad en la que se encuentre el personaje hará todo lo posible por evitar que éste caiga en manos del enemigo. El personaje puede efectuar una tirada adicional de 1D6 para evitar ser capturado. Si obtiene un resultado de 4+ habrá logrado escapar, aunque sólo podrá llevarse la experiencia por sobrevivir a la batalla.',
  },
  {
    clave: 'habilidad:tactico',
    nombre: 'Táctico',
    tipo: 'habilidad',
    coste: 10,
    descripcion:
      'El personaje es un gran conocedor de la guerra en campo abierto y ocupa muchos de sus esfuerzos en disponer a sus hombres en el campo de batalla. Las unidades del ejército que estén al mando del personaje y permanezcan en los refuerzos podrán elegir dos zonas de despliegue en vez de una para salir como refuerzos.',
  },
  {
    clave: 'habilidad:lider',
    nombre: 'Líder',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es un líder carismático con dotes de mando que sabe infundir valor y confianza a sus tropas en momentos de flaqueza; sus palabras en la batalla pueden reforzar la moral de las tropas instándolas a seguir luchando. La unidad en la que se encuentre el personaje puede repetir los chequeos de liderazgo fallados.',
  },
  {
    clave: 'habilidad:superviviente',
    nombre: 'Superviviente',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es un veterano de la guerra en campo abierto, acostumbrado a las campañas militares. Si su unidad huye y es aniquilada, el personaje podrá sumar +1 a su tirada para escapar.',
  },
  {
    clave: 'habilidad:soldado',
    nombre: 'Soldado',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje no lleva adornos ni distinciones de su rango, viste igual que el resto de su unidad y no se distingue de las tropas normales. El personaje podrá usar esta habilidad únicamente si la potencia de unidad de su regimiento es mayor que 5. El enemigo deberá obtener un resultado de 4+ en 1D6 cada turno que quiera atacarle, y sólo puede ser atacado por una miniatura. No puede ser desafiado a menos que así lo quiera el jugador. El personaje no puede llevar ningún arma que modifique su fuerza. Si la unidad con el personaje huye, el jugador enemigo deberá obtener un resultado de 4+ en 1D6 para distinguir al personaje y poder capturarlo, aunque será reconocido si la unidad cuenta con menos de 5 de potencia de unidad.',
  },
  {
    clave: 'habilidad:coraje',
    nombre: 'Coraje',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es capaz de infundir valor en sus guerreros cuando el combate es desesperado. Siempre que la unidad donde se encuentre el personaje pierda el combate, el regimiento realizará una "heroicidad" si obtiene cualquier doble en su chequeo de desmoralización.',
  },
  {
    clave: 'habilidad:carga-salvaje',
    nombre: 'Carga salvaje',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje se deja llevar por la inercia de la carga y choca contra el enemigo golpeando furiosamente a cualquiera que se ponga a su alcance. Cuando el personaje carga, causa 1D3 impactos de F4 a la unidad enemiga. Estos impactos no se cuentan en la resolución del combate. Esta habilidad solo puede ser usada por personajes a pie.',
  },
  {
    clave: 'habilidad:mago-guerrero',
    nombre: 'Mago guerrero',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje posee conocimientos básicos sobre magia y es capaz de lanzar hechizos simples. El personaje puede escoger un hechizo de nivel 1 de una senda de magia cualquiera, y podrá lanzarlo como si de un mago se tratase. Sin embargo, no obtendrá experiencia por ello. El mago guerrero no podrá obtener nuevos niveles de magia ni podrá dispersar hechizos enemigos. Además, no se verá afectado ni por disfunciones ni por energía total.',
  },
  {
    clave: 'habilidad:furia',
    nombre: 'Furia',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es un temible guerrero y atacará con una ferocidad implacable, golpeando a sus enemigos con su escudo, con el mango de su arma o incluso en ocasiones con sus propias manos. El personaje puede repetir las tiradas para herir que haya fallado, pero estas las efectuará con F3 independientemente de la fuerza del personaje.',
  },
  {
    clave: 'habilidad:determinacion-ferrea',
    nombre: 'Determinación férrea',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje insta a sus tropas a luchar aumentando su ferocidad y su ardor en el combate. Cuando la unidad ataque en segundo lugar, las bajas que haya sufrido podrán responder al combate cuerpo a cuerpo, aunque no se contabilizan los enemigos abatidos por sus ataques a la hora de contabilizar el resultado del combate. Esta habilidad tan solo podrá ser usada una vez por combate.',
  },
  {
    clave: 'habilidad:impulsivo',
    nombre: 'Impulsivo',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es capaz de infundir valor a sus hombres y arrastrarlos incluso a los combates más desesperados. El personaje y la unidad en la que se encuentre serán inmunes a desmoralización en el turno en el que hayan cargado.',
  },
  {
    clave: 'habilidad:infundir-miedo',
    nombre: 'Infundir miedo',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje desconfía de sus enemigos y atemoriza a sus hombres convenciéndoles de que si se retiran el enemigo no mostrará piedad alguna. Sus hombres lucharán reacios a retirarse, dominados por el miedo. Si el personaje decide utilizar esta habilidad, la unidad en la que se encuentre efectuará los chequeos de desmoralización con un único dado. Sin embargo, si en un combate cuerpo a cuerpo se hace uso de esta habilidad, el regimiento no perseguirá a la unidad enemiga a la que se enfrenta. Además, la unidad huirá automáticamente si el general del ejército muere, es hecho prisionero o huye del campo de batalla.',
  },
  {
    clave: 'habilidad:mando',
    nombre: 'Mando',
    tipo: 'habilidad',
    coste: 12,
    descripcion:
      'El personaje es un capitán disciplinado que entrena a sus tropas para prepararlas ante cualquier rival. Considera vital el ejercicio del orden entre las filas para poder llevar a cabo maniobras de ataque y defensa. La unidad en la que se encuentre el personaje podrá cambiar el equipo en medio de un combate cuerpo a cuerpo como si utilizara la regla formación defensiva, aunque no haya sido cargada por un nuevo enemigo. Para ello, el regimiento deberá emplear una fase de combate en cambiar las armas, y en ese turno la unidad contará con las desventajas de ambos equipos y ninguna de las ventajas.',
  },
  {
    clave: 'habilidad:presencia-imponente',
    nombre: 'Presencia imponente',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'El personaje tiene un aura que sobresale de la mayoría de los de su raza, viste un atuendo muy ornamentado y lleva las mejores armas. Sus guerreros no pierden de vista sus acciones. El personaje es reconocido en todo momento por el enemigo; si es el general del ejército, aumenta en 15 cm el radio de alcance para efectuar las tiradas con su liderazgo.',
  },
  {
    clave: 'habilidad:retirada-ordenada',
    nombre: 'Retirada ordenada',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'Algunas veces, el personaje y su unidad pueden verse forzados a realizar una retirada ordenada. Los generales más disciplinados entrenan a sus tropas para retirarse de un combate sin perder la formación. La unidad podrá huir de un combate de la forma habitual. Si durante la persecución es alcanzada por la unidad enemiga, no será aniquilada, sino que contará como si esta le hubiera cargado por el frente. Esta habilidad no podrá utilizarse si la unidad está trabada en combate cuerpo a cuerpo por la retaguardia. Solo podrá utilizarse una vez por batalla.',
  },
  {
    clave: 'habilidad:inmune-a-psicologia',
    nombre: 'Inmune a psicología',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'El personaje y sus guerreros permanecen impasibles ante la adversidad. El personaje y la unidad a la que pertenece son Inmunes a psicología.',
  },
  {
    clave: 'habilidad:estratega',
    nombre: 'Estratega',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'El personaje es un hábil general y aprovecha los accidentes del terreno para sorprender al enemigo. El jugador tiene +1 al resultado para empezar a mover. Además, podrá utilizar esta habilidad aunque no le correspondiera por el tipo de batalla: ambos jugadores tiran un dado y comienza el que más saque en la tirada de 1D6; en caso de empate la batalla comenzará con el orden de turno normal.',
  },
  {
    clave: 'habilidad:enardecido',
    nombre: 'Enardecido',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'El personaje posee un gran ímpetu a la hora de arremeter contra sus enemigos y es capaz de azuzar a sus tropas. El personaje y la unidad en la que se encuentre pueden sumar 1D6 cm a su movimiento en el turno en que cargan. Esta habilidad solo puede ser usada por personajes a pie.',
  },
  {
    clave: 'habilidad:obstinado',
    nombre: 'Obstinado',
    tipo: 'habilidad',
    coste: 14,
    descripcion:
      'El personaje es un guerrero que lucha con gran determinación y afronta los combates con sumo orgullo. Siempre que esté en su mano instará a sus hombres a continuar luchando incluso cuando la situación parece desesperada. Si la unidad en la que se encuentra el personaje resulta desmoralizada en combate, ésta podrá continuar luchando si obtiene un resultado de 4+ en 1D6.',
  },
  {
    clave: 'habilidad:odio',
    nombre: 'Odio',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El personaje siente un profundo odio hacia su enemigo. El personaje y la unidad en la que se encuentre odian a un ejército elegido por el jugador.',
  },
  {
    clave: 'habilidad:golpe-certero',
    nombre: 'Golpe certero',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El personaje es un guerrero implacable cuyo manejo de las armas es extraordinario. El guerrero ataca sacando ventaja a su enemigo durante el combate y aprovechando sus puntos débiles. Los ataques causados por el personaje causan -1 a la tirada de salvación.',
  },
  {
    clave: 'habilidad:despiadado',
    nombre: 'Despiadado',
    tipo: 'habilidad',
    coste: 15,
    descripcion:
      'El personaje acostumbra a cubrir sus armas con sustancias venenosas. Los ataques efectuados por el personaje se consideran ataques envenenados.',
  },
  {
    clave: 'habilidad:gran-orador',
    nombre: 'Gran orador',
    tipo: 'habilidad',
    coste: 16,
    descripcion:
      'El personaje domina la oratoria y sabe arengar a sus hombres para animarlos a luchar en el campo de batalla; un discurso antes de entablar combate cuerpo a cuerpo aumenta la ferocidad de sus hombres y su ardor en el combate. Una vez por cada combate cuerpo a cuerpo, la unidad en la que se encuentre el jugador podrá usar esta habilidad. La unidad podrá repetir las tiradas para impactar falladas, aunque las bajas causadas por tiradas repetidas no se tendrán en cuenta a la hora de contabilizar el resultado del combate.',
  },
  {
    clave: 'habilidad:sangre-fria',
    nombre: 'Sangre fría',
    tipo: 'habilidad',
    coste: 16,
    descripcion:
      'El personaje no se deja intimidar fácilmente y es capaz de permanecer sereno cuando sus enemigos lo rodean. El personaje y la unidad en la que se encuentre realizarán los chequeos de psicología y desmoralización con 3D6.',
  },
  {
    clave: 'habilidad:cauteloso',
    nombre: 'Cauteloso',
    tipo: 'habilidad',
    coste: 16,
    descripcion:
      'El personaje es consciente del gran peligro que representan las máquinas de guerra enemigas y entrena a sus hombres para cambiar de formación con rapidez para disminuir los efectos de estas armas. La unidad en la que se encuentre el personaje posee una tirada de salvación especial de 5+ contra los proyectiles de las máquinas de guerra enemigas que anulan tirada de salvación por armadura.',
  },
  {
    clave: 'habilidad:impetuoso',
    nombre: 'Impetuoso',
    tipo: 'habilidad',
    coste: 17,
    descripcion:
      'El personaje se arroja al combate con furia y siempre a la cabeza de sus tropas; no les pide a sus hombres nada que no sea capaz de hacer él, y los soldados al verle luchan con renovado valor y esfuerzo. El personaje debe permanecer siempre en la primera fila, es reconocido por el enemigo y no puede rechazar un desafío. La unidad en la que se encuentre el personaje obtiene un +1 al resultado del combate incluso aunque el personaje caiga "muerto".',
  },
  {
    clave: 'habilidad:golpe-letal',
    nombre: 'Golpe letal',
    tipo: 'habilidad',
    coste: 17,
    descripcion:
      'El personaje es muy diestro en el manejo de las armas y es capaz de segar la vida de sus oponentes con ataques mortíferos. El personaje posee la habilidad Golpe letal.',
  },
  {
    clave: 'habilidad:recio',
    nombre: 'Recio',
    tipo: 'habilidad',
    coste: 18,
    descripcion:
      'El personaje es conocido entre los suyos por su gran sangre fría y dureza. Sólo se rodea de los soldados más aguerridos, que considera dignos de luchar junto a él. Cuando el personaje y la unidad en la que se encuentra pierden un combate, la diferencia a la hora de contabilizar el resultado del combate se dividirá entre dos, redondeando hacia abajo.',
  },
  {
    clave: 'habilidad:bendecido',
    nombre: 'Bendecido',
    tipo: 'habilidad',
    coste: 18,
    descripcion:
      'Los dioses, la fortuna o cualquier otra habilidad dotan al personaje de mucha suerte en la batalla. El personaje posee una tirada de salvación especial de 5+.',
  },
  {
    clave: 'habilidad:iracundo',
    nombre: 'Iracundo',
    tipo: 'habilidad',
    coste: 19,
    descripcion:
      'El personaje es un luchador que se deja llevar fácilmente por la cólera. Cuando los enemigos amenazan con derrotarle es capaz de luchar con una furia salvaje fruto de la ira. Cuando el personaje se vea obligado a efectuar un chequeo de desmoralización en combate cuerpo a cuerpo, podrá repetir todas sus tiradas para herir durante el resto de la batalla.',
  },
  {
    clave: 'habilidad:carga-arrolladora',
    nombre: 'Carga arrolladora',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El personaje ejercita concienzudamente a sus hombres en las maniobras de ataque. Sus hombres cargan con una fuerza salvaje, ejecutando un avance imparable por medio de unas maniobras bien entrenadas. La unidad del personaje obtiene un +1 Ataque de F3 en el turno en que cargan; las bajas de estos ataques no se cuentan en la resolución del combate. Esta habilidad solo puede ser usada por personajes a pie.',
  },
  {
    clave: 'habilidad:ingeniero',
    nombre: 'Ingeniero',
    tipo: 'habilidad',
    coste: 20,
    descripcion:
      'El personaje tiene muchos conocimientos de ingeniería que le otorgan la capacidad de dirigir las máquinas de guerra en la batalla. Un personaje con esta regla permite repetir las tiradas para impactar de un lanzavirotes, y el dado de artillería en el resto de máquinas de guerra. Si sale problemas en la primera tirada no podrá repetirse. Si sale problemas en la segunda tirada se tendrá en cuenta el resultado anterior.',
  },
  {
    clave: 'habilidad:tozudez',
    nombre: 'Tozudez',
    tipo: 'habilidad',
    coste: 28,
    descripcion:
      'El extraordinario valor del personaje inspira confianza y orgullo en sus guerreros, que se mantienen firmes ante la furia del enemigo. El personaje y la unidad a la que pertenece son Tozudos.',
  },
  {
    clave: 'habilidad:inmune-a-desmoralizacion',
    nombre: 'Inmune a desmoralización',
    tipo: 'habilidad',
    coste: 38,
    descripcion:
      'El personaje es un héroe de gran renombre cuyo orgullo le impide retirarse de un combate por desesperado que este sea. Sus guerreros lo siguen sin dudar, seguros de la victoria. El personaje y la unidad a la que pertenece son Inmunes a Desmoralización.',
  },
  {
    clave: 'habilidad:hijo-de-un-dios',
    nombre: 'Hijo de un Dios',
    tipo: 'habilidad',
    coste: 50,
    descripcion:
      'El personaje despierta el asombro de todos allí por donde pasa; su presencia está envuelta por un aura mágica que le caracteriza como una divinidad. Los hombres piensan que su general está llamado a realizar grandes gestas y luchan seguros de que alcanzarán la victoria mientras su general siga con ellos. El ejército es inmune al pánico y tiene un +1 al resultado de todos los combates mientras el general siga con vida en el campo de batalla. Si muere, todo el ejército efectuará un chequeo de pánico con un -1 al Liderazgo. El personaje debe ser un Comandante.',
  },
  // ---- CARACTERÍSTICAS SOCIALES ------------------------------------------
  {
    clave: 'social:familia',
    nombre: 'Familia',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje deberá declarar un territorio en el que residan sus parientes (esposa, progenie...). Cuando el personaje esté defendiendo ese territorio, él y la unidad en la que se encuentre serán Tozudos. Si un jugador enemigo conquista el territorio puede capturar a su familia o decidir matarla; con esto el personaje perderá el bonificador anterior, y él y la unidad en la que se encuentre Odiarán a cualquier ejército en el que se encuentre el personaje enemigo.',
  },
  {
    clave: 'social:adinerado',
    nombre: 'Adinerado',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje posee una fortuna particular importante. El jugador puede elegir un territorio y aumentar los ingresos en 50 monedas. Si el territorio es conquistado en algún momento por otro jugador y decide arrasar las tierras del personaje, este bonificador se perderá y el jugador enemigo ganará 400 monedas.',
  },
  {
    clave: 'social:noble',
    nombre: 'Noble',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje viene de un linaje importante y ha tenido los mejores maestros. El personaje obtiene un bonificador de +1 de Experiencia por batalla.',
  },
  {
    clave: 'social:caballero',
    nombre: 'Caballero',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje y su unidad gozan de honor y disciplina. Una vez por batalla pueden realizar un chequeo de desmoralización sin ningún modificador al combate.',
  },
  {
    clave: 'social:errante',
    nombre: 'Errante',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje conoce muy bien el terreno, no tiene una residencia fija y conoce a la perfección los caminos y senderos. El ejército que mueva con el personaje moverá como un Ejército ligero.',
  },
  {
    clave: 'social:veterano',
    nombre: 'Veterano',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un guerrero curtido en muchas guerras. El personaje puede repetir una tirada de dados fallida por batalla (esta puede ser una tirada de Liderazgo que se efectúe utilizando el liderazgo del personaje).',
  },
  {
    clave: 'social:capitan',
    nombre: 'Capitán',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un hombre de confianza del general y muy importante para los hombres. Las unidades a 30 cm o menos del personaje pueden utilizar su atributo de Liderazgo como si fuera el general del ejército.',
  },
  {
    clave: 'social:patriota',
    nombre: 'Patriota',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es natural de un territorio. Cuando esté defendiendo ese territorio, él y la unidad en la que se encuentre serán Inmunes a psicología y podrán efectuar un chequeo de Liderazgo como si fueran Tozudos.',
  },
  {
    clave: 'social:linaje',
    nombre: 'Linaje',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje procede de una familia importante de gran renombre. Puede realizar sus tiradas de liderazgo utilizando 3D6 en lugar de dos. Sin embargo, si el personaje huye, perderá esta habilidad durante el resto de la batalla.',
  },
  {
    clave: 'social:plebeyo',
    nombre: 'Plebeyo',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje no tiene antepasados nobles y debe esforzarse por distinguirse ante sus iguales realizando proezas con su espada. El personaje recibe +1 de Experiencia por cada estandarte capturado por la unidad en la que se encuentre.',
  },
  {
    clave: 'social:mercenario',
    nombre: 'Mercenario',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es prácticamente un mercenario y está acostumbrado a tratar con las espadas de alquiler. Las unidades mercenarias en su ejército no deberán pagar el gasto anual de mantenimiento.',
  },
  {
    clave: 'social:devoto',
    nombre: 'Devoto',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje está comprometido con las órdenes de sus superiores (otros personajes o los mismos Dioses). El personaje puede elegir repetir un chequeo de Liderazgo por batalla o sumar un +1 a la Experiencia si consigue la victoria al final de la batalla.',
  },
  {
    clave: 'social:patriarca',
    nombre: 'Patriarca',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es muy importante para sus hombres, es un líder nato y darían la vida por él. El jugador puede repetir la tirada de dado para evitar ser capturado por el enemigo. No puede combinarse con las habilidades Soldado ni Superviviente.',
  },
  {
    clave: 'social:barbaro',
    nombre: 'Bárbaro',
    tipo: 'social',
    coste: null,
    descripcion: 'El personaje obtiene +150 monedas por cada territorio que conquista.',
  },
  {
    clave: 'social:cazador',
    nombre: 'Cazador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un incansable perseguidor de sus oponentes. Los personajes enemigos que huyan de la unidad en la que se encuentre tienen un -1 al resultado de su tirada para determinar si escapan.',
  },
  {
    clave: 'social:maestro-ingeniero',
    nombre: 'Maestro ingeniero',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un miembro muy respetado del gremio de ingenieros, que normalmente lleva a otros ingenieros a la batalla para que supervisen la artillería. Las máquinas de guerra del ejército donde se encuentre este personaje podrán adquirir un ingeniero por +15 pts. Éste cuenta como un artillero adicional y permite repetir las tiradas de la tabla de problemas de la pieza de artillería.',
  },
  {
    clave: 'social:temible',
    nombre: 'Temible',
    tipo: 'social',
    coste: null,
    descripcion:
      'La falta de piedad del personaje es conocida tanto por sus amigos como por sus enemigos. Cuando su unidad cargue o sea cargada, el enemigo deberá efectuar un chequeo de miedo.',
  },
  {
    clave: 'social:saqueador',
    nombre: 'Saqueador',
    tipo: 'social',
    coste: null,
    descripcion:
      'La sed de saqueo del personaje es insaciable y tiende a dejar que sus hombres se lleven hasta el último objeto de valor del lugar que conquistan. El ejército del personaje puede saquear hasta un 35% del total de las bajas enemigas.',
  },
  {
    clave: 'social:parentesco',
    nombre: 'Parentesco',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene una relación de parentesco con algún otro personaje guerrero, de forma que si este muere o es capturado guardará un tremendo rencor más allá del odio contra sus asesinos o captores. El personaje podrá repetir sus tiradas para herir contra ese ejército.',
  },
  {
    clave: 'social:matabestias',
    nombre: 'Matabestias',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje obtendrá +1 de experiencia por cada unidad de criaturas de mayor tamaño que un humano que él y su unidad aniquilen. Si una criatura tiene más de 3 heridas obtendrá +2 de experiencia.',
  },
  {
    clave: 'social:mistico',
    nombre: 'Místico',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene algunos conocimientos sobre magia, ya sea elemental, rúnica u oscura, de forma que no puede dispersar hechizos, pero puede deshacer los sortilegios que una vez lanzados por el invocador continúan causando estragos en el campo de batalla. El personaje puede dispersar un hechizo por turno con 5+, de la misma forma que un hechicero.',
  },
  {
    clave: 'social:distinguido',
    nombre: 'Distinguido',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje va siempre acompañado de hombres leales que le sirven cada vez que entra en batalla. Cuando el personaje comience la batalla dentro de una unidad, el jugador que posea este personaje no tendrá que pagar el coste de incluir un grupo de mando en dicha unidad, pues serán los guerreros de confianza del personaje los que ocuparán el lugar del campeón, portaestandarte y músico. Si el personaje decide llevar a cabo una acción de valor insensato, el grupo de mando permanecerá junto a él defendiendo a su señor.',
  },
  {
    clave: 'social:renegado',
    nombre: 'Renegado',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje lidera una facción disidente que no sigue las órdenes del general de la campaña. Sus seguidores ven en él un líder carismático y le apoyan de forma incondicional. La unidad que lidere el personaje costará -1 punto por miniatura (-2 si se trata de caballería). Este personaje no podrá ser el general de la campaña.',
  },
  {
    clave: 'social:montura',
    nombre: 'Montura',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje cuenta con una montura adiestrada para la guerra. La criatura posee un tamaño y una ferocidad sin igual. La montura tendrá HA4, F4 y A2.',
  },
  {
    clave: 'social:fanatico',
    nombre: 'Fanático',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es conocido por su total entrega a una causa que considera superior a su propia vida. El personaje podrá repetir sus tiradas falladas para impactar una vez por batalla.',
  },
  {
    clave: 'social:esclavista',
    nombre: 'Esclavista',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje suele realizar incursiones en territorio enemigo para obtener esclavos, por lo que sus guerreros intentarán capturar a sus enemigos en vez de aniquilarlos. Las unidades bajo el mando de este personaje capturarán a una unidad a la que hayan alcanzado durante una persecución con un resultado de 2+.',
  },
  {
    clave: 'social:mentor',
    nombre: 'Mentor',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es el mentor de otro personaje de su ejército. El aprendiz podrá beneficiarse del liderazgo del mentor. Además, si ambos personajes finalizan la contienda sobre el campo de batalla, el pupilo obtendrá +1 de experiencia. Esta habilidad se aplica mientras el rango del aprendiz sea inferior al de su maestro.',
  },
  {
    clave: 'social:clerigo',
    nombre: 'Clérigo',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje utiliza su fe como escudo para protegerse de los conjuros hostiles. Los hechiceros enemigos tendrán una penalización de +1 a la dificultad cuando intenten lanzar hechizos contra la unidad en la que se encuentre el personaje.',
  },
  {
    clave: 'social:sangre-real',
    nombre: 'Sangre real',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es descendiente de antiguos reyes. El personaje y su unidad serán inmunes al Miedo y al Terror.',
  },
  {
    clave: 'social:egocentrico',
    nombre: 'Egocéntrico',
    tipo: 'social',
    coste: null,
    descripcion:
      'El orgullo del personaje hace que éste se crezca ante los demás personajes. Durante el combate, el personaje posee +1 al liderazgo si en la unidad enemiga hay un personaje.',
  },
  {
    clave: 'social:cobarde',
    nombre: 'Cobarde',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje antepone su propia vida al resultado de la propia batalla. El personaje y la unidad en la que se encuentre huyen +2 cm.',
  },
  {
    clave: 'social:orgulloso',
    nombre: 'Orgulloso',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje no cede ante el miedo a la hora de demostrar su valía frente al enemigo. El personaje y la unidad en la que se encuentre son inmunes a psicología en el turno en el que carguen.',
  },
  {
    clave: 'social:indisciplinado',
    nombre: 'Indisciplinado',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje no se esfuerza por impartir el orden entre sus hombres. La unidad en la que se encuentre tiene una penalización de -1 para cualquier chequeo de Psicología. Sin embargo, la unidad puede repetir la tirada para huir de un combate cuerpo a cuerpo.',
  },
  {
    clave: 'social:corpulento',
    nombre: 'Corpulento',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje se caracteriza por su imponente estatura, lo que le confiere una gran fortaleza. El personaje será capaz de ignorar la última herida sufrida con un resultado de 4+ en 1D6 tras haber visto reducidas sus heridas por debajo de 0.',
  },
  {
    clave: 'social:derrochador',
    nombre: 'Derrochador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje administra de forma pésima la riqueza de sus territorios. El jugador debe restar 10 monedas a la riqueza de un territorio. No obstante, en batalla el personaje sumará 100 puntos adicionales a sus tropas.',
  },
  {
    clave: 'social:sequito',
    nombre: 'Séquito',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje se rodea de un gran número de cortesanos, soldados y siervos. En campaña, el personaje puede reclutar hasta 300 puntos en tropas anuales en el territorio en el que se encuentre.',
  },
  {
    clave: 'social:supersticioso',
    nombre: 'Supersticioso',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje, temeroso de los dioses, consulta los augurios antes de entrar en batalla. Con un resultado de 1, el personaje no acude a la contienda. Sin embargo, si participa en la lucha tendrá una tirada de salvación especial de 3+ frente a la primera herida que sufra.',
  },
  {
    clave: 'social:buen-gobernante',
    nombre: 'Buen gobernante',
    tipo: 'social',
    coste: null,
    descripcion:
      'La gestión del territorio que gobierne el personaje es llevada a cabo con gran solvencia. Dicho territorio no se ve afectado por las penalizaciones de un tratado de comercio.',
  },
  {
    clave: 'social:tirano',
    nombre: 'Tirano',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es conocido por sus ataques de ira cuando ve flaquear a sus soldados; aplica severos correctivos y disciplina a sus tropas. El personaje podrá retirar hasta un máximo de cuatro miniaturas para sumar cada una de estas bajas al resultado del combate. No obstante, esto sólo puede realizarse una vez por combate y nunca podrá utilizarse para obtener la victoria en ese combate.',
  },
  {
    clave: 'social:tirador',
    nombre: 'Tirador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje posee una excelente puntería y utiliza las mejores armas de proyectiles. El personaje es capaz de realizar dos disparos cada turno.',
  },
  {
    clave: 'social:constructor',
    nombre: 'Constructor',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje dedica sus esfuerzos y riquezas al desarrollo de sus ciudades. El jugador puede construir hasta dos poblados en un territorio bajo su dominio.',
  },
  {
    clave: 'social:apreciado',
    nombre: 'Apreciado',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un guerrero admirado por sus tropas, y éstas son reacias a abandonarle en batalla. Una vez por batalla, una unidad que forme parte del ejército del personaje puede superar automáticamente un chequeo de psicología.',
  },
  {
    clave: 'social:bastardo',
    nombre: 'Bastardo',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es visto con recelo por sus tropas, y escuda en su ira su propia desgracia. Recibe +1 de Experiencia por cada unidad que aniquile.',
  },
  {
    clave: 'social:hermano-de-armas',
    nombre: 'Hermano de armas',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene un juramento de lealtad en la batalla con otro personaje. Mientras el otro personaje permanezca a 20 cm o menos durante una batalla, este obtendrá +1 al resultado del combate si resulta derrotado en un combate cuerpo a cuerpo.',
  },
  {
    clave: 'social:sacerdote',
    nombre: 'Sacerdote',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un líder religioso de su propia facción y en batalla es venerado por las tropas. Una vez por batalla, el personaje puede sumar +1 al resultado del combate.',
  },
  {
    clave: 'social:sanguinario',
    nombre: 'Sanguinario',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un despiadado guerrero que disfruta matando a sus enemigos. Cada 5 bajas que cause el personaje obtendrá +1 de experiencia (hasta un máximo de +3). El personaje está obligado a perseguir y a aniquilar a sus enemigos.',
  },
  {
    clave: 'social:piadoso',
    nombre: 'Piadoso',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje se preocupa por la salud de los heridos en combate, ordenando que estos sean atendidos lo antes posible. El personaje podrá repetir la tirada para determinar el número de heridos tras una batalla.',
  },
  {
    clave: 'social:sitiador',
    nombre: 'Sitiador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene gran experiencia en asaltar castillos enemigos. El personaje podrá sumar +1 a la tirada de las tablas de asedio.',
  },
  {
    clave: 'social:precavido',
    nombre: 'Precavido',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es sumamente cauto y prepara a sus tropas para el combate antes de que ataque el enemigo. El personaje podrá impedir que el ejército atacante repita la tirada para determinar la climatología de la batalla.',
  },
  {
    clave: 'social:mercader',
    nombre: 'Mercader',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un conocido comerciante que posee lucrativos tratados de comercio. Éste podrá defender con 500 puntos adicionales las caravanas de uno de sus tratados comerciales.',
  },
  {
    clave: 'social:elegido',
    nombre: 'Elegido',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un guerrero que goza del favor de Dioses extranjeros. El personaje podrá utilizar un objeto dedicado a otra raza.',
  },
  {
    clave: 'social:carismatico',
    nombre: 'Carismático',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene una gran personalidad que hace que muchos quieran unirse a su causa. Cada año el personaje podrá reclutar 1D6 x 100 puntos en tropas básicas en un territorio de otro jugador, siempre y cuando haya miembros de su raza viviendo en dichas tierras.',
  },
  {
    clave: 'social:recaudador',
    nombre: 'Recaudador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje utiliza su influencia para recaudar dinero del populacho en tiempos de necesidad. El personaje podrá reducir un 5, 10, 15 o 20% un pago que la facción a la que pertenece tenga que realizar a otra facción. El porcentaje se determinará lanzando 1D4. Esta característica no podrá volver a utilizarse hasta varios años después, tantos como indique el resultado obtenido en el dado.',
  },
  {
    clave: 'social:espia',
    nombre: 'Espía',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje posee innumerables contactos que le permiten conocer secretos del enemigo. Una vez al año el personaje podrá conocer el paradero de otro personaje que no quiera revelar su posición tras obtener un resultado de 5+ en 1D6.',
  },
  {
    clave: 'social:portaestandarte',
    nombre: 'Portaestandarte',
    tipo: 'social',
    coste: null,
    descripcion:
      'El emblema de su estandarte es reconocido por todos y el personaje lo porta orgulloso en la batalla. La unidad del personaje podrá llevar un estandarte especial que le permitirá repetir sus chequeos de liderazgo y desmoralización como si de un estandarte de batalla se tratara.',
  },
  {
    clave: 'social:navegante',
    nombre: 'Navegante',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un avezado marino que acostumbra a realizar largos viajes por mar. El ejército en el que se encuentre el personaje no perderá un turno al embarcar.',
  },
  {
    clave: 'social:corsario',
    nombre: 'Corsario',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje realiza incursiones y saqueos a lo largo de la costa y conoce cuándo es el mejor momento para atacar. Cada turno, el personaje podrá ver el valor en puntos de las tropas que estén situadas en un territorio costero.',
  },
  {
    clave: 'social:torturador',
    nombre: 'Torturador',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje utiliza la tortura como medio para interrogar a sus prisioneros. El personaje podrá recabar información de un personaje cautivo obteniendo un resultado de 4+ en 1D6.',
  },
  {
    clave: 'social:valeroso',
    nombre: 'Valeroso',
    tipo: 'social',
    coste: null,
    descripcion:
      'La audacia del personaje infunde en sus guerreros un valor más allá de la razón. Una vez por batalla, el personaje y su unidad podrán ignorar los efectos del miedo.',
  },
  {
    clave: 'social:sometido',
    nombre: 'Sometido',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje demuestra sumisión a la voluntad de otro personaje de su facción. El personaje utilizará el liderazgo del personaje al que está sometido mientras este siga con vida sobre el campo de batalla.',
  },
  {
    clave: 'social:artesano',
    nombre: 'Artesano',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un habilidoso artesano capaz de fabricar armas, armaduras o amuletos mágicos de una calidad incuestionable. Los sellos y características mágicas de los objetos fabricados costarán -2 puntos de experiencia. El artesano podrá forjar objetos mágicos utilizando los puntos de experiencia de otro personaje o utilizando los propios, en cuyo caso no pagará su coste monetario.',
  },
  {
    clave: 'social:estoico',
    nombre: 'Estoico',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje no se acobarda al verse superado en número por el enemigo. Mientras el personaje permanezca en primera fila, la unidad enemiga no podrá sumar +1 al resultado del combate como consecuencia de tener una Potencia de unidad superior. Sin embargo, si el personaje huye, perderá esta habilidad durante el resto de la batalla.',
  },
  {
    clave: 'social:curtido',
    nombre: 'Curtido',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje ha sobrevivido a décadas de guerra y cuenta con gran experiencia en batalla. Una vez por batalla, cuando la unidad en la que se encuentra el personaje reciba una carga por el flanco, ésta podrá encararse como si hubiera sido cargada por el frente manteniendo la posición.',
  },
  {
    clave: 'social:salvaje',
    nombre: 'Salvaje',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje y sus guerreros viven de acuerdo a sus antiguas tradiciones, rechazando el orden y la disciplina. La unidad del personaje obtendrá la regla hostigadores. Sin embargo, en combate la unidad cerrará filas obteniendo un máximo de +2 a su modificador por filas.',
  },
  {
    clave: 'social:cruel',
    nombre: 'Cruel',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje disfruta masacrando a sus enemigos vencidos. Éste obtendrá +1 punto de experiencia adicional si decide rematar a los heridos enemigos o ejecutar a los prisioneros capturados tras una batalla. En el caso de acabar con heridos y prisioneros, el personaje obtendrá +2 puntos de experiencia.',
  },
  {
    clave: 'social:general',
    nombre: 'General',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje es un importante líder militar de su facción y sus hombres siguen sus órdenes fielmente. Si el general despliega sobre una colina o posición elevada en la retaguardia del ejército, las unidades a 45 cm o menos podrán utilizar su atributo de liderazgo. Esta ventaja se mantendrá hasta que el personaje abandone su posición.',
  },
  {
    clave: 'social:traicionero',
    nombre: 'Traicionero',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje carece de honor y en combate se vale de sucias tretas para acabar con sus enemigos. Una vez por batalla podrá utilizar esta habilidad antes de efectuar la tirada para impactar. Los ataques del personaje restarán -1 a la tirada de salvación del enemigo.',
  },
  {
    clave: 'social:impasible',
    nombre: 'Impasible',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje tiene un carácter sereno que da confianza a la tropa. La unidad en la que se halle podrá ignorar el primer chequeo de pánico fallado. Si el personaje es el general del ejército, cualquier unidad sobre el campo de batalla podrá ignorar dicho chequeo.',
  },
  {
    clave: 'social:acolito',
    nombre: 'Acólito',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje sirve a su señor por encima de todo, cumpliendo su voluntad lo antes posible. Una vez lanzado el dado para determinar quién mueve primero, éste podrá repetir dicha tirada para intentar mover antes que el resto de su facción. En caso de obtener un resultado menor, prevalecerá el primer resultado.',
  },
  {
    clave: 'social:tenaz',
    nombre: 'Tenaz',
    tipo: 'social',
    coste: null,
    descripcion:
      'El personaje intenta mantener la línea de defensa por encima de todo, instando a sus guerreros a contraatacar. Cuando, tras vencer en un combate, una unidad enemiga decida comenzar a envolver los flancos de la unidad del personaje, ésta evitará ser rodeada durante ese turno. Esta ventaja solo puede utilizarse una vez en cada combate.',
  },
]

/** Búsqueda por clave, que es como vienen de la base. */
export const HABILIDAD_POR_CLAVE = new Map(CATALOGO_DE_HABILIDADES.map((h) => [h.clave, h]))

/** Las de un tipo, en el orden del catálogo (que es el del libro: por coste). */
export function habilidadesDeTipo(tipo: TipoDeHabilidad): HabilidadDeRenombre[] {
  return CATALOGO_DE_HABILIDADES.filter((h) => h.tipo === tipo)
}
