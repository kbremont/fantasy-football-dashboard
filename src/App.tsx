import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'
import { Standings } from '@/pages/Standings'
import { Matchups } from '@/pages/Matchups'
import { PowerRankings } from '@/pages/PowerRankings'
import { Rivals } from '@/pages/Rivals'
import { LeaguePulse } from '@/pages/LeaguePulse'
import { DraftGallery } from '@/pages/DraftGallery'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/matchups" element={<Matchups />} />
          <Route path="/power-rankings" element={<PowerRankings />} />
          <Route path="/rivals" element={<Rivals />} />
          <Route path="/league-pulse" element={<LeaguePulse />} />
          <Route path="/draft/:year" element={<DraftGallery />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
