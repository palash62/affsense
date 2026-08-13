import { PrismaClient, Prisma } from "@prisma/client";

const PRISMA_CLIENT_VERSION = 22;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaClientVersion?: number;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export function resetPrismaClient() {
  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.prismaClientVersion = undefined;
}

export function isStalePrismaClientError(error: unknown) {
  return (
    error instanceof Error &&
    (/Unknown argument `/.test(error.message) ||
      /Invalid `prisma\..*` invocation/.test(error.message))
  );
}

export function pageTemplateHasThankYouScalars(_client: PrismaClient = getPrisma()) {
  const pageTemplate = Prisma.dmmf.datamodel.models.find((model) => model.name === "PageTemplate");
  return pageTemplate?.fields?.some(
    (field) => field.name === "thankYouEnabled" || field.name === "destinationUrl",
  );
}

function getPrisma() {
  const cached = globalForPrisma.prisma;
  const versionMatches = globalForPrisma.prismaClientVersion === PRISMA_CLIENT_VERSION;

  if (cached && versionMatches) {
    return cached;
  }

  if (cached) {
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClientVersion = PRISMA_CLIENT_VERSION;

  return client;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * from "@prisma/client";
