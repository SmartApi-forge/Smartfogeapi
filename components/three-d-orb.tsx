"use client"

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Environment } from '@react-three/drei'
import * as THREE from 'three'

function AnimatedOrb() {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.8) * 0.2
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.3
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 1.5) * 0.08
    }
    
    if (glowRef.current) {
      glowRef.current.rotation.x = -Math.sin(state.clock.elapsedTime * 0.5) * 0.1
      glowRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.2
    }
  })

  return (
    <group>
      {/* Outer glow sphere */}
      <Sphere ref={glowRef} args={[1.3, 32, 32]}>
        <meshBasicMaterial
          color="#8b5cf6"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Main orb */}
      <Sphere ref={meshRef} args={[0.8, 64, 64]}>
        <MeshDistortMaterial
          color="#a855f7"
          attach="material"
          distort={0.3}
          speed={1.5}
          roughness={0.05}
          metalness={0.9}
          emissive="#4c1d95"
          emissiveIntensity={0.2}
        />
      </Sphere>
      
      {/* Inner core */}
      <Sphere args={[0.4, 32, 32]}>
        <meshBasicMaterial
          color="#ec4899"
          transparent
          opacity={0.6}
        />
      </Sphere>
    </group>
  )
}

export default function ThreeDOrb() {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
        <Environment preset="city" />
        <ambientLight intensity={0.3} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#ffffff" />
        <pointLight position={[-3, -3, 3]} intensity={0.6} color="#ec4899" />
        <pointLight position={[3, 3, -3]} intensity={0.4} color="#8b5cf6" />
        <AnimatedOrb />
      </Canvas>
    </div>
  )
}
