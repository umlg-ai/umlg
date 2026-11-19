import * as THREE from 'three';
import { ThemeContext, VisualProfilePlugin } from '../../types';
import { addBlueprintEdges, createAccentMaterial, createBaseMaterial } from '../materials';

export const graphicsGpuPlugin: VisualProfilePlugin = {
  profileId: 'graphics-gpu',
  label: 'Graphics Pipeline (OpenGL / Vulkan)',
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
    const baseMat = createBaseMaterial(ctx);
    const accentMat = createAccentMaterial(ctx, 0xff6d00);

    switch (kind) {
      case 'gpu:Buffer': {
        // Сырьевой бункер (VBO / EBO / UBO) с прозрачным окном и сегментами данных
        const container = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.5, 1.1), baseMat);
        addBlueprintEdges(container, isM);
        group.add(container);

        const dataMat = createAccentMaterial(ctx, 0x00e5ff);
        for (let i = 0; i < 4; i++) {
          const ingot = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 1.16), dataMat);
          ingot.position.y = -0.48 + i * 0.32;
          group.add(ingot);
        }
        return group;
      }

      case 'gpu:VertexLayout': {
        // Распределительный щит (VAO / VertexInputState) с гнездами атрибутов
        const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.35), baseMat);
        addBlueprintEdges(panel, isM);
        group.add(panel);

        for (let i = -1; i <= 1; i++) {
          const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12), accentMat);
          socket.rotation.x = Math.PI / 2;
          socket.position.set(i * 0.42, 0.15, 0.05);
          group.add(socket);
        }
        return group;
      }

      case 'gpu:ShaderStage': {
        // Оптическая призма (Vertex / Fragment / Compute)
        const stageType = ctx.meta?.stage;
        const crystalColor =
          stageType === 'fragment' ? 0xe040fb : stageType === 'compute' ? 0x00e676 : 0x00e5ff;
        const crystalMat = createAccentMaterial(ctx, crystalColor);

        const housing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.75, 0.75, 1.2, 6, 1, true),
          baseMat
        );
        housing.rotation.z = Math.PI / 2;
        const prism = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), crystalMat);
        prism.name = 'shaderPrism';

        addBlueprintEdges(housing, isM);
        group.add(housing, prism);
        return group;
      }

      case 'gpu:Pipeline': {
        // Главный сборочный туннель (ShaderProgram / VkPipeline) с силовыми арками
        const tunnel = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.3, 1.4), baseMat);
        addBlueprintEdges(tunnel, isM);
        group.add(tunnel);

        for (let i = -0.8; i <= 0.8; i += 0.8) {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.06, 8, 4), accentMat);
          rib.rotation.y = Math.PI / 2;
          rib.rotation.x = Math.PI / 4;
          rib.position.x = i;
          group.add(rib);
        }
        return group;
      }

      case 'gpu:Texture': {
        // Резервуар с пигментом и оптической линзой сэмплера
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16), baseMat);
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), accentMat);
        lens.position.set(0, 0, 0.52);
        lens.scale.set(1, 1, 0.4);

        addBlueprintEdges(tank, isM);
        group.add(tank, lens);
        return group;
      }

      case 'gpu:Descriptor': {
        // Шина регуляторов (Uniform / DescriptorSet)
        const bus = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 0.45), baseMat);
        const core = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.5), accentMat);
        addBlueprintEdges(bus, isM);
        group.add(bus, core);
        return group;
      }

      case 'gpu:Framebuffer': {
        // Финальный терминал вывода (FBO / Swapchain) с экраном результата
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 0.4), baseMat);
        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(1.45, 0.95),
          createAccentMaterial(ctx, 0x00e676)
        );
        screen.position.z = 0.21;

        addBlueprintEdges(frame, isM);
        group.add(frame, screen);
        return group;
      }

      case 'gpu:CommandQueue': {
        // Конвейерная лента команд (CommandBuffer / VkQueue)
        const track = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 0.7), baseMat);
        addBlueprintEdges(track, isM);
        group.add(track);

        for (let i = -0.6; i <= 0.6; i += 0.6) {
          const cmdCapsule = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.45), accentMat);
          cmdCapsule.position.set(i, 0.24, 0);
          group.add(cmdCapsule);
        }
        return group;
      }

      default:
        return null;
    }
  },

  updateEntityObject(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void {
    if (kind === 'gpu:ShaderStage') {
      const prism = group.getObjectByName('shaderPrism');
      if (prism) {
        prism.rotation.x = elapsed * (ctx.world === 'R' ? 2.2 : 0.4);
        prism.rotation.y = elapsed * 1.1;
      }
    }
  },
};
