CREATE TABLE "product_images" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "product_images_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "product_images_product_position_unique" UNIQUE("product_id","position")
);
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "images" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "image_alt" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "position" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Hand-edited: existing rows need a SKU before the column can be NOT NULL.
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
UPDATE "products" SET "sku" = 'CS-' || lpad("id"::text, 5, '0') WHERE "sku" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "made_to_order" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock_detail" text;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sku_unique" UNIQUE("sku");--> statement-breakpoint
-- Hand-edited: carry existing gallery images over from products.images (jsonb).
INSERT INTO "product_images" ("product_id", "url", "alt", "position")
SELECT p."id", img."value"->>'src', img."value"->>'alt', (img."ordinality" - 1)::smallint
FROM "products" p
CROSS JOIN LATERAL jsonb_array_elements(p."images") WITH ORDINALITY AS img("value", "ordinality")
WHERE p."images" IS NOT NULL;
