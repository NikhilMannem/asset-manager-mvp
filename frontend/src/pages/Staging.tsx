import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Staging() {
  const [invalidRows, setInvalidRows] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const navigate = useNavigate();

  // Load the broken data when the page opens
  useEffect(() => {
    fetchInvalid();
  }, []);

  const fetchInvalid = async () => {
    try {
      const res = await api.get("/staged/invalid");
      setInvalidRows(res.data);
    } catch (err) {
      console.error("Failed to fetch invalid rows", err);
    }
  };

  // --- Editing Handlers ---
  const startEditing = (row: any) => {
    setEditingId(row.id);
    // Format the JSON nicely with 2 spaces for the textarea
    setEditContent(JSON.stringify(row.raw_data, null, 2)); 
  };

  const handleSave = async (id: number) => {
    try {
      // 1. Ensure they typed valid JSON
      const parsedData = JSON.parse(editContent);
      
      // 2. Send the fix to the backend
      const res = await api.patch(`/staged/${id}`, parsedData);
      
      if (res.data.valid) {
        // If the backend says it's fixed, remove it from the screen!
        setInvalidRows(prev => prev.filter(row => row.id !== id));
        setEditingId(null);
      } else {
        alert("The data is still invalid according to your schema.");
        fetchInvalid(); // Refresh to show the latest backend errors
      }
    } catch (e) {
      alert("Invalid JSON format. Please check your brackets and quotes.");
    }
  };

  // --- Commit Handler ---
  const handleCommit = async () => {
    try {
      await api.post("/staged/commit");
      navigate("/dashboard"); // Take them to the final view!
    } catch (err) {
      alert("Failed to commit data.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Staging</h1>
            <p className="text-gray-500 text-sm mt-1">Review and fix rows that didn't match your schema.</p>
          </div>
          <button 
            onClick={handleCommit} 
            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-sm transition-colors"
          >
            Commit Valid Data →
          </button>
        </div>

        {/* LIST OF ERRORS */}
        <div className="space-y-4">
          {invalidRows.length === 0 ? (
            <div className="bg-green-50 border border-green-200 text-green-800 p-8 rounded-xl text-center">
              <h3 className="text-lg font-bold">All clear!</h3>
              <p>There are no invalid rows. You can commit your data now.</p>
            </div>
          ) : (
            invalidRows.map(row => (
              <div key={row.id} className="bg-white border border-red-200 p-6 rounded-xl shadow-sm">
                
                {/* Display Errors from Backend */}
                <div className="mb-4 bg-red-50 p-3 rounded border border-red-100">
                  <span className="font-bold text-red-700 text-sm block mb-1">Validation Errors:</span>
                  <ul className="list-disc list-inside text-sm text-red-600">
                    {row.errors?.map((err: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-semibold">{err.path?.join(".")}:</span> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* The Editor View */}
                {editingId === row.id ? (
                  <div className="space-y-3">
                    <textarea 
                      className="w-full font-mono text-sm bg-gray-900 text-green-400 p-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={5}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleSave(row.id)} 
                        className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
                      >
                        Save Fix
                      </button>
                      <button 
                        onClick={() => setEditingId(null)} 
                        className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-medium hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // The Read-Only View
                  <div className="flex justify-between items-start gap-4">
                    <pre className="bg-gray-50 p-4 rounded text-sm text-gray-700 overflow-x-auto flex-1 border border-gray-100">
                      {JSON.stringify(row.raw_data, null, 2)}
                    </pre>
                    <button 
                      onClick={() => startEditing(row)} 
                      className="bg-gray-900 text-white px-4 py-2 rounded font-medium hover:bg-gray-800 shrink-0"
                    >
                      Edit JSON
                    </button>
                  </div>
                )}
                
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}