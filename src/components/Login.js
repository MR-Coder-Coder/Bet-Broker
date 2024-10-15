import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import logo from '../logo.svg';

const Login = () => {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userDoc = doc(db, 'users', result.user.uid);
      const userSnap = await getDoc(userDoc);

      if (userSnap.exists()) {
        const role = userSnap.data().role;
        switch (role) {
          case 'admin':
            navigate('/admin');
            break;
          case 'manager':
            navigate('/manager');
            break;
          case 'client':
            navigate('/client');
            break;
          case 'agent':
            navigate('/agent');
            break;
          case 'trader':
            navigate('/trader');
            break;  
          default:
            navigate('/access-denied');
        }
      } else {
        navigate('/access-denied');
      }
    } catch (error) {
      console.error('Error during sign-in:', error);
      navigate('/access-denied');
    }
  };

  return (
    <div className="login-form bg-gray-900 text-white flex flex-col items-center mt-20">
      <img src={logo} alt="Logo" className="login-logo mb-8" style={{ width: '480px', height: '480px' }} />
      <h2 className="text-4xl font-bold mb-6">Login</h2>
      <button
        onClick={handleGoogleSignIn}
        className="google-sign-in-button flex items-center px-4 py-2 rounded bg-white text-black shadow-md hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className="google-icon w-6 h-6 mr-2"
          aria-hidden="true"
        >
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span>Sign in with Google</span>
      </button>
    </div>
  );
};

export default Login;
