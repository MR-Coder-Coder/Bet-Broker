import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const ProtectedRoute = ({ children, requiredRole }) => {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      const user = auth.currentUser;
      if (!user) {
        // If no user is logged in, redirect to login
        navigate('/');
        return;
      }

      // Get user data from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check if the user has the required role
        if (userData.role === requiredRole) {
          setIsAuthorized(true);
        } else {
          navigate('/access-denied'); // Redirect if the user does not have the correct role
        }
      } else {
        navigate('/'); // Redirect to login if user document not found
      }
    };

    checkUserRole();
  }, [navigate, requiredRole]);

  // Render the protected component only if the user is authorized
  return isAuthorized ? children : null;
};

export default ProtectedRoute;
