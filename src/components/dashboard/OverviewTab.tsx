import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { AlertTriangle, MessageSquare, Plus, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewTabProps {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  expiringCount: number;
  onSelectTab: (tab: string) => void;
}

export function OverviewTab({
  totalItems,
  totalValue,
  lowStockCount,
  expiringCount,
  onSelectTab,
}: OverviewTabProps) {
  const navigate = useNavigate();

  return (
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

        <Card
          className={
            lowStockCount > 0 ? "border-destructive cursor-pointer" : "cursor-pointer"
          }
          onClick={() => navigate("/alerts/low-stock")}
        >
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

        <Card
          className={
            expiringCount > 0 ? "border-destructive cursor-pointer" : "cursor-pointer"
          }
          onClick={() => navigate("/alerts/expiring")}
        >
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
          onClick={() => onSelectTab("inventory")}
        >
          <Plus className="w-6 h-6" />
          <span>Add Stock</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex-col space-y-2"
          onClick={() => onSelectTab("billing")}
        >
          <TrendingUp className="w-6 h-6" />
          <span>Create Bill</span>
        </Button>

        <Button
          variant="outline"
          className="h-24 flex-col space-y-2"
          onClick={() => onSelectTab("ai-chat")}
        >
          <MessageSquare className="w-6 h-6" />
          <span>Ask AI</span>
        </Button>
      </div>
    </motion.div>
  );
}
