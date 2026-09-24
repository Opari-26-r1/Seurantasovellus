import { useEffect, useState } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/status`)
      .then((res) => res.json())
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Seurantasovellus</h1>
        {error && <p>Backend ei vastaa: {error}</p>}
        {!status && !error && <p>Ladataan...</p>}
        {status && (
          <>
            <p>Backend: {status.backend}</p>
            <p>Tietokanta: {status.database}</p>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
