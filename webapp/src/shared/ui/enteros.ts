// ============================================================================
// NADA DE DECIMALES EN LOS CAMPOS NUMÉRICOS.
//
// En este programa no hay un solo número que admita una coma: los puntos, los
// costes, los atributos, la experiencia, los tamaños de unidad y los mínimos y
// máximos de composición son todos enteros. Y sin embargo se podían escribir:
// un `<input type="number">` acepta "7,5" y "3.0" tan contento, y de ahí sale
// un ejército que suma 1.874,5 puntos y una ficha con Fuerza 3.5.
//
// POR QUÉ NO BASTA CON `step={1}`. Porque `step` solo marca el campo como
// inválido —y mueve las flechitas de uno en uno—, pero deja escribir el
// decimal y deja que llegue al estado. La validación del navegador solo frena
// un envío de formulario nativo, y aquí no hay ninguno.
//
// SE ATACA POR LOS DOS LADOS:
//   · El TECLADO (`guardaDeEnteros`): la coma, el punto y la notación
//     científica no llegan a escribirse. Es lo que hace que se note bien, sin
//     que el campo "corrija" nada por detrás.
//   · EL VALOR (`limpiaDecimales`): pegar "7,5" con el ratón no pasa por el
//     teclado, así que además se limpia lo que entra. Como el <input> está
//     siempre controlado por el estado de React, basta con dejar el valor
//     limpio ANTES de pasárselo a quien escucha.
//
// LAS MEDIDAS EN CENTÍMETROS SE QUEDAN FUERA, a propósito: una peana de
// 25x25 mm son 2,5 cm, y el decorado de los mapas va por el mismo rasero. Ahí
// el medio punto no es un desliz, es el dato. Por eso esto NO se aplica a mano
// en TaxonomyPage ni en SceneryLibraryModal, que llevan sus <input> pelados.
// ============================================================================
import type { ChangeEvent, KeyboardEvent } from 'react'

/** Lo que separa un entero de lo que no lo es, tal y como se teclea. */
const TECLAS_DE_DECIMAL = new Set(['.', ',', 'e', 'E', '+'])

/** Encadena el guardián de teclado con el `onKeyDown` que ya tuviera el campo. */
export function guardaDeEnteros(
  propio?: (e: KeyboardEvent<HTMLInputElement>) => void,
): (e: KeyboardEvent<HTMLInputElement>) => void {
  return (e) => {
    if (TECLAS_DE_DECIMAL.has(e.key)) {
      e.preventDefault()
      return
    }
    propio?.(e)
  }
}

/**
 * Quita del valor recién escrito todo lo que no sea un dígito o el signo.
 * Se hace sobre el propio evento para que quien escucha lea ya el valor
 * limpio en `e.target.value`, sin tener que enterarse de nada.
 */
export function limpiaDecimales(e: ChangeEvent<HTMLInputElement>): void {
  const limpio = e.target.value.replace(/[^\d-]/g, '')
  if (limpio !== e.target.value) e.target.value = limpio
}
