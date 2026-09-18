/**
 * HeroScene — Three.js 3D animated highway scene for the landing page.
 * Simple road geometry with moving cars and city lights in the background.
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Road Surface ─────────────────────────────── */
function Road() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[4, 60]} />
      <meshStandardMaterial color="#1a1a2e" />
      {/* Center lane markings */}
      {Array.from({ length: 15 }).map((_, i) => (
        <mesh key={i} position={[0, 0.01, -28 + i * 4]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.08, 1.5]} />
          <meshStandardMaterial color="#FFD166" emissive="#FFD166" emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* Side lines */}
      <mesh position={[-1.8, 0.01, 0]}>
        <planeGeometry args={[0.06, 60]} />
        <meshStandardMaterial color="#52B788" emissive="#52B788" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[1.8, 0.01, 0]}>
        <planeGeometry args={[0.06, 60]} />
        <meshStandardMaterial color="#52B788" emissive="#52B788" emissiveIntensity={0.2} />
      </mesh>
    </mesh>
  );
}

/* ── Moving Car ───────────────────────────────── */
function Car({ startZ, speed, lane, color }) {
  const ref = useRef();

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.position.z += speed * delta;
      if (ref.current.position.z > 30) ref.current.position.z = -30;
    }
  });

  return (
    <group ref={ref} position={[lane, -0.15, startZ]}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.6, 0.3, 1.2]} />
        <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Cabin */}
      <mesh position={[0, 0.2, -0.1]}>
        <boxGeometry args={[0.5, 0.2, 0.6]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} transparent opacity={0.8} />
      </mesh>
      {/* Headlights */}
      <mesh position={[0.2, 0, 0.6]}>
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.2, 0, 0.6]}>
        <sphereGeometry args={[0.05]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={2} />
      </mesh>
      {/* Taillights */}
      <mesh position={[0.2, 0, -0.6]}>
        <sphereGeometry args={[0.04]} />
        <meshStandardMaterial emissive="#EF4444" emissiveIntensity={2} />
      </mesh>
      <mesh position={[-0.2, 0, -0.6]}>
        <sphereGeometry args={[0.04]} />
        <meshStandardMaterial emissive="#EF4444" emissiveIntensity={2} />
      </mesh>
    </group>
  );
}

/* ── City Building ────────────────────────────── */
function Building({ position, height, width }) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width * 0.8]} />
        <meshStandardMaterial color="#0d1b2a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Windows (emissive dots) */}
      {Array.from({ length: Math.floor(height * 2) }).map((_, y) =>
        Array.from({ length: 2 }).map((_, x) => (
          <mesh key={`${y}-${x}`} position={[(x - 0.5) * width * 0.3, y * 0.5 + 0.5, width * 0.41]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshStandardMaterial
              emissive={Math.random() > 0.3 ? '#FFD166' : '#52B788'}
              emissiveIntensity={Math.random() * 0.5 + 0.3}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

/* ── Street Lights ────────────────────────────── */
function StreetLights() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <group key={i}>
          {/* Left pole */}
          <mesh position={[-2.5, 1, -25 + i * 7]}>
            <cylinderGeometry args={[0.03, 0.03, 2.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <pointLight position={[-2.5, 2.3, -25 + i * 7]} color="#FFD166" intensity={0.5} distance={5} />

          {/* Right pole */}
          <mesh position={[2.5, 1, -25 + i * 7]}>
            <cylinderGeometry args={[0.03, 0.03, 2.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <pointLight position={[2.5, 2.3, -25 + i * 7]} color="#FFD166" intensity={0.5} distance={5} />
        </group>
      ))}
    </>
  );
}

/* ── Camera Controller — slow pan ─────────────── */
function CameraRig() {
  useFrame(({ camera, clock }) => {
    const t = clock.getElapsedTime() * 0.15;
    camera.position.x = Math.sin(t) * 2;
    camera.position.y = 3 + Math.sin(t * 0.5) * 0.5;
    camera.position.z = 8 + Math.cos(t * 0.3) * 2;
    camera.lookAt(0, 0, -5);
  });
  return null;
}

/* ── Main Scene ───────────────────────────────── */
export default function HeroScene() {
  const buildings = useMemo(() => {
    const b = [];
    for (let i = 0; i < 12; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      b.push({
        position: [side * (4 + Math.random() * 3), -0.5, -25 + i * 4.5 + Math.random() * 2],
        height: 1.5 + Math.random() * 4,
        width: 0.8 + Math.random() * 0.8,
      });
    }
    return b;
  }, []);

  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas
        camera={{ position: [3, 3, 8], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <fog attach="fog" args={['#0A0F1E', 10, 35]} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 10, 5]} intensity={0.3} color="#9CA3AF" />

        <Road />
        <StreetLights />

        <Car startZ={-20} speed={6} lane={-0.8} color="#2D6A4F" />
        <Car startZ={-5} speed={8} lane={0.8} color="#52B788" />
        <Car startZ={10} speed={5} lane={-0.8} color="#FFD166" />

        {buildings.map((b, i) => (
          <Building key={i} {...b} />
        ))}

        <CameraRig />
      </Canvas>
    </div>
  );
}
