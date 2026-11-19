import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ThemeEnvironment, WorldMode } from './types';

export class ThemeEnvironmentRenderer {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gridHelper: THREE.GridHelper | null = null;
  private ambientLight: THREE.AmbientLight;
  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera
  ) {
    // 1. Включаем корректную цветопередачу и тени для R-мира
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 2. Трёхточечное освещение (ключевой, заполняющий и контровой свет для читаемости силуэтов)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    this.keyLight.position.set(12, 20, 14);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0x00e5ff, 0.9);
    this.rimLight.position.set(-14, 10, -12);
    this.scene.add(this.rimLight);

    // 3. Настройка конвейера постобработки (Render -> Bloom -> ToneMapping/Output)
    const size = new THREE.Vector2();
    this.renderer.getSize(size);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(size, 0.5, 0.4, 0.8);
    this.composer.addPass(this.bloomPass);

    // OutputPass обязателен в современных версиях Three.js для сохранения sRGB и ACESFilmicToneMapping
    this.composer.addPass(new OutputPass());
  }

  /** Применяет параметры среды при смене темы или фазовом переходе M <-> R */
  public applyEnvironment(env: ThemeEnvironment, world: WorldMode): void {
    // Фон и экспоненциальный туман глубины
    this.scene.background = new THREE.Color(env.backgroundColor);
    this.scene.fog = new THREE.FogExp2(env.fogColor, env.fogDensity);

    // Параметры свечения (Bloom)
    this.bloomPass.strength = env.bloomStrength;
    this.bloomPass.radius = env.bloomRadius;
    this.bloomPass.threshold = env.bloomThreshold;

    // Адаптация света под онтологию мира
    if (world === 'M') {
      this.ambientLight.intensity = 0.7;
      this.keyLight.intensity = 0.8;
      this.rimLight.color.setHex(0x00e5ff);
      this.rimLight.intensity = 1.4;
    } else {
      this.ambientLight.intensity = 0.35;
      this.keyLight.intensity = 2.2;
      this.rimLight.color.setHex(0xff8f00); // Теплый индустриальный контровой отсвет
      this.rimLight.intensity = 0.85;
    }

    // Перестройка координатной сетки пола
    this.rebuildGrid(env.gridPrimaryColor, env.gridSecondaryColor);
  }

  private rebuildGrid(primaryColor: number, secondaryColor: number): void {
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
      this.gridHelper.geometry.dispose();
    }
    this.gridHelper = new THREE.GridHelper(60, 60, primaryColor, secondaryColor);
    this.gridHelper.position.y = -0.01;
    this.scene.add(this.gridHelper);
  }

  public onResize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  /** Вызывать в основном цикле анимации вместо renderer.render(scene, camera) */
  public render(): void {
    this.composer.render();
  }

  public dispose(): void {
    this.composer.dispose();
  }
}

