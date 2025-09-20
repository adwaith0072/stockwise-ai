import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useAction, useMutation } from "convex/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  Plus,
  MessageSquare,
  Settings,
  LogOut
} from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import type React from "react";
import { useLocation } from "react-router";
import * as XLSX from "xlsx";
import type { Id } from "@/convex/_generated/dataModel";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const location = useLocation(); // Add

  // Open a specific tab if ?tab=... is present
  // Allowed tabs: overview, inventory, billing, ai-chat, settings
  // Run on search change
  // This keeps defaults intact if no tab param is provided
  // and prevents switching away if already on a valid tab.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    const allowed = new Set(["overview", "inventory", "billing", "ai-chat", "settings"]);
    if (tab && allowed.has(tab)) setActiveTab(tab);
  }, [location.search]);

  const stock = useQuery(api.stock.getStock);
  const lowStockAlerts = useQuery(api.stock.getLowStockAlerts);
  const expiringItems = useQuery(api.stock.getExpiringItems);
  const recentBills = useQuery(api.bills.getBills);
  const createBill = useMutation(api.bills.createBill);

  const addStock = useMutation(api.stock.addStock);
  const chatWithAI = useAction(api.aiActions.chatWithAI);

  // Add: Inventory form state
  const [itemName, setItemName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [category, setCategory] = useState("");
  const [minStockLevel, setMinStockLevel] = useState<number | "">("");
  const [unit, setUnit] = useState("");
  // Add supplier state
  const [supplier, setSupplier] = useState("");

  // Add: AI chat state
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

  // Billing state
  const [billingCustomerName, setBillingCustomerName] = useState("");
  const [billingPaymentMethod, setBillingPaymentMethod] = useState("Cash");
  const [billingSearch, setBillingSearch] = useState("");
  const [billingCart, setBillingCart] = useState<
    Array<{ stockId: Id<"stock">; itemName: string; pricePerUnit: number; quantity: number }>
  >([]);

  // Billing helpers
  const addToCart = (s: any) => {
    setBillingCart((prev) => {
      const idx = prev.findIndex((i) => i.stockId === s._id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [
        ...prev,
        {
          stockId: s._id as Id<"stock">,
          itemName: s.itemName,
          pricePerUnit: s.pricePerUnit,
          quantity: 1,
        },
      ];
    });
  };

  const updateQuantity = (stockId: Id<"stock">, qty: number) => {
    setBillingCart((prev) =>
      prev
        .map((i) => (i.stockId === stockId ? { ...i, quantity: Math.max(1, qty) } : i))
        .filter((i) => i.quantity > 0),
    );
  };

  const removeFromCart = (stockId: Id<"stock">) => {
    setBillingCart((prev) => prev.filter((i) => i.stockId !== stockId));
  };

  const cartTotal = billingCart.reduce((sum, i) => sum + i.quantity * i.pricePerUnit, 0);

  const handleCreateBill = async () => {
    if (billingCart.length === 0) {
      toast.error("Add at least one item to the cart");
      return;
    }
    try {
      const billId = await createBill({
        customerName: billingCustomerName || undefined,
        items: billingCart.map((i) => ({ stockId: i.stockId, quantity: i.quantity })),
        paymentMethod: billingPaymentMethod || undefined,
      });
      toast.success("Bill created");
      setBillingCart([]);
      setBillingCustomerName("");
      setBillingPaymentMethod("Cash");
      // Optionally navigate or show success; keeping on page
    } catch (err) {
      console.error(err);
      toast.error("Failed to create bill");
    }
  };

  // Add: Inventory submit handler
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || currentQuantity < 0 || pricePerUnit < 0) {
      toast.error("Please fill all required fields correctly");
      return;
    }
    try {
      await addStock({
        itemName,
        currentQuantity,
        pricePerUnit,
        expiryDate: expiryDate ? new Date(expiryDate).getTime() : undefined,
        category: category || undefined,
        minStockLevel: typeof minStockLevel === "number" ? minStockLevel : undefined,
        unit: unit || undefined,
        // include supplier
        supplier: supplier || undefined,
      });
      toast.success("Stock item added");
      setItemName("");
      setCurrentQuantity(0);
      setPricePerUnit(0);
      setExpiryDate("");
      setCategory("");
      setMinStockLevel("");
      setUnit("");
      // Reset supplier
      setSupplier("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add stock");
    }
  };

  // Add: AI send handler
  const handleSendAI = async () => {
    const msg = aiMessage.trim();
    if (!msg) return;
    setAiHistory((h) => [...h, { role: "user", text: msg }]);
    setAiLoading(true);
    try {
      const response = await chatWithAI({ message: msg, language: user?.language });
      setAiHistory((h) => [...h, { role: "assistant", text: response }]);
      setAiMessage("");
    } catch (err) {
      console.error(err);
      toast.error("AI assistant failed to respond");
    } finally {
      setAiLoading(false);
    }
  };

  // Add helper: parse potential Excel serial date numbers or strings
  const toTimestamp = (val: unknown): number | undefined => {
    if (!val) return undefined;
    if (typeof val === "number") {
      // Excel serial date handling (approx)
      const excelEpoch = Date.UTC(1899, 11, 30);
      const ms = excelEpoch + val * 86400000;
      return isNaN(ms) ? undefined : ms;
    }
    const d = new Date(String(val));
    return isNaN(d.getTime()) ? undefined : d.getTime();
  };

  // Add file upload handler
  const handleFileUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      if (!rows.length) {
        toast.error("No data found in the uploaded file.");
        return;
      }

      // Helper for case-insensitive column matching
      const pick = (obj: Record<string, any>, keys: string[]) => {
        const map: Record<string, any> = {};
        for (const k of Object.keys(obj)) map[k.trim().toLowerCase()] = obj[k];
        for (const key of keys) {
          const found = map[key.toLowerCase()];
          if (found !== undefined) return found;
        }
        return undefined;
      };

      let success = 0;
      let failed = 0;

      toast("Uploading stock items...");

      for (const row of rows) {
        const itemNameVal = pick(row, ["Item Name", "Name", "Item"]);
        const categoryVal = pick(row, ["Category"]);
        const qtyVal = pick(row, ["Quantity in Stock", "Quantity", "Qty", "Stock"]);
        const unitVal = pick(row, ["Unit"]);
        const priceVal = pick(row, ["Selling Price", "Price", "MRP", "Rate"]);
        const expiryVal = pick(row, ["Expiry Date", "Expiry", "Expiration"]);
        // Add supplier pick
        const supplierVal = pick(row, ["Supplier", "Vendor", "Manufacturer"]);

        const itemNameStr = String(itemNameVal || "").trim();
        const qtyNum = Number(qtyVal);
        const priceNum = Number(priceVal);
        const expiryTs = toTimestamp(expiryVal);

        if (!itemNameStr || isNaN(qtyNum) || isNaN(priceNum)) {
          failed++;
          continue;
        }

        try {
          await addStock({
            itemName: itemNameStr,
            currentQuantity: qtyNum,
            pricePerUnit: priceNum,
            expiryDate: expiryTs,
            category: categoryVal ? String(categoryVal).trim() : undefined,
            minStockLevel: typeof minStockLevel === "number" ? minStockLevel : undefined,
            unit: unitVal ? String(unitVal).trim() : undefined,
            // include supplier from file if present
            supplier: supplierVal ? String(supplierVal).trim() : undefined,
          });
          success++;
        } catch {
          failed++;
        }
      }

      if (success > 0) toast.success(`Uploaded ${success} items successfully.`);
      if (failed > 0) toast.error(`${failed} rows could not be processed.`);

    } catch (err) {
      console.error(err);
      toast.error("Failed to process the uploaded file.");
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const totalItems = stock?.length || 0;
  const lowStockCount = lowStockAlerts?.length || 0;
  const expiringCount = expiringItems?.length || 0;
  const totalValue = stock?.reduce((sum, item) => sum + (item.currentQuantity * item.pricePerUnit), 0) || 0;

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "billing", label: "Billing", icon: TrendingUp },
    { id: "ai-chat", label: "AI Assistant", icon: MessageSquare },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.div 
        className="w-64 bg-secondary/30 border-r border-border p-8"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center space-x-3 mb-12">
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-medium tracking-tight">StockSense</span>
        </div>

        <div className="space-y-2 mb-12">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-sm text-left transition-colors ${
                activeTab === item.id 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-secondary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="border-t border-border pt-8">
          <div className="mb-4">
            <p className="text-sm font-medium">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.shopType || "General"} Store
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => signOut()}
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 p-8">
        {activeTab === "overview" && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h1 className="mb-2">Dashboard Overview</h1>
              <p className="text-muted-foreground">
                Welcome back! Here's what's happening with your inventory.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light">{totalItems}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Inventory Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light">₹{totalValue.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card className={lowStockCount > 0 ? "border-destructive cursor-pointer" : "cursor-pointer"} onClick={() => navigate("/alerts/low-stock")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Low Stock
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light">{lowStockCount}</div>
                </CardContent>
              </Card>

              <Card className={expiringCount > 0 ? "border-destructive cursor-pointer" : "cursor-pointer"} onClick={() => navigate("/alerts/expiring")}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Expiring Soon
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-light">{expiringCount}</div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Button 
                className="h-24 flex-col space-y-2"
                onClick={() => setActiveTab("inventory")}
              >
                <Plus className="w-6 h-6" />
                <span>Add Stock</span>
              </Button>
              
              <Button 
                variant="outline"
                className="h-24 flex-col space-y-2"
                onClick={() => setActiveTab("billing")}
              >
                <TrendingUp className="w-6 h-6" />
                <span>Create Bill</span>
              </Button>
              
              <Button 
                variant="outline"
                className="h-24 flex-col space-y-2"
                onClick={() => setActiveTab("ai-chat")}
              >
                <MessageSquare className="w-6 h-6" />
                <span>Ask AI</span>
              </Button>
            </div>
          </motion.div>
        )}

        {activeTab === "inventory" && (
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

            {/* Upload Instructions + File Input */}
            <Card className="mb-6">
              <CardContent className="p-8 space-y-4">
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
                  </ul>
                </div>
                <div>
                  <Input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8">
                <form onSubmit={handleAddStock} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  {/* Add Supplier field */}
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
                      onClick={() => {
                        setItemName("");
                        setCurrentQuantity(0);
                        setPricePerUnit(0);
                        setExpiryDate("");
                        setCategory("");
                        setUnit("");
                        setMinStockLevel("");
                        // Reset supplier on clear
                        setSupplier("");
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </form>

                {/* Simple Stock List */}
                <div className="mt-10">
                  <h3 className="mb-4">Your Stock</h3>
                  <div className="space-y-3">
                    {(stock || []).map((s) => (
                      <div key={s._id} className="flex items-center justify-between border rounded-sm p-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{s.itemName}</span>
                          <span className="text-sm text-muted-foreground">
                            ₹{s.pricePerUnit} • {s.category || "Uncategorized"}
                            {s.unit ? ` • ${s.unit}` : ""}
                            {s.expiryDate ? ` • Expires ${new Date(s.expiryDate).toLocaleDateString()}` : ""}
                            {s.supplier ? ` • Supplier ${s.supplier}` : ""}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Qty: {s.currentQuantity}
                        </div>
                      </div>
                    ))}
                    {stock && stock.length === 0 && (
                      <p className="text-sm text-muted-foreground">No items yet. Add your first item above.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "ai-chat" && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h1 className="mb-2">AI Assistant</h1>
              <p className="text-muted-foreground">
                Get intelligent insights about your inventory.
              </p>
            </div>
            
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="space-y-2">
                  <Label>Your Question</Label>
                  <Textarea
                    value={aiMessage}
                    onChange={(e) => setAiMessage(e.target.value)}
                    placeholder="e.g., Which items are low on stock and should I reorder this week?"
                    className="min-h-[120px]"
                  />
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleSendAI} disabled={aiLoading || !aiMessage.trim()}>
                    {aiLoading ? "Thinking..." : "Ask AI"}
                  </Button>
                </div>

                <div className="space-y-4">
                  {aiHistory.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-sm border ${m.role === "user" ? "bg-secondary/40" : "bg-background"}`}
                    >
                      <div className="text-xs uppercase text-muted-foreground mb-1">
                        {m.role === "user" ? "You" : "Assistant"}
                      </div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                    </div>
                  ))}
                  {aiHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground">No conversation yet. Ask a question above to get started.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {activeTab === "billing" && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h1 className="mb-2">Billing</h1>
              <p className="text-muted-foreground">
                Create a bill, add items to the cart, and check out. Stock will update automatically.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Stock Browser */}
              <Card>
                <CardContent className="p-8 space-y-4">
                  <div className="space-y-2">
                    <Label>Search Items</Label>
                    <Input
                      placeholder="Search by name or category"
                      value={billingSearch}
                      onChange={(e) => setBillingSearch(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {(stock || [])
                      .filter((s) => {
                        const q = billingSearch.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          s.itemName.toLowerCase().includes(q) ||
                          (s.category || "").toLowerCase().includes(q)
                        );
                      })
                      .map((s) => (
                        <div
                          key={s._id}
                          className="flex items-center justify-between border rounded-sm p-4"
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{s.itemName}</span>
                            <span className="text-sm text-muted-foreground">
                              ₹{s.pricePerUnit}
                              {s.unit ? ` • ${s.unit}` : ""} • Qty: {s.currentQuantity}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addToCart(s)}
                            disabled={s.currentQuantity <= 0}
                            className="shrink-0"
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    {stock && stock.length === 0 && (
                      <p className="text-sm text-muted-foreground">No items available.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cart & Checkout */}
              <Card>
                <CardContent className="p-8 space-y-6">
                  {/* Customer & Payment */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Customer Name (optional)</Label>
                      <Input
                        value={billingCustomerName}
                        onChange={(e) => setBillingCustomerName(e.target.value)}
                        placeholder="Enter customer name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <select
                        className="h-10 rounded-sm border bg-background px-3"
                        value={billingPaymentMethod}
                        onChange={(e) => setBillingPaymentMethod(e.target.value)}
                      >
                        <option value="Cash">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-3">
                    <h3 className="mb-2">Cart</h3>
                    {billingCart.length === 0 && (
                      <p className="text-sm text-muted-foreground">No items in cart.</p>
                    )}
                    {billingCart.map((i) => (
                      <div
                        key={i.stockId}
                        className="flex items-center justify-between border rounded-sm p-4"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{i.itemName}</span>
                          <span className="text-sm text-muted-foreground">₹{i.pricePerUnit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(i.stockId, i.quantity - 1)}
                          >
                            -
                          </Button>
                          <Input
                            type="number"
                            value={i.quantity}
                            onChange={(e) =>
                              updateQuantity(i.stockId, Number(e.target.value || 1))
                            }
                            min={1}
                            className="w-16 h-10 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateQuantity(i.stockId, i.quantity + 1)}
                          >
                            +
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeFromCart(i.stockId)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between border-t pt-4">
                    <span className="font-medium">Total</span>
                    <span className="text-xl font-light">₹{cartTotal.toLocaleString()}</span>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleCreateBill} disabled={billingCart.length === 0}>
                      Create Bill
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setBillingCart([]);
                        setBillingCustomerName("");
                        setBillingPaymentMethod("Cash");
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Bills */}
            <div className="mt-10">
              <h3 className="mb-4">Recent Bills</h3>
              <div className="space-y-3">
                {(recentBills || []).map((b) => (
                  <div key={b._id} className="flex items-center justify-between border rounded-sm p-4">
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {b.customerName || "Walk-in Customer"}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {b.items.length} items • {b.paymentMethod || "—"}
                      </span>
                    </div>
                    <div className="text-sm">
                      ₹{b.totalAmount.toLocaleString()}
                    </div>
                  </div>
                ))}
                {recentBills && recentBills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No bills yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}