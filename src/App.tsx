import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Home } from '@/pages/Home'
import { Standings } from '@/pages/Standings'
import { Matchups } from '@/pages/Matchups'
import { PowerRankings } from '@/pages/PowerRankings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/matchups" element={<Matchups />} />
          <Route path="/power-rankings" element={<PowerRankings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
