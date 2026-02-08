"use client";

import { useRouter } from "next/navigation";

function getAnonId(): string {
  let id = localStorage.getItem("anon_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("anon_id", id);
  }
  return id;
}

export default function Login() {
  const router = useRouter();

  const handleLogin = async () => {
    const anonId = getAnonId();

    await fetch("/start-call", {
      method: "POST",
      headers: {
        "x-anon-id": anonId,
      },
    });

    router.push("/");
  };

  return (
    <button onClick={handleLogin}>
      Continue Anonymously
    </button>
  );
}
