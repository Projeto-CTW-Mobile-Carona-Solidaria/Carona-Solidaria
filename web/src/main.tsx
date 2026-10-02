import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider,useAuth } from './context/AuthContext';
import Admin from './panels/Admin';
import Login from './panels/Login';

function App(){const {user}=useAuth();return user?<Admin key={user.id}/>:<Login/>;}
createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App/></AuthProvider></StrictMode>);
