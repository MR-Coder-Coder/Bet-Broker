// AccessDeniedPage.js
import React from 'react';
import accessDeniedImage from '../assets/access-denied.png';

const AccessDeniedPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100">
      <h1 className="text-5xl font-bold text-red-600 mb-4">Access Denied</h1>
      <img src={accessDeniedImage} alt="Access Denied" className="w-1/3 h-auto mb-6" />
      <p className="text-2xl text-gray-700">You do not have permission to access this page.</p>
    </div>
  );
};

export default AccessDeniedPage;