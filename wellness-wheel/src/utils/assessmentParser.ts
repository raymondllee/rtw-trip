// Assessment Parser Utility
// Parses markdown assessment files into structured data for the wellness wheel

export interface AssessmentData {
  name: string;
  date: string;
  dimensions: {
    [key: string]: {
      currentState: string;
      changes: string;
      futureGoals: string;
    };
  };
}

export interface ParsedAssessment {
  name: string;
  date: string;
  spiritual: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  practical: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  relational: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  mental: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  physical: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  behavioral: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
  financial: {
    currentState: string;
    changes: string;
    futureGoals: string;
  };
}

// Type for dimension keys only (excluding name and date)
type DimensionKey = 'spiritual' | 'practical' | 'relational' | 'mental' | 'physical' | 'behavioral' | 'financial';

/**
 * Parses a markdown assessment file into structured data
 * @param markdownContent - The raw markdown content of the assessment file
 * @returns ParsedAssessment object with all dimension data
 */
export function parseAssessment(markdownContent: string): ParsedAssessment {
  const lines = markdownContent.split('\n');
  
  // Extract name and date from header
  const name = extractName(lines[0]);
  const date = extractDate(lines[2]);
  
  // Initialize the assessment object
  const assessment: ParsedAssessment = {
    name,
    date,
    spiritual: { currentState: '', changes: '', futureGoals: '' },
    practical: { currentState: '', changes: '', futureGoals: '' },
    relational: { currentState: '', changes: '', futureGoals: '' },
    mental: { currentState: '', changes: '', futureGoals: '' },
    physical: { currentState: '', changes: '', futureGoals: '' },
    behavioral: { currentState: '', changes: '', futureGoals: '' },
    financial: { currentState: '', changes: '', futureGoals: '' }
  };
  
  // Parse each dimension
  const dimensions: DimensionKey[] = ['spiritual', 'practical', 'relational', 'mental', 'physical', 'behavioral', 'financial'];
  
  for (const dimension of dimensions) {
    const dimensionData = parseDimension(lines, dimension);
    assessment[dimension] = dimensionData;
  }
  
  return assessment;
}

/**
 * Extracts the name from the header line
 * @param headerLine - The first line of the markdown file
 * @returns The extracted name
 */
function extractName(headerLine: string): string {
  // Remove "# " and "'s Wellness Wheel Assessment"
  return headerLine
    .replace(/^# /, '')
    .replace(/'s Wellness Wheel Assessment$/, '')
    .trim();
}

/**
 * Extracts the date from the date line
 * @param dateLine - The line containing the date
 * @returns The extracted date
 */
function extractDate(dateLine: string): string {
  // Extract date from "*Completed on 9/1/2025 at 12:45 PM*"
  const match = dateLine.match(/\*Completed on (.+?)\*/);
  return match ? match[1] : '';
}

/**
 * Parses a specific dimension from the markdown lines
 * @param lines - All lines of the markdown file
 * @param dimension - The dimension name to parse
 * @returns Object with currentState, changes, and futureGoals
 */
function parseDimension(lines: string[], dimension: DimensionKey): { currentState: string; changes: string; futureGoals: string } {
  const dimensionMap: Record<DimensionKey, string> = {
    spiritual: 'SPIRITUAL',
    practical: 'PRACTICAL', 
    relational: 'RELATIONAL',
    mental: 'MENTAL',
    physical: 'PHYSICAL',
    behavioral: 'BEHAVIORAL',
    financial: 'FINANCIAL'
  };
  
  const dimensionHeader = dimensionMap[dimension];
  const result = { currentState: '', changes: '', futureGoals: '' };
  
  // Find the dimension section
  let dimensionStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`## `) && lines[i].includes(dimensionHeader)) {
      dimensionStartIndex = i;
      break;
    }
  }
  
  if (dimensionStartIndex === -1) {
    return result; // Dimension not found
  }
  
  // Find the end of this dimension (next ## or end of file)
  let dimensionEndIndex = lines.length;
  for (let i = dimensionStartIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      dimensionEndIndex = i;
      break;
    }
  }
  
  // Parse the content within this dimension
  const dimensionLines = lines.slice(dimensionStartIndex, dimensionEndIndex);
  
  // Extract Current State
  const currentStateIndex = dimensionLines.findIndex(line => 
    line.includes('**Current State (What IS):**')
  );
  if (currentStateIndex !== -1) {
    result.currentState = extractSectionContent(dimensionLines, currentStateIndex);
  }
  
  // Extract Changes Happening Now
  const changesIndex = dimensionLines.findIndex(line => 
    line.includes('**Changes Happening Now:**')
  );
  if (changesIndex !== -1) {
    result.changes = extractSectionContent(dimensionLines, changesIndex);
  }
  
  // Extract Future Goals
  const futureGoalsIndex = dimensionLines.findIndex(line => 
    line.includes('**Future Goals:**')
  );
  if (futureGoalsIndex !== -1) {
    result.futureGoals = extractSectionContent(dimensionLines, futureGoalsIndex);
  }
  
  return result;
}

/**
 * Extracts content from a section until the next section or end
 * @param lines - The lines to search in
 * @param startIndex - The index where the section starts
 * @returns The extracted content as a single string
 */
function extractSectionContent(lines: string[], startIndex: number): string {
  const content: string[] = [];
  
  // Start from the line after the section header
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Stop if we hit another section header or separator
    if (line.startsWith('**') || line === '---' || line === '') {
      break;
    }
    
    // Add non-empty lines to content
    if (line) {
      content.push(line);
    }
  }
  
  return content.join(' ').trim();
}

/**
 * Converts parsed assessment data to the format expected by the wellness wheel
 * @param assessment - The parsed assessment data
 * @returns AssessmentData in the format expected by the wellness wheel
 */
export function convertToWellnessWheelFormat(assessment: ParsedAssessment): AssessmentData {
  return {
    name: assessment.name,
    date: assessment.date,
    dimensions: {
      SPIRITUAL: assessment.spiritual,
      PRACTICAL: assessment.practical,
      RELATIONAL: assessment.relational,
      MENTAL: assessment.mental,
      PHYSICAL: assessment.physical,
      BEHAVIORAL: assessment.behavioral,
      FINANCIAL: assessment.financial
    }
  };
}

/**
 * Converts parsed assessment data to the format expected by the assessment form
 * @param assessment - The parsed assessment data
 * @returns Record of responses in the format expected by the assessment form
 */
export function convertToAssessmentFormFormat(assessment: ParsedAssessment): Record<string, string> {
  const responses: Record<string, string> = {};
  
  // Map assessment dimensions to assessment form format
  const dimensionMapping = {
    spiritual: 'SPIRITUAL',
    practical: 'PRACTICAL',
    relational: 'RELATIONAL',
    mental: 'MENTAL',
    physical: 'PHYSICAL',
    behavioral: 'BEHAVIORAL',
    financial: 'FINANCIAL'
  };
  
  Object.entries(dimensionMapping).forEach(([assessmentKey, formKey]) => {
    const dimensionData = assessment[assessmentKey as DimensionKey];
    
    // Map the three sections to the assessment form format
    // This creates keys like: SPIRITUAL_empirical, SPIRITUAL_situational, SPIRITUAL_aspirational
    responses[`${formKey}_empirical`] = dimensionData.currentState;
    responses[`${formKey}_situational`] = dimensionData.changes;
    responses[`${formKey}_aspirational`] = dimensionData.futureGoals;
  });
  
  return responses;
}
