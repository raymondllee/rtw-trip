import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import WellnessGrid from '../WellnessGrid';

// Mock the AI service to avoid actual API calls during testing
jest.mock('../../services/oauth-vertex-ai', () => ({
  oauthVertexAIService: {
    summarizeWellnessResponses: jest.fn().mockResolvedValue({
      summary: 'Test summary for wellness responses'
    })
  }
}));

describe('WellnessGrid', () => {
  const mockResponses = {
    'EMPIRICAL_SPIRITUAL_0': 'I value clarity and peace',
    'EMPIRICAL_SPIRITUAL_1': 'I prioritize quality time with loved ones',
    'SITUATIONAL_SPIRITUAL_0': 'Going through a major life transition',
    'ASPIRATIONAL_SPIRITUAL_0': 'Want to achieve greater inner peace'
  };

  it('renders the grid with proper structure', () => {
    render(<WellnessGrid customResponses={mockResponses} userName="Test User" />);
    
    // Check if the main title is rendered
    expect(screen.getByText('Your Wellness Grid')).toBeInTheDocument();
    
    // Check if the hierarchical description is shown
    expect(screen.getByText('A hierarchical view of your life design landscape')).toBeInTheDocument();
    
    // Check if user name is displayed (wait for it to appear)
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('renders dimension headers correctly', () => {
    render(<WellnessGrid customResponses={mockResponses} userName="Test User" />);
    
    // Check if dimension names are rendered in the header
    expect(screen.getByText('SPIRITUAL')).toBeInTheDocument();
    expect(screen.getByText('PRACTICAL')).toBeInTheDocument();
    expect(screen.getByText('RELATIONAL')).toBeInTheDocument();
    expect(screen.getByText('MENTAL')).toBeInTheDocument();
    expect(screen.getByText('PHYSICAL')).toBeInTheDocument();
    expect(screen.getByText('BEHAVIORAL')).toBeInTheDocument();
    expect(screen.getByText('FINANCIAL')).toBeInTheDocument();
  });

  it('renders ring labels correctly', () => {
    render(<WellnessGrid customResponses={mockResponses} userName="Test User" />);
    
    // Check if ring names are rendered in the left column
    expect(screen.getByText('EMPIRICAL')).toBeInTheDocument();
    expect(screen.getByText('SITUATIONAL')).toBeInTheDocument();
    expect(screen.getByText('ASPIRATIONAL')).toBeInTheDocument();
  });

  it('shows loading state for cells with data', () => {
    render(<WellnessGrid customResponses={mockResponses} userName="Test User" />);
    
    // Check if loading text appears for cells that have data
    const loadingElements = screen.getAllByText('Loading...');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('renders without errors when no data is provided', () => {
    render(<WellnessGrid customResponses={{}} userName="Test User" />);
    
    // Just check that the component renders without crashing
    expect(screen.getByText('Your Wellness Grid')).toBeInTheDocument();
  });
});
