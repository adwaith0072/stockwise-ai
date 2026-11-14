import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface SettingsTabProps {
  user: Doc<"users">;
  stock: Array<Doc<"stock">> | undefined;
  recentBills: Array<Doc<"bills">> | undefined;
  sales: Array<Doc<"sales">> | undefined;
  onFileUpload: (file: File) => Promise<void>;
}

function normalizeLang(lang?: string): string {
  if (!lang) return "english";
  const l = lang.trim().toLowerCase();
  if (l === "hi" || l === "hindi") return "hindi";
  if (l === "ml" || l === "malayalam") return "malayalam";
  return "english";
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows || rows.length === 0) return "";
  const headerSet = rows.reduce((acc: Set<string>, r) => {
    Object.keys(r).forEach((k) => acc.add(k));
    return acc;
  }, new Set<string>());
  const headers = Array.from(headerSet);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function SettingsTab({
  user,
  stock,
  recentBills,
  sales,
  onFileUpload,
}: SettingsTabProps) {
  const updateSettings = useMutation(api.users.updateSettings);
  const clearData = useMutation(api.users.clearData);

  const [settingsShopName, setSettingsShopName] = useState(user.shopName || "");
  const [settingsOwnerName, setSettingsOwnerName] = useState(user.ownerName || "");
  const [settingsContactNumber, setSettingsContactNumber] = useState(
    user.contactNumber || "",
  );
  const [settingsShopType, setSettingsShopType] = useState(
    user.shopType || "general",
  );
  const [settingsLanguage, setSettingsLanguage] = useState(
    normalizeLang(user.language),
  );
  const [settingsDefaultUnits, setSettingsDefaultUnits] = useState(
    user.defaultUnits || "",
  );
  const [settingsAiEnableSeasonal, setSettingsAiEnableSeasonal] = useState(
    user.aiEnableSeasonal ?? true,
  );
  const [settingsAiEnableDeadStock, setSettingsAiEnableDeadStock] = useState(
    user.aiEnableDeadStock ?? true,
  );
  const [settingsAiAlertFrequency, setSettingsAiAlertFrequency] = useState(
    user.aiAlertFrequency || "weekly",
  );
  const [settingsNotifyLowStock, setSettingsNotifyLowStock] = useState(
    user.notifyLowStock ?? true,
  );
  const [settingsNotifyExpiry, setSettingsNotifyExpiry] = useState(
    user.notifyExpiry ?? true,
  );
  const [settingsNotifySeasonal, setSettingsNotifySeasonal] = useState(
    user.notifySeasonal ?? false,
  );

  useEffect(() => {
    setSettingsShopName(user.shopName || "");
    setSettingsOwnerName(user.ownerName || "");
    setSettingsContactNumber(user.contactNumber || "");
    setSettingsShopType(user.shopType || "general");
    setSettingsLanguage(normalizeLang(user.language));
    setSettingsDefaultUnits(user.defaultUnits || "");
    setSettingsAiEnableSeasonal(user.aiEnableSeasonal ?? true);
    setSettingsAiEnableDeadStock(user.aiEnableDeadStock ?? true);
    setSettingsAiAlertFrequency(user.aiAlertFrequency || "weekly");
    setSettingsNotifyLowStock(user.notifyLowStock ?? true);
    setSettingsNotifyExpiry(user.notifyExpiry ?? true);
    setSettingsNotifySeasonal(user.notifySeasonal ?? false);
  }, [user._id]);

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        shopType: settingsShopType as Doc<"users">["shopType"],
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
        expiryDate: s.expiryDate
          ? new Date(s.expiryDate).toISOString().slice(0, 10)
          : "",
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
    if (
      !window.confirm(
        "This will permanently delete all your stock, sales, bills, and chat history. Continue?",
      )
    ) {
      return;
    }
    try {
      await clearData({});
      toast.success("All data cleared");
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear data");
    }
  };

  return (
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
              className="h-10 w-full rounded-sm border bg-background px-3"
              value={settingsShopType}
              onChange={(e) =>
                setSettingsShopType(
                  e.target.value as NonNullable<Doc<"users">["shopType"]>,
                )
              }
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
              className="h-10 w-full rounded-sm border bg-background px-3"
              value={settingsLanguage}
              onChange={(e) => setSettingsLanguage(e.target.value)}
            >
              <option value="english">English</option>
              <option value="hindi">हिंदी (Hindi)</option>
              <option value="malayalam">മലയാളം (Malayalam)</option>
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
              className="h-10 w-full rounded-sm border bg-background px-3"
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
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-medium">
                Enable seasonal/festival suggestions
              </div>
              <div className="text-sm text-muted-foreground">
                Include seasonal demand prompts in AI advice.
              </div>
            </div>
            <Switch
              checked={settingsAiEnableSeasonal}
              onCheckedChange={setSettingsAiEnableSeasonal}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-medium">Enable dead-stock alerts</div>
              <div className="text-sm text-muted-foreground">
                Highlight items with little to no sales movement.
              </div>
            </div>
            <Switch
              checked={settingsAiEnableDeadStock}
              onCheckedChange={setSettingsAiEnableDeadStock}
            />
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
            <Switch
              checked={settingsNotifyLowStock}
              onCheckedChange={setSettingsNotifyLowStock}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Expiry alerts</div>
            <Switch
              checked={settingsNotifyExpiry}
              onCheckedChange={setSettingsNotifyExpiry}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="font-medium">Seasonal demand alerts</div>
            <Switch
              checked={settingsNotifySeasonal}
              onCheckedChange={setSettingsNotifySeasonal}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mb-8 flex justify-end">
        <Button onClick={() => void handleSaveSettings()} className="h-11 px-8">
          Save Settings
        </Button>
      </div>

      {/* Upgrade Plan */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Upgrade Plan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border rounded-sm p-5 bg-secondary/20">
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Free Tier • Starter
              </div>
              <div className="text-2xl font-semibold mb-1">
                For small shopkeepers
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                Always free
              </div>
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

            <div className="border rounded-sm p-5 bg-background">
              <div className="mb-2 text-sm font-medium text-muted-foreground">
                Premium Tier • Pro
              </div>
              <div className="text-2xl font-semibold mb-1">
                For serious retailers
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                Everything in Free, plus:
              </div>
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
                <Button onClick={() => toast("Upgrade flow coming soon")}>
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
                if (f) void onFileUpload(f);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleDownloadBackup}>
              Download Backup (CSV)
            </Button>
            <Button variant="destructive" onClick={() => void handleClearData()}>
              Clear Data
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Backup includes stock, bills, and sales. Clear Data removes all your
            stock, sales, bills, and chat history.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
