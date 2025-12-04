"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Search, AlertCircle, Upload, Link2, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { isPlanLimitExceeded, type Plan } from "@/lib/planLimits";
import { cn } from "@/lib/utils";
import { CsvImportDialog } from "@/components/products/csv-import-dialog";
import { usePlan } from "@/components/providers/plan-provider";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  cost: number | null;
  inventory: number | null;
};

// TODO: Replace with real Supabase data_sources table
// Mock data source type for product feeds
type DataSource = {
  id: string;
  name?: string;
  url: string;
  type: "FEED" | "PRODUCT_FEED";
  createdAt: string;
};

// TODO: Replace with real sync status from Supabase cron job logs
const mockProductSyncStatus = {
  status: "synced" as "synced" | "syncing" | "error",
  lastSync: "Today, 14:32",
  source: "Feed URL",
};

function ProductTable({ 
  products, 
  loading, 
  error,
  onRefresh
}: { 
  products: Product[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    price: "",
    cost: "",
    inventory: "",
  });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      sku: product.sku || "",
      price: product.price?.toString() || "",
      cost: product.cost?.toString() || "",
      inventory: product.inventory?.toString() || "",
    });
    setEditError(null);
  };

  const handleDelete = async (productId: string) => {
    if (!confirm("Are you sure you want to delete this product?")) {
      return;
    }

    setIsDeleting(productId);
    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) {
        console.error("Delete error:", error);
        alert("Failed to delete product: " + error.message);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete product");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    setEditError(null);

    const trimmedName = editForm.name.trim();
    const trimmedSku = editForm.sku.trim();

    if (!trimmedName || !trimmedSku || !editForm.price.trim()) {
      setEditError("Please fill in Product Name, SKU, and Price.");
      return;
    }

    const numericPrice = Number(editForm.price);
    if (isNaN(numericPrice)) {
      setEditError("Price must be a valid number.");
      return;
    }

    setIsSaving(true);

    try {
      const updateData: any = {
        name: trimmedName,
        sku: trimmedSku,
        price: numericPrice,
        cost: editForm.cost ? Number(editForm.cost) : null,
        inventory: editForm.inventory ? Number(editForm.inventory) : null,
      };

      const { error } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", editingProduct.id);

      if (error) {
        console.error("Update error:", error);
        setEditError("Failed to update product: " + error.message);
        setIsSaving(false);
        return;
      }

      setEditingProduct(null);
      onRefresh();
    } catch (err) {
      console.error(err);
      setEditError("Unexpected error while updating product.");
      setIsSaving(false);
    }
  };

  return (
    <>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead>Margin</TableHead>
          <TableHead>Inventory</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              Loading products…
            </TableCell>
          </TableRow>
        )}
        {error && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-red-400">
              {error}
            </TableCell>
          </TableRow>
        )}
        {!loading && !error && products.map((product) => {
          const isLowInventory = (product.inventory ?? 0) < 5 && product.inventory !== null && product.inventory !== undefined;
          const marginPercent = product.price != null && product.cost != null
            ? ((product.price - product.cost) / product.price) * 100
            : null;
          return (
            <TableRow 
              key={product.id}
              className={cn(
                "transition-colors",
                isLowInventory && "bg-orange-50/50 dark:bg-orange-950/10"
              )}
            >
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
              <TableCell className="font-semibold">
                {product.price != null ? `$${product.price.toFixed(2)}` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {product.cost != null ? `$${product.cost.toFixed(2)}` : "—"}
              </TableCell>
              <TableCell>
                {marginPercent != null ? (
                  <span className={cn(
                    "font-medium",
                    marginPercent < 30 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {marginPercent.toFixed(1)}%
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {product.inventory != null ? (
                  <div className="flex items-center gap-2">
                    <Badge variant={isLowInventory ? "destructive" : "outline"}>
                      {product.inventory}
                    </Badge>
                    {isLowInventory && (
                      <AlertCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">—</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Link href={`/app/products/${product.id}`}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(product)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(product.id)}
                    disabled={isDeleting === product.id}
                  >
                    {isDeleting === product.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>

    {/* Edit Product Dialog */}
    <Dialog open={editingProduct !== null} onOpenChange={(open) => !open && setEditingProduct(null)}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="edit-name">
              Product Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-name"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              placeholder="e.g. Wireless Headphones"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-sku">
              SKU <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-sku"
              value={editForm.sku}
              onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })}
              placeholder="e.g. WH-001"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-price">
              Price <span className="text-red-400">*</span>
            </Label>
            <Input
              id="edit-price"
              type="number"
              step="0.01"
              value={editForm.price}
              onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
              placeholder="e.g. 79.99"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-cost">Cost (optional)</Label>
            <Input
              id="edit-cost"
              type="number"
              step="0.01"
              value={editForm.cost}
              onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="edit-inventory">Inventory (optional)</Label>
            <Input
              id="edit-inventory"
              type="number"
              value={editForm.inventory}
              onChange={(e) => setEditForm({ ...editForm, inventory: e.target.value })}
              placeholder="Optional"
              className="mt-1"
            />
          </div>
          {editError && (
            <p className="text-sm text-red-400">{editError}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setEditingProduct(null)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvImportDialog, setShowCsvImportDialog] = useState(false);
  const [showFeedUrlModal, setShowFeedUrlModal] = useState(false);
  const [showFeedMappingModal, setShowFeedMappingModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState<{
    limitType: "products" | "stores" | "competitorsPerProduct";
    current: number;
    limit: number;
  } | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    sku: "",
    price: "",
    cost: "",
    inventory: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [feedUrl, setFeedUrl] = useState("");
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedHeaders, setFeedHeaders] = useState<string[]>([]);
  const [feedRows, setFeedRows] = useState<any[]>([]);
  const [feedPreview, setFeedPreview] = useState<any[]>([]);
  const [feedMapping, setFeedMapping] = useState<{
    name: string;
    sku: string;
    price: string;
    cost: string;
    inventory: string;
  }>({
    name: "",
    sku: "",
    price: "",
    cost: "",
    inventory: "",
  });

  const currentPlan = usePlan();
  const isDemo = currentPlan === "free_demo";

  // TODO: Replace with real Supabase data_sources table queries
  // Mock state for product feed URLs
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    let query = supabase
      .from("products")
      .select("*");

    if (isDemo) {
      // Load demo products
      query = query.eq("is_demo", true);
    } else if (user) {
      // Load user's real products
      query = query.eq("is_demo", false).eq("user_id", user.id);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setError("Failed to load products.");
    } else {
      setProducts(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Client-side filtering
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!matchesSearch) return false;

    if (filter === "low-margin") {
      if (product.price == null || product.cost == null) return false;
      const marginPercent = ((product.price - product.cost) / product.price) * 100;
      return marginPercent < 30;
    }
    if (filter === "low-inventory") {
      return (product.inventory ?? 0) < 5;
    }

    return true;
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setAddError(null);
    // Check if in demo mode
    if (isDemo) {
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: "Demo mode: You can't add products. Upgrade to STARTER to connect your store.",
          type: "error",
        },
      ]);
      return;
    }

    const trimmedName = newProduct.name.trim();
    const trimmedSku = newProduct.sku.trim();

    if (!trimmedName || !trimmedSku || !newProduct.price.trim()) {
      setAddError("Please fill in Product Name, SKU, and Price.");
      return;
    }

    const numericPrice = Number(newProduct.price);
    if (isNaN(numericPrice)) {
      setAddError("Price must be a valid number.");
      return;
    }

    // Check plan limits before adding
    const competitorStores = 0; // Mock value
    const limitCheck = isPlanLimitExceeded(currentPlan, {
      totalProducts: products.length,
      competitorStores,
    });

    if (limitCheck.exceeded && limitCheck.limitType === "products") {
      setUpgradeModalData({
        limitType: limitCheck.limitType,
        current: limitCheck.current,
        limit: limitCheck.limit,
      });
      setShowUpgradeModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/products/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          sku: trimmedSku,
          price: numericPrice,
          cost: newProduct.cost ? Number(newProduct.cost) : null,
          inventory: newProduct.inventory ? Number(newProduct.inventory) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAddError(data.error || "Failed to add product.");
        setIsSubmitting(false);
        return;
      }

      // Close modal and reset form
      setShowAddDialog(false);
      setNewProduct({ name: "", sku: "", price: "", cost: "", inventory: "" });
      
      // Reload products list
      window.location.reload();
    } catch (err) {
      console.error(err);
      setAddError("Unexpected error while adding product.");
      setIsSubmitting(false);
    }
  };

  const handleFetchFeed = async () => {
    if (isDemo) {
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: "Demo mode: You can't add feed URLs. Upgrade to STARTER to connect your store.",
          type: "error",
        },
      ]);
      return;
    }

    if (!feedUrl.trim() || !feedUrl.startsWith("http")) {
      alert("Please enter a valid URL starting with http:// or https://");
      return;
    }

    try {
      setLoadingFeed(true);

      const res = await fetch("/api/products/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: feedUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Failed to fetch feed");
        return;
      }

      setFeedHeaders(data.headers);
      setFeedRows(data.rows);
      setFeedPreview(data.preview);

      // auto-guess mapování
      const lower = (s: string) => s.toLowerCase();
      const guess = (target: string) =>
        data.headers.find((h: string) => lower(h).includes(target)) ?? "";

      setFeedMapping({
        name: guess("name") || guess("title"),
        sku: guess("sku") || guess("code"),
        price: guess("price"),
        cost: guess("cost"),
        inventory: guess("stock") || guess("qty") || guess("quantity"),
      });

      setShowFeedUrlModal(false);
      setShowFeedMappingModal(true);
    } finally {
      setLoadingFeed(false);
    }
  };

  const handleImportMapped = async () => {
    // Check if in demo mode
    if (isDemo) {
      setToasts([
        ...toasts,
        {
          id: Date.now().toString(),
          message: "Demo mode: You can't import products. Upgrade to STARTER to connect your store.",
          type: "error",
        },
      ]);
      return;
    }

    // převedeme řádky podle mapování
    const payload = feedRows.map((row) => ({
      name: feedMapping.name ? row[feedMapping.name] : null,
      sku: feedMapping.sku ? row[feedMapping.sku] : null,
      price: feedMapping.price ? Number(row[feedMapping.price]) || 0 : 0,
      cost: feedMapping.cost ? Number(row[feedMapping.cost]) || null : null,
      inventory: feedMapping.inventory
        ? Number(row[feedMapping.inventory]) || null
        : null,
      is_demo: false,
      source: "feed_url",
    })).filter((p) => p.name && p.sku && p.price !== null);

    if (payload.length === 0) {
      alert("No valid products to import");
      return;
    }

    try {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("You must be logged in to import products");
        return;
      }

      // Add user_id to each product
      const payloadWithUserId = payload.map((p) => ({
        ...p,
        user_id: user.id,
      }));

      const { error } = await supabase.from("products").insert(payloadWithUserId);

      if (error) {
        console.error(error);
        alert("Failed to import products: " + error.message);
        return;
      }

      setShowFeedUrlModal(false);
      setFeedUrl("");
      setFeedHeaders([]);
      setFeedRows([]);
      setFeedPreview([]);
      setFeedMapping({
        name: "",
        sku: "",
        price: "",
        cost: "",
        inventory: "",
      });
      loadProducts();
    } catch (e) {
      console.error(e);
      alert("Unexpected error");
    }
  };

  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  const handleCsvImportSuccess = () => {
    // Reload products after successful import
    window.location.reload();
  };

  return (
    <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12 space-y-10">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your product catalog and pricing
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Products are kept in sync automatically from your feeds. You can manage your data sources in{" "}
              <Link href="/app/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
                Settings → Integrations
              </Link>
              .
            </p>
            {/* Last sync status */}
            <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
              <span>
                Last sync: {mockProductSyncStatus.lastSync} • Source: {mockProductSyncStatus.source}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] px-2 py-0.5",
                  mockProductSyncStatus.status === "synced" && "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800",
                  mockProductSyncStatus.status === "syncing" && "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-800",
                  mockProductSyncStatus.status === "error" && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800"
                )}
              >
                {mockProductSyncStatus.status === "synced" && (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                    Synced
                  </>
                )}
                {mockProductSyncStatus.status === "syncing" && (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 inline animate-spin" />
                    Syncing...
                  </>
                )}
                {mockProductSyncStatus.status === "error" && (
                  <>
                    <AlertCircle className="h-3 w-3 mr-1 inline" />
                    Error
                  </>
                )}
              </Badge>
            </div>
          </div>
          <div className="flex gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  Add Products
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="min-w-[210px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-card shadow-[0_18px_45px_rgba(15,23,42,0.14)] p-1 z-50"
              >
                <DropdownMenuItem 
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 outline-none transition-colors"
                  onClick={() => setShowAddDialog(true)}
                >
                  <Plus className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>Add Product</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 outline-none transition-colors"
                  onClick={() => setShowCsvImportDialog(true)}
                >
                  <Upload className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>Upload CSV File</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 cursor-pointer focus:bg-slate-50 dark:focus:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 outline-none transition-colors"
                  onClick={() => setShowFeedUrlModal(true)}
                >
                  <Link2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>Add Feed URL</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      {/* TODO: Replace client-side filtering with server-side Supabase queries for better performance */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="search"
                name="search"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-12 text-base"
              />
            </div>
            <Select
              id="filter"
              name="filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-12"
            >
              <option value="all">All products</option>
              <option value="low-margin">Low margin (&lt;30%)</option>
              <option value="low-inventory">Low inventory (&lt;5)</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <ProductTable 
            products={filteredProducts} 
            loading={loading} 
            error={error}
            onRefresh={loadProducts}
          />
        </CardContent>
      </Card>

      {/* Add Product Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle>Add Product</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleAddProduct} className="space-y-4">
                <div>
                  <Label htmlFor="name">
                    Product Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                    placeholder="e.g. Wireless Headphones"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sku">
                    SKU <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={newProduct.sku}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sku: e.target.value })
                    }
                    placeholder="e.g. WH-001"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="price">
                    Price <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, price: e.target.value })
                    }
                    placeholder="e.g. 79.99"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cost">Cost</Label>
                  <Input
                    id="cost"
                    name="cost"
                    type="number"
                    step="0.01"
                    value={newProduct.cost}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, cost: e.target.value })
                    }
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="inventory">Inventory</Label>
                  <Input
                    id="inventory"
                    name="inventory"
                    type="number"
                    value={newProduct.inventory}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, inventory: e.target.value })
                    }
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
                {addError && (
                  <p className="mt-2 text-sm text-red-400">
                    {addError}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Product"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Feed URL Modal */}
      <Dialog open={showFeedUrlModal} onOpenChange={setShowFeedUrlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Feed URL</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Paste the URL to your product feed (CSV or JSON).
            </p>
          </DialogHeader>
          <Input
            placeholder="https://example.com/products.csv"
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
          />
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowFeedUrlModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleFetchFeed} disabled={loadingFeed}>
              {loadingFeed ? "Loading..." : "Fetch feed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feed Mapping Modal */}
      <Dialog open={showFeedMappingModal} onOpenChange={setShowFeedMappingModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Map feed fields</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Match columns from the feed to your product fields.
            </p>
          </DialogHeader>

          {/* map selector */}
          <div className="space-y-3">
            {(["name", "sku", "price", "cost", "inventory"] as const).map(
              (field) => (
                <div
                  key={field}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm font-medium w-24 capitalize">
                    {field} {field === "name" || field === "sku" || field === "price" ? (
                      <span className="text-red-400">*</span>
                    ) : null}
                  </span>
                  <Select
                    value={feedMapping[field]}
                    onChange={(e) =>
                      setFeedMapping((prev) => ({
                        ...prev,
                        [field]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Ignore</option>
                    {feedHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              )
            )}
          </div>

          {/* preview */}
          {feedPreview.length > 0 && (
            <div className="mt-4 border rounded p-2 max-h-48 overflow-auto text-xs">
              <div className="font-semibold mb-2">Preview (first rows)</div>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {feedHeaders.map((h) => (
                      <th key={h} className="text-left pr-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {feedPreview.map((row, idx) => (
                    <tr key={idx}>
                      {feedHeaders.map((h) => (
                        <td key={h} className="pr-2">
                          {String(row[h] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowFeedMappingModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportMapped}>Import products</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      {upgradeModalData && (
        <UpgradeModal
          open={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          limitType={upgradeModalData.limitType}
          current={upgradeModalData.current}
          limit={upgradeModalData.limit}
          currentPlan={currentPlan}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* CSV Import Dialog */}
      <CsvImportDialog
        open={showCsvImportDialog}
        onClose={() => setShowCsvImportDialog(false)}
        onSuccess={handleCsvImportSuccess}
      />
    </div>
  );
}
