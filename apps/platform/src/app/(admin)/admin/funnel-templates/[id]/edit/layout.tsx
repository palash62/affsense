export default function AdminFunnelTemplateEditLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-muted">
      {children}
    </div>
  );
}
