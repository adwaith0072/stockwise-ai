import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { AlertTriangle, MessageSquare } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AlertsDialogProps {
  lowStockAlerts: Array<Doc<"stock">>;
  expiringItems: Array<Doc<"stock">>;
  userLanguage?: string;
}

function simplifyAdvice(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      let s = l.replace(/^[-•]\s*/, "");
      s = s.replace(/~\s*\d+(\.\d+)?\s*\/\s*day/gi, "");
      s = s.replace(/≤\s*min\s*\(\s*\d+\s*\)/gi, "low stock");
      s = s.replace(/≤/g, "at or below");
      s = s.replace(/≥/g, "at or above");
      s = s.replace(/~/g, "about ");
      s = s.replace(/\((?:[^()]|\([^()]*\))*\)/g, "");
      s = s.replace(/\s{2,}/g, " ").replace(/\s*[:\-–—]\s*$/g, "").trim();
      if (s.length > 0) s = s[0].toUpperCase() + s.slice(1);
      s = s.replace(/\breorder\b/i, "Reorder");
      s = s.replace(/\bsell through\b/i, "Sell faster");
      return s;
    })
    .filter(Boolean);
}

export function AlertsDialog({
  lowStockAlerts,
  expiringItems,
  userLanguage,
}: AlertsDialogProps) {
  const navigate = useNavigate();
  const chatWithAI = useAction(api.aiActions.chatWithAI);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [alertAdvice, setAlertAdvice] = useState("");
  const [alertAdviceLoading, setAlertAdviceLoading] = useState(false);
  const [alertMinimized, setAlertMinimized] = useState(false);

  useEffect(() => {
    try {
      setAlertMinimized(localStorage.getItem("dash_alerts_minimized") === "1");
    } catch {
      // ignore storage access issues
    }
  }, []);

  useEffect(() => {
    try {
      if (alertMinimized) {
        localStorage.setItem("dash_alerts_minimized", "1");
      } else {
        localStorage.removeItem("dash_alerts_minimized");
      }
    } catch {
      // ignore storage access issues
    }
  }, [alertMinimized]);

  useEffect(() => {
    if (
      !alertDismissed &&
      !alertMinimized &&
      (lowStockAlerts.length > 0 || expiringItems.length > 0)
    ) {
      setAlertOpen(true);
    }
  }, [lowStockAlerts.length, expiringItems.length, alertDismissed, alertMinimized]);

  const handleGetAlertAdvice = async () => {
    try {
      setAlertAdviceLoading(true);
      setAlertAdvice("");
      const lowList = lowStockAlerts
        .slice(0, 10)
        .map((i) => i.itemName)
        .join(", ");
      const expList = expiringItems
        .slice(0, 10)
        .map((i) => i.itemName)
        .join(", ");
      const msgParts: Array<string> = [];
      if (lowList) msgParts.push(`Low stock items: ${lowList}`);
      if (expList) msgParts.push(`Expiring soon: ${expList}`);

      const prompt = [
        "Provide short, actionable steps for these alerts.",
        "For low stock, suggest order quantities (~14 days coverage) and reasons.",
        "For expiring items, suggest sell-through tactics and caution on reordering.",
        msgParts.join(" | "),
      ].join("\n");

      const resp = await chatWithAI({ message: prompt, language: userLanguage });
      setAlertAdvice(resp);
    } catch (e) {
      console.error(e);
      toast.error("Failed to get AI advice");
    } finally {
      setAlertAdviceLoading(false);
    }
  };

  const formattedAdviceLines = alertAdvice ? simplifyAdvice(alertAdvice) : [];
  const splitIdx = formattedAdviceLines.findIndex((l) => /^seasonal/i.test(l));
  const suggestionLines =
    splitIdx === -1 ? formattedAdviceLines : formattedAdviceLines.slice(0, splitIdx);
  const seasonalLines =
    splitIdx === -1 ? [] : formattedAdviceLines.slice(splitIdx + 1);
  const alertCount = lowStockAlerts.length + expiringItems.length;

  return (
    <>
      <Dialog
        open={alertOpen}
        onOpenChange={(open) => {
          setAlertOpen(open);
          if (!open) {
            setAlertDismissed(true);
            setAlertMinimized(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
            {lowStockAlerts.length > 0 && (
              <div className="border rounded-sm p-3">
                <div className="font-medium mb-2">Low Stock</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {lowStockAlerts.slice(0, 5).map((i) => (
                    <li key={i._id}>
                      {i.itemName} — qty {i.currentQuantity}
                      {i.unit ? ` ${i.unit}` : ""}
                    </li>
                  ))}
                </ul>
                {lowStockAlerts.length > 5 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    +{lowStockAlerts.length - 5} more
                  </div>
                )}
              </div>
            )}

            {expiringItems.length > 0 && (
              <div className="border rounded-sm p-3">
                <div className="font-medium mb-2">Expiring Soon</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {expiringItems.slice(0, 5).map((i) => (
                    <li key={i._id}>
                      {i.itemName}
                      {i.expiryDate
                        ? ` — expires ${new Date(i.expiryDate).toLocaleDateString()}`
                        : ""}
                    </li>
                  ))}
                </ul>
                {expiringItems.length > 5 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    +{expiringItems.length - 5} more
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  onClick={handleGetAlertAdvice}
                  disabled={alertAdviceLoading}
                  className="w-full"
                >
                  {alertAdvice
                    ? alertAdviceLoading
                      ? "Regenerating..."
                      : "Regenerate Advice"
                    : alertAdviceLoading
                      ? "Getting AI Advice..."
                      : "Get AI Advice"}
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
                                  <span className="text-muted-foreground">{">>"}</span>
                                  <span className="font-medium leading-relaxed">{line}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="p-3 text-muted-foreground">
                              No advice available yet.
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] text-muted-foreground/80">
                          Tip: Aim for about 14 days of coverage; use about avg/day × 14 to estimate order size.
                        </p>
                      </div>

                      {seasonalLines.length > 0 && (
                        <div>
                          <div className="text-[13px] font-medium mb-1">
                            Seasonal reminders:
                          </div>
                          <div className="rounded-sm border bg-background p-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {seasonalLines.map((line, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-1">
                                  <span className="text-muted-foreground">{">>"}</span>
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

          <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAlertOpen(false);
                setAlertDismissed(true);
              }}
            >
              Dismiss
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("/alerts/low-stock")}
                disabled={lowStockAlerts.length === 0}
              >
                View Low Stock
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/alerts/expiring")}
                disabled={expiringItems.length === 0}
              >
                View Expiring
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </>
  );
}
