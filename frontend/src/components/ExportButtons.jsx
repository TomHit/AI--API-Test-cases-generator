import React from "react";

export default function ExportButtons({ disabled, onExportJson, onExportCsv }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button style={styles.btn} disabled={disabled} onClick={onExportJson}>
        Export JSON
      </button>
      <button style={styles.btn} disabled={disabled} onClick={onExportCsv}>
        Export CSV
      </button>
    </div>
  );
}

const styles = {
  btn: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #ddd",
    background: "white",
    cursor: "pointer",
  },
};
