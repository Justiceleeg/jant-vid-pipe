'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import type { Asset } from '@/types/asset.types';

interface AssetUploadProps<T extends Asset> {
  assetType: string;
  title: string;
  description: string;
  successTitle: string;
  successMessage: string;
  onUploadComplete?: (assetId: string) => void;
  uploadHook: {
    uploadedAsset: T | null;
    isUploading: boolean;
    uploadProgress: number;
    error: string | null;
    uploadAsset: (file: File) => Promise<T | null>;
    clearError: () => void;
    reset: () => void;
  };
  getImageUrl: (assetId: string, thumbnail: boolean) => string;
}

export function AssetUpload<T extends Asset>({
  assetType,
  title,
  description,
  successTitle,
  successMessage,
  onUploadComplete,
  uploadHook,
  getImageUrl,
}: AssetUploadProps<T>) {
  const {
    uploadedAsset,
    isUploading,
    uploadProgress,
    error,
    uploadAsset,
    clearError,
    reset,
  } = uploadHook;

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFile(file);
    clearError();
    
    // Create preview
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    const result = await uploadAsset(selectedFile);
    if (result) {
      onUploadComplete?.(result.asset_id);
    }
  };

  const handleReset = () => {
    reset();
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Success state
  if (uploadedAsset) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{successTitle}</h2>
          <p className="text-gray-600">{successMessage}</p>
        </div>

        <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-lg mb-6">
          <div className="relative w-32 h-32 flex-shrink-0">
            <Image
              src={getImageUrl(uploadedAsset.asset_id, true)}
              alt={`${assetType} asset thumbnail`}
              fill
              className="object-contain rounded"
            />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 mb-2">{uploadedAsset.filename}</p>
            <p className="text-sm text-gray-600">
              {uploadedAsset.dimensions.width} × {uploadedAsset.dimensions.height} pixels
            </p>
            <p className="text-sm text-gray-600">
              {formatFileSize(uploadedAsset.size)} • {uploadedAsset.format.toUpperCase()}
              {uploadedAsset.has_alpha && ' • Transparent'}
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Upload Another Asset
        </button>
      </div>
    );
  }

  // Upload in progress
  if (isUploading) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Uploading {assetType} Asset...</h2>
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <p className="text-center text-gray-600 mt-2">{Math.round(uploadProgress)}%</p>
        </div>
      </div>
    );
  }

  // File selected but not uploaded
  if (selectedFile && previewUrl) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Review Your {assetType} Asset</h2>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="flex items-center gap-6 p-6 bg-gray-50 rounded-lg mb-6">
          <div className="relative w-32 h-32 flex-shrink-0">
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-contain rounded"
            />
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 mb-2">{selectedFile.name}</p>
            <p className="text-sm text-gray-600">
              {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/')[1].toUpperCase()}
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleUpload}
            className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Upload Asset
          </button>
          <button
            onClick={() => {
              setSelectedFile(null);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
              }
              setPreviewUrl(null);
              clearError();
            }}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Initial state - drop zone
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{title}</h2>
      <p className="text-gray-600 mb-8 text-center">
        {description}
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
        `}
        onClick={() => document.getElementById(`${assetType}-file-input`)?.click()}
      >
        <div className="flex flex-col items-center">
          <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop your {assetType} asset here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports PNG (recommended) or JPG • Max 50MB • Min 512×512
          </p>
        </div>
      </div>

      <input
        id={`${assetType}-file-input`}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFileInput}
        className="hidden"
      />
    </div>
  );
}


