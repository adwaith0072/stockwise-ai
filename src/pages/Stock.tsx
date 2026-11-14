import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function Stock() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const stock = useQuery(api.stock.getStock);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  // Helper: format expiry with days remaining/ago
  const formatExpiry = (ts?: number) => {
    if (!ts) return "";
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.ceil((ts - Date.now()) / msPerDay);
    const dateStr = new Date(ts).toLocaleDateString();
    const suffix =
      daysLeft >= 0 ? `(${daysLeft} days left)` : `(${Math.abs(daysLeft)} days ago)`;
    return ` • Expires ${dateStr} ${suffix}`;
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6 md:px-8 md:py-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mb-2">Stock</h1>
            <p className="text-muted-foreground">
              View all your inventory items in one place.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button onClick={() => navigate("/dashboard?tab=inventory")}>
              Update Stock
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="space-y-2 md:space-y-3">
              {(stock || []).map((s) => (
                <div
                  key={s._id}
                  className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border rounded-sm p-4"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{s.itemName}</span>
                    <span className="text-sm text-muted-foreground break-words">
                      ₹{s.pricePerUnit} • {s.category || "Uncategorized"}
                      {s.unit ? ` • ${s.unit}` : ""}
                      {formatExpiry(s.expiryDate)}
                      {s.supplier ? ` • Supplier ${s.supplier}` : ""}
                      {s.currentQuantity === 0 ? " • Out of stock" : ""}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground md:text-right">
                    Qty: {s.currentQuantity}
                  </div>
                </div>
              ))}
              {stock && stock.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No items yet. Click "Update Stock" to add your first item.
                </p>
              )}
              {!stock && (
                <p className="text-sm text-muted-foreground">Loading...</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
