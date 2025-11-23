import React, { useState, useEffect } from 'react';
import { User, Plus, Edit3, Trash2, Download, Upload, Check, X } from 'lucide-react';
import { wellnessFirebaseService, WellnessUserData } from '../services/wellnessFirebaseService';

type UserData = WellnessUserData;

interface UserManagerProps {
  currentUserId: string | null;
  onUserChange: (userId: string | null) => void;
  onUserDataChange: (userData: UserData | null) => void;
  onNewUserCreated?: () => void;
}

const UserManager: React.FC<UserManagerProps> = ({
  currentUserId,
  onUserChange,
  onUserDataChange,
  onNewUserCreated
}) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadUsers = async () => {
    setLoading(true);
    const allUsers = await wellnessFirebaseService.getAllUsers();
    setUsers(allUsers);

    // Load current user data
    if (currentUserId) {
      const userData = await wellnessFirebaseService.getUserById(currentUserId);
      onUserDataChange(userData);
    }
    setLoading(false);
  };

  const handleAddUser = async () => {
    if (newUserName.trim()) {
      const userId = wellnessFirebaseService.generateUserId(newUserName.trim());
      const userData: UserData = {
        userId,
        userName: newUserName.trim(),
        responses: {},
        lastUpdated: new Date().toISOString()
      };
      
      await wellnessFirebaseService.saveUser(userData);
      setNewUserName('');
      setShowAddUser(false);
      await loadUsers();
      onUserChange(userId);
      
      // Call the callback to redirect to home screen for new user
      if (onNewUserCreated) {
        onNewUserCreated();
      }
    }
  };

  const handleEditUser = (userId: string) => {
    const user = users.find(u => u.userId === userId);
    if (user) {
      setEditingUser(userId);
      setEditUserName(user.userName);
    }
  };

  const handleSaveEdit = async () => {
    if (editingUser && editUserName.trim()) {
      const user = users.find(u => u.userId === editingUser);
      if (user) {
        const updatedUser: UserData = {
          ...user,
          userName: editUserName.trim(),
          lastUpdated: new Date().toISOString()
        };

        await wellnessFirebaseService.saveUser(updatedUser);
        setEditingUser(null);
        setEditUserName('');
        await loadUsers();
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditUserName('');
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user and all their data?')) {
      await wellnessFirebaseService.deleteUser(userId);
      await loadUsers();

      if (currentUserId === userId) {
        onUserChange(null);
        onUserDataChange(null);
      }
    }
  };

  const handleSelectUser = async (userId: string) => {
    wellnessFirebaseService.setCurrentUser(userId);
    onUserChange(userId);
    const userData = await wellnessFirebaseService.getUserById(userId);
    onUserDataChange(userData);
  };

  const handleExportUser = async (userId: string) => {
    const exportData = await wellnessFirebaseService.exportUserData(userId);
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wellness-data-${userId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportUser = async () => {
    if (await wellnessFirebaseService.importUserData(importData)) {
      setImportData('');
      setShowImport(false);
      await loadUsers();
      alert('User data imported successfully!');
    } else {
      alert('Failed to import user data. Please check the format.');
    }
  };

  return (
    <div className="relative">
      {/* Clean User Selection */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Select User</h2>
        <div className="flex items-center justify-center gap-4">
          <select
            value={currentUserId || ''}
            onChange={(e) => onUserChange(e.target.value || null)}
            className="text-lg border-2 border-gray-300 rounded-lg px-6 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-80"
          >
            <option value="">Choose a user to get started</option>
            {users.map(user => (
              <option key={user.userId} value={user.userId}>
                {user.userName}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAddUser(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus size={20} />
            New User
          </button>
        </div>
      </div>

      {/* Simple Add User Modal */}
      {showAddUser && (
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 min-w-64">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="User name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <button
              onClick={handleAddUser}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setShowAddUser(false);
                setNewUserName('');
              }}
              className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}


      {/* Full User Management Panel */}
      <div>
        <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <User size={20} />
              User Management
            </h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddUser(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Plus size={16} />
                Add User
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                <Upload size={16} />
                Import
              </button>
            </div>
          </div>

      {/* Add User Form */}
      {showAddUser && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              placeholder="Enter user name"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleAddUser()}
            />
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setShowAddUser(false);
                setNewUserName('');
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Import Form */}
      {showImport && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <textarea
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Paste exported user data JSON here"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 h-32"
            />
            <div className="flex gap-2">
              <button
                onClick={handleImportUser}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportData('');
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No users found. Add a user to get started.</p>
        ) : (
          users.map((user) => (
            <div
              key={user.userId}
              className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                currentUserId === user.userId
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {editingUser === user.userId ? (
                  <input
                    type="text"
                    value={editUserName}
                    onChange={(e) => setEditUserName(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                      {user.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-800">{user.userName}</span>
                    {wellnessFirebaseService.hasSummaries(user.userId, user) && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        Has Summaries
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {editingUser === user.userId ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    {currentUserId !== user.userId && (
                      <button
                        onClick={() => handleSelectUser(user.userId)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                      >
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => handleEditUser(user.userId)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleExportUser(user.userId)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.userId)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default UserManager;
