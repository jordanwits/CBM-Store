'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Card, CardContent } from 'core/components/Card';
import { applyBulkPointsCsv, previewBulkPointsCsv, type BulkPreviewRow } from './actions';

interface BulkPointsUploadProps {
  isDevMode: boolean;
}

interface UploadSummary {
  total: number;
  successful: number;
  failed: number;
  failures: Array<{ row: number; email: string; error: string }>;
}

/**
 * A file is checked first and nothing changes until the admin has seen every row and
 * confirmed. That catches a wrong amount or bucket before it lands, and a file that was
 * already applied shows up as the same rows again before it can be applied twice.
 */
export function BulkPointsUpload({ isDevMode }: BulkPointsUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<'preview' | 'apply' | null>(null);
  const [preview, setPreview] = useState<BulkPreviewRow[] | null>(null);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearFile = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(null);
      setSummary(null);
      setError(null);
    }
  };

  const fileForm = () => {
    const formData = new FormData();
    formData.append('csv', selectedFile!);
    return formData;
  };

  const handlePreview = async () => {
    if (!selectedFile) return;

    setLoading('preview');
    setError(null);
    setSummary(null);

    try {
      const response = await previewBulkPointsCsv(fileForm());
      if (response.success && response.rows) {
        setPreview(response.rows);
      } else {
        setError(response.error || 'Failed to read the file');
      }
    } catch {
      setError('Could not reach the server. Nothing was applied.');
    } finally {
      setLoading(null);
    }
  };

  const handleApply = async () => {
    if (!selectedFile) return;

    setLoading('apply');
    setError(null);

    try {
      const response = await applyBulkPointsCsv(fileForm());
      if (response.success && response.summary) {
        setSummary(response.summary);
        clearFile();
        router.refresh();
      } else {
        setError(response.error || 'Failed to apply the file');
      }
    } catch {
      setError('Could not reach the server. Reload the page and check the history before trying again.');
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadTemplate = () => {
    const csv =
      'email,delta_points,reason,point_type\nuser@example.com,100,Monthly bonus,universal\nuser2@example.com,200,Starter points,restricted';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'points_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={isDevMode}
      >
        Bulk Upload CSV
      </Button>
    );
  }

  const readyRows = preview?.filter((row) => !row.error) ?? [];
  const problemRows = preview?.filter((row) => row.error) ?? [];
  const totalFor = (sign: 1 | -1, bucketLabel: string) =>
    readyRows
      .filter((row) => row.bucketLabel === bucketLabel && Math.sign(row.delta ?? 0) === sign)
      .reduce((sum, row) => sum + Math.abs(row.delta ?? 0), 0);
  const bucketLabels = [...new Set(readyRows.map((row) => row.bucketLabel).filter(Boolean))] as string[];

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Points Upload</h3>
          <button
            onClick={() => {
              setIsOpen(false);
              clearFile();
              setSummary(null);
              setError(null);
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-sm text-blue-900 mb-2">
            <strong>CSV Format:</strong> email, delta_points, reason (optional), point_type (optional:{' '}
            universal or restricted, where restricted credits CBM points)
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li>• Use positive numbers to add points, negative to deduct</li>
            <li>
              • For CBM points, use point_type <code className="bg-blue-100 px-1 rounded">restricted</code> (or{' '}
              <code className="bg-blue-100 px-1 rounded">cbm</code>) in column 3 (with default reason) or column 4
              with reason in column 3
            </li>
            <li>• Put a reason that contains commas in quotes</li>
            <li>• Header row is optional</li>
            <li>• Nothing is applied until you have checked the preview</li>
          </ul>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="mt-3"
          >
            Download Template
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              disabled={loading !== null}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
            />
          </div>

          {selectedFile && !preview && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-900 flex-1">{selectedFile.name}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handlePreview}
                disabled={loading !== null}
              >
                {loading === 'preview' ? 'Checking...' : 'Preview'}
              </Button>
            </div>
          )}
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-900">
              <p className="font-medium">
                {readyRows.length} of {preview.length} rows ready to apply
                {problemRows.length > 0 && `; ${problemRows.length} with a problem will be skipped`}
              </p>
              {bucketLabels.map((label) => (
                <p key={label} className="text-gray-700 mt-1">
                  {label}: +{totalFor(1, label).toLocaleString()} added, −{totalFor(-1, label).toLocaleString()}{' '}
                  deducted
                </p>
              ))}
            </div>

            <div className="max-h-80 overflow-auto border border-gray-200 rounded-md">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b border-gray-200 text-left text-gray-900">
                    <th className="py-2 px-2">Row</th>
                    <th className="py-2 px-2">Email</th>
                    <th className="py-2 px-2">Account</th>
                    <th className="py-2 px-2 text-right">Points</th>
                    <th className="py-2 px-2">Bucket</th>
                    <th className="py-2 px-2">Reason</th>
                    <th className="py-2 px-2">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => (
                    <tr key={row.row} className={`border-b border-gray-100 ${row.error ? 'bg-red-50' : ''}`}>
                      <td className="py-1 px-2 text-gray-700">{row.row}</td>
                      <td className="py-1 px-2 text-gray-900">{row.email}</td>
                      <td className="py-1 px-2 text-gray-700">{row.userLabel ?? '—'}</td>
                      <td className="py-1 px-2 text-right text-gray-900">
                        {row.delta === null ? '—' : `${row.delta > 0 ? '+' : ''}${row.delta.toLocaleString()}`}
                      </td>
                      <td className="py-1 px-2 text-gray-700">{row.bucketLabel ?? '—'}</td>
                      <td className="py-1 px-2 text-gray-700">{row.reason}</td>
                      <td className="py-1 px-2 text-red-800">{row.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleApply}
                disabled={loading !== null || readyRows.length === 0}
              >
                {loading === 'apply'
                  ? 'Applying...'
                  : `Apply ${readyRows.length} row${readyRows.length === 1 ? '' : 's'}`}
              </Button>
              <Button variant="outline" size="sm" onClick={clearFile} disabled={loading !== null}>
                Choose another file
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-800 mt-1">{error}</p>
          </div>
        )}

        {summary && (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm font-medium text-green-900 mb-2">Upload Summary</p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-green-700">Total Rows</p>
                  <p className="text-2xl font-bold text-green-900">{summary.total}</p>
                </div>
                <div>
                  <p className="text-green-700">Applied</p>
                  <p className="text-2xl font-bold text-green-900">{summary.successful}</p>
                </div>
                <div>
                  <p className="text-green-700">Skipped</p>
                  <p className="text-2xl font-bold text-red-700">{summary.failed}</p>
                </div>
              </div>
            </div>

            {summary.failures.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm font-medium text-yellow-900 mb-2">Skipped ({summary.failures.length})</p>
                <div className="max-h-40 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-yellow-200">
                        <th className="text-left py-1 px-2 text-yellow-900">Row</th>
                        <th className="text-left py-1 px-2 text-yellow-900">Email</th>
                        <th className="text-left py-1 px-2 text-yellow-900">Problem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.failures.map((failure, idx) => (
                        <tr key={idx} className="border-b border-yellow-100">
                          <td className="py-1 px-2 text-yellow-800">{failure.row}</td>
                          <td className="py-1 px-2 text-yellow-800">{failure.email}</td>
                          <td className="py-1 px-2 text-yellow-800">{failure.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {isDevMode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Configure Supabase to enable bulk upload. See SETUP.txt for instructions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
