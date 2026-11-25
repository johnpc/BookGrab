import { Suspense } from "react";
import HomeClient from "@/components/HomeClient";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeClient mamBaseUrl={process.env.MAM_BASE_URL ?? "https://www.myanonamouse.net"} />
    </Suspense>
  );
}
