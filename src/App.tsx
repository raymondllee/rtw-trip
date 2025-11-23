import React, { useState } from 'react';
import WellnessApp from './components/WellnessApp';
import VertexAIDebug from './components/VertexAIDebug';
import './App.css';

function App() {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <div className="App">
      {/* Debug component */}
      {showDebug && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 overflow-auto">
          <div className="min-h-screen p-4">
            <VertexAIDebug />
          </div>
        </div>
      )}

      {/* Main app */}
      <WellnessApp showDebug={showDebug} setShowDebug={setShowDebug} />
    </div>
  );
}

export default App;
