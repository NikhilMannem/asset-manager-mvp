import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Login() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [newTenantName, setNewTenantName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1. Fetch existing tenants from the database when the page loads
  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await api.get("/tenants");
      setTenants(res.data);
    } catch (err) {
      console.error("Failed to load tenants", err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Handle selecting an existing tenant
  const handleSelectTenant = (tenantId: string) => {
    localStorage.setItem("tenantId", tenantId);
    navigate("/dashboard"); // Go to schema setup
  };

  // 3. Handle creating a brand new tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTenantName.trim()) return;

    try {
      // Hit the new backend route you just created!
      const res = await api.post("/tenants", { name: newTenantName });
      
      const newTenant = res.data;
      
      // Save the REAL generated UUID to local storage
      localStorage.setItem("tenantId", newTenant.id);
      
      navigate("/setup");
    } catch (err: any) {
      alert("Failed to create tenant: " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">Welcome to the MVP</h2>
          <p className="mt-2 text-sm text-gray-600">Select your workspace to continue</p>
        </div>

        {/* Section 1: Create a NEW Tenant */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Create New Workspace</h3>
          <form onSubmit={handleCreateTenant} className="flex gap-3">
            <input
              type="text"
              placeholder="e.g., Tesla Corp"
              className="flex-1 border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={newTenantName}
              onChange={(e) => setNewTenantName(e.target.value)}
            />
            <button 
              type="submit"
              className="bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 transition-colors"
            >
              Create
            </button>
          </form>
        </div>

        {/* Section 2: Select EXISTING Tenant */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Existing Workspaces</h3>
          
          {loading ? (
            <p className="text-gray-500">Loading workspaces...</p>
          ) : tenants.length === 0 ? (
            <p className="text-gray-500 text-sm">No workspaces found. Create one above!</p>
          ) : (
            <ul className="space-y-3">
              {tenants.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    onClick={() => handleSelectTenant(tenant.id)}
                    className="w-full flex justify-between items-center text-left px-4 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none"
                  >
                    <span className="font-medium text-gray-900">{tenant.name}</span>
                    <span className="text-xs text-gray-400 font-mono hidden sm:inline-block">
                      {tenant.id.split('-')[0]}...
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}