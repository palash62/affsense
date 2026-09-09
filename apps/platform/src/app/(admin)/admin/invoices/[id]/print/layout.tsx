export default function AdminInvoicePrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fixed inset-0 z-50 min-h-screen overflow-auto bg-background">{children}</div>;
}
