import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { KpBuilderComponent } from './kp-builder.component';
import { ApiService, Kp } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AutosaveService } from './autosave.service';

const mockKp: Kp = {
  _id: 'kp1',
  title: 'КП-1',
  status: 'draft',
  recipient: { name: 'ООО Тест', inn: '1234567890' },
  metadata: { number: 'КП-001', validityDays: 10, prepaymentPercent: 50, productionDays: 15 },
  items: [],
  conditions: [],
  vatPercent: 20,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

describe('KpBuilderComponent', () => {
  let fixture: ComponentFixture<KpBuilderComponent>;
  let component: KpBuilderComponent;

  const apiSpy = {
    getKp: () => of(structuredClone(mockKp)),
    getProducts: () => of([]),
    getCounterparties: () => of([]),
    lookupCounterpartyByInn: () => of({})
  } as unknown as ApiService;

  const autosaveMock = {
    status: signal<'saved' | 'saving' | 'unsaved' | 'error'>('saved'),
    schedule: () => {},
    saveNow: () => {}
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [KpBuilderComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => 'kp1' } } }
        },
        { provide: Router, useValue: { navigate: () => {} } },
        {
          provide: AuthService,
          useValue: {
            isAdmin: signal(false),
            isManager: signal(true)
          }
        }
      ]
    })
      .overrideComponent(KpBuilderComponent, {
        set: {
          providers: [{ provide: AutosaveService, useValue: autosaveMock }]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(KpBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('increments and decrements qty with lower bound 1', () => {
    component.kp.set({
      ...mockKp,
      items: [{ productId: 'p1', name: 'Товар', description: '', unit: 'шт', price: 10, qty: 1 }]
    });

    const item = component.kp()!.items[0];
    component.incrementQty(item);
    expect(component.kp()!.items[0].qty).toBe(2);

    component.decrementQty(component.kp()!.items[0]);
    component.decrementQty(component.kp()!.items[0]);
    expect(component.kp()!.items[0].qty).toBe(1);
  });

  it('reorders conditions up and down', () => {
    component.kp.set({ ...mockKp, conditions: ['a', 'b', 'c'] });

    component.moveConditionDown(0);
    expect(component.kp()!.conditions).toEqual(['b', 'a', 'c']);

    component.moveConditionUp(2);
    expect(component.kp()!.conditions).toEqual(['b', 'c', 'a']);
  });

  it('builds recipient warnings for invalid fields', () => {
    component.kp.set({
      ...mockKp,
      recipient: {
        ...mockKp.recipient,
        inn: '123',
        kpp: '12',
        email: 'invalid-email'
      }
    });

    const warnings = component.recipientWarnings();
    expect(warnings.length).toBe(3);
    expect(warnings.join(' ')).toContain('ИНН');
    expect(warnings.join(' ')).toContain('КПП');
    expect(warnings.join(' ')).toContain('Email');
  });
});
