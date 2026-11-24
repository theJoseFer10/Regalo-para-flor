"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  BODIES,
  PLANETS,
  SUN,
  SURFACE_LIFE,
  type CelestialBody,
} from "@/lib/solar-system";

type BodyRuntime = {
  data: CelestialBody;
  mesh: THREE.Mesh;
  angle: number;
  atmosphere?: THREE.Sprite;
  atmosphereOpacity: number;
};

type Comet = {
  head: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  glow: THREE.Sprite;
  tail: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  tailCore: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  start: THREE.Vector3;
  end: THREE.Vector3;
  axis: THREE.Vector3;
  amplitude: number;
  progress: number;
  speed: number;
  length: number;
  coreLength: number;
};

type ViewMode = "space" | "traveling" | "surface";

type DanceRig = {
  torso: THREE.Group;
  head: THREE.Group;
  arms: THREE.Group[];
  legs: THREE.Group[];
};

type SurfaceAnimation = {
  object: THREE.Object3D;
  baseY: number;
  speed: number;
  amplitude: number;
  spin?: number;
  phase?: number;
  driftX?: number;
  driftZ?: number;
  legs?: THREE.Object3D[];
  walkSpeed?: number;
  waveArm?: THREE.Object3D;
  waveSpeed?: number;
  windPhase?: number;
  windSpeed?: number;
  windStrength?: number;
  dance?: DanceRig;
  danceSpeed?: number;
};

type TravelState = {
  bodyId: string;
  progress: number;
  duration: number;
  curve: THREE.QuadraticBezierCurve3;
};

/* ---------- utilidades para las texturas procedurales ---------- */

function hashString(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((char) => char + char)
          .join("")
      : clean;
  const value = parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function makeGlowTexture(color: string, innerAlpha = 0.85) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const { r, g, b } = hexToRgb(color);
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${innerAlpha})`);
  gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.4})`);
  gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${innerAlpha * 0.12})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSymbolTexture(symbol: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const fontSize = symbol.length > 4 ? 38 : symbol.length > 3 ? 46 : 84;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillText(symbol, 64, 70);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSpeechTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255, 253, 248, 0.96)";
  ctx.strokeStyle = "#e2718f";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(12, 12, 616, 126, 36);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(240, 134);
  ctx.lineTo(210, 172);
  ctx.lineTo(300, 134);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#7a2547";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(text, 320, 76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMeadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const random = mulberry32(20240921);
  const size = canvas.width;

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#6ba84f");
  base.addColorStop(0.5, "#4f913e");
  base.addColorStop(1, "#3d7a35");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 90; i++) {
    ctx.globalAlpha = 0.05 + random() * 0.12;
    ctx.fillStyle = random() > 0.5 ? "#b6d47a" : "#2f6b30";
    ctx.beginPath();
    ctx.ellipse(
      random() * size,
      random() * size,
      40 + random() * 120,
      25 + random() * 80,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const grassColors = ["#8dc25d", "#7bb34f", "#a8d06a", "#3f7f38", "#5d9e44"];
  for (let i = 0; i < 3400; i++) {
    const x = random() * size;
    const y = random() * size;
    ctx.globalAlpha = 0.25 + random() * 0.45;
    ctx.strokeStyle = grassColors[Math.floor(random() * grassColors.length)];
    ctx.lineWidth = 1 + random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 4, y - 5 - random() * 9);
    ctx.stroke();
  }

  const flowerColors = ["#fff3c4", "#ffd1dc", "#ffffff", "#c9b6ff", "#ffb347"];
  for (let i = 0; i < 210; i++) {
    const x = random() * size;
    const y = random() * size;
    const radius = 3 + random() * 4;
    ctx.globalAlpha = 0.7 + random() * 0.3;
    ctx.fillStyle = flowerColors[i % flowerColors.length];
    for (let petal = 0; petal < 4; petal++) {
      const angle = (petal / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        radius * 0.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeBodyTexture(body: CelestialBody) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const width = canvas.width;
  const height = canvas.height;
  const random = mulberry32(hashString(body.id));

  ctx.fillStyle = body.color;
  ctx.fillRect(0, 0, width, height);

  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, "rgba(255,255,255,0.16)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.32)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  switch (body.pattern) {
    case "sun": {
      const glow = ctx.createRadialGradient(
        width * 0.27,
        height * 0.45,
        10,
        width * 0.27,
        height * 0.45,
        width * 0.5,
      );
      glow.addColorStop(0, "#fff6c2");
      glow.addColorStop(0.4, "#ffb703");
      glow.addColorStop(1, "#ff6d00");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < 180; i++) {
        ctx.globalAlpha = 0.08 + random() * 0.16;
        ctx.fillStyle = i % 2 ? "#ff6d00" : "#fff3b0";
        ctx.beginPath();
        ctx.arc(
          random() * width,
          random() * height,
          6 + random() * 26,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }

      // Una sonrisa muy sutil en la cara visible del sol.
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#7a3300";
      ctx.strokeStyle = "#7a3300";
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      const faceX = width * 0.25;
      ctx.beginPath();
      ctx.arc(faceX - 42, height * 0.45, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(faceX + 42, height * 0.45, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(faceX, height * 0.47, 48, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();
      break;
    }
    case "minecraft": {
      const blocks = [
        "#6ab04c",
        "#4f8f3a",
        "#8b5a2b",
        "#a06a3c",
        "#7a7a7a",
        "#c2c2c2",
        "#3f3f3f",
      ];
      const cell = 32;
      for (let y = 0; y < height; y += cell) {
        for (let x = 0; x < width; x += cell) {
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = blocks[Math.floor(random() * blocks.length)];
          ctx.fillRect(x, y, cell, cell);
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = "#000000";
          ctx.fillRect(x, y, cell, 2);
          ctx.fillRect(x, y, 2, cell);
          if (random() > 0.72) {
            ctx.globalAlpha = 0.14;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
          }
        }
      }
      break;
    }
    case "music": {
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = body.accent;
      ctx.lineWidth = 2;
      for (let line = 0; line < 5; line++) {
        const y = height * 0.3 + line * 24;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      const notes = ["♪", "♫", "♩", "♬", "★"];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 85; i++) {
        ctx.save();
        ctx.globalAlpha = 0.25 + random() * 0.5;
        ctx.fillStyle = i % 3 === 0 ? "#ffffff" : body.accent;
        ctx.translate(random() * width, random() * height);
        ctx.rotate((random() - 0.5) * 0.8);
        ctx.font = `${34 + Math.floor(random() * 42)}px serif`;
        ctx.fillText(notes[Math.floor(random() * notes.length)], 0, 0);
        ctx.restore();
      }
      break;
    }
    case "dance": {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "#ff4f8b");
      gradient.addColorStop(0.5, "#ff8ac4");
      gradient.addColorStop(1, "#7b5cff");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const confetti = ["#ffe066", "#ffffff", "#7cf6d2", "#ffb703"];
      for (let i = 0; i < 180; i++) {
        ctx.save();
        ctx.globalAlpha = 0.25 + random() * 0.5;
        ctx.fillStyle = confetti[Math.floor(random() * confetti.length)];
        ctx.translate(random() * width, random() * height);
        ctx.rotate(random() * Math.PI);
        ctx.fillRect(0, 0, 4 + random() * 8, 2 + random() * 5);
        ctx.restore();
      }
      const glyphs = ["💃", "🕺", "✨", "🎶", "💫", "🩰"];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 55; i++) {
        ctx.save();
        ctx.globalAlpha = 0.55 + random() * 0.4;
        ctx.font = `${38 + Math.floor(random() * 34)}px sans-serif`;
        ctx.translate(random() * width, random() * height);
        ctx.rotate((random() - 0.5) * 0.5);
        ctx.fillText(glyphs[Math.floor(random() * glyphs.length)], 0, 0);
        ctx.restore();
      }
      break;
    }
    case "gerontology": {
      for (let i = 0; i < 14; i++) {
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = i % 2 ? body.accent : "#ffffff";
        ctx.fillRect(0, (i / 14) * height, width, 6 + random() * 16);
      }
      const words = ["memoria", "experiencia", "cuidado", "historia", "ternura", "legado"];
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 42; i++) {
        ctx.save();
        ctx.globalAlpha = 0.12 + random() * 0.2;
        ctx.fillStyle = i % 2 ? body.accent : "#fff8ee";
        ctx.font = `italic ${28 + Math.floor(random() * 26)}px Georgia, serif`;
        ctx.translate(random() * width, random() * height);
        ctx.rotate((random() - 0.5) * 0.24);
        ctx.fillText(words[Math.floor(random() * words.length)], 0, 0);
        ctx.restore();
      }
      for (let i = 0; i < 70; i++) {
        const x = random() * width;
        const y = random() * height;
        const size = 4 + random() * 7;
        ctx.globalAlpha = 0.3 + random() * 0.35;
        ctx.fillStyle = body.accent;
        for (let petal = 0; petal < 4; petal++) {
          const angle = (petal / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(
            x + Math.cos(angle) * size,
            y + Math.sin(angle) * size,
            size * 0.62,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
      }
      break;
    }
    case "sushi": {
      const ocean = ctx.createLinearGradient(0, 0, 0, height);
      ocean.addColorStop(0, "#0d5c86");
      ocean.addColorStop(0.5, "#1687ad");
      ocean.addColorStop(1, "#0a4a72");
      ctx.fillStyle = ocean;
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 150; i++) {
        const y = random() * height;
        ctx.globalAlpha = 0.08 + random() * 0.14;
        ctx.strokeStyle = random() > 0.4 ? "#c8f4ff" : "#064066";
        ctx.lineWidth = 2 + random() * 5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= width; x += 48) {
          ctx.lineTo(x, y + Math.sin(x * 0.02 + i) * (4 + random() * 8));
        }
        ctx.stroke();
      }
      for (let i = 0; i < 160; i++) {
        ctx.globalAlpha = 0.2 + random() * 0.35;
        ctx.fillStyle = "#d9f7ff";
        ctx.beginPath();
        ctx.ellipse(random() * width, random() * height, 5 + random() * 12, 1.5 + random() * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (body.pattern === "minecraft") {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestMipmapNearestFilter;
  }
  return texture;
}

/* ---------- componente ---------- */

export default function SolarSystemScene() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState<string>(SUN.id);
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [viewMode, setViewMode] = useState<ViewMode>("space");
  const [visitingId, setVisitingId] = useState<string | null>(null);

  const selectedRef = useRef(selectedId);
  const hoveredRef = useRef<string | null>(null);
  const pausedRef = useRef(paused);
  const viewModeRef = useRef<ViewMode>("space");
  const setHoverRef = useRef<(id: string | null) => void>(() => {});
  const resetViewRef = useRef<() => void>(() => {});
  const startTravelRef = useRef<(id: string) => void>(() => {});
  const requestReturnRef = useRef<() => void>(() => {});
  const progressRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  const selectBody = useCallback((id: string) => {
    selectedRef.current = id;
    setSelectedId(id);
  }, []);

  const togglePaused = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const visitPlanet = useCallback((id: string) => {
    if (viewModeRef.current !== "space") return;
    startTravelRef.current(id);
  }, []);

  const returnToSpace = useCallback(() => {
    if (viewModeRef.current !== "surface") return;
    requestReturnRef.current();
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const spaceBackground = new THREE.Color("#05060f");
    const spaceFog = new THREE.FogExp2("#05060f", 0.0035);
    scene.background = spaceBackground;
    scene.fog = spaceFog;
    const solarGroup = new THREE.Group();
    scene.add(solarGroup);

    const camera = new THREE.PerspectiveCamera(
      52,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      500,
    );
    camera.position.set(0, 19, 38);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 8;
    controls.maxDistance = 72;
    controls.minPolarAngle = Math.PI * 0.12;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.saveState();
    resetViewRef.current = () => controls.reset();

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [];
    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => {
      geometries.push(geometry);
      return geometry;
    };
    const trackMaterial = <T extends THREE.Material>(material: T) => {
      materials.push(material);
      return material;
    };
    const trackTexture = <T extends THREE.Texture>(texture: T) => {
      textures.push(texture);
      return texture;
    };

    /* luces */
    scene.add(new THREE.AmbientLight(0x9aa8ff, 0.55));
    const sunLight = new THREE.PointLight(0xffd6a0, 125, 140, 2);
    scene.add(sunLight);
    const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.65);
    fillLight.position.set(12, 22, 30);
    scene.add(fillLight);

    /* estrellas */
    const starCount = 1600;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const radius = 70 + Math.random() * 95;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const starsGeometry = trackGeometry(new THREE.BufferGeometry());
    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3),
    );
    const starsMaterial = trackMaterial(
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    solarGroup.add(new THREE.Points(starsGeometry, starsMaterial));

    /* nebulosas de fondo */
    const purpleGlow = trackTexture(makeGlowTexture("#6d4bff", 0.5));
    const tealGlow = trackTexture(makeGlowTexture("#14b8a6", 0.45));
    const nebulaMaterialA = trackMaterial(
      new THREE.SpriteMaterial({
        map: purpleGlow,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const nebulaMaterialB = trackMaterial(
      new THREE.SpriteMaterial({
        map: tealGlow,
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const nebulaA = new THREE.Sprite(nebulaMaterialA);
    nebulaA.position.set(-52, 24, -115);
    nebulaA.scale.setScalar(140);
    nebulaA.renderOrder = -2;
    const nebulaB = new THREE.Sprite(nebulaMaterialB);
    nebulaB.position.set(58, -28, -125);
    nebulaB.scale.setScalar(120);
    nebulaB.renderOrder = -2;
    solarGroup.add(nebulaA, nebulaB);

    /* cometas que atraviesan el sistema */
    const cometGlowTexture = trackTexture(makeGlowTexture("#ffffff", 0.95));
    const cometHeadGeometry = trackGeometry(
      new THREE.SphereGeometry(0.22, 12, 8),
    );
    const cometColors = ["#bfe9ff", "#ffd6a5", "#d9b8ff", "#a8ffdf"];
    const worldUp = new THREE.Vector3(0, 1, 0);
    const comets: Comet[] = [];

    const randomSpherePoint = (radius: number) => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta),
      );
    };

    const resetComet = (comet: Comet, initial = false) => {
      const start = randomSpherePoint(62 + Math.random() * 38);
      const end = start.clone().multiplyScalar(-1).add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 12,
        ),
      );
      const direction = end.clone().sub(start).normalize();
      const axis = new THREE.Vector3().crossVectors(direction, worldUp);
      if (axis.lengthSq() < 0.001) axis.set(1, 0, 0);
      else axis.normalize();

      comet.start.copy(start);
      comet.end.copy(end);
      comet.axis.copy(axis);
      comet.amplitude = 2 + Math.random() * 6;
      comet.progress = initial ? Math.random() : 0;
      comet.speed = 0.035 + Math.random() * 0.03;
    };

    for (let i = 0; i < 5; i++) {
      const color = new THREE.Color(cometColors[i % cometColors.length]);
      const head = new THREE.Mesh(
        cometHeadGeometry,
        trackMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
          }),
        ),
      );
      const glow = new THREE.Sprite(
        trackMaterial(
          new THREE.SpriteMaterial({
            map: cometGlowTexture,
            color,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        ),
      );
      glow.scale.setScalar(2.4);
      head.add(glow);

      const length = 6 + Math.random() * 5;
      const coreLength = length * 0.72;
      const tail = new THREE.Mesh(
        trackGeometry(new THREE.ConeGeometry(0.55, length, 12, 1, true)),
        trackMaterial(
          new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
      const tailCore = new THREE.Mesh(
        trackGeometry(new THREE.ConeGeometry(0.2, coreLength, 10, 1, true)),
        trackMaterial(
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.32,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        ),
      );
      solarGroup.add(head, tail, tailCore);

      const comet: Comet = {
        head,
        glow,
        tail,
        tailCore,
        start: new THREE.Vector3(),
        end: new THREE.Vector3(),
        axis: new THREE.Vector3(),
        amplitude: 0,
        progress: 0,
        speed: 0,
        length,
        coreLength,
      };
      resetComet(comet, true);
      comets.push(comet);
    }

    /* sol */
    const sunTexture = trackTexture(makeBodyTexture(SUN));
    const sunMaterial = trackMaterial(
      new THREE.MeshStandardMaterial({
        map: sunTexture,
        emissive: new THREE.Color("#ff8a00"),
        emissiveIntensity: 0.55,
        roughness: 1,
        metalness: 0,
      }),
    );
    const sunMesh = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(SUN.radius, 64, 48)),
      sunMaterial,
    );
    sunMesh.userData.bodyId = SUN.id;
    solarGroup.add(sunMesh);

    const sunGlowTexture = trackTexture(makeGlowTexture(SUN.glow, 0.95));
    const sunGlowMaterial = trackMaterial(
      new THREE.SpriteMaterial({
        map: sunGlowTexture,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const sunGlow = new THREE.Sprite(sunGlowMaterial);
    sunGlow.scale.setScalar(21);
    sunGlow.renderOrder = -1;
    solarGroup.add(sunGlow);

    /* planetas */
    const runtime: BodyRuntime[] = [
      {
        data: SUN,
        mesh: sunMesh,
        angle: 0,
        atmosphereOpacity: 0,
      },
    ];

    PLANETS.forEach((body, index) => {
      const orbitGroup = new THREE.Group();
      orbitGroup.rotation.x = THREE.MathUtils.degToRad(body.orbitTilt);
      solarGroup.add(orbitGroup);

      const orbitGeometry = trackGeometry(
        new THREE.RingGeometry(
          body.orbitRadius - 0.018,
          body.orbitRadius + 0.018,
          160,
        ),
      );
      const orbitMaterial = trackMaterial(
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(body.color).lerp(new THREE.Color("#ffffff"), 0.5),
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      const orbitLine = new THREE.Mesh(orbitGeometry, orbitMaterial);
      orbitLine.rotation.x = -Math.PI / 2;
      orbitGroup.add(orbitLine);

      const texture = trackTexture(makeBodyTexture(body));
      const material = trackMaterial(
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.82,
          metalness: 0.04,
        }),
      );
      const geometry =
        body.shape === "cube"
          ? new THREE.BoxGeometry(
              body.radius * 1.8,
              body.radius * 1.8,
              body.radius * 1.8,
            )
          : new THREE.SphereGeometry(body.radius, 48, 32);
      const mesh = new THREE.Mesh(trackGeometry(geometry), material);
      if (body.shape === "cube") {
        mesh.rotation.set(0.35, 0.45, 0.12);
      } else {
        mesh.rotation.z = THREE.MathUtils.degToRad(body.orbitTilt * 1.5);
      }
      mesh.userData.bodyId = body.id;
      orbitGroup.add(mesh);

      if (body.ring) {
        const ringGeometry = trackGeometry(
          new THREE.RingGeometry(body.radius * 1.45, body.radius * 2.15, 96),
        );
        const ringMaterial = trackMaterial(
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(body.accent),
            transparent: true,
            opacity: 0.32,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
        );
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2 + 0.18;
        mesh.add(ring);
      }

      const glowTexture = trackTexture(makeGlowTexture(body.glow, 0.7));
      const atmosphereMaterial = trackMaterial(
        new THREE.SpriteMaterial({
          map: glowTexture,
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const atmosphere = new THREE.Sprite(atmosphereMaterial);
      atmosphere.scale.setScalar(body.radius * 3.6);
      mesh.add(atmosphere);

      runtime.push({
        data: body,
        mesh,
        angle: index * 1.85 + 0.5,
        atmosphere,
        atmosphereOpacity: 0.22,
      });
    });

    /* ---------- nave, viaje y superficies temáticas ---------- */

    let travel: TravelState | null = null;
    let activeSurfaceId: string | null = null;
    let sushiWater: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null;
    let sushiBoat: THREE.Group | null = null;
    let fadeValue = 0;
    let pendingReturn = false;
    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const ship = new THREE.Group();
    const hullMaterial = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xe8eefc,
        metalness: 0.65,
        roughness: 0.3,
      }),
    );
    const hull = new THREE.Mesh(
      trackGeometry(new THREE.CylinderGeometry(0.28, 0.4, 1.3, 16)),
      hullMaterial,
    );
    ship.add(hull);
    const nose = new THREE.Mesh(
      trackGeometry(new THREE.ConeGeometry(0.28, 0.7, 16)),
      hullMaterial,
    );
    nose.position.y = 1;
    ship.add(nose);
    const cockpit = new THREE.Mesh(
      trackGeometry(new THREE.SphereGeometry(0.2, 16, 12)),
      trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x66d9ff,
          emissive: new THREE.Color(0x1b6f9c),
          emissiveIntensity: 0.6,
          roughness: 0.12,
          metalness: 0.25,
        }),
      ),
    );
    cockpit.position.set(0, 0.42, 0.25);
    cockpit.scale.set(1, 1.2, 0.65);
    ship.add(cockpit);
    const finMaterial = trackMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xff6b6b,
        metalness: 0.35,
        roughness: 0.5,
      }),
    );
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const fin = new THREE.Mesh(
        trackGeometry(new THREE.BoxGeometry(0.09, 0.5, 0.4)),
        finMaterial,
      );
      fin.position.set(Math.cos(angle) * 0.4, -0.55, Math.sin(angle) * 0.4);
      fin.rotation.y = -angle;
      ship.add(fin);
    }
    const flame = new THREE.Mesh(
      trackGeometry(new THREE.ConeGeometry(0.22, 0.85, 12)),
      trackMaterial(
        new THREE.MeshBasicMaterial({
          color: 0xffa500,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    flame.rotation.x = Math.PI;
    flame.position.y = -1.05;
    ship.add(flame);
    const flameGlow = new THREE.Sprite(
      trackMaterial(
        new THREE.SpriteMaterial({
          map: trackTexture(makeGlowTexture("#ff9f1c", 0.9)),
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    flameGlow.position.y = -1.25;
    flameGlow.scale.setScalar(1.8);
    ship.add(flameGlow);
    ship.visible = false;
    scene.add(ship);
    const shipUp = new THREE.Vector3(0, 1, 0);

    const symbolTextures: Record<string, THREE.Texture> = {};
    const getSymbolTexture = (symbol: string) => {
      if (!symbolTextures[symbol]) {
        symbolTextures[symbol] = trackTexture(makeSymbolTexture(symbol));
      }
      return symbolTextures[symbol];
    };
    const surfaceAnimations: Record<string, SurfaceAnimation[]> = {};
    const surfaceSky: Record<string, string> = {};
    const animatedLights: {
      light: THREE.PointLight;
      base: number;
      speed: number;
      phase: number;
    }[] = [];

    const addTrackedMesh = (
      parent: THREE.Object3D,
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      position: [number, number, number],
      rotation?: [number, number, number],
    ) => {
      trackGeometry(geometry);
      trackMaterial(material);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      if (rotation) mesh.rotation.set(...rotation);
      parent.add(mesh);
      return mesh;
    };

    const addBillboard = (
      surfaceId: string,
      parent: THREE.Object3D,
      symbol: string,
      position: [number, number, number],
      size: number,
      options: Partial<SurfaceAnimation> = {},
    ) => {
      const sprite = new THREE.Sprite(
        trackMaterial(
          new THREE.SpriteMaterial({
            map: getSymbolTexture(symbol),
            transparent: true,
            depthWrite: false,
          }),
        ),
      );
      sprite.position.set(...position);
      sprite.scale.setScalar(size);
      parent.add(sprite);
      surfaceAnimations[surfaceId].push({
        object: sprite,
        baseY: position[1],
        speed: options.speed ?? 1,
        amplitude: options.amplitude ?? 0.22,
        spin: options.spin,
        phase: Math.random() * Math.PI * 2,
      });
      return sprite;
    };

    const addHaze = (
      surfaceId: string,
      parent: THREE.Object3D,
      colors: string[],
      count: number,
    ) => {
      for (let i = 0; i < count; i++) {
        const haze = new THREE.Sprite(
          trackMaterial(
            new THREE.SpriteMaterial({
              map: trackTexture(makeGlowTexture(colors[i % colors.length], 0.3)),
              transparent: true,
              opacity: 0.16,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        );
        haze.position.set(rand(-20, 20), rand(0.7, 3), rand(-20, 14));
        haze.scale.set(rand(10, 18), rand(5, 9), 1);
        haze.userData.haze = true;
        surfaceAnimations[surfaceId].push({
          object: haze,
          baseY: haze.position.y,
          speed: rand(0.2, 0.5),
          amplitude: rand(0.2, 0.6),
          driftX: rand(0.3, 0.9) * (i % 2 ? 1 : -1),
          driftZ: rand(-0.2, 0.2),
          phase: rand(0, Math.PI * 2),
        });
        parent.add(haze);
      }
    };

    const addClouds = (surfaceId: string, parent: THREE.Object3D, count: number) => {
      const cloudMat = trackMaterial(
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 1,
          emissive: new THREE.Color(0x2a2a35),
          emissiveIntensity: 0.3,
        }),
      );
      const puffGeometry = trackGeometry(new THREE.SphereGeometry(1, 12, 10));
      for (let i = 0; i < count; i++) {
        const cloud = new THREE.Group();
        cloud.position.set(rand(-50, 50), rand(14, 22), rand(-45, 40));
        const puffs = 4 + Math.floor(rand(0, 3));
        for (let p = 0; p < puffs; p++) {
          const puff = new THREE.Mesh(puffGeometry, cloudMat);
          puff.scale.setScalar(rand(1.6, 3.2));
          puff.position.set(
            (p - puffs / 2) * 2.2,
            rand(-0.6, 0.6),
            rand(-0.6, 0.6),
          );
          cloud.add(puff);
        }
        parent.add(cloud);
        surfaceAnimations[surfaceId].push({
          object: cloud,
          baseY: cloud.position.y,
          speed: rand(0.15, 0.35),
          amplitude: rand(0.2, 0.5),
          driftX: rand(0.6, 1.4) * (i % 2 ? 1 : -1),
          driftZ: rand(-0.15, 0.15),
          phase: rand(0, Math.PI * 2),
        });
      }
    };

    const buildGround = (body: CelestialBody, group: THREE.Group) => {
      const texture = trackTexture(
        body.id === "memoria" ? makeMeadowTexture() : makeBodyTexture(body),
      );
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(body.id === "memoria" ? 3 : 8, body.id === "memoria" ? 3 : 8);
      const geometry = trackGeometry(new THREE.PlaneGeometry(160, 160, 40, 40));
      if (body.shape !== "cube") {
        const position = geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i);
          const y = position.getY(i);
          position.setZ(
            i,
            Math.sin(x * 0.11) * Math.cos(y * 0.09) * 0.5 +
              Math.sin(x * 0.3 + y * 0.18) * 0.22,
          );
        }
        geometry.computeVertexNormals();
      }
      const ground = new THREE.Mesh(
        geometry,
        trackMaterial(
          new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.96,
            metalness: 0,
          }),
        ),
      );
      ground.rotation.x = -Math.PI / 2;
      group.add(ground);
    };

    const buildSurface = (body: CelestialBody) => {
      const group = new THREE.Group();
      group.visible = false;
      surfaceAnimations[body.id] = [];
      // Música, Baile y Sushi tienen suelo propio (recinto o mar), no terreno exterior.
      if (body.id !== "melodia" && body.id !== "ritmo" && body.id !== "sushi") {
        buildGround(body, group);
      }

      const sky =
        body.id === "bloque"
          ? "#7ec8e3"
          : body.id === "melodia"
            ? "#241546"
            : body.id === "ritmo"
              ? "#3b1040"
              : body.id === "memoria"
                ? "#efd7ba"
                : body.id === "sushi"
                  ? "#9ad8ee"
                  : "#bfe9dd";
      surfaceSky[body.id] = sky;
      group.add(
        new THREE.HemisphereLight(
          0xffffff,
          new THREE.Color(sky),
          body.id === "melodia" || body.id === "ritmo"
            ? 0.5
            : body.id === "memoria" || body.id === "sushi"
              ? 1.4
              : 1.15,
        ),
      );
      const sun = new THREE.DirectionalLight(
        0xffffff,
        body.id === "melodia" || body.id === "ritmo"
          ? 0.35
          : body.id === "memoria" || body.id === "sushi"
            ? 1.9
            : 1.5,
      );
      sun.position.set(12, 26, 14);
      group.add(sun);

      if (body.id === "bloque") {
        const grass = new THREE.MeshStandardMaterial({ color: 0x6ab04c, roughness: 1 });
        const dirt = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 1 });
        const stone = new THREE.MeshStandardMaterial({ color: 0x8d8d8d, roughness: 1 });
        const wood = new THREE.MeshStandardMaterial({ color: 0x7a4b23, roughness: 1 });
        const leaves = new THREE.MeshStandardMaterial({ color: 0x4f8f3a, roughness: 1 });
        for (let i = 0; i < 28; i++) {
          const height = rand(1, 4);
          const blockMat = i % 3 === 0 ? stone : i % 3 === 1 ? dirt : grass;
          addTrackedMesh(
            group,
            new THREE.BoxGeometry(2, height, 2),
            blockMat,
            [rand(-42, 42), height / 2, rand(-42, 42)],
          );
        }
        for (let i = 0; i < 12; i++) {
          const x = rand(-40, 40);
          const z = rand(-40, 40);
          addTrackedMesh(group, new THREE.BoxGeometry(0.5, 3, 0.5), wood, [x, 1.5, z]);
          addTrackedMesh(group, new THREE.BoxGeometry(2.4, 1.2, 2.4), leaves, [x, 3.3, z]);
          addTrackedMesh(group, new THREE.BoxGeometry(1.8, 1, 1.8), leaves, [x, 4.2, z]);
        }
        const flowerColors = [0xff8fb1, 0xffe066, 0xffffff, 0xb39cff];
        for (let i = 0; i < 20; i++) {
          const x = rand(-38, 38);
          const z = rand(-38, 38);
          addTrackedMesh(group, new THREE.BoxGeometry(0.14, 0.6, 0.14), grass, [x, 0.3, z]);
          addTrackedMesh(
            group,
            new THREE.BoxGeometry(0.55, 0.55, 0.55),
            new THREE.MeshStandardMaterial({ color: flowerColors[i % flowerColors.length] }),
            [x, 0.8, z],
          );
        }
        // Un pequeño sendero de tierra hacia donde saluda Steve.
        for (let i = 0; i < 12; i++) {
          addTrackedMesh(
            group,
            new THREE.BoxGeometry(2.2, 0.12, 1.5),
            i % 3 === 0 ? stone : dirt,
            [0, 0.06, 9 - i * 1.3],
          );
        }

        // Ovejas que caminan y mueven las patas.
        for (let i = 0; i < 6; i++) {
          const animal = new THREE.Group();
          animal.position.set(rand(-28, 28), 0, rand(-28, 28));
          const wool = new THREE.MeshStandardMaterial({
            color: i % 2 ? 0xf5f0e6 : 0xc98b5e,
            roughness: 1,
          });
          addTrackedMesh(animal, new THREE.BoxGeometry(1.3, 0.75, 0.8), wool, [0, 0.75, 0]);
          addTrackedMesh(animal, new THREE.BoxGeometry(0.5, 0.5, 0.5), wool, [0.85, 0.95, 0]);
          addTrackedMesh(
            animal,
            new THREE.BoxGeometry(0.12, 0.1, 0.1),
            new THREE.MeshBasicMaterial({ color: 0x222222 }),
            [1.05, 1, 0.16],
          );
          const legs: THREE.Object3D[] = [];
          for (const dx of [-0.4, 0.4]) {
            for (const dz of [-0.25, 0.25]) {
              const pivot = new THREE.Group();
              pivot.position.set(dx, 0.42, dz);
              const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), wood);
              trackGeometry(leg.geometry);
              trackMaterial(wood);
              leg.position.y = -0.21;
              pivot.add(leg);
              animal.add(pivot);
              legs.push(pivot);
            }
          }
          group.add(animal);
          const driftX = rand(0.5, 1.3) * (i % 2 ? 1 : -1);
          const driftZ = rand(-0.25, 0.25);
          animal.rotation.y = Math.atan2(-driftZ, driftX);
          surfaceAnimations[body.id].push({
            object: animal,
            baseY: 0,
            speed: 1.4,
            amplitude: 0.03,
            driftX,
            driftZ,
            legs,
            walkSpeed: rand(5, 8),
            phase: rand(0, Math.PI * 2),
          });
        }

        // Nubes cúbicas que cruzan el cielo.
        const cloudMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
        for (let i = 0; i < 9; i++) {
          const cloud = new THREE.Group();
          cloud.position.set(rand(-55, 55), rand(10, 16), rand(-40, 40));
          const blocks = 3 + Math.floor(rand(0, 3));
          for (let b = 0; b < blocks; b++) {
            addTrackedMesh(
              cloud,
              new THREE.BoxGeometry(rand(2, 3.5), rand(1.2, 2), rand(2, 3)),
              cloudMaterial,
              [b * 1.8 - blocks * 0.9, rand(-0.4, 0.4), rand(-0.6, 0.6)],
            );
          }
          group.add(cloud);
          surfaceAnimations[body.id].push({
            object: cloud,
            baseY: cloud.position.y,
            speed: 0.5,
            amplitude: 0.25,
            driftX: rand(0.5, 1.2),
            driftZ: rand(-0.1, 0.1),
            phase: rand(0, Math.PI * 2),
          });
        }

        // Steve saluda a la cámara desde el sendero.
        const steve = new THREE.Group();
        steve.position.set(3.2, 0, 5.2);
        const skin = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 1 });
        const shirt = new THREE.MeshStandardMaterial({ color: 0x3aa6b9, roughness: 1 });
        const pants = new THREE.MeshStandardMaterial({ color: 0x3b4a8c, roughness: 1 });
        const hair = new THREE.MeshStandardMaterial({ color: 0x4a2f1d, roughness: 1 });
        const eye = new THREE.MeshBasicMaterial({ color: 0x244a8a });
        addTrackedMesh(steve, new THREE.BoxGeometry(0.6, 0.8, 0.32), shirt, [0, 1.15, 0]);
        addTrackedMesh(steve, new THREE.BoxGeometry(0.55, 0.55, 0.55), skin, [0, 1.9, 0]);
        addTrackedMesh(steve, new THREE.BoxGeometry(0.58, 0.18, 0.58), hair, [0, 2.18, 0]);
        addTrackedMesh(steve, new THREE.BoxGeometry(0.58, 0.38, 0.16), hair, [0, 1.98, -0.28]);
        for (const x of [-0.14, 0.14]) {
          addTrackedMesh(steve, new THREE.BoxGeometry(0.1, 0.12, 0.05), eye, [x, 1.95, 0.29]);
        }
        addTrackedMesh(steve, new THREE.BoxGeometry(0.22, 0.06, 0.05), hair, [0, 1.76, 0.29]);
        addTrackedMesh(steve, new THREE.BoxGeometry(0.18, 0.7, 0.18), skin, [-0.4, 1.15, 0]);
        const waveArm = new THREE.Group();
        waveArm.position.set(0.4, 1.5, 0);
        const raisedArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), skin);
        trackGeometry(raisedArm.geometry);
        trackMaterial(skin);
        raisedArm.position.y = -0.35;
        waveArm.add(raisedArm);
        waveArm.rotation.z = 2.4;
        steve.add(waveArm);
        for (const x of [-0.16, 0.16]) {
          addTrackedMesh(steve, new THREE.BoxGeometry(0.24, 0.7, 0.26), pants, [x, 0.35, 0]);
        }
        group.add(steve);
        surfaceAnimations[body.id].push({
          object: steve,
          baseY: 0,
          speed: 1.5,
          amplitude: 0.03,
          waveArm,
          waveSpeed: 6,
          phase: 0,
        });
        addBillboard(body.id, group, "¡Hola!", [3.2, 2.9, 5.2], 2.6, {
          amplitude: 0.12,
          speed: 1.5,
        });
      }

      if (body.id === "melodia") {
        const roomMat = new THREE.MeshStandardMaterial({
          color: 0x140b2b,
          roughness: 0.9,
        });
        const goldMat = new THREE.MeshStandardMaterial({
          color: 0xffd166,
          emissive: new THREE.Color(0x7a5a00),
          emissiveIntensity: 0.6,
          metalness: 0.7,
          roughness: 0.3,
        });
        const neonColors = [0x00f0ff, 0xff2bd6, 0xffd166, 0x8b5cff, 0x7cf6d2];

        // Sala: suelo oscuro, paredes laterales, fondo y techo.
        addTrackedMesh(
          group,
          new THREE.PlaneGeometry(60, 60),
          new THREE.MeshStandardMaterial({ color: 0x0c061c, roughness: 1 }),
          [0, -0.02, 0],
          [-Math.PI / 2, 0, 0],
        );
        addTrackedMesh(group, new THREE.BoxGeometry(46, 12, 0.6), roomMat, [0, 6, -23]);
        addTrackedMesh(group, new THREE.BoxGeometry(0.6, 12, 46), roomMat, [-23, 6, 0]);
        addTrackedMesh(group, new THREE.BoxGeometry(0.6, 12, 46), roomMat, [23, 6, 0]);
        addTrackedMesh(
          group,
          new THREE.PlaneGeometry(46, 46),
          roomMat,
          [0, 12, 0],
          [Math.PI / 2, 0, 0],
        );

        // Pista: la textura del planeta queda ENCIMA de la plataforma.
        addTrackedMesh(group, new THREE.CylinderGeometry(16, 16, 0.4, 64), roomMat, [0, -0.2, 0]);
        const floorTexture = trackTexture(makeBodyTexture(body));
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(3, 3);
        addTrackedMesh(
          group,
          new THREE.CircleGeometry(15.5, 64),
          new THREE.MeshStandardMaterial({
            map: floorTexture,
            emissive: new THREE.Color(body.accent),
            emissiveIntensity: 0.2,
            roughness: 0.45,
            metalness: 0.12,
            side: THREE.DoubleSide,
          }),
          [0, 0.02, 0],
          [-Math.PI / 2, 0, 0],
        );
        addTrackedMesh(
          group,
          new THREE.TorusGeometry(15.6, 0.2, 8, 80),
          goldMat,
          [0, 0.08, 0],
          [Math.PI / 2, 0, 0],
        );

        // Barras de neón en paredes y techo.
        for (let i = 0; i < neonColors.length; i++) {
          const color = neonColors[i];
          const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: new THREE.Color(color),
            emissiveIntensity: 1.7,
            roughness: 0.3,
          });
          addTrackedMesh(group, new THREE.BoxGeometry(0.5, 7, 0.25), mat, [-16 + i * 8, 4, -22.5]);
          addTrackedMesh(group, new THREE.BoxGeometry(0.25, 7, 0.5), mat, [-22.5, 4, -8 + i * 4]);
          addTrackedMesh(group, new THREE.BoxGeometry(0.25, 7, 0.5), mat, [22.5, 4, -8 + i * 4]);
          addTrackedMesh(group, new THREE.BoxGeometry(0.35, 0.25, 42), mat, [-16 + i * 8, 11.7, 0]);
        }

        // Iluminación de colores alrededor de la pista.
        for (let i = 0; i < neonColors.length; i++) {
          const angle = (i / neonColors.length) * Math.PI * 2;
          const light = new THREE.PointLight(neonColors[i], 26, 36, 2);
          light.position.set(Math.cos(angle) * 13, 4.8, Math.sin(angle) * 13);
          group.add(light);
          animatedLights.push({ light, base: 26, speed: 2.2, phase: i * 0.9 });
        }
        const centerLight = new THREE.PointLight(0xffffff, 20, 42, 2);
        centerLight.position.set(0, 10, 0);
        group.add(centerLight);
        animatedLights.push({ light: centerLight, base: 20, speed: 2.2, phase: 4.5 });

        // Neblina: nubes suaves que flotan sobre la pista.
        addHaze(body.id, group, ["#b39cff", "#ff8ac4", "#7cf6d2"], 14);

        // Haces de luz que giran desde el techo.
        for (let i = 0; i < 8; i++) {
          const color = neonColors[i % neonColors.length];
          const pivot = new THREE.Group();
          pivot.position.set(rand(-15, 15), 9.5, rand(-14, 10));
          const beam = new THREE.Mesh(
            trackGeometry(new THREE.ConeGeometry(1.6, 9, 16, 1, true)),
            trackMaterial(
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
              }),
            ),
          );
          beam.position.y = -4.5;
          pivot.add(beam);
          const bulb = new THREE.Mesh(
            trackGeometry(new THREE.SphereGeometry(0.22, 10, 8)),
            trackMaterial(new THREE.MeshBasicMaterial({ color })),
          );
          pivot.add(bulb);
          group.add(pivot);
          surfaceAnimations[body.id].push({
            object: pivot,
            baseY: 9.5,
            speed: 0.7,
            amplitude: 0.12,
            spin: rand(0.3, 0.7) * (i % 2 ? 1 : -1),
            phase: rand(0, Math.PI * 2),
          });
        }

        // Bola de espejos y altavoces.
        const discoBall = addTrackedMesh(
          group,
          new THREE.IcosahedronGeometry(1.6, 2),
          new THREE.MeshStandardMaterial({
            color: 0xdfe9ff,
            metalness: 0.95,
            roughness: 0.08,
          }),
          [0, 8, 0],
        );
        const ballGlow = new THREE.Sprite(
          trackMaterial(
            new THREE.SpriteMaterial({
              map: trackTexture(makeGlowTexture("#ffd166", 0.85)),
              transparent: true,
              opacity: 0.55,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            }),
          ),
        );
        ballGlow.scale.setScalar(6);
        discoBall.add(ballGlow);
        surfaceAnimations[body.id].push({
          object: discoBall,
          baseY: 8,
          speed: 0.9,
          amplitude: 0.3,
          spin: 0.7,
        });

        const speakerMat = new THREE.MeshStandardMaterial({ color: 0x191036, roughness: 0.7 });
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4 });
        for (const side of [-1, 1]) {
          for (const z of [-12, 6]) {
            addTrackedMesh(group, new THREE.BoxGeometry(2.4, 4, 1.8), speakerMat, [side * 19, 2, z]);
            addTrackedMesh(
              group,
              new THREE.CylinderGeometry(0.75, 0.75, 0.12, 24),
              coneMat,
              [side * 17.9, 2.4, z],
              [0, 0, Math.PI / 2],
            );
            addTrackedMesh(
              group,
              new THREE.CylinderGeometry(0.4, 0.4, 0.12, 20),
              coneMat,
              [side * 17.9, 1, z],
              [0, 0, Math.PI / 2],
            );
          }
        }
        for (const x of [-10, 0, 10]) {
          addTrackedMesh(
            group,
            new THREE.CylinderGeometry(2, 2, 0.12, 40),
            coneMat,
            [x, 5.5, -22.4],
            [Math.PI / 2, 0, 0],
          );
          addTrackedMesh(
            group,
            new THREE.CylinderGeometry(0.6, 0.6, 0.14, 32),
            goldMat,
            [x, 5.5, -22.3],
            [Math.PI / 2, 0, 0],
          );
        }

        const notes = ["♪", "♫", "♩", "♬"];
        for (let i = 0; i < 20; i++) {
          addBillboard(
            body.id,
            group,
            notes[i % notes.length],
            [rand(-18, 18), rand(1.6, 7), rand(-18, 12)],
            rand(1, 2.2),
            { speed: rand(0.8, 1.6), amplitude: rand(0.2, 0.5), spin: rand(-0.6, 0.6) },
          );
        }
        for (let i = 0; i < 14; i++) {
          const x = rand(-20, 20);
          const z = rand(-20, 12);
          addTrackedMesh(
            group,
            new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x7b5cff }),
            [x, 0.7, z],
          );
          addBillboard(body.id, group, "♪", [x, 1.6, z], 0.85, { amplitude: 0.12 });
        }
        addBillboard(body.id, group, "DISCO", [0, 9, -22.3], 5.5, {
          amplitude: 0.15,
          speed: 1,
        });
      }

      if (body.id === "ritmo") {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a0d24, roughness: 0.95 });
        const velvet = new THREE.MeshStandardMaterial({
          color: 0x7a0f3d,
          roughness: 0.95,
          emissive: new THREE.Color(0x2a0415),
          emissiveIntensity: 0.4,
        });
        const gold = new THREE.MeshStandardMaterial({
          color: 0xffd166,
          emissive: new THREE.Color(0x8a5e00),
          emissiveIntensity: 0.7,
          metalness: 0.7,
          roughness: 0.3,
        });

        // Sala de teatro: suelo, paredes, techo y butacas.
        addTrackedMesh(group, new THREE.PlaneGeometry(56, 60), wallMat, [0, -0.02, -2], [-Math.PI / 2, 0, 0]);
        addTrackedMesh(group, new THREE.BoxGeometry(40, 14, 0.6), wallMat, [0, 7, -20]);
        addTrackedMesh(group, new THREE.BoxGeometry(0.6, 14, 40), wallMat, [-20, 7, -2]);
        addTrackedMesh(group, new THREE.BoxGeometry(0.6, 14, 40), wallMat, [20, 7, -2]);
        addTrackedMesh(group, new THREE.PlaneGeometry(40, 40), wallMat, [0, 14, -2], [Math.PI / 2, 0, 0]);

        // Escenario: la textura del planeta queda sobre la tarima.
        addTrackedMesh(group, new THREE.BoxGeometry(20, 0.8, 12), wallMat, [0, 0.4, -10]);
        const stageTexture = trackTexture(makeBodyTexture(body));
        stageTexture.wrapS = THREE.RepeatWrapping;
        stageTexture.wrapT = THREE.RepeatWrapping;
        stageTexture.repeat.set(2, 2);
        addTrackedMesh(
          group,
          new THREE.PlaneGeometry(19.6, 11.6),
          new THREE.MeshStandardMaterial({
            map: stageTexture,
            emissive: new THREE.Color(body.accent),
            emissiveIntensity: 0.25,
            roughness: 0.5,
            metalness: 0.15,
          }),
          [0, 0.81, -10],
          [-Math.PI / 2, 0, 0],
        );
        addTrackedMesh(group, new THREE.BoxGeometry(20.4, 0.12, 0.3), gold, [0, 0.85, -3.9]);

        // Telón de fondo y pliegues de terciopelo.
        addTrackedMesh(group, new THREE.BoxGeometry(20, 10, 0.5), velvet, [0, 5, -15.8]);
        addTrackedMesh(group, new THREE.BoxGeometry(21, 1.6, 0.7), velvet, [0, 9.3, -15.3]);
        for (let i = 0; i < 9; i++) {
          addTrackedMesh(group, new THREE.BoxGeometry(0.22, 9.6, 0.3), velvet, [-8 + i * 2, 5, -15.4]);
        }
        for (const side of [-1, 1]) {
          addTrackedMesh(group, new THREE.BoxGeometry(3, 10, 0.7), velvet, [side * 10.4, 5, -12]);
        }
        const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
        for (let i = 0; i < 11; i++) {
          addTrackedMesh(group, new THREE.SphereGeometry(0.16, 10, 8), bulbMat, [-9 + i * 1.8, 0.95, -3.8]);
        }

        // Público sentado en gradas (con pasillo central).
        const skinTones = [0xf1c27d, 0xc68642, 0x8d5524, 0xffe0bd];
        const outfitColors = [0x2a1b4d, 0x6b2d5c, 0x1f4d5c, 0x4a3b7a, 0x7a3b2e];
        const seatMat = new THREE.MeshStandardMaterial({ color: 0x3d1230, roughness: 0.9 });
        for (let row = 0; row < 5; row++) {
          const z = -1.5 + row * 3.4;
          const y = 0.65 + row * 0.22;
          for (let col = 0; col < 11; col++) {
            if (col === 5) continue;
            const x = (col - 5) * 2.6;
            addTrackedMesh(group, new THREE.BoxGeometry(1.1, 0.25, 1), seatMat, [x, y, z]);
            addTrackedMesh(group, new THREE.BoxGeometry(1.1, 1.1, 0.2), seatMat, [x, y + 0.65, z + 0.45]);
            const spectator = new THREE.Group();
            spectator.position.set(x, y + 0.15, z);
            addTrackedMesh(
              spectator,
              new THREE.BoxGeometry(0.55, 0.7, 0.35),
              new THREE.MeshStandardMaterial({
                color: outfitColors[(row + col) % outfitColors.length],
              }),
              [0, 0.35, 0],
            );
            addTrackedMesh(
              spectator,
              new THREE.SphereGeometry(0.22, 12, 10),
              new THREE.MeshStandardMaterial({ color: skinTones[(row * 3 + col) % skinTones.length] }),
              [0, 0.9, 0],
            );
            group.add(spectator);
            surfaceAnimations[body.id].push({
              object: spectator,
              baseY: y + 0.15,
              speed: rand(1, 2.2),
              amplitude: rand(0.02, 0.06),
              spin: rand(-0.12, 0.12),
              phase: rand(0, Math.PI * 2),
            });
          }
        }

        // Focos, haces y luces de colores sobre el escenario.
        const spotColors = [0xff2bd6, 0x00f0ff, 0xffd166, 0xb39cff, 0x7cf6d2, 0xff8ac4];
        for (let i = 0; i < spotColors.length; i++) {
          const color = spotColors[i];
          const x = -8 + i * 3.2;
          const pivot = new THREE.Group();
          pivot.position.set(x, 12, -8);
          const beam = new THREE.Mesh(
            trackGeometry(new THREE.ConeGeometry(1.8, 11, 16, 1, true)),
            trackMaterial(
              new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity: 0.1,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                side: THREE.DoubleSide,
              }),
            ),
          );
          beam.position.y = -5.5;
          pivot.add(beam);
          pivot.add(
            new THREE.Mesh(
              trackGeometry(new THREE.SphereGeometry(0.22, 10, 8)),
              trackMaterial(new THREE.MeshBasicMaterial({ color })),
            ),
          );
          group.add(pivot);
          surfaceAnimations[body.id].push({
            object: pivot,
            baseY: 12,
            speed: 0.6,
            amplitude: 0.15,
            spin: rand(0.25, 0.6) * (i % 2 ? 1 : -1),
            phase: rand(0, Math.PI * 2),
          });
          const light = new THREE.PointLight(color, 30, 34, 2);
          light.position.set(x, 7, -9);
          group.add(light);
          animatedLights.push({ light, base: 30, speed: 2 + i * 0.2, phase: i * 0.8 });
        }
        const stageLight = new THREE.PointLight(0xffffff, 24, 40, 2);
        stageLight.position.set(0, 7, -6);
        group.add(stageLight);
        animatedLights.push({ light: stageLight, base: 24, speed: 1.6, phase: 0 });

        // Neblina ambiental y destellos.
        addHaze(body.id, group, ["#ff8ac4", "#b39cff", "#7cf6d2"], 12);
        for (let i = 0; i < 10; i++) {
          addBillboard(
            body.id,
            group,
            "✨",
            [rand(-10, 10), rand(3, 8), rand(-15, -2)],
            rand(0.6, 1.2),
            { amplitude: 0.3, speed: rand(0.6, 1.4) },
          );
        }
        addBillboard(body.id, group, "DANZA", [0, 11.2, -15.3], 4.5, {
          amplitude: 0.12,
          speed: 1,
        });

        // Bailarina de danza moderna/contemporánea, con brazos y piernas articulados.
        const dancer = new THREE.Group();
        dancer.position.set(0, 1.7, -10);
        const skin = new THREE.MeshStandardMaterial({ color: 0xe8b58f, roughness: 0.9 });
        const leotard = new THREE.MeshStandardMaterial({ color: 0x2a1b4d, roughness: 0.7 });
        const accent = new THREE.MeshStandardMaterial({
          color: 0xff2bd6,
          emissive: new THREE.Color(0x5a0838),
          emissiveIntensity: 0.5,
          roughness: 0.5,
        });
        const hair = new THREE.MeshStandardMaterial({ color: 0x241a2b, roughness: 1 });

        const torso = new THREE.Group();
        dancer.add(torso);
        addTrackedMesh(torso, new THREE.CylinderGeometry(0.28, 0.22, 0.85, 12), leotard, [0, 0.5, 0]);
        addTrackedMesh(torso, new THREE.BoxGeometry(0.62, 0.14, 0.34), accent, [0, 0.12, 0]);
        const head = new THREE.Group();
        head.position.set(0, 1.02, 0);
        torso.add(head);
        addTrackedMesh(head, new THREE.SphereGeometry(0.24, 16, 12), skin, [0, 0.2, 0]);
        addTrackedMesh(head, new THREE.SphereGeometry(0.16, 12, 10), hair, [0, 0.38, -0.12]);
        const arms: THREE.Group[] = [];
        for (const side of [-1, 1]) {
          const arm = new THREE.Group();
          arm.position.set(side * 0.3, 0.85, 0);
          addTrackedMesh(arm, new THREE.CylinderGeometry(0.07, 0.06, 0.72, 8), skin, [0, -0.36, 0]);
          addTrackedMesh(arm, new THREE.SphereGeometry(0.09, 10, 8), skin, [0, -0.72, 0]);
          torso.add(arm);
          arms.push(arm);
        }
        const legs: THREE.Group[] = [];
        for (const side of [-1, 1]) {
          const leg = new THREE.Group();
          leg.position.set(side * 0.14, 0.12, 0);
          addTrackedMesh(leg, new THREE.CylinderGeometry(0.11, 0.08, 0.9, 10), skin, [0, -0.45, 0]);
          addTrackedMesh(leg, new THREE.BoxGeometry(0.18, 0.08, 0.34), accent, [0, -0.94, 0.1]);
          dancer.add(leg);
          legs.push(leg);
        }
        group.add(dancer);
        surfaceAnimations[body.id].push({
          object: dancer,
          baseY: 1.7,
          speed: 1,
          amplitude: 0,
          dance: { torso, head, arms, legs },
          danceSpeed: 1.6,
        });
      }

      if (body.id === "memoria") {
        // Árboles grandes y abundantes que enmarcan el jardín.
        const bark = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
        const leafTones = [0x2e7d32, 0x3c8f3e, 0x4a9f46, 0x256c2e];
        for (let i = 0; i < 26; i++) {
          const angle = (i / 26) * Math.PI * 2 + rand(-0.1, 0.1);
          const radius = rand(16, 44);
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          if (z > 5 && Math.abs(x) < 9) continue;
          const height = rand(5, 9);
          const crown = rand(2.6, 4);
          const foliage = new THREE.MeshStandardMaterial({
            color: leafTones[i % leafTones.length],
            roughness: 1,
          });
          addTrackedMesh(
            group,
            new THREE.CylinderGeometry(0.28, 0.5, height, 8),
            bark,
            [x, height / 2, z],
          );
          for (let layer = 0; layer < 3; layer++) {
            addTrackedMesh(
              group,
              new THREE.IcosahedronGeometry(crown * (1 - layer * 0.16), 1),
              foliage,
              [x + rand(-0.4, 0.4), height + layer * 1.5, z + rand(-0.4, 0.4)],
            );
          }
        }

        // Nubes redondas que cruzan el cielo.
        const cloudMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 1,
          emissive: new THREE.Color(0x2a2a35),
          emissiveIntensity: 0.3,
        });
        for (let i = 0; i < 10; i++) {
          const cloud = new THREE.Group();
          cloud.position.set(rand(-50, 50), rand(14, 22), rand(-45, 40));
          const puffs = 4 + Math.floor(rand(0, 3));
          for (let p = 0; p < puffs; p++) {
            addTrackedMesh(
              cloud,
              new THREE.SphereGeometry(rand(1.6, 3.2), 12, 10),
              cloudMat,
              [(p - puffs / 2) * 2.2, rand(-0.6, 0.6), rand(-0.6, 0.6)],
            );
          }
          group.add(cloud);
          surfaceAnimations[body.id].push({
            object: cloud,
            baseY: cloud.position.y,
            speed: rand(0.15, 0.35),
            amplitude: rand(0.2, 0.5),
            driftX: rand(0.6, 1.4) * (i % 2 ? 1 : -1),
            driftZ: rand(-0.15, 0.15),
            phase: rand(0, Math.PI * 2),
          });
        }

        // Pasto 3D que se mece con el viento.
        const bladeGeometry = trackGeometry(new THREE.ConeGeometry(0.07, 0.9, 4));
        const bladeMaterials = [0x4f9e3f, 0x69b34a, 0x7ec257].map(
          (color) =>
            trackMaterial(
              new THREE.MeshStandardMaterial({ color, roughness: 1 }),
            ),
        );
        for (let i = 0; i < 170; i++) {
          const x = rand(-36, 36);
          const z = rand(-36, 36);
          if (Math.hypot(x + 12, z + 6) < 6 || (Math.abs(x) < 3 && z > 5 && z < 10)) {
            continue;
          }
          const tuft = new THREE.Group();
          tuft.position.set(x, 0, z);
          for (let blade = 0; blade < 3; blade++) {
            const mesh = new THREE.Mesh(bladeGeometry, bladeMaterials[blade]);
            mesh.position.set((blade - 1) * 0.12, 0.45, rand(-0.12, 0.12));
            mesh.rotation.z = (blade - 1) * 0.28;
            tuft.add(mesh);
          }
          group.add(tuft);
          surfaceAnimations[body.id].push({
            object: tuft,
            baseY: 0,
            speed: 0,
            amplitude: 0,
            windPhase: rand(0, Math.PI * 2),
            windSpeed: rand(1.2, 2.2),
            windStrength: rand(0.12, 0.3),
          });
        }

        // Luz cálida que acaricia el banco y el estanque.
        const warmSun = new THREE.PointLight(0xffe3b0, 48, 70, 2);
        warmSun.position.set(4, 14, 10);
        group.add(warmSun);
        animatedLights.push({ light: warmSun, base: 48, speed: 0.7, phase: 1.2 });

        const wood = new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.9 });
        addTrackedMesh(group, new THREE.BoxGeometry(4.5, 0.25, 1.1), wood, [0, 1.1, 7]);
        addTrackedMesh(group, new THREE.BoxGeometry(4.5, 1.1, 0.25), wood, [0, 1.7, 6.5]);
        for (const x of [-1.8, 1.8]) {
          addTrackedMesh(group, new THREE.BoxGeometry(0.3, 1.1, 0.9), wood, [x, 0.55, 7]);
        }

        // Un abuelo sentado en la banca que saluda con la mano.
        const elder = new THREE.Group();
        elder.position.set(-0.75, 1.23, 7.05);
        const cardigan = new THREE.MeshStandardMaterial({ color: 0x8a7fa8, roughness: 0.95 });
        const trousers = new THREE.MeshStandardMaterial({ color: 0x4d5870, roughness: 0.95 });
        const elderSkin = new THREE.MeshStandardMaterial({ color: 0xe8b58f, roughness: 0.9 });
        const greyHair = new THREE.MeshStandardMaterial({ color: 0xd8d8dc, roughness: 1 });
        const glasses = new THREE.MeshStandardMaterial({ color: 0x2b2b35, metalness: 0.4, roughness: 0.4 });
        addTrackedMesh(elder, new THREE.BoxGeometry(0.72, 0.8, 0.42), cardigan, [0, 0.45, 0]);
        const elderHead = addTrackedMesh(
          elder,
          new THREE.SphereGeometry(0.26, 16, 12),
          elderSkin,
          [0, 1.05, 0],
        );
        elderHead.scale.set(1, 1.08, 0.95);
        addTrackedMesh(elder, new THREE.SphereGeometry(0.27, 16, 12), greyHair, [0, 1.2, -0.02]).scale.set(1, 0.55, 1);
        addTrackedMesh(elder, new THREE.SphereGeometry(0.15, 12, 10), greyHair, [0, 0.9, 0.2]);
        for (const x of [-0.11, 0.11]) {
          addTrackedMesh(elder, new THREE.TorusGeometry(0.075, 0.015, 6, 16), glasses, [x, 1.07, 0.25]);
        }
        addTrackedMesh(elder, new THREE.BoxGeometry(0.03, 0.015, 0.02), glasses, [0, 1.07, 0.26]);
        addTrackedMesh(
          elder,
          new THREE.BoxGeometry(0.15, 0.55, 0.15),
          cardigan,
          [-0.45, 0.48, 0.06],
          [0, 0, -0.18],
        );
        for (const x of [-0.18, 0.18]) {
          addTrackedMesh(elder, new THREE.BoxGeometry(0.23, 0.23, 0.7), trousers, [x, 0.02, 0.35]);
          addTrackedMesh(elder, new THREE.BoxGeometry(0.22, 0.62, 0.22), trousers, [x, -0.3, 0.64]);
          addTrackedMesh(elder, new THREE.BoxGeometry(0.26, 0.12, 0.38), glasses, [x, -0.64, 0.72]);
        }
        const waveArm = new THREE.Group();
        waveArm.position.set(0.45, 0.75, 0);
        addTrackedMesh(waveArm, new THREE.BoxGeometry(0.15, 0.6, 0.15), cardigan, [0, -0.3, 0]);
        addTrackedMesh(waveArm, new THREE.SphereGeometry(0.1, 10, 8), elderSkin, [0, -0.65, 0]);
        waveArm.rotation.z = 2.4;
        elder.add(waveArm);
        group.add(elder);
        surfaceAnimations[body.id].push({
          object: elder,
          baseY: 1.23,
          speed: 0.8,
          amplitude: 0.02,
          waveArm,
          waveSpeed: 5,
        });
        addBillboard(body.id, group, "¡Hola!", [-0.75, 2.8, 7], 2.2, {
          amplitude: 0.12,
          speed: 1.4,
        });
        addTrackedMesh(
          group,
          new THREE.CylinderGeometry(0.045, 0.045, 1.7, 8),
          wood,
          [1.95, 0.85, 7.5],
          [0, 0, 0.12],
        );

        addTrackedMesh(
          group,
          new THREE.CircleGeometry(5.5, 48),
          new THREE.MeshStandardMaterial({ color: 0x8fc9d6, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.85 }),
          [-12, 0.12, -6],
          [-Math.PI / 2, 0, 0],
        );
        const lampMat = new THREE.MeshStandardMaterial({
          color: 0xffe0a3,
          emissive: new THREE.Color(0xffb703),
          emissiveIntensity: 0.9,
        });
        for (const x of [-7, 7]) {
          addTrackedMesh(group, new THREE.CylinderGeometry(0.12, 0.16, 4, 10), wood, [x, 2, 10]);
          addTrackedMesh(group, new THREE.SphereGeometry(0.5, 16, 12), lampMat, [x, 4.2, 10]);
        }
        const petalColors = [0xf3d9b1, 0xffc0cb, 0xffffff, 0xc9a7c7];
        for (let i = 0; i < 34; i++) {
          const x = rand(-26, 26);
          const z = rand(-26, 26);
          const height = rand(0.7, 1.4);
          addTrackedMesh(
            group,
            new THREE.CylinderGeometry(0.05, 0.05, height, 6),
            new THREE.MeshStandardMaterial({ color: 0x5b8c3b }),
            [x, height / 2, z],
          );
          const petalMat = new THREE.MeshStandardMaterial({ color: petalColors[i % petalColors.length] });
          for (let p = 0; p < 5; p++) {
            const angle = (p / 5) * Math.PI * 2;
            addTrackedMesh(
              group,
              new THREE.SphereGeometry(0.22, 10, 8),
              petalMat,
              [x + Math.cos(angle) * 0.28, height + 0.1, z + Math.sin(angle) * 0.28],
            );
          }
        }
        for (let i = 0; i < 12; i++) {
          addBillboard(
            body.id,
            group,
            "🦋",
            [rand(-20, 20), rand(1.4, 4), rand(-20, 20)],
            rand(0.7, 1.2),
            { speed: rand(0.7, 1.4), amplitude: rand(0.3, 0.7), spin: rand(-0.8, 0.8) },
          );
        }
        addBillboard(body.id, group, "🐈", [2.5, 0.7, 9], 1.6, { amplitude: 0.08 });
      }

      if (body.id === "sushi") {
        const nori = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.9 });
        const rice = new THREE.MeshStandardMaterial({ color: 0xfffdf5, roughness: 1 });
        const salmon = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.6 });

        // Mar con olas: la textura del planeta es ahora el océano.
        const waterGeometry = trackGeometry(new THREE.PlaneGeometry(200, 200, 64, 64));
        waterGeometry.userData.base = Float32Array.from(
          (waterGeometry.attributes.position as THREE.BufferAttribute).array as Float32Array,
        );
        const waterTexture = trackTexture(makeBodyTexture(body));
        waterTexture.wrapS = THREE.RepeatWrapping;
        waterTexture.wrapT = THREE.RepeatWrapping;
        waterTexture.repeat.set(6, 6);
        const water = new THREE.Mesh(
          waterGeometry,
          trackMaterial(
            new THREE.MeshStandardMaterial({
              map: waterTexture,
              roughness: 0.42,
              metalness: 0.18,
              emissive: new THREE.Color(0x06344f),
              emissiveIntensity: 0.25,
            }),
          ),
        );
        water.rotation.x = -Math.PI / 2;
        group.add(water);
        sushiWater = water;

        addClouds(body.id, group, 9);

        // Barco-restaurante flotando en el mar.
        const boat = new THREE.Group();
        boat.position.y = 0.3;
        const hullMat = new THREE.MeshStandardMaterial({ color: 0x5b3524, roughness: 0.85 });
        const deckMat = new THREE.MeshStandardMaterial({ color: 0xa9703f, roughness: 0.8 });
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xb23a3a, roughness: 0.8 });
        const paperMat = new THREE.MeshStandardMaterial({
          color: 0xfff2d8,
          roughness: 0.9,
          emissive: new THREE.Color(0x3a2a10),
          emissiveIntensity: 0.3,
        });
        addTrackedMesh(boat, new THREE.BoxGeometry(8.4, 1.6, 15), hullMat, [0, 0, 0]);
        addTrackedMesh(boat, new THREE.BoxGeometry(8.8, 0.28, 15.4), deckMat, [0, 0.9, 0]);
        addTrackedMesh(boat, new THREE.ConeGeometry(2.2, 3.4, 4), hullMat, [0, 0.1, 8.4], [Math.PI / 2, Math.PI / 4, 0]);
        for (const side of [-1, 1]) {
          addTrackedMesh(boat, new THREE.BoxGeometry(0.18, 0.5, 15), deckMat, [side * 4.2, 1.3, 0]);
        }

        // Comedor: suelo, papeles, techo y cortina de entrada.
        addTrackedMesh(boat, new THREE.BoxGeometry(7.4, 0.2, 11), deckMat, [0, 1.12, -1]);
        addTrackedMesh(boat, new THREE.BoxGeometry(7.4, 3, 0.25), paperMat, [0, 2.7, -6.2]);
        for (const side of [-1, 1]) {
          addTrackedMesh(boat, new THREE.BoxGeometry(0.25, 2.6, 5), paperMat, [side * 3.5, 2.5, -3.5]);
        }
        addTrackedMesh(boat, new THREE.BoxGeometry(9, 0.35, 13), roofMat, [0, 4.4, -1]);
        addTrackedMesh(boat, new THREE.BoxGeometry(9.4, 0.2, 1.2), roofMat, [0, 4.7, -1]);
        for (let i = 0; i < 5; i++) {
          addTrackedMesh(boat, new THREE.BoxGeometry(1.3, 1.1, 0.12), roofMat, [-2.6 + i * 1.3, 3.7, 5.4]);
        }

        // Mostrador con sushi y taburetes.
        addTrackedMesh(boat, new THREE.BoxGeometry(6.4, 0.25, 1.8), deckMat, [0, 2.2, 1.2]);
        for (const x of [-2.8, 2.8]) {
          addTrackedMesh(boat, new THREE.BoxGeometry(0.2, 1.1, 1.6), hullMat, [x, 1.65, 1.2]);
        }
        for (const x of [-2.4, -0.8, 0.8, 2.4]) {
          addTrackedMesh(boat, new THREE.CylinderGeometry(0.22, 0.22, 0.32, 16), nori, [x, 2.5, 1.2]);
          addTrackedMesh(boat, new THREE.CylinderGeometry(0.16, 0.16, 0.34, 16), salmon, [x, 2.52, 1.2]);
          addTrackedMesh(boat, new THREE.CylinderGeometry(0.45, 0.45, 0.18, 16), hullMat, [x, 1.5, 3.2]);
          addTrackedMesh(boat, new THREE.CylinderGeometry(0.12, 0.12, 0.5, 10), hullMat, [x, 1.25, 3.2]);
        }
        addTrackedMesh(boat, new THREE.CylinderGeometry(0.2, 0.2, 1.4, 12), new THREE.MeshStandardMaterial({ color: 0x5b9b4a }), [3.1, 1.9, -4.8]);
        addTrackedMesh(boat, new THREE.SphereGeometry(0.35, 12, 10), rice, [0, 2.7, -4]);

        // Chef detrás del mostrador, con su globo de feliz cumpleaños.
        const chef = new THREE.Group();
        chef.position.set(0, 1.25, -0.6);
        const uniform = new THREE.MeshStandardMaterial({ color: 0xfff8ef, roughness: 0.9 });
        const chefSkin = new THREE.MeshStandardMaterial({ color: 0xe8b58f, roughness: 0.9 });
        addTrackedMesh(chef, new THREE.BoxGeometry(0.95, 1.2, 0.6), uniform, [0, 0.6, 0]);
        addTrackedMesh(chef, new THREE.SphereGeometry(0.3, 16, 12), chefSkin, [0, 1.45, 0]);
        addTrackedMesh(chef, new THREE.CylinderGeometry(0.34, 0.34, 0.55, 16), uniform, [0, 1.95, 0]);
        addTrackedMesh(chef, new THREE.CylinderGeometry(0.38, 0.38, 0.12, 16), uniform, [0, 1.72, 0]);
        for (const side of [-1, 1]) {
          addTrackedMesh(chef, new THREE.BoxGeometry(0.18, 0.8, 0.18), uniform, [side * 0.58, 0.7, 0.15], [0, 0, side * 0.3]);
        }
        boat.add(chef);
        const speech = new THREE.Sprite(
          trackMaterial(
            new THREE.SpriteMaterial({
              map: trackTexture(makeSpeechTexture("¡Feliz cumpleaños!")),
              transparent: true,
              depthWrite: false,
            }),
          ),
        );
        speech.position.set(0, 6.3, -0.6);
        speech.scale.set(9, 2.53, 1);
        boat.add(speech);

        // Linternas cálidas que iluminan el comedor.
        const lanternMat = new THREE.MeshStandardMaterial({
          color: 0xff6b5e,
          emissive: new THREE.Color(0xff3b2f),
          emissiveIntensity: 1.2,
          roughness: 0.6,
        });
        for (const x of [-3, 3]) {
          for (const z of [-5, 4]) {
            addTrackedMesh(boat, new THREE.CylinderGeometry(0.35, 0.35, 0.7, 12), lanternMat, [x, 3.5, z]);
            const light = new THREE.PointLight(0xffb08a, 18, 18, 2);
            light.position.set(x, 3.4, z);
            boat.add(light);
            animatedLights.push({
              light,
              base: 18,
              speed: 1.2 + rand(0, 0.5),
              phase: rand(0, 6),
            });
          }
        }

        // Peces que saltan alrededor del barco.
        for (let i = 0; i < 8; i++) {
          addBillboard(
            body.id,
            group,
            "🐟",
            [rand(-20, 20), rand(1.2, 4), rand(-20, 20)],
            rand(1, 1.8),
            { speed: rand(0.8, 1.5), amplitude: rand(0.25, 0.6), spin: rand(-0.5, 0.5) },
          );
        }
        group.add(boat);
        sushiBoat = boat;
      }

      scene.add(group);
      return group;
    };

    const surfaceGroups: Record<string, THREE.Group> = {};
    PLANETS.forEach((body) => {
      surfaceGroups[body.id] = buildSurface(body);
    });

    const enterSurface = (bodyId: string) => {
      viewModeRef.current = "surface";
      setViewMode("surface");
      setVisitingId(bodyId);
      solarGroup.visible = false;
      Object.entries(surfaceGroups).forEach(([id, group]) => {
        group.visible = id === bodyId;
      });
      const sky = new THREE.Color(surfaceSky[bodyId] ?? "#05060f");
      scene.background = sky;
      scene.fog = new THREE.FogExp2(
        sky,
        bodyId === "melodia" ? 0.032 : bodyId === "ritmo" ? 0.028 : 0.012,
      );
      ship.visible = false;
      travel = null;
      activeSurfaceId = bodyId;
      controls.enabled = true;
      controls.minDistance = 3;
      controls.maxDistance = 32;
      if (bodyId === "ritmo") {
        controls.target.set(0, 2.2, -6);
        camera.position.set(0, 6, 18);
        controls.maxDistance = 46;
      } else if (bodyId === "sushi") {
        controls.target.set(0, 2, 0);
        camera.position.set(0, 6, 23);
        controls.maxDistance = 50;
      } else {
        controls.target.set(0, 1.4, 0);
        camera.position.set(0, 4.5, 13);
      }
      controls.update();
      fadeValue = 1;
    };

    const leaveSurface = () => {
      solarGroup.visible = true;
      Object.values(surfaceGroups).forEach((group) => {
        group.visible = false;
      });
      scene.background = spaceBackground;
      scene.fog = spaceFog;
      activeSurfaceId = null;
      viewModeRef.current = "space";
      setViewMode("space");
      setVisitingId(null);
      controls.minDistance = 8;
      controls.maxDistance = 72;
      controls.target.set(0, 0, 0);
      camera.position.set(0, 19, 38);
      controls.update();
    };

    requestReturnRef.current = () => {
      pendingReturn = true;
    };

    startTravelRef.current = (bodyId: string) => {
      if (travel || viewModeRef.current !== "space") return;
      const runtimeBody = runtime.find((item) => item.data.id === bodyId);
      if (!runtimeBody) return;
      scene.updateMatrixWorld(true);
      const target = runtimeBody.mesh.getWorldPosition(new THREE.Vector3());
      target.y += runtimeBody.data.radius * 1.25;
      const toTarget = target.clone().sub(camera.position).normalize();
      const start = camera.position
        .clone()
        .addScaledVector(toTarget, 6)
        .add(new THREE.Vector3(0, -1.6, 0));
      const mid = start.clone().add(target).multiplyScalar(0.5);
      const control = mid.add(new THREE.Vector3(0, rand(6, 11), rand(-3, 3)));
      travel = {
        bodyId,
        progress: 0,
        duration: 3.6,
        curve: new THREE.QuadraticBezierCurve3(start, control, target),
      };
      viewModeRef.current = "traveling";
      setViewMode("traveling");
      setVisitingId(bodyId);
      controls.enabled = false;
      ship.visible = true;
      if (progressRef.current) progressRef.current.style.width = "0%";
    };

    const pickableMeshes = runtime.map((body) => body.mesh);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerDown = { x: 0, y: 0 };

    const setHover = (id: string | null) => {
      if (hoveredRef.current === id) return;
      hoveredRef.current = id;
      renderer.domElement.style.cursor = id ? "pointer" : "grab";
    };
    setHoverRef.current = setHover;

    const pick = (event: PointerEvent) => {
      if (viewModeRef.current !== "space") return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      scene.updateMatrixWorld();
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickableMeshes, false)[0];
      return (hit?.object.userData.bodyId as string | undefined) ?? null;
    };

    const handlePointerMove = (event: PointerEvent) => setHover(pick(event));
    const handlePointerDown = (event: PointerEvent) => {
      pointerDown.x = event.clientX;
      pointerDown.y = event.clientY;
      renderer.domElement.style.cursor = "grabbing";
    };
    const handlePointerUp = (event: PointerEvent) => {
      const moved = Math.hypot(
        event.clientX - pointerDown.x,
        event.clientY - pointerDown.y,
      );
      renderer.domElement.style.cursor = hoveredRef.current ? "pointer" : "grab";
      if (moved < 7 && hoveredRef.current) selectBody(hoveredRef.current);
    };
    const handlePointerLeave = () => setHover(null);

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    const handleResize = () => {
      const width = mount.clientWidth;
      const height = Math.max(mount.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    const clock = new THREE.Clock();
    let frameId = 0;
    const cometPosition = new THREE.Vector3();
    const cometNext = new THREE.Vector3();
    const cometDirection = new THREE.Vector3();
    const cometQuaternion = new THREE.Quaternion();
    const travelPosition = new THREE.Vector3();
    const travelTangent = new THREE.Vector3();
    const cameraGoal = new THREE.Vector3();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const time = clock.getElapsedTime();
      const factor =
        pausedRef.current || viewModeRef.current !== "space" ? 0 : 1;

      runtime.forEach((body) => {
        if (body.data.orbitRadius > 0) {
          body.angle += body.data.orbitSpeed * delta * factor;
          body.mesh.position.set(
            Math.cos(body.angle) * body.data.orbitRadius,
            0,
            Math.sin(body.angle) * body.data.orbitRadius,
          );
        }
        body.mesh.rotation.y += body.data.spinSpeed * delta * factor;

        const targetScale =
          body.data.id === selectedRef.current
            ? 1.22
            : body.data.id === hoveredRef.current
              ? 1.12
              : 1;
        body.mesh.scale.setScalar(
          THREE.MathUtils.lerp(body.mesh.scale.x, targetScale, 0.12),
        );

        if (body.atmosphere) {
          const targetOpacity =
            body.atmosphereOpacity +
            (targetScale > 1 ? 0.16 : 0) +
            Math.sin(time * 1.8 + body.angle) * 0.025;
          body.atmosphere.material.opacity = THREE.MathUtils.lerp(
            body.atmosphere.material.opacity,
            targetOpacity,
            0.1,
          );
        }
      });

      comets.forEach((comet) => {
        comet.progress += comet.speed * delta * factor;
        if (comet.progress >= 1) resetComet(comet);

        const t = comet.progress;
        cometPosition
          .copy(comet.start)
          .lerp(comet.end, t)
          .addScaledVector(comet.axis, Math.sin(t * Math.PI) * comet.amplitude);
        const nextT = Math.min(t + 0.01, 1);
        cometNext
          .copy(comet.start)
          .lerp(comet.end, nextT)
          .addScaledVector(
            comet.axis,
            Math.sin(nextT * Math.PI) * comet.amplitude,
          );
        cometDirection.copy(cometNext).sub(cometPosition);
        if (cometDirection.lengthSq() < 0.000001) {
          cometDirection.copy(comet.end).sub(comet.start);
        }
        cometDirection.normalize();
        cometQuaternion.setFromUnitVectors(worldUp, cometDirection);

        const fade = Math.sin(t * Math.PI);
        comet.head.position.copy(cometPosition);
        comet.head.material.opacity = fade;
        comet.glow.material.opacity = 0.9 * fade;
        comet.tail.position
          .copy(cometPosition)
          .addScaledVector(cometDirection, -comet.length / 2);
        comet.tail.quaternion.copy(cometQuaternion);
        comet.tail.material.opacity = 0.24 * fade;
        comet.tailCore.position
          .copy(cometPosition)
          .addScaledVector(cometDirection, -comet.coreLength / 2);
        comet.tailCore.quaternion.copy(cometQuaternion);
        comet.tailCore.material.opacity = 0.32 * fade;
      });

      if (viewModeRef.current === "traveling" && travel) {
        travel.progress += delta / travel.duration;
        const t = Math.min(travel.progress, 1);
        const eased = t * t * (3 - 2 * t);
        travel.curve.getPoint(eased, travelPosition);
        travel.curve.getTangent(eased, travelTangent).normalize();

        ship.position.copy(travelPosition);
        ship.quaternion.setFromUnitVectors(shipUp, travelTangent);
        flame.scale.y = 0.85 + Math.sin(time * 22) * 0.18;
        flameGlow.scale.setScalar(1.7 + Math.sin(time * 18) * 0.3);

        cameraGoal
          .copy(travelPosition)
          .addScaledVector(travelTangent, -6);
        cameraGoal.y += 2.6;
        camera.position.lerp(cameraGoal, 0.09);
        controls.target.lerp(travelPosition, 0.13);

        if (progressRef.current) {
          progressRef.current.style.width = `${(t * 100).toFixed(1)}%`;
        }
        const fadeTarget = t > 0.84 ? (t - 0.84) / 0.16 : 0;
        fadeValue = THREE.MathUtils.lerp(fadeValue, fadeTarget, 0.18);
        if (t >= 1) enterSurface(travel.bodyId);
      }

      if (viewModeRef.current === "surface" && activeSurfaceId) {
        const animations = surfaceAnimations[activeSurfaceId] ?? [];
        animations.forEach((animation) => {
          const phase = animation.phase ?? 0;
          if (animation.driftX) {
            animation.object.position.x += animation.driftX * delta;
            if (animation.object.position.x > 56) animation.object.position.x = -56;
            if (animation.object.position.x < -56) animation.object.position.x = 56;
          }
          if (animation.driftZ) {
            animation.object.position.z += animation.driftZ * delta;
            if (animation.object.position.z > 46) animation.object.position.z = -46;
            if (animation.object.position.z < -46) animation.object.position.z = 46;
          }
          animation.object.position.y =
            animation.baseY + Math.sin(time * animation.speed + phase) * animation.amplitude;
          if (animation.legs && animation.walkSpeed) {
            const walkSpeed = animation.walkSpeed;
            animation.legs.forEach((leg, index) => {
              leg.rotation.x =
                Math.sin(time * walkSpeed + phase + (index % 2 ? Math.PI : 0)) * 0.4;
            });
          }
          if (animation.waveArm && animation.waveSpeed) {
            animation.waveArm.rotation.z =
              2.4 + Math.sin(time * animation.waveSpeed) * 0.28;
          }
          if (animation.windSpeed && animation.windStrength) {
            const windPhase = animation.windPhase ?? 0;
            animation.object.rotation.z =
              Math.sin(time * animation.windSpeed + windPhase) * animation.windStrength;
            animation.object.rotation.x =
              Math.cos(time * animation.windSpeed * 0.7 + windPhase) *
              animation.windStrength * 0.4;
          }
          if (animation.dance && animation.danceSpeed) {
            const { torso, head, arms, legs: dancingLegs } = animation.dance;
            const t = time * animation.danceSpeed + phase;
            animation.object.position.y =
              animation.baseY + Math.abs(Math.sin(t * 2)) * 0.12;
            torso.rotation.z = Math.sin(t) * 0.22;
            torso.rotation.y = Math.sin(t * 0.5) * 0.35;
            torso.rotation.x = Math.sin(t * 2) * 0.08;
            head.rotation.z = -torso.rotation.z * 0.5;
            head.rotation.y = Math.sin(t * 0.5 + 1) * 0.3;
            arms[0].rotation.z = -(0.45 + Math.sin(t) * 0.85);
            arms[1].rotation.z = 0.45 + Math.sin(t + 1.2) * 0.85;
            arms[0].rotation.x = Math.sin(t * 1.3) * 0.5;
            arms[1].rotation.x = Math.sin(t * 1.3 + 1) * 0.5;
            dancingLegs[0].rotation.x = Math.sin(t * 1.6) * 0.5;
            dancingLegs[1].rotation.x = -Math.sin(t * 1.6) * 0.5;
            dancingLegs[0].rotation.z = Math.sin(t * 0.8) * 0.12;
            dancingLegs[1].rotation.z = -Math.sin(t * 0.8) * 0.12;
          }
          if (animation.spin) {
            const material = (animation.object as THREE.Sprite).material;
            if (material instanceof THREE.SpriteMaterial) {
              material.rotation += animation.spin * delta;
            } else {
              animation.object.rotation.y += animation.spin * delta;
            }
          }
        });
        animatedLights.forEach(({ light, base, speed, phase }) => {
          light.intensity = base * (0.85 + Math.sin(time * speed + phase) * 0.15);
        });
      }

      if (activeSurfaceId === "sushi" && sushiWater) {
        const geometry = sushiWater.geometry;
        const position = geometry.attributes.position as THREE.BufferAttribute;
        const base = geometry.userData.base as Float32Array;
        for (let i = 0; i < position.count; i++) {
          const x = base[i * 3];
          const y = base[i * 3 + 1];
          position.setZ(
            i,
            Math.sin(x * 0.16 + time * 1.2) * 0.35 +
              Math.cos(y * 0.13 + time * 0.9) * 0.3 +
              Math.sin((x + y) * 0.07 - time * 0.7) * 0.2,
          );
        }
        position.needsUpdate = true;
        geometry.computeVertexNormals();
        if (sushiBoat) {
          sushiBoat.position.y = 0.3 + Math.sin(time * 1.1) * 0.28;
          sushiBoat.rotation.z = Math.sin(time * 0.9) * 0.07;
          sushiBoat.rotation.x = Math.sin(time * 1.3 + 0.5) * 0.05;
        }
      }

      if (pendingReturn) {
        fadeValue = THREE.MathUtils.lerp(fadeValue, 1, 0.2);
        if (fadeValue > 0.96) {
          leaveSurface();
          pendingReturn = false;
          fadeValue = 1;
        }
      } else if (viewModeRef.current !== "traveling") {
        fadeValue = THREE.MathUtils.lerp(fadeValue, 0, 0.08);
      }
      if (fadeRef.current) {
        fadeRef.current.style.opacity = fadeValue.toFixed(3);
      }

      sunGlow.scale.setScalar(21 + Math.sin(time * 1.1) * 0.9);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      controls.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [selectBody]);

  const selected = BODIES.find((body) => body.id === selectedId) ?? SUN;
  const visitingBody = BODIES.find((body) => body.id === visitingId) ?? null;
  const isPlanet = selected.id !== SUN.id;

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" aria-hidden="true" />

      <div
        ref={fadeRef}
        className="pointer-events-none absolute inset-0 z-40 bg-black opacity-0"
        aria-hidden="true"
      />

      <div className="pointer-events-none absolute inset-0 z-10">
        {viewMode === "space" && (
          <>
            <div className="pointer-events-auto absolute right-4 top-4 flex gap-2 sm:right-6 sm:top-6">
              <button
                type="button"
                onClick={togglePaused}
                className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-xl transition hover:border-white/35 hover:bg-white/10 hover:text-white"
              >
                {paused ? "▶ Reanudar" : "❚❚ Pausar"}
              </button>
              <button
                type="button"
                onClick={() => resetViewRef.current()}
                className="rounded-full border border-white/15 bg-black/40 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-xl transition hover:border-white/35 hover:bg-white/10 hover:text-white"
              >
                ↺ Vista
              </button>
            </div>

            <p className="absolute right-6 top-20 hidden text-right text-[11px] leading-5 text-white/40 lg:block">
              Arrastra para girar · Rueda para acercar
              <br />
              Toca un astro para conocerlo
            </p>

            <section
              aria-live="polite"
              className="pointer-events-auto absolute bottom-28 left-4 w-[min(21rem,calc(100vw-2rem))] rounded-3xl border border-white/12 bg-[#0b0d1c]/70 p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:bottom-6 sm:left-6"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                  style={{ backgroundColor: `${selected.color}33` }}
                >
                  {selected.emoji}
                </span>
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-white">
                    {selected.name}
                  </h2>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                    {selected.theme}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-white/70">
                {selected.message}
              </p>
              {isPlanet && (
                <button
                  type="button"
                  onClick={() => visitPlanet(selected.id)}
                  className="mt-4 w-full rounded-full bg-gradient-to-r from-amber-200 to-pink-200 px-4 py-2.5 text-sm font-semibold text-[#211529] shadow-lg shadow-pink-500/20 transition hover:brightness-110 active:scale-[0.98]"
                >
                  🚀 Visitar {selected.name}
                </button>
              )}
            </section>

            <nav
              aria-label="Astros del sistema solar"
              className="pointer-events-auto absolute bottom-4 left-1/2 flex w-[min(46rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap justify-center gap-1.5"
            >
              {BODIES.map((body) => {
                const isActive = body.id === selectedId;
                return (
                  <button
                    key={body.id}
                    type="button"
                    onClick={() => selectBody(body.id)}
                    onMouseEnter={() => setHoverRef.current(body.id)}
                    onMouseLeave={() => setHoverRef.current(null)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                      isActive
                        ? "border-white/40 bg-white/15 text-white"
                        : "border-white/10 bg-black/35 text-white/55 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: body.accent }}
                    />
                    {body.name}
                  </button>
                );
              })}
            </nav>
          </>
        )}

        {viewMode === "traveling" && visitingBody && (
          <div className="absolute inset-x-0 top-1/3 z-30 flex flex-col items-center gap-4 px-6 text-center">
            <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">
              Viajando a
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {visitingBody.emoji} {visitingBody.name}
            </h2>
            <div className="h-1 w-56 overflow-hidden rounded-full bg-white/15 sm:w-72">
              <div
                ref={progressRef}
                className="h-full w-0 rounded-full bg-gradient-to-r from-amber-200 via-pink-200 to-sky-200"
              />
            </div>
          </div>
        )}

        {viewMode === "surface" && visitingBody && (
          <section className="pointer-events-auto absolute bottom-6 left-1/2 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 rounded-3xl border border-white/15 bg-[#0b0d1c]/75 p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                style={{ backgroundColor: `${visitingBody.color}44` }}
              >
                {visitingBody.emoji}
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-white">
                  {visitingBody.name}
                </h2>
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">
                  Superficie · {visitingBody.theme}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/75">
              {visitingBody.message}
            </p>
            <p className="mt-3 text-xs leading-5 text-white/45">
              Flora y fauna: {SURFACE_LIFE[visitingBody.id]}
            </p>
            <button
              type="button"
              onClick={returnToSpace}
              className="mt-4 w-full rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/45 hover:bg-white/20 active:scale-[0.98]"
            >
              ← Volver al espacio
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
