import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { motion } from "framer-motion";

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              About <span className="text-primary">Sole.</span>
            </h1>
            <p className="text-muted-foreground mt-4 text-lg leading-relaxed max-w-2xl">
              We're a premium sneaker destination curating the finest footwear from the world's most iconic brands. 
              Our mission is simple: help you step into the future with style and confidence.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { label: "Founded", value: "2024" },
              { label: "Brands", value: "50+" },
              { label: "Happy Customers", value: "10K+" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass rounded-2xl p-6 text-center"
              >
                <p className="text-3xl font-black text-primary">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <div className="glass rounded-2xl p-8 space-y-4">
            <h2 className="text-2xl font-bold text-foreground">Our Promise</h2>
            <p className="text-muted-foreground leading-relaxed">
              Every pair in our catalog is hand-selected for quality, design, and comfort. 
              We believe sneakers are more than footwear — they're a statement. Whether you're 
              hitting the streets or the gym, we've got you covered with authentic products 
              and lightning-fast delivery.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
