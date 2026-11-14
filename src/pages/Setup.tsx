import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Store, ArrowRight, Loader2 } from "lucide-react";

export default function Setup() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useMutation(api.users.updateProfile);

  const [shopType, setShopType] = useState("");
  const [shopName, setShopName] = useState("");
  const [language, setLanguage] = useState("english");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (user.shopType) {
      navigate("/dashboard");
    }
  }, [authLoading, user, navigate]);

  if (authLoading || !user || user.shopType) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopType) {
      toast.error("Please select a shop type");
      return;
    }

    setIsLoading(true);
    try {
      await updateProfile({
        shopType: shopType as NonNullable<Doc<"users">["shopType"]>,
        shopName: shopName || undefined,
        language,
      });

      toast.success("Profile updated successfully!");
      navigate("/dashboard");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const shopTypes = [
    { value: "grocery", label: "Grocery Store", description: "Fruits, vegetables, daily essentials" },
    { value: "pharmacy", label: "Pharmacy", description: "Medicines, health products" },
    { value: "stationery", label: "Stationery Shop", description: "Books, pens, office supplies" },
    { value: "supermarket", label: "Supermarket", description: "Large retail store with multiple categories" },
    { value: "general", label: "General Store", description: "Mixed items and general merchandise" },
  ];

  const languages = [
    { value: "english", label: "English" },
    { value: "hindi", label: "हिंदी (Hindi)" },
    { value: "malayalam", label: "മലയാളം (Malayalam)" },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-2xl"
      >
        <Card>
          <CardHeader className="text-center pb-8">
            <div className="w-16 h-16 bg-primary rounded-sm flex items-center justify-center mx-auto mb-6">
              <Store className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-light tracking-tight">
              Set Up Your Store
            </CardTitle>
            <p className="text-muted-foreground mt-2">
              Tell us about your business to get personalized AI insights
            </p>
          </CardHeader>

          <CardContent className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Shop Type Selection */}
              <div className="space-y-4">
                <Label className="text-base font-medium">What type of store do you run?</Label>
                <div className="grid gap-3">
                  {shopTypes.map((type) => (
                    <motion.div
                      key={type.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <button
                        type="button"
                        onClick={() => setShopType(type.value)}
                        className={`w-full p-4 text-left border rounded-sm transition-colors ${
                          shopType === type.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className="font-medium mb-1">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Shop Name */}
              <div className="space-y-2">
                <Label htmlFor="shopName" className="text-base font-medium">
                  Shop Name (Optional)
                </Label>
                <Input
                  id="shopName"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Enter your shop name"
                  className="h-12"
                />
              </div>

              {/* Language Preference */}
              <div className="space-y-2">
                <Label className="text-base font-medium">
                  Preferred Language for AI Assistant
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base"
                disabled={!shopType || isLoading}
              >
                {isLoading ? "Setting up..." : "Complete Setup"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
