import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ThemeContext, VisualProfilePlugin } from '../../types';
import { createTactileMaterials } from '../materials';

function addContour(mesh: THREE.Mesh, material: THREE.LineBasicMaterial): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
  const line = new THREE.LineSegments(edges, material);
  mesh.add(line);
}

export const tactileGraphicsGpuPlugin: VisualProfilePlugin = {
  profileId: 'graphics-gpu',
  label: 'Graphics Pipeline — Tactile Minimal (OpenGL / Vulkan)',
  supportedKinds: [
    'gpu:Buffer',
    'gpu:VertexLayout',
    'gpu:ShaderStage',
    'gpu:Pipeline',
    'gpu:Texture',
    'gpu:Descriptor',
    'gpu:Framebuffer',
    'gpu:CommandQueue',
  ],

  createEntityObject(kind: string, ctx: ThemeContext): THREE.Group | null {
    const group = new THREE.Group();
    const isM = ctx.world === 'M';
    const mats = createTactileMaterials();

    const bodyMat = isM ? mats.mWorldPolycarbonate : mats.mattePlastic;
    const metalMat = isM ? mats.mWorldPolycarbonate : mats.anodizedAluminum;
    const glassMat = isM ? mats.mWorldPolycarbonate : mats.frostedGlass;

    switch (kind) {
      case 'gpu:Buffer': {
        // Прозрачная капсула буфера с алюминиевыми торцами и 3 сферами вершин внутри
        const capsuleGeo = new THREE.CapsuleGeometry(0.28, 0.75, 16, 24);
        capsuleGeo.rotateZ(Math.PI / 2);
        const capsule = new THREE.Mesh(capsuleGeo, glassMat);
        capsule.position.y = 0.35;
        if (isM) addContour(capsule, mats.mWorldWireframe);
        group.add(capsule);

        // Центральный стяжной хомут из алюминия
        const clampGeo = new THREE.CylinderGeometry(0.31, 0.31, 0.14, 24);
        clampGeo.rotateZ(Math.PI / 2);
        const clamp = new THREE.Mesh(clampGeo, metalMat);
        clamp.position.y = 0.35;
        if (isM) addContour(clamp, mats.mWorldWireframe);
        group.add(clamp);

        // 3 светящиеся сферы данных внутри (вершины)
        const sphereGeo = new THREE.SphereGeometry(0.14, 20, 20);
        const dataMat = new THREE.MeshStandardMaterial({
          color: 0x00e5ff,
          emissive: 0x00b8d4,
          emissiveIntensity: isM ? 0.25 : 0.75,
          roughness: 0.2,
        });

        [-0.32, 0, 0.32].forEach((x) => {
          const orb = new THREE.Mesh(sphereGeo, dataMat);
          orb.position.set(x, 0.35, 0);
          group.add(orb);
        });
        return group;
      }

      case 'gpu:VertexLayout': {
        // Перфорированная магнитная плита атрибутов (VAO / VertexInputState)
        const plateGeo = new RoundedBoxGeometry(1.1, 0.08, 1.1, 3, 0.03);
        const plate = new THREE.Mesh(plateGeo, bodyMat);
        plate.position.y = 0.12;
        plate.castShadow = !isM;
        if (isM) addContour(plate, mats.mWorldWireframe);
        group.add(plate);

        // Сетка контактных пинов (location 0, 1, 2)
        const pinGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.04, 12);
        for (let ix = -2; ix <= 2; ix++) {
          for (let iz = -2; iz <= 2; iz++) {
            const pin = new THREE.Mesh(pinGeo, metalMat);
            pin.position.set(ix * 0.18, 0.17, iz * 0.18);
            group.add(pin);
          }
        }
        return group;
      }

      case 'gpu:ShaderStage': {
        // Оптическая линза шейдера в алюминиевой оправе
        const stageType = ctx.meta?.stage;
        const lensTint =
          stageType === 'fragment' ? 0xffab40 : stageType === 'compute' ? 0x69f0ae : 0x80d8ff;

        const rimGeo = new THREE.TorusGeometry(0.45, 0.035, 16, 48);
        rimGeo.rotateY(Math.PI / 2);
        const rim = new THREE.Mesh(rimGeo, metalMat);
        rim.name = 'shaderRim';
        rim.position.y = 0.55;
        if (isM) addContour(rim, mats.mWorldWireframe);
        group.add(rim);

        const lensGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.05, 36);
        lensGeo.rotateZ(Math.PI / 2);
        const tintedGlass = isM
          ? mats.mWorldPolycarbonate
          : new THREE.MeshPhysicalMaterial({
              color: lensTint,
              roughness: 0.15,
              transmission: 0.7,
              transparent: true,
              opacity: 0.85,
            });
        const lens = new THREE.Mesh(lensGeo, tintedGlass);
        lens.position.y = 0.55;
        group.add(lens);

        // Низкая подставка-опора
        const standGeo = new RoundedBoxGeometry(0.24, 0.12, 0.4, 2, 0.03);
        const stand = new THREE.Mesh(standGeo, bodyMat);
        stand.position.y = 0.06;
        group.add(stand);

        return group;
      }

      case 'gpu:Pipeline': {
        // Прецизионная оптическая рельса конвейера с направляющим пазом
        const railGeo = new RoundedBoxGeometry(2.4, 0.16, 0.65, 4, 0.05);
        const rail = new THREE.Mesh(railGeo, bodyMat);
        rail.position.y = 0.08;
        rail.castShadow = !isM;
        rail.receiveShadow = !isM;
        if (isM) addContour(rail, mats.mWorldWireframe);
        group.add(rail);

        // Центральный световой канал внутри рельсы
        const trackGeo = new THREE.BoxGeometry(2.2, 0.03, 0.14);
        const trackMat = isM ? mats.mWorldPolycarbonate : mats.accentActive;
        const track = new THREE.Mesh(trackGeo, trackMat);
        track.position.y = 0.16;
        group.add(track);

        return group;
      }

      case 'gpu:Texture': {
        // Стек стеклянных слоев текстуры на алюминиевой базе
        const baseGeo = new RoundedBoxGeometry(0.9, 0.12, 0.45, 3, 0.03);
        const base = new THREE.Mesh(baseGeo, metalMat);
        base.position.y = 0.06;
        if (isM) addContour(base, mats.mWorldWireframe);
        group.add(base);

        const layerGeo = new RoundedBoxGeometry(0.82, 0.85, 0.04, 2, 0.01);
        [-0.08, 0.08].forEach((z) => {
          const layer = new THREE.Mesh(layerGeo, glassMat);
          layer.position.set(0, 0.52, z);
          if (isM) addContour(layer, mats.mWorldWireframe);
          group.add(layer);
        });
        return group;
      }

      case 'gpu:Descriptor': {
        // Плата-адаптер ресурсов с алюминиевой гребенкой контактов
        const cardGeo = new RoundedBoxGeometry(0.85, 0.1, 1.15, 3, 0.03);
        const card = new THREE.Mesh(cardGeo, bodyMat);
        card.position.y = 0.08;
        card.castShadow = !isM;
        if (isM) addContour(card, mats.mWorldWireframe);
        group.add(card);

        // Контактная гребенка спереди
        const pinGeo = new THREE.BoxGeometry(0.06, 0.04, 0.18);
        for (let i = -3; i <= 3; i++) {
          const pin = new THREE.Mesh(pinGeo, metalMat);
          pin.position.set(i * 0.1, 0.08, 0.55);
          group.add(pin);
        }
        return group;
      }

      case 'gpu:Framebuffer': {
        // Стеклянная панель вывода в алюминиевой подставке
        const standGeo = new RoundedBoxGeometry(1.5, 0.14, 0.42, 3, 0.04);
        const stand = new THREE.Mesh(standGeo, metalMat);
        stand.position.y = 0.07;
        stand.castShadow = !isM;
        if (isM) addContour(stand, mats.mWorldWireframe);
        group.add(stand);

        const screenGeo = new RoundedBoxGeometry(1.42, 1.05, 0.06, 3, 0.02);
        const screen = new THREE.Mesh(screenGeo, glassMat);
        screen.position.y = 0.65;
        if (isM) addContour(screen, mats.mWorldWireframe);
        group.add(screen);

        return group;
      }

      case 'gpu:CommandQueue': {
        // Наклонный диспенсер с карточками команд отрисовки (Draw Calls)
        const trayGeo = new RoundedBoxGeometry(0.75, 0.14, 1.1, 3, 0.04);
        const tray = new THREE.Mesh(trayGeo, bodyMat);
        tray.position.y = 0.07;
        tray.castShadow = !isM;
        if (isM) addContour(tray, mats.mWorldWireframe);
        group.add(tray);

        const cardGeo = new RoundedBoxGeometry(0.58, 0.45, 0.05, 2, 0.01);
        for (let i = 0; i < 4; i++) {
          const cmdCard = new THREE.Mesh(cardGeo, metalMat);
          cmdCard.position.set(0, 0.28, -0.3 + i * 0.2);
          cmdCard.rotation.x = -0.35;
          if (isM) addContour(cmdCard, mats.mWorldWireframe);
          group.add(cmdCard);
        }
        return group;
      }

      default:
        return null;
    }
  },

  updateEntityObject(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void {
    // Плавное дыхание индикатора в R-мире (не чаще 1 Гц, безопасно для accessibility)
    if (kind === 'gpu:ShaderStage' && ctx.world === 'R') {
      const rim = group.getObjectByName('shaderRim');
      if (rim) {
        rim.rotation.x = Math.sin(elapsed * 1.5) * 0.08;
      }
    }
  },
};
