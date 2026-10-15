import { useTranslations } from "next-intl";
import type { StaffUserDto } from "@/lib/admin-api";

function Item({ dot, children }: { dot: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${dot}`} />
      {children}
    </span>
  );
}

// Plain-text status with small colored dots (the words carry the meaning; the
// dots are decorative): active or disabled, plus "locked" and "must change
// password" when they apply.
export function UserStatus({ user }: { user: StaffUserDto }) {
  const t = useTranslations("Admin.users.status");
  return (
    <span className="flex flex-col gap-0.5">
      {user.isActive ? (
        <Item dot="bg-cedar">{t("active")}</Item>
      ) : (
        <Item dot="bg-ink/40">{t("disabled")}</Item>
      )}
      {user.isLockedOut && <Item dot="bg-alert-danger">{t("locked")}</Item>}
      {user.mustChangePassword && <Item dot="bg-alert-warn">{t("mustChange")}</Item>}
    </span>
  );
}
