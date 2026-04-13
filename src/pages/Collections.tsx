import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const collections = [
  {
    title: "Summer Essentials",
    description: "Lightweight kicks for warm-weather vibes.",
    image: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=800&h=500&fit=crop",
  },
  {
    title: "Street Heat",
    description: "Bold sneakers that turn heads on every block.",
    image: "https://images.unsplash.com/photo-1556906781-9a412961c28c?w=800&h=500&fit=crop",
  },
  {
    title: "Performance Lab",
    description: "Engineered for athletes who push limits.",
    image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=800&h=500&fit=crop",
  },
  {
    title: "Retro Revival",
    description: "Classic silhouettes reimagined for today.",
    image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&h=500&fit=crop",
  },
];

export default function Collections() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
            Curated <span className="text-primary">Collections</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            Handpicked edits for every mood and moment.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {collections.map((col, i) => (
            <motion.div
              key={col.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group relative rounded-2xl overflow-hidden h-72"
            >
              <img src={col.image} alt={col.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="relative h-full flex flex-col justify-end p-6">
                <h2 className="text-2xl font-black text-white">{col.title}</h2>
                <p className="text-white/70 text-sm mt-1">{col.description}</p>
                <Button variant="outline" size="sm" className="mt-3 w-fit rounded-full border-white/30 text-white hover:bg-white/10" asChild>
                  <Link to="/">
                    Explore <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
