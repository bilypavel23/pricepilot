import { NextResponse } from "next/server";

function parseCSV(text: string) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i]?.trim() ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch feed" },
        { status: 400 }
      );
    }

    const text = await res.text();

    // jednoduchá detekce typu
    if (url.endsWith(".json") || text.trim().startsWith("[")) {
      const json = JSON.parse(text) as any[];

      if (!Array.isArray(json) || json.length === 0) {
        return NextResponse.json(
          { error: "JSON feed is empty or invalid" },
          { status: 400 }
        );
      }

      const headers = Object.keys(json[0]);

      return NextResponse.json({
        headers,
        rows: json,
        preview: json.slice(0, 5),
      });
    }

    // CSV default
    const { headers, rows } = parseCSV(text);

    return NextResponse.json({
      headers,
      rows,
      preview: rows.slice(0, 5),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to import feed" },
      { status: 500 }
    );
  }
}


