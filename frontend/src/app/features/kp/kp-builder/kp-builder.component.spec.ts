import { ComponentFixture, TestBed, fakeAsync, tick, flushMicrotasks } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { KpBuilderComponent } from './kp-builder.component';
import { ApiService, Kp } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { AutosaveService } from './autosave.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ModalService } from '../../../core/services/modal.service';
import { PermissionsService } from '../../../core/services/permissions.service';

const mockKp: Kp = {
  _id: 'kp1',
  title: 'КП-1',
  status: 'draft',
  kpType: 'standard',
  recipient: { name: 'ООО Тест', inn: '1234567890' },
  metadata: { number: 'КП-001', validityDays: 10, prepaymentPercent: 50, productionDays: 15 },
  companySnapshot: {
    companyId: 'c1',
    companyName: 'Компания',
    templateKey: 't1',
    templateName: 'Template',
    kpType: 'standard',
    assets: { kpPage1: '' },
    texts: {}
  },
  items: [],
  conditions: [],
  vatPercent: 20,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

describe('KpBuilderComponent', () => {
  let fixture: ComponentFixture<KpBuilderComponent>;
  let component: KpBuilderComponent;
  let apiMock: any;

  const autosaveMock = {
    status: signal<'saved' | 'saving' | 'unsaved' | 'error'>('saved'),
    schedule: vi.fn(),
    saveNow: vi.fn()
  };

  beforeEach(async () => {
    apiMock = {
      getKp: vi.fn(() => of(structuredClone(mockKp))),
      getProducts: vi.fn(() => of([])),
      getCounterparties: vi.fn(() => of([])),
      getBrandingTemplates: vi.fn(() => of({ kpTypes: [], templatesByType: {}, defaultByType: {} })),
    } satisfies Partial<ApiService>;

    await TestBed.configureTestingModule({
      imports: [KpBuilderComponent],
      providers: [
        { provide: ApiService, useValue: apiMock as ApiService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'id' ? 'kp1' : null) },
              queryParamMap: { get: () => null as string | null }
            }
          }
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ModalService, useValue: { confirm: vi.fn(() => of(true)) } },
        { provide: PermissionsService, useValue: { can: vi.fn(() => true) } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
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

  it('should load KP on init', fakeAsync(() => {
    tick();
    flushMicrotasks();
    expect(apiMock.getKp).toHaveBeenCalled();
    expect(component.loading()).toBe(false);
    expect(component.kp()?._id).toBe('kp1');
  }));
});
