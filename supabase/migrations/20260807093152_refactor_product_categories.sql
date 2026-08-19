/*
# Refactor product category system

## Summary
Replaces all existing product categories with a fixed canonical set of 8
categories (Cahier, Livre, Fourniture, Papeterie, Informatique, Accessoires,
Agenda, Autre). Existing products are remapped to the matching new category by
name, or to "Autre" when no match exists. A unique constraint on
`categories.name` guarantees no duplicates. "Autre" becomes the fallback for
any product whose category could not be mapped.

## Changes
1. `categories` table
   - Added a UNIQUE constraint on `name` to prevent duplicate categories.
   - All rows deleted, then the 8 canonical categories inserted.
2. `products` table
   - `category_id` updated for every product: remapped to the new category
     with the same name if one exists, otherwise set to the "Autre" category.
   - No columns changed; foreign key to `categories(id)` is preserved.
3. Security
   - No RLS or policy changes. Existing anon/authenticated CRUD policies on
     `categories` remain in place and unchanged.

## Important notes
1. The remapping happens BEFORE the old categories are deleted, so no product
   ever loses its category reference (no dangling NULLs except by design).
2. Products whose old category name matched one of the 8 canonical names keep
   a semantically equivalent category; all others fall back to "Autre".
3. The unique constraint is added after de-duplicating any existing rows so
   the constraint can be created cleanly.
*/

-- 1. De-duplicate any existing categories so the unique constraint can be
--    created. When duplicates exist, keep the one referenced by the most
--    products (or the oldest by created_at) and remap the rest.
DO $$
DECLARE
  dup_name text;
  keep_id uuid;
  other_id uuid;
BEGIN
  FOR dup_name IN
    SELECT name FROM categories GROUP BY name HAVING count(*) > 1
  LOOP
    SELECT id INTO keep_id
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    WHERE c.name = dup_name
    GROUP BY c.id, c.created_at
    ORDER BY count(p.id) DESC, c.created_at ASC
    LIMIT 1;

    FOR other_id IN
      SELECT id FROM categories WHERE name = dup_name AND id <> keep_id
    LOOP
      UPDATE products SET category_id = keep_id WHERE category_id = other_id;
      DELETE FROM categories WHERE id = other_id;
    END LOOP;
  END LOOP;
END $$;

-- 2. Unique constraint on name (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'categories_name_key' AND conrelid = 'categories'::regclass
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
  END IF;
END $$;

-- 3. Insert the 8 canonical categories (idempotent on name).
INSERT INTO categories (name, description, color) VALUES
  ('Cahier', 'Cahiers et carnets', '#3b82f6'),
  ('Livre', 'Livres et manuels', '#10b981'),
  ('Fourniture', 'Fournitures scolaires et de bureau', '#f59e0b'),
  ('Papeterie', 'Articles de papeterie', '#ef4444'),
  ('Informatique', 'Matériel et accessoires informatiques', '#0ea5e9'),
  ('Accessoires', 'Accessoires divers', '#8b5cf6'),
  ('Agenda', 'Agendas et calendriers', '#ec4899'),
  ('Autre', 'Catégorie par défaut', '#6b7280')
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description,
      color = EXCLUDED.color;

-- 4. Remap every product to the new canonical categories.
--    - If the product's current category name matches a canonical name,
--      point it at that canonical category id.
--    - Otherwise (no category, or a non-matching category), point it at
--      "Autre".
UPDATE products p
SET category_id = COALESCE(
  (SELECT c.id FROM categories c
   WHERE c.name = (SELECT oc.name FROM categories oc WHERE oc.id = p.category_id)
   AND c.name IN ('Cahier','Livre','Fourniture','Papeterie','Informatique','Accessoires','Agenda','Autre')
   LIMIT 1),
  (SELECT c.id FROM categories c WHERE c.name = 'Autre' LIMIT 1)
);

-- 5. Delete any categories that are not part of the canonical 8.
DELETE FROM categories
WHERE name NOT IN ('Cahier','Livre','Fourniture','Papeterie','Informatique','Accessoires','Agenda','Autre');
