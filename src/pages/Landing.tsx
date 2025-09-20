import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  BarChart3, 
  Brain, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle,
  Globe,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { useNavigate } from "react-router";

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Insights",
      description: "Get intelligent recommendations for restocking, seasonal trends, and inventory optimization."
    },
    {
      icon: BarChart3,
      title: "Smart Analytics",
      description: "Track sales patterns, identify bestsellers, and spot dead stock before it impacts profits."
    },
    {
      icon: AlertTriangle,
      title: "Proactive Alerts",
      description: "Never run out of stock again with predictive low-stock and expiry notifications."
    },
    {
      icon: Globe,
      title: "Multilingual Support",
      description: "Chat with AI in English, Hindi, or Malayalam for natural inventory management."
    }
  ];

  const shopTypes = [
    "Grocery Stores",
    "Pharmacies", 
    "Stationery Shops",
    "Supermarkets",
    "General Stores"
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-background"
    >
      {/* Navigation */}
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between py-6">
          <motion.div 
            className="flex items-center space-x-3"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-medium tracking-tight">StockSense AI</span>
          </motion.div>
          
          <motion.div
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {!isLoading && (
              <Button 
                onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
                className="font-medium"
              >
                {isAuthenticated ? "Dashboard" : "Get Started"}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            )}
          </motion.div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="section-padding">
        <div className="container">
          <motion.div 
            className="max-w-4xl mx-auto text-center"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            <h1 className="mb-8">
              AI-Powered Inventory Management
              <br />
              <span className="text-muted-foreground">for Indian Retailers</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Prevent stockouts, reduce dead inventory, and boost profits with intelligent 
              insights tailored for your shop type.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-lg px-8 py-6"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="text-lg px-8 py-6"
                onClick={() => window.open("https://drive.google.com/file/d/1tZ7qPnGABJGmv-czY-jjcJH8bKZM-BFb/view?usp=sharing", "_blank", "noopener,noreferrer")}
              >
                Watch Demo
              </Button>
            </div>

            {/* Shop Types */}
            <div className="flex flex-wrap justify-center gap-3 mb-16">
              {shopTypes.map((type, index) => (
                <motion.div
                  key={type}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="px-4 py-2 bg-secondary rounded-full text-sm font-medium"
                >
                  {type}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="section-padding bg-secondary/30">
        <div className="container">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="mb-6">Why Choose StockSense AI?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Transform your inventory management from reactive to predictive with AI insights.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ y: 30, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                viewport={{ once: true }}
              >
                <Card className="card-padding text-center border-0 shadow-none bg-background">
                  <div className="w-12 h-12 bg-primary rounded-sm flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <h3 className="mb-4">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="section-padding">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="mb-8">Stop Losing Money on Inventory</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="mb-2">Prevent Stockouts</h4>
                    <p className="text-muted-foreground">
                      AI predicts when items will run out based on sales velocity and seasonal patterns.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="mb-2">Reduce Dead Stock</h4>
                    <p className="text-muted-foreground">
                      Identify slow-moving inventory and get recommendations to free up capital.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <CheckCircle className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="mb-2">Smart Billing Integration</h4>
                    <p className="text-muted-foreground">
                      Every sale automatically updates inventory, keeping data accurate and current.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: 30, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="bg-secondary/50 rounded-lg p-8"
            >
              <div className="space-y-6">
                <div className="text-center">
                  <div className="text-3xl font-light mb-2">₹50,000+</div>
                  <p className="text-muted-foreground">Average monthly savings</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-light mb-2">85%</div>
                  <p className="text-muted-foreground">Reduction in stockouts</p>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-light mb-2">30%</div>
                  <p className="text-muted-foreground">Less dead inventory</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-padding bg-primary text-primary-foreground">
        <div className="container text-center">
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-6 text-primary-foreground">Ready to Transform Your Inventory?</h2>
            <p className="text-xl mb-8 text-primary-foreground/80 max-w-2xl mx-auto">
              Join thousands of retailers already using AI to optimize their inventory and boost profits.
            </p>
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => navigate("/auth")}
              className="text-lg px-8 py-6"
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-6 h-6 bg-primary rounded-sm flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-medium">StockSense AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Intelligent inventory management for Indian retailers
          </p>
        </div>
      </footer>
    </motion.div>
  );
}