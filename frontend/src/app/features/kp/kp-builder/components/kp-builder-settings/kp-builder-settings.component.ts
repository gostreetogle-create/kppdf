import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { KpType, Counterparty } from '../../../../../core/services/api.service';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';

type KpMetadata = {
  number?: string;
  validityDays?: number;
  prepaymentPercent?: number;
  productionDays?: number;
  tablePageBreakAfter?: number;
  tablePageBreakFirstPage?: number;
  tablePageBreakNextPages?: number;
  photoCropPercent?: number;
};

@Component({
  selector: 'app-kp-builder-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './kp-builder-settings.component.html',
  styleUrls: ['./kp-builder-settings.component.scss', '../../kp-builder.sidebar.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KpBuilderSettingsComponent {
  collapsed = input(true);
  isReadOnly = input(false);
  switchingType = input(false);
  metadata = input.required<KpMetadata>();
  vatPercent = input(20);
  selectedCompanyId = input<string | null>(null);
  companyOptions = input<Counterparty[]>([]);
  selectedKpType = input<KpType>('standard');
  kpTypeOptions = input<Array<{ value: KpType; label: string }>>([]);
  selectedTemplateKey = input('auto');
  templatesForSelectedType = input<Array<{ key: string; name: string; isDefault?: boolean }>>([]);
  showBrandingTemplateSelect = input(false);
  photoScaleUiValue = input(0);
  photoCropUiValue = input(0);
  photoColumnVisible = input(true);

  toggleCollapsed = output<void>();
  metadataNumberChange = output<string>();
  companySelectionChange = output<string>();
  kpTypeSelectionChange = output<string>();
  templateSelectionChange = output<string>();
  openCompanyBranding = output<void>();
  validityDaysChange = output<number>();
  prepaymentPercentChange = output<number>();
  productionDaysChange = output<number>();
  vatPercentChange = output<number>();
  tablePageBreakFirstPageChange = output<number>();
  tablePageBreakNextPagesChange = output<number>();
  photoScaleChange = output<number>();
  photoCropChange = output<number>();
  photoColumnVisibilityToggle = output<void>();
}
