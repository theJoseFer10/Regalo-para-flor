"use client";

import dynamic from "next/dynamic";

// Three.js necesita el navegador: se carga solo en el cliente.
const SolarSystemScene = dynamic(() => import("./solar-system-scene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-white/60">
        <span className="size-10 animate-pulse rounded-full bg-amber-300/80 shadow-[0_0_45px_18px_rgba(255,183,3,0.28)]" />
        <p className="text-xs tracking-[0.25em] uppercase">
          Preparando el universo…
        </p>
      </div>
    </div>
  ),
});

export default function SolarSystemLoader() {
  return <SolarSystemScene />;
}
