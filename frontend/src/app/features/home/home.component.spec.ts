import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HomeComponent } from './home.component';
import { ApiService, Kp } from '../../core/services/api.service';

const mockKp: Kp = {
  _id: '1', title: 'КП-1', status: 'draft',
  recipient: { name: 'ООО Тест' },
  metadata: { number: 'КП-001', validityDays: 10, prepaymentPercent: 50, productionDays: 15 },
  items: [{ productId: 'p1', name: 'Товар', description: '', unit: 'шт.', price: 1000, qty: 2 }],
  conditions: [], vatPercent: 20,
  createdAt: '2024-01-01', updatedAt: '2024-01-01'
};

describe('HomeComponent', () => {
  let fixture: ComponentFixture<HomeComponent>;
  let component: HomeComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getKpList', 'createKp', 'deleteKp']);
    apiSpy.getKpList.and.returnValue(of([mockKp]));

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
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
    expect(component.loading()).toBeFalse();
  });

  it('should handle load error gracefully', async () => {
    apiSpy.getKpList.and.returnValue(throwError(() => new Error('Network error')));
    component.ngOnInit();
    expect(component.loading()).toBeFalse();
  });

  it('should calculate total correctly (subtotal + VAT)', () => {
    const total = component.getTotal(mockKp);
    // subtotal = 1000 * 2 = 2000, vat 20% = 400, total = 2400
    expect(total).toBe(2400);
  });

  it('should return correct status labels', () => {
    expect(component.statusLabel('draft')).toBe('Черновик');
    expect(component.statusLabel('sent')).toBe('Отправлен');
    expect(component.statusLabel('accepted')).toBe('Принят');
    expect(component.statusLabel('rejected')).toBe('Отклонён');
  });

  it('should return correct status colors', () => {
    expect(component.statusColor('draft')).toBe('default');
    expect(component.statusColor('sent')).toBe('blue');
    expect(component.statusColor('accepted')).toBe('green');
    expect(component.statusColor('rejected')).toBe('red');
  });

  it('should delete KP and remove from list', () => {
    apiSpy.deleteKp.and.returnValue(of(undefined));
    const event = new MouseEvent('click');
    spyOn(event, 'stopPropagation');
    component.delete('1', event);
    expect(apiSpy.deleteKp).toHaveBeenCalledWith('1');
    expect(component.kpList().length).toBe(0);
  });
});
