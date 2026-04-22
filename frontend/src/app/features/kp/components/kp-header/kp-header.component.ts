import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KpRecipient {
  name:                  string;
  shortName?:            string;
  legalForm?:            string;
  inn?:                  string;
  kpp?:                  string;
  ogrn?:                 string;
  legalAddress?:         string;
  phone?:                string;
  email?:                string;
  bankName?:             string;
  bik?:                  string;
  checkingAccount?:      string;
  correspondentAccount?: string;
  founderName?:          string;
  founderNameShort?:     string;
}

export interface KpMetadata {
  number:            string;
  createdAt?:        Date;
  validityDays:      number;
  prepaymentPercent: number;
  productionDays:    number;
  tablePageBreakAfter: number;
  photoScalePercent?: number;
}

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
}
