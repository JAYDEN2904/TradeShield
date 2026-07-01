import { useState } from "react";
import { Link } from "wouter";
import { useListProducts } from "@workspace/api-client-react";
import { Search, Filter, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("_all");

  const { data: products, isLoading } = useListProducts({
    query: {
      queryKey: ["products", category !== "_all" ? category : undefined],
    }
  });

  const categories = ["_all", "Electronics", "Textiles", "Agriculture", "Construction", "FMCG", "Other"];

  const filteredProducts = products?.filter((p) => {
    if (!p.isActive) return false;
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === "_all" || p.category === category;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="flex-1 w-full bg-muted/20">
      <section className="bg-primary text-primary-foreground py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Trade Wholesale with Confidence</h1>
          <p className="text-lg md:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            The secure B2B escrow marketplace for Ghanaian wholesale suppliers and retailers. 
            Money is held safely until goods are confirmed received.
          </p>
          <div className="max-w-xl mx-auto bg-background p-2 rounded-lg flex items-center shadow-lg">
            <Search className="h-5 w-5 text-muted-foreground ml-3 mr-2" />
            <Input 
              className="border-0 shadow-none focus-visible:ring-0 text-foreground" 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-2xl font-bold text-foreground">Wholesale Catalog</h2>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[180px]" data-testid="select-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "_all" ? "All Categories" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="text-center py-24 bg-background border rounded-lg border-dashed">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No products found</h3>
            <p className="text-muted-foreground">Try adjusting your search or category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts?.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`} data-testid={`link-product-${product.id}`}>
                <Card className="h-full overflow-hidden hover:shadow-md transition-shadow group cursor-pointer border-border/60">
                  <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                    {product.photoUrl ? (
                      <img 
                        src={product.photoUrl} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/30 group-hover:scale-105 transition-transform duration-300">
                        <Package className="h-12 w-12" />
                      </div>
                    )}
                    <Badge className="absolute top-2 right-2 bg-background/80 text-foreground backdrop-blur hover:bg-background/90" variant="secondary">
                      {product.category}
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg line-clamp-1 mb-1 group-hover:text-primary transition-colors">{product.name}</h3>
                    <p className="text-xl font-bold text-primary mb-2">₵{product.unitPrice} <span className="text-xs text-muted-foreground font-normal">/ {product.unit}</span></p>
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>MOQ: {product.moq} {product.unit}</span>
                      <span>Stock: {product.stockQty}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
