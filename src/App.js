// App.js - Main Application
import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import AdminPage from './components/AdminPage';
import ManagerPage from './components/ManagerPage';
import ClientPage from './components/ClientPage';
import AgentPage from './components/AgentPage';
import AccessDeniedPage from './components/AccessDeniedPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="/client" element={<ClientPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
      </Routes>
    </Router>
  );
}
export default App;
