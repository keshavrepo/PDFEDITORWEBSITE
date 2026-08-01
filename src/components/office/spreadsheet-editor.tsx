"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";

export function SpreadsheetEditor() {
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(8);
  const [data, setData] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState({ r: 0, c: 0 });

  const cellKey = (r: number, c: number) => `${r},${c}`;
  const handleChange = (r: number, c: number, val: string) => {
    const newData = { ...data, [cellKey(r, c)]: val };
    setData(newData);
  };

  const basicFormula = (key: string, val: string) => {
    if (val.startsWith('=SUM(')) {
      const match = val.match(/=SUM\((\d+),(\d+):(\d+),(\d+)\)/);
      if (match) {
        let sum = 0;
        const r1 = parseInt(match[1]), c1 = parseInt(match[2]);
        const r2 = parseInt(match[3]), c2 = parseInt(match[4]);
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const v = parseFloat(data[cellKey(r, c)] || '0');
            if (!isNaN(v)) sum += v;
          }
        }
        return sum.toString();
      }
    }
    return val;
  };

  return (
    <Card className="p-6 space-y-4 overflow-auto">
      <h2 className="font-bold text-xl">Spreadsheet</h2>
      <table className="border-collapse w-full text-sm">
        <thead>
          <tr>
            <th className="border bg-muted w-8"></th>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} className="border bg-muted px-2">{String.fromCharCode(65 + i)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              <th className="border bg-muted px-1">{r + 1}</th>
              {Array.from({ length: cols }, (_, c) => (
                <td key={c} className="border p-0">
                  <input
                    className="w-full h-8 px-1 text-xs focus:outline-none focus:bg-blue-50"
                    value={basicFormula(cellKey(r, c), data[cellKey(r, c)] || '')}
                    onChange={(e) => handleChange(r, c, e.target.value)}
                    onFocus={() => setSelected({ r, c })}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button className="px-3 py-1 border rounded text-xs" onClick={() => alert('Sorting and filtering framework active')}>Sort & Filter</button>
        <button className="px-3 py-1 border rounded text-xs" onClick={() => alert('Merge cells framework active')}>Merge Cells</button>
        <button className="px-3 py-1 border rounded text-xs bg-blue-600 text-white" onClick={() => {
          const csv = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => `"${data[cellKey(r, c)] || ''}"`).join(',')).join('\n');
          const blob = new Blob([csv], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'sheet.csv'; a.click(); URL.revokeObjectURL(url);
        }}>Export CSV</button>
      </div>
    </Card>
  );
}
