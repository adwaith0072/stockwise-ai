import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BillingTabProps {
  stock: Array<Doc<"stock">> | undefined;
  recentBills: Array<Doc<"bills">> | undefined;
}

interface CartItem {
  stockId: Id<"stock">;
  itemName: string;
  pricePerUnit: number;
  quantity: number;
  maxAvailable: number;
}

export function BillingTab({ stock, recentBills }: BillingTabProps) {
  const createBill = useMutation(api.bills.createBill);

  const [billingCustomerName, setBillingCustomerName] = useState("");
  const [billingPaymentMethod, setBillingPaymentMethod] = useState("Cash");
  const [billingSearch, setBillingSearch] = useState("");
  const [billingCart, setBillingCart] = useState<Array<CartItem>>([]);

  const addToCart = (s: Doc<"stock">) => {
    setBillingCart((prev) => {
      const idx = prev.findIndex((i) => i.stockId === s._id);
      if (idx >= 0) {
        if (prev[idx].quantity >= s.currentQuantity) {
          toast.error(`Only ${s.currentQuantity} available for ${s.itemName}`);
          return prev;
        }
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + 1,
          maxAvailable: s.currentQuantity,
        };
        return copy;
      }
      return [
        ...prev,
        {
          stockId: s._id,
          itemName: s.itemName,
          pricePerUnit: s.pricePerUnit,
          quantity: 1,
          maxAvailable: s.currentQuantity,
        },
      ];
    });
  };

  const updateQuantity = (stockId: Id<"stock">, qty: number) => {
    setBillingCart((prev) =>
      prev.map((i) => {
        if (i.stockId !== stockId) return i;
        const clamped = Math.min(Math.max(1, qty), Math.max(1, i.maxAvailable));
        if (qty > i.maxAvailable) {
          toast.error(`Only ${i.maxAvailable} available for ${i.itemName}`);
        }
        return { ...i, quantity: clamped };
      }),
    );
  };

  const removeFromCart = (stockId: Id<"stock">) => {
    setBillingCart((prev) => prev.filter((i) => i.stockId !== stockId));
  };

  const cartTotal = billingCart.reduce(
    (sum, i) => sum + i.quantity * i.pricePerUnit,
    0,
  );

  const handleCreateBill = async () => {
    if (billingCart.length === 0) {
      toast.error("Add at least one item to the cart");
      return;
    }
    try {
      await createBill({
        customerName: billingCustomerName || undefined,
        items: billingCart.map((i) => ({
          stockId: i.stockId,
          quantity: i.quantity,
        })),
        paymentMethod: billingPaymentMethod || undefined,
      });
      toast.success("Bill created");
      setBillingCart([]);
      setBillingCustomerName("");
      setBillingPaymentMethod("Cash");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to create bill");
    }
  };

  return (
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
          <CardContent className="p-6 md:p-8 space-y-4">
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
          <CardContent className="p-6 md:p-8 space-y-6">
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
                  className="h-10 w-full rounded-sm border bg-background px-3"
                  value={billingPaymentMethod}
                  onChange={(e) => setBillingPaymentMethod(e.target.value)}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="mb-2">Cart</h3>
              {billingCart.length === 0 && (
                <p className="text-sm text-muted-foreground">No items in cart.</p>
              )}
              {billingCart.map((i) => (
                <div
                  key={i.stockId}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-sm p-4"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{i.itemName}</span>
                    <span className="text-sm text-muted-foreground">
                      ₹{i.pricePerUnit} • Max: {i.maxAvailable}
                    </span>
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
                      max={i.maxAvailable}
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

            <div className="flex items-center justify-between border-t pt-4">
              <span className="font-medium">Total</span>
              <span className="text-xl font-light">
                ₹{cartTotal.toLocaleString()}
              </span>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleCreateBill}
                disabled={billingCart.length === 0}
              >
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
            <div
              key={b._id}
              className="flex items-center justify-between border rounded-sm p-4"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {b.customerName || "Walk-in Customer"}
                </span>
                <span className="text-sm text-muted-foreground">
                  {b.items.length} items • {b.paymentMethod || "—"}
                </span>
              </div>
              <div className="text-sm">₹{b.totalAmount.toLocaleString()}</div>
            </div>
          ))}
          {recentBills && recentBills.length === 0 && (
            <p className="text-sm text-muted-foreground">No bills yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
