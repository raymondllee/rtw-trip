# Wellness Wheel App

A React TypeScript application that creates an interactive wellness wheel for life design and self-assessment. The app visualizes three dimensions of wellness: Empirical (data-driven insights), Situational (current circumstances), and Aspirational (goals and dreams).

## Features

- **Interactive Wellness Wheel**: Three-ring circular visualization with color-coded segments
- **Three-Dimensional View**: 
  - **Empirical Ring**: Data-driven insights and metrics
  - **Situational Ring**: Current life circumstances and achievements
  - **Aspirational Ring**: Goals, dreams, and future aspirations
- **AI-Powered Summarization**: Vertex AI Gemini integration for intelligent response summarization
- **Curved Text Rendering**: Advanced SVG text rendering with curved and wrapped text
- **Modal Details**: Click segments to view detailed summaries and full responses
- **Responsive Design**: Clean, modern UI with proper spacing and typography

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **AI Integration**: Google Vertex AI with Gemini 2.5 Flash model
- **SVG Graphics**: Custom SVG rendering for circular segments and curved text
- **Build Tool**: Create React App with TypeScript template

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd wellness-wheel-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up Vertex AI environment variables (see Vertex AI Setup section below)

4. Start the development server:
```bash
npm start
# Or for local-only binding (avoids hostname issues):
npm run start:local
```

5. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Vertex AI Integration

The app uses Google Vertex AI with the Gemini 2.5 Flash model to intelligently summarize wellness assessment responses. This provides meaningful, concise summaries that fit perfectly in the wellness wheel segments.

### Setup Requirements

1. **Google Cloud Project**: You need a Google Cloud project with Vertex AI enabled
2. **OAuth 2.0 Credentials**: Create OAuth client credentials for browser authentication
3. **Environment Variables**: Set the following in your `.env` file:

```bash
REACT_APP_GOOGLE_CLOUD_PROJECT_ID=your-project-id
REACT_APP_GOOGLE_CLOUD_LOCATION=us-central1
REACT_APP_GOOGLE_OAUTH_CLIENT_ID=your-oauth-client-id
REACT_APP_GOOGLE_OAUTH_CLIENT_SECRET=your-oauth-client-secret
```

### How It Works

1. **OAuth Authentication**: Users authenticate with Google OAuth to get access tokens
2. **Direct API Calls**: The app calls Vertex AI directly from the browser (no backend required)
3. **Smart Summarization**: Gemini generates concise summaries (under 25 words) based on:
   - Ring context (Empirical, Situational, Aspirational)
   - Dimension context (Spiritual, Practical, Relational, Mental, etc.)
   - User responses and goals
4. **Fallback Handling**: If AI fails, the app falls back to rule-based summarization

### Debug Tool

The app includes a built-in debug tool for testing Vertex AI integration:
- Click the purple "Show Debug" button in the top-right corner
- Test single API calls with controlled data
- View detailed console logs for debugging
- Verify OAuth and API functionality

### API Configuration

The Vertex AI integration is configured in `src/config/vertex-ai.ts`:
- **Model**: `gemini-2.5-flash` (latest Gemini model)
- **Temperature**: 0.3 (consistent, focused responses)
- **Max Output Tokens**: Unlimited (allows Gemini to craft quality responses)
- **Word Limit**: 25 words (fits wheel segments perfectly)

## Project Structure

```
src/
├── components/
│   ├── WellnessWheel.tsx    # Main wellness wheel component
│   ├── WellnessApp.tsx      # Main app container
│   ├── WellnessAssessment.tsx # Assessment form
│   └── VertexAIDebug.tsx    # Debug tool for Vertex AI testing
├── services/
│   └── oauth-vertex-ai.ts  # Vertex AI integration service
├── config/
│   └── vertex-ai.ts        # Vertex AI configuration
├── App.tsx                  # Root application component
├── App.css                  # Application styles
├── index.tsx                # Application entry point
└── index.css               # Global styles
```

## Key Features Explained

### Text Summarization
The app includes intelligent text summarization that:
- Extracts key metrics (financial figures, years, health data)
- Creates cogent summaries based on ring type
- Avoids truncation by using only words that fit

### Curved Text Rendering
Advanced SVG text rendering features:
- Multi-line curved text that follows arc paths
- Proper text wrapping within segment boundaries
- Top-down reading order for natural flow
- Consistent spacing and typography

### Interactive Elements
- Hover effects on segments
- Click to view detailed modal with summaries and full responses
- Responsive design that works on different screen sizes

## Development

### Available Scripts

- `npm start` - Runs the app in development mode
- `npm run start:local` - Runs locally with localhost binding (avoids hostname issues)
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (not recommended)

## Troubleshooting

### Common Issues

#### Hostname Resolution Problems
If you encounter hostname issues when starting the app:
```bash
# Use the local-only script instead
npm run start:local
```

#### Vertex AI API Errors
- **400 Error - Invalid Role**: Make sure you're using the Generative AI API endpoint (not Predict API)
- **400 Error - MAX_TOKENS**: The prompt is too long; check the prompt length in the console
- **No Text in Content Parts**: Response structure issue; check console logs for detailed debugging

#### OAuth Issues
- Ensure your OAuth client credentials are correct
- Check that your Google Cloud project has Vertex AI enabled
- Verify environment variables are set correctly

### Debug Mode
Use the built-in debug tool to test Vertex AI integration:
1. Click the purple "Show Debug" button
2. Run a test API call
3. Check console logs for detailed information
4. Verify OAuth token generation and API responses

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Development Notes

### What We Learned Building This

#### Vertex AI Integration Challenges
1. **API Endpoint Differences**: Gemini models require the Generative AI API (`:generateContent`), not the Predict API (`:predict`)
2. **Role-Based Messaging**: The API expects `role: "user"` for input messages
3. **Response Structure**: Gemini responses use `candidates[0].content.parts[0].text` structure
4. **Token Management**: Balance between detailed prompts and response quality

#### Debugging Strategy
- **Comprehensive Logging**: Added detailed console logs at every step
- **Isolated Testing**: Created debug component for single API call testing
- **Step-by-Step Debugging**: Check each level of the response object
- **Fallback Handling**: Graceful degradation when AI fails

#### Best Practices
- **Environment Variables**: Use `.env` files for configuration
- **Error Handling**: Provide meaningful error messages and fallbacks
- **User Experience**: Clear feedback during API calls and errors
- **Documentation**: Document setup process and troubleshooting steps

## License

This project is licensed under the MIT License.
