import React from "react";

function BulkUpload({ endpoints, setEndpoints }) {
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const baseName = file.name.split(".")[0];
    const folderName = baseName.charAt(0).toUpperCase() + baseName.slice(1);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;

      if (file.name.endsWith(".json")) {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            const enriched = data.map((ep) => ({
              url: ep.url,
              method: ep.method,
              folder: folderName,
              status: "Not Run",
              lastRun: "-",
            }));
            setEndpoints((prev) => [...prev, ...enriched]);
          } else {
            alert("Invalid JSON format. Must be an array of endpoints.");
          }
        } catch (err) {
          alert("Error parsing JSON file: " + err.message);
        }
      } else if (file.name.endsWith(".csv")) {
        try {
          const rows = text.trim().split("\n");
          const headers = rows[0].split(",").map((h) => h.trim());
          const data = rows.slice(1).map((row) => {
            const values = row.split(",").map((v) => v.trim());
            const obj = {};
            headers.forEach((h, i) => {
              obj[h] = values[i];
            });
            return {
              url: obj.url,
              method: obj.method,
              folder: folderName,
              status: "Not Run",
              lastRun: "-",
            };
          });
          setEndpoints((prev) => [...prev, ...data]);
        } catch (err) {
          alert("Error parsing CSV file: " + err.message);
        }
      } else {
        alert("Unsupported file type. Please upload JSON or CSV.");
      }
    };

    reader.readAsText(file);
  };

  return (
    <div>
      <h2>Bulk Upload</h2>
      <input type="file" accept=".json,.csv" onChange={handleFileUpload} />
      <p>{endpoints.length} endpoints loaded.</p>
    </div>
  );
}

export default BulkUpload;
