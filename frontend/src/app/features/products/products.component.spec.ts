import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductsComponent } from './products.component';
import { ApiService, Product } from '../../core/services/api.service';
import { ModalService } from '../../core/services/modal.service';
import { NotificationService } from '../../core/services/notification.service';

const mockProducts: Product[] = [
  { _id: '1', code: 'A-1', name: 'Металл', description: 'Сталь', category: 'Материалы', unit: 'шт.', price: 25000, images: [], isActive: true, kind: 'ITEM' },
  { _id: '2', code: 'B-2', name: 'Покраска', description: 'RAL 7024', category: 'Услуги', unit: 'м²', price: 500, images: [], isActive: true, kind: 'SERVICE' },
];

describe('ProductsComponent', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let apiSpy: any;
  let modalSpy: any;
  let nsSpy: any;

  beforeEach(async () => {
    apiSpy = {
      getProductsPage: vi.fn(() => of({ items: mockProducts, page: 1, limit: 24, total: 2 })),
      getProductCategories: vi.fn(() => of([])),
      createProduct: vi.fn(),
      updateProduct: vi.fn(),
      deleteProduct: vi.fn(() => of(undefined)),
      duplicateProduct: vi.fn(),
      getProduct: vi.fn(),
    } satisfies Partial<ApiService>;

    modalSpy = { confirm: vi.fn(() => of(true)) } satisfies Partial<ModalService>;
    nsSpy = { success: vi.fn(), error: vi.fn() } satisfies Partial<NotificationService>;

    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy as ApiService },
        { provide: ModalService, useValue: modalSpy as ModalService },
        { provide: NotificationService, useValue: nsSpy as NotificationService },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load products on init', fakeAsync(() => {
    tick(300);
    expect(apiSpy.getProductsPage).toHaveBeenCalled();
    expect(component.products().length).toBe(2);
    expect(component.loading()).toBe(false);
  }));

  it('should request products with search query', fakeAsync(() => {
    tick(300);
    apiSpy.getProductsPage.mockClear();
    component.search.set('металл');
    tick(300);
    expect(apiSpy.getProductsPage).toHaveBeenCalled();
    const params = apiSpy.getProductsPage.mock.calls.at(-1)?.[0];
    expect(params.q).toBe('металл');
  }));

  it('should open create form with no editTarget', () => {
    component.openCreate();
    expect(component.formOpen()).toBe(true);
    expect(component.editTarget()).toBeNull();
  });

  it('should open edit form with product', () => {
    component.openEdit(mockProducts[0]);
    expect(component.formOpen()).toBe(true);
    expect(component.editTarget()).toEqual(mockProducts[0]);
  });

  it('should close form and clear editTarget', () => {
    component.openEdit(mockProducts[0]);
    component.closeForm();
    expect(component.formOpen()).toBe(false);
    expect(component.editTarget()).toBeNull();
  });

  it('should add new product to list on save', () => {
    const newProduct: Product = { _id: '3', code: 'C-3', name: 'Новый', description: '', category: '', unit: 'кг', price: 100, images: [], isActive: true, kind: 'ITEM' };
    component.openCreate();
    component.onSaved(newProduct);
    expect(component.products().length).toBe(3);
    expect(component.products()[0]._id).toBe('3');
    expect(component.formOpen()).toBe(false);
  });

  it('should update existing product on save', () => {
    const updated: Product = { ...mockProducts[0], price: 30000 };
    component.openEdit(mockProducts[0]);
    component.onSaved(updated);
    const found = component.products().find(p => p._id === '1');
    expect(found?.price).toBe(30000);
  });

  it('should call deleteProduct after confirm', () => {
    component.confirmDelete(mockProducts[0]);
    expect(modalSpy.confirm).toHaveBeenCalled();
    expect(apiSpy.deleteProduct).toHaveBeenCalledWith('1');
  });

  it('should delete product and remove from list', fakeAsync(() => {
    tick(300);
    component.confirmDelete(mockProducts[0]);
    expect(apiSpy.deleteProduct).toHaveBeenCalledWith('1');
    expect(component.products().length).toBe(1);
    expect(component.deleteTarget()).toBeNull();
  }));

  it('should toggle view between grid and table', () => {
    expect(component.view()).toBe('grid');
    component.view.set('table');
    expect(component.view()).toBe('table');
  });
});
