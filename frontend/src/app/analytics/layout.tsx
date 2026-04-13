import AuthGuard from "@/components/layout/AuthGuard";
import NotificationToast from "@/components/layout/NotificationToast";

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <NotificationToast />
    </AuthGuard>
  );
}
