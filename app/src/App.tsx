import { HashRouter, Route, Routes } from 'react-router'
import { DayPage } from './pages/DayPage'
import { DaysPage } from './pages/DaysPage'
import { NotesPage } from './pages/NotesPage'
import { PrintPage } from './pages/PrintPage'
import { SettingsPage } from './pages/SettingsPage'
import { BackendGate } from './state/backend'
import { JournalProvider } from './state/journal'
import { VaultGate } from './state/vault'

// Hash routing keeps the build host-agnostic: no server rewrite rules needed.
export default function App() {
  return (
    <BackendGate>
      <VaultGate>
        <JournalProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<DayPage />} />
              <Route path="/day/:date" element={<DayPage />} />
              <Route path="/days" element={<DaysPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/print/:period" element={<PrintPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<DayPage />} />
            </Routes>
          </HashRouter>
        </JournalProvider>
      </VaultGate>
    </BackendGate>
  )
}
