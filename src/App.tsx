import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Background } from './components/layout/Background';
import { Navbar } from './components/layout/Navbar';
import Dashboard from './pages/Dashboard';
import Scan from './pages/Scan';
import Reports from './pages/Reports';
import Framework from './pages/Framework';
import About from './pages/About';
import Settings from './pages/Settings';

export default function App() {
  const location = useLocation();

  return (
    <div className="relative flex min-h-screen flex-col">
      <Background />
      <Navbar />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/framework" element={<Framework />} />
              <Route path="/about" element={<About />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Dashboard />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="no-print mt-6 border-t border-hairline/70 bg-void/60 py-5">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left lg:px-8">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-ink-faint">
            DPDPA Sentinel v1.0 · Minor Project CSE_CS_32 · Silver Oak University
          </p>
          <p className="text-[0.68rem] text-ink-faint">
            Automated preliminary assessment — not a substitute for professional legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
