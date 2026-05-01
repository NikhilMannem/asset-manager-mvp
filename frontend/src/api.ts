import axios from "axios";

// Create a custom Axios instance pointing to your backend
export const api = axios.create({
  baseURL: "http://localhost:3000", // Make sure this matches your backend port!
});

// The Interceptor: Automatically attach the tenant ID if the user is logged in
api.interceptors.request.use((config) => {
  const tenantId = localStorage.getItem("tenantId");
  
  if (tenantId) {
    config.headers["x-tenant-id"] = tenantId;
  }
  
  return config;
});