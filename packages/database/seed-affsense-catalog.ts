import type { PrismaClient } from "@prisma/client";

const PRODUCT_CATEGORIES = [
  "AI Tools",
  "Marketing",
  "Finance",
  "Health",
  "Productivity",
  "Education",
] as const;

const TASK_CATEGORIES = [
  "Social Media",
  "Surveys",
  "App Installs",
  "Content Engagement",
] as const;

const PRODUCTS = [
  {
    slug: "ai-prompt-vault",
    name: "AI Prompt Vault",
    category: "AI Tools",
    niche: "Productivity",
    productType: "Digital Download",
    status: "ACTIVE" as const,
    price: 9.95,
    frontEndCommission: 80,
    featured: true,
    isNew: true,
    thumbTone: "from-violet-500 to-indigo-600",
    vendor: "Affsense Partners",
    shortDescription:
      "Unlock 500+ premium AI prompts for ChatGPT, Claude, and Midjourney. Boost productivity instantly.",
  },
  {
    slug: "email-swipe-kit",
    name: "Email Swipe Kit",
    category: "Marketing",
    niche: "Business",
    productType: "Digital Download",
    status: "ACTIVE" as const,
    price: 79,
    frontEndCommission: 75,
    featured: true,
    isNew: false,
    thumbTone: "from-blue-500 to-cyan-600",
    vendor: "Affsense Partners",
    shortDescription: "High-converting email swipes for affiliate promotions.",
  },
  {
    slug: "finance-cpa-pack",
    name: "Finance CPA Pack",
    category: "Finance",
    niche: "Personal Finance",
    productType: "Membership",
    status: "ACTIVE" as const,
    price: 49,
    frontEndCommission: 70,
    featured: false,
    isNew: false,
    thumbTone: "from-emerald-500 to-teal-600",
    vendor: "Finance Labs",
    shortDescription: "Curated finance CPA offers bundle for affiliates.",
  },
  {
    slug: "quick-earn-bonus",
    name: "Quick Earn Bonus",
    category: "Productivity",
    niche: "Technology",
    productType: "Digital Download",
    status: "ACTIVE" as const,
    price: 12,
    frontEndCommission: 85,
    featured: false,
    isNew: false,
    thumbTone: "from-amber-500 to-orange-600",
    vendor: "Affsense Partners",
    shortDescription: "Quick-start bonus pack for new affiliates.",
  },
  {
    slug: "saas-starter-kit",
    name: "SaaS Starter Kit",
    category: "Education",
    niche: "Business",
    productType: "Software License",
    status: "ACTIVE" as const,
    price: 199,
    frontEndCommission: 60,
    featured: true,
    isNew: false,
    thumbTone: "from-slate-600 to-slate-800",
    vendor: "BuildFast Inc",
    shortDescription: "Launch your SaaS affiliate funnel faster.",
  },
];

const TASKS = [
  {
    title: "Follow our Instagram Account",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Follow",
    rewardAmount: 0.5,
    status: "ACTIVE" as const,
    featured: true,
    isNew: true,
    showOnDashboard: true,
    dailyLimit: 3,
    totalLimit: 1000,
    requiredLink: "https://instagram.com/affsense",
  },
  {
    title: "Like our Facebook Page",
    category: "Social Media",
    taskType: "Social Engagement",
    requiredAction: "Like",
    rewardAmount: 0.25,
    status: "ACTIVE" as const,
    featured: false,
    isNew: false,
    showOnDashboard: true,
    dailyLimit: 1,
    requiredLink: "https://facebook.com/affsense",
  },
  {
    title: "Subscribe on YouTube",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Subscribe",
    rewardAmount: 0.75,
    status: "ACTIVE" as const,
    featured: true,
    isNew: false,
    showOnDashboard: true,
    requiredLink: "https://youtube.com/@affsense",
  },
  {
    title: "Join our Telegram Channel",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Follow",
    rewardAmount: 0.5,
    status: "ACTIVE" as const,
    featured: false,
    isNew: false,
    showOnDashboard: true,
    requiredLink: "https://t.me/affsense",
  },
  {
    title: "Follow us on X (Twitter)",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Follow",
    rewardAmount: 0.5,
    status: "ACTIVE" as const,
    featured: false,
    isNew: false,
    showOnDashboard: true,
    requiredLink: "https://x.com/affsense",
  },
  {
    title: "Read and Review Blog Post",
    category: "Content Engagement",
    taskType: "Content Review",
    requiredAction: "Visit Page",
    rewardAmount: 0.4,
    status: "ACTIVE" as const,
    featured: false,
    isNew: false,
    showOnDashboard: true,
    dailyLimit: 5,
    requiredLink: "https://affsense.io/blog",
  },
];

const ANNOUNCEMENTS = [
  {
    title: "New High Paying CPA Offers Live!",
    body: "Check the CPA Offers section for exclusive high-converting offers.",
    iconKey: "megaphone",
    status: "PUBLISHED" as const,
  },
  {
    title: "$5,000 Monthly Giveaway",
    body: "Top affiliates this month win cash prizes. Keep promoting!",
    iconKey: "gift",
    status: "PUBLISHED" as const,
  },
  {
    title: "New Training: Advanced CPA Strategies",
    body: "Watch the latest training in the Training Center.",
    iconKey: "play",
    status: "PUBLISHED" as const,
  },
];

export async function seedAffsenseCatalog(prisma: PrismaClient) {
  const productCategoryMap = new Map<string, string>();
  for (const name of PRODUCT_CATEGORIES) {
    const row = await prisma.digitalProductCategory.upsert({
      where: { name },
      create: { name, status: "ACTIVE" },
      update: {},
    });
    productCategoryMap.set(name, row.id);
  }

  for (const p of PRODUCTS) {
    const categoryId = productCategoryMap.get(p.category);
    if (!categoryId) continue;
    const existing = await prisma.digitalProduct.findFirst({
      where: { name: p.name },
    });
    const data = {
      name: p.name,
      categoryId,
      shortDescription: p.shortDescription,
      productType: p.productType,
      niche: p.niche,
      status: p.status,
      featured: p.featured,
      isNew: p.isNew,
      price: p.price,
      frontEndCommission: p.frontEndCommission,
      upsellCommission: 50,
      referralReward: 10,
      vendor: p.vendor,
      thumbTone: p.thumbTone,
      imageUrl: `https://picsum.photos/seed/${p.slug}/640/400`,
      salesPageUrl: `https://affsense.io/products/${p.slug}`,
      previewUrl: `https://affsense.io/preview/${p.slug}`,
      affiliateTrackingParam: "affsense_id",
    };
    if (existing) {
      await prisma.digitalProduct.update({ where: { id: existing.id }, data });
    } else {
      await prisma.digitalProduct.create({ data });
    }
  }

  const taskCategoryMap = new Map<string, string>();
  for (const name of TASK_CATEGORIES) {
    const row = await prisma.getPaidTaskCategory.upsert({
      where: { name },
      create: { name, status: "ACTIVE" },
      update: {},
    });
    taskCategoryMap.set(name, row.id);
  }

  for (const t of TASKS) {
    const categoryId = taskCategoryMap.get(t.category);
    if (!categoryId) continue;
    const existing = await prisma.getPaidTask.findFirst({
      where: { title: t.title },
    });
    const data = {
      title: t.title,
      categoryId,
      descriptionHtml: `<p>${t.title}</p>`,
      descriptionText: t.title,
      taskType: t.taskType,
      requiredAction: t.requiredAction,
      requiredLink: t.requiredLink,
      rewardAmount: t.rewardAmount,
      dailyLimit: t.dailyLimit,
      totalLimit: t.totalLimit,
      proofRequired: true,
      status: t.status,
      showOnDashboard: t.showOnDashboard,
      featured: t.featured,
      isNew: t.isNew,
    };
    if (existing) {
      await prisma.getPaidTask.update({ where: { id: existing.id }, data });
    } else {
      await prisma.getPaidTask.create({ data });
    }
  }

  for (const a of ANNOUNCEMENTS) {
    const existing = await prisma.publisherAnnouncement.findFirst({
      where: { title: a.title },
    });
    const data = {
      title: a.title,
      body: a.body,
      iconKey: a.iconKey,
      status: a.status,
      publishedAt: new Date(),
    };
    if (existing) {
      await prisma.publisherAnnouncement.update({ where: { id: existing.id }, data });
    } else {
      await prisma.publisherAnnouncement.create({ data });
    }
  }
}
