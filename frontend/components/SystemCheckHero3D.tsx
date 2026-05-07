"use client";

import { useEffect, useRef } from "react";
import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

const TRIANGLE_RADIUS = 2;
const SPHERE_RADIUS = 0.25;
const OCTAHEDRON_RADIUS = 0.4;
const PULSE_RADIUS = 0.08;

const HEARTBEAT_PERIOD_MS = 2000;
const HEARTBEAT_AMPLITUDE = 0.05;
const HEARTBEAT_PHASE_OFFSET_MS = 660;

const ORBIT_PERIOD_MS = 30000;

const PULSE_DURATION_MS = 600;
const PULSE_SPAWN_MS = 1500;

const FALLBACK_NOMINAL = "#22c55e";
const FALLBACK_ACCENT = "#5eead4";

interface ActivePulse {
  mesh: Mesh;
  source: Vector3;
  target: Vector3;
  startMs: number;
}

function controllerPositions(): Vector3[] {
  return [0, 1, 2].map((i) => {
    const angle = (i * 2 * Math.PI) / 3;
    return new Vector3(TRIANGLE_RADIUS * Math.cos(angle), 0, TRIANGLE_RADIUS * Math.sin(angle));
  });
}

function readThemeColors(): { nominal: Color; accent: Color } {
  const styles = getComputedStyle(document.documentElement);
  const nominalHex = styles.getPropertyValue("--status-nominal").trim() || FALLBACK_NOMINAL;
  const accentHex = styles.getPropertyValue("--accent").trim() || FALLBACK_ACCENT;
  return { nominal: new Color(nominalHex), accent: new Color(accentHex) };
}

export default function SystemCheckHero3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileMql = window.matchMedia("(max-width: 639px)");
    let reducedMotion = reducedMql.matches;
    let mobile = mobileMql.matches;

    const renderer = new WebGLRenderer({ alpha: true, antialias: !mobile });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    const initialW = container.clientWidth || 1;
    const initialH = container.clientHeight || 1;
    renderer.setSize(initialW, initialH, false);
    const canvas = renderer.domElement;
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    container.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(50, initialW / initialH, 0.1, 100);
    camera.position.set(0, 1.5, 5);
    camera.lookAt(0, 0, 0);

    const ambient = new AmbientLight(0xffffff, 0.4);
    const directional = new DirectionalLight(0xffffff, 0.6);
    directional.position.set(0, 5, 5);
    scene.add(ambient, directional);

    let { nominal: nominalColor, accent: accentColor } = readThemeColors();

    const group = new Group();
    scene.add(group);

    const positions = controllerPositions();

    const controllerGeometry = new SphereGeometry(SPHERE_RADIUS, 32, 32);
    const controllerMaterials: MeshStandardMaterial[] = [];
    const controllerMeshes: Mesh[] = [];
    positions.forEach((pos) => {
      const material = new MeshStandardMaterial({
        color: nominalColor.clone(),
        emissive: nominalColor.clone(),
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.5,
      });
      const mesh = new Mesh(controllerGeometry, material);
      mesh.position.copy(pos);
      group.add(mesh);
      controllerMeshes.push(mesh);
      controllerMaterials.push(material);
    });

    const voterGeometry = new OctahedronGeometry(OCTAHEDRON_RADIUS);
    const voterMaterial = new MeshStandardMaterial({
      color: accentColor.clone(),
      emissive: accentColor.clone(),
      emissiveIntensity: 0.5,
      metalness: 0.6,
      roughness: 0.3,
    });
    const voterMesh = new Mesh(voterGeometry, voterMaterial);
    group.add(voterMesh);

    const lineGeometries: BufferGeometry[] = [];
    const lineMaterials: LineBasicMaterial[] = [];
    positions.forEach((pos) => {
      const geom = new BufferGeometry().setFromPoints([pos.clone(), new Vector3(0, 0, 0)]);
      const mat = new LineBasicMaterial({
        color: accentColor.clone(),
        transparent: true,
        opacity: 0.3,
      });
      const line = new Line(geom, mat);
      group.add(line);
      lineGeometries.push(geom);
      lineMaterials.push(mat);
    });

    const pulseGeometry = new SphereGeometry(PULSE_RADIUS, 16, 16);
    const pulseMaterial = new MeshStandardMaterial({
      color: accentColor.clone(),
      emissive: accentColor.clone(),
      emissiveIntensity: 1.0,
      metalness: 0.6,
      roughness: 0.3,
    });
    const activePulses: ActivePulse[] = [];

    const updateThemeColors = () => {
      const { nominal, accent } = readThemeColors();
      nominalColor = nominal;
      accentColor = accent;
      controllerMaterials.forEach((m) => {
        m.color.copy(nominal);
        m.emissive.copy(nominal);
      });
      voterMaterial.color.copy(accent);
      voterMaterial.emissive.copy(accent);
      lineMaterials.forEach((m) => m.color.copy(accent));
      pulseMaterial.color.copy(accent);
      pulseMaterial.emissive.copy(accent);
    };

    const themeObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "data-theme") {
          updateThemeColors();
          break;
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    const clearPulses = () => {
      for (const pulse of activePulses) {
        group.remove(pulse.mesh);
      }
      activePulses.length = 0;
    };

    const onReducedChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      if (reducedMotion) {
        controllerMeshes.forEach((m) => m.scale.setScalar(1));
        group.rotation.y = 0;
        clearPulses();
      }
    };
    const onMobileChange = (e: MediaQueryListEvent) => {
      mobile = e.matches;
      if (mobile) group.rotation.y = 0;
    };
    reducedMql.addEventListener("change", onReducedChange);
    mobileMql.addEventListener("change", onMobileChange);

    const startMs = performance.now();
    let lastPulseSpawnMs = startMs;
    let nextSourceIndex = 0;
    let rafId = 0;

    const tick = () => {
      const nowMs = performance.now();
      const elapsed = nowMs - startMs;

      if (!reducedMotion && !mobile) {
        group.rotation.y = ((elapsed % ORBIT_PERIOD_MS) / ORBIT_PERIOD_MS) * Math.PI * 2;
      }

      if (!reducedMotion) {
        for (let i = 0; i < controllerMeshes.length; i += 1) {
          const phase = (elapsed - i * HEARTBEAT_PHASE_OFFSET_MS) / HEARTBEAT_PERIOD_MS;
          const scale = 1 + HEARTBEAT_AMPLITUDE * 0.5 * (1 + Math.sin(phase * Math.PI * 2));
          controllerMeshes[i].scale.setScalar(scale);
        }
      }

      if (!reducedMotion && nowMs - lastPulseSpawnMs >= PULSE_SPAWN_MS) {
        lastPulseSpawnMs = nowMs;
        const sourceIdx = nextSourceIndex % 3;
        nextSourceIndex += 1;
        const sourceLocal = positions[sourceIdx].clone();
        const pulseMesh = new Mesh(pulseGeometry, pulseMaterial);
        pulseMesh.position.copy(sourceLocal);
        group.add(pulseMesh);
        activePulses.push({
          mesh: pulseMesh,
          source: sourceLocal,
          target: new Vector3(0, 0, 0),
          startMs: nowMs,
        });
      }

      for (let i = activePulses.length - 1; i >= 0; i -= 1) {
        const pulse = activePulses[i];
        const t = (nowMs - pulse.startMs) / PULSE_DURATION_MS;
        if (t >= 1) {
          group.remove(pulse.mesh);
          activePulses.splice(i, 1);
        } else {
          pulse.mesh.position.lerpVectors(pulse.source, pulse.target, t);
        }
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      reducedMql.removeEventListener("change", onReducedChange);
      mobileMql.removeEventListener("change", onMobileChange);
      clearPulses();
      controllerGeometry.dispose();
      voterGeometry.dispose();
      pulseGeometry.dispose();
      lineGeometries.forEach((g) => g.dispose());
      controllerMaterials.forEach((m) => m.dispose());
      voterMaterial.dispose();
      lineMaterials.forEach((m) => m.dispose());
      pulseMaterial.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="aspect-square w-full"
      style={{ position: "relative" }}
      aria-hidden
    />
  );
}
