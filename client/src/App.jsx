import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastContainer } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PresenterPage from './pages/PresenterPage';
import JoinPage from './pages/JoinPage';
import VoterPage from './pages/VoterPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Audience / Voter Routes (fully public) */}
          <Route path="/join" element={<JoinPage />} />
          <Route path="/join/:pin" element={<JoinPage />} />
          <Route path="/vote/:pin" element={<VoterPage />} />

          {/* Protected Presenter Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/presenter/:pin"
            element={
              <ProtectedRoute>
                <PresenterPage />
              </ProtectedRoute>
            }
          />

          {/* Default Redirects */}
          <Route path="/" element={<Navigate to="/join" replace />} />
          <Route path="*" element={<Navigate to="/join" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
