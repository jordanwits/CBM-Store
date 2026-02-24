import { Card, CardHeader, CardContent } from 'core/components/Card';
import { Badge } from 'core/components/Badge';
import { getExports } from './actions';
import { ExportRow } from './ExportRow';
import { ExportGeneratorForm } from './ExportGeneratorForm';

// This page depends on per-request cookies/auth, so it cannot be statically rendered.
export const dynamic = 'force-dynamic';

export default async function AdminExportsPage() {
  // Check if using placeholder Supabase (dev mode)
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL.includes('placeholder');
  
  const exports = await getExports();

  return (
    <div>
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monthly Exports</h1>
          <p className="text-gray-600 mt-1">
            Generate and download monthly CSV exports of orders and points transactions
          </p>
        </div>
      </div>

      {isDevMode && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-amber-900">Development Mode</p>
                <p className="text-sm text-amber-800 mt-1">
                  Exports require Supabase to be configured. Configure your environment variables to enable this feature.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Generator */}
      <Card className="mb-8">
        <CardHeader className="bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Generate New Export</h2>
        </CardHeader>
        <CardContent>
          <ExportGeneratorForm isDevMode={isDevMode} />
        </CardContent>
      </Card>

      {/* Existing Exports */}
      <Card>
        <CardHeader className="bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Existing Exports</h2>
            <Badge variant="default">{exports.length} total</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {exports.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 text-sm font-semibold text-gray-900">Month</th>
                    <th className="pb-3 pr-4 text-sm font-semibold text-gray-900">Type</th>
                    <th className="pb-3 pr-4 text-sm font-semibold text-gray-900">Rows</th>
                    <th className="pb-3 pr-4 text-sm font-semibold text-gray-900">Size</th>
                    <th className="pb-3 pr-4 text-sm font-semibold text-gray-900">Created</th>
                    <th className="pb-3 text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {exports.map((exportRecord) => (
                    <ExportRow key={exportRecord.id} exportRecord={exportRecord} isDevMode={isDevMode} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600 font-medium">No exports yet</p>
              <p className="text-sm text-gray-500 mt-1">Generate your first monthly export above</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

