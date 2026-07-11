/** Completed orders below this threshold show the "New Supplier" tag. */
export const NEW_SUPPLIER_ORDER_THRESHOLD = 5;

export const PRODUCT_CATEGORIES = [
  "Groceries",
  "Textiles",
  "Electronics",
  "Agriculture",
  "Construction",
  "FMCG",
  "Hardware",
  "Foodstuffs",
  "Other",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Common Ghana regions for catalog location filter (substring match on supplier location). */
export const LOCATION_FILTERS = [
  "Greater Accra",
  "Ashanti",
  "Central",
  "Western",
  "Eastern",
  "Northern",
  "Volta",
  "Bono",
] as const;

export type LocationFilter = (typeof LOCATION_FILTERS)[number];
