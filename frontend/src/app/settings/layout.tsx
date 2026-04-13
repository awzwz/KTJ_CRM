import AuthGuard from "@/components/layout/AuthGuard";
import NotificationToast from "@/components/layout/NotificationToast";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <NotificationToast />
    </AuthGuard>
  );
}
