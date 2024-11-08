import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
      <p className="mb-6">The page you are looking for does not exist.</p>
      <button
        onClick={() => navigate('/')}
        className="bg-blue-500 text-white p-3 rounded hover:bg-blue-700"
      >
        Go to Home
      </button>
    </div>
  );
};

export default NotFoundPage;
