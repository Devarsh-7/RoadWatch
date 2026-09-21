/**
 * HeroScene — Three.js 3D animated highway scene for the landing page.
 * Simple road geometry with moving cars and city lights in the background.
 */
import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';

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

const BUILDINGS_DATA = Array.from({ length: 10 }, (_, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const pseudoRand1 = ((i * 37) % 10) / 10;
  const pseudoRand2 = ((i * 53) % 10) / 10;
  const pseudoRand3 = ((i * 79) % 10) / 10;
  return {
    position: [side * (4 + pseudoRand1 * 3), -0.5, -25 + i * 5 + pseudoRand2 * 2],
    height: 1.5 + pseudoRand3 * 3.5,
    width: 0.8 + pseudoRand1 * 0.8,
  };
});

/* ── City Building ────────────────────────────── */
function Building({ position, height, width }) {
  const floors = Math.floor(height * 2);
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width * 0.8]} />
        <meshStandardMaterial color="#0d1b2a" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Windows (emissive dots) */}
      {Array.from({ length: floors }).map((_, y) =>
        Array.from({ length: 2 }).map((_, x) => (
          <mesh key={`${y}-${x}`} position={[(x - 0.5) * width * 0.3, y * 0.5 + 0.5, width * 0.41]}>
            <planeGeometry args={[0.15, 0.15]} />
            <meshStandardMaterial
              emissive={(y + x) % 2 === 0 ? '#FFD166' : '#52B788'}
              emissiveIntensity={0.5}
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
          {/* Left glowing lantern head */}
          <mesh position={[-2.5, 2.3, -25 + i * 7]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color="#FFD166" emissive="#FFD166" emissiveIntensity={2} />
          </mesh>

          {/* Right pole */}
          <mesh position={[2.5, 1, -25 + i * 7]}>
            <cylinderGeometry args={[0.03, 0.03, 2.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          {/* Right glowing lantern head */}
          <mesh position={[2.5, 2.3, -25 + i * 7]}>
            <sphereGeometry args={[0.08]} />
            <meshStandardMaterial color="#FFD166" emissive="#FFD166" emissiveIntensity={2} />
          </mesh>
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
  const buildings = BUILDINGS_DATA;

  return (
    <div className="w-full h-full absolute inset-0 pointer-events-none">
      <Canvas
        camera={{ position: [3, 3, 8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power', stencil: false, depth: true }}
        style={{ background: 'transparent' }}
      >
        <fog attach="fog" args={['#0A0F1E', 10, 35]} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={0.5} color="#9CA3AF" />

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
