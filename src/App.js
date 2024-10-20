// App.js - Main Application
import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/Login';
import AdminPage from './components/AdminPage';
import ManagerPage from './components/ManagerPage';
import ClientPage from './components/ClientPage';
import AgentPage from './components/AgentPage';
import TraderPage from './components/TraderPage';
import AccessDeniedPage from './components/AccessDeniedPage';
import Reports from './components/Reports'; // Import Reports component
import './output.css';
import SubmitRequest from "./components/SubmitRequest";
import SubmitRequestTrader from "./components/SubmitRequestTrader";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/manager" element={<ManagerPage />} />
        <Route path="/client" element={<ClientPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/trader" element={<TraderPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="/reports" element={<Reports />} />  {/* Add route for reports */}
        <Route path="/submit-request" element={<SubmitRequest />} />
        <Route path="/submit-request-trader" element={<SubmitRequestTrader />} />
      </Routes>
    </Router>
  );
}
export default App;
