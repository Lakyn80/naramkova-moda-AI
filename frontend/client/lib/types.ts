export interface Product {
  id: number;
  name: string;
  description?: string | null;
  price?: number | null;
  stock?: number | null;
  category_id?: number | null;
  category_name?: string | null;
  category_slug?: string | null;
  image_url?: string | null;
  media?: string[];
  created_at?: string | null;
}

export interface Category {
  id: number;
  name: string;
  description?: string | null;
  slug?: string | null;
  group?: string | null;
  category?: string | null;
  products?: Product[];
}
