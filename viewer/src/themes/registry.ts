import * as THREE from 'three';
import {
  CoreEntityKind,
  CoreLinkKind,
  ThemeContext,
  ThemeDefinition,
  ThemeEnvironment,
  VisualProfilePlugin,
  WorldMode,
} from './types';
import { industrialV1Theme } from './industrial-v1';
import { minimalV0Theme } from './minimal-v0';
import { tactileMinimalTheme } from './tactile-minimal-v1';

export class ThemeManager {
  private themes = new Map<string, ThemeDefinition>();
  private activeTheme: ThemeDefinition;
  private plugins = new Map<string, VisualProfilePlugin>();
  private enabledProfiles = new Set<string>();
  /** Профили, установленные активной темой (а не внешним кодом). */
  private themePluginIds = new Set<string>();
  /** Явный выбор пользователя переживает переключение тем. */
  private profilePreferences = new Map<string, boolean>();

  constructor(defaultThemeId = 'tactile-minimal-v1') {
    this.registerTheme(industrialV1Theme);
    this.registerTheme(minimalV0Theme);
    this.registerTheme(tactileMinimalTheme);

    this.activeTheme = this.themes.get(defaultThemeId) ?? industrialV1Theme;
    this.installThemePlugins(this.activeTheme);
  }

  registerTheme(theme: ThemeDefinition): void {
    this.themes.set(theme.id, theme);
  }

  getTheme(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }

  getAvailableThemes(): ThemeDefinition[] {
    return Array.from(this.themes.values());
  }

  getActiveTheme(): ThemeDefinition {
    return this.activeTheme;
  }

  setTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId);
    if (!theme) return false;
    this.activeTheme = theme;
    this.installThemePlugins(theme);
    return true;
  }

  registerPlugin(plugin: VisualProfilePlugin, enabledByDefault = false): void {
    this.plugins.set(plugin.profileId, plugin);
    const preferred = this.profilePreferences.get(plugin.profileId);
    if (preferred ?? enabledByDefault) {
      this.enabledProfiles.add(plugin.profileId);
    }
  }

  getPlugin(profileId: string): VisualProfilePlugin | undefined {
    return this.plugins.get(profileId);
  }

  getAvailablePlugins(): VisualProfilePlugin[] {
    return Array.from(this.plugins.values());
  }

  isProfileEnabled(profileId: string): boolean {
    return this.enabledProfiles.has(profileId);
  }

  setProfileEnabled(profileId: string, enabled: boolean): void {
    this.profilePreferences.set(profileId, enabled);
    if (enabled && this.plugins.has(profileId)) {
      this.enabledProfiles.add(profileId);
    } else {
      this.enabledProfiles.delete(profileId);
    }
  }

  getEnvironment(world: WorldMode): ThemeEnvironment {
    return this.activeTheme.getEnvironment(world);
  }

  createEntity(kind: string, ctx: ThemeContext): THREE.Group {
    // 1. Сначала ищем в активных доменных профилях (если есть префикс, например "gpu:Buffer")
    for (const profileId of this.enabledProfiles) {
      const plugin = this.plugins.get(profileId);
      if (plugin && plugin.supportedKinds.includes(kind)) {
        const mesh = plugin.createEntityObject(kind, ctx);
        if (mesh) {
          mesh.userData.domainProfile = profileId;
          mesh.userData.domainKind = kind;
          return mesh;
        }
      }
    }

    // 2. Иначе рендерим через Core UMLG (безопасный фолбэк ядра, если профиль отключен)
    const coreKind = this.normalizeToCoreKind(kind);
    const group = this.activeTheme.createEntityObject(coreKind, ctx);
    group.userData.coreKind = coreKind;
    return group;
  }

  updateEntity(group: THREE.Group, kind: string, ctx: ThemeContext, elapsed: number): void {
    for (const profileId of this.enabledProfiles) {
      const plugin = this.plugins.get(profileId);
      if (plugin && plugin.supportedKinds.includes(kind)) {
        if (plugin.updateEntityObject) {
          plugin.updateEntityObject(group, kind, ctx, elapsed);
          return;
        }
      }
    }

    const coreKind = this.normalizeToCoreKind(kind);
    if (this.activeTheme.updateEntityObject) {
      this.activeTheme.updateEntityObject(group, coreKind, ctx, elapsed);
    }
  }

  createLink(kind: CoreLinkKind, points: THREE.Vector3[], ctx: ThemeContext): THREE.Group {
    if (this.activeTheme.createLinkObject) {
      return this.activeTheme.createLinkObject(kind, points, ctx);
    }
    const group = new THREE.Group();
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: ctx.world === 'M' ? 0x00e5ff : 0xff6d00 });
    group.add(new THREE.Line(geo, mat));
    return group;
  }

  updateLink(group: THREE.Group, kind: CoreLinkKind, ctx: ThemeContext, elapsed: number): void {
    if (this.activeTheme.updateLinkObject) {
      this.activeTheme.updateLinkObject(group, kind, ctx, elapsed);
    }
  }

  /** Ставит профили темы, сохраняя явный выбор пользователя. */
  private installThemePlugins(theme: ThemeDefinition): void {
    const next = new Set((theme.plugins ?? []).map((plugin) => plugin.profileId));
    for (const profileId of this.themePluginIds) {
      if (!next.has(profileId)) this.plugins.delete(profileId);
    }
    for (const plugin of theme.plugins ?? []) {
      const known = this.plugins.has(plugin.profileId);
      this.plugins.set(plugin.profileId, plugin);
      const preferred = this.profilePreferences.get(plugin.profileId);
      if (preferred ?? !known) {
        this.enabledProfiles.add(plugin.profileId);
      } else if (preferred === false) {
        this.enabledProfiles.delete(plugin.profileId);
      }
    }
    this.themePluginIds = next;
  }

  private normalizeToCoreKind(kind: string): CoreEntityKind {
    const validCore: CoreEntityKind[] = [
      'Class',
      'AbstractClass',
      'Interface',
      'Struct',
      'Enum',
      'Process',
      'Store',
      'Channel',
    ];
    if (validCore.includes(kind as CoreEntityKind)) {
      return kind as CoreEntityKind;
    }

    // Безопасный семантический маппинг для отключенных доменных профилей
    if (
      kind.includes('Buffer') ||
      kind.includes('Texture') ||
      kind.includes('Store') ||
      kind.includes('resource')
    ) {
      return 'Store';
    }
    if (
      kind.includes('Layout') ||
      kind.includes('Interface') ||
      kind.includes('Descriptor')
    ) {
      return 'Interface';
    }
    if (
      kind.includes('Queue') ||
      kind.includes('Channel') ||
      kind.includes('command')
    ) {
      return 'Channel';
    }
    if (
      kind.includes('Class') ||
      kind.includes('Struct') ||
      kind.includes('concept') ||
      kind.includes('object')
    ) {
      return 'Class';
    }
    return 'Process';
  }
}
