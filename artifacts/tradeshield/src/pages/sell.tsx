import { useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  useListProducts,
  getListProductsQueryKey,
  useCreateProduct,
  useUpdateProduct,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/design-system";
import { useToast } from "@/hooks/use-toast";
import { formatGhs } from "@/lib/format";
import { PRODUCT_CATEGORIES } from "@/lib/catalog-constants";
import type { CatalogProduct } from "@workspace/api-client-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  unitPrice: z.string().min(1, "Price is required"),
  moq: z.coerce.number().min(1),
  unit: z.string().min(1, "Unit is required"),
  stockQty: z.coerce.number().min(0),
  photoUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export default function Sell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: products, isLoading } = useListProducts(
    { supplierId: user?.id },
    {
      query: {
        queryKey: getListProductsQueryKey({ supplierId: user?.id }),
        enabled: !!user?.id,
      },
    },
  );

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getListProductsQueryKey({ supplierId: user?.id }),
    });

  const createMut = useCreateProduct({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsDialogOpen(false);
        toast({ title: "Product created" });
      },
    },
  });
  const updateMut = useUpdateProduct({
    mutation: {
      onSuccess: () => {
        invalidate();
        setIsDialogOpen(false);
        toast({ title: "Product updated" });
      },
    },
  });

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      category: PRODUCT_CATEGORIES[0],
      unitPrice: "",
      moq: 1,
      unit: "pieces",
      stockQty: 0,
      photoUrl: "",
      isActive: true,
    },
  });

  const openNew = () => {
    setEditingId(null);
    form.reset({
      name: "",
      category: PRODUCT_CATEGORIES[0],
      unitPrice: "",
      moq: 1,
      unit: "pieces",
      stockQty: 0,
      photoUrl: "",
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (product: CatalogProduct) => {
    setEditingId(product.id);
    form.reset({
      name: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      moq: product.moq,
      unit: product.unit,
      stockQty: product.stockQty,
      photoUrl: product.photoUrl || "",
      isActive: product.isActive,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof productSchema>) => {
    if (editingId) {
      updateMut.mutate({ id: editingId, data: values });
    } else {
      createMut.mutate({ data: values });
    }
  };

  const toggleActive = (id: number, current: boolean) => {
    updateMut.mutate({ id, data: { isActive: !current } });
  };

  return (
    <div className="ts-container py-8 md:py-10 max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <PageHeader
          title="Your products"
          description="Manage listings. Deactivate instead of deleting to preserve order history."
        />
        <Button onClick={openNew} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" /> Add product
        </Button>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock / MOQ</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : products?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Package className="h-12 w-12 mb-4 opacity-20" />
                    <p>No products listed yet.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              products?.map((product) => (
                <TableRow key={product.id} className={!product.isActive ? "opacity-60" : ""}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {product.photoUrl ? (
                        <img
                          src={product.photoUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{product.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatGhs(product.unitPrice)} / {product.unit}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{product.stockQty}</span> in stock
                      <br />
                      <span className="text-muted-foreground text-xs">
                        Min: {product.moq}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={product.isActive}
                        onCheckedChange={() => toggleActive(product.id, product.isActive)}
                        disabled={updateMut.isPending}
                      />
                      <span className="text-sm text-muted-foreground">
                        {product.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit product" : "Add new product"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {PRODUCT_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit price (GHS)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit (e.g. bag, carton)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="moq"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minimum order quantity</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockQty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available stock</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="photoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo URL (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active listing</FormLabel>
                      <p className="text-sm text-muted-foreground">Visible to buyers</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? "Saving…" : "Save product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
