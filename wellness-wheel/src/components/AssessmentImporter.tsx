import React, { useState, useRef } from 'react';
import { parseAssessment, ParsedAssessment } from '../utils/assessmentParser';

interface AssessmentImporterProps {
  onAssessmentImported: (assessment: ParsedAssessment) => void;
  onClose: () => void;
}

/**
 * AssessmentImporter Component
 * 
 * This component provides a file upload interface for importing wellness wheel assessments.
 * It supports drag-and-drop and file selection, then parses the markdown content
 * and converts it to the format expected by the wellness wheel.
 * 
 * Features:
 * - Drag and drop file upload
 * - File selection via button
 * - Markdown parsing and validation
 * - Error handling and user feedback
 * - Clean, accessible UI
 */
const AssessmentImporter: React.FC<AssessmentImporterProps> = ({ 
  onAssessmentImported, 
  onClose 
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles file processing - both from drag/drop and file selection
   * @param file - The file to process
   */
  const handleFile = async (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.md')) {
      setError('Please select a markdown (.md) file');
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError('File size must be less than 1MB');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Read file content
      const content = await readFileContent(file);
      
      // Parse the assessment
      const parsedAssessment = parseAssessment(content);
      
      // Validate that we have data
      if (!parsedAssessment.name || !parsedAssessment.date) {
        throw new Error('Invalid assessment format: missing name or date');
      }
      
      // Check if we have at least some dimension data
      const hasData = Object.values(parsedAssessment).some(dim => {
        if (typeof dim === 'string') return false; // Skip name and date
        return dim.currentState || dim.changes || dim.futureGoals;
      });
      
      if (!hasData) {
        throw new Error('No assessment data found in the file');
      }
      
      setSuccess(`Successfully imported assessment for ${parsedAssessment.name}`);
      
      // Import the assessment after a brief delay to show success message
      setTimeout(() => {
        onAssessmentImported(parsedAssessment);
        onClose();
      }, 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse assessment file');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reads the content of a file as text
   * @param file - The file to read
   * @returns Promise that resolves to the file content
   */
  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  };

  /**
   * Handles drag over event
   * @param e - Drag event
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  /**
   * Handles drag leave event
   * @param e - Drag event
   */
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  /**
   * Handles drop event
   * @param e - Drag event
   */
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  /**
   * Handles file input change
   * @param e - Change event
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  /**
   * Opens file selection dialog
   */
  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Import Assessment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-gray-600">Processing assessment...</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your assessment file here
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  or click to browse files
                </p>
                <button
                  onClick={openFileDialog}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Choose File
                </button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* File format info */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Supported Format
            </h3>
            <p className="text-sm text-gray-600">
              Upload a markdown (.md) file containing a wellness wheel assessment with sections for:
            </p>
            <ul className="text-sm text-gray-600 mt-2 list-disc list-inside">
              <li>SPIRITUAL, PRACTICAL, RELATIONAL</li>
              <li>MENTAL, PHYSICAL, BEHAVIORAL, FINANCIAL</li>
              <li>Each with Current State, Changes, and Future Goals</li>
            </ul>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex">
                <svg className="w-5 h-5 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <p className="text-sm text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentImporter;
