'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'core/components/Button';
import { updateOrderNotes } from '../actions';
import { ORDER_NOTE_MAX_LENGTH } from '@/lib/orders/notes';

interface StaffNotesEditorProps {
  orderId: string;
  currentNotes: string | null;
  isDevMode: boolean;
}

/**
 * Staff-only notes on an order, always on the page rather than tucked inside the status
 * form, so annotating an order never means touching its status.
 */
export function StaffNotesEditor({ orderId, currentNotes, isDevMode }: StaffNotesEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(currentNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Compared trimmed, the same way the server stores it, so adding a trailing space does
  // not offer a save that would change nothing
  const isDirty = notes.trim() !== (currentNotes ?? '').trim();

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const result = await updateOrderNotes({ orderId, notes });

    setSaving(false);

    if (!result.success) {
      setMessage({ type: 'error', text: result.error || 'Failed to save the notes' });
      return;
    }

    setMessage({ type: 'success', text: 'Notes saved.' });
    startTransition(() => router.refresh());
  };

  const busy = saving || isPending;

  return (
    <div className="space-y-3">
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setMessage(null);
        }}
        disabled={isDevMode || busy}
        maxLength={ORDER_NOTE_MAX_LENGTH}
        rows={3}
        aria-label="Staff notes"
        placeholder="Who this order is for, anything to remember when fulfilling it..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isDevMode || busy || !isDirty}
        >
          {saving ? 'Saving...' : 'Save notes'}
        </Button>
        <p className="text-xs text-gray-600">Only staff can see these. The customer is not emailed.</p>
      </div>
      {message && (
        <p
          className={`text-sm ${message.type === 'success' ? 'text-green-800' : 'text-red-700'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
