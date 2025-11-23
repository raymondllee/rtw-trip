import React, { useState, useRef } from 'react';
import { parseAssessment, ParsedAssessment } from '../utils/assessmentParser';
import { wellnessFirebaseService, WellnessUserData } from '../services/wellnessFirebaseService';

interface AssessmentImporterProps {
  onAssessmentImported: (assessment: ParsedAssessment) => void;
  onClose: () => void;
  onJsonImported?: () => void; // Callback when JSON users are imported
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
  onClose,
  onJsonImported
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{importUser: WellnessUserData, existingUser: WellnessUserData}>>([]);
  const [conflictStrategy, setConflictStrategy] = useState<'overwrite' | 'keep-both' | 'skip'>('overwrite');
  const [pendingUsers, setPendingUsers] = useState<WellnessUserData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Processes the import after conflict resolution
   */
  const processImport = async (users: WellnessUserData[], strategy: 'overwrite' | 'keep-both' | 'skip') => {
    setProgress(`Importing ${users.length} user(s)...`);

    // Get existing users to check for conflicts
    const existingUsers = await wellnessFirebaseService.getAllUsers();
    const existingUsersByName = new Map(existingUsers.map(u => [u.userName.toLowerCase(), u]));

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      setProgress(`Importing ${i + 1} of ${users.length}: ${user.userName}...`);

      const existingUser = existingUsersByName.get(user.userName.toLowerCase());

      if (existingUser) {
        // Conflict detected
        if (strategy === 'skip') {
          skippedCount++;
          continue;
        } else if (strategy === 'overwrite') {
          // Use existing userId to overwrite
          const updatedUser = {
            ...user,
            userId: existingUser.userId, // Keep existing userId
            lastUpdated: new Date().toISOString()
          };
          const success = await wellnessFirebaseService.saveUser(updatedUser);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        } else if (strategy === 'keep-both') {
          // Use original userId from import (will create a new user with same name)
          const success = await wellnessFirebaseService.saveUser(user);
          if (success) {
            successCount++;
          } else {
            failCount++;
          }
        }
      } else {
        // No conflict, just import
        const success = await wellnessFirebaseService.saveUser(user);
        if (success) {
          successCount++;
        } else {
          failCount++;
        }
      }
    }

    const messages = [];
    if (successCount > 0) messages.push(`${successCount} imported`);
    if (skippedCount > 0) messages.push(`${skippedCount} skipped`);
    if (failCount > 0) messages.push(`${failCount} failed`);

    setSuccess(`Successfully completed: ${messages.join(', ')}`);

    // Call the onJsonImported callback to refresh the user list
    if (onJsonImported) {
      onJsonImported();
    }

    // Close after showing success
    setTimeout(() => {
      onClose();
    }, 2000);
  };

  /**
   * Handles JSON file import with wellness user data
   * @param content - JSON file content
   */
  const handleJsonImport = async (content: string) => {
    try {
      const data = JSON.parse(content);

      // Check if it's the expected format
      if (!data.wellness_users) {
        throw new Error('Invalid JSON format: missing "wellness_users" field');
      }

      // Parse the stringified users array
      let users: WellnessUserData[];
      if (typeof data.wellness_users === 'string') {
        users = JSON.parse(data.wellness_users);
      } else {
        users = data.wellness_users;
      }

      if (!Array.isArray(users) || users.length === 0) {
        throw new Error('No users found in the JSON file');
      }

      // Check for conflicts with existing users
      const existingUsers = await wellnessFirebaseService.getAllUsers();
      const existingUsersByName = new Map(existingUsers.map(u => [u.userName.toLowerCase(), u]));

      const detectedConflicts: Array<{importUser: WellnessUserData, existingUser: WellnessUserData}> = [];

      users.forEach(user => {
        const existing = existingUsersByName.get(user.userName.toLowerCase());
        if (existing) {
          detectedConflicts.push({ importUser: user, existingUser: existing });
        }
      });

      if (detectedConflicts.length > 0) {
        // Show conflict resolution dialog
        setConflicts(detectedConflicts);
        setPendingUsers(users);
        setShowConflictDialog(true);
        setIsLoading(false);
      } else {
        // No conflicts, proceed with import
        await processImport(users, 'keep-both'); // Strategy doesn't matter when no conflicts
      }

    } catch (err) {
      throw err;
    }
  };

  /**
   * Handles user confirming conflict resolution
   */
  const handleConflictResolution = async () => {
    setShowConflictDialog(false);
    setIsLoading(true);
    try {
      await processImport(pendingUsers, conflictStrategy);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import users');
    } finally {
      setIsLoading(false);
      setProgress(null);
      setPendingUsers([]);
      setConflicts([]);
    }
  };

  /**
   * Handles file processing - both from drag/drop and file selection
   * @param file - The file to process
   */
  const handleFile = async (file: File) => {
    const isMarkdown = file.name.endsWith('.md');
    const isJson = file.name.endsWith('.json');

    // Validate file type
    if (!isMarkdown && !isJson) {
      setError('Please select a markdown (.md) or JSON (.json) file');
      return;
    }

    // Validate file size (max 5MB for JSON, 1MB for markdown)
    const maxSize = isJson ? 5 * 1024 * 1024 : 1024 * 1024;
    if (file.size > maxSize) {
      setError(`File size must be less than ${isJson ? '5MB' : '1MB'}`);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setProgress(null);

    try {
      // Read file content
      const content = await readFileContent(file);

      if (isJson) {
        // Handle JSON import
        await handleJsonImport(content);
      } else {
        // Handle markdown import
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
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse assessment file');
    } finally {
      setIsLoading(false);
      setProgress(null);
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
            accept=".md,.json"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* File format info */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Supported Formats
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Markdown (.md)</p>
                <p className="text-sm text-gray-600">
                  Assessment with sections for SPIRITUAL, PRACTICAL, RELATIONAL, MENTAL, PHYSICAL, BEHAVIORAL, FINANCIAL
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">JSON (.json)</p>
                <p className="text-sm text-gray-600">
                  Exported user data with format: <code className="text-xs bg-gray-200 px-1 rounded">{'{"wellness_users": [...]}'}</code>
                </p>
              </div>
            </div>
          </div>

          {/* Progress message */}
          {progress && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mt-0.5"></div>
                <div className="ml-3">
                  <p className="text-sm text-blue-800">{progress}</p>
                </div>
              </div>
            </div>
          )}

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

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 60 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Duplicate Users Detected
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Found {conflicts.length} user(s) with names that already exist. How would you like to handle duplicates?
              </p>

              {/* List conflicts */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-gray-700 mb-2">Conflicting users:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  {conflicts.map((conflict, idx) => (
                    <li key={idx}>• {conflict.importUser.userName}</li>
                  ))}
                </ul>
              </div>

              {/* Strategy selection */}
              <div className="space-y-3 mb-6">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="overwrite"
                    checked={conflictStrategy === 'overwrite'}
                    onChange={(e) => setConflictStrategy(e.target.value as 'overwrite' | 'keep-both' | 'skip')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Overwrite existing</div>
                    <div className="text-xs text-gray-600">Replace existing user data with imported data</div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="keep-both"
                    checked={conflictStrategy === 'keep-both'}
                    onChange={(e) => setConflictStrategy(e.target.value as 'overwrite' | 'keep-both' | 'skip')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Keep both</div>
                    <div className="text-xs text-gray-600">Import as new users (you'll have duplicates)</div>
                  </div>
                </label>

                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="strategy"
                    value="skip"
                    checked={conflictStrategy === 'skip'}
                    onChange={(e) => setConflictStrategy(e.target.value as 'overwrite' | 'keep-both' | 'skip')}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Skip duplicates</div>
                    <div className="text-xs text-gray-600">Only import users that don't exist</div>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowConflictDialog(false);
                    setPendingUsers([]);
                    setConflicts([]);
                    setIsLoading(false);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConflictResolution}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Continue Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentImporter;
