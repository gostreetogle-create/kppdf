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
  number: string;
  createdAt?: Date;
  validityDays: number;
  prepaymentPercent: number;
  productionDays: number;
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
  metadata = input.required<KpMetadata>();
}