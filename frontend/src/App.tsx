import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Staging from "./pages/Staging";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* The starting page */}
        <Route path="/" element={<Login />} />
        
        {/* The onboarding / upload flow */}
        <Route path="/setup" element={<Setup />} />
        
        {/* The fix-it dashboard */}
        <Route path="/staging" element={<Staging />} />
        
        {/* The final data view */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* If a user types a random URL, send them back to login */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;