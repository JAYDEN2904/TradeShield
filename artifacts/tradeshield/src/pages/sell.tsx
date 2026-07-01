import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useListProducts, getListProductsQueryKey, useCreateProduct, useUpdateProduct, useDeleteProduct } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, Package, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

  const { data: products, isLoading } = useListProducts({ supplierId: user?.id }, {
    query: {
      queryKey: getListProductsQueryKey({ supplierId: user?.id }),
      enabled: !!user?.id
    }
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProductsQueryKey({ supplierId: user?.id }) });

  const createMut = useCreateProduct({ mutation: { onSuccess: () => { invalidate(); setIsDialogOpen(false); toast({title: "Product created"}); } } });
  const updateMut = useUpdateProduct({ mutation: { onSuccess: () => { invalidate(); setIsDialogOpen(false); toast({title: "Product updated"}); } } });
  const deleteMut = useDeleteProduct({ mutation: { onSuccess: () => { invalidate(); toast({title: "Product deleted"}); } } });

  const form = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", category: "", unitPrice: "", moq: 1, unit: "pieces", stockQty: 0, photoUrl: "", isActive: true }
  });

  const openNew = () => {
    setEditingId(null);
    form.reset({ name: "", category: "", unitPrice: "", moq: 1, unit: "pieces", stockQty: 0, photoUrl: "", isActive: true });
    setIsDialogOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingId(product.id);
    form.reset({
      name: product.name,
      category: product.category,
      unitPrice: product.unitPrice,
      moq: product.moq,
      unit: product.unit,
      stockQty: product.stockQty,
      photoUrl: product.photoUrl || "",
      isActive: product.isActive
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Products</h1>
          <p className="text-muted-foreground mt-1">Manage your wholesale catalog.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Add Product
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
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
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
                <TableRow key={product.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      {product.photoUrl ? (
                        <img src={product.photoUrl} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      {product.name}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{product.category}</Badge></TableCell>
                  <TableCell>₵{product.unitPrice} / {product.unit}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <span className="font-medium">{product.stockQty}</span> in stock<br/>
                      <span className="text-muted-foreground text-xs">Min: {product.moq}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={product.isActive} 
                        onCheckedChange={() => toggleActive(product.id, product.isActive)} 
                        disabled={updateMut.isPending}
                      />
                      <span className="text-sm text-muted-foreground">{product.isActive ? 'Active' : 'Inactive'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => {
                      if(confirm("Delete this product?")) deleteMut.mutate({ id: product.id });
                    }}>
                      <Trash2 className="h-4 w-4" />
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
            <DialogTitle>{editingId ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unitPrice" render={({ field }) => (
                  <FormItem><FormLabel>Unit Price (₵)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem><FormLabel>Unit (e.g. pieces, kg)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="moq" render={({ field }) => (
                  <FormItem><FormLabel>Minimum Order Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stockQty" render={({ field }) => (
                  <FormItem><FormLabel>Available Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="photoUrl" render={({ field }) => (
                <FormItem><FormLabel>Photo URL (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5"><FormLabel className="text-base">Active Listing</FormLabel><p className="text-sm text-muted-foreground">Visible to buyers</p></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? "Saving..." : "Save Product"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
