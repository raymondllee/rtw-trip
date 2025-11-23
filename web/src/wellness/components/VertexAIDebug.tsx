import React, { useState } from 'react';
import { OAuthVertexAIService } from '../services/oauth-vertex-ai';

const VertexAIDebug: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Simple test data - just one response to summarize
  const testData = {
    responses: [
      {
        question: "What are your current work goals?",
        response: "I want to improve my time management skills and learn new programming languages.",
        ring: "ASPIRATIONAL",
        dimension: "PRACTICAL"
      }
    ],
    ringName: "ASPIRATIONAL",
    dimensionName: "PRACTICAL",
    maxLength: 25 // Word limit instruction for concise summaries
  };

  const testVertexAI = async () => {
    setIsLoading(true);
    setError('');
    setResult('');

    try {
      console.log('=== STARTING VERTEX AI DEBUG TEST ===');
      console.log('Test data:', testData);
      
      const service = new OAuthVertexAIService();
      const summary = await service.summarizeWellnessResponses(testData);
      
      console.log('=== TEST COMPLETED SUCCESSFULLY ===');
      console.log('Summary result:', summary);
      
      setResult(JSON.stringify(summary, null, 2));
    } catch (err) {
      console.error('=== TEST FAILED ===');
      console.error('Error details:', err);
      
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Vertex AI Debug Tool</h2>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-800 mb-2">Test Configuration</h3>
        <p className="text-blue-700 text-sm">
          This will test a single API call to Vertex AI with a simple wellness response. 
          The model is instructed to respond in less than 25 words.
        </p>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Test Data:</h3>
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(testData, null, 2)}
        </pre>
      </div>

      <button
        onClick={testVertexAI}
        disabled={isLoading}
        className={`px-6 py-3 rounded-lg font-semibold ${
          isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {isLoading ? 'Testing...' : 'Test Vertex AI API'}
      </button>

      {isLoading && (
        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <p className="text-yellow-800">
            ⏳ Testing Vertex AI API... Check the browser console for detailed logs.
          </p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
          <pre className="text-red-700 text-sm whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <div className="mt-4 p-4 bg-green-50 rounded-lg">
          <h3 className="font-semibold text-green-800 mb-2">Success Result:</h3>
          <pre className="text-green-700 text-sm overflow-auto">{result}</pre>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Debug Instructions:</h3>
        <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
          <li>Click "Test Vertex AI API" button</li>
          <li>Watch the browser console for detailed logs</li>
          <li>Check for any error messages or unexpected responses</li>
          <li>Share the console output if there are issues</li>
        </ol>
      </div>
    </div>
  );
};

export default VertexAIDebug;
