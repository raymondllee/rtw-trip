import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, RotateCcw, Circle, Target, Star, Database, User } from 'lucide-react';
import { categories, questions } from '../constants/wellness';
import { getCompletionPercentage } from '../utils/dataTransformation';
import { generateTestData } from '../utils/testDataGenerator';

interface WellnessAssessmentProps {
  onComplete: (responses: Record<string, string>, userName: string) => void;
  initialResponses?: Record<string, string>;
  initialUserName?: string;
  onBack?: () => void;
}

const WellnessAssessment: React.FC<WellnessAssessmentProps> = ({ 
  onComplete, 
  initialResponses = {}, 
  initialUserName = '',
  onBack 
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>(initialResponses);
  const [userName, setUserName] = useState<string>(initialUserName);
  const [showResults, setShowResults] = useState(false);
  const [showNameInput, setShowNameInput] = useState(!initialUserName);

  const totalSteps = categories.length; // 7 categories

  const getCurrentCategory = () => categories[currentStep];
  
  const handleInputChange = (key: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowResults(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const reset = () => {
    setCurrentStep(0);
    setResponses(initialResponses);
    setShowResults(false);
  };

  const handleComplete = () => {
    onComplete(responses, userName);
  };

  const generateTestDataHandler = () => {
    const testData = generateTestData(userName || 'User');
    setResponses(testData);
  };

  const renderCurrentStep = () => {
    if (showNameInput) {
      return <NameInputView />;
    }
    
    if (showResults) {
      return <ResultsView />;
    }

    const category = getCurrentCategory();
    const categoryQuestions = questions[category.name as keyof typeof questions];
    
    return (
      <div className="max-w-4xl mx-auto">
        {/* Category Header */}
        <div className="mb-8 text-center">
          <div 
            className="w-24 h-24 mx-auto rounded-full flex items-center justify-center text-4xl mb-4"
            style={{ backgroundColor: category.color }}
          >
            {category.icon}
          </div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2">{category.name}</h2>
          <p className="text-gray-600 text-lg">{category.description}</p>
        </div>

        {/* Three Questions for this Category */}
        <div className="space-y-8">
          {['empirical', 'situational', 'aspirational'].map((type, idx) => {
            const question = categoryQuestions[type as keyof typeof categoryQuestions];
            const ringIcons = [Circle, Target, Star];
            const ringColors = ['#6B7280', '#3B82F6', '#8B5CF6'];
            const RingIcon = ringIcons[idx];
            const responseKey = `${category.name}_${type}`;
            
            return (
              <div key={type} className="bg-white rounded-lg p-6 shadow-sm border">
                <div className="flex items-center gap-3 mb-4">
                  <RingIcon size={24} style={{ color: ringColors[idx] }} />
                  <h3 className="text-xl font-semibold text-gray-800">{question.title}</h3>
                </div>
                
                <p className="text-gray-600 mb-4">{question.prompt}</p>
                
                <textarea
                  value={responses[responseKey] || ''}
                  onChange={(e) => handleInputChange(responseKey, e.target.value)}
                  className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px] text-gray-700"
                  placeholder={question.placeholder}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const NameInputView = () => (
    <div className="max-w-2xl mx-auto text-center">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-4xl mb-4">
          <User size={48} className="text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Welcome to Your Wellness Journey</h2>
        <p className="text-gray-600 text-lg">
          Let's start by getting to know you better. This assessment will help you explore all dimensions of your life.
        </p>
      </div>

      <div className="bg-white rounded-lg p-8 shadow-sm border">
        <div className="mb-6">
          <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-2">
            What's your name?
          </label>
          <input
            type="text"
            id="userName"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center"
            autoFocus
          />
        </div>

        <button
          onClick={() => setShowNameInput(false)}
          disabled={!userName.trim()}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
        >
          Start My Assessment
        </button>
      </div>
    </div>
  );

  const ResultsView = () => {
    const completionPercentage = getCompletionPercentage(responses);

    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Assessment Complete!</h2>
          <p className="text-gray-600 text-lg mb-4">
            You've completed {completionPercentage}% of your wellness assessment
          </p>
          
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">What's Next?</h3>
            <p className="text-blue-700 mb-4">
              Your responses will now be transformed into a beautiful wellness wheel visualization. 
              You can explore your life across all dimensions and see how everything connects.
            </p>
            <button
              onClick={handleComplete}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View My Wellness Wheel
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Summary of Responses */}
        <div className="space-y-6">
          {categories.map(category => {
            const current = responses[`${category.name}_empirical`]?.trim();
            const changes = responses[`${category.name}_situational`]?.trim();
            const goals = responses[`${category.name}_aspirational`]?.trim();
            
            if (!current && !changes && !goals) return null;
            
            return (
              <div key={category.name} className="bg-white rounded-lg p-6 shadow-sm border">
                <div className="flex items-center gap-3 mb-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">{category.name}</h3>
                    <p className="text-gray-600 text-sm">{category.description}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {current && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Circle size={16} className="text-gray-600" />
                        <h4 className="font-semibold text-gray-700">Current State</h4>
                      </div>
                      <p className="text-gray-800 text-sm">{current}</p>
                    </div>
                  )}
                  
                  {changes && (
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Target size={16} className="text-blue-600" />
                        <h4 className="font-semibold text-blue-700">Changes Now</h4>
                      </div>
                      <p className="text-blue-800 text-sm">{changes}</p>
                    </div>
                  )}
                  
                  {goals && (
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Star size={16} className="text-purple-600" />
                        <h4 className="font-semibold text-purple-700">Future Goals</h4>
                      </div>
                      <p className="text-purple-800 text-sm">{goals}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {showResults ? 'Assessment Complete' : `${getCurrentCategory().name} - Step ${currentStep + 1} of ${totalSteps}`}
            </span>
            <span className="text-sm text-gray-500">
              {showResults ? '100%' : `${Math.round(((currentStep + 1) / totalSteps) * 100)}%`}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: showResults ? '100%' : `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      {renderCurrentStep()}

      {/* Navigation */}
      <div className="max-w-4xl mx-auto mt-12">
        <div className="flex items-center justify-between">
          <button
            onClick={showResults ? reset : onBack || prevStep}
            disabled={!showResults && currentStep === 0 && !onBack}
            className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {showResults ? <RotateCcw size={20} /> : onBack ? <ChevronLeft size={20} /> : <ChevronLeft size={20} />}
            {showResults ? 'Start Over' : onBack ? 'Back' : 'Previous'}
          </button>
          
          {!showResults && (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === totalSteps - 1 ? 'View Results' : 'Next'}
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        {/* Test Data Generator Button - Discreet */}
        {!showResults && !showNameInput && (
          <div className="flex justify-center mt-8">
            <button
              onClick={generateTestDataHandler}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors opacity-60 hover:opacity-100"
              title="Generate sample data to see how the assessment works"
            >
              <Database size={16} />
              <span className="text-xs">Generate Test Data</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WellnessAssessment;
