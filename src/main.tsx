import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './lib/i18n'
import './index.css'
import { supabase } from './lib/supabase'

// Pages
import Dashboard from './pages/Dashboard'
import Busca from './pages/Busca'
import Cifras from './pages/Cifras'
import Layout from './components/Layout'
import Login from './pages/Login'

import MinhasCifras from './pages/MinhasCifras'
import MeusSetlists from './pages/MeusSetlists'
import Setlist from './pages/Setlist'
import ChordMaker from './pages/ChordMaker'

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/repertorio" element={<MinhasCifras />} />
          <Route path="/setlists" element={<MeusSetlists />} />
          <Route path="/setlists/:id" element={<Setlist />} />
          <Route path="/song/:id" element={<Cifras />} />
          <Route path="/chord-maker" element={<ChordMaker />} />
          <Route path="/search" element={<Busca />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
