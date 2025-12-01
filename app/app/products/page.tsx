"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProducts, addProduct, deleteProduct } from "@/lib/api";
import { Product } from "@/types";
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
import { UpgradeModal } from "@/components/ui/upgrade-modal";
import { ToastContainer, type Toast } from "@/components/ui/toast";
import { isPlanLimitExceeded, type Plan } from "@/lib/planLimits";
import { cn } from "@/lib/utils";

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

function ProductTable({ products }: { products: Product[] }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return (
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
        {products.map((product) => {
          const isLowInventory = (product.inventory ?? 0) < 5 && product.inventory !== null && product.inventory !== undefined;
          return (
            <TableRow 
              key={product.id}
              className={cn(
                "transition-colors",
                isLowInventory && "bg-orange-50/50 dark:bg-orange-950/10"
              )}
            >
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.sku}</TableCell>
              <TableCell className="font-semibold">${product.currentPrice.toFixed(2)}</TableCell>
              <TableCell className="text-muted-foreground">${product.cost.toFixed(2)}</TableCell>
              <TableCell>
                <span className={cn(
                  "font-medium",
                  product.marginPercent < 30 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"
                )}>
                  {product.marginPercent.toFixed(1)}%
                </span>
              </TableCell>
              <TableCell>
                {product.inventory === null || product.inventory === undefined ? (
                  <span className="text-muted-foreground italic">-</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant={isLowInventory ? "destructive" : "outline"}>
                      {product.inventory}
                    </Badge>
                    {isLowInventory && (
                      <AlertCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/products/${product.id}`}>View</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteMutation.mutate(product.id)}
                  >
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function ProductsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFeedUrlModal, setShowFeedUrlModal] = useState(false);
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
  const [feedUrl, setFeedUrl] = useState({
    name: "",
    url: "",
  });

  // TODO: Replace with real plan from Supabase user profile
  const currentPlan: Plan = "STARTER";

  // TODO: Replace with real Supabase data_sources table queries
  // Mock state for product feed URLs
  const [dataSources, setDataSources] = useState<DataSource[]>([]);

  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    staleTime: 0,
  });

  const addMutation = useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setShowAddDialog(false);
      setNewProduct({ name: "", sku: "", price: "", cost: "", inventory: "" });
    },
  });

  // Client-side filtering
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "low-margin") {
      return product.marginPercent < 30;
    }
    if (filter === "low-inventory") {
      return (product.inventory ?? 0) < 5;
    }

    return true;
  });

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Replace with real competitor stores count from Supabase
    const competitorStores = 0; // Mock value
    
    // Check plan limits before adding
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

    const price = parseFloat(newProduct.price);
    const cost = parseFloat(newProduct.cost) || price * 0.5;
    const inventory = newProduct.inventory
      ? parseInt(newProduct.inventory)
      : undefined;

    addMutation.mutate({
      name: newProduct.name,
      sku: newProduct.sku || `SKU-${Date.now()}`,
      currentPrice: price,
      currency: "USD",
      cost,
      marginPercent: ((price - cost) / price) * 100,
      inventory,
    });
  };

  const handleSaveFeedUrl = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedUrl.url.trim() || !feedUrl.url.startsWith("http")) {
      return;
    }

    // TODO: Persist feed URL to Supabase `data_sources` table and connect it to the cron-based product sync later.
    // The cron job will:
    // - Starter: sync 1×/day
    // - Pro: sync 4×/day
    // - Scale: sync 6×/day
    // All sync jobs read product feed URLs from the `data_sources` table (type=FEED/PRODUCT_FEED).
    
    const newDataSource: DataSource = {
      id: `feed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: feedUrl.name.trim() || undefined,
      url: feedUrl.url.trim(),
      type: "PRODUCT_FEED",
      createdAt: new Date().toISOString(),
    };

    setDataSources([...dataSources, newDataSource]);
    setShowFeedUrlModal(false);
    setFeedUrl({ name: "", url: "" });
    
    setToasts([
      ...toasts,
      {
        id: Date.now().toString(),
        message: "Feed URL saved. Products will sync automatically based on your plan (mock).",
        type: "success",
      },
    ]);
  };

  const removeToast = (id: string) => {
    setToasts(toasts.filter((t) => t.id !== id));
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 lg:px-8 py-10 lg:py-12">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

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
                  onClick={() => {
                    // TODO: Implement CSV upload modal
                    console.log("Upload CSV clicked");
                  }}
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
          <ProductTable products={filteredProducts} />
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
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={newProduct.name}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, name: e.target.value })
                    }
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={newProduct.sku}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, sku: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="price">Price</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) =>
                      setNewProduct({ ...newProduct, price: e.target.value })
                    }
                    required
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
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={addMutation.isPending} className="flex-1">
                    Add Product
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
      {showFeedUrlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg rounded-2xl bg-white shadow-xl p-6 space-y-4">
            <CardHeader className="p-0">
              <CardTitle>Add product feed URL</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                Connect a product feed or store URL. We'll automatically sync products from this source based on your plan's schedule (mock).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleSaveFeedUrl} className="space-y-4">
                <div>
                  <Label htmlFor="feed-name">Name</Label>
                  <Input
                    id="feed-name"
                    name="feed-name"
                    value={feedUrl.name}
                    onChange={(e) =>
                      setFeedUrl({ ...feedUrl, name: e.target.value })
                    }
                    placeholder="My main store"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="feed-url">Feed URL</Label>
                  <Input
                    id="feed-url"
                    name="feed-url"
                    type="url"
                    value={feedUrl.url}
                    onChange={(e) =>
                      setFeedUrl({ ...feedUrl, url: e.target.value })
                    }
                    placeholder="https://mystore.com/products or https://mystore.com/feed.xml"
                    required
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" className="flex-1" disabled={!feedUrl.url.trim() || !feedUrl.url.startsWith("http")}>
                    Save feed URL
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowFeedUrlModal(false);
                      setFeedUrl({ name: "", url: "" });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

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
    </div>
  );
}
