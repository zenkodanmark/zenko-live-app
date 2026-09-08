export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const lines = [header, ...rows].map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
