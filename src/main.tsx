import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './lib/i18n'
import './index.css'

// Pages
import Dashboard from './pages/Dashboard'
import Search from './pages/Search'
import SongView from './pages/SongView'
import Layout from './components/Layout'

// Placeholder components
const SetlistView = () => <div className="p-20 text-foreground">Setlist View (Coming Soon)</div>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/setlist/:id" element={<SetlistView />} />
          <Route path="/song/:id" element={<SongView />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </StrictMode>,
)
