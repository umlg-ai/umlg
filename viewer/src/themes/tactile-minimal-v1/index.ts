import * as THREE from 'three';
import {
  CoreEntityKind,
  ThemeContext,
  ThemeDefinition,
  ThemeEnvironment,
  WorldMode,
} from '../types';
import { createTactileMaterials } from './materials';
import {
  buildAbstractClassMesh,
  buildActorMesh,
  buildClassMesh,
  buildCommandMesh,
  buildComponentMesh,
  buildConceptMesh,
  buildInterfaceMesh,
  buildObjectMesh,
  buildProcessMesh,
  buildResourceMesh,
  buildStageMesh,
} from './core-primitives';
import { KIND_TO_GLB, TAG_TO_GLB, loadGlbIntoGroup } from './glb-loader';
import { tactileGraphicsGpuPlugin } from './profiles/graphics-gpu';

const materials = createTactileMaterials();

/**
 * Карта запасного пути: CoreEntityKind -> вид UMLG.
 * Нужна, если элемент пришёл из места, где `meta.entityKind` не передан.
 */
function coreKindToEntityKind(kind: string, world: WorldMode): string {
  switch (kind) {
    case 'AbstractClass':
      return 'abstractClass';
    case 'Interface':
      return 'interface';
    case 'Struct':
    case 'Enum':
      return 'concept';
    case 'Store':
      return 'resource';
    case 'Process':
      return 'process';
    case 'Channel':
      return 'command';
    case 'Class':
    default:
      return world === 'M' ? 'class' : 'object';
  }
}

/** Точный вид UMLG: из meta, иначе — из CoreEntityKind и мира наблюдателя. */
function resolveVisualKind(kind: string, ctx: ThemeContext): string {
  const tagged = ctx.meta?.entityKind;
  if (typeof tagged === 'string' && tagged.length > 0) return tagged;
  return coreKindToEntityKind(kind, ctx.world);
}

/** Определяет имя GLB-файла по тегам элемента или его visualKind. */
function resolveGlbFilename(visualKind: string, ctx?: ThemeContext): string | undefined {
  const tags = Array.isArray(ctx?.meta?.tags) ? (ctx!.meta!.tags as string[]) : [];
  for (const tag of tags) {
    if (TAG_TO_GLB[tag]) return TAG_TO_GLB[tag];
  }
  return KIND_TO_GLB[visualKind];
}

/** Процедурный фолбэк, который отображается мгновенно, пока грузится .glb. */
function buildProceduralFallback(kind: string, asPreview = false): THREE.Group {
  switch (kind) {
    case 'object':
      return buildObjectMesh(materials, asPreview);
    case 'resource':
      return buildResourceMesh(materials, asPreview);
    case 'process':
      return buildProcessMesh(materials, asPreview);
    case 'stage':
      return buildStageMesh(materials, asPreview);
    case 'command':
      return buildCommandMesh(materials, asPreview);
    case 'actor':
      return buildActorMesh(materials);
    case 'abstractClass':
      return buildAbstractClassMesh(materials);
    case 'interface':
      return buildInterfaceMesh(materials);
    case 'component':
      return buildComponentMesh(materials);
    case 'concept':
      return buildConceptMesh(materials);
    default:
      // Безопасный фолбэк для неизвестных видов (согласно инварианту №4 в AGENTS.md)
      return buildObjectMesh(materials, asPreview);
  }
}

/**
 * Создает 3D-представление базовой сущности Core UMLG из GLB-модели
 * с процедурным фолбэком на время асинхронной загрузки.
 * Параметр `asPreview` используется для рендера полупрозрачной миниатюры
 * R-двойника внутри стеклянной витрины M-класса.
 */
function buildCoreMesh(kind: string, asPreview = false, ctx?: ThemeContext): THREE.Group {
  const fallback = buildProceduralFallback(kind, asPreview);
  const glbFile = resolveGlbFilename(kind, ctx);

  if (!glbFile) return fallback;
  return loadGlbIntoGroup(glbFile, materials, fallback, asPreview);
}

function getTactileEnvironment(world: WorldMode): ThemeEnvironment {
  const isM = world === 'M';
  return {
    backgroundColor: isM ? 0xdde3e8 : 0xeef1f4,
    fogColor: isM ? 0xdde3e8 : 0xeef1f4,
    // Светлая студия: туман почти не нужен, иначе сцена вымывается в белое.
    fogDensity: isM ? 0.0035 : 0.0025,
    gridPrimaryColor: isM ? 0x78909c : 0xcfd8dc,
    gridSecondaryColor: isM ? 0xb0bec5 : 0xe4e7eb,
    bloomStrength: isM ? 0.06 : 0.04,
    bloomRadius: 0.35,
    bloomThreshold: 0.9,
    // Нейтральный студийный свет вместо неонового индустриального контрового.
    ambientIntensity: isM ? 0.55 : 0.6,
    keyIntensity: isM ? 0.75 : 1.35,
    rimIntensity: isM ? 0.35 : 0.45,
    rimColor: isM ? 0x90a4ae : 0xffffff,
    showGrid: isM,
  };
}

export const tactileMinimalTheme: ThemeDefinition = {
  id: 'tactile-minimal-v1',
  label: 'Tactile Minimalism (Studio v1)',
  description:
    'Чистый промышленный дизайн в стиле Braun / Teenage Engineering: матовый пластик, анодированный алюминий и матовое стекло без визуального шума.',
  getEnvironment: getTactileEnvironment,
  rendersPreview: true,

  createEntityObject(kind: CoreEntityKind, ctx: ThemeContext): THREE.Group {
    const visualKind = resolveVisualKind(kind, ctx);

    // Правило №5 (03-visual-grammar.md): внутри стеклянной витрины M-класса
    // стоит полупрозрачная миниатюра его R-двойника (если есть materializes).
    if (visualKind === 'class' && ctx.world === 'M') {
      const target = ctx.meta?.materializedKind;
      const previewMesh =
        typeof target === 'string' && target.length > 0 ? buildCoreMesh(target, true) : undefined;

      const fallbackShowcase = buildClassMesh(materials);
      const root = loadGlbIntoGroup('class.glb', materials, fallbackShowcase, false);

      if (previewMesh) {
        previewMesh.scale.setScalar(0.55);
        previewMesh.position.y = 0.25;
        root.add(previewMesh);
      }

      return root;
    }

    // В M-мире сущности показываются полупрозрачным чертежом, в R-мире — solid GLB.
    return buildCoreMesh(visualKind, ctx.world === 'M', ctx);
  },

  updateEntityObject(
    group: THREE.Group,
    kind: CoreEntityKind,
    ctx: ThemeContext,
    elapsed: number,
  ): void {
    // Левитация M-мира уже выполняется в ElementVisual; здесь только
    // спокойная индикация работы R-мира (частота строго < 3 Гц).
    if (ctx.world !== 'R') return;

    const visualKind = resolveVisualKind(kind, ctx);
    if (visualKind === 'process') {
      const rotor = group.getObjectByName('ProcessRotor');
      if (rotor) rotor.rotation.y = elapsed * 1.5;
    } else if (visualKind === 'command') {
      const capsule = group.getObjectByName('CommandCapsule');
      if (capsule) capsule.position.x = Math.sin(elapsed * 2.0) * 0.06;
    }
  },

  plugins: [tactileGraphicsGpuPlugin],
};

export { tactileGraphicsGpuPlugin };
