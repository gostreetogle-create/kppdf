import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { ApiService, Kp } from '../../core/services/api.service';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';

const mockKp: Kp = {
  _id: '1', title: 'КП-1', status: 'draft', kpType: 'standard',
  recipient: { name: 'ООО Тест' },
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
  items: [{ productId: 'p1', name: 'Товар', description: '', unit: 'шт.', price: 1000, qty: 2 }],
  conditions: [], vatPercent: 20,
  createdAt: '2024-01-01', updatedAt: '2024-01-01'
};

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let apiSpy: any;
  let modalSpy: any;
  let nsSpy: any;

  beforeEach(async () => {
    apiSpy = {
      getKpList: vi.fn(() => of([mockKp])),
      createKp: vi.fn(() => of(mockKp)),
      deleteKp: vi.fn(() => of(undefined)),
      duplicateKp: vi.fn(() => of(mockKp)),
    } satisfies Partial<ApiService>;

    modalSpy = { confirm: vi.fn(() => of(true)) } satisfies Partial<ModalService>;
    nsSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() } satisfies Partial<NotificationService>;

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy as ApiService },
        { provide: ModalService, useValue: modalSpy as ModalService },
        { provide: NotificationService, useValue: nsSpy as NotificationService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load KP list on init', () => {
    expect(apiSpy.getKpList).toHaveBeenCalled();
    expect(component.kpList().length).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('should handle load error gracefully', async () => {
    apiSpy.getKpList.mockReturnValue(throwError(() => new Error('Network error')));
    component.ngOnInit();
    expect(component.loading()).toBe(false);
  });

  it('should calculate total correctly (subtotal + VAT)', () => {
    const total = component.getTotal(mockKp);
    // subtotal = 1000 * 2 = 2000, vat 20% = 400, total = 2400
    expect(total).toBe(2400);
  });

  it('should delete KP and remove from list', () => {
    const event = new MouseEvent('click');
    vi.spyOn(event, 'stopPropagation');
    component.delete('1', event);
    expect(apiSpy.deleteKp).toHaveBeenCalledWith('1');
    expect(component.kpList().length).toBe(0);
  });
});
