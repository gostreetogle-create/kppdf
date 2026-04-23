import { Component, OnInit, input, output, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService, BrandingTemplate, Counterparty, KP_TYPE_LABELS, KpType } from '../../../../core/services/api.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { FormFieldComponent } from '../../../../shared/ui/form-field/form-field.component';
import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalService } from '../../../../core/services/modal.service';

const DEFAULT_TEMPLATE_CONDITIONS = [
  'Срок поставки: 15 рабочих дней с момента оплаты.',
  'Гарантия на продукцию: 12 месяцев.',
  'Доставка рассчитывается отдельно и не входит в стоимость КП.'
];

@Component({
  selector: 'app-branding-templates-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, FormFieldComponent, AlertComponent, ButtonComponent],
  templateUrl: './branding-templates-manager.component.html',
  styleUrl: './branding-templates-manager.component.scss'
})
export class BrandingTemplatesManagerComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly modal = inject(ModalService);
  private readonly destroyRef = inject(DestroyRef);

  company = input.required<Counterparty>();
  saved = output<Counterparty>();
  cancelled = output<void>();

  readonly kpTypeOptions: KpType[] = ['standard', 'response', 'special', 'tender', 'service'];

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  uploadingAsset = signal<string | null>(null);
  templates = signal<BrandingTemplate[]>([]);
  expandedTemplatePanels = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loadCompanyTemplates();
  }

  kpTypeLabel(value: KpType): string {
    return KP_TYPE_LABELS[value] ?? value;
  }

  isResponseTemplate(template: BrandingTemplate): boolean {
    return template.kpType === 'response';
  }

  private loadCompanyTemplates(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getCounterparty(this.company()._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cp) => {
          const templates = Array.isArray(cp.brandingTemplates) ? cp.brandingTemplates : [];
          const normalized = templates.map((template) => ({
            ...template,
            assets: this.normalizeTemplateAssetsByType(template.kpType, template.assets),
            conditions: this.normalizeTemplateConditions(template.conditions)
          }));
          this.templates.set(normalized);
          this.expandedTemplatePanels.set(new Set());
          this.loading.set(false);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Не удалось загрузить шаблоны');
        }
      });
  }

  addBrandingTemplate() {
    const next = [...this.templates()];
    const kpType = this.kpTypeOptions[0];
    const hasDefaultForType = next.some((template) => template.kpType === kpType && template.isDefault);
    next.push({
      key: `${kpType}-${Date.now()}`,
      name: 'Новый шаблон',
      kpType,
      isDefault: !hasDefaultForType,
      assets: { kpPage1: '' },
      conditions: [...DEFAULT_TEMPLATE_CONDITIONS]
    });
    const newIndex = next.length - 1;
    next[newIndex] = {
      ...next[newIndex],
      assets: this.normalizeTemplateAssetsByType(next[newIndex].kpType, next[newIndex].assets)
    };
    this.templates.set(next);
    this.expandedTemplatePanels.update((current) => {
      const nextSet = new Set(current);
      nextSet.add(this.panelKey(newIndex, next[newIndex]));
      return nextSet;
    });
  }

  confirmRemoveBrandingTemplate(index: number) {
    const template = this.templates()[index];
    if (!template) return;
    this.modal.confirm({
      title: 'Удалить шаблон брендирования',
      message: `Шаблон «${template.name || template.key}» будет удалён.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        const next = [...this.templates()];
        const removed = next[index];
        next.splice(index, 1);
        this.templates.set(next);
        this.expandedTemplatePanels.update((current) => {
          const nextSet = new Set(current);
          if (removed) nextSet.delete(this.panelKey(index, removed));
          return nextSet;
        });
      });
  }

  toggleTemplatePanel(index: number) {
    const template = this.templates()[index];
    if (!template) return;
    const key = this.panelKey(index, template);
    this.expandedTemplatePanels.update((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isTemplatePanelExpanded(index: number): boolean {
    const template = this.templates()[index];
    if (!template) return false;
    return this.expandedTemplatePanels().has(this.panelKey(index, template));
  }

  private panelKey(index: number, template: BrandingTemplate): string {
    return `${index}:${String(template.key ?? '')}`;
  }

  onTemplateKpTypeChanged(index: number, kpType: KpType) {
    const next = [...this.templates()];
    const template = next[index];
    if (!template) return;
    template.kpType = kpType;
    template.assets = this.normalizeTemplateAssetsByType(kpType, template.assets);
    if (template.isDefault) {
      this.ensureSingleDefault(next, index);
      this.templates.set(next);
      return;
    }
    const hasDefaultForType = next.some((item, i) =>
      i !== index && item.kpType === kpType && item.isDefault
    );
    if (!hasDefaultForType) {
      template.isDefault = true;
      this.ensureSingleDefault(next, index);
    }
    this.templates.set(next);
  }

  onTemplateDefaultChanged(index: number, isDefault: boolean) {
    const next = [...this.templates()];
    const template = next[index];
    if (!template) return;
    template.isDefault = isDefault;
    if (isDefault) this.ensureSingleDefault(next, index);
    this.templates.set(next);
  }

  private ensureSingleDefault(list: BrandingTemplate[], index: number) {
    const target = list[index];
    if (!target || !target.isDefault) return;
    list.forEach((template, currentIndex) => {
      if (currentIndex !== index && template.kpType === target.kpType) {
        template.isDefault = false;
      }
    });
  }

  updateTemplateField(index: number, key: 'key' | 'name', value: string) {
    const next = [...this.templates()];
    if (!next[index]) return;
    (next[index] as any)[key] = value;
    this.templates.set(next);
  }

  updateTemplateAsset(index: number, key: 'kpPage1' | 'kpPage2' | 'passport' | 'appendix', value: string) {
    const next = [...this.templates()];
    if (!next[index]) return;
    next[index].assets = { ...next[index].assets, [key]: value };
    this.templates.set(next);
  }

  uploadTemplateAsset(event: Event, templateIndex: number, assetKey: 'kpPage1' | 'kpPage2' | 'passport' | 'appendix') {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const uploadKey = `${templateIndex}:${assetKey}`;
    this.uploadingAsset.set(uploadKey);
    this.api.uploadBrandingImage(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ url }) => {
          this.updateTemplateAsset(templateIndex, assetKey, url);
          this.uploadingAsset.set(null);
          if (input) input.value = '';
        },
        error: (err) => {
          this.uploadingAsset.set(null);
          this.error.set(err?.error?.message || 'Не удалось загрузить изображение');
          if (input) input.value = '';
        }
      });
  }

  addTemplateCondition(templateIndex: number) {
    const next = [...this.templates()];
    const template = next[templateIndex];
    if (!template) return;
    template.conditions = Array.isArray(template.conditions) ? [...template.conditions] : [];
    template.conditions.push('');
    this.templates.set(next);
  }

  updateTemplateCondition(templateIndex: number, conditionIndex: number, value: string) {
    const next = [...this.templates()];
    const template = next[templateIndex];
    if (!template || !Array.isArray(template.conditions)) return;
    if (conditionIndex < 0 || conditionIndex >= template.conditions.length) return;
    template.conditions[conditionIndex] = value;
    this.templates.set(next);
  }

  removeTemplateCondition(templateIndex: number, conditionIndex: number) {
    const next = [...this.templates()];
    const template = next[templateIndex];
    if (!template || !Array.isArray(template.conditions)) return;
    if (conditionIndex < 0 || conditionIndex >= template.conditions.length) return;
    template.conditions.splice(conditionIndex, 1);
    this.templates.set(next);
  }

  templateAssetPreview(url?: string): string {
    const raw = (url ?? '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    return `/${raw.replace(/^\.?\//, '')}`;
  }

  private normalizeTemplateConditions(conditions?: string[]): string[] {
    const normalized = Array.isArray(conditions)
      ? conditions.map((item) => (item ?? '').trim()).filter(Boolean)
      : [];
    return normalized.length > 0 ? normalized : [...DEFAULT_TEMPLATE_CONDITIONS];
  }

  private normalizeTemplateAssetsByType(kpType: KpType, assets: BrandingTemplate['assets'] | undefined): BrandingTemplate['assets'] {
    const normalized = {
      kpPage1: String(assets?.kpPage1 ?? '').trim(),
      kpPage2: String(assets?.kpPage2 ?? '').trim() || undefined,
      passport: String(assets?.passport ?? '').trim() || undefined,
      appendix: String(assets?.appendix ?? '').trim() || undefined,
    };
    if (kpType === 'response') {
      return {
        kpPage1: normalized.kpPage1
      };
    }
    return normalized;
  }

  private validateTemplates(): boolean {
    const errors: string[] = [];
    this.templates().forEach((template, index) => {
      const row = index + 1;
      if (!template.key?.trim()) errors.push(`Шаблон #${row}: укажите ключ`);
      if (!template.name?.trim()) errors.push(`Шаблон #${row}: укажите название`);
      if (!template.kpType) errors.push(`Шаблон #${row}: укажите тип КП`);
      if (!template.assets?.kpPage1?.trim()) errors.push(`Шаблон #${row}: укажите URL фона первой страницы`);
    });
    if (errors.length > 0) {
      this.error.set(errors.join('. '));
      return false;
    }
    this.error.set('');
    return true;
  }

  private buildPayload(): BrandingTemplate[] {
    return this.templates().map((template) => ({
      key: template.key.trim(),
      name: template.name.trim(),
      kpType: template.kpType,
      isDefault: Boolean(template.isDefault),
      assets: {
        ...this.normalizeTemplateAssetsByType(template.kpType, template.assets)
      },
      conditions: Array.isArray(template.conditions)
        ? template.conditions.map((item) => (item ?? '').trim()).filter(Boolean)
        : []
    }));
  }

  submit() {
    if (!this.validateTemplates()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.updateBrandingTemplates(this.company()._id, this.buildPayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ brandingTemplates }) => {
          this.saving.set(false);
          this.saved.emit({
            ...this.company(),
            brandingTemplates
          });
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Не удалось сохранить шаблоны');
        }
      });
  }
}
