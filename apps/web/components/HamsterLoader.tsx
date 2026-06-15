"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// The app's signature loading state: a little 3D hamster running inside a
// turning wheel, built with three.js. Warm-notebook palette (marigold rim,
// taupe hamster) so it reads as "earned effort", not a sterile spinner.
// This is the DEFAULT loader across the UI — prefer <Loader/> over ad-hoc text.

// Warm golden-brown hamster with a cream belly — reads as a hamster (not a grey
// blob) and stays legible on both the paper and dark-paper themes.
const PALETTE = {
  body: 0xb98e57, // warm tan
  light: 0xe6d6b3, // cream (belly, cheeks, inner ear)
  nose: 0xc98b6b, // soft pink-brown
  eye: 0x2a2014, // dark
  rim: 0xe0913a, // marigold
  rung: 0xcabd9f, // warm line
};

function buildHamster() {
  // Built facing +z (toward the camera) so the face always reads. A small
  // rotation.y on the group gives it a 3/4 hero angle.
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: PALETTE.body, roughness: 0.85 });
  const light = new THREE.MeshStandardMaterial({ color: PALETTE.light, roughness: 0.9 });
  const nose = new THREE.MeshStandardMaterial({ color: PALETTE.nose, roughness: 0.6 });
  const eye = new THREE.MeshStandardMaterial({ color: PALETTE.eye, roughness: 0.3 });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xfffaf0 });

  const sphere = (r: number, mat: THREE.Material, seg = 22) =>
    new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat);

  // round body
  const torso = sphere(0.72, body);
  torso.scale.set(1.05, 1.0, 0.92);
  torso.position.set(0, -0.05, 0);
  g.add(torso);

  // cream belly facing the camera
  const belly = sphere(0.6, light);
  belly.scale.set(0.85, 0.85, 0.7);
  belly.position.set(0, -0.18, 0.45);
  g.add(belly);

  // head, raised and forward toward the camera
  const head = sphere(0.56, body);
  head.position.set(0, 0.28, 0.5);
  g.add(head);

  // muzzle + nose
  const muzzle = sphere(0.3, light);
  muzzle.scale.set(1, 0.8, 0.9);
  muzzle.position.set(0, 0.1, 0.92);
  g.add(muzzle);
  const noseTip = sphere(0.1, nose);
  noseTip.position.set(0, 0.18, 1.12);
  g.add(noseTip);

  // chubby cheeks
  for (const x of [0.34, -0.34]) {
    const cheek = sphere(0.26, light);
    cheek.position.set(x, 0.06, 0.72);
    g.add(cheek);
  }

  // big rounded ears with cream inner
  for (const x of [0.34, -0.34]) {
    const ear = sphere(0.24, body);
    ear.scale.set(0.9, 1.05, 0.7);
    ear.position.set(x, 0.74, 0.32);
    g.add(ear);
    const inner = sphere(0.13, light);
    inner.position.set(x, 0.74, 0.4);
    g.add(inner);
  }

  // big friendly eyes with glints
  for (const x of [0.22, -0.22]) {
    const e = sphere(0.13, eye, 18);
    e.position.set(x, 0.34, 0.94);
    g.add(e);
    const glint = sphere(0.045, glintMat, 10);
    glint.position.set(x + 0.05, 0.4, 1.02);
    g.add(glint);
  }

  // stubby tail behind
  const tail = sphere(0.14, body);
  tail.position.set(0, -0.05, -0.78);
  g.add(tail);

  // front paws reaching toward the camera, pumping as it runs
  const pawGeo = new THREE.CapsuleGeometry(0.09, 0.28, 4, 8);
  const feet: THREE.Object3D[] = [];
  for (const x of [0.28, -0.28]) {
    const pivot = new THREE.Object3D();
    pivot.position.set(x, -0.35, 0.55);
    const paw = new THREE.Mesh(pawGeo, body);
    paw.position.set(0, -0.16, 0.06);
    paw.rotation.x = 0.5;
    pivot.add(paw);
    g.add(pivot);
    feet.push(pivot);
  }

  // back feet planted on the wheel
  for (const x of [0.34, -0.34]) {
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.2, 4, 8), body);
    foot.position.set(x, -0.62, -0.05);
    g.add(foot);
  }

  return { group: g, feet };
}

function buildWheel() {
  const g = new THREE.Group();
  const rimMat = new THREE.MeshStandardMaterial({ color: PALETTE.rim, roughness: 0.55, metalness: 0.1 });
  const rungMat = new THREE.MeshStandardMaterial({ color: PALETTE.rung, roughness: 0.9 });

  const R = 2.25;
  const W = 1.5;
  // two side rims
  for (const z of [W / 2, -W / 2]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.1, 16, 56), rimMat);
    rim.position.z = z;
    g.add(rim);
  }
  // running rungs around the drum, parallel to the axle (z)
  const rungGeo = new THREE.CylinderGeometry(0.05, 0.05, W, 8);
  const RUNGS = 18;
  for (let i = 0; i < RUNGS; i++) {
    const a = (i / RUNGS) * Math.PI * 2;
    const rung = new THREE.Mesh(rungGeo, rungMat);
    rung.rotation.x = Math.PI / 2; // lay it along z
    rung.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    g.add(rung);
  }
  return g;
}

export function HamsterLoader({
  size = 64,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0.7, 0.4, 11.4);
    camera.lookAt(0, -0.1, 0);

    // WebGL can be unavailable (old GPUs, headless, blocked contexts). Never let
    // that crash the page the loader is sitting on — fall back to a CSS pulse.
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      mount.dataset.fallback = "1";
      return;
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = `${size}px`;
    renderer.domElement.style.height = `${size}px`;
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff3e0, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.15);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xe0913a, 0.35);
    fill.position.set(-4, -1, 2);
    scene.add(fill);

    const wheel = buildWheel();
    scene.add(wheel);

    const { group: hamster, feet } = buildHamster();
    hamster.position.set(0, -1.3, 0);
    hamster.rotation.y = -0.3; // slight 3/4 turn for dimension
    scene.add(hamster);

    let raf = 0;
    let t = 0;
    const baseY = hamster.position.y;

    const render = () => renderer.render(scene, camera);

    if (reduced) {
      // static, paws mid-stride
      feet[0].rotation.x = 0.5;
      feet[1].rotation.x = -0.5;
      render();
    } else {
      const loop = () => {
        t += 0.05;
        wheel.rotation.z -= 0.05;
        feet[0].rotation.x = Math.sin(t * 7) * 0.7;
        feet[1].rotation.x = Math.sin(t * 7 + Math.PI) * 0.7;
        hamster.position.y = baseY + Math.sin(t * 14) * 0.03;
        render();
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [size]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`hamster-mount ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

// The standard loading block: hamster + a quiet mono label. Drop this in
// wherever a view is waiting on data.
export function Loader({
  label = "Loading…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-2.5 py-10 ${className}`}
    >
      <HamsterLoader size={120} />
      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
    </div>
  );
}
