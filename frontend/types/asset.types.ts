/**
 * Generic asset types shared across all asset types (brand, character, etc.)
 */

export interface Asset {
  asset_id: string;
  filename: string;
  url: string;
  thumbnail_url: string;
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
  dimensions: {
    width: number;
    height: number;
  };
  format: string;
  has_alpha: boolean;
  metadata: Record<string, any>;
}


