import * as THREE from 'three';

export interface TactileMaterials {
  mattePlastic: THREE.MeshStandardMaterial;
  anodizedAluminum: THREE.MeshStandardMaterial;
  frostedGlass: THREE.MeshPhysicalMaterial;
  mWorldPolycarbonate: THREE.MeshPhysicalMaterial;
  mWorldWireframe: THREE.LineBasicMaterial;
  accentActive: THREE.MeshStandardMaterial;
  accentWarning: THREE.MeshStandardMaterial;
  accentError: THREE.MeshStandardMaterial;
}

export function createTactileMaterials(): TactileMaterials {
  return {
    // Тактильный белый/светло-серый пластик (корпуса модулей в R-мире)
    mattePlastic: new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.55,
      metalness: 0.05,
    }),

    // Анодированный алюминий (порты, кольца, стойки, разъемы)
    anodizedAluminum: new THREE.MeshStandardMaterial({
      color: 0xb0bec5,
      roughness: 0.32,
      metalness: 0.85,
    }),

    // Матовое стекло (интерфейсы, линзы, экраны фреймбуфера)
    frostedGlass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.0,
      transmission: 0.65,
      thickness: 0.15,
      transparent: true,
      opacity: 0.9,
    }),

    // M-мир: прозрачный поликарбонат витрины замысла
    mWorldPolycarbonate: new THREE.MeshPhysicalMaterial({
      color: 0x90a4ae,
      roughness: 0.15,
      metalness: 0.0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),

    // M-мир: тонкие графитовые контуры чертежа
    mWorldWireframe: new THREE.LineBasicMaterial({
      color: 0x263238,
      transparent: true,
      opacity: 0.9,
    }),

    // Индикаторы состояний (используются только для статуса, не для кодирования типа)
    accentActive: new THREE.MeshStandardMaterial({
      color: 0x00c853,
      emissive: 0x00c853,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }),

    accentWarning: new THREE.MeshStandardMaterial({
      color: 0xff6d00,
      emissive: 0xff6d00,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    }),

    accentError: new THREE.MeshStandardMaterial({
      color: 0xd50000,
      emissive: 0xd50000,
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  };
}
