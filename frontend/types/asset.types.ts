/**
 * Generic asset types shared across all asset types (brand, character, etc.)
 */

export interface Asset {
  asset_id: string;
  filename: string;
  url: string;
  thumbnail_url: string;
  public_url?: string | null; // Public URL from ImgBB (for external APIs)
  public_thumbnail_url?: string | null; // Public thumbnail URL from ImgBB
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  format: 'png' | 'jpg';
  has_alpha: boolean;
  uploaded_at: string;
}

export interface AssetUploadResponse extends Asset {}

export interface AssetStatus {
  asset_id: string;
  status: 'active' | 'deleted';
  url: string;
  thumbnail_url: string;
  public_url?: string | null; // Public URL from ImgBB (for external APIs)
  public_thumbnail_url?: string | null; // Public thumbnail URL from ImgBB
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  has_alpha: boolean;
  metadata: Record<string, any>;
}


