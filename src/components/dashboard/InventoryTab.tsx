import { useEffect, useState } from "react";
import type React from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InventoryTabProps {
  stock: Array<Doc<"stock">> | undefined;
  defaultUnits?: string;
  onFileUpload: (file: File) => Promise<void>;
}

type EditDraft = {
  itemName?: string;
  currentQuantity?: number | "";
  pricePerUnit?: number | "";
  expiryDate?: string;
  category?: string;
  minStockLevel?: number | "";
  unit?: string;
  supplier?: string;
};

export function InventoryTab({
  stock,
  defaultUnits,
  onFileUpload,
}: InventoryTabProps) {
  const addStock = useMutation(api.stock.addStock);
  const updateStockDetails = useMutation(api.stock.updateStockDetails);
  const deleteStock = useMutation(api.stock.deleteStock);

  const [inventoryMode, setInventoryMode] = useState<"add" | "edit">("add");
  const [itemName, setItemName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState("");
  const [category, setCategory] = useState("");
  const [minStockLevel, setMinStockLevel] = useState<number | "">("");
  const [unit, setUnit] = useState(defaultUnits || "");
  const [supplier, setSupplier] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, EditDraft>>({});

  useEffect(() => {
    if (defaultUnits) {
      setUnit((prev) => prev || defaultUnits);
    }
  }, [defaultUnits]);

  const setEditField = (id: string, field: keyof EditDraft, value: string | number) => {
    setInventoryEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const resetForm = () => {
    setItemName("");
    setCurrentQuantity(0);
    setPricePerUnit(0);
    setExpiryDate("");
    setCategory("");
    setMinStockLevel("");
    setUnit(defaultUnits || "");
    setSupplier("");
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || currentQuantity < 0 || pricePerUnit < 0) {
      toast.error("Please fill all required fields correctly");
      return;
    }

    try {
      await addStock({
        itemName: itemName.trim(),
        currentQuantity,
        pricePerUnit,
        expiryDate: expiryDate ? new Date(expiryDate).getTime() : undefined,
        category: category || undefined,
        minStockLevel: typeof minStockLevel === "number" ? minStockLevel : undefined,
        unit: unit || undefined,
        supplier: supplier || undefined,
      });
      toast.success("Stock item added");
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error("Failed to add stock");
    }
  };

  const saveEdits = async (id: Id<"stock">) => {
    const draft = inventoryEdits[id as string] || {};
    const patch: Record<string, unknown> = {};
    if (draft.itemName !== undefined) patch.itemName = draft.itemName.trim();
    if (draft.currentQuantity !== undefined && draft.currentQuantity !== "") {
      patch.currentQuantity = Number(draft.currentQuantity);
    }
    if (draft.pricePerUnit !== undefined && draft.pricePerUnit !== "") {
      patch.pricePerUnit = Number(draft.pricePerUnit);
    }
    if (draft.expiryDate !== undefined) {
      patch.expiryDate = draft.expiryDate ? new Date(draft.expiryDate).getTime() : undefined;
    }
    if (draft.category !== undefined) patch.category = draft.category || undefined;
    if (draft.minStockLevel !== undefined) {
      patch.minStockLevel =
        draft.minStockLevel === "" ? undefined : Number(draft.minStockLevel);
    }
    if (draft.unit !== undefined) patch.unit = draft.unit || undefined;
    if (draft.supplier !== undefined) patch.supplier = draft.supplier || undefined;

    try {
      await updateStockDetails({ stockId: id, ...patch });
      toast.success("Stock updated");
      setInventoryEdits((prev) => {
        const copy = { ...prev };
        delete copy[id as string];
        return copy;
      });
    } catch (e) {
      console.error(e);
      toast.error("Failed to update stock");
    }
  };

  const handleDeleteStock = async (item: Doc<"stock">) => {
    if (!window.confirm(`Delete "${item.itemName}" from inventory?`)) return;
    try {
      await deleteStock({ stockId: item._id });
      toast.success(`Deleted ${item.itemName}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete stock item");
    }
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <h1 className="mb-2">Inventory Management</h1>
        <p className="text-muted-foreground">
          Manage your stock levels and add new items.
        </p>
      </div>

      {/* Inventory Mode Switch */}
      <div className="flex gap-3 mb-6">
        <Button
          variant={inventoryMode === "add" ? "default" : "outline"}
          onClick={() => setInventoryMode("add")}
        >
          Add New Stock
        </Button>
        <Button
          variant={inventoryMode === "edit" ? "default" : "outline"}
          onClick={() => setInventoryMode("edit")}
        >
          Edit Existing Stock
        </Button>
      </div>

      {inventoryMode === "add" && (
        <>
          <Card className="mb-6">
            <CardContent className="p-6 md:p-8 space-y-4">
              <div>
                <h3 className="mb-2">Upload CSV or Excel</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Your file should have the following columns:
                </p>
                <ul className="list-disc pl-6 text-sm text-muted-foreground space-y-1">
                  <li>Item Name → name of the product (e.g., Rice, Paracetamol, Notebook)</li>
                  <li>Category → Grocery, Pharmacy, Stationery, etc.</li>
                  <li>Quantity in Stock → current stock level</li>
                  <li>Unit → kg, litre, piece, strip, bag, etc.</li>
                  <li>Selling Price → what the shop sells it for</li>
                  <li>Expiry Date → optional (any standard date format)</li>
                  <li>Supplier → optional (e.g., vendor or manufacturer name)</li>
                  <li>Min Stock Level → optional reorder threshold</li>
                </ul>
              </div>
              <div>
                <Input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onFileUpload(f);
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 md:p-8">
              <form
                onSubmit={handleAddStock}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="space-y-2">
                  <Label>Item Name</Label>
                  <Input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g., Sugar 1kg"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Current Quantity</Label>
                  <Input
                    type="number"
                    value={currentQuantity}
                    onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                    min={0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price per Unit (₹)</Label>
                  <Input
                    type="number"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(Number(e.target.value))}
                    min={0}
                    step="0.01"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (optional)</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category (optional)</Label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Grocery"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g., kg, piece, strip"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Supplier (optional)</Label>
                  <Input
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="e.g., ACME Distributors"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Min Stock Level (optional)</Label>
                  <Input
                    type="number"
                    value={minStockLevel}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMinStockLevel(v === "" ? "" : Number(v));
                    }}
                    min={0}
                  />
                </div>

                <div className="md:col-span-2 flex gap-3">
                  <Button type="submit" className="h-12">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12"
                    onClick={resetForm}
                  >
                    Reset
                  </Button>
                </div>
              </form>

              <div className="mt-10">
                <h3 className="mb-4">Your Stock</h3>
                <div className="space-y-3">
                  {(stock || []).map((s) => (
                    <div
                      key={s._id}
                      className="flex items-center justify-between border rounded-sm p-4"
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{s.itemName}</span>
                        <span className="text-sm text-muted-foreground">
                          ₹{s.pricePerUnit} • {s.category || "Uncategorized"}
                          {s.unit ? ` • ${s.unit}` : ""}
                          {s.expiryDate
                            ? ` • Expires ${new Date(s.expiryDate).toLocaleDateString()}`
                            : ""}
                          {s.supplier ? ` • Supplier ${s.supplier}` : ""}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Qty: {s.currentQuantity}
                      </div>
                    </div>
                  ))}
                  {stock && stock.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No items yet. Add your first item above.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {inventoryMode === "edit" && (
        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="space-y-4">
              {(stock || []).map((s) => {
                const draft = inventoryEdits[s._id as string] || {};
                const toDateInput = (ts?: number) =>
                  ts ? new Date(ts).toISOString().slice(0, 10) : "";

                return (
                  <div key={s._id} className="border rounded-sm p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label>Item Name</Label>
                        <Input
                          value={draft.itemName ?? s.itemName}
                          onChange={(e) =>
                            setEditField(s._id as string, "itemName", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Current Quantity</Label>
                        <Input
                          type="number"
                          value={draft.currentQuantity ?? s.currentQuantity}
                          onChange={(e) =>
                            setEditField(
                              s._id as string,
                              "currentQuantity",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          min={0}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Price per Unit (₹)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={draft.pricePerUnit ?? s.pricePerUnit}
                          onChange={(e) =>
                            setEditField(
                              s._id as string,
                              "pricePerUnit",
                              e.target.value === "" ? "" : Number(e.target.value),
                            )
                          }
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label>Expiry Date (optional)</Label>
                        <Input
                          type="date"
                          value={
                            draft.expiryDate !== undefined
                              ? draft.expiryDate
                              : toDateInput(s.expiryDate)
                          }
                          onChange={(e) =>
                            setEditField(s._id as string, "expiryDate", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Category</Label>
                        <Input
                          value={draft.category ?? (s.category || "")}
                          onChange={(e) =>
                            setEditField(s._id as string, "category", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Unit</Label>
                        <Input
                          value={draft.unit ?? (s.unit || "")}
                          onChange={(e) =>
                            setEditField(s._id as string, "unit", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Supplier</Label>
                        <Input
                          value={draft.supplier ?? (s.supplier || "")}
                          onChange={(e) =>
                            setEditField(s._id as string, "supplier", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <Label>Min Stock Level</Label>
                        <Input
                          type="number"
                          value={draft.minStockLevel ?? (s.minStockLevel ?? "")}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditField(
                              s._id as string,
                              "minStockLevel",
                              v === "" ? "" : Number(v),
                            );
                          }}
                          min={0}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button size="sm" onClick={() => saveEdits(s._id)}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setInventoryEdits((prev) => {
                            const copy = { ...prev };
                            delete copy[s._id as string];
                            return copy;
                          })
                        }
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteStock(s)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })}
              {stock && stock.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items to edit. Switch to "Add New Stock" to create items.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
