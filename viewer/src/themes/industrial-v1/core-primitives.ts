import * as THREE from 'three';
import { CoreEntityKind, CoreLinkKind, ThemeContext } from '../types';
import { addBlueprintEdges, createAccentMaterial, createBaseMaterial } from './materials';

export function createCoreEntity(kind: CoreEntityKind, ctx: ThemeContext): THREE.Group {
  const group = new THREE.Group();
  const isM = ctx.world === 'M';
  const baseMat = createBaseMaterial(ctx);
  const accentMat = createAccentMaterial(ctx, 0xff6d00);
  const statusMat = createAccentMaterial(ctx, 0x00e676);

  switch (kind) {
    case 'Class': {
      // Производственный модуль со скошенной крышкой и сервисным маячком
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), baseMat);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.95, 0.35, 6), baseMat);
      top.position.y = 0.67;
      const beacon = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.15), statusMat);
      beacon.position.set(0, 0.2, 0.72);
      beacon.name = 'rotor';

      addBlueprintEdges(body, isM);
      addBlueprintEdges(top, isM);
      group.add(body, top, beacon);
      break;
    }

    case 'AbstractClass': {
      // Незавершенная силовая рама (каркас) с парящим ядром-заглушкой
      const frameGeo = new THREE.BoxGeometry(1.7, 1.2, 1.5);
      const edges = new THREE.EdgesGeometry(frameGeo);
      const frame = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: isM ? 0x00e5ff : 0xffab00 })
      );
      const ghostCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        createAccentMaterial(ctx, 0xffab00)
      );
      ghostCore.name = 'rotor';
      group.add(frame, ghostCore);
      break;
    }

    case 'Interface': {
      // Стыковочный фланец / промышленный порт
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.14, 12, 8), baseMat);
      const innerPort = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 16), accentMat);
      addBlueprintEdges(ring, isM);
      group.add(ring, innerPort);
      break;
    }

    case 'Struct': {
      // Грузовой контейнер / кассета с ребрами жесткости
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.85, 1.1), baseMat);
      addBlueprintEdges(box, isM);
      group.add(box);

      for (let i = -1; i <= 1; i++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 1.16), accentMat);
        rib.position.x = i * 0.42;
        group.add(rib);
      }
      break;
    }

    case 'Enum': {
      // Револьверный барабан с секторами и указателем
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.5, 8), baseMat);
      const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.35, 4), accentMat);
      pointer.position.set(0, 0.45, 0.55);
      pointer.rotation.x = Math.PI;
      drum.name = 'rotor';

      addBlueprintEdges(drum, isM);
      group.add(drum, pointer);
      break;
    }

    case 'Store': {
      // Стойка-накопитель / силос с ярусами светодиодных шкал
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 1.0), baseMat);
      addBlueprintEdges(rack, isM);
      group.add(rack);

      for (let i = 0; i < 4; i++) {
        const cell = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 1.06), statusMat);
        cell.position.y = -0.5 + i * 0.34;
        group.add(cell);
      }
      break;
    }

    case 'Channel': {
      // Шина / распределительный коллектор с капсулами сообщений
      const track = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.7), baseMat);
      addBlueprintEdges(track, isM);
      group.add(track);

      for (let i = -0.6; i <= 0.6; i += 0.6) {
        const packet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.2, 0.42), accentMat);
        packet.position.set(i, 0.23, 0);
        group.add(packet);
      }
      break;
    }

    case 'Process':
    default: {
      // Турбина / узел трансформации (безопасный фолбэк ядра)
      const turbine = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.75, 1.3, 12), baseMat);
      turbine.rotation.z = Math.PI / 2;
      const rotor = new THREE.Mesh(new THREE.TorusKnotGeometry(0.32, 0.08, 32, 8), accentMat);
      rotor.name = 'rotor';

      addBlueprintEdges(turbine, isM);
      group.add(turbine, rotor);
      break;
    }
  }

  return group;
}

export function updateCoreEntity(
  group: THREE.Group,
  kind: CoreEntityKind,
  ctx: ThemeContext,
  elapsed: number
): void {
  const rotor = group.getObjectByName('rotor');
  if (!rotor) return;

  if (ctx.world === 'M') {
    rotor.position.y += Math.sin(elapsed * 2.0) * 0.0008;
    rotor.rotation.y = elapsed * 0.3;
  } else {
    if (kind === 'Process') {
      rotor.rotation.x = elapsed * 2.5;
    } else if (kind === 'AbstractClass') {
      rotor.rotation.y = elapsed * 1.4;
    }
  }
}

export function createCoreLink(kind: CoreLinkKind, points: THREE.Vector3[], ctx: ThemeContext): THREE.Group {
  const group = new THREE.Group();
  const isM = ctx.world === 'M';
  const curve = new THREE.CatmullRomCurve3(points);

  const radius = kind === 'Inheritance' || kind === 'Composition' ? 0.08 : 0.05;
  const tubeGeo = new THREE.TubeGeometry(curve, 32, radius, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: isM ? 0x00e5ff : kind === 'Inheritance' ? 0x78909c : 0x37474f,
    transparent: isM,
    opacity: isM ? 0.35 : 0.9,
    roughness: 0.4,
    metalness: 0.8,
  });

  const pipe = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(pipe);

  if (kind === 'DataFlow' || kind === 'ControlFlow') {
    const pulseColor = kind === 'DataFlow' ? 0xff6d00 : 0x00e676;
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 12),
      createAccentMaterial(ctx, pulseColor)
    );
    pulse.name = 'dataPulse';
    pulse.userData.curve = curve;
    group.add(pulse);
  }

  return group;
}

export function updateCoreLink(group: THREE.Group, kind: CoreLinkKind, ctx: ThemeContext, elapsed: number): void {
  const pulse = group.getObjectByName('dataPulse') as THREE.Mesh | undefined;
  if (!pulse || !pulse.userData.curve) return;

  const isFlow = kind === 'DataFlow' || kind === 'ControlFlow';
  pulse.visible = ctx.world === 'R' && isFlow;
  if (pulse.visible) {
    const t = (elapsed * 0.45) % 1;
    const pos = (pulse.userData.curve as THREE.CatmullRomCurve3).getPointAt(t);
    pulse.position.copy(pos);
  }
}

