import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductsComponent } from './products.component';
import { ApiService, Product } from '../../core/services/api.service';

const mockProducts: Product[] = [
  { _id: '1', name: 'Металл', description: 'Сталь', unit: 'шт.', price: 25000, imageUrl: '' },
  { _id: '2', name: 'Покраска', description: 'RAL 7024', unit: 'м²', price: 500, imageUrl: '' },
];

describe('ProductsComponent', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(async () => {
    apiSpy = jasmine.createSpyObj('ApiService', ['getProducts', 'createProduct', 'updateProduct', 'deleteProduct']);
    apiSpy.getProducts.and.returnValue(of(mockProducts));

    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        { provide: ApiService, useValue: apiSpy },
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load products on init', () => {
    expect(apiSpy.getProducts).toHaveBeenCalled();
    expect(component.products().length).toBe(2);
    expect(component.loading()).toBeFalse();
  });

  it('should filter products by search query', () => {
    component.search.set('металл');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].name).toBe('Металл');
  });

  it('should filter by description', () => {
    component.search.set('RAL');
    expect(component.filtered().length).toBe(1);
  });

  it('should return all products when search is empty', () => {
    component.search.set('');
    expect(component.filtered().length).toBe(2);
  });

  it('should open create form with no editTarget', () => {
    component.openCreate();
    expect(component.formOpen()).toBeTrue();
    expect(component.editTarget()).toBeNull();
  });

  it('should open edit form with product', () => {
    component.openEdit(mockProducts[0]);
    expect(component.formOpen()).toBeTrue();
    expect(component.editTarget()).toEqual(mockProducts[0]);
  });

  it('should close form and clear editTarget', () => {
    component.openEdit(mockProducts[0]);
    component.closeForm();
    expect(component.formOpen()).toBeFalse();
    expect(component.editTarget()).toBeNull();
  });

  it('should add new product to list on save', () => {
    const newProduct: Product = { _id: '3', name: 'Новый', description: '', unit: 'кг', price: 100, imageUrl: '' };
    component.openCreate();
    component.onSaved(newProduct);
    expect(component.products().length).toBe(3);
    expect(component.products()[0]._id).toBe('3');
    expect(component.formOpen()).toBeFalse();
  });

  it('should update existing product on save', () => {
    const updated: Product = { ...mockProducts[0], price: 30000 };
    component.openEdit(mockProducts[0]);
    component.onSaved(updated);
    const found = component.products().find(p => p._id === '1');
    expect(found?.price).toBe(30000);
  });

  it('should set deleteTarget on confirmDelete', () => {
    component.confirmDelete(mockProducts[0]);
    expect(component.deleteTarget()).toEqual(mockProducts[0]);
  });

  it('should delete product and remove from list', () => {
    apiSpy.deleteProduct.and.returnValue(of(undefined));
    component.confirmDelete(mockProducts[0]);
    component.onDeleteConfirmed();
    expect(apiSpy.deleteProduct).toHaveBeenCalledWith('1');
    expect(component.products().length).toBe(1);
    expect(component.deleteTarget()).toBeNull();
  });

  it('should toggle view between grid and table', () => {
    expect(component.view()).toBe('grid');
    component.view.set('table');
    expect(component.view()).toBe('table');
  });
});
