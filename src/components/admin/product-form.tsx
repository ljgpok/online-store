"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useActionState, useRef, useEffect, type FormEvent, type ReactNode } from "react";
import type { AdminProduct } from "@/db/admin-queries";
import { createProduct, updateProduct } from "@/lib/admin/actions/products";
import { PRODUCT_IMAGE_HOSTS, PRODUCT_IMAGE_SLOTS, type ProductField } from "@/lib/admin/validate";

const dollars = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? "" : (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);

const fieldLabels: Record<Exclude<ProductField, "form">, string> = {
  name: "Name",
  slug: "URL name",
  sku: "Style number (SKU)",
  colour: "Colour",
  categoryId: "Category",
  price: "Price",
  salePrice: "Sale price",
  sizes: "Sizes",
  sizeGuide: "Size note",
  stockDetail: "Availability note",
  description: "Description",
  details: "Details and care",
  images: "Images",
  stock: "Starting stock",
};

/**
 * Create or edit a product. The server validates everything again; this form
 * only collects it. Stock is set here only when creating; afterwards it
 * changes on the Stock page.
 */
export function ProductForm({
  product,
  categories,
}: {
  product?: AdminProduct;
  categories: { id: number; name: string }[];
}) {
  const creating = !product;
  const [state, action, pending] = useActionState(creating ? createProduct : updateProduct, null);
  const errors = state?.errors ?? {};
  const summary = useRef<HTMLDivElement>(null);
  const errorList = Object.entries(errors) as [ProductField, string][];

  // Move focus to the error summary so keyboard and screen-reader users hear it.
  useEffect(() => {
    if (state && !state.ok) summary.current?.focus();
  }, [state]);

  // Submit here rather than through `action` when JavaScript runs: React resets
  // a form after an action submission, which would wipe the admin's edits when
  // the server returns an error. `action` stays the fallback without JavaScript.
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => action(formData));
  }

  const describedBy = (field: ProductField, hint = false) =>
    [errors[field] ? `${field}-error` : "", hint ? `${field}-hint` : ""].filter(Boolean).join(" ") || undefined;
  const invalid = (field: ProductField) => (errors[field] ? true : undefined);
  const images = product?.images ?? [];

  return (
    <form action={action} onSubmit={onSubmit} className="flex max-w-3xl flex-col gap-(--space-block)" noValidate>
      {product && <input type="hidden" name="productId" value={product.id} />}

      {errorList.length > 0 && (
        <div ref={summary} tabIndex={-1} role="alert" className="border-l-2 border-alert pl-4 outline-none">
          <p className="text-ui font-medium text-alert">
            {errors.form ?? `Check ${errorList.length === 1 ? "this field" : `these ${errorList.length} fields`}:`}
          </p>
          {!errors.form && (
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {errorList.map(([field, message]) => (
                <li key={field}>
                  <a href={`#${field === "images" ? "imageUrl0" : field}`} className="link">
                    {fieldLabels[field as Exclude<ProductField, "form">]}
                  </a>
                  : {message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section title="Basics">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field field="name" label={fieldLabels.name} error={errors.name}>
            <input id="name" name="name" defaultValue={product?.name} className="input" aria-invalid={invalid("name")} aria-describedby={describedBy("name")} />
          </Field>
          <Field field="colour" label={fieldLabels.colour} error={errors.colour}>
            <input id="colour" name="colour" defaultValue={product?.colour} className="input" aria-invalid={invalid("colour")} aria-describedby={describedBy("colour")} />
          </Field>
          <Field field="slug" label={fieldLabels.slug} error={errors.slug} hint="The shop address: /products/your-url-name. Changing it breaks old links.">
            <input id="slug" name="slug" defaultValue={product?.slug} autoCapitalize="none" spellCheck={false} className="input" aria-invalid={invalid("slug")} aria-describedby={describedBy("slug", true)} />
          </Field>
          <Field field="sku" label={fieldLabels.sku} error={errors.sku}>
            <input id="sku" name="sku" defaultValue={product?.sku} autoCapitalize="characters" spellCheck={false} className="input" aria-invalid={invalid("sku")} aria-describedby={describedBy("sku")} />
          </Field>
          <Field field="categoryId" label={fieldLabels.categoryId} error={errors.categoryId}>
            <select id="categoryId" name="categoryId" defaultValue={product?.categoryId ?? ""} className="input" aria-invalid={invalid("categoryId")} aria-describedby={describedBy("categoryId")}>
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="Price">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field field="price" label={`${fieldLabels.price} (USD)`} error={errors.price}>
            <input id="price" name="price" inputMode="decimal" defaultValue={dollars(product?.priceCents)} className="input" aria-invalid={invalid("price")} aria-describedby={describedBy("price")} />
          </Field>
          <Field field="salePrice" label={`${fieldLabels.salePrice} (USD, optional)`} error={errors.salePrice} hint="Leave empty when it isn’t on sale.">
            <input id="salePrice" name="salePrice" inputMode="decimal" defaultValue={dollars(product?.salePriceCents)} className="input" aria-invalid={invalid("salePrice")} aria-describedby={describedBy("salePrice", true)} />
          </Field>
        </div>
        <p className="text-meta">Orders already placed keep the price they were checked out at.</p>
      </Section>

      <Section title="Sizes and availability">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field field="sizes" label={`${fieldLabels.sizes} (optional)`} error={errors.sizes} hint="In display order, separated by commas: XS, S, M. Leave empty for one size.">
            <input id="sizes" name="sizes" defaultValue={product?.sizes.join(", ")} className="input" aria-invalid={invalid("sizes")} aria-describedby={describedBy("sizes", true)} />
          </Field>
          <Field field="sizeGuide" label={`${fieldLabels.sizeGuide} (optional)`} error={errors.sizeGuide} hint="Shown under the sizes, like “Runs small; take one size up.”">
            <input id="sizeGuide" name="sizeGuide" defaultValue={product?.sizeGuide ?? ""} className="input" aria-invalid={invalid("sizeGuide")} aria-describedby={describedBy("sizeGuide", true)} />
          </Field>
          {creating ? (
            <Field field="stock" label={fieldLabels.stock} error={errors.stock} hint="Shared by all sizes. Change it later on the Stock page.">
              <input id="stock" name="stock" inputMode="numeric" defaultValue="0" className="input" aria-invalid={invalid("stock")} aria-describedby={describedBy("stock", true)} />
            </Field>
          ) : (
            <div>
              <p className="label">Stock</p>
              <p className="text-ui">
                {product.stockQuantity} available.{" "}
                <Link href={`/admin/stock?q=${encodeURIComponent(product.sku)}`} className="link">
                  Change on the Stock page
                </Link>
              </p>
            </div>
          )}
          <Field field="stockDetail" label={`${fieldLabels.stockDetail} (optional)`} error={errors.stockDetail} hint="For made-to-order pieces: the lead time.">
            <input id="stockDetail" name="stockDetail" defaultValue={product?.stockDetail ?? ""} className="input" aria-invalid={invalid("stockDetail")} aria-describedby={describedBy("stockDetail", true)} />
          </Field>
        </div>
        <label className="flex items-start gap-3 text-ui">
          <input type="checkbox" name="madeToOrder" defaultChecked={product?.madeToOrder} className="mt-1 size-4 accent-black" />
          <span>
            Made to order
            <span className="text-meta block">When stock runs out, customers can still order it and it’s made for them.</span>
          </span>
        </label>
      </Section>

      <Section title="Description">
        <Field field="description" label={fieldLabels.description} error={errors.description}>
          <textarea id="description" name="description" rows={5} defaultValue={product?.description} className="input py-3" aria-invalid={invalid("description")} aria-describedby={describedBy("description")} />
        </Field>
        <Field field="details" label={`${fieldLabels.details} (optional)`} error={errors.details} hint="One per line.">
          <textarea id="details" name="details" rows={5} defaultValue={product?.details.join("\n")} className="input py-3" aria-invalid={invalid("details")} aria-describedby={describedBy("details", true)} />
        </Field>
      </Section>

      <Section title="Images">
        <p id="images-hint" className="text-meta -mt-2">
          Links from {PRODUCT_IMAGE_HOSTS.join(" or ")}, in gallery order. The first is the product card photo.
          Describe each one for people who can’t see it. Leave unused rows empty.
        </p>
        {errors.images && (
          <p id="images-error" className="text-sm text-alert">
            {errors.images}
          </p>
        )}
        <ol className="flex flex-col gap-5">
          {Array.from({ length: PRODUCT_IMAGE_SLOTS }, (_, i) => {
            const image = images[i];
            return (
              <li key={i} className="grid gap-3 sm:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                <div className="media-product hidden w-16 sm:block" aria-hidden="true">
                  {image && <Image src={image.url} alt="" fill sizes="4rem" />}
                </div>
                <div>
                  <label htmlFor={`imageUrl${i}`} className="label">
                    Image {i + 1} link{i === 0 ? "" : " (optional)"}
                  </label>
                  <input id={`imageUrl${i}`} name={`imageUrl${i}`} type="url" defaultValue={image?.url} spellCheck={false} className="input" aria-describedby={errors.images ? "images-error images-hint" : "images-hint"} />
                </div>
                <div>
                  <label htmlFor={`imageAlt${i}`} className="label">
                    Image {i + 1} description
                  </label>
                  <input id={`imageAlt${i}`} name={`imageAlt${i}`} defaultValue={image?.alt} className="input" />
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      <div className="flex flex-wrap items-center gap-4 rule-t pt-(--space-block)">
        <button type="submit" className={`btn btn-primary ${pending ? "disabled:cursor-progress disabled:opacity-100" : ""}`} disabled={pending}>
          {pending && (
            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          )}
          {pending ? "Saving…" : creating ? "Create product" : "Save changes"}
        </button>
        <Link href="/admin/products" className="link-quiet text-sm">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-5 rule-t pt-(--space-block)">
      <legend className="text-subtitle float-left mb-1 w-full">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  field,
  label,
  error,
  hint,
  children,
}: {
  field: ProductField;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={field} className="label">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${field}-error`} className="mt-2 text-sm text-alert">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${field}-hint`} className="text-meta mt-2">
          {hint}
        </p>
      )}
    </div>
  );
}
