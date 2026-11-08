-- ===========================================================================
-- MANADA DE BESTIAS (Hombres Bestia) — una UNIDAD COMPUESTA.
--
-- Gor a 7 puntos (la tropa principal) y Ungor a 3 (la secundaria) en la misma
-- unidad, con atributos y equipo propios de cada una.
--
-- CÓMO SE LANZA (desde webapp/worker):
--   npx wrangler d1 execute wharmy-db --remote --file=../db/manada-de-bestias.sql
--
-- ANTES HAY QUE DESPLEGAR EL WORKER Y ABRIR LA APLICACIÓN UNA VEZ. `wrangler
-- deploy` no ejecuta las migraciones —solo sube el código; las aplica la
-- aplicación al abrirse—, y este archivo necesita que unit_troop_profiles
-- tenga ya sus columnas `max_size` y `counts_toward_size`.
--
-- NI UN SOLO `UNION ALL`: D1 rechaza los SELECT compuestos largos con "too
-- many terms in compound SELECT". Una sentencia por fila es más larga pero no
-- depende de ningún límite del motor.
--
-- ES IDEMPOTENTE: se puede lanzar las veces que haga falta sin duplicar nada.
-- Y no hay un solo id escrito a mano: todo se busca por nombre.
--
-- EL EQUIPO SE REUTILIZA SI YA EXISTE con ese nombre en el catálogo, y
-- entonces manda el precio que ya tuviera, no el de aquí. Las últimas
-- consultas del archivo enseñan cómo ha quedado.
--
-- TODO ESTO SE TOCA DESPUÉS EN EL EDITOR: este archivo solo ahorra teclear.
-- ===========================================================================

-- --- 0. Las tablas, por si la base es nueva ---------------------------------
CREATE TABLE IF NOT EXISTS unit_troop_profiles (
  unit_id            INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  profile_id         INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  cost               INTEGER NOT NULL DEFAULT 0,
  min_size           INTEGER,
  max_size           INTEGER,
  counts_toward_size INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (unit_id, profile_id)
);
CREATE TABLE IF NOT EXISTS unit_equipment_profiles (
  unit_id      INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment_options(id) ON DELETE CASCADE,
  profile_id   INTEGER NOT NULL REFERENCES attribute_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (unit_id, equipment_id, profile_id)
);

-- --- 1. La unidad -----------------------------------------------------------
-- El coste base y el tamaño son los de la tropa PRINCIPAL (el Gor): en este
-- modelo la principal es la unidad misma. Los Ungor van aparte, más abajo.
-- `WHERE NOT EXISTS` y no `INSERT OR IGNORE`: units.name no es único, así que
-- OR IGNORE no evitaría nada y a la segunda pasada habría dos manadas.
INSERT INTO units (faction_id, category_id, unit_type, name, base_cost, min_size, max_size, default_size,
                   armor_save, equipment_text, notes, sort_order, active)
SELECT f.id, c.id, 'tropa', 'Manada de Bestias', 7, 5, NULL, 10, 0,
       'Arma de mano. Los Gor llevan además arma de mano adicional.',
       'Manada mixta: 5+ Gor y 5+ Ungor. También puede ser solo de Gor o solo de Ungor. Todos los Gor van equipados igual entre sí, y todos los Ungor entre sí.',
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM units WHERE faction_id = f.id), 1
FROM factions f, unit_categories c
WHERE f.name = 'Hombres Bestia' AND c.code = 'BASICA'
  AND NOT EXISTS (SELECT 1 FROM units WHERE name = 'Manada de Bestias' AND faction_id = f.id);

-- --- 2. Las dos tropas ------------------------------------------------------

-- Gor: la PRINCIPAL. Su ficha es el perfil base de la unidad.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Gor', 'unidad', '12', '4', '3', '3', '4', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_profiles up
  WHERE up.role = 'base'
    AND up.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'
                        AND faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')));

INSERT INTO unit_profiles (unit_id, profile_id, role, sort_order)
SELECT u.id, (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Gor' AND profile_kind = 'unidad'), 'base', 0
FROM units u
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND NOT EXISTS (SELECT 1 FROM unit_profiles WHERE unit_id = u.id AND role = 'base');

-- Ungor: la SECUNDARIA. 3 puntos por miniatura, cuenta para el tamaño.
INSERT INTO attribute_profiles (name, profile_kind, m, ha, hp, f, r, h, i, a, l)
SELECT 'Ungor', 'unidad', '12', '3', '3', '3', '3', '1', '3', '1', '6'
WHERE NOT EXISTS (
  SELECT 1 FROM unit_troop_profiles utp
  JOIN attribute_profiles ap ON ap.id = utp.profile_id
  WHERE ap.name = 'Ungor'
    AND utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'
                         AND faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')));

INSERT OR IGNORE INTO unit_troop_profiles (unit_id, profile_id, sort_order, cost, min_size, max_size, counts_toward_size)
SELECT u.id, (SELECT MAX(id) FROM attribute_profiles WHERE name = 'Ungor' AND profile_kind = 'unidad'), 0, 3, 5, NULL, 1
FROM units u
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia');

-- --- 3. Las opciones de equipo ----------------------------------------------
-- Se crean solo si no hay ya una con ese nombre: si tu catálogo ya tiene
-- "Escudo", se usa el tuyo con el precio que tenga.
INSERT INTO equipment_options (name, cost, category)
SELECT 'Arma de mano adicional', 0, 'arma_cac'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Arma de mano adicional');

INSERT INTO equipment_options (name, cost, category)
SELECT 'Alabarda', 0, 'arma_cac'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Alabarda');

INSERT INTO equipment_options (name, cost, category)
SELECT 'Lanza', 1, 'arma_cac'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Lanza');

INSERT INTO equipment_options (name, cost, category)
SELECT 'Escudo', 1, 'escudo'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Escudo');

-- El escudo que los Gor se llevan cambiando su arma de mano adicional: la
-- misma pieza, pero gratis. Son dos opciones porque el precio vive en la
-- opción, no en la unidad, y el reglamento le pone dos precios distintos.
INSERT INTO equipment_options (name, cost, category)
SELECT 'Escudo (cambiando el arma de mano adicional)', 0, 'escudo'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Escudo (cambiando el arma de mano adicional)');

INSERT INTO equipment_options (name, cost, category)
SELECT 'Armadura ligera', 1, 'armadura'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Armadura ligera');

INSERT INTO equipment_options (name, cost, category)
SELECT 'Arco corto', 2, 'arma_dist'
WHERE NOT EXISTS (SELECT 1 FROM equipment_options WHERE name = 'Arco corto');

-- --- 4. Qué opciones ofrece la unidad ---------------------------------------
INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 1 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Arma de mano adicional';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Alabarda';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Lanza';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Escudo';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Escudo (cambiando el arma de mano adicional)';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Armadura ligera';

INSERT OR IGNORE INTO unit_equipment_options (unit_id, equipment_id, is_default)
SELECT u.id, e.id, 0 FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Arco corto';

-- --- 5. De qué tropa es cada opción -----------------------------------------
-- Gor: arma de mano adicional, alabarda, los dos escudos y la armadura.
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Arma de mano adicional';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Alabarda';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Escudo';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Escudo (cambiando el arma de mano adicional)';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Armadura ligera';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, (SELECT profile_id FROM unit_profiles WHERE unit_id = u.id AND role = 'base')
FROM units u, equipment_options e
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND e.name = 'Arco corto';

-- Ungor: lanza, escudo y arco corto.
INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, utp.profile_id
FROM units u, equipment_options e, unit_troop_profiles utp
JOIN attribute_profiles ap ON ap.id = utp.profile_id
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND utp.unit_id = u.id AND ap.name = 'Ungor' AND e.name = 'Lanza';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, utp.profile_id
FROM units u, equipment_options e, unit_troop_profiles utp
JOIN attribute_profiles ap ON ap.id = utp.profile_id
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND utp.unit_id = u.id AND ap.name = 'Ungor' AND e.name = 'Escudo';

INSERT OR IGNORE INTO unit_equipment_profiles (unit_id, equipment_id, profile_id)
SELECT u.id, e.id, utp.profile_id
FROM units u, equipment_options e, unit_troop_profiles utp
JOIN attribute_profiles ap ON ap.id = utp.profile_id
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND utp.unit_id = u.id AND ap.name = 'Ungor' AND e.name = 'Arco corto';

-- --- 6. Lo que no se puede llevar junto -------------------------------------
-- El CHECK de la tabla exige a < b, así que cada pareja va con MIN y MAX.
INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'La alabarda sustituye al arma de mano adicional'
FROM equipment_options a
WHERE a.name IN ('Alabarda', 'Arma de mano adicional')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'El escudo gratuito sustituye al arma de mano adicional'
FROM equipment_options a
WHERE a.name IN ('Escudo (cambiando el arma de mano adicional)', 'Arma de mano adicional')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'Un escudo o el otro, no los dos'
FROM equipment_options a
WHERE a.name IN ('Escudo (cambiando el arma de mano adicional)', 'Escudo')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'Con alabarda, el escudo cuesta 1 punto'
FROM equipment_options a
WHERE a.name IN ('Escudo (cambiando el arma de mano adicional)', 'Alabarda')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'El arco corto solo si no llevan escudo ni lanza'
FROM equipment_options a
WHERE a.name IN ('Arco corto', 'Escudo')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'El arco corto solo si no llevan escudo ni lanza'
FROM equipment_options a
WHERE a.name IN ('Arco corto', 'Lanza')
HAVING COUNT(*) = 2;

INSERT OR IGNORE INTO equipment_incompatibilities (equipment_id_a, equipment_id_b, reason)
SELECT MIN(a.id), MAX(a.id), 'El arco corto solo si no llevan escudo ni lanza'
FROM equipment_options a
WHERE a.name IN ('Arco corto', 'Escudo (cambiando el arma de mano adicional)')
HAVING COUNT(*) = 2;

-- --- 7. Reglas especiales ---------------------------------------------------
INSERT OR IGNORE INTO special_rules (name, description) VALUES ('Emboscada', '');

INSERT OR IGNORE INTO special_rules (name, description) VALUES (
  'Indisciplinado',
  'Al principio de cada fase propia de Movimientos, todas las unidades con la regla Indisciplinado que no estén huyendo deben lanzar 1D6. Si obtienen un 1 y tienen enemigos a los que pudieran cargar usando las reglas habituales de carga, deben cargar hacia la unidad más cercana. Se considera carga a todos los efectos (reacción a la carga, etc.). Si no hay ninguna unidad a alcance de carga, Marchan hacia el enemigo más cercano en línea de visión lo más rápido y directo posible. Si se obtiene 2+, la unidad actúa de la forma habitual.');

INSERT OR IGNORE INTO special_rules (name, description) VALUES (
  'Manada',
  'Las Manadas de Bestias son una unidad de Gor, Ungor, o una mezcla de ambos, que actúan de una forma ligeramente distinta a la habitual. Generalmente sigue todas las reglas de Hostigadores, salvo por las siguientes excepciones. Cada manada mixta debe ser de al menos 5 Gor y al menos 5 Ungor (pueden ser 10 Gor y 15 Ungor, o 5 Gor y 25 Ungor, o 25 Gor y 5 Ungor...). Todos los Gor de la manada van equipados de la misma forma. Todos los Ungor de la manada van equipados de la misma forma. Por ejemplo, puedes equipar con Escudo y Lanza a los Ungor, y con dos armas de mano a los Gor. Si no eligen escudo ni lanza, pueden elegir Arco Corto (+2/m) como Arma de Proyectiles.');

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT u.id, r.id FROM units u, special_rules r
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND r.name = 'Emboscada';

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT u.id, r.id FROM units u, special_rules r
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND r.name = 'Indisciplinado';

INSERT OR IGNORE INTO unit_special_rules (unit_id, rule_id)
SELECT u.id, r.id FROM units u, special_rules r
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia')
  AND r.name = 'Manada';

-- --- 8. Cómo ha quedado -----------------------------------------------------
SELECT 'unidad' AS que, u.id, u.name, u.base_cost AS coste_gor, u.min_size, u.armor_save
FROM units u
WHERE u.name = 'Manada de Bestias' AND u.faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia');

SELECT 'tropa' AS que, ap.name, utp.cost, utp.min_size, utp.max_size, utp.counts_toward_size
FROM unit_troop_profiles utp
JOIN attribute_profiles ap ON ap.id = utp.profile_id
WHERE utp.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'
                       AND faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia'));

SELECT 'equipo' AS que, e.name, e.cost, ap.name AS tropa
FROM unit_equipment_options ueo
JOIN equipment_options e ON e.id = ueo.equipment_id
LEFT JOIN unit_equipment_profiles uep ON uep.unit_id = ueo.unit_id AND uep.equipment_id = ueo.equipment_id
LEFT JOIN attribute_profiles ap ON ap.id = uep.profile_id
WHERE ueo.unit_id = (SELECT id FROM units WHERE name = 'Manada de Bestias'
                       AND faction_id = (SELECT id FROM factions WHERE name = 'Hombres Bestia'))
ORDER BY e.name, ap.name;
