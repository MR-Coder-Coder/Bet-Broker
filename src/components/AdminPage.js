// AdminPage.js
import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const AdminPage = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Create a real-time listener for the users collection
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    }, (error) => {
      console.error("Error fetching users:", error);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Helper function to convert Firestore timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'No data';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }) + ' UTC';
  };

  // Get counts for each role
  const agentCount = users.filter(user => user.role === 'agent').length;
  const traderCount = users.filter(user => user.role === 'trader').length;
  const managerCount = users.filter(user => user.role === 'manager').length;
  const totalUsers = agentCount + traderCount + managerCount;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>
      
      {/* User Count Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-4 border">
          <h3 className="text-lg font-semibold text-gray-600">Total Users</h3>
          <p className="text-2xl font-bold">{totalUsers}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border">
          <h3 className="text-lg font-semibold text-gray-600">Agents</h3>
          <p className="text-2xl font-bold">{agentCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border">
          <h3 className="text-lg font-semibold text-gray-600">Traders</h3>
          <p className="text-2xl font-bold">{traderCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4 border">
          <h3 className="text-lg font-semibold text-gray-600">Managers</h3>
          <p className="text-2xl font-bold">{managerCount}</p>
        </div>
      </div>

      {/* Existing Agents Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users
            .filter(user => user.role === 'agent')
            .map(agent => (
              <div key={agent.id} className="bg-white rounded-lg shadow-md p-4 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${agent.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium text-black">{agent.Identifier}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${agent.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {agent.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Last Active: {formatTimestamp(agent.lastActive)}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* Existing Traders Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Traders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users
            .filter(user => user.role === 'trader')
            .map(trader => (
              <div key={trader.id} className="bg-white rounded-lg shadow-md p-4 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${trader.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium text-black">{trader.Identifier}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${trader.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {trader.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Last Active: {formatTimestamp(trader.lastActive)}
                </p>
              </div>
            ))}
        </div>
      </div>

      {/* New Managers Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Managers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users
            .filter(user => user.role === 'manager')
            .map(manager => (
              <div key={manager.id} className="bg-white rounded-lg shadow-md p-4 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${manager.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="font-medium text-black">{manager.Identifier}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${manager.isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {manager.isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Last Active: {formatTimestamp(manager.lastActive)}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
