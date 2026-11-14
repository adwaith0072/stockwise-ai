import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  BarChart3,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Settings,
  TrendingUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AlertsDialog } from "@/components/dashboard/AlertsDialog";
import { AiChatTab } from "@/components/dashboard/AiChatTab";
import { BillingTab } from "@/components/dashboard/BillingTab";
import { InventoryTab } from "@/components/dashboard/InventoryTab";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";

function toTimestamp(val: unknown): number | undefined {
  if (!val) return undefined;
  if (typeof val === "number") {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const ms = excelEpoch + val * 86400000;
    return Number.isNaN(ms) ? undefined : ms;
  }
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? undefined : d.getTime();
}

export default function Dashboard() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get("tab");
    const allowed = new Set([
      "overview",
      "inventory",
      "billing",
      "ai-chat",
      "settings",
    ]);
    if (tab && allowed.has(tab)) setActiveTab(tab);
  }, [location.search]);

  const stock = useQuery(api.stock.getStock);
  const lowStockAlerts = useQuery(api.stock.getLowStockAlerts);
  const expiringItems = useQuery(api.stock.getExpiringItems);
  const recentBills = useQuery(api.bills.getBills);
  const sales = useQuery(api.bills.getSales);
  const bulkUpsertStock = useMutation(api.stock.bulkUpsertStock);

  const handleFileUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      if (!rows.length) {
        toast.error("No data found in the uploaded file.");
        return;
      }

      const pick = (obj: Record<string, unknown>, keys: string[]) => {
        const map: Record<string, unknown> = {};
        for (const k of Object.keys(obj)) map[k.trim().toLowerCase()] = obj[k];
        for (const key of keys) {
          const found = map[key.toLowerCase()];
          if (found !== undefined && found !== "") return found;
        }
        return undefined;
      };

      const validItems: Array<{
        itemName: string;
        currentQuantity: number;
        pricePerUnit: number;
        expiryDate?: number;
        category?: string;
        minStockLevel?: number;
        unit?: string;
        supplier?: string;
      }> = [];
      let invalidRows = 0;

      for (const row of rows) {
        const itemNameVal = pick(row, ["Item Name", "Name", "Item"]);
        const categoryVal = pick(row, ["Category"]);
        const qtyVal = pick(row, ["Quantity in Stock", "Quantity", "Qty", "Stock"]);
        const unitVal = pick(row, ["Unit"]);
        const priceVal = pick(row, ["Selling Price", "Price", "MRP", "Rate"]);
        const expiryVal = pick(row, ["Expiry Date", "Expiry", "Expiration"]);
        const supplierVal = pick(row, ["Supplier", "Vendor", "Manufacturer"]);
        const minStockVal = pick(row, [
          "Min Stock Level",
          "Min Stock",
          "Reorder Level",
        ]);

        const itemNameStr = String(itemNameVal || "").trim();
        const qtyNum = Number(qtyVal);
        const priceNum = Number(priceVal);
        const minStockNum =
          minStockVal !== undefined ? Number(minStockVal) : undefined;

        if (
          !itemNameStr ||
          Number.isNaN(qtyNum) ||
          qtyNum < 0 ||
          Number.isNaN(priceNum) ||
          priceNum < 0
        ) {
          invalidRows++;
          continue;
        }

        validItems.push({
          itemName: itemNameStr,
          currentQuantity: qtyNum,
          pricePerUnit: priceNum,
          expiryDate: toTimestamp(expiryVal),
          category: categoryVal ? String(categoryVal).trim() : undefined,
          minStockLevel:
            minStockNum !== undefined && !Number.isNaN(minStockNum) && minStockNum >= 0
              ? minStockNum
              : undefined,
          unit: unitVal ? String(unitVal).trim() : undefined,
          supplier: supplierVal ? String(supplierVal).trim() : undefined,
        });
      }

      if (validItems.length === 0) {
        toast.error("No valid stock rows found in the uploaded file.");
        return;
      }

      toast("Uploading stock items...");
      const result = await bulkUpsertStock({ items: validItems });
      toast.success(
        `Processed ${result.inserted + result.updated} items (${result.inserted} added, ${result.updated} updated).`,
      );
      if (invalidRows > 0) {
        toast.error(`${invalidRows} invalid rows were skipped.`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to process the uploaded file.");
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeLowStockAlerts =
    user.notifyLowStock === false ? [] : (lowStockAlerts || []);
  const activeExpiringItems =
    user.notifyExpiry === false ? [] : (expiringItems || []);

  const totalItems = stock?.length || 0;
  const lowStockCount = lowStockAlerts?.length || 0;
  const expiringCount = expiringItems?.length || 0;
  const totalValue =
    stock?.reduce(
      (sum, item) => sum + item.currentQuantity * item.pricePerUnit,
      0,
    ) || 0;

  const sidebarItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "billing", label: "Billing", icon: TrendingUp },
    { id: "ai-chat", label: "AI Assistant", icon: MessageSquare },
  ];

  const handleSelectTab = (tab: string) => {
    setActiveTab(tab);
    setMobileNavOpen(false);
  };

  const renderSidebarContent = () => (
    <>
      <div className="flex items-center space-x-3 mb-10">
        <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-xl font-medium tracking-tight">StockWise AI</span>
      </div>

      <div className="space-y-2 mb-10">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={() => handleSelectTab(item.id)}
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
        <button
          onClick={() => {
            setMobileNavOpen(false);
            navigate("/stock");
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-sm text-left transition-colors hover:bg-secondary"
        >
          <Package className="w-5 h-5" />
          <span className="font-medium">Stock</span>
        </button>
      </div>

      <div className="border-t border-border pt-6 mt-auto">
        <div className="mb-4">
          <p className="text-sm font-medium truncate">
            {user.name || user.email || "Guest Store"}
          </p>
          <p className="text-xs text-muted-foreground capitalize">
            {user.shopType || "General"} Store
          </p>
        </div>
        <Button
          variant={activeTab === "settings" ? "default" : "outline"}
          size="sm"
          onClick={() => handleSelectTab("settings")}
          className="w-full mb-2"
        >
          <Settings className="w-4 h-4 mr-2" />
          Settings
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void signOut()}
          className="w-full"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header & Drawer */}
      <div className="flex md:hidden items-center justify-between border-b border-border px-4 py-3 bg-secondary/20">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-medium tracking-tight">StockWise AI</span>
        </div>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open menu">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-6 flex flex-col">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            {renderSidebarContent()}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <motion.aside
        className="hidden md:flex md:w-64 md:flex-col bg-secondary/30 border-r border-border p-8 shrink-0"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {renderSidebarContent()}
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 min-w-0">
        <AlertsDialog
          lowStockAlerts={activeLowStockAlerts}
          expiringItems={activeExpiringItems}
          userLanguage={user.language}
        />

        {activeTab === "overview" && (
          <OverviewTab
            totalItems={totalItems}
            totalValue={totalValue}
            lowStockCount={lowStockCount}
            expiringCount={expiringCount}
            onSelectTab={setActiveTab}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryTab
            stock={stock}
            defaultUnits={user.defaultUnits}
            onFileUpload={handleFileUpload}
          />
        )}

        {activeTab === "billing" && (
          <BillingTab stock={stock} recentBills={recentBills} />
        )}

        {activeTab === "ai-chat" && <AiChatTab userLanguage={user.language} />}

        {activeTab === "settings" && (
          <SettingsTab
            user={user}
            stock={stock}
            recentBills={recentBills}
            sales={sales}
            onFileUpload={handleFileUpload}
          />
        )}
      </main>
    </div>
  );
}
