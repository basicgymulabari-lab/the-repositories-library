import type {
  Activity,
  Expense,
  GymState,
  Member,
  Membership,
  Payment,
  Plan,
  Product,
  Sale,
} from "./types";

export const uid = (prefix = "id") =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;

export const iso = (d: Date) => d.toISOString();

export const addDays = (base: Date, days: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
};

const pick = <T>(arr: T[], i: number) => arr[i % arr.length];

/** Deterministic-ish pseudo random so the seed feels natural but stable enough. */
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const PLANS: Plan[] = [
  {
    id: "plan_monthly",
    name: "Monthly Strength",
    price: 1500,
    durationDays: 30,
    description: "Full gym floor access, locker and one body composition check.",
    active: true,
  },
  {
    id: "plan_quarterly",
    name: "Quarterly Power",
    price: 4000,
    durationDays: 90,
    description: "Gym floor, group classes and monthly progress tracking.",
    active: true,
  },
  {
    id: "plan_halfyear",
    name: "Half Yearly Elite",
    price: 7200,
    durationDays: 180,
    description: "All classes, sauna access and quarterly diet consultation.",
    active: true,
  },
  {
    id: "plan_annual",
    name: "Annual Platinum",
    price: 12000,
    durationDays: 365,
    description: "Unlimited access, personal trainer sessions and priority booking.",
    active: true,
  },
  {
    id: "plan_pt",
    name: "Personal Training",
    price: 9000,
    durationDays: 60,
    description: "24 one-to-one coaching sessions with a certified trainer.",
    active: true,
  },
];

const PRODUCT_SEED: Array<[string, Product["category"], number, number, number, number]> = [
  ["Whey Protein 1kg", "Supplements", 2200, 3200, 4, 6],
  ["Mass Gainer 3kg", "Supplements", 2600, 3600, 12, 5],
  ["Creatine Monohydrate 300g", "Supplements", 1100, 1750, 18, 5],
  ["Pre-Workout 250g", "Supplements", 1400, 2100, 9, 5],
  ["BCAA 400g", "Supplements", 1200, 1850, 14, 5],
  ["Gym T-Shirt (Dry Fit)", "Apparel", 350, 799, 3, 8],
  ["Protein Shaker 700ml", "Accessories", 180, 450, 2, 6],
  ["Steel Water Bottle 1L", "Accessories", 420, 899, 21, 6],
  ["Training Gloves", "Accessories", 300, 750, 16, 5],
  ["Lifting Belt", "Accessories", 950, 1800, 7, 4],
  ["Lifting Straps", "Accessories", 220, 550, 24, 6],
  ["Knee Wraps", "Accessories", 380, 850, 11, 4],
  ["Resistance Band Set", "Equipment", 600, 1200, 8, 4],
  ["Electrolyte Drink", "Beverages", 60, 130, 40, 12],
];

type MemberSeed = {
  name: string;
  email: string;
  phone: string;
  gender: Member["gender"];
  dobOffsetDays: number; // birthday relative to today (within the year)
  age: number;
  planId: string;
  /** membership end date offset from today */
  endOffset: number;
  paidRatio: number;
  frozen?: boolean;
};

const today = () => {
  const d = new Date();
  d.setHours(9, 30, 0, 0);
  return d;
};

const birthdayFor = (offsetDays: number, age: number) => {
  const t = addDays(today(), offsetDays);
  const d = new Date(t);
  d.setFullYear(t.getFullYear() - age);
  return iso(d);
};

const MEMBER_SEED: MemberSeed[] = [
  {
    name: "Priya Sharma",
    email: "priya.sharma@mail.com",
    phone: "+91 98200 41122",
    gender: "female",
    dobOffsetDays: 46,
    age: 28,
    planId: "plan_quarterly",
    endOffset: 41,
    paidRatio: 0.4,
  },
  {
    name: "Rahul Das",
    email: "rahul.das@mail.com",
    phone: "+91 98311 55098",
    gender: "male",
    dobOffsetDays: 120,
    age: 32,
    planId: "plan_monthly",
    endOffset: 12,
    paidRatio: 0.5,
  },
  {
    name: "Mihir Joshi",
    email: "mihir.joshi@mail.com",
    phone: "+91 99870 22110",
    gender: "male",
    dobOffsetDays: 200,
    age: 24,
    planId: "plan_monthly",
    endOffset: 1,
    paidRatio: 1,
  },
  {
    name: "Aman Singh",
    email: "aman.singh@mail.com",
    phone: "+91 97112 88342",
    gender: "male",
    dobOffsetDays: 75,
    age: 30,
    planId: "plan_quarterly",
    endOffset: 0,
    paidRatio: 1,
  },
  {
    name: "Sagar Chhetri",
    email: "sagar.chhetri@mail.com",
    phone: "+91 96001 76542",
    gender: "male",
    dobOffsetDays: 0,
    age: 27,
    planId: "plan_annual",
    endOffset: 210,
    paidRatio: 1,
  },
  {
    name: "Riya Sharma",
    email: "riya.sharma@mail.com",
    phone: "+91 90045 31278",
    gender: "female",
    dobOffsetDays: 1,
    age: 22,
    planId: "plan_halfyear",
    endOffset: 96,
    paidRatio: 0.75,
  },
  {
    name: "Neha Kapoor",
    email: "neha.kapoor@mail.com",
    phone: "+91 98999 12034",
    gender: "female",
    dobOffsetDays: 250,
    age: 35,
    planId: "plan_pt",
    endOffset: 33,
    paidRatio: 1,
  },
  {
    name: "Vikram Rathore",
    email: "vikram.rathore@mail.com",
    phone: "+91 93214 65890",
    gender: "male",
    dobOffsetDays: 310,
    age: 41,
    planId: "plan_annual",
    endOffset: 288,
    paidRatio: 1,
  },
  {
    name: "Ananya Iyer",
    email: "ananya.iyer@mail.com",
    phone: "+91 90876 44521",
    gender: "female",
    dobOffsetDays: 15,
    age: 26,
    planId: "plan_quarterly",
    endOffset: -14,
    paidRatio: 1,
  },
  {
    name: "Karan Mehta",
    email: "karan.mehta@mail.com",
    phone: "+91 98115 77320",
    gender: "male",
    dobOffsetDays: 90,
    age: 29,
    planId: "plan_monthly",
    endOffset: -3,
    paidRatio: 0.6,
  },
  {
    name: "Sneha Patil",
    email: "sneha.patil@mail.com",
    phone: "+91 99201 33447",
    gender: "female",
    dobOffsetDays: 168,
    age: 31,
    planId: "plan_halfyear",
    endOffset: 150,
    paidRatio: 1,
    frozen: true,
  },
  {
    name: "Arjun Nair",
    email: "arjun.nair@mail.com",
    phone: "+91 97404 91230",
    gender: "male",
    dobOffsetDays: 205,
    age: 23,
    planId: "plan_quarterly",
    endOffset: 62,
    paidRatio: 1,
  },
  {
    name: "Divya Menon",
    email: "divya.menon@mail.com",
    phone: "+91 96320 87451",
    gender: "female",
    dobOffsetDays: 340,
    age: 33,
    planId: "plan_monthly",
    endOffset: 6,
    paidRatio: 1,
  },
  {
    name: "Rohit Verma",
    email: "rohit.verma@mail.com",
    phone: "+91 98700 65412",
    gender: "male",
    dobOffsetDays: 60,
    age: 38,
    planId: "plan_annual",
    endOffset: 130,
    paidRatio: 0.85,
  },
  {
    name: "Tanvi Desai",
    email: "tanvi.desai@mail.com",
    phone: "+91 90909 11223",
    gender: "female",
    dobOffsetDays: 280,
    age: 25,
    planId: "plan_pt",
    endOffset: -21,
    paidRatio: 1,
  },
  {
    name: "Imran Sheikh",
    email: "imran.sheikh@mail.com",
    phone: "+91 93456 78210",
    gender: "male",
    dobOffsetDays: 130,
    age: 34,
    planId: "plan_quarterly",
    endOffset: 24,
    paidRatio: 1,
  },
];

const NOTE_TITLES = [
  "Strength assessment",
  "Nutrition check-in",
  "Form correction",
  "Monthly review",
];

export function buildSeed(): GymState {
  const now = today();
  const members: Member[] = [];
  const memberships: Membership[] = [];
  const payments: Payment[] = [];
  const activities: Activity[] = [];
  let invoiceSeq = 1000;

  const nextInvoice = () => `INV-${++invoiceSeq}`;

  MEMBER_SEED.forEach((seed, i) => {
    const plan = PLANS.find((p) => p.id === seed.planId)!;
    const end = addDays(now, seed.endOffset);
    const start = addDays(end, -plan.durationDays);
    const memberId = `mem_${i + 1}`;

    members.push({
      id: memberId,
      name: seed.name,
      email: seed.email,
      phone: seed.phone,
      gender: seed.gender,
      dob: birthdayFor(seed.dobOffsetDays, seed.age),
      address: pick(
        [
          "12 Marine Drive, Mumbai",
          "44 Park Street, Kolkata",
          "8 MG Road, Bengaluru",
          "21 Civil Lines, Delhi",
          "5 Kalyani Nagar, Pune",
        ],
        i,
      ),
      photo: null,
      joinDate: iso(addDays(start, -rand(0, 200))),
      emergencyContact: "+91 98000 0" + (1000 + i),
      notes: [
        {
          id: uid("note"),
          date: iso(addDays(now, -rand(5, 40))),
          title: pick(NOTE_TITLES, i),
          note: "Consistent attendance. Increase compound lift volume by 10% next cycle.",
        },
      ],
      measurements: [-90, -45, -5].map((off, k) => ({
        id: uid("msr"),
        date: iso(addDays(now, off)),
        weightKg: 62 + i * 0.7 + k * 0.6,
        heightCm: 158 + (i % 7) * 3,
        chestCm: 92 + k,
        waistCm: 86 - k,
        armsCm: 32 + k * 0.5,
        bodyFat: 24 - k * 0.8,
      })),
      deletedAt: null,
      deletedBy: null,
    });

    // previous term (history)
    if (i % 3 === 0) {
      const prevEnd = addDays(start, -1);
      const prevStart = addDays(prevEnd, -plan.durationDays);
      const prevId = uid("mship");
      memberships.push({
        id: prevId,
        memberId,
        planId: plan.id,
        startDate: iso(prevStart),
        endDate: iso(prevEnd),
        price: plan.price,
        discount: 0,
        frozen: false,
        createdAt: iso(prevStart),
      });
      payments.push({
        id: uid("pay"),
        invoiceNo: nextInvoice(),
        memberId,
        membershipId: prevId,
        kind: "membership",
        amount: plan.price,
        method: "cash",
        date: iso(prevStart),
        note: `${plan.name} — full payment`,
      });
    }

    const mshipId = uid("mship");
    memberships.push({
      id: mshipId,
      memberId,
      planId: plan.id,
      startDate: iso(start),
      endDate: iso(end),
      price: plan.price,
      discount: i % 5 === 0 ? 200 : 0,
      frozen: Boolean(seed.frozen),
      frozenAt: seed.frozen ? iso(addDays(now, -9)) : null,
      createdAt: iso(start),
    });

    const payable = plan.price - (i % 5 === 0 ? 200 : 0);
    const paid = Math.round(payable * seed.paidRatio);
    if (paid > 0) {
      payments.push({
        id: uid("pay"),
        invoiceNo: nextInvoice(),
        memberId,
        membershipId: mshipId,
        kind: "membership",
        amount: paid,
        method: pick(["cash", "card", "bank", "other"] as const, i),
        date: iso(addDays(start, 1)),
        note: `${plan.name} — ${seed.paidRatio === 1 ? "full" : "part"} payment`,
      });
    }
  });

  const products: Product[] = PRODUCT_SEED.map(
    ([name, category, cost, price, stock, lowStockAt], i) => ({
      id: `prd_${i + 1}`,
      name,
      category,
      sku: `SKU-${(i + 1).toString().padStart(3, "0")}`,
      cost,
      price,
      stock,
      lowStockAt,
      createdAt: iso(addDays(now, -rand(40, 300))),
    }),
  );

  const sales: Sale[] = [];
  for (let d = 120; d >= 0; d--) {
    const count = d % 4 === 0 ? 2 : d % 3 === 0 ? 1 : 0;
    for (let k = 0; k < count; k++) {
      const product = products[(d + k) % products.length];
      const qty = rand(1, 3);
      const saleId = uid("sale");
      const date = iso(addDays(now, -d));
      const buyer = MEMBER_SEED[(d + k) % MEMBER_SEED.length];
      sales.push({
        id: saleId,
        invoiceNo: nextInvoice(),
        productId: product.id,
        productName: product.name,
        qty,
        unitPrice: product.price,
        unitCost: product.cost,
        total: product.price * qty,
        buyer: buyer.name,
        memberId: `mem_${((d + k) % MEMBER_SEED.length) + 1}`,
        date,
      });
      payments.push({
        id: uid("pay"),
        invoiceNo: `INV-${invoiceSeq}`,
        saleId,
        kind: "product",
        amount: product.price * qty,
        method: pick(["cash", "card", "bank"] as const, d),
        date,
        note: `${product.name} × ${qty}`,
      });
    }
  }

  const activitySeed: Array<[Activity["type"], string, string, number]> = [
    ["member_added", "New member registered", "Imran Sheikh joined Quarterly Power", 0.2],
    ["payment_received", "Payment received", "₹4,000 from Arjun Nair", 0.6],
    ["product_sold", "Product sold", "Whey Protein 1kg × 1 sold to Neha Kapoor", 1.2],
    ["membership_renewed", "Membership renewed", "Rohit Verma renewed Annual Platinum", 2],
    ["invoice_generated", "Invoice generated", "Invoice INV-1042 created for Divya Menon", 3],
    ["membership_expired", "Membership expired", "Aman Singh's membership expired", 4],
    ["product_added", "Product added", "Knee Wraps added to inventory", 5],
    ["member_added", "New member registered", "Tanvi Desai joined Personal Training", 7],
    ["payment_received", "Payment received", "₹1,500 from Mihir Joshi", 8],
  ];

  activitySeed.forEach(([type, title, description, daysAgo]) => {
    activities.push({
      id: uid("act"),
      type,
      title,
      description,
      date: iso(addDays(now, -Math.floor(daysAgo)) as Date),
    });
  });

  const expenseSeed: Array<[string, Expense["category"], number, number, Expense["method"]]> = [
    ["Monthly facility rent", "Rent", 85000, 2, "bank"],
    ["Trainer salaries", "Salaries", 68000, 4, "bank"],
    ["Electricity and water", "Utilities", 12450, 7, "bank"],
    ["Equipment servicing", "Maintenance", 7800, 12, "cash"],
    ["Cleaning supplies", "Supplies", 3250, 16, "cash"],
    ["Social media promotion", "Marketing", 6000, 21, "card"],
    ["Monthly facility rent", "Rent", 85000, 33, "bank"],
    ["Trainer salaries", "Salaries", 68000, 35, "bank"],
    ["Replacement dumbbells", "Equipment", 18500, 41, "card"],
    ["Electricity and water", "Utilities", 11820, 45, "bank"],
    ["Quarterly fire inspection", "Maintenance", 4500, 63, "cheque"],
    ["Member welcome kits", "Supplies", 9200, 78, "card"],
  ];
  const expenses: Expense[] = expenseSeed.map(([title, category, amount, daysAgo, method], i) => ({
    id: `exp_seed_${i + 1}`,
    expenseNo: `EXP-${String(i + 1).padStart(6, "0")}`,
    title,
    category,
    amount,
    date: iso(addDays(now, -daysAgo)),
    method,
    notes: "Starter record for offline reporting and cash-flow analysis.",
    attachment: null,
    createdAt: iso(addDays(now, -daysAgo)),
    deletedAt: null,
  }));

  return {
    version: 1,
    // sha-256 of "admin123"
    auth: {
      email: "admin@ironvault.gym",
      passwordHash: "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
    },
    settings: {
      gymName: "IRONVAULT",
      tagline: "Strength Club & Performance Studio",
      address: "3rd Floor, Aurum Tower, Marine Drive, Mumbai 400002",
      phone: "+91 98200 00001",
      email: "front.desk@ironvault.gym",
      currency: "₹",
      invoicePrefix: "INV",
      lowStockAlerts: true,
      expiryReminderDays: 7,
      adminName: "Gym Owner",
    },
    members,
    plans: PLANS,
    memberships,
    payments,
    products,
    sales,
    activities,
    expenses,
    readNotifications: [],
    invoiceSeq,
  };
}
