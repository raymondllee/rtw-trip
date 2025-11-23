import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { categories } from '../constants/wellness';

interface AssessmentEditorProps {
  initialResponses: Record<string, string>;
  userName: string;
  onSave: (responses: Record<string, string>) => void;
  onCancel: () => void;
}

const AssessmentEditor: React.FC<AssessmentEditorProps> = ({
  initialResponses,
  userName,
  onSave,
  onCancel
}) => {
  const [responses, setResponses] = useState<Record<string, string>>(initialResponses);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setResponses(initialResponses);
  }, [initialResponses]);

  const handleResponseChange = (key: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [key]: value
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(responses);
  };

  const handleCancel = () => {
    if (hasChanges && !window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
      return;
    }
    onCancel();
  };

  const questionLabels = {
    empirical: 'Current State (What is)',
    situational: 'Changes & Challenges (What\'s changing)',
    aspirational: 'Future Goals (What you want)'
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Edit Assessment</h1>
                <p className="text-sm text-gray-600">{userName}</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                hasChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Save size={18} />
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 mt-6">
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.name} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                  style={{ backgroundColor: category.color }}
                >
                  {category.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                  <p className="text-sm text-gray-600">{category.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                {(['empirical', 'situational', 'aspirational'] as const).map((questionType) => {
                  const key = `${category.name}_${questionType}`;
                  return (
                    <div key={questionType}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {questionLabels[questionType]}
                      </label>
                      <textarea
                        value={responses[key] || ''}
                        onChange={(e) => handleResponseChange(key, e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={3}
                        placeholder={`Enter your ${questionType} response...`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Save button at bottom */}
        <div className="mt-8 flex justify-end gap-4">
          <button
            onClick={handleCancel}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <Save size={18} />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentEditor;
