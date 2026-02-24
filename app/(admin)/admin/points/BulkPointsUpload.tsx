'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { Card, CardContent } from 'core/components/Card';
import { bulkAdjustPointsFromCsv } from './actions';

interface BulkPointsUploadProps {
  isDevMode: boolean;
}

export function BulkPointsUpload({ isDevMode }: BulkPointsUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('csv', selectedFile);

    const response = await bulkAdjustPointsFromCsv(formData);
    setLoading(false);

    if (response.success && response.summary) {
      setResult(response.summary);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // Refresh the page to show updated transactions
      setTimeout(() => {
        router.refresh();
      }, 500);
    } else {
      setResult({ error: response.error });
    }
  };

  const handleDownloadTemplate = () => {
    const csv = 'email,delta_points,reason\nuser@example.com,100,Monthly bonus\nuser2@example.com,-50,Point correction';
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

  return (
    <Card className="mt-6">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Points Upload</h3>
          <button
            onClick={() => {
              setIsOpen(false);
              setSelectedFile(null);
              setResult(null);
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
            <strong>CSV Format:</strong> email, delta_points, reason (optional)
          </p>
          <ul className="text-sm text-blue-800 space-y-1 ml-4">
            <li>• Use positive numbers to add points, negative to deduct</li>
            <li>• Header row is optional</li>
            <li>• Supports Windows (CRLF), Unix (LF), and Mac (CR) line endings</li>
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
              disabled={loading}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-md cursor-pointer bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed file:mr-4 file:py-2 file:px-4 file:border-0 file:text-sm file:font-medium file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
            />
          </div>

          {selectedFile && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-900 flex-1">{selectedFile.name}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleUpload}
                disabled={loading}
              >
                {loading ? 'Uploading...' : 'Upload & Process'}
              </Button>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-4">
            {result.error ? (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-800 mt-1">{result.error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-md p-4">
                  <p className="text-sm font-medium text-green-900 mb-2">Upload Summary</p>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-green-700">Total Rows</p>
                      <p className="text-2xl font-bold text-green-900">{result.total}</p>
                    </div>
                    <div>
                      <p className="text-green-700">Successful</p>
                      <p className="text-2xl font-bold text-green-900">{result.successful}</p>
                    </div>
                    <div>
                      <p className="text-green-700">Failed</p>
                      <p className="text-2xl font-bold text-red-700">{result.failed}</p>
                    </div>
                  </div>
                </div>

                {result.failures && result.failures.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm font-medium text-yellow-900 mb-2">Failures ({result.failures.length})</p>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="border-b border-yellow-200">
                            <th className="text-left py-1 px-2 text-yellow-900">Row</th>
                            <th className="text-left py-1 px-2 text-yellow-900">Email</th>
                            <th className="text-left py-1 px-2 text-yellow-900">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.failures.map((failure: any, idx: number) => (
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

