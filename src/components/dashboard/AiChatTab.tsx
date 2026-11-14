import { useState } from "react";
import { motion } from "framer-motion";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AiChatTabProps {
  userLanguage?: string;
}

export function AiChatTab({ userLanguage }: AiChatTabProps) {
  const persistedHistory = useQuery(api.ai.getChatHistory);
  const chatWithAI = useAction(api.aiActions.chatWithAI);
  const clearChatHistory = useMutation(api.ai.clearChatHistory);

  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleSendAI = async () => {
    const msg = aiMessage.trim();
    if (!msg || aiLoading) return;

    setPendingMessage(msg);
    setAiMessage("");
    setAiLoading(true);
    try {
      await chatWithAI({ message: msg, language: userLanguage });
    } catch (err) {
      console.error(err);
      setAiMessage(msg);
      toast.error("AI assistant failed to respond");
    } finally {
      setPendingMessage(null);
      setAiLoading(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearChatHistory({});
      toast.success("Chat history cleared");
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear chat history");
    }
  };

  const historyItems = persistedHistory || [];

  return (
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
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <Label>Your Question</Label>
            <Textarea
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  void handleSendAI();
                }
              }}
              placeholder="e.g., Which items are low on stock and should I reorder this week?"
              className="min-h-[120px]"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              onClick={() => void handleSendAI()}
              disabled={aiLoading || !aiMessage.trim()}
            >
              {aiLoading ? "Thinking..." : "Ask AI"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleClearHistory()}
              disabled={aiLoading || historyItems.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear History
            </Button>
          </div>

          <div className="space-y-4">
            {persistedHistory === undefined && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading chat history...
              </div>
            )}

            {historyItems.map((entry) => (
              <div key={entry._id} className="space-y-3">
                <div className="p-4 rounded-sm border bg-secondary/40">
                  <div className="text-xs uppercase text-muted-foreground mb-1">
                    You
                  </div>
                  <div className="whitespace-pre-wrap">{entry.message}</div>
                </div>
                <div className="p-4 rounded-sm border bg-background">
                  <div className="text-xs uppercase text-muted-foreground mb-1">
                    Assistant
                  </div>
                  <div className="whitespace-pre-wrap">{entry.response}</div>
                </div>
              </div>
            ))}

            {pendingMessage && (
              <div className="space-y-3">
                <div className="p-4 rounded-sm border bg-secondary/40">
                  <div className="text-xs uppercase text-muted-foreground mb-1">
                    You
                  </div>
                  <div className="whitespace-pre-wrap">{pendingMessage}</div>
                </div>
                <div className="p-4 rounded-sm border bg-background flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing inventory and generating response...
                </div>
              </div>
            )}

            {persistedHistory && historyItems.length === 0 && !pendingMessage && (
              <p className="text-sm text-muted-foreground">
                No conversation yet. Ask a question above to get started.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
