// Editorial content for the homepage: campaign photography. Category tiles come
// from the categories table.
// Photography is from Unsplash (https://unsplash.com/license).
import type { Photo } from "./products";

export function unsplash(id: string, alt: string): Photo {
  return {
    src: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=2000&q=80`,
    alt,
  };
}

export const campaign = {
  hero: unsplash(
    "1539109136881-3be0616acf4b",
    "Woman in a long pale-blue wool coat and white boots on a cathedral square",
  ),
  menswear: unsplash(
    "1520975954732-35dd22299614",
    "Man in a black leather biker jacket crouching on a brick ledge",
  ),
  knitwear: unsplash(
    "1558769132-cb1aea458c5e",
    "Knitwear in oatmeal, camel and chocolate hanging on a rail beside dried grasses",
  ),
};
