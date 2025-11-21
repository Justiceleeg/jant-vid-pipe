'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { AssetStatus } from '@/types/asset.types';

interface AssetListProps {
  assetType: string;
  title: string;
  emptyMessage: string;
  onAssetDeleted?: (assetId: string) => void;
  refreshTrigger?: number;
  listFn: () => Promise<AssetStatus[]>;
  deleteFn: (assetId: string) => Promise<void>;
  getImageUrl: (assetId: string, thumbnail: boolean) => string;
}

export function AssetList({
  assetType,
  title,
  emptyMessage,
  onAssetDeleted,
  refreshTrigger,
  listFn,
  deleteFn,
  getImageUrl,
}: AssetListProps) {
  const [assets, setAssets] = useState<AssetStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const loadAssets = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const assetList = await listFn();
      setAssets(assetList);
    } catch (err: any) {
      setError(err.message || `Failed to load ${assetType} assets`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [refreshTrigger]);

  const handleDelete = async (assetId: string) => {
    if (!confirm(`Are you sure you want to delete this ${assetType} asset?`)) {
      return;
    }

    setDeletingIds(prev => new Set(prev).add(assetId));
    try {
      await deleteFn(assetId);
      setAssets(prev => prev.filter(asset => asset.asset_id !== assetId));
      onAssetDeleted?.(assetId);
    } catch (err: any) {
      alert(err.message || `Failed to delete ${assetType} asset`);
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(assetId);
        return next;
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading {assetType} assets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadAssets}
            className="mt-4 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
        <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg">
          <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-muted-foreground text-center">
            {emptyMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {assets.map((asset) => {
          const isDeleting = deletingIds.has(asset.asset_id);
          return (
            <div
              key={asset.asset_id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="relative w-full aspect-square mb-4 bg-gray-50 rounded">
                <Image
                  src={getImageUrl(asset.asset_id, true)}
                  alt={asset.metadata.filename || `${assetType} asset`}
                  fill
                  className="object-contain rounded"
                />
              </div>
              <div className="space-y-2">
                <p className="font-medium text-gray-900 truncate" title={asset.metadata.filename}>
                  {asset.metadata.filename}
                </p>
                <p className="text-sm text-gray-600">
                  {asset.dimensions.width} × {asset.dimensions.height}px
                </p>
                <p className="text-sm text-gray-600">
                  {formatFileSize(asset.metadata.file_size)} • {asset.format.toUpperCase()}
                </p>
                <button
                  onClick={() => handleDelete(asset.asset_id)}
                  disabled={isDeleting}
                  className="w-full mt-4 px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


