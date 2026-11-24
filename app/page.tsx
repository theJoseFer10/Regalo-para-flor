import SolarSystemLoader from "@/components/solar-system-loader";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#05060f] text-white">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center px-4 pt-7 text-center sm:pt-10">
        <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/60 sm:text-xs">
          Un regalo para ti
        </p>
        <h1 className="mt-2 bg-gradient-to-r from-amber-200 via-pink-200 to-sky-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent sm:text-4xl">
          Tu pequeño universo
        </h1>
        <p className="mt-2 max-w-md text-xs leading-5 text-white/55 sm:text-sm">
          Cinco mundos, cinco razones para sonreír. Toca cada astro para
          descubrirla.
        </p>
      </header>

      <SolarSystemLoader />
    </main>
  );
}
