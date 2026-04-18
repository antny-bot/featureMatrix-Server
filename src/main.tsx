import { createRoot } from 'react-dom/client';
import App from './components/App.jsx';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(<App />);
