"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function IndexPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasAuth = !!localStorage.getItem("auth_token");
    const hasAnon = !!localStorage.getItem("anon_id");
    if (hasAuth || hasAnon) {
      router.replace("/home");
    } else {
      router.replace("/login");
    }
    setChecked(true);
  }, [router]);

  if (!checked) return null;
  return null;
}
