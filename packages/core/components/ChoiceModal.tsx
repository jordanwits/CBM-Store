'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChoice: (choice: 'individual' | 'combined') => void;
  title: string;
  message: string;
  individualLabel: string;
  combinedLabel: string;
  individualDescription?: string;
  combinedDescription?: string;
}

export function ChoiceModal({
  isOpen,
  onClose,
  onChoice,
  title,
  message,
  individualLabel,
  combinedLabel,
  individualDescription,
  combinedDescription,
}: ChoiceModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleIndividual = () => {
    onChoice('individual');
  };

  const handleCombined = () => {
    onChoice('combined');
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-6">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3 mb-6">
          <button
            onClick={handleIndividual}
            className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{individualLabel}</div>
                {individualDescription && (
                  <div className="text-sm text-gray-600 mt-1">{individualDescription}</div>
                )}
              </div>
            </div>
          </button>

          <button
            onClick={handleCombined}
            className="w-full text-left p-4 border-2 border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{combinedLabel}</div>
                {combinedDescription && (
                  <div className="text-sm text-gray-600 mt-1">{combinedDescription}</div>
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
