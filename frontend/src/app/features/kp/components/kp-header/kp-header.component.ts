import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpType, KpRecipient, KpMetadata } from '@shared/types/Kp';

export type { KpType, KpRecipient, KpMetadata };

@Component({
  selector: 'app-kp-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kp-header.component.html',
  styleUrl: './kp-header.component.scss'
})
export class KpHeaderComponent {
  recipient = input.required<KpRecipient>();
  metadata  = input.required<KpMetadata>();
  kpType = input<KpType>('standard');

  protected recipientDisplayName(): string {
    const recipient = this.recipient();
    const baseName = (recipient.shortName || recipient.name || '').trim();
    const legalForm = (recipient.legalForm || '').trim();

    if (!legalForm || legalForm === 'Физлицо') {
      return `"${baseName}"`;
    }

    if (baseName.toLowerCase().startsWith(legalForm.toLowerCase())) {
      return `"${baseName}"`;
    }

    return `${legalForm} "${baseName}"`;
  }

  protected displayDate(): Date {
    const value = this.metadata().createdAt;
    if (!value) return new Date();
    return value instanceof Date ? value : new Date(value);
  }

  protected introTitle(): string {
    const kpType = this.kpType();
    if (kpType === 'response') return 'Ответ на письмо для:';
    return 'Коммерческое предложение для:';
  }
}
