import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function Setup() {
  const navigate = useNavigate();
  
  // State for Step 1: Schema Definition
  const [fields, setFields] = useState([{ name: "name", type: "string" }]);
  const [schemaStatus, setSchemaStatus] = useState({ type: "", msg: "" });
  
  // State for Step 2: File Upload
  const [file, setFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState({ type: "", msg: "" });

  // --- Handlers for Step 1 ---
  const handleSaveSchema = async () => {
    // Basic validation: ensure no empty names
    if (fields.some((f) => f.name.trim() === "")) {
      setSchemaStatus({ type: "error", msg: "Field names cannot be empty." });
      return;
    }

    try {
      setSchemaStatus({ type: "loading", msg: "Saving schema..." });
      await api.post("/fields", { fields });
      
      // LOGIC FIX: Send them DIRECTLY to the dashboard once saved!
      navigate("/dashboard");
    } catch (err: any) {
      setSchemaStatus({ 
        type: "error", 
        msg: err.response?.data?.error || "Failed to save schema." 
      });
    }
  };

  const updateField = (index: number, key: "name" | "type", value: string) => {
    const newFields = [...fields];
    newFields[index][key] = value;
    setFields(newFields);
  };

  // --- Handlers for Step 2 ---
  const handleUpload = async () => {
    if (!file) {
      setUploadStatus({ type: "error", msg: "Please select a file first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadStatus({ type: "loading", msg: "Uploading and validating..." });
      const res = await api.post("/upload", formData);
      
      navigate("/staging", { 
        state: { stats: res.data } 
      }); 
    } catch (err: any) {
      setUploadStatus({ 
        type: "error", 
        msg: err.response?.data?.details || err.response?.data?.error || "Upload failed." 
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* STEP 1: DEFINE SCHEMA */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">1. Define Your Data Schema</h2>
          
          <div className="space-y-4 mb-6">
            {fields.map((f, i) => (
              <div key={i} className="flex gap-4 items-center">
                <input 
                  type="text"
                  className="flex-1 border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                  placeholder="Column name (e.g., price)" 
                  value={f.name} 
                  onChange={e => updateField(i, "name", e.target.value)} 
                />
                <select 
                  className="w-40 border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white" 
                  value={f.type} 
                  onChange={e => updateField(i, "type", e.target.value)}
                >
                  <option value="string">Text (String)</option>
                  <option value="number">Number</option>
                </select>
                {fields.length > 1 && (
                  <button 
                    onClick={() => setFields(fields.filter((_, idx) => idx !== i))}
                    className="text-red-500 hover:text-red-700 font-bold px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setFields([...fields, { name: "", type: "string" }])} 
              className="text-blue-600 font-medium hover:text-blue-800"
            >
              + Add another column
            </button>
            <button 
              onClick={handleSaveSchema} 
              className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              Save Schema & Proceed
            </button>
          </div>
          
          {schemaStatus.msg && schemaStatus.type === 'error' && (
            <p className="mt-4 text-sm font-medium text-red-600">
              {schemaStatus.msg}
            </p>
          )}
        </div>

        {/* STEP 2: UPLOAD CSV */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">2. Or Upload CSV (Requires Schema)</h2>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-6 hover:bg-gray-50 transition-colors">
            <input 
              type="file" 
              accept=".csv" 
              onChange={(e) => setFile(e.target.files?.[0] || null)} 
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
            />
          </div>
          
          <button 
            onClick={handleUpload} 
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Upload and Process
          </button>
          
          {uploadStatus.msg && (
            <p className={`mt-4 p-3 rounded text-sm font-medium ${
              uploadStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {uploadStatus.msg}
            </p>
          )}
        </div>

      </div>
    </div>
  );
}