import { Header } from "@/components/Header";
import { CartDrawer } from "@/components/CartDrawer";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

const brands = [
  { name: "Nike", slug: "Nike", description: "Just Do It. Innovation and performance since 1964.", color: "from-orange-500/20 to-red-500/20" },
  { name: "Adidas", slug: "Adidas", description: "Impossible Is Nothing. German engineering meets street culture.", color: "from-blue-500/20 to-cyan-500/20" },
  { name: "Puma", slug: "Puma", description: "Forever Faster. Bold designs for the fearless.", color: "from-green-500/20 to-emerald-500/20" },
  { name: "New Balance", slug: "New Balance", description: "Fearlessly Independent. Crafted comfort since 1906.", color: "from-purple-500/20 to-violet-500/20" },
  { name: "Converse", slug: "Converse", description: "Shoes Are Boring. Wear Sneakers.", color: "from-pink-500/20 to-rose-500/20" },
  { name: "Reebok", slug: "Reebok", description: "Life Is Not a Spectator Sport.", color: "from-yellow-500/20 to-amber-500/20" },
];

export default function Brands() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CartDrawer />
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <h1 className="text-4xl lg:text-5xl font-black text-foreground tracking-tight">
            Our <span className="text-primary">Brands</span>
          </h1>
          <p className="text-muted-foreground mt-2 max-w-lg">
            We partner with the best in the game. Explore our curated brand roster.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((brand, i) => (
            <motion.div
              key={brand.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <Link to={`/?brand=${brand.slug}`} className="block group">
                <div className={`rounded-2xl glass p-8 h-48 flex flex-col justify-end bg-gradient-to-br ${brand.color} transition-all group-hover:scale-[1.02] group-hover:shadow-xl`}>
                  <h2 className="text-2xl font-black text-foreground">{brand.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{brand.description}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
