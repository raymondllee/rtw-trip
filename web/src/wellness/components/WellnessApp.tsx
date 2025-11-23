import React, { useState, useEffect } from 'react';
import { ClipboardList, Eye, Upload, Grid3X3, Circle, RefreshCw, Printer, FileUp, Edit } from 'lucide-react';
import WellnessAssessment from './WellnessAssessment';
import WellnessWheel from './WellnessWheel';
import WellnessGrid from './WellnessGrid';
import AssessmentImporter from './AssessmentImporter';
import AssessmentEditor from './AssessmentEditor';
import UserManager from './UserManager';
import { transformAssessmentToWheel, createEmptyResponses } from '../utils/dataTransformation';
import { ParsedAssessment, convertToAssessmentFormFormat } from '../utils/assessmentParser';
import { wellnessFirebaseService, WellnessUserData } from '../services/wellnessFirebaseService';

type UserData = WellnessUserData;

type AppMode = 'welcome' | 'assessment' | 'visualization' | 'edit' | 'manage-users';
type ViewMode = 'wheel' | 'grid';

interface WellnessAppProps {
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
}

const WellnessApp: React.FC<WellnessAppProps> = ({ showDebug, setShowDebug }) => {
  const [currentMode, setCurrentMode] = useState<AppMode>('welcome');
  const [currentResponses, setCurrentResponses] = useState<Record<string, string>>({});
  const [wheelResponses, setWheelResponses] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState<string>('');
  const [showImporter, setShowImporter] = useState(false);
  const [showVisualization, setShowVisualization] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('wheel');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [allUsers, setAllUsers] = useState<UserData[]>([]);

  // Load any existing responses from storage on component mount
  useEffect(() => {
    const loadUserData = async () => {
      const savedViewMode = localStorage.getItem('wellness_wheel_view_mode');

      // Load all users
      const users = await wellnessFirebaseService.getAllUsers();
      setAllUsers(users);

      // Load current user from storage
      const savedCurrentUserId = wellnessFirebaseService.getCurrentUser();
      if (savedCurrentUserId) {
        setCurrentUserId(savedCurrentUserId);
        const userData = await wellnessFirebaseService.getUserById(savedCurrentUserId);
        if (userData) {
          setCurrentUserData(userData);
          setCurrentResponses(userData.responses || {});
          setWheelResponses(transformAssessmentToWheel(userData.responses || {}));
          setUserName(userData.userName);
        }
      }

      if (savedViewMode && (savedViewMode === 'wheel' || savedViewMode === 'grid')) {
        setViewMode(savedViewMode as ViewMode);
      }
    };

    loadUserData();
  }, []);

  // Save view mode to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('wellness_wheel_view_mode', viewMode);
  }, [viewMode]);

  const handleAssessmentComplete = async (responses: Record<string, string>, name: string) => {
    setCurrentResponses(responses);
    setUserName(name);
    const transformed = transformAssessmentToWheel(responses);
    setWheelResponses(transformed);
    
    // Create or update user
    if (currentUserId) {
      // Update existing user
      const userData: UserData = {
        userId: currentUserId,
        userName: name,
        responses: responses,
        lastUpdated: new Date().toISOString()
      };
      await wellnessFirebaseService.saveUser(userData);
      setCurrentUserData(userData);
    } else {
      // Create new user
      const userId = wellnessFirebaseService.generateUserId(name);
      const userData: UserData = {
        userId,
        userName: name,
        responses: responses,
        lastUpdated: new Date().toISOString()
      };
      await wellnessFirebaseService.saveUser(userData);
      wellnessFirebaseService.setCurrentUser(userId);
      setCurrentUserId(userId);
      setCurrentUserData(userData);
    }
    
    setCurrentMode('visualization');
  };


  const handleBackToWelcome = () => {
    setShowVisualization(false);
    setCurrentMode('welcome');
  };

  const handlePrint = () => {
    setIsPrintMode(true);
    // Small delay to ensure the print mode renders before printing
    setTimeout(() => {
      window.print();
      // Reset print mode after printing
      setTimeout(() => setIsPrintMode(false), 100);
    }, 100);
  };

  const handleNewUserCreated = async () => {
    // Reload user list
    const users = await wellnessFirebaseService.getAllUsers();
    setAllUsers(users);

    // Redirect new user to home screen to start assessment
    setShowVisualization(false);
    setCurrentMode('welcome');
  };

  const handleJsonImported = async () => {
    // Reload user list after JSON import
    const users = await wellnessFirebaseService.getAllUsers();
    setAllUsers(users);

    // If a user is currently selected, reload their data to show the imported changes
    if (currentUserId) {
      const userData = await wellnessFirebaseService.getUserById(currentUserId);
      if (userData) {
        setCurrentUserData(userData);
        setCurrentResponses(userData.responses || {});
        setWheelResponses(transformAssessmentToWheel(userData.responses || {}));
        setUserName(userData.userName);
      }
    }
  };

  const handleRegenerateSummaries = async () => {
    if (currentUserId && window.confirm('This will overwrite your existing summaries. Are you sure you want to regenerate them?')) {
      // Update user data to trigger summary regeneration
      if (currentUserData) {
        const updatedUserData = {
          ...currentUserData,
          summaries: {}, // Clear summaries to force regeneration
          lastUpdated: new Date().toISOString()
        };
        await wellnessFirebaseService.saveUser(updatedUserData);
        setCurrentUserData(updatedUserData);
      }
    }
  };

  const handleStartNewAssessment = () => {
    setCurrentResponses(createEmptyResponses());
    setWheelResponses({});
    setCurrentMode('assessment');
  };

  const handleContinueAssessment = () => {
    setCurrentMode('assessment');
  };


  const handleAssessmentImported = async (assessment: ParsedAssessment) => {
    // Convert assessment data to the format expected by the assessment form
    const convertedResponses = convertToAssessmentFormFormat(assessment);
    
    // Set the responses and user name
    setCurrentResponses(convertedResponses);
    setUserName(assessment.name);
    
    // Transform for the wheel display
    const transformed = transformAssessmentToWheel(convertedResponses);
    setWheelResponses(transformed);
    
    // Create or update user
    if (currentUserId) {
      // Update existing user - clear existing summaries to force regeneration
      const userData: UserData = {
        userId: currentUserId,
        userName: assessment.name,
        responses: convertedResponses,
        lastUpdated: new Date().toISOString()
      };
      await wellnessFirebaseService.saveUser(userData);
      setCurrentUserData(userData);
    } else {
      // Create new user
      const userId = wellnessFirebaseService.generateUserId(assessment.name);
      const userData: UserData = {
        userId,
        userName: assessment.name,
        responses: convertedResponses,
        lastUpdated: new Date().toISOString()
      };
      wellnessFirebaseService.saveUser(userData);
      wellnessFirebaseService.setCurrentUser(userId);
      setCurrentUserId(userId);
      setCurrentUserData(userData);
    }
    
    // Close the importer and go to visualization
    setShowImporter(false);
    setCurrentMode('visualization');
  };

  const handleUserChange = async (userId: string | null) => {
    setCurrentUserId(userId);
    if (userId) {
      const userData = await wellnessFirebaseService.getUserById(userId);
      if (userData) {
        setCurrentUserData(userData);
        setCurrentResponses(userData.responses || {});
        setWheelResponses(transformAssessmentToWheel(userData.responses || {}));
        setUserName(userData.userName);
      }
    } else {
      setCurrentUserData(null);
      setCurrentResponses({});
      setWheelResponses({});
      setUserName('');
    }
  };

  const handleUserDataChange = (userData: UserData | null) => {
    setCurrentUserData(userData);
  };

  const hasExistingData = Object.keys(currentResponses).length > 0;

  const renderWelcomeScreen = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-16 px-4">
      {/* Minimal debug toggle button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-gray-500 hover:text-gray-700 bg-white bg-opacity-50 px-2 py-1 rounded"
          title="Toggle debug mode"
        >
          {showDebug ? 'Hide Debug' : 'Debug'}
        </button>
      </div>
      
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Wellness Wheel
          </h1>
          {userName && (
            <p className="text-2xl text-blue-600 mb-4">
              Welcome back, {userName}! 👋
            </p>
          )}
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover the interconnected dimensions of your life through our comprehensive assessment 
            and beautiful visualization tool.
          </p>
        </div>

        {/* Streamlined User Selection */}
        <div className="bg-white rounded-xl p-6 shadow-lg border mb-8">
          <div className="flex items-center justify-center gap-4">
            <select
              value={currentUserId || ''}
              onChange={(e) => handleUserChange(e.target.value || null)}
              className="text-lg border-2 border-gray-300 rounded-lg px-6 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-80"
            >
              <option value="">Choose a user to get started</option>
              {allUsers.map(user => (
                <option key={user.userId} value={user.userId}>
                  {user.userName}
                </option>
              ))}
            </select>
            <button
              onClick={() => setCurrentMode('manage-users')}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
            >
              Manage Users
            </button>
          </div>
        </div>

        {/* Main Actions */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white rounded-xl p-8 shadow-lg border text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={32} className="text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">Take Assessment</h3>
            <p className="text-gray-600 mb-6">
              Complete our comprehensive wellness assessment covering 7 life dimensions.
            </p>
            <button
              onClick={handleStartNewAssessment}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Start Assessment
            </button>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye size={32} className="text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">View Results</h3>
            <p className="text-gray-600 mb-6">
              Explore your wellness data with interactive visualizations.
            </p>
            {hasExistingData ? (
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setViewMode('wheel');
                    setShowVisualization(true);
                  }}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <Circle size={20} />
                  View Wheel
                </button>
                <button
                  onClick={() => {
                    setViewMode('grid');
                    setShowVisualization(true);
                  }}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  <Grid3X3 size={20} />
                  View Grid
                </button>
              </div>
            ) : (
              <button
                disabled
                className="w-full bg-gray-300 text-gray-500 py-3 px-6 rounded-lg cursor-not-allowed font-semibold"
              >
                Complete Assessment First
              </button>
            )}
          </div>
        </div>

        {/* Import Assessment Card */}
        <div className="bg-white rounded-xl p-6 shadow-lg border text-center max-w-md mx-auto">
          <div className="flex items-center justify-center gap-3 mb-3">
            <FileUp size={24} className="text-purple-600" />
            <h3 className="text-lg font-bold text-gray-800">Import Assessment</h3>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Have existing assessment data? Import it to restore your wellness wheel.
          </p>
          <button
            onClick={() => setShowImporter(true)}
            className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors font-semibold"
          >
            Import from File
          </button>
        </div>

      </div>
    </div>
  );

  const renderAssessmentMode = () => (
    <WellnessAssessment
      onComplete={handleAssessmentComplete}
      initialResponses={currentResponses}
      initialUserName={userName}
      onBack={handleBackToWelcome}
    />
  );

  const handleEditSave = async (responses: Record<string, string>) => {
    setCurrentResponses(responses);
    const transformed = transformAssessmentToWheel(responses);
    setWheelResponses(transformed);

    // Update user in Firebase
    if (currentUserId && currentUserData) {
      const updatedUser = {
        ...currentUserData,
        responses,
        lastUpdated: new Date().toISOString()
      };
      await wellnessFirebaseService.saveUser(updatedUser);
      setCurrentUserData(updatedUser);
    }

    setCurrentMode('visualization');
  };

  const renderEditMode = () => (
    <AssessmentEditor
      initialResponses={currentResponses}
      userName={userName}
      onSave={handleEditSave}
      onCancel={() => setCurrentMode('visualization')}
    />
  );

  const renderManageUsersMode = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Manage Users</h1>
          <button
            onClick={() => setCurrentMode('welcome')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
        <div className="bg-white rounded-xl p-8 shadow-lg border">
          <UserManager
            currentUserId={currentUserId}
            onUserChange={handleUserChange}
            onUserDataChange={handleUserDataChange}
            onNewUserCreated={handleNewUserCreated}
          />
        </div>
      </div>
    </div>
  );

  const renderVisualizationMode = () => (
    <div className={`min-h-screen bg-gray-50 ${isPrintMode ? 'print-mode' : ''}`}>
      {/* Ultra-Compact Top Navigation - Hidden in Print Mode */}
      {!isPrintMode && (
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToWelcome}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Back
                </button>
                <div className="h-3 w-px bg-gray-300"></div>
                {/* Minimal View Toggle */}
                <div className="flex items-center gap-0.5 bg-gray-100 rounded p-0.5">
                  <button
                    onClick={() => setViewMode('wheel')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      viewMode === 'wheel'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Wheel
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    Grid
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Minimal User Selector */}
                <select
                  value={currentUserId || ''}
                  onChange={(e) => handleUserChange(e.target.value || null)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select User</option>
                  {allUsers.map(user => (
                    <option key={user.userId} value={user.userId}>
                      {user.userName}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setCurrentMode('edit')}
                  className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                  title="Edit assessment responses"
                >
                  <Edit size={12} />
                </button>
                <button
                  onClick={handleRegenerateSummaries}
                  className="px-2 py-1 bg-orange-600 text-white rounded text-xs hover:bg-orange-700 transition-colors"
                  title="Regenerate summaries"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  onClick={handlePrint}
                  className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                  title="Print visualization"
                >
                  <Printer size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Maximized Visualization Area */}
      <div className="max-w-7xl mx-auto px-4 py-1">
        {/* Simple Title */}
        <div className="text-center mb-3">
          <h1 className="text-lg font-semibold text-gray-800">
            {userName ? `${userName}'s Wellness ${viewMode === 'wheel' ? 'Wheel' : 'Grid'}` : `Wellness ${viewMode === 'wheel' ? 'Wheel' : 'Grid'}`}
          </h1>
        </div>
        
        {viewMode === 'wheel' ? (
          <WellnessWheel 
            customResponses={wheelResponses} 
            userName={userName}
            userId={currentUserId || undefined}
            userData={currentUserData || undefined}
          />
        ) : (
          <WellnessGrid 
            customResponses={wheelResponses} 
            userName={userName}
            userId={currentUserId}
            userData={currentUserData}
          />
        )}
      </div>
    </div>
  );

  // Render the appropriate component based on current mode
  const renderCurrentMode = () => {
    switch (currentMode) {
      case 'welcome':
        return renderWelcomeScreen();
      case 'assessment':
        return renderAssessmentMode();
      case 'visualization':
        return renderVisualizationMode();
      case 'edit':
        return renderEditMode();
      case 'manage-users':
        return renderManageUsersMode();
      default:
        return renderWelcomeScreen();
    }
  };

  return (
    <>
      {showVisualization ? renderVisualizationMode() : renderCurrentMode()}
      
      {/* Assessment Importer Modal */}
      {showImporter && (
        <AssessmentImporter
          onAssessmentImported={handleAssessmentImported}
          onClose={() => setShowImporter(false)}
          onJsonImported={handleJsonImported}
        />
      )}
    </>
  );
};

export default WellnessApp;
