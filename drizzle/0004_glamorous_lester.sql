ALTER TABLE "products" ADD COLUMN "sizes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock_quantity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_non_negative" CHECK ("products"."stock_quantity" >= 0);--> statement-breakpoint
-- Hand-edited: carry stock over before dropping the table. The quantity is the
-- total across sizes; the size list keeps display order and skips one-size rows.
UPDATE "products" p
SET "stock_quantity" = s."total",
    "sizes" = s."sizes"
FROM (
  SELECT "product_id",
         sum("quantity")::int AS "total",
         coalesce(array_agg("size" ORDER BY "position", "id") FILTER (WHERE "size" IS NOT NULL), '{}'::text[]) AS "sizes"
  FROM "stock"
  GROUP BY "product_id"
) s
WHERE s."product_id" = p."id";--> statement-breakpoint
DROP TABLE "stock" CASCADE;
