/**
 * Simple CSV parser that handles basic CSV files without external dependencies.
 * Supports quoted fields and basic escaping.
 */
export function parseCSV(text: string): { headers: string[]; data: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const normalizedHeaders = headers.map((h) => h.trim());

  // Parse data rows
  const data: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: Record<string, string> = {};
    normalizedHeaders.forEach((header, index) => {
      row[header] = values[index]?.trim() || "";
    });
    data.push(row);
  }

  return { headers: normalizedHeaders, data };
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        i++;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }

  // Add the last field
  result.push(current);

  return result;
}

