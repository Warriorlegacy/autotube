"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

function OrbitalNode({
  radius,
  speed,
  size,
  color,
  offset = 0,
}: {
  radius: number;
  speed: number;
  size: number;
  color: string;
  offset?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const angle = useRef(offset);

  useFrame((_, delta) => {
    angle.current += delta * speed;
    if (ref.current) {
      ref.current.position.x = Math.cos(angle.current) * radius;
      ref.current.position.z = Math.sin(angle.current) * radius;
      ref.current.position.y = Math.sin(angle.current * 0.5) * radius * 0.3;
    }
  });

  return (
    <Float speed={1} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[size, 1]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.8}
          distort={0.15}
          speed={2}
        />
      </mesh>
    </Float>
  );
}

function ConnectionLines({ count = 6, radius = 4 }: { count?: number; radius?: number }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * radius,
          Math.sin(a * 0.5) * radius * 0.3,
          Math.sin(a) * radius
        )
      );
    }
    return pts;
  }, [count, radius]);

  const linePoints = useMemo(() => {
    const pairs: THREE.Vector3[][] = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (Math.random() > 0.6) continue;
        pairs.push([points[i], points[j]]);
      }
    }
    return pairs;
  }, [points]);

  return (
    <group>
      {linePoints.map((pair, i) => {
        const positions = new Float32Array([
          pair[0].x, pair[0].y, pair[0].z,
          pair[1].x, pair[1].y, pair[1].z,
        ]);
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={positions}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#2dd4bf"
              transparent
              opacity={0.08 + Math.random() * 0.1}
            />
          </line>
        );
      })}
    </group>
  );
}

function Particles({ count = 300 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      siz[i] = Math.random() * 2 + 0.5;
    }
    return [pos, siz];
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#22d3ee"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function CenterCore() {
  const ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.1;
      ref.current.rotation.y += 0.005;
    }
  });

  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[1.2, 0]} />
      <MeshDistortMaterial
        color="#2dd4bf"
        emissive="#22d3ee"
        emissiveIntensity={0.6}
        roughness={0.1}
        metalness={0.9}
        distort={0.2}
        speed={3}
        transparent
        opacity={0.9}
      />
    </mesh>
  );
}

export default function PipelineScene() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <directionalLight position={[-5, -5, -5]} intensity={0.3} color="#22d3ee" />
        <CenterCore />
        <OrbitalNode radius={2.5} speed={0.4} size={0.3} color="#22d3ee" offset={0} />
        <OrbitalNode radius={3} speed={-0.3} size={0.25} color="#818cf8" offset={1.5} />
        <OrbitalNode radius={3.5} speed={0.25} size={0.2} color="#2dd4bf" offset={3} />
        <OrbitalNode radius={4} speed={-0.2} size={0.35} color="#a78bfa" offset={0.8} />
        <OrbitalNode radius={2} speed={0.5} size={0.2} color="#34d399" offset={2.3} />
        <ConnectionLines />
        <Particles />
      </Canvas>
    </div>
  );
}
