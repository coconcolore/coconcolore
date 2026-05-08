import { Toaster } from "sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import Layout from '@/components/Layout';
import Dashboard from '@/pages/Dashboard';
import Courses from '@/pages/Courses';
import CourseCreate from '@/pages/CourseCreate';
import CourseDetail from '@/pages/CourseDetail';
import Invoices from '@/pages/Invoices';
import ArtistSetup from '@/pages/ArtistSetup';
import AdminPanel from '@/pages/AdminPanel';
import PublicCoursePage from '@/pages/PublicCoursePage';
import ArtistPublicProfile from '@/pages/ArtistPublicProfile';
import PublicCatalog from '@/pages/PublicCatalog';
import SharedCalendar from '@/pages/SharedCalendar';
import Login from '@/pages/Login';
import AccessPending from '@/pages/AccessPending';

const PublicRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/kurs/:id" element={<PublicCoursePage />} />
    <Route path="/kuenstler/:id" element={<ArtistPublicProfile />} />
    <Route path="/kurskatalog-public" element={<PublicCatalog />} />
    <Route path="*" element={<AuthenticatedApp />} />
  </Routes>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/zugang-wartet" element={<AccessPending />} />
      {/* App with sidebar */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/kurskatalog" element={<PublicCatalog />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/new" element={<CourseCreate />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/profil" element={<ArtistSetup />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/kalender" element={<SharedCalendar />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <PublicRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;