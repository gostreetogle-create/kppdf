import { Component, OnInit, OnDestroy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, take, takeUntil } from 'rxjs';
import { ApiService, Counterparty, LegalForm, CpRole, BrandingTemplate, KpType, KP_TYPE_LABELS } from '../../../core/services/api.service';
import { ModalComponent } from '../../ui/modal/modal.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { AlertComponent } from '../../ui/alert/alert.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ModalService } from '../../../core/services/modal.service';

interface CpFormModel {
  legalForm:            LegalForm;
  roleClient:           boolean;
  roleSupplier:         boolean;
  roleCompany:          boolean;
  isDefaultInitiator:   boolean;
  name:                 string;
  shortName:            string;
  inn:                  string;
  kpp:                  string;
  ogrn:                 string;
  legalAddress:         string;
  actualAddress:        string;
  sameAddress:          boolean;
  phone:                string;
  email:                string;
  website:              string;
  bankName:             string;
  bik:                  string;
  checkingAccount:      string;
  correspondentAccount: string;
  founderName:          string;
  founderNameShort:     string;
  status:               'active' | 'inactive';
  notes:                string;
  tags:                 string;
  brandingTemplates:    BrandingTemplate[];
}

const DEFAULT_TEMPLATE_CONDITIONS = [
  'Срок поставки: 15 рабочих дней с момента оплаты.',
  'Гарантия на продукцию: 12 месяцев.',
  'Доставка рассчитывается отдельно и не входит в стоимость КП.'
];

function emptyForm(): CpFormModel {
  return {
    legalForm: 'ООО', roleClient: true, roleSupplier: false, roleCompany: false, isDefaultInitiator: false,
    name: '', shortName: '', inn: '', kpp: '', ogrn: '',
    legalAddress: '', actualAddress: '', sameAddress: false,
    phone: '', email: '', website: '',
    bankName: '', bik: '', checkingAccount: '', correspondentAccount: '',
    founderName: '', founderNameShort: '',
    status: 'active', notes: '', tags: '',
    brandingTemplates: []
  };
}

@Component({
  selector: 'app-counterparty-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, FormFieldComponent, AlertComponent, ButtonComponent],
  templateUrl: './counterparty-form.component.html',
  styleUrl: './counterparty-form.component.scss'
})
export class CounterpartyFormComponent implements OnInit, OnDestroy {
  private readonly api      = inject(ApiService);
  private readonly modal    = inject(ModalService);
  private readonly destroy$ = new Subject<void>();

  counterparty = input<Counterparty | null>(null);
  /** Заголовок модалки (например «Новый получатель» в контексте КП) */
  formHeading  = input<string | undefined>(undefined);
  saved        = output<Counterparty>();
  cancelled    = output<void>();

  form       = emptyForm();
  saving     = signal(false);
  lookingUp  = signal(false);
  formError  = signal('');
  lookupError = signal('');
  showAdditional = signal(false);
  templatesOpen = signal(false);
  uploadingAsset = signal<string | null>(null);

  readonly legalForms: LegalForm[] = ['ООО', 'ИП', 'АО', 'ПАО', 'МКУ', 'Физлицо', 'Другое'];
  readonly kpTypeOptions: KpType[] = ['standard', 'response', 'special', 'tender', 'service'];

  get isEdit(): boolean { return !!this.counterparty(); }
  get isPersonLike(): boolean { return this.form.legalForm === 'Физлицо'; }
  get nameLabel(): string { return this.isPersonLike ? 'ФИО' : 'Полное название'; }
  get namePlaceholder(): string { return this.isPersonLike ? 'Иванов Иван Иванович' : 'ООО "Название"'; }
  get shortNameLabel(): string { return this.isPersonLike ? 'Короткое имя' : 'Краткое название'; }
  get shortNamePlaceholder(): string { return this.isPersonLike ? 'Иванов И.И.' : 'Название'; }
  get innPlaceholder(): string { return this.isPersonLike ? '12 цифр' : '10 или 12 цифр'; }
  get title(): string {
    const h = this.formHeading()?.trim();
    if (h) return h;
    return this.isEdit ? 'Редактировать контрагента' : 'Новый контрагент';
  }

  ngOnInit() {
    const cp = this.counterparty();
    if (cp) {
      this.form = {
        legalForm:            cp.legalForm,
        roleClient:           cp.role.includes('client'),
        roleSupplier:         cp.role.includes('supplier'),
        roleCompany:          cp.role.includes('company'),
        isDefaultInitiator:   Boolean(cp.isDefaultInitiator),
        name:                 cp.name,
        shortName:            cp.shortName ?? '',
        inn:                  cp.inn,
        kpp:                  cp.kpp ?? '',
        ogrn:                 cp.ogrn ?? '',
        legalAddress:         cp.legalAddress ?? '',
        actualAddress:        cp.actualAddress ?? '',
        sameAddress:          cp.sameAddress ?? false,
        phone:                cp.phone ?? '',
        email:                cp.email ?? '',
        website:              cp.website ?? '',
        bankName:             cp.bankName ?? '',
        bik:                  cp.bik ?? '',
        checkingAccount:      cp.checkingAccount ?? '',
        correspondentAccount: cp.correspondentAccount ?? '',
        founderName:          cp.founderName ?? '',
        founderNameShort:     cp.founderNameShort ?? '',
        status:               cp.status,
        notes:                cp.notes ?? '',
        tags:                 (cp.tags ?? []).join(', '),
        brandingTemplates:    structuredClone(cp.brandingTemplates ?? []).map((template) => ({
          ...template,
          conditions: this.normalizeTemplateConditions(template.conditions)
        }))
      };
    }
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  validate(): boolean {
    const errs: string[] = [];
    if (!this.form.legalForm)       errs.push('Выберите организационно-правовую форму');
    if (!this.form.name.trim())     errs.push(this.isPersonLike ? 'Введите ФИО' : 'Введите полное название');
    if (!this.isPersonLike && !this.form.inn.trim()) errs.push('Введите ИНН');
    if (!this.form.status)          errs.push('Выберите статус');
    if (!this.form.roleClient && !this.form.roleSupplier && !this.form.roleCompany) errs.push('Выберите хотя бы одну роль');
    this.form.brandingTemplates.forEach((template, index) => {
      const row = index + 1;
      if (!template.name?.trim()) errs.push(`Шаблон #${row}: укажите название`);
      if (!template.kpType) errs.push(`Шаблон #${row}: укажите тип КП`);
      if (!template.assets?.kpPage1?.trim()) errs.push(`Шаблон #${row}: укажите URL фона первой страницы`);
    });
    if (errs.length) { this.formError.set(errs.join('. ')); return false; }
    this.formError.set('');
    return true;
  }

  private normalizedShortName(): string {
    const short = this.form.shortName.trim();
    if (short) return short;
    return this.form.name.trim();
  }

  buildPayload(): Omit<Counterparty, '_id' | 'createdAt' | 'updatedAt'> {
    const role: CpRole[] = [];
    if (this.form.roleClient)   role.push('client');
    if (this.form.roleSupplier) role.push('supplier');
    if (this.form.roleCompany)  role.push('company');
    return {
      legalForm:            this.form.legalForm,
      role,
      name:                 this.form.name.trim(),
      shortName:            this.normalizedShortName(),
      inn:                  this.form.inn.trim(),
      kpp:                  this.form.kpp.trim(),
      ogrn:                 this.form.ogrn.trim(),
      legalAddress:         this.form.legalAddress.trim(),
      actualAddress:        this.form.actualAddress.trim(),
      sameAddress:          this.form.sameAddress,
      phone:                this.form.phone.trim(),
      email:                this.form.email.trim(),
      website:              this.form.website.trim(),
      contacts:             this.counterparty()?.contacts ?? [],
      bankName:             this.form.bankName.trim(),
      bik:                  this.form.bik.trim(),
      checkingAccount:      this.form.checkingAccount.trim(),
      correspondentAccount: this.form.correspondentAccount.trim(),
      founderName:          this.form.founderName.trim(),
      founderNameShort:     this.form.founderNameShort.trim(),
      status:               this.form.status,
      notes:                this.form.notes.trim(),
      tags:                 this.form.tags.split(',').map(t => t.trim()).filter(Boolean),
      isOurCompany:         this.form.roleCompany,
      isDefaultInitiator:   this.form.roleCompany && this.form.isDefaultInitiator,
      images:               this.counterparty()?.images ?? [],
      footerText:           this.counterparty()?.footerText ?? '',
      brandingTemplates:    this.form.brandingTemplates.map((template) => ({
        key: template.key.trim(),
        name: template.name.trim(),
        kpType: template.kpType,
        isDefault: Boolean(template.isDefault),
        assets: {
          kpPage1: (template.assets.kpPage1 ?? '').trim(),
          kpPage2: (template.assets.kpPage2 ?? '').trim() || undefined,
          passport: (template.assets.passport ?? '').trim() || undefined,
          appendix: (template.assets.appendix ?? '').trim() || undefined,
        },
        conditions: Array.isArray(template.conditions)
          ? template.conditions.map((item) => (item ?? '').trim()).filter(Boolean)
          : []
      })),
    } as Omit<Counterparty, '_id' | 'createdAt' | 'updatedAt'>;
  }

  kpTypeLabel(value: KpType): string {
    return KP_TYPE_LABELS[value] ?? value;
  }

  addBrandingTemplate() {
    const kpType = this.kpTypeOptions[0];
    const keyBase = `${kpType}-${Date.now()}`;
    const hasDefaultForType = this.form.brandingTemplates.some((template) => template.kpType === kpType && template.isDefault);
    this.form.brandingTemplates.push({
      key: keyBase,
      name: 'Новый шаблон',
      kpType,
      isDefault: !hasDefaultForType,
      assets: { kpPage1: '' },
      conditions: [...DEFAULT_TEMPLATE_CONDITIONS]
    });
    this.templatesOpen.set(true);
  }

  confirmRemoveBrandingTemplate(index: number) {
    const template = this.form.brandingTemplates[index];
    if (!template) return;
    this.modal.confirm({
      title: 'Удалить шаблон брендирования',
      message: `Шаблон «${template.name || template.key}» будет удалён.`,
      confirmText: 'Удалить',
      cancelText: 'Отмена',
      type: 'danger'
    })
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.form.brandingTemplates.splice(index, 1);
      });
  }

  onTemplateKpTypeChanged(index: number, kpType: KpType) {
    const template = this.form.brandingTemplates[index];
    if (!template) return;
    template.kpType = kpType;
    if (template.isDefault) {
      this.ensureSingleDefault(index);
      return;
    }
    const hasDefaultForType = this.form.brandingTemplates.some((item, i) =>
      i !== index && item.kpType === kpType && item.isDefault
    );
    if (!hasDefaultForType) {
      template.isDefault = true;
      this.ensureSingleDefault(index);
    }
  }

  onTemplateDefaultChanged(index: number, isDefault: boolean) {
    const template = this.form.brandingTemplates[index];
    if (!template) return;
    template.isDefault = isDefault;
    if (isDefault) {
      this.ensureSingleDefault(index);
    }
  }

  private ensureSingleDefault(index: number) {
    const target = this.form.brandingTemplates[index];
    if (!target || !target.isDefault) return;
    this.form.brandingTemplates.forEach((template, currentIndex) => {
      if (currentIndex !== index && template.kpType === target.kpType) {
        template.isDefault = false;
      }
    });
  }

  uploadTemplateAsset(event: Event, templateIndex: number, assetKey: 'kpPage1' | 'kpPage2' | 'passport' | 'appendix') {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const uploadKey = `${templateIndex}:${assetKey}`;
    this.uploadingAsset.set(uploadKey);
    this.api.uploadBrandingImage(file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ url }) => {
          const template = this.form.brandingTemplates[templateIndex];
          if (!template) return;
          template.assets[assetKey] = url;
          this.uploadingAsset.set(null);
          if (input) input.value = '';
        },
        error: (err) => {
          this.uploadingAsset.set(null);
          this.formError.set(err?.error?.message || 'Не удалось загрузить изображение');
          if (input) input.value = '';
        }
      });
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

  addTemplateCondition(templateIndex: number) {
    const template = this.form.brandingTemplates[templateIndex];
    if (!template) return;
    template.conditions = Array.isArray(template.conditions) ? template.conditions : [];
    template.conditions.push('');
  }

  updateTemplateCondition(templateIndex: number, conditionIndex: number, value: string) {
    const template = this.form.brandingTemplates[templateIndex];
    if (!template) return;
    template.conditions = Array.isArray(template.conditions) ? template.conditions : [];
    if (conditionIndex < 0 || conditionIndex >= template.conditions.length) return;
    template.conditions[conditionIndex] = value;
  }

  removeTemplateCondition(templateIndex: number, conditionIndex: number) {
    const template = this.form.brandingTemplates[templateIndex];
    if (!template || !Array.isArray(template.conditions)) return;
    if (conditionIndex < 0 || conditionIndex >= template.conditions.length) return;
    template.conditions.splice(conditionIndex, 1);
  }

  submit() {
    if (!this.validate()) return;
    this.saving.set(true);
    this.formError.set('');
    const payload = this.buildPayload();
    const cp = this.counterparty();
    const req$ = cp
      ? this.api.updateCounterparty(cp._id, payload)
      : this.api.createCounterparty(payload);

    req$.pipe(takeUntil(this.destroy$)).subscribe({
      next:  result => { this.saving.set(false); this.saved.emit(result); },
      error: err    => { this.saving.set(false); this.formError.set(err.error?.message ?? 'Ошибка сохранения'); }
    });
  }

  lookupByInn() {
    const inn = this.form.inn.trim();
    if (!inn) return;
    this.lookingUp.set(true);
    this.lookupError.set('');

    this.api.lookupCounterpartyByInn(inn)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: cp => {
          this.lookingUp.set(false);
          if (cp.legalForm)        this.form.legalForm        = cp.legalForm as LegalForm;
          if (cp.name)             this.form.name             = cp.name;
          if (cp.shortName)        this.form.shortName        = cp.shortName;
          if (cp.kpp)              this.form.kpp              = cp.kpp;
          if (cp.ogrn)             this.form.ogrn             = cp.ogrn;
          if (cp.legalAddress)     this.form.legalAddress     = cp.legalAddress;
          if (cp.founderName)      this.form.founderName      = cp.founderName;
          if (cp.founderNameShort) this.form.founderNameShort = cp.founderNameShort;
        },
        error: err => {
          this.lookingUp.set(false);
          this.lookupError.set(
            err.status === 404
              ? 'Компания не найдена по указанному ИНН'
              : 'Ошибка при запросе к DaData'
          );
        }
      });
  }

  onLegalFormChanged(legalForm: LegalForm) {
    this.form.legalForm = legalForm;
    if (!this.isPersonLike) {
      this.showAdditional.set(false);
    }
    if (this.isPersonLike && this.form.roleCompany) {
      this.form.roleCompany = false;
      this.form.isDefaultInitiator = false;
    }
  }

  onRoleCompanyChanged(isCompany: boolean) {
    this.form.roleCompany = isCompany;
    if (!isCompany) {
      this.form.isDefaultInitiator = false;
    }
  }
}
