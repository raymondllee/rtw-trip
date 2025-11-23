// Utility functions for transforming data between assessment and wellness wheel formats

import { categories } from '../constants/wellness';

// Convert assessment responses to wellness wheel format
export const transformAssessmentToWheel = (assessmentResponses: Record<string, string>): Record<string, string> => {
  const wheelResponses: Record<string, string> = {};

  // Handle null/undefined responses
  if (!assessmentResponses || typeof assessmentResponses !== 'object') {
    return wheelResponses;
  }

  categories.forEach(category => {
    ['empirical', 'situational', 'aspirational'].forEach((questionType) => {
      const responseKey = `${category.name}_${questionType}`;

      if (assessmentResponses[responseKey] && assessmentResponses[responseKey].trim()) {
        // Create 3 keys for the wheel (index 0, 1, 2) with the same content
        // This ensures the wheel can display the content in all three positions
        for (let i = 0; i < 3; i++) {
          const wheelKey = `${questionType.toUpperCase()}_${category.name}_${i}`;
          wheelResponses[wheelKey] = assessmentResponses[responseKey];
        }
      }
    });
  });

  return wheelResponses;
};

// Convert wellness wheel format to assessment format
export const transformWheelToAssessment = (wheelResponses: Record<string, string>): Record<string, string> => {
  const assessmentResponses: Record<string, string> = {};
  
  categories.forEach(category => {
    ['empirical', 'situational', 'aspirational'].forEach((questionType, index) => {
      const wheelKey = `${questionType.toUpperCase()}_${category.name}_${index}`;
      const assessmentKey = `${category.name}_${questionType}`;
      
      if (wheelResponses[wheelKey]) {
        assessmentResponses[assessmentKey] = wheelResponses[wheelKey];
      }
    });
  });
  
  return assessmentResponses;
};

// Check if assessment is complete (all questions answered)
export const isAssessmentComplete = (responses: Record<string, string>): boolean => {
  const totalQuestions = categories.length * 3; // 7 categories × 3 question types
  const answeredQuestions = Object.values(responses).filter(response => 
    response && response.trim().length > 0
  ).length;
  
  return answeredQuestions === totalQuestions;
};

// Calculate completion percentage
export const getCompletionPercentage = (responses: Record<string, string>): number => {
  const totalQuestions = categories.length * 3;
  const answeredQuestions = Object.values(responses).filter(response => 
    response && response.trim().length > 0
  ).length;
  
  return Math.round((answeredQuestions / totalQuestions) * 100);
};

// Get responses for a specific category
export const getCategoryResponses = (responses: Record<string, string>, categoryName: string) => {
  return {
    empirical: responses[`${categoryName}_empirical`] || '',
    situational: responses[`${categoryName}_situational`] || '',
    aspirational: responses[`${categoryName}_aspirational`] || ''
  };
};

// Get responses for a specific ring
export const getRingResponses = (responses: Record<string, string>, ringName: string) => {
  const ringResponses: Record<string, string[]> = {};
  
  categories.forEach(category => {
    ringResponses[category.name] = [];
    for (let i = 0; i < 3; i++) {
      const key = `${ringName}_${category.name}_${i}`;
      if (responses[key] && responses[key].trim()) {
        ringResponses[category.name].push(responses[key]);
      }
    }
  });
  
  return ringResponses;
};

// Validate response data
export const validateResponses = (responses: Record<string, string>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for required fields
  categories.forEach(category => {
    ['empirical', 'situational', 'aspirational'].forEach(questionType => {
      const key = `${category.name}_${questionType}`;
      if (!responses[key] || responses[key].trim().length === 0) {
        errors.push(`Missing response for ${category.name} - ${questionType}`);
      }
    });
  });
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Create empty response template
export const createEmptyResponses = (): Record<string, string> => {
  const emptyResponses: Record<string, string> = {};
  
  categories.forEach(category => {
    ['empirical', 'situational', 'aspirational'].forEach(questionType => {
      const key = `${category.name}_${questionType}`;
      emptyResponses[key] = '';
    });
  });
  
  return emptyResponses;
};
