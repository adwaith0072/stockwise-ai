import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router";

export default function Stock() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stock = useQuery(api.stock.getStock);

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2">Stock</h1>
            <p className="text-muted-foreground">
              View all your inventory items in one place.
            </p>
          </div>
          <Button onClick={() => navigate("/dashboard?tab=inventory")}>
            Update Stock
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
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
                  No items yet. Click “Update Stock” to add your first item.
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
