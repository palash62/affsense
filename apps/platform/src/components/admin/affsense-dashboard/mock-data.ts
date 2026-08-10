export type DeltaDirection = "up" | "down";

export type KpiAccent = "blue" | "emerald" | "sky" | "amber" | "rose" | "violet";

export interface AffsenseKpi {
  id: string;
  label: string;
  value: string;
  delta: string;
  deltaDir: DeltaDirection;
  viewLabel: string;
  viewHref: string;
  accent: KpiAccent;
}

export interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
  profit: number;
}

export interface SalesSourceSlice {
  name: string;
  value: number;
  color: string;
}

export type TxStatus = "Completed" | "Pending";
export type TxType = "Sale" | "CPA Lead" | "Task";

export interface TransactionRow {
  orderId: string;
  user: string;
  product: string;
  type: TxType;
  amount: string;
  status: TxStatus;
  date: string;
}

export interface SignupRow {
  name: string;
  email: string;
  at: string;
  initials: string;
  avatarTone: string;
}

export interface TopProduct {
  rank: number;
  name: string;
  sales: string;
  revenue: string;
  thumbTone: string;
}

export type PayoutStatus = "Pending" | "Processing" | "Completed";
export type PayoutMethod = "PayPal" | "Payoneer" | "Bank Transfer";

export interface PayoutRow {
  user: string;
  amount: string;
  method: PayoutMethod;
  date: string;
  status: PayoutStatus;
}

export interface Announcement {
  title: string;
  date: string;
  tone: "violet" | "emerald" | "blue" | "amber";
}

export const AFFSENSE_DATE_RANGE_LABEL = "May 25, 2025 - May 31, 2025";

export const affsenseKpis: AffsenseKpi[] = [
  {
    id: "total-users",
    label: "Total Users",
    value: "24,782",
    delta: "+18.6%",
    deltaDir: "up",
    viewLabel: "View users",
    viewHref: "/admin/advertisers",
    accent: "blue",
  },
  {
    id: "active-users",
    label: "Active Users",
    value: "11,652",
    delta: "+16.3%",
    deltaDir: "up",
    viewLabel: "View active",
    viewHref: "/admin/publishers",
    accent: "emerald",
  },
  {
    id: "total-revenue",
    label: "Total Revenue",
    value: "$187,492.50",
    delta: "+22.5%",
    deltaDir: "up",
    viewLabel: "View revenue",
    viewHref: "/admin/profit",
    accent: "sky",
  },
  {
    id: "total-payouts",
    label: "Total Payouts",
    value: "$125,870.75",
    delta: "+19.8%",
    deltaDir: "up",
    viewLabel: "View payouts",
    viewHref: "/admin/payouts",
    accent: "amber",
  },
  {
    id: "total-sales",
    label: "Total Sales",
    value: "6,512",
    delta: "+14.2%",
    deltaDir: "up",
    viewLabel: "View sales",
    viewHref: "/admin/reports",
    accent: "rose",
  },
  {
    id: "conversion-rate",
    label: "Conversion Rate",
    value: "12.81%",
    delta: "+8.7%",
    deltaDir: "up",
    viewLabel: "View analytics",
    viewHref: "/admin/reports",
    accent: "violet",
  },
];

export const affsenseRevenueSeries: RevenuePoint[] = [
  { date: "2025-05-25", label: "May 25", revenue: 18200, profit: 9800 },
  { date: "2025-05-26", label: "May 26", revenue: 21400, profit: 11200 },
  { date: "2025-05-27", label: "May 27", revenue: 19800, profit: 10400 },
  { date: "2025-05-28", label: "May 28", revenue: 25600, profit: 13800 },
  { date: "2025-05-29", label: "May 29", revenue: 24100, profit: 12900 },
  { date: "2025-05-30", label: "May 30", revenue: 27800, profit: 15100 },
  { date: "2025-05-31", label: "May 31", revenue: 30590, profit: 16850 },
];

export const affsenseSalesBySource: SalesSourceSlice[] = [
  { name: "Digital Products", value: 58, color: "var(--theme-chart-1)" },
  { name: "CPA Offers", value: 20, color: "var(--theme-chart-2)" },
  { name: "Upsells", value: 12, color: "var(--theme-chart-3)" },
  { name: "Quick Earn", value: 6, color: "var(--theme-chart-4)" },
  { name: "Others", value: 4, color: "#94A3B8" },
];

export const affsenseSalesTotal = "6,512";

export const affsenseTransactions: TransactionRow[] = [
  {
    orderId: "#ORD-98421",
    user: "Mia Thompson",
    product: "AI Prompt Vault",
    type: "Sale",
    amount: "$149.00",
    status: "Completed",
    date: "May 31, 10:42 AM",
  },
  {
    orderId: "#ORD-98418",
    user: "Noah Patel",
    product: "Finance CPA Pack",
    type: "CPA Lead",
    amount: "$42.50",
    status: "Completed",
    date: "May 31, 10:18 AM",
  },
  {
    orderId: "#ORD-98411",
    user: "Ava Chen",
    product: "Quick Earn Bonus",
    type: "Task",
    amount: "$12.00",
    status: "Pending",
    date: "May 31, 09:55 AM",
  },
  {
    orderId: "#ORD-98405",
    user: "Liam Brooks",
    product: "Email Swipe Kit",
    type: "Sale",
    amount: "$79.00",
    status: "Completed",
    date: "May 31, 09:21 AM",
  },
  {
    orderId: "#ORD-98398",
    user: "Sofia Ramirez",
    product: "Health CPA Offer",
    type: "CPA Lead",
    amount: "$28.75",
    status: "Pending",
    date: "May 31, 08:47 AM",
  },
  {
    orderId: "#ORD-98390",
    user: "Ethan Cole",
    product: "Funnel Templates Pro",
    type: "Sale",
    amount: "$199.00",
    status: "Completed",
    date: "May 30, 06:12 PM",
  },
];

export const affsenseSignups: SignupRow[] = [
  {
    name: "Jordan Blake",
    email: "jordan.blake@email.com",
    at: "May 31, 11:05 AM",
    initials: "JB",
    avatarTone: "bg-blue-100 text-blue-700",
  },
  {
    name: "Priya Nair",
    email: "priya.nair@email.com",
    at: "May 31, 10:41 AM",
    initials: "PN",
    avatarTone: "bg-emerald-100 text-emerald-700",
  },
  {
    name: "Marcus Lee",
    email: "marcus.lee@email.com",
    at: "May 31, 09:58 AM",
    initials: "ML",
    avatarTone: "bg-violet-100 text-violet-700",
  },
  {
    name: "Elena Rossi",
    email: "elena.rossi@email.com",
    at: "May 31, 09:14 AM",
    initials: "ER",
    avatarTone: "bg-rose-100 text-rose-700",
  },
  {
    name: "Chris Nguyen",
    email: "chris.nguyen@email.com",
    at: "May 31, 08:33 AM",
    initials: "CN",
    avatarTone: "bg-amber-100 text-amber-800",
  },
];

export const affsenseTopProducts: TopProduct[] = [
  {
    rank: 1,
    name: "AI Prompt Vault",
    sales: "1,248 sales",
    revenue: "$186,000",
    thumbTone: "from-blue-500 to-indigo-500",
  },
  {
    rank: 2,
    name: "Funnel Templates Pro",
    sales: "986 sales",
    revenue: "$196,200",
    thumbTone: "from-violet-500 to-purple-500",
  },
  {
    rank: 3,
    name: "Email Swipe Kit",
    sales: "874 sales",
    revenue: "$69,050",
    thumbTone: "from-emerald-500 to-teal-500",
  },
  {
    rank: 4,
    name: "CPA Launch Playbook",
    sales: "642 sales",
    revenue: "$57,780",
    thumbTone: "from-amber-500 to-orange-500",
  },
  {
    rank: 5,
    name: "Traffic Ads Pack",
    sales: "531 sales",
    revenue: "$42,480",
    thumbTone: "from-rose-500 to-pink-500",
  },
];

export const affsensePayouts: PayoutRow[] = [
  {
    user: "Daniel Foster",
    amount: "$2,450.00",
    method: "PayPal",
    date: "May 31, 2025",
    status: "Pending",
  },
  {
    user: "Hannah Kim",
    amount: "$1,180.50",
    method: "Payoneer",
    date: "May 30, 2025",
    status: "Processing",
  },
  {
    user: "Omar Hassan",
    amount: "$3,920.00",
    method: "Bank Transfer",
    date: "May 30, 2025",
    status: "Completed",
  },
  {
    user: "Grace Williams",
    amount: "$870.25",
    method: "PayPal",
    date: "May 29, 2025",
    status: "Pending",
  },
  {
    user: "Leo Martins",
    amount: "$1,540.00",
    method: "Payoneer",
    date: "May 29, 2025",
    status: "Completed",
  },
];

export const affsenseAnnouncements: Announcement[] = [
  {
    title: "New CPA Marketplace Features Live!",
    date: "May 31, 2025",
    tone: "violet",
  },
  {
    title: "Weekly Payouts Completed Successfully",
    date: "May 30, 2025",
    tone: "emerald",
  },
  {
    title: "Email Campaign Engine Performance Update",
    date: "May 29, 2025",
    tone: "blue",
  },
  {
    title: "Scheduled Maintenance Window Announced",
    date: "May 28, 2025",
    tone: "amber",
  },
  {
    title: "Referral Bonus Rules Updated for Q2",
    date: "May 27, 2025",
    tone: "violet",
  },
];
