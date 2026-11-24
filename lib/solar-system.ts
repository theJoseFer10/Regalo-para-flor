/**
 * Configuración de los astros del sistema solar.
 * Cambia aquí nombres, colores y mensajes para personalizar el regalo.
 */

export type CelestialPattern =
  | "sun"
  | "minecraft"
  | "music"
  | "dance"
  | "gerontology"
  | "sushi";

export type CelestialBody = {
  id: string;
  name: string;
  theme: string;
  message: string;
  color: string;
  accent: string;
  glow: string;
  emoji: string;
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitTilt: number;
  spinSpeed: number;
  pattern: CelestialPattern;
  shape?: "sphere" | "cube";
  ring?: boolean;
};

export const SUN: CelestialBody = {
  id: "sun",
  name: "El Sol",
  theme: "El centro de todo",
  message:
    "Gracias por ser luz de tanta gente, incluida yo. Este universo gira alrededor de ti.",
  color: "#ffb703",
  accent: "#ff6b35",
  glow: "#ff9e00",
  emoji: "☀️",
  radius: 3.2,
  orbitRadius: 0,
  orbitSpeed: 0,
  orbitTilt: 0,
  spinSpeed: 0,
  pattern: "sun",
};

export const PLANETS: CelestialBody[] = [
  {
    id: "bloque",
    name: "Bloque",
    theme: "Minecraft",
    message:
      "Porque siempre sabes construir mundos nuevos, incluso desde cero. Que nunca te falte creatividad para hacerlos tuyos.",
    color: "#5b8c3b",
    accent: "#9b6b3f",
    glow: "#8fd46a",
    emoji: "⛏️",
    radius: 1.1,
    orbitRadius: 7,
    orbitSpeed: 0.22,
    orbitTilt: 3,
    spinSpeed: 0.25,
    pattern: "minecraft",
    shape: "cube",
  },
  {
    id: "melodia",
    name: "Melodía",
    theme: "Música",
    message:
      "Que nuestra amistad siempre tenga buena banda sonora y que nunca te falte un motivo para subir el volumen.",
    color: "#7b5cff",
    accent: "#ffd166",
    glow: "#b39cff",
    emoji: "🎵",
    radius: 1.25,
    orbitRadius: 10,
    orbitSpeed: 0.16,
    orbitTilt: -5,
    spinSpeed: 0.2,
    pattern: "music",
    ring: true,
  },
  {
    id: "ritmo",
    name: "Ritmo",
    theme: "Baile y danza",
    message:
      "Ojalá encuentres siempre un compás que te saque una sonrisa y un lugar donde moverte sin pensar.",
    color: "#ff4f8b",
    accent: "#ffe066",
    glow: "#ff8ac4",
    emoji: "💃",
    radius: 1.05,
    orbitRadius: 13.2,
    orbitSpeed: 0.12,
    orbitTilt: 7,
    spinSpeed: 0.22,
    pattern: "dance",
  },
  {
    id: "memoria",
    name: "Memoria",
    theme: "Gerontología",
    message:
      "Admiro cómo estudias el arte de envejecer bien: con memoria, cuidado y dignidad. Que cada etapa tuya florezca.",
    color: "#9a7aa8",
    accent: "#f3d9b1",
    glow: "#c9a7c7",
    emoji: "🌿",
    radius: 1.15,
    orbitRadius: 16.5,
    orbitSpeed: 0.09,
    orbitTilt: -6,
    spinSpeed: 0.15,
    pattern: "gerontology",
  },
  {
    id: "sushi",
    name: "Sushi",
    theme: "Sushi",
    message:
      "Que cada día tenga un toque de frescura y sorpresa, como un buen sushi. Y que siempre encuentres tu combinación favorita.",
    color: "#f1e8d8",
    accent: "#ff7a59",
    glow: "#7ac74f",
    emoji: "🍣",
    radius: 0.95,
    orbitRadius: 19.8,
    orbitSpeed: 0.07,
    orbitTilt: 4,
    spinSpeed: 0.24,
    pattern: "sushi",
  },
];

export const BODIES: CelestialBody[] = [SUN, ...PLANETS];

export const SURFACE_LIFE: Record<string, string> = {
  bloque:
    "Árboles de bloques, flores cúbicas, nubes cuadradas, ovejas que pastan y Steve saludándote.",
  melodia:
    "Una disco con pista de notas, neón, neblina, luces de colores, bola de espejos y notas flotantes.",
  ritmo:
    "Un teatro lleno de público, neblina, focos de colores y una bailarina de danza contemporánea.",
  memoria:
    "Pradera verde con pasto que se mece, árboles grandes, nubes, mariposas, un gato curioso y un abuelo que saluda desde la banca.",
  sushi:
    "Un océano con olas y nubes, un barco-restaurante, peces que saltan y un chef que te desea feliz cumpleaños.",
};
