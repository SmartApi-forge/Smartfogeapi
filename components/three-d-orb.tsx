"use client"

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Environment } from '@react-three/drei'
import { useTheme } from 'next-themes'
import * as THREE from 'three'

// Theme-aware color schemes
const getThemeColors = (isDark: boolean) => {
  if (isDark) {
    return {
      // Dark mode: vibrant, glowing colors like Siri
      primary: [0.8, 0.4, 1.0],    // Purple
      secondary: [0.4, 0.8, 1.0],  // Cyan
      accent1: [1.0, 0.6, 0.8],    // Pink
      accent2: [0.6, 1.0, 0.8],    // Mint
      glow: [0.5, 0.3, 0.9],       // Deep purple glow
      particles: '#a855f7',
      opacity: 0.8
    }
  } else {
    return {
      // Light mode: softer, more subtle colors
      primary: [0.6, 0.3, 0.8],    // Muted purple
      secondary: [0.3, 0.6, 0.8],  // Soft blue
      accent1: [0.8, 0.4, 0.6],    // Rose
      accent2: [0.4, 0.8, 0.6],    // Sage
      glow: [0.4, 0.2, 0.7],       // Subtle purple
      particles: '#8b5cf6',
      opacity: 0.4
    }
  }
}

// Siri-style flowing surface material with theme support
const SiriSurfaceMaterial = ({ speed = 1, amplitude = 0.2, isDark = true }: { speed?: number; amplitude?: number; isDark?: boolean }) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const colors = getThemeColors(isDark)
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uAmplitude: { value: amplitude },
    uOpacity: { value: colors.opacity },
    uColor1: { value: new THREE.Vector3(...colors.primary) },
    uColor2: { value: new THREE.Vector3(...colors.secondary) },
    uColor3: { value: new THREE.Vector3(...colors.accent1) },
    uColor4: { value: new THREE.Vector3(...colors.accent2) },
    uIsDark: { value: isDark ? 1.0 : 0.0 }
  }), [speed, amplitude, isDark, colors])

  const vertexShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uAmplitude;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      vPosition = position;
      vNormal = normal;
      vUv = uv;
      
      vec3 pos = position;
      
      // Create flowing wave distortions
      float wave1 = sin(pos.x * 3.0 + uTime * uSpeed) * uAmplitude;
      float wave2 = cos(pos.y * 2.5 + uTime * uSpeed * 0.8) * uAmplitude;
      float wave3 = sin(pos.z * 4.0 + uTime * uSpeed * 1.2) * uAmplitude;
      
      pos += normal * (wave1 + wave2 + wave3) * 0.1;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `

  const fragmentShader = `
    uniform float uTime;
    uniform float uSpeed;
    uniform float uOpacity;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    uniform vec3 uColor3;
    uniform vec3 uColor4;
    uniform float uIsDark;
    varying vec3 vPosition;
    varying vec3 vNormal;
    varying vec2 vUv;
    
    void main() {
      // Create flowing iridescent colors
      float time = uTime * uSpeed;
      vec3 pos = vPosition;
      
      // Multi-layered color waves
      float colorWave1 = sin(pos.x * 2.0 + time) * 0.5 + 0.5;
      float colorWave2 = cos(pos.y * 1.5 + time * 0.7) * 0.5 + 0.5;
      float colorWave3 = sin(pos.z * 3.0 + time * 1.3) * 0.5 + 0.5;
      
      // Use theme-aware colors
      vec3 finalColor = mix(uColor1, uColor2, colorWave1);
      finalColor = mix(finalColor, uColor3, colorWave2);
      finalColor = mix(finalColor, uColor4, colorWave3);
      
      // Enhanced fresnel effect
      vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0));
      float fresnel = pow(1.0 - max(dot(vNormal, viewDirection), 0.0), 2.0);
      
      // Theme-specific enhancements
      if (uIsDark > 0.5) {
        // Dark mode: stronger glow and vibrant colors
        finalColor += fresnel * 0.5;
        finalColor *= 1.2; // Boost intensity
      } else {
        // Light mode: subtle glow and softer colors
        finalColor += fresnel * 0.2;
        finalColor *= 0.8; // Reduce intensity
      }
      
      gl_FragColor = vec4(finalColor, uOpacity);
    }
  `

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <shaderMaterial
      ref={materialRef}
      uniforms={uniforms}
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      transparent
      side={THREE.DoubleSide}
      blending={THREE.AdditiveBlending}
    />
  )
}

// Floating particle system with orbital motion and theme support
function FloatingParticles({ isDark = true }: { isDark?: boolean }) {
  const particlesRef = useRef<THREE.Points>(null)
  const colors = getThemeColors(isDark)
  
  const [positions, scales, velocities] = useMemo(() => {
    const count = 150
    const positions = new Float32Array(count * 3)
    const scales = new Float32Array(count)
    const velocities = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3
      
      // Create particles in orbital patterns
      const radius = 1.2 + Math.random() * 1.5
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta)
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      positions[i3 + 2] = radius * Math.cos(phi)
      
      scales[i] = Math.random() * 0.8 + 0.2
      
      // Random orbital velocities
      velocities[i3] = (Math.random() - 0.5) * 0.02
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02
    }
    
    return [positions, scales, velocities]
  }, [])

  useFrame((state) => {
    if (particlesRef.current) {
      const time = state.clock.elapsedTime
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
      
      for (let i = 0; i < positions.length; i += 3) {
        const idx = i / 3
        
        // Complex orbital motion
        const orbitSpeed = 0.5 + (idx % 10) * 0.1
        const orbitRadius = 1.2 + Math.sin(time * 0.3 + idx) * 0.3
        
        positions[i] += Math.sin(time * orbitSpeed + idx) * 0.01
        positions[i + 1] += Math.cos(time * orbitSpeed * 0.7 + idx) * 0.01
        positions[i + 2] += Math.sin(time * orbitSpeed * 1.3 + idx) * 0.008
        
        // Keep particles in bounds
        const distance = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2 + positions[i + 2] ** 2)
        if (distance > 3) {
          positions[i] *= 0.8
          positions[i + 1] *= 0.8
          positions[i + 2] *= 0.8
        }
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-aScale"
          args={[scales, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={isDark ? 0.04 : 0.025}
        color={colors.particles}
        transparent
        opacity={isDark ? 0.8 : 0.5}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Multiple rotating Siri surfaces with complex rotations and theme support
function SiriSurfaces({ isDark = true }: { isDark?: boolean }) {
  const group1Ref = useRef<THREE.Group>(null)
  const group2Ref = useRef<THREE.Group>(null)
  const group3Ref = useRef<THREE.Group>(null)
  const group4Ref = useRef<THREE.Group>(null)
  
  useFrame((state) => {
    const time = state.clock.elapsedTime
    
    if (group1Ref.current) {
      // Complex multi-axis rotation with varying speeds
      group1Ref.current.rotation.x = Math.sin(time * 0.3) * 0.5 + time * 0.2
      group1Ref.current.rotation.y = Math.cos(time * 0.4) * 0.3 + time * 0.15
      group1Ref.current.rotation.z = Math.sin(time * 0.25) * 0.4 + time * 0.1
    }
    
    if (group2Ref.current) {
      // Counter-rotating with oscillations
      group2Ref.current.rotation.x = -Math.cos(time * 0.5) * 0.6 - time * 0.18
      group2Ref.current.rotation.y = Math.sin(time * 0.6) * 0.4 + time * 0.25
      group2Ref.current.rotation.z = -Math.cos(time * 0.35) * 0.5 - time * 0.12
    }
    
    if (group3Ref.current) {
      // Chaotic rotation with multiple frequencies
      group3Ref.current.rotation.x = Math.sin(time * 0.7) * 0.3 + Math.cos(time * 1.2) * 0.2 + time * 0.22
      group3Ref.current.rotation.y = -Math.sin(time * 0.8) * 0.4 - Math.sin(time * 1.5) * 0.15 - time * 0.28
      group3Ref.current.rotation.z = Math.cos(time * 0.9) * 0.35 + Math.sin(time * 1.8) * 0.1 + time * 0.16
    }
    
    if (group4Ref.current) {
      // Wobbling rotation
      group4Ref.current.rotation.x = Math.sin(time * 1.1) * 0.8 + time * 0.14
      group4Ref.current.rotation.y = Math.cos(time * 1.3) * 0.6 - time * 0.19
      group4Ref.current.rotation.z = Math.sin(time * 0.95) * 0.7 + time * 0.21
    }
  })

  return (
    <group>
      {/* First rotating surface layer */}
      <group ref={group1Ref}>
        <Sphere args={[0.65, 32, 32]}>
          <SiriSurfaceMaterial speed={1.2} amplitude={0.35} isDark={isDark} />
        </Sphere>
      </group>
      
      {/* Second rotating surface layer */}
      <group ref={group2Ref}>
        <Sphere args={[0.52, 32, 32]}>
          <SiriSurfaceMaterial speed={1.8} amplitude={0.25} isDark={isDark} />
        </Sphere>
      </group>
      
      {/* Third rotating surface layer */}
      <group ref={group3Ref}>
        <Sphere args={[0.42, 32, 32]}>
          <SiriSurfaceMaterial speed={0.9} amplitude={0.45} isDark={isDark} />
        </Sphere>
      </group>
      
      {/* Fourth inner rotating layer */}
      <group ref={group4Ref}>
        <Sphere args={[0.32, 24, 24]}>
          <SiriSurfaceMaterial speed={2.2} amplitude={0.3} isDark={isDark} />
        </Sphere>
      </group>
    </group>
  )
}

function AnimatedOrb() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const colors = getThemeColors(isDark)
  
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
      {/* Floating orbital particles */}
      <FloatingParticles isDark={isDark} />
      
      {/* Siri-style rotating surfaces */}
      <SiriSurfaces isDark={isDark} />
      
      {/* Theme-aware outer glow sphere */}
      <Sphere ref={glowRef} args={[1.0, 32, 32]}>
        <meshBasicMaterial
          color={new THREE.Color(...colors.glow)}
          transparent
          opacity={isDark ? 0.08 : 0.03}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Transparent outer shell with theme-aware rim */}
      <Sphere ref={meshRef} args={[0.75, 64, 64]}>
        <meshBasicMaterial
          color={isDark ? "#ffffff" : "#000000"}
          transparent
          opacity={isDark ? 0.02 : 0.01}
          side={THREE.BackSide}
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
