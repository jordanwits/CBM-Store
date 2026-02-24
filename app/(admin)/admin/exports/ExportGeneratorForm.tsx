'use client';

import { useState } from 'react';
import { Button } from 'core/components/Button';
import { Input } from 'core/components/Input';
import { Alert } from 'core/components/Alert';
import { ChoiceModal } from 'core/components/ChoiceModal';
import { generateMonthlyExport, generateCombinedExport } from './actions';

interface ExportGeneratorFormProps {
  isDevMode: boolean;
}

export function ExportGeneratorForm({ isDevMode }: ExportGeneratorFormProps) {
  const [startMonth, setStartMonth] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [exportType, setExportType] = useState<'orders' | 'order_items' | 'points_ledger'>('orders');
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [progress, setProgress] = useState<string[]>([]);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [pendingMonths, setPendingMonths] = useState<{ start: string; end: string } | null>(null);

  const formatMonthName = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const monthIndex = parseInt(monthNum, 10) - 1;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${monthNames[monthIndex]} ${year}`;
  };

  const getMonthsBetween = (start: string, end: string): string[] => {
    const months: string[] = [];
    
    // Parse start and end months directly without Date objects to avoid timezone issues
    const [startYear, startMonth] = start.split('-').map(Number);
    const [endYear, endMonth] = end.split('-').map(Number);
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (
      currentYear < endYear || 
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      months.push(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
      
      // Move to next month
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    return months;
  };

  const handleGenerate = async () => {
    if (!startMonth) {
      setMessage({ type: 'error', text: 'Please select a start month' });
      return;
    }

    // Ensure we have a valid start month
    if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) {
      setMessage({ type: 'error', text: 'Invalid start month format. Please select a valid month.' });
      return;
    }

    // Normalize and validate month values (month input should already be YYYY-MM format)
    const normalizedStartMonth = startMonth.trim();
    const normalizedEndMonth = endMonth?.trim() || '';

    // Validate start month format
    if (!/^\d{4}-\d{2}$/.test(normalizedStartMonth)) {
      setMessage({ type: 'error', text: `Invalid start month format: "${normalizedStartMonth}". Expected YYYY-MM format.` });
      return;
    }

    // Validate end month format if provided
    if (normalizedEndMonth && !/^\d{4}-\d{2}$/.test(normalizedEndMonth)) {
      setMessage({ type: 'error', text: `Invalid end month format: "${normalizedEndMonth}". Expected YYYY-MM format.` });
      return;
    }

    const monthsToGenerate = normalizedEndMonth && normalizedEndMonth >= normalizedStartMonth && normalizedEndMonth !== normalizedStartMonth
      ? getMonthsBetween(normalizedStartMonth, normalizedEndMonth)
      : [normalizedStartMonth];

    // If multiple months, show choice modal
    if (monthsToGenerate.length > 1) {
      setPendingMonths({ start: normalizedStartMonth, end: normalizedEndMonth });
      setShowChoiceModal(true);
      return;
    }

    // Single month - proceed directly
    await generateIndividualExports([normalizedStartMonth]);
  };

  const generateIndividualExports = async (months: string[]) => {
    setIsGenerating(true);
    setMessage(null);
    setProgress([]);

    const results: { month: string; success: boolean; message: string }[] = [];

    for (const month of months) {
      setProgress(prev => [...prev, `Generating ${exportType} for ${month}...`]);
      
      try {
        const result = await generateMonthlyExport(month, exportType);
        
        results.push({
          month,
          success: result.success,
          message: result.success ? (result.message || 'Success') : (result.error || 'Failed')
        });
        
        setProgress(prev => [...prev, `✓ ${month}: ${result.success ? 'Success' : result.error || 'Failed'}`]);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred';
        console.error('Error calling generateMonthlyExport:', error);
        
        results.push({
          month,
          success: false,
          message: errorMessage
        });
        
        setProgress(prev => [...prev, `✗ ${month}: ${errorMessage}`]);
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const failedResults = results.filter(r => !r.success);

    if (failCount === 0) {
      setMessage({ 
        type: 'success', 
        text: `Successfully generated ${successCount} export${successCount > 1 ? 's' : ''} for ${exportType}` 
      });
      setStartMonth('');
      setEndMonth('');
    } else {
      const errorDetails = failedResults.map(r => `${r.month}: ${r.message}`).join('; ');
      const summaryText = successCount > 0 
        ? `${successCount} export${successCount > 1 ? 's' : ''} succeeded, ${failCount} failed. `
        : `All ${failCount} export${failCount > 1 ? 's' : ''} failed. `;
      
      setMessage({ 
        type: 'error', 
        text: `${summaryText}Errors: ${errorDetails}` 
      });
    }

    setIsGenerating(false);
  };

  const handleCombinedExport = async (start: string, end: string) => {
    setIsGenerating(true);
    setMessage(null);
    setProgress([]);
    setShowChoiceModal(false);

    setProgress(prev => [...prev, `Generating combined ${exportType} export from ${start} to ${end}...`]);

    try {
      const result = await generateCombinedExport(start, end, exportType);
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: result.message || 'Successfully generated combined export' 
        });
        setStartMonth('');
        setEndMonth('');
        setProgress(prev => [...prev, `✓ Combined export: Success`]);
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Failed to generate combined export' 
        });
        setProgress(prev => [...prev, `✗ Combined export: ${result.error || 'Failed'}`]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unexpected error occurred';
      console.error('Error calling generateCombinedExport:', error);
      setMessage({ 
        type: 'error', 
        text: errorMessage 
      });
      setProgress(prev => [...prev, `✗ Combined export: ${errorMessage}`]);
    }

    setIsGenerating(false);
    setPendingMonths(null);
  };

  const handleChoice = async (choice: 'individual' | 'combined') => {
    if (!pendingMonths) return;

    if (choice === 'individual') {
      const months = getMonthsBetween(pendingMonths.start, pendingMonths.end);
      setShowChoiceModal(false);
      setPendingMonths(null);
      await generateIndividualExports(months);
    } else {
      await handleCombinedExport(pendingMonths.start, pendingMonths.end);
    }
  };

  // Get current month in YYYY-MM format for max date
  const currentMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="startMonth" className="block text-sm font-medium text-gray-700 mb-2">
            Start Month
          </label>
          <Input
            id="startMonth"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            max={currentMonth}
            disabled={isDevMode || isGenerating}
            placeholder="Select start month"
          />
        </div>

        <div>
          <label htmlFor="endMonth" className="block text-sm font-medium text-gray-700 mb-2">
            End Month <span className="text-gray-500 font-normal">(optional)</span>
          </label>
          <Input
            id="endMonth"
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
            min={startMonth}
            max={currentMonth}
            disabled={isDevMode || isGenerating || !startMonth}
            placeholder="Same as start"
          />
        </div>

        <div>
          <label htmlFor="exportType" className="block text-sm font-medium text-gray-700 mb-2">
            Export Type
          </label>
          <select
            id="exportType"
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            disabled={isDevMode || isGenerating}
            className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="orders" className="text-gray-900 bg-white">Orders</option>
            <option value="order_items" className="text-gray-900 bg-white">Order Items</option>
            <option value="points_ledger" className="text-gray-900 bg-white">Points Ledger</option>
          </select>
        </div>
      </div>

      {progress.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Progress:</h4>
          <div className="space-y-1 text-sm text-gray-700 font-mono">
            {progress.map((msg, idx) => (
              <div key={idx}>{msg}</div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <Alert variant={message.type}>
          {message.text}
        </Alert>
      )}

      <div className="flex items-start gap-3">
        <Button
          onClick={handleGenerate}
          disabled={isDevMode || isGenerating || !startMonth}
          variant="primary"
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating...
            </>
          ) : (
            'Generate Export'
          )}
        </Button>
        
        <div className="text-sm text-gray-500 pt-2">
          <p className="font-medium">Generate exports for one or multiple months.</p>
          <p className="mt-1">Leave end month empty to generate just one month, or select a range to generate multiple months at once.</p>
        </div>
      </div>

      {pendingMonths && (
        <ChoiceModal
          isOpen={showChoiceModal}
          onClose={() => {
            setShowChoiceModal(false);
            setPendingMonths(null);
          }}
          onChoice={handleChoice}
          title="Export Format"
          message={`You've selected a range of months. How would you like to generate the export?`}
          individualLabel="Individual Monthly Exports"
          combinedLabel="Single Combined Export"
          individualDescription={`Generate separate CSV files for each month (${getMonthsBetween(pendingMonths.start, pendingMonths.end).length} files)`}
          combinedDescription={`Generate one CSV file containing all data from ${formatMonthName(pendingMonths.start)} to ${formatMonthName(pendingMonths.end)}`}
        />
      )}
    </div>
  );
}

