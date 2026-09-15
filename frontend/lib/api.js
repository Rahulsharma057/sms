import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================
// PDF DOWNLOAD HELPERS
// ============================================================
// These use responseType: "blob" since the server streams raw PDF
// bytes, not JSON. If the server responds with an error, axios still
// returns it as a Blob (because of responseType), so we read it back
// as text/JSON to get a real error message instead of "[object Blob]".

const extractBlobErrorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return error?.response?.data?.message || error?.message || fallback;
};

const triggerBlobDownload = (blobData, filename) => {
  const blob = new Blob([blobData], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

// Single report PDF
export const downloadInspectionReportPdf = async (reportId, reportedByName = "report") => {
  try {
    const res = await api.get(`/inspection-reports/${reportId}/pdf`, { responseType: "blob" });
    triggerBlobDownload(res.data, `inspection-${reportedByName}-${reportId}.pdf`);
  } catch (error) {
    const message = await extractBlobErrorMessage(error, "Could not download PDF.");
    throw new Error(message);
  }
};

// Multiple reports combined into one PDF
export const downloadInspectionReportsBulkPdf = async (reportIds) => {
  if (!Array.isArray(reportIds) || reportIds.length === 0) {
    throw new Error("Select at least one report.");
  }

  try {
    const res = await api.post(
      "/inspection-reports/bulk-pdf",
      { reportIds },
      { responseType: "blob" },
    );
    triggerBlobDownload(res.data, `inspection-reports-${Date.now()}.pdf`);
  } catch (error) {
    const message = await extractBlobErrorMessage(error, "Could not download combined PDF.");
    throw new Error(message);
  }
};

export default api;