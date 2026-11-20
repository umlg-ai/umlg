import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { TactileMaterials } from './materials';

// Вспомогательная функция для добавления аккуратного контура к геометрии
function addEdges(mesh: THREE.Mesh, material: THREE.LineBasicMaterial): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
  const line = new THREE.LineSegments(edges, material);
  mesh.add(line);
}

/**
 * 1. OBJECT (R-мир): Тактильный монолит-модуль со слайдерами и портами
 */
export function buildObjectMesh(mats: TactileMaterials, isPreview = false): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = isPreview ? mats.mWorldPolycarbonate : mats.mattePlastic;

  // Основной скругленный корпус
  const bodyGeo = new RoundedBoxGeometry(1.1, 0.38, 1.3, 4, 0.08);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.19;
  body.castShadow = !isPreview;
  body.receiveShadow = !isPreview;
  if (isPreview) addEdges(body, mats.mWorldWireframe);
  group.add(body);

  // 4 тактильных паза-слайдера на верхней крышке (атрибуты/состояние)
  const slotGeo = new RoundedBoxGeometry(0.1, 0.04, 0.75, 2, 0.02);
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(slotGeo, isPreview ? mats.mWorldPolycarbonate : mats.anodizedAluminum);
    slot.position.set(-0.3 + i * 0.2, 0.38, -0.05);
    group.add(slot);
  }

  // Торцевые алюминиевые порты (методы)
  const portGeo = new RoundedBoxGeometry(0.18, 0.12, 0.06, 2, 0.02);
  for (let i = 0; i < 2; i++) {
    const port = new THREE.Mesh(portGeo, mats.anodizedAluminum);
    port.position.set(-0.2 + i * 0.4, 0.18, 0.65);
    group.add(port);
  }

  return group;
}

/**
 * 2. CLASS (M-мир): Стеклянная витрина с миниатюрой R-двойника внутри
 */
export function buildClassMesh(mats: TactileMaterials, rPreviewMesh?: THREE.Group): THREE.Group {
  const group = new THREE.Group();

  // Витрина из поликарбоната
  const showcaseGeo = new RoundedBoxGeometry(1.4, 1.1, 1.4, 3, 0.06);
  const showcase = new THREE.Mesh(showcaseGeo, mats.mWorldPolycarbonate);
  showcase.position.y = 0.55;
  addEdges(showcase, mats.mWorldWireframe);
  group.add(showcase);

  // Тонкий алюминиевый плинт в основании
  const baseGeo = new RoundedBoxGeometry(1.44, 0.06, 1.44, 2, 0.02);
  const base = new THREE.Mesh(baseGeo, mats.anodizedAluminum);
  base.position.y = 0.03;
  group.add(base);

  // Внутренняя миниатюра будущего R-модуля (если передана)
  if (rPreviewMesh) {
    rPreviewMesh.scale.setScalar(0.55);
    rPreviewMesh.position.y = 0.25;
    group.add(rPreviewMesh);
  }

  return group;
}

/**
 * 3. ABSTRACT CLASS (M-мир): Разомкнутый контур без заполнения и без макета
 */
export function buildAbstractClassMesh(mats: TactileMaterials): THREE.Group {
  const group = new THREE.Group();

  // Создаем П-образный разомкнутый каркас (отсутствует верхнее переднее ребро)
  const railThickness = 0.03;
  const size = 1.3;
  const height = 1.0;

  const verticalGeo = new THREE.BoxGeometry(railThickness, height, railThickness);
  const corners = [
    [-size / 2, -size / 2],
    [size / 2, -size / 2],
    [-size / 2, size / 2],
    [size / 2, size / 2],
  ];

  corners.forEach(([x, z]) => {
    const post = new THREE.Mesh(verticalGeo, mats.mWorldPolycarbonate);
    post.position.set(x, height / 2, z);
    addEdges(post, mats.mWorldWireframe);
    group.add(post);
  });

  // Пунктирная рамка основания
  const baseGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, 0.02, size));
  const dashedMat = new THREE.LineDashedMaterial({
    color: 0x37474f,
    dashSize: 0.1,
    gapSize: 0.08,
  });
  const baseLine = new THREE.LineSegments(baseGeo, dashedMat);
  baseLine.computeLineDistances();
  baseLine.position.y = 0.02;
  group.add(baseLine);

  return group;
}

/**
 * 4. INTERFACE (M-мир): Парящая пластина из матового стекла со сквозным портом
 */
export function buildInterfaceMesh(mats: TactileMaterials): THREE.Group {
  const group = new THREE.Group();

  // Алюминиевое основание-рамка
  const frameGeo = new RoundedBoxGeometry(1.2, 0.08, 1.2, 3, 0.04);
  const frame = new THREE.Mesh(frameGeo, mats.anodizedAluminum);
  frame.position.y = 0.15;
  group.add(frame);

  // Стеклянная пластина контракта сверху на 4 стойках
  const glassGeo = new RoundedBoxGeometry(1.16, 0.06, 1.16, 3, 0.04);
  const glass = new THREE.Mesh(glassGeo, mats.frostedGlass);
  glass.position.y = 0.34;
  addEdges(glass, mats.mWorldWireframe);
  group.add(glass);

  // 4 угловые стойки крепления
  const pinGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12);
  const offsets = [-0.45, 0.45];
  offsets.forEach((x) => {
    offsets.forEach((z) => {
      const pin = new THREE.Mesh(pinGeo, mats.anodizedAluminum);
      pin.position.set(x, 0.25, z);
      group.add(pin);
    });
  });

  return group;
}

/**
 * 5. COMPONENT (M-мир): Низкий подиум-лоток с угловыми стойками
 */
export function buildComponentMesh(mats: TactileMaterials): THREE.Group {
  const group = new THREE.Group();

  const trayGeo = new RoundedBoxGeometry(1.8, 0.14, 1.8, 4, 0.06);
  const tray = new THREE.Mesh(trayGeo, mats.mattePlastic);
  tray.position.y = 0.07;
  tray.receiveShadow = true;
  group.add(tray);

  // Бортики по периметру
  const borderGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.74, 0.22, 1.74));
  const border = new THREE.LineSegments(borderGeo, mats.mWorldWireframe);
  border.position.y = 0.18;
  group.add(border);

  return group;
}

/**
 * 6. CONCEPT (M-мир): Гранёный октаэдр из матового стекла с внутренним ядром
 */
export function buildConceptMesh(mats: TactileMaterials): THREE.Group {
  const group = new THREE.Group();

  const outerGeo = new THREE.OctahedronGeometry(0.55, 0);
  const outer = new THREE.Mesh(outerGeo, mats.frostedGlass);
  outer.position.y = 0.65;
  addEdges(outer, mats.mWorldWireframe);
  group.add(outer);

  const coreGeo = new THREE.OctahedronGeometry(0.22, 0);
  const core = new THREE.Mesh(coreGeo, mats.anodizedAluminum);
  core.position.y = 0.65;
  group.add(core);

  return group;
}

/**
 * 7. RESOURCE (R-мир): Стойка памяти (док-станция со съемными картриджами)
 */
export function buildResourceMesh(mats: TactileMaterials, isPreview = false): THREE.Group {
  const group = new THREE.Group();
  const baseMat = isPreview ? mats.mWorldPolycarbonate : mats.mattePlastic;

  // База док-станции
  const dockGeo = new RoundedBoxGeometry(1.0, 0.28, 0.9, 3, 0.05);
  const dock = new THREE.Mesh(dockGeo, baseMat);
  dock.position.y = 0.14;
  dock.castShadow = !isPreview;
  group.add(dock);

  // 4 вертикальных модуля памяти (картриджа)
  const cardGeo = new RoundedBoxGeometry(0.75, 0.55, 0.1, 2, 0.02);
  for (let i = 0; i < 4; i++) {
    const card = new THREE.Mesh(cardGeo, isPreview ? mats.mWorldPolycarbonate : mats.anodizedAluminum);
    card.position.set(0, 0.42, -0.27 + i * 0.18);
    if (isPreview) addEdges(card, mats.mWorldWireframe);
    group.add(card);
  }

  return group;
}

/**
 * 8. PROCESS (R-мир): Алюминиевый вычислительный куб с ротором и LED-полосой
 */
export function buildProcessMesh(mats: TactileMaterials, isPreview = false): THREE.Group {
  const group = new THREE.Group();

  // Основной алюминиевый корпус
  const boxGeo = new RoundedBoxGeometry(0.95, 0.85, 0.95, 4, 0.08);
  const box = new THREE.Mesh(boxGeo, isPreview ? mats.mWorldPolycarbonate : mats.anodizedAluminum);
  box.position.y = 0.48;
  box.castShadow = !isPreview;
  if (isPreview) addEdges(box, mats.mWorldWireframe);
  group.add(box);

  // Нижняя пластиковая база со световой индикацией
  const baseGeo = new RoundedBoxGeometry(0.92, 0.12, 0.92, 3, 0.04);
  const base = new THREE.Mesh(baseGeo, isPreview ? mats.mWorldPolycarbonate : mats.mattePlastic);
  base.position.y = 0.06;
  group.add(base);

  // Поворотный диск-индикатор сверху (именован для анимации в цикле рендера)
  const rotorGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24);
  const rotor = new THREE.Mesh(rotorGeo, isPreview ? mats.mWorldPolycarbonate : mats.mattePlastic);
  rotor.name = 'ProcessRotor';
  rotor.position.y = 0.92;
  group.add(rotor);

  return group;
}

/**
 * 9. STAGE (R-мир): Стеклянный направляющий канал в алюминиевых муфтах
 */
export function buildStageMesh(mats: TactileMaterials, isPreview = false): THREE.Group {
  const group = new THREE.Group();

  // Прозрачная стеклянная труба канала
  const tubeGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.3, 24);
  tubeGeo.rotateZ(Math.PI / 2);
  const tube = new THREE.Mesh(tubeGeo, isPreview ? mats.mWorldPolycarbonate : mats.frostedGlass);
  tube.position.y = 0.35;
  group.add(tube);

  // Две алюминиевые торцевые муфты
  const ringGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.14, 24);
  ringGeo.rotateZ(Math.PI / 2);
  [-0.6, 0.6].forEach((x) => {
    const ring = new THREE.Mesh(ringGeo, mats.anodizedAluminum);
    ring.position.set(x, 0.35, 0);
    group.add(ring);
  });

  return group;
}

/**
 * 10. COMMAND (R-мир): Гранёный носитель-капсула на компактной площадке
 */
export function buildCommandMesh(mats: TactileMaterials, isPreview = false): THREE.Group {
  const group = new THREE.Group();

  const padGeo = new RoundedBoxGeometry(0.6, 0.08, 0.6, 2, 0.02);
  const pad = new THREE.Mesh(padGeo, mats.mattePlastic);
  pad.position.y = 0.04;
  group.add(pad);

  const capsuleGeo = new THREE.ConeGeometry(0.18, 0.45, 6);
  capsuleGeo.rotateZ(-Math.PI / 2);
  const capsule = new THREE.Mesh(capsuleGeo, isPreview ? mats.mWorldPolycarbonate : mats.anodizedAluminum);
  capsule.name = 'CommandCapsule';
  capsule.position.y = 0.32;
  group.add(capsule);

  return group;
}

/**
 * 11. ACTOR (R-мир): Гироскопический пульт (два скрещённых кольца вокруг ядра)
 */
export function buildActorMesh(mats: TactileMaterials): THREE.Group {
  const group = new THREE.Group();

  const ring1Geo = new THREE.TorusGeometry(0.5, 0.035, 16, 48);
  const ring1 = new THREE.Mesh(ring1Geo, mats.anodizedAluminum);
  ring1.position.y = 0.65;
  group.add(ring1);
  
  const ring2Geo = new THREE.TorusGeometry(0.4, 0.03, 16, 48);
  const ring2 = new THREE.Mesh(ring2Geo, mats.mattePlastic);
  ring2.rotation.y = Math.PI / 2;
  ring2.position.y = 0.65;
  group.add(ring2);
  
  const coreGeo = new THREE.SphereGeometry(0.14, 24, 24);
  const core = new THREE.Mesh(coreGeo, mats.accentWarning);
  core.position.y = 0.65;
  group.add(core);
	
  return group;
}