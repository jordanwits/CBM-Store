'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Badge } from 'core/components/Badge';
import { ConfirmModal } from 'core/components/ConfirmModal';
import { deleteExport, getExportDownloadUrl } from './actions';

interface ExportRowProps {
  exportRecord: any;
  isDevMode: boolean;
}

export function ExportRow({ exportRecord, isDevMode }: ExportRowProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    
    const result = await getExportDownloadUrl(exportRecord.id);
    
    if (result.url) {
      // Open in new tab to trigger download
      window.open(result.url, '_blank');
    } else {
      alert(result.error || 'Failed to generate download URL');
    }
    
    setIsDownloading(false);
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    
    const result = await deleteExport(exportRecord.id);
    
    if (!result.success) {
      alert(result.error || 'Failed to delete export');
      setIsDeleting(false);
      setShowDeleteModal(false);
    } else {
      // If successful, page will revalidate and row will disappear
      setShowDeleteModal(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTypeVariant = (type: string) => {
    switch (type) {
      case 'orders':
        return 'info';
      case 'order_items':
        return 'warning';
      case 'points_ledger':
        return 'success';
      default:
        return 'default';
    }
  };

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="py-4 pr-4 text-sm font-medium text-gray-900">
          {exportRecord.month}
        </td>
        <td className="py-4 pr-4 text-sm">
          <Badge variant={getTypeVariant(exportRecord.export_type)}>
            {exportRecord.export_type.replace('_', ' ')}
          </Badge>
        </td>
        <td className="py-4 pr-4 text-sm text-gray-600">
          {exportRecord.row_count?.toLocaleString() || '—'}
        </td>
        <td className="py-4 pr-4 text-sm text-gray-600">
          {exportRecord.file_size_bytes ? formatFileSize(exportRecord.file_size_bytes) : '—'}
        </td>
        <td className="py-4 pr-4 text-sm text-gray-600">
          <div>{formatDate(exportRecord.created_at)}</div>
          {exportRecord.profiles?.email && (
            <div className="text-xs text-gray-500 mt-0.5">by {exportRecord.profiles.email}</div>
          )}
        </td>
        <td className="py-4 text-sm">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleDownload}
              disabled={isDevMode || isDownloading || isDeleting}
              variant="outline"
              size="sm"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Downloading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </>
              )}
            </Button>
            
            <Button
              onClick={handleDeleteClick}
              disabled={isDevMode || isDeleting || isDownloading}
              variant="outline"
              size="sm"
            >
              Delete
            </Button>
          </div>
        </td>
      </tr>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Export"
        message={`Are you sure you want to delete the export for ${exportRecord.month} (${exportRecord.export_type.replace('_', ' ')})?\n\nThis will permanently delete the CSV file and cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </>
  );
}

