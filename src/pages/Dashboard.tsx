import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
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
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="mb-2">Inventory Management</h3>
                  <p className="text-muted-foreground mb-6">
                    Add and manage your stock items here.
                  </p>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Item
                  </Button>
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
              <CardContent className="p-8">
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="mb-2">AI Chat Assistant</h3>
                  <p className="text-muted-foreground mb-6">
                    Ask questions about your inventory, get restocking recommendations, and more.
                  </p>
                  <Button>
                    Start Conversation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
