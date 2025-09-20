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
  LogOut,
  CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router";
import { useState, useEffect } from "react";
import type React from "react";
import { useLocation } from "react-router";
import * as XLSX from "xlsx";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

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
  const sales = useQuery(api.bills.getSales);
  const updateSettings = useMutation(api.users.updateSettings);
  const clearData = useMutation(api.users.clearData);

  const addStock = useMutation(api.stock.addStock);
  const chatWithAI = useAction(api.aiActions.chatWithAI);
  const updateStockDetails = useMutation(api.stock.updateStockDetails);

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

  // Inventory sub-mode: "add" | "edit"
  const [inventoryMode, setInventoryMode] = useState<"add" | "edit">("add");

  // Local edit drafts keyed by stockId for Edit Existing Stock
  const [inventoryEdits, setInventoryEdits] = useState<Record<string, {
    itemName?: string;
    currentQuantity?: number;
    pricePerUnit?: number;
    expiryDate?: string; // as date input value
    category?: string;
    minStockLevel?: number | "";
    unit?: string;
    supplier?: string;
  }>>({});

  const setEditField = (id: string, field: string, value: any) => {
    setInventoryEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const saveEdits = async (id: Id<"stock">) => {
    const draft = inventoryEdits[id as string] || {};
    // Build patch with conversions
    const patch: any = {};
    if (draft.itemName !== undefined) patch.itemName = draft.itemName.trim();
    // Updated: avoid number-string comparison; gracefully skip empty string
    if (draft.currentQuantity !== undefined) {
      const val = (draft as any).currentQuantity;
      if (val !== "") {
        patch.currentQuantity = Number(val);
      }
    }
    // Updated: avoid number-string comparison; gracefully skip empty string
    if (draft.pricePerUnit !== undefined) {
      const val = (draft as any).pricePerUnit;
      if (val !== "") {
        patch.pricePerUnit = Number(val);
      }
    }
    if (draft.expiryDate !== undefined) {
      patch.expiryDate = draft.expiryDate ? new Date(draft.expiryDate).getTime() : undefined;
    }
    if (draft.category !== undefined) patch.category = draft.category || undefined;
    if (draft.minStockLevel !== undefined) {
      patch.minStockLevel = draft.minStockLevel === "" ? undefined : Number(draft.minStockLevel);
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

  // Add: Alert popup state for low stock / expiring items
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertAdvice, setAlertAdvice] = useState<string>("");
  const [alertAdviceLoading, setAlertAdviceLoading] = useState(false);

  // NEW: Minimized alert state persisted to localStorage
  const [alertMinimized, setAlertMinimized] = useState<boolean>(false);

  // Load minimized state from localStorage on mount
  useEffect(() => {
    try {
      const v = localStorage.getItem("dash_alerts_minimized");
      setAlertMinimized(v === "1");
    } catch {
      // ignore
    }
  }, []);

  // Persist minimized state changes
  useEffect(() => {
    try {
      if (alertMinimized) {
        localStorage.setItem("dash_alerts_minimized", "1");
      } else {
        localStorage.removeItem("dash_alerts_minimized");
      }
    } catch {
      // ignore
    }
  }, [alertMinimized]);

  // Clean and simplify AI advice for human-friendly display
  const simplifyAdvice = (text: string): string[] => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        let s = l.replace(/^[-•]\s*/, ""); // remove bullet symbols

        // remove metrics like "~0.80/day"
        s = s.replace(/~\s*\d+(\.\d+)?\s*\/\s*day/gi, "");

        // simplify "≤ min (10)" to "low stock"
        s = s.replace(/≤\s*min\s*\(\s*\d+\s*\)/gi, "low stock");

        // replace comparison symbols with words
        s = s.replace(/≤/g, "at or below");
        s = s.replace(/≥/g, "at or above");
        s = s.replace(/~/g, "about ");

        // remove any remaining parenthetical clutter
        s = s.replace(/\((?:[^()]|\([^()]*\))*\)/g, "");

        // collapse extra spaces and tidy punctuation
        s = s.replace(/\s{2,}/g, " ").replace(/\s*[:\-–—]\s*$/g, "").trim();

        // capitalize first letter
        if (s.length > 0) s = s[0].toUpperCase() + s.slice(1);

        // add gentle phrasing for common fragments
        s = s.replace(/\breorder\b/i, "Reorder");
        s = s.replace(/\bsell through\b/i, "Sell faster");

        return s;
      })
      .filter(Boolean);

    return lines;
  };

  // Auto-open popup when there are alerts and not dismissed/minimized this session
  useEffect(() => {
    if (
      !alertDismissed &&
      !alertMinimized &&
      ((lowStockAlerts?.length || 0) > 0 || (expiringItems?.length || 0) > 0)
    ) {
      setAlertOpen(true);
    }
  }, [lowStockAlerts?.length, expiringItems?.length, alertDismissed, alertMinimized]);

  // Get AI advice for current alerts
  const handleGetAlertAdvice = async () => {
    try {
      setAlertAdviceLoading(true);
      setAlertAdvice("");
      const lowList = (lowStockAlerts || []).slice(0, 10).map(i => i.itemName).join(", ");
      const expList = (expiringItems || []).slice(0, 10).map(i => i.itemName).join(", ");
      const msgParts: Array<string> = [];
      if (lowList) msgParts.push(`Low stock items: ${lowList}`);
      if (expList) msgParts.push(`Expiring soon: ${expList}`);
      const prompt = [
        "Provide short, actionable steps for these alerts.",
        "For low stock, suggest order quantities (~14 days coverage) and reasons.",
        "For expiring items, suggest sell-through tactics and caution on reordering.",
        msgParts.join(" | "),
      ].join("\n");

      const resp = await chatWithAI({ message: prompt, language: user?.language });
      setAlertAdvice(resp);
    } catch (e) {
      console.error(e);
      toast.error("Failed to get AI advice");
    } finally {
      setAlertAdviceLoading(false);
    }
  };

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

  // Settings local state seeded from user
  const [settingsShopName, setSettingsShopName] = useState(user?.shopName || "");
  const [settingsOwnerName, setSettingsOwnerName] = useState(user?.ownerName || "");
  const [settingsContactNumber, setSettingsContactNumber] = useState(user?.contactNumber || "");
  const [settingsShopType, setSettingsShopType] = useState(user?.shopType || "general");
  const [settingsLanguage, setSettingsLanguage] = useState(user?.language || "en");
  const [settingsDefaultUnits, setSettingsDefaultUnits] = useState(user?.defaultUnits || "");
  const [settingsAiEnableSeasonal, setSettingsAiEnableSeasonal] = useState<boolean>(!!user?.aiEnableSeasonal);
  const [settingsAiEnableDeadStock, setSettingsAiEnableDeadStock] = useState<boolean>(!!user?.aiEnableDeadStock);
  const [settingsAiAlertFrequency, setSettingsAiAlertFrequency] = useState(user?.aiAlertFrequency || "weekly");
  const [settingsNotifyLowStock, setSettingsNotifyLowStock] = useState<boolean>(user?.notifyLowStock ?? true);
  const [settingsNotifyExpiry, setSettingsNotifyExpiry] = useState<boolean>(user?.notifyExpiry ?? true);
  const [settingsNotifySeasonal, setSettingsNotifySeasonal] = useState<boolean>(user?.notifySeasonal ?? false);

  // Keep settings in sync when user changes
  useEffect(() => {
    if (!user) return;
    setSettingsShopName(user.shopName || "");
    setSettingsOwnerName(user.ownerName || "");
    setSettingsContactNumber(user.contactNumber || "");
    setSettingsShopType(user.shopType || "general");
    setSettingsLanguage(user.language || "en");
    setSettingsDefaultUnits(user.defaultUnits || "");
    setSettingsAiEnableSeasonal(!!user.aiEnableSeasonal);
    setSettingsAiEnableDeadStock(!!user.aiEnableDeadStock);
    setSettingsAiAlertFrequency(user.aiAlertFrequency || "weekly");
    setSettingsNotifyLowStock(user.notifyLowStock ?? true);
    setSettingsNotifyExpiry(user.notifyExpiry ?? true);
    setSettingsNotifySeasonal(user.notifySeasonal ?? false);
  }, [user?._id]);

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        shopType: settingsShopType as any,
        shopName: settingsShopName || undefined,
        ownerName: settingsOwnerName || undefined,
        contactNumber: settingsContactNumber || undefined,
        language: settingsLanguage || undefined,
        defaultUnits: settingsDefaultUnits || undefined,
        aiEnableSeasonal: settingsAiEnableSeasonal,
        aiEnableDeadStock: settingsAiEnableDeadStock,
        aiAlertFrequency: settingsAiAlertFrequency,
        notifyLowStock: settingsNotifyLowStock,
        notifyExpiry: settingsNotifyExpiry,
        notifySeasonal: settingsNotifySeasonal,
      });
      toast.success("Settings saved");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings");
    }
  };

  // Helpers for CSV export
  const toCsv = (rows: Array<Record<string, any>>) => {
    if (!rows || rows.length === 0) return "";
    const headerSet = rows.reduce((acc: Set<string>, r) => {
      Object.keys(r).forEach((k) => acc.add(k));
      return acc;
    }, new Set<string>());
    const headers = Array.from(headerSet);
    const escape = (v: any) => {
      const s = v === null || v === undefined ? "" : String(v);
      if (s.includes(",") || s.includes("\n") || s.includes("\"")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ];
    return lines.join("\n");
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBackup = () => {
    try {
      const stockRows = (stock || []).map((s) => ({
        id: s._id,
        itemName: s.itemName,
        category: s.category || "",
        unit: s.unit || "",
        supplier: s.supplier || "",
        currentQuantity: s.currentQuantity,
        pricePerUnit: s.pricePerUnit,
        expiryDate: s.expiryDate ? new Date(s.expiryDate).toISOString().slice(0, 10) : "",
        minStockLevel: s.minStockLevel ?? "",
      }));
      const billsRows = (recentBills || []).map((b) => ({
        id: b._id,
        customerName: b.customerName || "",
        itemsCount: b.items.length,
        totalAmount: b.totalAmount,
        paymentMethod: b.paymentMethod || "",
        createdAt: new Date(b._creationTime).toISOString(),
      }));
      const salesRows = (sales || []).map((s) => ({
        id: s._id,
        stockId: s.stockId,
        itemName: s.itemName,
        quantitySold: s.quantitySold,
        pricePerUnit: s.pricePerUnit,
        totalAmount: s.totalAmount,
        billId: s.billId || "",
        createdAt: new Date(s._creationTime).toISOString(),
      }));

      downloadText("stock.csv", toCsv(stockRows));
      downloadText("bills.csv", toCsv(billsRows));
      downloadText("sales.csv", toCsv(salesRows));
      toast.success("Backup downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download backup");
    }
  };

  const handleClearData = async () => {
    if (!confirm("This will permanently delete all your stock, sales, and bills. Continue?")) return;
    try {
      await clearData({});
      toast.success("All data cleared");
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear data");
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  const totalItems = stock?.length || 0;
  const lowStockCount = lowStockAlerts?.length || 0;
  const expiringCount = expiringItems?.length || 0;
  const totalValue =
    stock?.reduce((sum, item) => sum + item.currentQuantity * item.pricePerUnit, 0) || 0;

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "billing", label: "Billing", icon: TrendingUp },
    { id: "ai-chat", label: "AI Assistant", icon: MessageSquare },
  ];

  // Prepare simplified advice lines for display
  const formattedAdviceLines = alertAdvice ? simplifyAdvice(alertAdvice) : [];

  // Add: split advice into actionable suggestions and seasonal reminders
  const splitIdx = formattedAdviceLines.findIndex((l) => /^seasonal/i.test(l));
  const suggestionLines = splitIdx === -1 ? formattedAdviceLines : formattedAdviceLines.slice(0, splitIdx);
  const seasonalLines = splitIdx === -1 ? [] : formattedAdviceLines.slice(splitIdx + 1);

  // NEW: total alerts count for minimized badge
  const alertCount =
    (lowStockAlerts?.length || 0) + (expiringItems?.length || 0);

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
          {/* New: Direct link to Stock page */}
          <button
            onClick={() => navigate("/stock")}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-sm text-left transition-colors hover:bg-secondary"
          >
            <Package className="w-5 h-5" />
            <span className="font-medium">Stock</span>
          </button>
        </div>

        <div className="border-t border-border pt-8">
          <div className="mb-4">
            <p className="text-sm font-medium">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {user.shopType || "General"} Store
            </p>
          </div>
          <Button
            variant={activeTab === "settings" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className="w-full mb-2"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
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
        {/* Alert Popup */}
        <Dialog open={alertOpen} onOpenChange={(open) => {
          setAlertOpen(open);
          if (!open) {
            // when dialog is closed, minimize it and prevent re-opening automatically
            setAlertDismissed(true);
            setAlertMinimized(true);
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Attention needed
              </DialogTitle>
              <DialogDescription>
                We noticed items that are low on stock and/or expiring soon.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {(lowStockAlerts?.length || 0) > 0 && (
                <div className="border rounded-sm p-3">
                  <div className="font-medium mb-2">Low Stock</div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {(lowStockAlerts || []).slice(0, 5).map((i) => (
                      <li key={i._id}>{i.itemName} — qty {i.currentQuantity}{i.unit ? ` ${i.unit}` : ""}</li>
                    ))}
                  </ul>
                  {(lowStockAlerts!.length > 5) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      +{lowStockAlerts!.length - 5} more
                    </div>
                  )}
                </div>
              )}

              {(expiringItems?.length || 0) > 0 && (
                <div className="border rounded-sm p-3">
                  <div className="font-medium mb-2">Expiring Soon</div>
                  <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                    {(expiringItems || []).slice(0, 5).map((i) => (
                      <li key={i._id}>
                        {i.itemName}
                        {i.expiryDate ? ` — expires ${new Date(i.expiryDate).toLocaleDateString()}` : ""}
                      </li>
                    ))}
                  </ul>
                  {(expiringItems!.length > 5) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      +{expiringItems!.length - 5} more
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button onClick={handleGetAlertAdvice} disabled={alertAdviceLoading} className="w-full">
                    {alertAdvice ? (alertAdviceLoading ? "Regenerating..." : "Regenerate Advice") : (alertAdviceLoading ? "Getting AI Advice..." : "Get AI Advice")}
                  </Button>
                  {alertAdvice && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(alertAdvice);
                          toast.success("Advice copied to clipboard");
                        } catch {
                          toast.error("Failed to copy");
                        }
                      }}
                    >
                      Copy
                    </Button>
                  )}
                </div>
                {alertAdvice && (
                  <div className="rounded-sm border bg-secondary/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="w-4 h-4" />
                      AI Advice
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <div className="space-y-3">
                        <div>
                          <div className="text-[13px] font-medium mb-1">
                            Based on recent sales velocity and current stock, consider:
                          </div>
                          <div className="rounded-sm border bg-background">
                            {suggestionLines.length > 0 ? (
                              <ul className="divide-y">
                                {suggestionLines.map((line, idx) => (
                                  <li key={idx} className="p-3 flex items-start gap-2">
                                    <span className="text-muted-foreground">{">\u003e"}</span>
                                    <span className="font-medium leading-relaxed">{line}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="p-3 text-muted-foreground">No advice available yet.</div>
                            )}
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground/80">
                            Tip: Aim for about 14 days of coverage; use about avg/day × 14 to estimate order size.
                          </p>
                        </div>

                        {seasonalLines.length > 0 && (
                          <div>
                            <div className="text-[13px] font-medium mb-1">Seasonal reminders:</div>
                            <div className="rounded-sm border bg-background p-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                                {seasonalLines.map((line, idx) => (
                                  <div key={idx} className="flex items-start gap-2 p-1">
                                    <span className="text-muted-foreground">{">\u003e"}</span>
                                    <span className="leading-relaxed">{line}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="flex justify-between">
              <Button variant="outline" onClick={() => { setAlertOpen(false); setAlertDismissed(true); }}>
                Dismiss
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/alerts/low-stock")} disabled={(lowStockAlerts?.length || 0) === 0}>
                  View Low Stock
                </Button>
                <Button variant="outline" onClick={() => navigate("/alerts/expiring")} disabled={(expiringItems?.length || 0) === 0}>
                  View Expiring
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* NEW: Minimized Alerts button (only shows when minimized and alerts exist) */}
        {alertMinimized && alertCount > 0 && (
          <div className="fixed bottom-6 left-6 z-50">
            <Button
              variant="outline"
              onClick={() => setAlertOpen(true)}
              className="shadow-lg bg-background/80 supports-[backdrop-filter]:bg-background/50 backdrop-blur"
            >
              <AlertTriangle className="w-4 h-4 mr-2 text-destructive" />
              Alerts ({alertCount})
            </Button>
          </div>
        )}

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
              </>
            )}

            {inventoryMode === "edit" && (
              <Card>
                <CardContent className="p-8">
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
                                onChange={(e) => setEditField(s._id as string, "itemName", e.target.value)}
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
                                onChange={(e) => setEditField(s._id as string, "category", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Unit</Label>
                              <Input
                                value={draft.unit ?? (s.unit || "")}
                                onChange={(e) => setEditField(s._id as string, "unit", e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Supplier</Label>
                              <Input
                                value={draft.supplier ?? (s.supplier || "")}
                                onChange={(e) => setEditField(s._id as string, "supplier", e.target.value)}
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

                          <div className="flex gap-3">
                            <Button size="sm" onClick={() => saveEdits(s._id as Id<"stock">)}>
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

        {activeTab === "settings" && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="mb-8">
              <h1 className="mb-2">Settings</h1>
              <p className="text-muted-foreground">
                Configure your account, inventory, AI assistant, notifications, and data.
              </p>
            </div>

            {/* 1. Account Settings */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>Account Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Shop Name</Label>
                  <Input
                    value={settingsShopName}
                    onChange={(e) => setSettingsShopName(e.target.value)}
                    placeholder="Enter shop name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Owner Name</Label>
                  <Input
                    value={settingsOwnerName}
                    onChange={(e) => setSettingsOwnerName(e.target.value)}
                    placeholder="Enter owner name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input
                    value={settingsContactNumber}
                    onChange={(e) => setSettingsContactNumber(e.target.value)}
                    placeholder="e.g., +91-XXXXXXXXXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Shop Type</Label>
                  <select
                    className="h-10 rounded-sm border bg-background px-3"
                    value={settingsShopType}
                    onChange={(e) => setSettingsShopType(e.target.value as "grocery" | "pharmacy" | "stationery" | "supermarket" | "general")}
                  >
                    <option value="grocery">Grocery</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="stationery">Stationery</option>
                    <option value="supermarket">Supermarket</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Preferred Language</Label>
                  <select
                    className="h-10 rounded-sm border bg-background px-3"
                    value={settingsLanguage}
                    onChange={(e) => setSettingsLanguage(e.target.value)}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="ml">Malayalam</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 2. Inventory & Billing Settings */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>Inventory & Billing Settings</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Default Units</Label>
                  <select
                    className="h-10 rounded-sm border bg-background px-3"
                    value={settingsDefaultUnits}
                    onChange={(e) => setSettingsDefaultUnits(e.target.value)}
                  >
                    <option value="">Select unit</option>
                    <option value="kg">kg</option>
                    <option value="litre">litre</option>
                    <option value="piece">piece</option>
                    <option value="strip">strip</option>
                    <option value="pack">pack</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 3. AI Assistant Settings */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>AI Assistant Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Enable seasonal/festival suggestions</div>
                    <div className="text-sm text-muted-foreground">
                      Include seasonal demand prompts in AI advice.
                    </div>
                  </div>
                  <Switch checked={settingsAiEnableSeasonal} onCheckedChange={setSettingsAiEnableSeasonal} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">Enable dead-stock alerts</div>
                    <div className="text-sm text-muted-foreground">
                      Highlight items with little to no sales movement.
                    </div>
                  </div>
                  <Switch checked={settingsAiEnableDeadStock} onCheckedChange={setSettingsAiEnableDeadStock} />
                </div>
                <div className="space-y-2">
                  <Label>Alert frequency</Label>
                  <select
                    className="h-10 rounded-sm border bg-background px-3"
                    value={settingsAiAlertFrequency}
                    onChange={(e) => setSettingsAiAlertFrequency(e.target.value)}
                  >
                    <option value="real-time">Real-time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* 4. Notification Settings */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Low-stock alerts</div>
                  <Switch checked={settingsNotifyLowStock} onCheckedChange={setSettingsNotifyLowStock} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Expiry alerts</div>
                  <Switch checked={settingsNotifyExpiry} onCheckedChange={setSettingsNotifyExpiry} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Seasonal demand alerts</div>
                  <Switch checked={settingsNotifySeasonal} onCheckedChange={setSettingsNotifySeasonal} />
                </div>
              </CardContent>
            </Card>

            {/* Upgrade Plan */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle>Upgrade Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Free Tier */}
                  <div className="border rounded-sm p-5 bg-secondary/20">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Free Tier • Starter</div>
                    <div className="text-2xl font-semibold mb-1">For small shopkeepers</div>
                    <div className="text-sm text-muted-foreground mb-4">Always free</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Upload stock & sales via Excel/CSV
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Smart Dashboard (basic stock view)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Low-stock alerts (top 5 items)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Simple Billing (basic bill generation)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Single shop support
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Language: English only
                      </li>
                      <li className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5" />
                        Monthly data limit: 500 records
                      </li>
                    </ul>
                    <div className="mt-5">
                      <Button
                        variant="outline"
                        onClick={() => toast("You're on the Free plan")}
                      >
                        Stay on Free
                      </Button>
                    </div>
                  </div>

                  {/* Pro Tier */}
                  <div className="border rounded-sm p-5 bg-background">
                    <div className="mb-2 text-sm font-medium text-muted-foreground">Premium Tier • Pro</div>
                    <div className="text-2xl font-semibold mb-1">For serious retailers</div>
                    <div className="text-sm text-muted-foreground mb-4">Everything in Free, plus:</div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Full AI Assistant (natural language queries)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Multilingual: English, Hindi, Malayalam
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Advanced Alerts: overstock/dead-stock, expiry reminders
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Festival/seasonal demand prediction
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Market Trends Insights (AI-based recommendations)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Multi-store Sync (manage multiple shops)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Supplier Integration (generate purchase orders)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Unlimited data storage (no record cap)
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5" />
                        Priority notifications (real-time stockout warnings)
                      </li>
                    </ul>
                    <div className="mt-5 flex gap-3">
                      <Button
                        onClick={() => toast("Upgrade flow coming soon")}
                      >
                        Upgrade to Pro
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => toast("Contact support for custom needs")}
                      >
                        Talk to Sales
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 5. Data Management */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Data Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Data (Excel/CSV)</Label>
                  <Input
                    type="file"
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" onClick={handleDownloadBackup}>
                    Download Backup (CSV)
                  </Button>
                  <Button variant="destructive" onClick={handleClearData}>
                    Clear Data
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Backup includes stock, bills, and sales. Clear Data removes all your stock, sales, and bills.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}