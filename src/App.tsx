import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/Layout'
import { Standings } from '@/pages/Standings'
import { Matchups } from '@/pages/Matchups'
import { PowerRankings } from '@/pages/PowerRankings'
import { Transactions } from '@/pages/Transactions'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Standings />} />
          <Route path="/matchups" element={<Matchups />} />
          <Route path="/power-rankings" element={<PowerRankings />} />
          <Route path="/transactions" element={<Transactions />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
