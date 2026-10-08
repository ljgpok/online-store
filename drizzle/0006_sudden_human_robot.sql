CREATE TABLE "order_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "order_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" text NOT NULL,
	"product_id" integer,
	"product_slug" text NOT NULL,
	"product_name" text NOT NULL,
	"sku" text NOT NULL,
	"colour" text NOT NULL,
	"size" text DEFAULT '' NOT NULL,
	"image_url" text,
	"unit_price_cents" integer NOT NULL,
	"quantity" smallint NOT NULL,
	"line_total_cents" integer NOT NULL,
	"reserved_quantity" smallint NOT NULL,
	CONSTRAINT "order_items_quantity_range" CHECK ("order_items"."quantity" BETWEEN 1 AND 10),
	CONSTRAINT "order_items_reserved_range" CHECK ("order_items"."reserved_quantity" BETWEEN 0 AND "order_items"."quantity"),
	CONSTRAINT "order_items_unit_price_non_negative" CHECK ("order_items"."unit_price_cents" >= 0),
	CONSTRAINT "order_items_line_total_matches" CHECK ("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"email" text NOT NULL,
	"shipping" jsonb,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_payment_status" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"stock_released_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "orders_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" IN ('pending_payment', 'processing', 'paid', 'payment_failed', 'expired', 'cancelled', 'needs_review')),
	CONSTRAINT "orders_stripe_payment_status_valid" CHECK ("orders"."stripe_payment_status" IS NULL OR "orders"."stripe_payment_status" IN ('unpaid', 'paid', 'no_payment_required')),
	CONSTRAINT "orders_currency_lowercase_iso" CHECK ("orders"."currency" ~ '^[a-z]{3}$'),
	CONSTRAINT "orders_amounts_non_negative" CHECK ("orders"."subtotal_cents" >= 0 AND "orders"."total_cents" >= 0),
	CONSTRAINT "orders_paid_has_paid_at" CHECK ("orders"."status" <> 'paid' OR "orders"."paid_at" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"stripe_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_idx" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_created_at_idx" ON "orders" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_pending_expires_at_idx" ON "orders" USING btree ("expires_at") WHERE "orders"."status" = 'pending_payment';