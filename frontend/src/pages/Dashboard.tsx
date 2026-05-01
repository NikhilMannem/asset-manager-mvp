import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Dashboard() {
  const [assets, setAssets] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]); 
  const navigate = useNavigate();

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({});

  // NEW: Custom Delete Modal State
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [assetsRes, fieldsRes] = await Promise.all([
        api.get("/assets"),
        api.get("/fields") 
      ]);
      
      setAssets(assetsRes.data);
      
      const fieldNames = fieldsRes.data
        .map((f: any) => f.name)
        .filter((colName: string) => colName !== "name");
        
      setColumns(fieldNames);
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("tenantId");
    navigate("/");
  };

  // --- DELETE LOGIC ---
  const triggerDelete = (id: number) => {
    setItemToDelete(id); // Opens the modal instead of window.confirm
  };

  const confirmDelete = async () => {
    if (itemToDelete === null) return;
    try {
      await api.delete(`/assets/${itemToDelete}`);
      setAssets(assets.filter((a) => a.id !== itemToDelete));
      setItemToDelete(null); // Close the modal
    } catch (err) {
      alert("Failed to delete asset.");
    }
  };

  // --- ADD/EDIT LOGIC ---
  const openModal = (asset?: any) => {
    if (asset) {
      setEditingId(asset.id);
      setFormData({ name: asset.name, ...asset.attributes });
    } else {
      setEditingId(null);
      const emptyForm: any = { name: "" };
      columns.forEach((col) => (emptyForm[col] = ""));
      setFormData(emptyForm);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/assets/${editingId}`, formData);
      } else {
        await api.post(`/assets/manual`, formData);
      }
      setIsModalOpen(false);
      fetchData(); 
    } catch (err: any) {
      alert("Failed to save: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Main Inventory Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">
              Workspace ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{localStorage.getItem("tenantId")?.split('-')[0]}...</span>
            </p>
          </div>
          <div className="flex gap-4">
            
            {/* NEW: Workspace Settings Button to access the Setup Page */}
            <button 
              onClick={() => navigate('/setup')} 
              className="text-gray-700 bg-white border border-gray-300 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors shadow-sm flex items-center gap-2"
            >
              ⚙️ Settings & Uploads
            </button>

            <button 
              onClick={() => openModal()} 
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              + Add Row
            </button>
            
            <button 
              onClick={handleLogout} 
              className="text-red-600 border border-red-200 bg-red-50 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {assets.length === 0 ? (
             <div className="p-12 text-center">
               <h3 className="text-lg font-medium text-gray-900">No data found</h3>
               <p className="mt-1 text-sm text-gray-500">Add a row manually or click "Settings & Uploads" to import a CSV.</p>
             </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-4 text-sm font-semibold text-gray-600">Name</th>
                    {columns.map((col) => (
                      <th key={col} className="p-4 text-sm font-semibold text-gray-600 capitalize">
                        {col}
                      </th>
                    ))}
                    <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assets.map(asset => (
                    <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-bold text-gray-900">{asset.name || "N/A"}</td>
                      {columns.map((col) => (
                        <td key={col} className="p-4 text-sm text-gray-600">
                          {asset.attributes[col] !== undefined ? String(asset.attributes[col]) : "—"}
                        </td>
                      ))}
                      <td className="p-4 text-right space-x-3">
                        <button 
                          onClick={() => openModal(asset)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm px-2 py-1 bg-blue-50 rounded"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => triggerDelete(asset.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm px-2 py-1 bg-red-50 rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* --- MODAL 1: ADD/EDIT ROW --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? "Edit Row" : "Add New Row"}</h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  required
                  className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {columns.map((col) => (
                <div key={col}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{col}</label>
                  <input 
                    type="text" 
                    className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData[col] || ""}
                    onChange={(e) => setFormData({ ...formData, [col]: e.target.value })}
                  />
                </div>
              ))}

              <div className="flex justify-end gap-3 pt-4 mt-6 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {editingId ? "Save Changes" : "Add Row"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: CUSTOM DELETE CONFIRMATION --- */}
      {itemToDelete !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center">
            
            {/* Warning Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <span className="text-2xl">⚠️</span>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Row</h3>
            <p className="text-gray-500 mb-6 text-sm">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            
            <div className="flex justify-center gap-3">
              <button 
                onClick={() => setItemToDelete(null)} 
                className="px-4 py-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-lg font-bold transition-colors w-full"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete} 
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-bold transition-colors w-full shadow-sm"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}