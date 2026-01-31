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
  categories?: string[];
  category_group?: string | null;
  variants?: unknown[];
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
