export interface ProductMediaItem {
  id?: number | null;
  filename?: string | null;
  media_type?: string | null;
  url?: string | null;
}

export interface ProductVariantMedia {
  id?: number | null;
  image?: string | null;
  image_url?: string | null;
}

export interface ProductVariant {
  id?: number | null;
  variant_name?: string | null;
  wrist_size?: string | null;
  description?: string | null;
  price_czk?: number | null;
  stock?: number | null;
  image?: string | null;
  image_url?: string | null;
  media?: ProductVariantMedia[];
}

export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  stock?: number | null;
  category_id?: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  wrist_size?: string | null;
  image_url?: string | null;
  media?: string[];
  media_items?: ProductMediaItem[];
  categories?: string[];
  category_group?: string | null;
  variants?: ProductVariant[];
  created_at?: string | null;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
  group?: string | null;
  category?: string | null;
}

export interface VisionResult {
  labels?: string[];
  colors?: string[];
  dominant_colors?: string[];
  dominantColors?: string[];
  objects?: string[];
}

export interface DeepseekResult {
  short_description?: string;
  long_description?: string;
  description?: string;
  text?: string;
}

