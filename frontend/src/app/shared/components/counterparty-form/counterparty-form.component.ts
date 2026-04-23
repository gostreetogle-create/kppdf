import { Component, OnInit, OnDestroy, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ApiService, Counterparty, LegalForm, CpRole } from '../../../core/services/api.service';
import { ModalComponent } from '../../ui/modal/modal.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { AlertComponent } from '../../ui/alert/alert.component';
import { ButtonComponent } from '../../ui/button/button.component';

interface CpFormModel {
  legalForm:            LegalForm;
  roleClient:           boolean;
  roleSupplier:         boolean;
  roleCompany:          boolean;
  isDefaultInitiator:   boolean;
  defaultMarkupPercent: number;
  defaultDiscountPercent: number;
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
}

function emptyForm(): CpFormModel {
  return {
    legalForm: 'ООО', roleClient: true, roleSupplier: false, roleCompany: false, isDefaultInitiator: false,
    defaultMarkupPercent: 0, defaultDiscountPercent: 0,
    name: '', shortName: '', inn: '', kpp: '', ogrn: '',
    legalAddress: '', actualAddress: '', sameAddress: false,
    phone: '', email: '', website: '',
    bankName: '', bik: '', checkingAccount: '', correspondentAccount: '',
    founderName: '', founderNameShort: '',
    status: 'active', notes: '', tags: '',
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

  readonly legalForms: LegalForm[] = ['ООО', 'ИП', 'АО', 'ПАО', 'МКУ', 'Физлицо', 'Другое'];

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
        defaultMarkupPercent: Number(cp.defaultMarkupPercent ?? 0) || 0,
        defaultDiscountPercent: Number(cp.defaultDiscountPercent ?? 0) || 0,
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
      defaultMarkupPercent: this.form.roleCompany ? Math.max(0, Math.min(500, Number(this.form.defaultMarkupPercent) || 0)) : 0,
      defaultDiscountPercent: this.form.roleCompany ? Math.max(0, Math.min(100, Number(this.form.defaultDiscountPercent) || 0)) : 0,
      images:               this.counterparty()?.images ?? [],
      footerText:           this.counterparty()?.footerText ?? '',
      brandingTemplates:    this.counterparty()?.brandingTemplates ?? [],
    } as Omit<Counterparty, '_id' | 'createdAt' | 'updatedAt'>;
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
