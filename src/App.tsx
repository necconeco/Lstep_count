import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1>Lステップ集計ツール</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Phase 3: フロントエンド基盤セットアップ完了
        </p>
      </div>
    </div>
  )
}

export default App
