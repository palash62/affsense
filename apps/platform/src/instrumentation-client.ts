/**
 * Next.js / Turbopack (dev-only): React can call performance.measure with a
 * negative duration when a layout aborts via redirect()/notFound() before
 * children finish timing. That throws a Runtime TypeError overlay even though
 * the page is fine. Swallow only that specific failure.
 * @see https://github.com/vercel/next.js/issues/86060
 */
if (process.env.NODE_ENV === "development" && typeof performance !== "undefined") {
  const original = performance.measure.bind(performance);
  performance.measure = ((...args: Parameters<typeof original>) => {
    try {
      return original(...args);
    } catch (e) {
      if (e instanceof Error && e.message.includes("negative time stamp")) {
        return undefined as unknown as PerformanceMeasure;
      }
      throw e;
    }
  }) as typeof performance.measure;
}
