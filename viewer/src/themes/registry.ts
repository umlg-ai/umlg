
import { CoreEntityKind, ThemeContext, ThemeDefinition, VisualProfilePlugin } from './types';
import * as THREE from 'three';

export class ThemeManager {
  private activeTheme: ThemeDefinition;
  private plugins = new Map<string, VisualProfilePlugin>();
  private enabledProfiles = new Set<string>();

  constructor(defaultTheme: ThemeDefinition) {
    this.activeTheme = defaultTheme;
  }

  registerPlugin(plugin: VisualProfilePlugin, enabledByDefault = false): void {
    this.plugins.set(plugin.profileId, plugin);
    if (enabledByDefault) {
      this.enabledProfiles.add(plugin.profileId);
    }
  }

  setProfileEnabled(profileId: string, enabled: boolean): void {
    if (enabled && this.plugins.has(profileId)) {
      this.enabledProfiles.add(profileId);
    } else {
      this.enabledProfiles.delete(profileId);
    }
  }

  createEntity(kind: string, ctx: ThemeContext): THREE.Group {
    // 1. Сначала ищем в активных доменных профилях (если есть префикс, например "gpu:Buffer")
    for (const profileId of this.enabledProfiles) {
      const plugin = this.plugins.get(profileId);
      if (plugin && plugin.supportedKinds.includes(kind)) {
        const mesh = plugin.createEntityObject(kind, ctx);
        if (mesh) return mesh;
      }
    }

    // 2. Иначе рендерим через Core UMLG (или безопасный фолбэк ядра, если профиль отключен)
    return this.activeTheme.createEntityObject(kind as CoreEntityKind, ctx);
  }
}
