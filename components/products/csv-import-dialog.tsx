"use client";

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Upload, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { autoMapCsvColumns, validateMapping, type CsvColumnMapping } from "@/lib/csvMapping";
import { parseCSV } from "@/lib/csvParser";
import { cn } from "@/lib/utils";

type CsvImportDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function CsvImportDialog({ open, onClose, onSuccess }: CsvImportDialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<CsvColumnMapping>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setError(null);

    try {
      // Read file as text
      const text = await file.text();
      
      // Parse CSV using our simple parser
      const { headers, data } = parseCSV(text);

      if (headers.length === 0) {
        setError("CSV file has no headers");
        return;
      }

      setCsvHeaders(headers);
      setCsvData(data);
      
      // Auto-map columns
      const autoMapping = autoMapCsvColumns(headers);
      setMapping(autoMapping);
      
      // Move to step 2
      setStep(2);
    } catch (err: any) {
      setError("Failed to parse CSV: " + (err.message || String(err)));
      console.error(err);
    }
  };

  const handleMappingChange = (field: keyof CsvColumnMapping, csvColumn: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: csvColumn === "" ? undefined : csvColumn,
    }));
  };

  const handleImport = async () => {
    const validation = validateMapping(mapping);
    if (!validation.valid) {
      setError(`Missing required mappings: ${validation.missing.join(", ")}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Transform CSV data using mapping
      const products = csvData.map((row) => {
        const name = mapping.name ? (row[mapping.name] || "").trim() : "";
        const sku = mapping.sku ? (row[mapping.sku] || "").trim() : "";
        const price = mapping.price ? row[mapping.price] : null;
        const cost = mapping.cost ? row[mapping.cost] : null;
        const inventory = mapping.inventory ? row[mapping.inventory] : null;

        return {
          name: name || null,
          sku: sku || null,
          price: price ? Number(price) : null,
          cost: cost ? Number(cost) : null,
          inventory: inventory ? Number(inventory) : null,
        };
      }).filter((p) => p.name && p.sku && p.price !== null);

      if (products.length === 0) {
        setError("No valid products found after mapping");
        setIsSubmitting(false);
        return;
      }

      // Send to API
      const res = await fetch("/api/products/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          products,
          mapping,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Import failed");
        setIsSubmitting(false);
        return;
      }

      // Success
      onSuccess();
      handleClose();
    } catch (err) {
      console.error(err);
      setError("Unexpected error during import");
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setError(null);
    setIsSubmitting(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-2xl rounded-2xl bg-white shadow-xl p-6 space-y-6">
        <CardHeader className="p-0">
          <CardTitle>Import Products from CSV</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            {step === 1 ? "Upload your CSV file to get started" : "Map CSV columns to product fields"}
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 space-y-4">
          {/* Step 1: File Upload */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <Label htmlFor="csv-file" className="cursor-pointer">
                  <span className="text-blue-600 dark:text-blue-400 hover:underline">
                    Choose CSV file
                  </span>
                  <span className="text-muted-foreground"> or drag and drop</span>
                </Label>
                <Input
                  id="csv-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  CSV files only. Required columns: Name, SKU, Price
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground mb-4">
                Map your CSV columns to product fields. Required fields are marked with *.
              </div>

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <Label htmlFor="map-name">
                    Name <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    id="map-name"
                    value={mapping.name || ""}
                    onChange={(e) => handleMappingChange("name", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* SKU */}
                <div>
                  <Label htmlFor="map-sku">
                    SKU <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    id="map-sku"
                    value={mapping.sku || ""}
                    onChange={(e) => handleMappingChange("sku", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Price */}
                <div>
                  <Label htmlFor="map-price">
                    Price <span className="text-red-400">*</span>
                  </Label>
                  <Select
                    id="map-price"
                    value={mapping.price || ""}
                    onChange={(e) => handleMappingChange("price", e.target.value)}
                  >
                    <option value="">-- Select column --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Cost */}
                <div>
                  <Label htmlFor="map-cost">Cost (optional)</Label>
                  <Select
                    id="map-cost"
                    value={mapping.cost || ""}
                    onChange={(e) => handleMappingChange("cost", e.target.value)}
                  >
                    <option value="">-- Select column (optional) --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Inventory */}
                <div>
                  <Label htmlFor="map-inventory">Inventory (optional)</Label>
                  <Select
                    id="map-inventory"
                    value={mapping.inventory || ""}
                    onChange={(e) => handleMappingChange("inventory", e.target.value)}
                  >
                    <option value="">-- Select column (optional) --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2">
                {csvData.length} rows found in CSV
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {step === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
              >
                Back
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            {step === 2 && (
              <Button
                type="button"
                onClick={handleImport}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import Products
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

