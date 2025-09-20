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
import { useState } from "react";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const stock = useQuery(api.stock.getStock);
  const lowStockAlerts = useQuery(api.stock.getLowStockAlerts);
  const expiringItems = useQuery(api.stock.getExpiringItems);
  const recentBills = useQuery(api.bills.getBills);

  const addStock = useMutation(api.stock.addStock);
  const chatWithAI = useAction(api.aiActions.chatWithAI);

  // Add: Inventory form state
  const [itemName, setItemName] = useState("");
  const [currentQuantity, setCurrentQuantity] = useState<number>(0);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [category, setCategory] = useState("");
  const [minStockLevel, setMinStockLevel] = useState<number | "">("");

  // Add: AI chat state
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);

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
      });
      toast.success("Stock item added");
      setItemName("");
      setCurrentQuantity(0);
      setPricePerUnit(0);
      setExpiryDate("");
      setCategory("");
      setMinStockLevel("");
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

              <Card className={lowStockCount > 0 ? "border-destructive" : ""}>
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

              <Card className={expiringCount > 0 ? "border-destructive" : ""}>
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

            {/* Alerts */}
            {(lowStockCount > 0 || expiringCount > 0) && (
              <Card className="mb-8 border-destructive">
                <CardHeader>
                  <CardTitle className="flex items-center text-destructive">
                    <AlertTriangle className="w-5 h-5 mr-2" />
                    Attention Required
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lowStockAlerts?.slice(0, 3).map((item) => (
                    <div key={item._id} className="flex justify-between items-center">
                      <span>{item.itemName}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.currentQuantity} left
                      </span>
                    </div>
                  ))}
                  {expiringItems?.slice(0, 3).map((item) => (
                    <div key={item._id} className="flex justify-between items-center">
                      <span>{item.itemName}</span>
                      <span className="text-sm text-muted-foreground">
                        Expires {new Date(item.expiryDate!).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

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
                        setMinStockLevel("");
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
                            ₹{s.pricePerUnit} • {s.category || "Uncategorized"}{s.expiryDate ? ` • Expires ${new Date(s.expiryDate).toLocaleDateString()}` : ""}
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
      </div>
    </div>
  );
}