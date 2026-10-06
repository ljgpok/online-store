// Starting catalogue for `pnpm db:seed`. Photography is from Unsplash
// (https://unsplash.com/license); every image was checked for visible branding.
import { campaign, unsplash } from "../lib/editorial";
import type { Photo } from "../lib/products";

export type SeedCategory = { slug: string; name: string; image: Photo };

export type SeedProduct = {
  slug: string;
  sku: string;
  name: string;
  colour: string;
  categorySlug: string;
  priceCents: number;
  salePriceCents?: number;
  /** In display order; the first is the product card image. */
  images: Photo[];
  description: string;
  details: string[];
  sizeGuide?: string;
  madeToOrder?: boolean;
  stockDetail?: string;
  /** Sizes offered, in display order. Omit for one-size products. */
  sizes?: string[];
  /** Units in stock for the whole product, across all sizes. */
  stock: number;
};

/** In tile order on the homepage. */
export const seedCategories: SeedCategory[] = [
  {
    slug: "women",
    name: "Women’s ready-to-wear",
    image: unsplash(
      "1485968579580-b6d095142e6e",
      "Woman in a dark plaid coat carrying a studded bag on a city street",
    ),
  },
  {
    slug: "men",
    name: "Men’s ready-to-wear",
    image: unsplash(
      "1617137968427-85924c800a22",
      "Man in a navy suit and brown shoes walking past a glass facade",
    ),
  },
  {
    slug: "bags",
    name: "Bags",
    image: unsplash(
      "1584917865442-de89df76afd3",
      "Structured red leather top-handle bag on a plinth",
    ),
  },
  {
    slug: "shoes",
    name: "Shoes",
    image: unsplash(
      "1520639888713-7851133b1ed0",
      "Hands lacing a pair of tan leather boots",
    ),
  },
  {
    slug: "jewelry",
    name: "Jewelry",
    image: unsplash(
      "1611085583191-a3b181a88401",
      "Fine gold chain with a pearl pendant worn with an open white shirt",
    ),
  },
  {
    slug: "accessories",
    name: "Accessories",
    image: unsplash(
      "1627123424574-724758594e93",
      "Worn brown leather bifold wallet",
    ),
  },
];

/** Listed newest first, the order New arrivals shows them in. */
export const seedProducts: SeedProduct[] = [
  {
    slug: "double-faced-wool-coat",
    sku: "CS-1013",
    name: "Double-faced wool coat",
    colour: "Sky blue",
    categorySlug: "women",
    priceCents: 385000,
    images: [campaign.hero],
    description:
      "A long coat in double-faced wool, with dropped shoulders, deep patch pockets and a self-tie belt. The seams are hand-finished, so there is no lining.",
    details: [
      "100% virgin wool, double-faced",
      "Unlined, with hand-finished seams",
      "Length at centre back: 118 cm",
      "Made in Italy",
      "Dry clean only",
    ],
    sizeGuide: "European sizing. Cut generously to layer over tailoring.",
    madeToOrder: true,
    stockDetail: "Made for you in our Florence workshop and shipped in 4 to 6 weeks.",
    sizes: ["34", "36", "38", "40", "42"],
    stock: 0,
  },
  {
    slug: "check-wool-blazer",
    sku: "CS-1012",
    name: "Check wool blazer",
    colour: "Grey check",
    categorySlug: "women",
    priceCents: 245000,
    images: [
      unsplash(
        "1608234808654-2a8875faa7fd",
        "Woman wearing a long grey check double-breasted blazer over a white shirt",
      ),
    ],
    description:
      "A relaxed double-breasted blazer in Prince of Wales check wool, with peak lapels and a long line that sits below the hip.",
    details: [
      "100% wool, lined in cupro",
      "Double-breasted with horn buttons",
      "Two flap pockets and one chest pocket",
      "Made in Italy",
      "Dry clean only",
    ],
    sizeGuide:
      "Relaxed fit. Take your usual size, or size down for a closer fit.",
    sizes: ["XS", "S", "M", "L"],
    stock: 10,
  },
  {
    slug: "croc-embossed-mini-bag",
    sku: "CS-1011",
    name: "Croc-embossed mini bag",
    colour: "Burgundy",
    categorySlug: "bags",
    priceCents: 165000,
    images: [
      unsplash(
        "1575032617751-6ddec2089882",
        "Burgundy croc-embossed leather mini bag with a gold clasp, held by its strap",
      ),
    ],
    description:
      "A small upright bag in glossy croc-embossed calf leather, with a sculpted gold-tone clasp and a slim shoulder strap.",
    details: [
      "Croc-embossed calf leather with a leather lining",
      "Width 15 cm, height 19 cm, depth 5 cm",
      "Shoulder strap drop: 24 cm",
      "Holds a phone and cards",
      "Made in Italy",
    ],
    stock: 3,
  },
  {
    slug: "gold-chain-bracelet",
    sku: "CS-1010",
    name: "Gold chain bracelet",
    colour: "Gold",
    categorySlug: "jewelry",
    priceCents: 89000,
    images: [
      unsplash(
        "1602173574767-37ac01994b2a",
        "Chunky gold oval-link chain bracelet laid on an open magazine",
      ),
    ],
    description:
      "A chunky oval-link chain bracelet in gold vermeil, closed with a toggle clasp that doubles as a charm.",
    details: [
      "18k gold vermeil on sterling silver",
      "Length: 19 cm",
      "Toggle clasp",
      "Made in Italy",
    ],
    stock: 15,
  },
  {
    slug: "leather-trim-sneaker",
    sku: "CS-1009",
    name: "Leather-trim sneaker",
    colour: "Sand and white",
    categorySlug: "shoes",
    priceCents: 62000,
    images: [
      unsplash(
        "1603808033192-082d6919d3e1",
        "Low-top white leather sneakers with sand suede toe and an orange heel tab",
      ),
    ],
    description:
      "A low-top sneaker in smooth white leather with a sand suede toe, an orange heel tab and a cupsole stitched for comfort.",
    details: [
      "Calf leather and suede upper, leather lining",
      "Stitched rubber cupsole",
      "Made in Portugal",
    ],
    sizeGuide: "EU sizing. True to size.",
    sizes: ["39", "40", "41", "42", "43"],
    stock: 14,
  },
  {
    slug: "fringed-knit-poncho",
    sku: "CS-1008",
    name: "Fringed knit poncho",
    colour: "Ivory",
    categorySlug: "women",
    priceCents: 129000,
    images: [
      unsplash(
        "1434389677669-e08b4cac3105",
        "Ivory open-knit poncho with a fringed hem on a hanger",
      ),
      campaign.knitwear,
    ],
    description:
      "An open-knit poncho in cotton and linen with a V neck and a hand-knotted fringe. Wear it over a shirt in autumn or a slip dress in summer.",
    details: [
      "70% cotton, 30% linen",
      "Open knit with a hand-knotted fringe",
      "Length at centre back: 68 cm",
      "Made in Italy",
      "Hand wash cold and dry flat",
    ],
    sizeGuide: "Relaxed fit. Take your usual size.",
    sizes: ["XS", "S", "M", "L"],
    stock: 12,
  },
  {
    slug: "leather-biker-jacket",
    sku: "CS-1007",
    name: "Leather biker jacket",
    colour: "Black",
    categorySlug: "men",
    priceCents: 420000,
    images: [
      unsplash(
        "1521223890158-f9f7c3d5d504",
        "Black leather biker jacket with silver zips, worn open over a black T-shirt",
      ),
      campaign.menswear,
    ],
    description:
      "A biker jacket in supple lambskin, cut close through the shoulder with an asymmetric zip, snap-down lapels and a belted hem.",
    details: [
      "100% lambskin, lined in cupro",
      "Nickel zips and snaps",
      "Three zip pockets and one inside pocket",
      "Made in Italy",
      "Specialist leather clean only",
    ],
    sizeGuide: "Italian sizing. Slim fit, so size up to layer over knitwear.",
    sizes: ["46", "48", "50", "52", "54"],
    stock: 12,
  },
  {
    slug: "chevron-shoulder-bag",
    sku: "CS-1006",
    name: "Chevron shoulder bag",
    colour: "Blush",
    categorySlug: "bags",
    priceCents: 185000,
    images: [
      unsplash(
        "1566150905458-1bf1fc113f0d",
        "Blush leather shoulder bag with a chevron panel and chain strap",
      ),
    ],
    description:
      "A structured shoulder bag in smooth calf leather with an inlaid chevron panel and a sliding chain strap you can wear long or doubled.",
    details: [
      "Calf leather with a suede lining",
      "Width 22 cm, height 14 cm, depth 6 cm",
      "Chain strap drop: 55 cm, or 30 cm doubled",
      "Holds a phone, cards and keys",
      "Made in Italy",
    ],
    stock: 7,
  },
  {
    slug: "technical-bomber-jacket",
    sku: "CS-1005",
    name: "Technical bomber jacket",
    colour: "Rust",
    categorySlug: "men",
    priceCents: 165000,
    salePriceCents: 115000,
    images: [
      unsplash(
        "1591047139829-d91aecb6caea",
        "Rust bomber jacket with ribbed cuffs held up on a hanger",
      ),
    ],
    description:
      "A lightweight bomber in water-repellent technical twill, with ribbed collar, cuffs and hem, and a utility pocket on the sleeve.",
    details: [
      "100% recycled polyamide, water-repellent finish",
      "Ribbed wool-blend trims",
      "Two slip pockets and one sleeve pocket",
      "Made in Portugal",
      "Machine wash cold",
    ],
    sizeGuide: "Regular fit. Take your usual size.",
    sizes: ["S", "M", "L", "XL"],
    stock: 3,
  },
  {
    slug: "calfskin-derby",
    sku: "CS-1004",
    name: "Calfskin derby",
    colour: "Cognac",
    categorySlug: "shoes",
    priceCents: 98000,
    images: [
      unsplash(
        "1614252235316-8c857d38b5f4",
        "Pair of polished cognac leather derby shoes",
      ),
    ],
    description:
      "A Goodyear-welted derby in hand-polished calfskin, with a perforated vamp and a leather sole that can be resoled.",
    details: [
      "Calfskin upper and leather lining",
      "Goodyear-welted leather sole",
      "Waxed cotton laces",
      "Made in Spain",
    ],
    sizeGuide: "US sizing. True to size.",
    sizes: ["8", "9", "10", "11", "12"],
    stock: 14,
  },
  {
    slug: "round-metal-sunglasses",
    sku: "CS-1003",
    name: "Round metal sunglasses",
    colour: "Gold and green",
    categorySlug: "accessories",
    priceCents: 54000,
    images: [
      unsplash(
        "1511499767150-a48a237f0083",
        "Round gold-frame sunglasses with green lenses on white",
      ),
    ],
    description:
      "Round sunglasses with a fine gold-tone metal frame and green mineral-glass lenses. Supplied with a leather case.",
    details: [
      "Gold-tone titanium frame",
      "Green glass lenses, category 3, 100% UV protection",
      "Lens width 49 mm, bridge 21 mm",
      "Made in Japan",
    ],
    stock: 12,
  },
  {
    slug: "pearl-collar-necklace",
    sku: "CS-1002",
    name: "Pearl collar necklace",
    colour: "White pearl",
    categorySlug: "jewelry",
    priceCents: 230000,
    images: [
      unsplash(
        "1515562141207-7a88fb7ce338",
        "Pearl necklace laid in an open burgundy jewelry box",
      ),
    ],
    description:
      "A single strand of freshwater pearls, hand-knotted on silk and closed with a sterling silver rose clasp set with crystals.",
    details: [
      "Freshwater pearls, 7–8 mm",
      "Hand-knotted on silk thread",
      "Sterling silver rose clasp with pavé crystals",
      "Length: 42 cm",
      "Made in Italy",
    ],
    stock: 0,
  },
  {
    slug: "leather-strap-watch",
    sku: "CS-1001",
    name: "Leather strap watch, 36mm",
    colour: "Taupe",
    categorySlug: "accessories",
    priceCents: 145000,
    images: [
      unsplash(
        "1524592094714-0f0654e20314",
        "Hand holding a watch with a white dial and taupe leather strap",
      ),
    ],
    description:
      "A slim quartz watch with a 36 mm rose-gold-tone case, a white dial with rose-gold baton markers and a taupe calf-leather strap.",
    details: [
      "Rose-gold-tone stainless steel case, 36 mm",
      "Swiss quartz movement",
      "Sapphire crystal, water-resistant to 50 m",
      "Calf-leather strap with a pin buckle",
      "Two-year warranty",
    ],
    stock: 2,
  },
];
