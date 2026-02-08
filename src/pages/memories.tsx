import { useEffect } from "react";
import { useRouter } from "next/router";

export default function MemoriesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/home");
  }, [router]);

  return null;
}
