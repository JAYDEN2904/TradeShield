/** Format GHS amounts for display — always 2 decimal places */
export function formatGhs(amount: string | number): string {
  const value = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return "₵0.00";
  return `₵${value.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatOrderId(id: number): string {
  return `#${id.toString().padStart(6, "0")}`;
}
