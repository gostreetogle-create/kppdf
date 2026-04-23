import { Injectable, computed, inject } from '@angular/core';
import { KpItem } from '../../../core/services/api.service';
import { KpBuilderStore } from './kp-builder.store';

@Injectable()
export class KpTemplateService {
  private readonly store = inject(KpBuilderStore);
  private readonly emptyVariables: Record<string, string> = {
    client_name: '',
    kp_number: '',
    date: '',
    total_amount: '',
    manager_name: '',
    company_name: ''
  };

  readonly variableMap = computed<Record<string, string>>(() => {
    const kp = this.store.kp();
    if (!kp) return this.emptyVariables;

    const totalAmount = kp.items.reduce((sum, item) => sum + this.itemUnitPrice(item) * item.qty, 0);
    const dateValue = kp.metadata?.createdAt ?? kp.createdAt;

    return {
      client_name: (kp.recipient?.name || 'Уважаемый клиент').trim(),
      kp_number: (kp.metadata?.number || '---').trim(),
      date: this.formatDate(dateValue),
      total_amount: this.formatNumber(totalAmount),
      manager_name: this.resolveManagerName(kp.metadata),
      company_name: (kp.companySnapshot?.companyName || '').trim()
    };
  });

  parse(text: string): string {
    if (!text) return '';
    const map = this.variableMap();

    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
      const token = key.trim();
      return Object.prototype.hasOwnProperty.call(map, token) ? map[token] : match;
    });
  }

  private itemUnitPrice(item: KpItem): number {
    const markupPercent = item.markupEnabled ? this.clampPercent(item.markupPercent ?? 0, 0, 500) : 0;
    const discountPercent = item.discountEnabled ? this.clampPercent(item.discountPercent ?? 0, 0, 100) : 0;
    const withMarkup = item.price * (1 + markupPercent / 100);
    const withDiscount = withMarkup * (1 - discountPercent / 100);
    return Math.max(0, Math.round(withDiscount));
  }

  private clampPercent(value: number, min: number, max: number): number {
    const n = Number.isFinite(value) ? value : 0;
    return Math.min(max, Math.max(min, n));
  }

  private formatDate(value: Date | string | undefined): string {
    const parsed = value ? new Date(value) : new Date();
    return new Intl.DateTimeFormat('ru-RU').format(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
  }

  private resolveManagerName(metadata: unknown): string {
    if (metadata && typeof metadata === 'object' && 'managerName' in metadata) {
      const raw = (metadata as { managerName?: unknown }).managerName;
      if (typeof raw === 'string' && raw.trim()) {
        return raw.trim();
      }
    }
    return 'Ваш менеджер';
  }
}
