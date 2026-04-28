// src/utils/pdfExport.js
import jsPDF from "jspdf";
import "jspdf-autotable";

export function exportAttendancePdf(filename, summaryRows) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Attendance Summary Report", 14, 18);

  const head = [["S.No", "Name", "Register No", "Total", "Present", "%"]];

  const body = summaryRows.map((row, index) => [
    index + 1,
    row.name,
    row.registerNo || "",
    row.totalClasses,
    row.presentCount,
    row.percentage + "%",
  ]);

  doc.autoTable({
    head,
    body,
    startY: 24,
  });

  doc.save(filename);
}
