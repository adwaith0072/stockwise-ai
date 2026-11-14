import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function LowStock() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const lowStock = useQuery(api.stock.getLowStockAlerts);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-4xl mx-auto"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="mb-2">Low Stock Items</h1>
            <p className="text-muted-foreground">
              Items at or below the minimum stock level.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-destructive" />
              {lowStock ? `${lowStock.length} items` : "Loading..."}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(lowStock || []).map((item) => (
              <div
                key={item._id}
                className="flex items-center justify-between border rounded-sm p-4"
              >
                <div className="flex flex-col">
                  <span className="font-medium">{item.itemName}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.category || "Uncategorized"}
                    {item.unit ? ` • ${item.unit}` : ""}
                    {item.supplier ? ` • Supplier ${item.supplier}` : ""}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Qty: {item.currentQuantity}
                </div>
              </div>
            ))}
            {lowStock && lowStock.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Great! No low stock items currently.
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
