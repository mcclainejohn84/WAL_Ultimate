-- ===========================================================================
-- MANADA DE BESTIAS (Hombres Bestia) — una unidad de VARIOS PERFILES.
--
-- Gor a 7 puntos y Ungor a 3 en la MISMA unidad, con atributos distintos, más
-- sus dos jefes (Desgarrador y Campeón Ungor). Antes esto había que partirlo
-- en dos unidades sueltas ("MdB Gors" y "MdB Ungors"), que ni es verdad ni
-- cuadra con la composición del ejército: es UNA unidad básica.
--
-- CÓMO SE LANZA (desde webapp/worker):
--   npx wrangler d1 execute wharmy-db --remote --file=../db/manada-de-bestias.sql
--
-- SE PUEDE LANZAR ANTES DE QUE LA APLICACIÓN HAYA MIGRADO. Las dos tablas que
-- necesita se crean aquí mismo si no están. No es una copia descuidada de las
-- migraciones del Worker: es que `wrangler deploy` NO ejecuta migraciones —solo
-- sube el código, las aplica la aplicación al abrirse (ver catalogMaintenance)—
-- y quien desplegaba y lanzaba esto a continuación se encontraba con un
-- "no such table: unit_troop_profiles" que no explicaba nada.
--
-- NI UN SOLO `UNION ALL`, Y ES A PROPÓSITO. La primera versión agrupaba las
-- filas en SELECT encadenados, que es más corto de escribir, D1 lo rechazó con
-- "too many terms in compound SELECT". Una sentencia por fila es más larga pero
-- no depende de ningún límite del motor, y además se lee y se retoca mejor:
-- cada línea dice una cosa.
--
-- ES IDEMPOTENTE: se puede lanzar las veces que haga falta sin duplicar nada.
-- Y no hay un solo id escrito a mano — todo se busca por nombre, así que da
-- igual qué número tenga "Hombres Bestia" en tu base.
--
-- TODO ESTO SE TOCA DESPUÉS EN EL EDITOR: este archivo solo ahorra teclear.
-- ===========================================================================

-- --- 0. Las tablas que hace falta que existan -------------------------------
CREATE TABLE IF NOT EXISTS unit_troop_profiles (
  unit_id    INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  cost       INTEGER NOT NULL DEFAULT 0,
  min_size   INTEGER,
  PRIMARY KEY (unit_id, profile_id)
);
CREATE TABLE IF NOT EXISTS unit_equipment_profiles (
  unit_id      INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
  profile_id   INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (unit_id, equipment_id, profile_id)
);

-- --- 1. La unidad -----------------------------------------------------------
-- Coste base 0 a propósito: en una unidad mixta el precio lo pone cada perfil,
-- y sumar además el de la unidad lo contaría dos veces.
-- `WHERE NOT EXISTS` y no `INSERT OR IGNORE`: units.name no es único, así que
-- OR IGNORE no evitaría nada y a la segunda pasada habría dos manadas.
INSERT INTO units (faction_id, category_id, unit_type, name, base_cost, min_size, max_size, default_size, equipment_text, notes, sort_order, active)
SELECT f.id, c.id, 'tropa', 'Manada de Bestias', 0, 10, NULL, 10,
       'Arma de mano. Los Gor llevan además arma de mano adicional.',
       'Tamaño: 5+ Gor y 5+ Ungor (manada mixta), o bien 10+ Gor, o bien 10+ Ungor. Todos los Gor van equipados igual entre sí, y todos los Ungor entre sí. Peana 25x25 (20x20 si la manada es solo de Ungor). Ningún personaje puede unirse a una manada de solo Ungor. Grupo de mando Ungor (si la manada es solo de Ungor): músico +4, portaestandarte +8, campeón +8.',
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE faction_id = f.id), 1
FROM factions f, unit_categories c
WHERE f.name = 'Hombres Bestia' AND c.code = 'BASICA'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'Manada de Bestias' AND faction_id = f.id);

-- --- 2. Los cuatro perfiles de tropa ----------------------------------------

-- Gor: 7 pts por miniatura.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Gor', 'unidad', '12', '4', '3', '3', '4', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp
  JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Gor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Gor' AND profile_kind = 'unidad'),
       0, 7, 5
WHERE (SELECT id FROM units WHERE name = 'Manada de Bestias') IS NOT NULL;

-- Ungor: 3 pts por miniatura.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Ungor', 'unidad', '12', '3', '3', '3', '3', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp
  JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Ungor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Ungor' AND profile_kind = 'unidad'),
       1, 3, 5
WHERE (SELECT id FROM units WHERE name = 'Manada de Bestias') IS NOT NULL;

-- Desgarrador: 0 pts por miniatura.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Desgarrador', 'unidad', '12', '4', '3', '4', '4', '1', '3', '2', '7'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp
  JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Desgarrador' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Desgarrador' AND profile_kind = 'unidad'),
       2, 0, NULL
WHERE (SELECT id FROM units WHERE name = 'Manada de Bestias') IS NOT NULL;

-- Campeón Ungor: 0 pts por miniatura.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Campeón Ungor', 'unidad', '12', '3', '3', '3', '3', '1', '3', '2', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp
  JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Campeón Ungor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Campeón Ungor' AND profile_kind = 'unidad'),
       3, 0, NULL
WHERE (SELECT id FROM units WHERE name = 'Manada de Bestias') IS NOT NULL;

-- Los dos jefes van a 0 puntos por miniatura: lo que cuestan se paga en el
-- grupo de mando (+20 y +8), y cobrarlo en los dos sitios sería cobrarlo dos
-- veces.

-- --- 3. Equipo, y quién puede llevar cada opción ---------------------------
-- Se reutilizan las opciones del catálogo buscándolas por nombre Y COSTE: hay
-- cuatro "Lanza" (a 0, 1, 2 y 3 puntos) y aquí hace falta la de 1. La única
-- que falta es la alabarda GRATIS (el Gor cambia por ella su arma de mano
-- adicional sin pagar), así que se da de alta.
INSERT INTO equipment_options (name, cost, category)
SELECT 'Alabarda', 0, 'arma_cac'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Alabarda' AND cost = 0);

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Lanza' AND cost = 1), 0
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Lanza' AND cost = 1) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Lanza' AND cost = 1),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Ungor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Lanza' AND cost = 1) IS NOT NULL;

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1), 0
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Ungor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Gor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Escudo' AND cost = 1) IS NOT NULL;

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'A.Ligera' AND cost = 1), 0
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'A.Ligera' AND cost = 1) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'A.Ligera' AND cost = 1),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Gor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'A.Ligera' AND cost = 1) IS NOT NULL;

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Arco corto' AND cost = 2), 0
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Arco corto' AND cost = 2) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Arco corto' AND cost = 2),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Ungor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Arco corto' AND cost = 2) IS NOT NULL;

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Alabarda' AND cost = 0), 0
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Alabarda' AND cost = 0) IS NOT NULL;
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'),
       (SELECT MIN(id) FROM equipment_options WHERE name = 'Alabarda' AND cost = 0),
       (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Gor' AND profile_kind = 'unidad')
WHERE (SELECT MIN(id) FROM equipment_options WHERE name = 'Alabarda' AND cost = 0) IS NOT NULL;

-- El ESCUDO sale con dos dueños a propósito: lo pueden llevar los Gor y los
-- Ungor, y cada grupo paga el suyo por sus miniaturas.

-- --- 4. Grupo de mando ------------------------------------------------------
-- Los precios del Gor. La variante Ungor (+4 / +8 / +8) queda escrita en las
-- notas de la unidad: el programa no distingue los dos grupos según cómo esté
-- compuesta la manada, así que si la haces solo de Ungor se ajustan a mano.

INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost, custom_name)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), cr.id, 5, NULL
FROM command_roles cr WHERE cr.code = 'MUSICO';

INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost, custom_name)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), cr.id, 10, NULL
FROM command_roles cr WHERE cr.code = 'PORTAESTANDARTE';

INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost, custom_name)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), cr.id, 20, 'Desgarrador'
FROM command_roles cr WHERE cr.code = 'CAMPEON';


-- --- 5. Reglas especiales ---------------------------------------------------
INSERT INTO special_rules (name, description)
SELECT 'Manada', 'Una Manada de Bestias es una unidad de Gor, Ungor o una mezcla de ambos. Sigue todas las reglas de Hostigadores salvo las excepciones de su entrada. Cada manada mixta tiene al menos 5 Gor y al menos 5 Ungor. Si es de un solo tipo, el mínimo es 10. Todos los Gor van equipados igual entre sí, y todos los Ungor entre sí.'
WHERE NOT EXISTS (SELECT 1 FROM special_rules WHERE name = 'Manada');

INSERT INTO special_rules (name, description)
SELECT 'Indisciplinado', 'Al principio de cada fase propia de Movimientos, toda unidad con esta regla que no esté huyendo lanza 1D6. Con un 1, si tiene enemigos a los que pudiera cargar, debe cargar contra la unidad más cercana (es una carga a todos los efectos). Si no hay ninguna a alcance, Marcha hacia el enemigo más cercano en línea de visión, lo más rápido y directo posible. Con 2+ actúa con normalidad.'
WHERE NOT EXISTS (SELECT 1 FROM special_rules WHERE name = 'Indisciplinado');

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), sr.id
FROM special_rules sr WHERE sr.name = 'Emboscada';

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), sr.id
FROM special_rules sr WHERE sr.name = 'Indisciplinado';

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT (SELECT id FROM units WHERE name = 'Manada de Bestias'), sr.id
FROM special_rules sr WHERE sr.name = 'Manada';
