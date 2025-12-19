"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Pencil, Trash2, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  cost: number | null;
  inventory: number | null;
};

export function ProductTable({ 
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
        {!loading && !error && products.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
              <p className="text-sm font-medium">No products added yet</p>
            </TableCell>
          </TableRow>
        )}
        {!loading && !error && products.map((product) => {
          const isLowInventory = (product.inventory ?? 0) < 5 && product.inventory !== null && product.inventory !== undefined;
          const marginPercent = product.price != null && product.cost != null
            ? ((product.price - product.cost) / product.price) * 100
            : null;
          const isOutOfStock = product.inventory === 0;
          return (
            <TableRow 
              key={product.id}
              className={cn(
                "transition-colors",
                isLowInventory && "bg-orange-50/50 dark:bg-orange-950/10"
              )}
            >
              <TableCell className="font-medium">
                {product.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{product.sku ?? "—"}</TableCell>
              <TableCell className="font-semibold">
                {product.price != null ? `$${product.price.toFixed(2)}` : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {product.cost != null ? (
                  `$${product.cost.toFixed(2)}`
                ) : (
                  <Tooltip side="top">
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 cursor-help">
                        <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                        <span>—</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Cost is missing. Add cost to enable margin calculation and recommendations.
                    </TooltipContent>
                  </Tooltip>
                )}
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
                  <Tooltip side="top">
                    <TooltipTrigger asChild>
                      <span className="cursor-help">—</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Margin unavailable because cost is missing.
                    </TooltipContent>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>
                {product.inventory != null ? (
                  <Tooltip side="top">
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={isOutOfStock ? "destructive" : isLowInventory ? "destructive" : "outline"}
                          className={isOutOfStock ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" : ""}
                        >
                          {product.inventory}
                        </Badge>
                        {isLowInventory && !isOutOfStock && (
                          <AlertCircle className="h-3 w-3 text-orange-600 dark:text-orange-400" />
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isOutOfStock 
                        ? "Out of stock — pricing recommendations are paused for this product."
                        : isLowInventory
                        ? "Low inventory — consider restocking soon."
                        : `Inventory: ${product.inventory} units`
                      }
                    </TooltipContent>
                  </Tooltip>
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





