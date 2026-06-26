"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/components/i18n-provider";

export default function LogoutButton() {
  const router = useRouter();
  const { dict } = useI18n();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {dict.common.sair}
    </button>
  );
}
