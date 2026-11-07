-- ===========================================================================
-- MANADA DE BESTIAS (Hombres Bestia) — una unidad de VARIOS PERFILES.
--
-- Gor a 7 puntos y Ungor a 3 en la MISMA unidad, con atributos distintos, más
-- sus dos jefes (Desgarrador y Campeón Ungor). Hasta ahora esto había que
-- partirlo en dos unidades sueltas ("MdB Gors" y "MdB Ungors"), que ni es
-- verdad ni cuadra con la composición del ejército: es UNA unidad básica.
--
-- CÓMO SE LANZA (desde webapp/worker):
--   npx wrangler d1 execute wharmy-db --remote --file=../db/manada-de-bestias.sql
--
-- ES IDEMPOTENTE: se puede lanzar dos veces sin duplicar nada. Todo va por
-- INSERT OR IGNORE o por búsquedas por nombre, así que no hay un solo id
-- escrito a mano — si en tu base "Hombres Bestia" tiene otro número, da igual.
--
-- Y TODO ESTO SE PUEDE TOCAR DESPUÉS EN EL EDITOR: este archivo solo ahorra
-- teclear. Editor > Unidades > Manada de Bestias tiene los cuatro perfiles con
-- su precio, el equipo con su "¿de qué perfil es?" y el grupo de mando.
-- ===========================================================================

-- --- 1. La unidad -----------------------------------------------------------
-- Coste base 0 a propósito: en una unidad mixta el precio lo pone cada perfil,
-- y sumar además el de la unidad lo contaría dos veces.
INSERT OR IGNORE INTO units (faction_id, category_id, unit_type, name, base_cost, min_size, max_size, default_size, equipment_text, notes, sort_order, active)
SELECT f.id, c.id, 'tropa', 'Manada de Bestias', 0, 10, NULL, 10,
       'Arma de mano. Los Gor llevan además arma de mano adicional.',
       'Tamaño: 5+ Gor y 5+ Ungor (manada mixta), o bien 10+ Gor, o bien 10+ Ungor. Todos los Gor van equipados igual entre sí, y todos los Ungor entre sí. Peana 25x25 (20x20 si la manada es solo de Ungor). Ningún personaje puede unirse a una manada de solo Ungor.',
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE faction_id = f.id), 1
FROM factions f, unit_categories c
WHERE f.name = 'Hombres Bestia' AND c.code = 'BASICA'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'Manada de Bestias' AND faction_id = f.id);

-- --- 2. Los cuatro perfiles de tropa ----------------------------------------
-- M HA HP F R H I A L, tal cual el libro.
INSERT OR IGNORE INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Gor', 'unidad', '12', '4', '3', '3', '4', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Gor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Ungor', 'unidad', '12', '3', '3', '3', '3', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Ungor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Desgarrador', 'unidad', '12', '4', '3', '4', '4', '1', '3', '2', '7'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Desgarrador' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

INSERT OR IGNORE INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Campeón Ungor', 'unidad', '12', '3', '3', '3', '3', '1', '3', '2', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Campeón Ungor' AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'));

-- Se enganchan a la unidad con su precio por miniatura y su mínimo.
-- Los dos jefes van a 0: lo que cuestan se paga en el grupo de mando (+20 y
-- +8), no por miniatura, y cobrarlo en los dos sitios sería cobrarlo dos veces.
INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size)
SELECT u.id, ap.id, v.orden, v.coste, v.minimo
FROM units u
JOIN (SELECT 'Gor' AS perfil, 0 AS orden, 7 AS coste, 5 AS minimo
      UNION ALL SELECT 'Ungor', 1, 3, 5
      UNION ALL SELECT 'Desgarrador', 2, 0, NULL
      UNION ALL SELECT 'Campeón Ungor', 3, 0, NULL) v
JOIN attribute_profiles ap ON ap.name = v.perfil AND ap.profile_kind = 'unidad'
WHERE u.name = 'Manada de Bestias'
  AND ap.id = (SELECT MAX(id) FROM attribute_profiles WHERE name = v.perfil AND profile_kind = 'unidad');

-- --- 3. Equipo, y quién puede llevar cada opción ---------------------------
-- Se reutilizan las opciones que ya hay en el catálogo, buscándolas por nombre
-- Y COSTE: hay varias "Lanza" (a 0, 1, 2 y 3 puntos) y aquí hace falta la de 1.
-- La única que falta es la alabarda GRATIS (el Gor cambia por ella su arma de
-- mano adicional sin pagar), así que se da de alta.
INSERT INTO equipment_options (name, cost, category)
SELECT 'Alabarda', 0, 'arma_cac'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Alabarda' AND cost = 0);

-- Las opciones que ofrece la unidad.
INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, eo.id, 0
FROM units u
JOIN (SELECT 'Lanza' AS equipo, 1 AS coste
      UNION ALL SELECT 'Escudo', 1
      UNION ALL SELECT 'A.Ligera', 1
      UNION ALL SELECT 'Arco corto', 2
      UNION ALL SELECT 'Alabarda', 0) v
JOIN equipment_options eo ON eo.name = v.equipo AND eo.cost = v.coste
WHERE u.name = 'Manada de Bestias'
  AND eo.id = (SELECT MIN(id) FROM equipment_options WHERE name = v.equipo AND cost = v.coste);

-- Y de quién es cada una. El ESCUDO sale dos veces a propósito: lo pueden
-- llevar los Gor y los Ungor, y cada uno paga el suyo.
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, eo.id, (SELECT MAX(id) FROM attribute_profiles WHERE name = v.perfil AND profile_kind = 'unidad')
FROM units u
JOIN (SELECT 'Lanza' AS equipo, 1 AS coste, 'Ungor' AS perfil
      UNION ALL SELECT 'Arco corto', 2, 'Ungor'
      UNION ALL SELECT 'Escudo', 1, 'Ungor'
      UNION ALL SELECT 'Escudo', 1, 'Gor'
      UNION ALL SELECT 'A.Ligera', 1, 'Gor'
      UNION ALL SELECT 'Alabarda', 0, 'Gor') v
JOIN equipment_options eo ON eo.name = v.equipo AND eo.cost = v.coste
WHERE u.name = 'Manada de Bestias'
  AND eo.id = (SELECT MIN(id) FROM equipment_options WHERE name = v.equipo AND cost = v.coste);

-- --- 4. Grupo de mando ------------------------------------------------------
-- Los precios del Gor (+5 / +10 / +20). La variante Ungor (+4 / +8 / +8) se
-- ajusta a mano en el editor si la manada es solo de Ungor: el programa no
-- distingue los dos grupos de mando, y el texto de la unidad lo recuerda.
INSERT OR IGNORE INTO unit_command_options (unit_id, command_role_id, cost, custom_name)
SELECT u.id, cr.id, v.coste, v.nombre
FROM units u
JOIN (SELECT 'MUSICO' AS rol, 5 AS coste, NULL AS nombre
      UNION ALL SELECT 'PORTAESTANDARTE', 10, NULL
      UNION ALL SELECT 'CAMPEON', 20, 'Desgarrador') v
JOIN command_roles cr ON cr.code = v.rol
WHERE u.name = 'Manada de Bestias';

-- --- 5. Reglas especiales ---------------------------------------------------
INSERT OR IGNORE INTO special_rules (name, description)
SELECT 'Manada', 'Una Manada de Bestias es una unidad de Gor, Ungor o una mezcla de ambos. Sigue todas las reglas de Hostigadores salvo las excepciones de su entrada. Cada manada mixta tiene al menos 5 Gor y al menos 5 Ungor; si es de un solo tipo, el mínimo es 10. Todos los Gor van equipados igual entre sí, y todos los Ungor entre sí.'
WHERE NOT EXISTS (SELECT 1 FROM special_rules WHERE name = 'Manada');

INSERT OR IGNORE INTO special_rules (name, description)
SELECT 'Indisciplinado', 'Al principio de cada fase propia de Movimientos, toda unidad con esta regla que no esté huyendo lanza 1D6. Con un 1, si tiene enemigos a los que pudiera cargar, debe cargar contra la unidad más cercana (es una carga a todos los efectos); si no hay ninguna a alcance, Marcha hacia el enemigo más cercano en línea de visión, lo más rápido y directo posible. Con 2+ actúa con normalidad.'
WHERE NOT EXISTS (SELECT 1 FROM special_rules WHERE name = 'Indisciplinado');

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT u.id, sr.id
FROM units u, special_rules sr
WHERE u.name = 'Manada de Bestias' AND sr.name IN ('Emboscada', 'Indisciplinado', 'Manada');
