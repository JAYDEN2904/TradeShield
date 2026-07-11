import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Logo } from "@/components/logo";
import {
  useListProducts,
  getListProductsQueryKey,
} from "@workspace/api-client-react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Filter,
  Hammer,
  Lock,
  MapPin,
  Menu,
  Package,
  Phone,
  Quote,
  Search,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Star,
  TrendingUp,
  UtensilsCrossed,
  Users,
  Wheat,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SupplierTrustBadge, VerifyNudgeBanner } from "@/components/design-system";
import { Layout } from "@/components/layout";
import { formatGhs } from "@/lib/format";
import { LOCATION_FILTERS, PRODUCT_CATEGORIES } from "@/lib/catalog-constants";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// ─── Launch-phase strategy configuration ──────────────────────────────────────
//
// TradeShield is a two-sided marketplace launching cold (zero supply-side
// inventory). Without listed suppliers there is nothing for buyers to browse,
// so SUPPLIER acquisition is the primary conversion goal at launch.
//
// To shift to buyer-first once supply is established:
//   1. Change PRIMARY_AUDIENCE below to "buyer"
//   2. The primary CTA copy, hero headline framing, and section ordering
//      automatically adapt — no other changes required.
//
const LAUNCH_CONFIG = {
  PRIMARY_AUDIENCE: "supplier" as "supplier" | "buyer",
} as const;

// ─── Brand mark ───────────────────────────────────────────────────────────────

function ShieldMark({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 28 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
      style={style}
    >
      <path
        d="M14 0L1 5.5V14.5C1 21.956 6.72 28.836 14 30.5C21.28 28.836 27 21.956 27 14.5V5.5L14 0Z"
        fill="currentColor"
      />
      <path
        d="M9.5 16L12.5 19L18.5 13"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Category icon/color map ──────────────────────────────────────────────────

type CategoryConfig = {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  Groceries: { icon: ShoppingBasket, color: "text-emerald-700", bg: "bg-emerald-50" },
  Textiles: { icon: Shirt, color: "text-purple-700", bg: "bg-purple-50" },
  Electronics: { icon: Cpu, color: "text-blue-700", bg: "bg-blue-50" },
  Agriculture: { icon: Wheat, color: "text-amber-700", bg: "bg-amber-50" },
  Construction: { icon: Building2, color: "text-orange-700", bg: "bg-orange-50" },
  FMCG: { icon: Package, color: "text-teal-700", bg: "bg-teal-50" },
  Hardware: { icon: Hammer, color: "text-slate-700", bg: "bg-slate-100" },
  Foodstuffs: { icon: UtensilsCrossed, color: "text-red-700", bg: "bg-red-50" },
  Other: { icon: Boxes, color: "text-indigo-700", bg: "bg-indigo-50" },
};

const CATEGORY_COUNTS: Record<string, number> = {
  Groceries: 420,
  Textiles: 280,
  Electronics: 340,
  Agriculture: 195,
  Construction: 160,
  FMCG: 310,
  Hardware: 175,
  Foodstuffs: 390,
  Other: 230,
};

// ─── HOW IT WORKS steps (5-step escrow loop) ─────────────────────────────────

const HOW_IT_WORKS_STEPS = [
  {
    number: "01",
    title: "Browse & Order",
    desc: "Discover verified Ghanaian suppliers. Compare prices, check MOQs, and place your wholesale order in minutes.",
    icon: ShoppingBasket,
    callout: "Only verified, rated suppliers",
  },
  {
    number: "02",
    title: "Pay Into Escrow",
    desc: "Your payment goes into a secure escrow account — not directly to the supplier. Funds are held by TradeShield until delivery is confirmed.",
    icon: Lock,
    callout: "Your money never touches the supplier",
  },
  {
    number: "03",
    title: "Supplier Ships",
    desc: "The supplier sees funds are secured and prepares your order. They mark the order shipped and provide delivery details.",
    icon: Package,
    callout: "Supplier ships with payment guaranteed",
  },
  {
    number: "04",
    title: "Buyer Confirms",
    desc: "Inspect your delivery. Confirm receipt within 72 hours and funds are released. If something is wrong, open a dispute before confirming.",
    icon: CheckCircle2,
    callout: "72-hour confirmation window",
  },
  {
    number: "05",
    title: "Payout",
    desc: "Funds are released to the supplier via Moolre. Both parties rate the transaction. The trust score updates automatically.",
    icon: TrendingUp,
    callout: "Full dispute protection included",
  },
];

const PAIN_POINTS = [
  {
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
    title: "Supplier fraud",
    desc: "You pay upfront, the supplier disappears. No goods, no refund, no recourse.",
  },
  {
    icon: Package,
    color: "text-orange-600",
    bg: "bg-orange-50",
    title: "Wrong or damaged goods",
    desc: "What arrives doesn't match what was promised. Disputes drag on for weeks.",
  },
  {
    icon: Phone,
    color: "text-amber-600",
    bg: "bg-amber-50",
    title: "No order visibility",
    desc: "WhatsApp chains, phone calls, manual receipts. No tracking, no trail, no trust.",
  },
];

const VALUE_PROPS = [
  {
    icon: Shield,
    title: "Zero-Risk Escrow",
    desc: "Your money never goes directly to a supplier. It's held securely until you confirm you received exactly what you ordered.",
    stat: "GH₵ 0 lost to fraud",
  },
  {
    icon: BadgeCheck,
    title: "Verified Suppliers Only",
    desc: "Every supplier on TradeShield is verified and rated by real buyers. Transparent reviews mean no unpleasant surprises.",
    stat: "Progressive trust scoring",
  },
  {
    icon: Zap,
    title: "Order in Minutes",
    desc: "No phone calls, no WhatsApp back-and-forth. Browse, order, and track everything in one place — from Accra to Tamale.",
    stat: "Avg. 4 min to place an order",
  },
];

const COMPARISON_ROWS = [
  { label: "Payment security", oldWay: "Bank transfer — no protection", newWay: "Escrow-held until delivery confirmed" },
  { label: "Dispute resolution", oldWay: "You're on your own", newWay: "Mediated resolution, max 5 days" },
  { label: "Order tracking", oldWay: "WhatsApp messages & phone calls", newWay: "Live order status in your dashboard" },
  { label: "Supplier verification", oldWay: "Trust word of mouth", newWay: "Every supplier verified & rated" },
  { label: "Price transparency", oldWay: "Negotiated verbally, no record", newWay: "Published prices with MOQ clarity" },
  { label: "Time to order", oldWay: "Hours of back-and-forth", newWay: "Under 5 minutes, fully digital" },
];

// Fee tiers from the business model: new / growth / trusted
// Source: user brief (featureSpec fee tiers referenced there)
const SUPPLIER_FEE_TIERS = [
  { tier: "New", rate: "7%", condition: "First orders on the platform", highlight: false },
  { tier: "Growth", rate: "6%", condition: "After first 10 completed orders", highlight: true },
  { tier: "Trusted", rate: "5.5%", condition: "Established, high-rated suppliers", highlight: false },
];

const FAQ_ITEMS = [
  {
    question: "Is my money really safe? What stops TradeShield from taking it?",
    answer:
      "Funds are held via Moolre's payment infrastructure — not in a TradeShield bank account. Moolre is an established Ghanaian payment company. TradeShield's role is to instruct when to release funds (on confirmed delivery) or return them (on a upheld dispute). Neither the buyer nor the supplier controls the release — only the platform can trigger it based on order status.",
  },
  {
    question: "What if goods don't match the order?",
    answer:
      "Don't confirm receipt. Open a dispute directly from your order page. You must submit photo evidence and describe the specific discrepancy against what the listing stated. The supplier has 48 hours to submit a response and counter-evidence. Our admin team reviews both submissions and issues a ruling within 48–72 hours. Maximum total time from filing to resolution: 5 days. Outcomes can be full refund, full release to supplier, or a partial split — never a forced binary.",
  },
  {
    question: "How much does this actually cost?",
    answer:
      "Buyers pay 0% — there is no buyer fee on TradeShield. Suppliers pay a commission only when a sale completes: 7% for new suppliers, dropping to 6% after your first 10 completed orders, and 5.5% for established, high-rated suppliers. No upfront subscription, no listing fee, no monthly charge.",
  },
  {
    question: "Do I need a track record before I can sell?",
    answer:
      "No. Any verified Ghanaian business can apply to sell on TradeShield. You start at the New tier (7% commission) and your rate decreases automatically as you complete orders and earn buyer ratings. Verification requires basic business details and phone confirmation — no formal registration documents are required to get started.",
  },
  {
    question: "What happens if the buyer doesn't confirm delivery?",
    answer:
      "If a buyer doesn't confirm or dispute within 72 hours of the expected delivery date, the platform auto-releases funds to you. You'll see this countdown in your supplier dashboard. Buyers receive reminders before the window closes — so silence doesn't trap your money indefinitely.",
  },
  {
    question: "Can a buyer file a dispute on anything?",
    answer:
      "No. A dispute requires photo evidence and a specific written discrepancy from what the listing stated. 'I don't like it' or general dissatisfaction without reference to the listing is rejected at submission — it never reaches you or freezes your funds. The platform tracks dispute patterns: a buyer who repeatedly files claims that get ruled unfounded loses standing.",
  },
];

// ─── Shared product card ──────────────────────────────────────────────────────

type ProductItem = {
  id: number;
  name: string;
  category: string;
  photoUrl?: string | null;
  stockQty: number;
  unitPrice: string;
  unit: string;
  moq: number;
  supplierBusinessName?: string | null;
  supplierIsNew?: boolean | null;
  supplierCompletedOrders?: number | null;
  supplierAverageRating?: number | null;
  supplierLocation?: string | null;
};

function ProductCard({ product }: { product: ProductItem }) {
  return (
    <Link
      href={`/products/${product.id}`}
      data-testid={`link-product-${product.id}`}
    >
      <Card className="h-full overflow-hidden ts-card-interactive group cursor-pointer">
        <div className="aspect-[4/3] bg-muted relative overflow-hidden">
          {product.photoUrl ? (
            <img
              src={product.photoUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/25">
              <Package className="h-12 w-12" />
            </div>
          )}
          <Badge
            className="absolute top-3 right-3 bg-background/90 text-foreground backdrop-blur-sm border-0 shadow-ts-xs"
            variant="secondary"
          >
            {product.category}
          </Badge>
          {product.stockQty === 0 && (
            <div className="absolute inset-x-0 bottom-0 bg-background/90 text-center text-xs font-medium py-1.5 border-t">
              Out of stock
            </div>
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors duration-150">
            {product.name}
          </h3>
          <SupplierTrustBadge
            compact
            supplierBusinessName={product.supplierBusinessName ?? "Supplier"}
            supplierIsNew={product.supplierIsNew ?? false}
            supplierCompletedOrders={product.supplierCompletedOrders ?? 0}
            supplierAverageRating={product.supplierAverageRating}
          />
          <p className="text-xl font-bold text-foreground">
            {formatGhs(product.unitPrice)}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              / {product.unit}
            </span>
          </p>
          <div className="flex justify-between items-center text-sm text-muted-foreground">
            <span>
              MOQ: {product.moq} {product.unit}
            </span>
            <span className="truncate max-w-[100px] text-right">
              {product.supplierLocation?.split(",")[0]?.trim() || "—"}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── Marketing Nav ────────────────────────────────────────────────────────────
//
// Primary CTA adapts to LAUNCH_CONFIG.PRIMARY_AUDIENCE.
// Currently: "Apply to Sell on TradeShield" (supplier-first launch phase).
// To flip: change PRIMARY_AUDIENCE to "buyer" in LAUNCH_CONFIG above.

function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isSupplierFirst = LAUNCH_CONFIG.PRIMARY_AUDIENCE === "supplier";

  const primaryCTAHref = isSupplierFirst ? "/register?role=supplier" : "/register";
  const primaryCTACopy = isSupplierFirst ? "Apply to Sell" : "Start Buying Free";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-200",
        scrolled
          ? "bg-white/95 backdrop-blur-md border-b border-[#0A3D62]/10 shadow-[0_1px_0_rgba(10,61,98,0.06)]"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <div className="ts-container-wide h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 group transition-transform duration-150 group-hover:scale-[1.04]"
          aria-label="TradeShield home"
        >
          <Logo variant="mark" size="md" className="sm:hidden" />
          <Logo
            variant="lockup"
            size="md"
            className="hidden sm:flex"
            textClassName="text-[#0A3D62]"
          />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
          <a
            href="#suppliers"
            className="text-sm font-medium text-[#0A3D62]/70 hover:text-[#0A3D62] transition-colors duration-150"
          >
            For Suppliers
          </a>
          <a
            href="#buyers"
            className="text-sm font-medium text-[#0A3D62]/70 hover:text-[#0A3D62] transition-colors duration-150"
          >
            For Buyers
          </a>
          <a
            href="#how-it-works"
            className="text-sm font-medium text-[#0A3D62]/70 hover:text-[#0A3D62] transition-colors duration-150"
          >
            How It Works
          </a>
        </nav>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-2.5">
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="text-[#0A3D62]/80 hover:text-[#0A3D62] hover:bg-[#0A3D62]/6 font-medium"
            >
              Log In
            </Button>
          </Link>
          <Link href={primaryCTAHref}>
            <Button
              size="sm"
              className="bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] font-semibold shadow-[0_2px_8px_rgba(245,166,35,0.35)] hover:shadow-[0_3px_12px_rgba(245,166,35,0.45)] transition-all duration-150 active:scale-[0.97]"
            >
              {primaryCTACopy}
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-[#0A3D62]"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="flex flex-col pt-10 gap-0">
            <div className="flex items-center gap-2.5 mb-8">
              <div className="flex h-8 w-8 items-center justify-center rounded-[7px] bg-[#0A3D62] text-white">
                <ShieldMark style={{ height: "18px", width: "18px" }} />
              </div>
              <span className="font-serif text-[17px] font-semibold text-[#0A3D62]">
                TradeShield
              </span>
            </div>
            <nav className="flex flex-col gap-1 mb-6" aria-label="Mobile navigation">
              {[
                { href: "#suppliers", label: "For Suppliers" },
                { href: "#buyers", label: "For Buyers" },
                { href: "#how-it-works", label: "How It Works" },
              ].map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-[#0A3D62]/80 hover:bg-[#0A3D62]/6 hover:text-[#0A3D62] transition-colors"
                >
                  {label}
                </a>
              ))}
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-[#0A3D62]/80 hover:bg-[#0A3D62]/6 hover:text-[#0A3D62] transition-colors"
              >
                Log In
              </Link>
            </nav>
            <div className="flex flex-col gap-2.5 pt-4 border-t border-[#0A3D62]/10">
              <Link href={primaryCTAHref} onClick={() => setOpen(false)}>
                <Button className="w-full bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] font-semibold">
                  {primaryCTACopy}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button variant="outline" className="w-full border-[#0A3D62]/20 text-[#0A3D62]">
                  Browse as a Buyer
                </Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

// ─── Escrow flow diagram (Hero graphic) ──────────────────────────────────────
//
// A custom HOLD → VERIFY → RELEASE SVG/HTML diagram.
// Animated traveling pulse along the connector track.
// No stock illustration, no undraw/Storyset art, no gradient blob background.

function EscrowFlowDiagram() {
  const stages = [
    {
      id: "hold",
      label: "HOLD",
      desc: "Buyer pays into escrow",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="1.75" />
          <path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="1.5" fill="currentColor" />
        </svg>
      ),
      color: "text-[#F5A623]",
      bg: "bg-[#F5A623]/12",
      border: "border-[#F5A623]/30",
      pulse: "bg-[#F5A623]",
    },
    {
      id: "verify",
      label: "VERIFY",
      desc: "Buyer confirms receipt",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          <path d="M8.5 12.5l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      color: "text-white",
      bg: "bg-white/15",
      border: "border-white/25",
      pulse: "bg-white",
    },
    {
      id: "release",
      label: "RELEASE",
      desc: "Supplier receives payment",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      ),
      color: "text-[#00B4A6]",
      bg: "bg-[#00B4A6]/12",
      border: "border-[#00B4A6]/30",
      pulse: "bg-[#00B4A6]",
    },
  ];

  return (
    <div className="select-none" aria-label="Escrow flow: Hold, Verify, Release">
      {/* Container */}
      <div className="relative">
        {/* Desktop: horizontal layout */}
        <div className="hidden sm:flex items-start gap-0">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-start">
              {/* Stage node */}
              <div className="flex flex-col items-center gap-3 px-4 pt-1">
                {/* Icon bubble */}
                <div
                  className={cn(
                    "flex items-center justify-center w-14 h-14 rounded-2xl border",
                    stage.bg,
                    stage.border,
                    stage.color,
                  )}
                >
                  {stage.icon}
                </div>
                {/* Label */}
                <div className="text-center">
                  <p className={cn("text-xs font-bold tracking-widest uppercase", stage.color)}>
                    {stage.label}
                  </p>
                  <p className="text-[11px] text-white/55 mt-0.5 leading-tight max-w-[80px]">
                    {stage.desc}
                  </p>
                </div>
              </div>

              {/* Connector */}
              {idx < stages.length - 1 && (
                <div className="flex flex-col items-center justify-start pt-7 px-1">
                  <div className="relative w-10 h-px">
                    {/* Static track */}
                    <div className="absolute inset-0 bg-white/15 rounded-full" />
                    {/* Traveling pulse */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full opacity-80"
                      style={{
                        width: "28%",
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
                        animation: `escrow-pulse-${idx} 2.4s ease-in-out infinite`,
                        animationDelay: `${idx * 0.8}s`,
                      }}
                    />
                  </div>
                  <ArrowRight className="h-3 w-3 text-white/30 mt-1.5" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical layout */}
        <div className="flex sm:hidden flex-col items-start gap-0 pl-2">
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-start gap-4">
              {/* Left column: icon + connector line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl border shrink-0",
                    stage.bg,
                    stage.border,
                    stage.color,
                  )}
                >
                  {stage.icon}
                </div>
                {idx < stages.length - 1 && (
                  <div className="w-px h-7 bg-white/12 mt-1" />
                )}
              </div>
              {/* Right column: text */}
              <div className="pt-2.5 pb-4">
                <p className={cn("text-xs font-bold tracking-widest uppercase", stage.color)}>
                  {stage.label}
                </p>
                <p className="text-xs text-white/55 mt-0.5 leading-snug">
                  {stage.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Guarantee callout */}
      <div className="mt-6 rounded-xl border border-white/12 bg-white/6 px-4 py-3 backdrop-blur-sm">
        <p className="text-xs text-white/70 leading-relaxed">
          <span className="text-white font-semibold">Neither party controls the funds.</span>{" "}
          The buyer can't take them back after paying. The supplier can't access them until delivery is confirmed.
          That's the escrow guarantee.
        </p>
      </div>

      <style>{`
        @keyframes escrow-pulse-0 {
          0%, 100% { left: -28%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
        @keyframes escrow-pulse-1 {
          0%, 100% { left: -28%; opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────
//
// Supplier-first layout during launch phase (see LAUNCH_CONFIG).
// Left column: headline + CTAs. Right column: HOLD → VERIFY → RELEASE diagram.
// Background: solid deep navy with fine dot-grid overlay — NO gradient blobs.

function HeroSection() {
  const isSupplierFirst = LAUNCH_CONFIG.PRIMARY_AUDIENCE === "supplier";

  return (
    <section
      id="hero"
      className="relative overflow-hidden"
      style={{ background: "#0A3D62" }}
    >
      {/* Subtle dot-grid texture — NOT a gradient blob */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      {/* Thin gold top accent line */}
      <div
        className="pointer-events-none absolute top-0 inset-x-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, #F5A623 40%, #F5A623 60%, transparent 100%)" }}
        aria-hidden
      />

      <div className="ts-container-wide relative pt-14 pb-16 md:pt-18 md:pb-20 lg:pt-20 lg:pb-24">
        <div className="grid lg:grid-cols-[1fr_420px] gap-12 lg:gap-16 items-center">

          {/* ─── Left: Text content ───────────────────────────────────── */}
          <div>
            {/* Badge row — real credentials only */}
            <div className="flex flex-wrap gap-2 mb-7">
              {/* Moolre partnership */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#F5A623]/40 bg-[#F5A623]/10 px-3 py-1 text-[11px] font-semibold text-[#F5A623] tracking-wide">
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden>
                  <circle cx="8" cy="8" r="7" stroke="#F5A623" strokeWidth="1.5" />
                  <path d="M5 11V5l3 3.5L11 5v6" stroke="#F5A623" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Powered by Moolre
              </div>
              {/* Funds in escrow */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/70 tracking-wide">
                <ShieldCheck className="h-3 w-3 shrink-0 text-[#00B4A6]" />
                Funds held in secure escrow
              </div>
              {/* Competition */}
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[11px] font-semibold text-white/70 tracking-wide">
                <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3 shrink-0" aria-hidden>
                  <path d="M8 1l1.8 3.7 4.2.6-3 3 .7 4.2L8 11l-3.7 1.5.7-4.2-3-3 4.2-.6L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="rgba(255,255,255,0.2)" />
                </svg>
                Moolre Startup Cup 2026
              </div>
            </div>

            {/* Headline — supplier-first framing during launch */}
            {isSupplierFirst ? (
              <h1
                className="font-serif text-[2.4rem] sm:text-[2.9rem] lg:text-[3.25rem] font-semibold leading-[1.08] tracking-tight text-white text-balance mb-5"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.15)" }}
              >
                Get paid for every order.{" "}
                <span style={{ color: "#F5A623" }}>Even with buyers you&apos;ve never met.</span>
              </h1>
            ) : (
              <h1
                className="font-serif text-[2.4rem] sm:text-[2.9rem] lg:text-[3.25rem] font-semibold leading-[1.08] tracking-tight text-white text-balance mb-5"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.15)" }}
              >
                Stop losing money to{" "}
                <span style={{ color: "#F5A623" }}>suppliers who don&apos;t deliver.</span>
              </h1>
            )}

            {/* Subheadline */}
            {isSupplierFirst ? (
              <p className="text-[1.05rem] sm:text-lg text-white/72 leading-relaxed max-w-xl mb-8">
                TradeShield holds buyer payment in escrow from the moment your order is
                accepted. Ship knowing the money is secured — not sent on trust. Buyers
                can't withhold payment without a documented dispute and an evidenced ruling.
              </p>
            ) : (
              <p className="text-[1.05rem] sm:text-lg text-white/72 leading-relaxed max-w-xl mb-8">
                TradeShield holds your payment in escrow until you confirm delivery.
                Ghana&apos;s B2B wholesale marketplace where your money is protected —
                every single order, with every supplier.
              </p>
            )}

            {/* CTA row */}
            {isSupplierFirst ? (
              <div className="flex flex-col sm:flex-row gap-3 mb-9">
                <Link href="/register?role=supplier">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-semibold px-7 text-[15px] bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] shadow-[0_4px_16px_rgba(245,166,35,0.4)] hover:shadow-[0_6px_20px_rgba(245,166,35,0.5)] transition-all duration-150 active:scale-[0.97]"
                  >
                    Apply to Sell on TradeShield
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto text-white/75 hover:text-white hover:bg-white/10 text-[15px] border border-white/15 font-medium"
                  >
                    I&apos;m a buyer →
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 mb-9">
                <Link href="/register">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-semibold px-7 text-[15px] bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] shadow-[0_4px_16px_rgba(245,166,35,0.4)] hover:shadow-[0_6px_20px_rgba(245,166,35,0.5)] transition-all duration-150 active:scale-[0.97]"
                  >
                    Start buying securely — free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register?role=supplier">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto text-white/75 hover:text-white hover:bg-white/10 text-[15px] border border-white/15 font-medium"
                  >
                    Apply to sell →
                  </Button>
                </Link>
              </div>
            )}

            {/* Micro-trust row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                <Check className="h-3.5 w-3.5 text-[#00B4A6] shrink-0" />
                No upfront cost to list
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                <Check className="h-3.5 w-3.5 text-[#00B4A6] shrink-0" />
                Commission only on completed sales
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-white/50">
                <Check className="h-3.5 w-3.5 text-[#00B4A6] shrink-0" />
                Disputes resolved in max 5 days
              </div>
            </div>
          </div>

          {/* ─── Right: HOLD → VERIFY → RELEASE diagram ──────────────── */}
          <div className="lg:pl-4">
            {/* Panel */}
            <div
              className="rounded-2xl border border-white/12 p-6 sm:p-7"
              style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}
            >
              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-white/40 mb-5">
                How your payment travels
              </p>
              <EscrowFlowDiagram />
            </div>

            {/* Below-diagram note */}
            <p className="mt-4 text-[11px] text-white/35 text-center leading-relaxed px-2">
              Funds processed via Moolre's licensed payment infrastructure.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Trust bar — real credentials ONLY ───────────────────────────────────────
//
// No fabricated logos, no invented partnerships. Only Moolre and the
// Startup Cup affiliation exist at this stage.

function TrustBar() {
  return (
    <section
      className="border-b"
      style={{ background: "#081e2e", borderColor: "rgba(255,255,255,0.07)" }}
      aria-label="Platform credentials"
    >
      <div className="ts-container-wide py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
          {/* Moolre */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F5A623]/15 border border-[#F5A623]/25 shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                <circle cx="8" cy="8" r="6.5" stroke="#F5A623" strokeWidth="1.25" />
                <path d="M5 11V5l3 3.5L11 5v6" stroke="#F5A623" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 leading-none mb-0.5">
                Payment partner
              </p>
              <p className="text-[13px] font-semibold text-white/75">Moolre</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />

          {/* Escrow guarantee */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#00B4A6]/15 border border-[#00B4A6]/25 shrink-0">
              <ShieldCheck className="h-4 w-4 text-[#00B4A6]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 leading-none mb-0.5">
                Every transaction
              </p>
              <p className="text-[13px] font-semibold text-white/75">Escrow-protected</p>
            </div>
          </div>

          <div className="hidden sm:block w-px h-8 bg-white/10" />

          {/* Startup Cup */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/8 border border-white/12 shrink-0">
              <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden>
                <path
                  d="M8 1.5l1.6 3.4 3.9.55-2.75 2.75.65 3.9L8 10.4l-3.4 1.75.65-3.9L2.5 5.45l3.9-.55L8 1.5z"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  fill="rgba(255,255,255,0.1)"
                />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 leading-none mb-0.5">
                Competition
              </p>
              <p className="text-[13px] font-semibold text-white/75">Moolre Startup Cup 2026</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: The problem ─────────────────────────────────────────────────────
//
// Told as a concrete scenario, not abstract statistics.

function PainSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="ts-container-wide">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-600 mb-3">
            The problem
          </p>
          <Heading level="h2">
            Someone always has to go first
          </Heading>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            You find a supplier in Accra. You WhatsApp. Prices look right. You transfer
            GH₵4,500. They go quiet. Goods never arrive. You have no contract, no proof,
            no escrow — just a screenshot of a number and a prayer. <br />
            <span className="text-foreground font-medium mt-2 block">
              This is how Ghanaian wholesale trade works today. TradeShield is the fix.
            </span>
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 md:gap-6 mb-12">
          {PAIN_POINTS.map((pain) => {
            const Icon = pain.icon;
            return (
              <div
                key={pain.title}
                className="flex flex-col p-7 rounded-2xl border border-red-100 bg-card"
                style={{ boxShadow: "0 1px 3px rgba(200,50,50,0.06)" }}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-11 h-11 rounded-xl mb-5 shrink-0",
                    pain.bg,
                  )}
                >
                  <Icon className={cn("h-5 w-5", pain.color)} />
                </div>
                <h3 className="font-semibold text-[15px] mb-2">{pain.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {pain.desc}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full bg-trust-muted px-4 py-2 text-sm font-medium text-trust mb-4">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            TradeShield was built to eliminate every one of these risks.
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: How it works (5-step escrow loop) ───────────────────────────────

function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-muted/40">
      <div className="ts-container-wide">
        <div className="text-center mb-12 md:mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-2">
            How it works
          </p>
          <Heading level="h2">The 5-step escrow loop</Heading>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Every TradeShield transaction follows the same sequence. Both sides
            know exactly what happens at each step — no surprises.
          </p>
        </div>

        {/* Steps: on mobile, vertical stack. On md+, a 3-2 grid with a connector line */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {HOW_IT_WORKS_STEPS.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative flex flex-col p-6 rounded-xl border bg-card overflow-hidden"
                style={{ boxShadow: "var(--shadow-xs)" }}
              >
                {/* Ghost step number */}
                <span className="absolute top-2 right-3 font-serif text-6xl font-bold text-primary/5 select-none leading-none pointer-events-none">
                  {step.number}
                </span>
                <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-trust-muted mb-4 shrink-0">
                  <Icon className="h-5 w-5 text-trust" />
                </div>
                <span className="inline-flex items-center rounded-full bg-trust-muted px-2 py-0.5 text-[10px] font-bold text-trust w-fit mb-2.5 uppercase tracking-wider">
                  Step {idx + 1}
                </span>
                <h3 className="font-semibold text-[15px] mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3 flex-1">
                  {step.desc}
                </p>
                <div className="flex items-center gap-1.5 rounded-lg bg-trust-muted/60 px-2.5 py-1.5 text-[11px] font-medium text-trust">
                  <Check className="h-3 w-3 shrink-0" />
                  {step.callout}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-9 text-center">
          <Link href="/register?role=supplier">
            <Button size="lg" variant="default" className="px-8">
              Apply to sell on TradeShield
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Dual value-prop split ──────────────────────────────────────────
//
// Supplier panel is visually dominant (launch-phase priority).
// Buyer panel is secondary but present.
// Fee tiers pulled from business model: 7% new / 6% growth / 5.5% trusted.

function ValuePropSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="ts-container-wide">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-2">
            Built for both sides
          </p>
          <Heading level="h2">The platform protects everyone</Heading>
        </div>

        {/* Supplier panel: dominant, dark navy */}
        <div
          id="suppliers"
          className="rounded-2xl overflow-hidden mb-5"
          style={{ background: "#0A3D62" }}
        >
          <div className="grid lg:grid-cols-[1fr_360px] gap-0">
            {/* Content */}
            <div className="p-8 md:p-10 lg:p-12">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#F5A623]/30 bg-[#F5A623]/10 px-3 py-1 text-[11px] font-bold text-[#F5A623] uppercase tracking-wider mb-5">
                For Suppliers
              </div>
              <h3 className="font-serif text-2xl md:text-3xl font-semibold text-white leading-tight mb-4">
                Get paid, guaranteed.{" "}
                <span style={{ color: "#F5A623" }}>Every time.</span>
              </h3>
              <p className="text-white/68 text-[15px] leading-relaxed mb-7 max-w-lg">
                Your biggest risk in wholesale is shipping goods and not getting paid.
                TradeShield eliminates that risk entirely. When a buyer places an order,
                funds are secured in escrow before you pick a single item. You ship with
                the certainty of payment — not on trust.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Reach buyers across all 16 regions of Ghana",
                  "Payment guaranteed before you ship",
                  "Built-in dashboard: earnings, ratings, order history",
                  "Disputes are evidence-based — you have a right of reply",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-white/75">
                    <Check className="h-4 w-4 text-[#00B4A6] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register?role=supplier">
                <Button
                  size="lg"
                  className="bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] font-semibold px-7 shadow-[0_4px_16px_rgba(245,166,35,0.4)] transition-all duration-150 active:scale-[0.97]"
                >
                  Apply to Sell on TradeShield
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Fee tiers panel */}
            <div
              className="lg:border-l p-8 md:p-10 lg:p-10 flex flex-col justify-center"
              style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.18)" }}
            >
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-5">
                Transparent fee tiers
              </p>
              <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
                Commission on completed sales only. No upfront cost, no listing fee, no monthly subscription.
              </p>
              <div className="space-y-3">
                {SUPPLIER_FEE_TIERS.map((tier) => (
                  <div
                    key={tier.tier}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl px-4 py-3 border",
                      tier.highlight
                        ? "bg-[#F5A623]/12 border-[#F5A623]/25"
                        : "bg-white/5 border-white/8",
                    )}
                  >
                    <div>
                      <p className={cn(
                        "text-[13px] font-semibold",
                        tier.highlight ? "text-[#F5A623]" : "text-white/80",
                      )}>
                        {tier.tier}
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5 leading-tight">
                        {tier.condition}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-bold font-serif tabular-nums",
                        tier.highlight ? "text-[#F5A623]" : "text-white/70",
                      )}
                    >
                      {tier.rate}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-4 leading-relaxed">
                Your rate drops automatically as you complete orders and earn buyer reviews.
              </p>
            </div>
          </div>
        </div>

        {/* Buyer panel: secondary, lighter treatment */}
        <div
          id="buyers"
          className="rounded-2xl border border-[#00B4A6]/20 overflow-hidden"
          style={{ background: "hsl(174 45% 97%)" }}
        >
          <div className="grid lg:grid-cols-2 gap-0 items-center">
            <div className="p-8 md:p-10">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00B4A6]/30 bg-[#00B4A6]/10 px-3 py-1 text-[11px] font-bold text-[#00B4A6] uppercase tracking-wider mb-5">
                For Buyers
              </div>
              <h3 className="font-serif text-2xl md:text-[1.75rem] font-semibold text-[#0A3D62] leading-tight mb-4">
                Trade with new suppliers without the risk.
              </h3>
              <p className="text-[#0A3D62]/65 text-[15px] leading-relaxed mb-6">
                You don't have to know a supplier personally to trade safely. TradeShield's
                escrow means your money only moves when you confirm you got what you paid for.
                No advance payment on faith, no chasing refunds after a bad experience.
              </p>
              <ul className="space-y-2.5 mb-7">
                {[
                  "0% buyer fee — TradeShield charges suppliers, not buyers",
                  "Funds never reach the supplier until you confirm delivery",
                  "Disputes resolved in maximum 5 days with evidence-based rulings",
                  "Browse verified suppliers from all 16 regions of Ghana",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#0A3D62]/72">
                    <Check className="h-4 w-4 text-[#00B4A6] shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <Button
                  size="default"
                  variant="outline"
                  className="border-[#0A3D62]/25 text-[#0A3D62] hover:bg-[#0A3D62]/5 font-semibold px-6"
                >
                  Browse as a Buyer
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div
              className="hidden lg:flex items-center justify-center p-10 h-full"
              style={{ background: "rgba(0,180,166,0.06)" }}
            >
              {/* Escrow guarantee callout — no stock image */}
              <div className="max-w-[260px] text-center">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-[#00B4A6]/15 border border-[#00B4A6]/20 mx-auto mb-5">
                  <ShieldCheck className="h-8 w-8 text-[#00B4A6]" />
                </div>
                <p className="font-serif text-2xl font-semibold text-[#0A3D62] leading-tight mb-2">
                  0% buyer fee
                </p>
                <p className="text-sm text-[#0A3D62]/55 leading-relaxed">
                  We charge suppliers a commission on completed sales. Buyers always
                  pay the price shown — nothing extra.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Trust & security deep-dive ─────────────────────────────────────
//
// Dispute policy pulled from disputeResolutionPolicy.md:
// - 5-day maximum from filing to resolution
// - 3 dispute categories with different evidentiary bars
// - Supplier right of reply (48 hours)
// - 3 possible outcomes (full release, full refund, partial split)

function TrustSecuritySection() {
  const disputeProcess = [
    { stage: "Filing", actor: "Buyer", window: "At delivery step", action: "Submit photo evidence + written claim against listing" },
    { stage: "Notification", actor: "Platform", window: "Immediate", action: "Escrow release paused, supplier notified" },
    { stage: "Right of Reply", actor: "Supplier", window: "48 hours", action: "Submit counter-evidence and written response" },
    { stage: "Admin Review", actor: "TradeShield", window: "48–72 hours", action: "Review both submissions against listing and order record" },
    { stage: "Resolution", actor: "Platform", window: "Immediate", action: "Funds released, refunded, or split per ruling" },
  ];

  return (
    <section className="py-16 md:py-24 bg-muted/40">
      <div className="ts-container-wide">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-2">
            Trust &amp; security
          </p>
          <Heading level="h2">Escrow mechanics, plainly explained</Heading>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">
            A dispute isn&apos;t a buyer&apos;s opinion — it&apos;s a structured claim that
            requires evidence, gives the supplier a right of reply, and resolves in at most five days.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1.4fr,1fr] gap-8 items-start">
          {/* Dispute timeline */}
          <div className="bg-card border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-xs)" }}>
            <div className="px-6 py-5 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[15px]">Dispute resolution timeline</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-trust-muted px-2.5 py-1 text-xs font-bold text-trust">
                  <Clock className="h-3 w-3" />
                  Max 5 days
                </span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {disputeProcess.map((row, idx) => (
                <div key={row.stage} className="px-6 py-4 flex items-start gap-4">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold">{row.stage}</span>
                      <span className="text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5">
                        {row.actor}
                      </span>
                      <span className="text-[10px] text-trust font-medium">{row.window}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-snug">{row.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column: outcomes + filing requirements */}
          <div className="space-y-5">
            {/* Outcomes */}
            <div className="bg-card border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-xs)" }}>
              <h3 className="font-semibold text-[15px] mb-4">Three possible outcomes</h3>
              <div className="space-y-3">
                {[
                  {
                    label: "Dispute unfounded",
                    desc: "Buyer's evidence doesn't demonstrate a material discrepancy. Funds release to supplier in full.",
                    color: "text-trust",
                    bg: "bg-trust-muted",
                  },
                  {
                    label: "Dispute upheld",
                    desc: "Evidence clearly shows non-delivery, wrong item, or genuine listing discrepancy. Full refund to buyer.",
                    color: "text-red-600",
                    bg: "bg-red-50",
                  },
                  {
                    label: "Partial resolution",
                    desc: "Funds split proportionally. Example: 10 of 50 bags spoiled → 80% to supplier, 20% refunded.",
                    color: "text-amber-600",
                    bg: "bg-amber-50",
                  },
                ].map((outcome) => (
                  <div key={outcome.label} className={cn("rounded-xl px-4 py-3", outcome.bg)}>
                    <p className={cn("text-[13px] font-semibold mb-0.5", outcome.color)}>
                      {outcome.label}
                    </p>
                    <p className="text-xs text-foreground/60 leading-snug">{outcome.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* What a dispute requires */}
            <div className="bg-card border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-xs)" }}>
              <h3 className="font-semibold text-[15px] mb-3">What a dispute requires</h3>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                A dispute can&apos;t be filed on a bare claim. It must include:
              </p>
              <ul className="space-y-2">
                {[
                  "Photo evidence of goods as received",
                  "Written description of the specific discrepancy vs. the listing",
                  "For quality disputes: identify which listed attribute is being disputed",
                ].map((req) => (
                  <li key={req} className="flex items-start gap-2 text-xs text-foreground/75">
                    <Check className="h-3.5 w-3.5 text-trust mt-0.5 shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
                Filing without meeting these requirements is rejected at submission — before it ever reaches the supplier or freezes any funds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Section: Category Grid ───────────────────────────────────────────────────

function CategoryGrid({
  onCategorySelect,
}: {
  onCategorySelect: (cat: string) => void;
}) {
  const displayCategories = PRODUCT_CATEGORIES.filter((c) => c !== "Other");

  return (
    <section className="py-16 md:py-20 bg-background">
      <div className="ts-container-wide">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-2">
              Shop by category
            </p>
            <Heading level="h2">What are you looking for?</Heading>
          </div>
          <a
            href="#catalog"
            className="hidden md:flex items-center gap-1.5 text-sm text-primary font-medium hover:underline underline-offset-4 transition-colors"
          >
            Browse all <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
          {displayCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG["Other"];
            const Icon = config.icon;
            const count = CATEGORY_COUNTS[cat];
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategorySelect(cat)}
                className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/25 hover:shadow-ts-sm transition-all duration-200 cursor-pointer"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-xl transition-transform duration-200 group-hover:scale-105 shrink-0",
                    config.bg,
                  )}
                >
                  <Icon className={cn("h-6 w-6", config.color)} />
                </div>
                <div className="text-center">
                  <span className="text-xs font-medium leading-tight block">{cat}</span>
                  {count && (
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {count.toLocaleString()} products
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Section: Featured Products ───────────────────────────────────────────────

function FeaturedProductsSection({
  products,
  isLoading,
  selectedCategory,
}: {
  products: ProductItem[] | undefined;
  isLoading: boolean;
  selectedCategory: string | undefined;
}) {
  const featured = useMemo(
    () => (products ?? []).slice(0, 8),
    [products],
  );

  return (
    <section id="catalog" className="py-16 md:py-24 bg-muted/30">
      <div className="ts-container-wide">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-trust">
                {selectedCategory ? selectedCategory : "Featured listings"}
              </p>
              <span className="flex items-center gap-1 text-[10px] font-medium text-trust bg-trust-muted rounded-full px-2 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-trust opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-trust" />
                </span>
                Live
              </span>
            </div>
            <Heading level="h2">Wholesale products</Heading>
          </div>
          <Link
            href="/register"
            className="hidden md:flex items-center gap-1.5 text-sm text-primary font-medium hover:underline underline-offset-4 transition-colors"
          >
            Sign up to browse all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse overflow-hidden">
                <div className="h-48 bg-muted" />
                <CardContent className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-20 bg-card border border-dashed rounded-xl">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No products found in this category yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/register">
            <Button size="lg" variant="outline" className="px-8">
              Sign up to see all products
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ─── Section: FAQ ─────────────────────────────────────────────────────────────
//
// Questions adapted to the real product mechanics — no vague reassurances.

function FAQSection() {
  return (
    <section className="py-16 md:py-24 bg-background">
      <div className="ts-container-wide">
        <div className="grid md:grid-cols-[1fr,2fr] gap-10 md:gap-16 items-start">
          <div className="md:sticky md:top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-2">
              FAQ
            </p>
            <Heading level="h2">Plain answers to the hard questions</Heading>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              No vague reassurances. Here&apos;s exactly how the mechanics work
              for the things that actually matter.
            </p>
            <div className="mt-6">
              <Link href="/register?role=supplier">
                <Button size="default" variant="default" className="px-6">
                  Apply to sell
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((item, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger className="text-left text-sm font-semibold text-foreground py-5 hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA band ───────────────────────────────────────────────────────────

function FinalCTASection() {
  const isSupplierFirst = LAUNCH_CONFIG.PRIMARY_AUDIENCE === "supplier";

  return (
    <section
      className="relative overflow-hidden py-16 md:py-20 text-white"
      style={{ background: "#0A3D62" }}
    >
      {/* Same dot-grid texture as hero — creates visual bookend */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-[2px]"
        style={{ background: "linear-gradient(90deg, transparent 0%, #F5A623 40%, #F5A623 60%, transparent 100%)" }}
        aria-hidden
      />

      <div className="ts-container-wide relative text-center">
        <div className="max-w-2xl mx-auto">
          <Heading level="h2" className="text-white mb-4">
            {isSupplierFirst
              ? "Ready to grow your wholesale business?"
              : "Ready to trade with confidence?"}
          </Heading>
          <p className="text-white/65 text-lg leading-relaxed mb-3">
            {isSupplierFirst
              ? "Apply to sell on TradeShield. Get access to buyers across Ghana, with payment guaranteed before you ship."
              : "Browse verified suppliers across Ghana with every order escrow-protected."}
          </p>
          <p className="text-white/40 text-sm mb-8">
            {isSupplierFirst
              ? "No upfront cost · Commission only on completed sales · Disputes resolved in max 5 days"
              : "Free to start · 0% buyer fee · Every order escrow-protected"}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isSupplierFirst ? (
              <>
                <Link href="/register?role=supplier">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-semibold px-8 bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] shadow-[0_4px_16px_rgba(245,166,35,0.4)] transition-all duration-150 active:scale-[0.97]"
                  >
                    Apply to Sell on TradeShield
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto text-white/70 hover:text-white hover:bg-white/10 border border-white/15"
                  >
                    Browse as a Buyer
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto font-semibold px-8 bg-[#F5A623] hover:bg-[#e49718] text-[#0A3D62] shadow-[0_4px_16px_rgba(245,166,35,0.4)] transition-all duration-150 active:scale-[0.97]"
                  >
                    Start Buying Free
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register?role=supplier">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full sm:w-auto text-white/70 hover:text-white hover:bg-white/10 border border-white/15"
                  >
                    Apply to Sell
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Marketing Footer ─────────────────────────────────────────────────────────

function MarketingFooter() {
  return (
    <footer className="border-t border-[#0A3D62]/10 pt-12 pb-8 bg-muted/30">
      <div className="ts-container-wide">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="mb-3">
              <Logo variant="lockup" size="sm" textClassName="text-[#0A3D62]" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mb-4">
              Ghana&apos;s escrow-protected B2B wholesale marketplace. Trade with confidence.
            </p>
            {/* Moolre Startup Cup badge */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5A623]/25 bg-[#F5A623]/8 px-3 py-2 text-[11px] font-semibold text-[#0A3D62]/70">
              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                <path
                  d="M8 1.5l1.6 3.4 3.9.55-2.75 2.75.65 3.9L8 10.4l-3.4 1.75.65-3.9L2.5 5.45l3.9-.55L8 1.5z"
                  stroke="#F5A623"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                  fill="rgba(245,166,35,0.15)"
                />
              </svg>
              Moolre Startup Cup 2026
            </div>
          </div>

          {/* Platform links */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-[#0A3D62]">Platform</h4>
            <ul className="space-y-2.5">
              {[
                { label: "How It Works", href: "#how-it-works" },
                { label: "For Suppliers", href: "#suppliers" },
                { label: "For Buyers", href: "#buyers" },
                { label: "Apply to Sell", href: "/register?role=supplier" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-[#0A3D62]">Account</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Sign Up Free", href: "/register" },
                { label: "Log In", href: "/login" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-sm mb-4 text-[#0A3D62]">Legal</h4>
            <ul className="space-y-2.5">
              {[
                { label: "Terms of Service", href: "#" },
                { label: "Privacy Policy", href: "#" },
                { label: "Dispute Policy", href: "#" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-3 pt-8 border-t border-border/60">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} TradeShield. All rights reserved. Escrow infrastructure by Moolre.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Logo variant="mark" size="sm" className="h-5 w-5" />
              Escrow-protected
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Landing view (guests) ────────────────────────────────────────────────────
//
// This view manages its own nav and footer (does NOT use the app Layout).
// The Layout is omitted from this route in App.tsx so the marketing nav
// can be present instead of the app nav.

function LandingView() {
  const [featuredCategory, setFeaturedCategory] = useState<string | undefined>();
  const [featuredSearch, setFeaturedSearch] = useState<string | undefined>();

  const queryParams = useMemo(
    () => ({
      category: featuredCategory,
      search: featuredSearch,
    }),
    [featuredCategory, featuredSearch],
  );

  const { data: products, isLoading } = useListProducts(queryParams, {
    query: {
      queryKey: getListProductsQueryKey(queryParams),
    },
  });

  const scrollToCatalog = () => {
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCategorySelect = (cat: string) => {
    setFeaturedCategory(cat);
    scrollToCatalog();
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <MarketingNav />
      <main className="flex-1 flex flex-col">
        <HeroSection />
        <TrustBar />
        <PainSection />
        <HowItWorksSection />
        <ValuePropSection />
        <TrustSecuritySection />
        <CategoryGrid onCategorySelect={handleCategorySelect} />
        <FeaturedProductsSection
          products={products as ProductItem[]}
          isLoading={isLoading}
          selectedCategory={featuredCategory}
        />
        <FAQSection />
        <FinalCTASection />
      </main>
      <MarketingFooter />
    </div>
  );
}

// ─── Catalog view (logged-in buyers) ─────────────────────────────────────────
//
// Logged-in buyers see a catalog — wrapped in the standard app Layout
// since this route no longer has Layout in App.tsx.

function CatalogView() {
  const { user } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("_all");
  const [location, setLocation] = useState<string>("_all");

  const queryParams = useMemo(
    () => ({
      category: category !== "_all" ? category : undefined,
      location: location !== "_all" ? location : undefined,
      search: search.trim() || undefined,
    }),
    [category, location, search],
  );

  const { data: products, isLoading } = useListProducts(queryParams, {
    query: {
      queryKey: getListProductsQueryKey(queryParams),
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <Layout>
      <div className="flex-1 w-full">
        {/* Compact catalog hero */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, #00B4A6 0%, transparent 50%), radial-gradient(circle at 80% 20%, #F5A623 0%, transparent 40%)",
            }}
            aria-hidden
          />
          <div className="ts-container-wide relative py-10 md:py-14">
            <div className="max-w-2xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium mb-4 backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-trust" />
                Escrow-protected wholesale trade
              </div>
              <Heading
                level="h1"
                className="text-primary-foreground mb-5"
              >
                Wholesale catalog
              </Heading>
              <form
                onSubmit={handleSearchSubmit}
                className="max-w-xl mx-auto bg-background rounded-xl p-1.5 flex items-center shadow-ts-lg"
              >
                <Search className="h-5 w-5 text-muted-foreground ml-3 mr-2 shrink-0" />
                <Input
                  className="border-0 shadow-none focus-visible:ring-0 text-foreground bg-transparent h-11"
                  placeholder="Search products or suppliers…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  data-testid="input-search"
                />
                <button type="submit" className="sr-only">
                  Search
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Verification status for logged-in users */}
        {user && (
          <div className="ts-container-wide pt-6">
            <VerifyNudgeBanner kycStatus={user.kycStatus} />
          </div>
        )}

        {/* Catalog grid */}
        <section className="ts-container-wide py-10 md:py-14">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-trust mb-1.5">
                Catalog
              </p>
              <Heading level="h2">Wholesale listings</Heading>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    data-testid="select-category"
                  >
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All categories</SelectItem>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger
                    className="w-full sm:w-[180px]"
                    data-testid="select-location"
                  >
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">All locations</SelectItem>
                    {LOCATION_FILTERS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="animate-pulse overflow-hidden">
                  <div className="h-48 bg-muted" />
                  <CardContent className="p-4 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products?.length === 0 ? (
            <div className="text-center py-24 bg-card border border-dashed rounded-xl">
              <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <Heading level="h4" className="mb-2">
                No products found
              </Heading>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                {search || category !== "_all" || location !== "_all"
                  ? "Try a different search term, category, or location."
                  : "Browse by category to discover verified suppliers."}
              </p>
              {(search || category !== "_all" || location !== "_all") && (
                <button
                  type="button"
                  className="mt-4 text-sm text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setSearch("");
                    setSearchInput("");
                    setCategory("_all");
                    setLocation("_all");
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {(products ?? []).map((product) => (
                <ProductCard key={product.id} product={product as ProductItem} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (user?.role === "supplier") {
      navigate("/dashboard");
    }
  }, [user?.role, navigate]);

  if (!user) {
    return <LandingView />;
  }

  return <CatalogView />;
}
