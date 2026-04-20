import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService, Product, Kp } from './api.service';

const BASE = 'http://localhost:3000/api';

const mockProduct: Product = {
  _id: '1', name: 'Тест', description: 'Описание', unit: 'шт.', price: 1000, imageUrl: ''
};

const mockKp: Kp = {
  _id: 'kp1', title: 'КП-1', status: 'draft',
  recipient: { name: 'ООО Тест' },
  metadata: { number: 'КП-001', validityDays: 10, prepaymentPercent: 50, productionDays: 15 },
  items: [], conditions: [], vatPercent: 20,
  createdAt: '2024-01-01', updatedAt: '2024-01-01'
};

describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ─── Products ─────────────────────────────────────────
  it('getProducts() — GET /api/products', () => {
    service.getProducts().subscribe(res => expect(res).toEqual([mockProduct]));
    http.expectOne(`${BASE}/products`).flush([mockProduct]);
  });

  it('createProduct() — POST /api/products', () => {
    const payload = { name: 'Тест', description: '', unit: 'шт.', price: 100, imageUrl: '' };
    service.createProduct(payload).subscribe(res => expect(res).toEqual(mockProduct));
    const req = http.expectOne(`${BASE}/products`);
    expect(req.request.method).toBe('POST');
    req.flush(mockProduct);
  });

  it('updateProduct() — PUT /api/products/:id', () => {
    service.updateProduct('1', { price: 2000 }).subscribe(res => expect(res._id).toBe('1'));
    const req = http.expectOne(`${BASE}/products/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ ...mockProduct, price: 2000 });
  });

  it('deleteProduct() — DELETE /api/products/:id', () => {
    service.deleteProduct('1').subscribe();
    const req = http.expectOne(`${BASE}/products/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ─── KP ───────────────────────────────────────────────
  it('getKpList() — GET /api/kp', () => {
    service.getKpList().subscribe(res => expect(res).toEqual([mockKp]));
    http.expectOne(`${BASE}/kp`).flush([mockKp]);
  });

  it('getKp() — GET /api/kp/:id', () => {
    service.getKp('kp1').subscribe(res => expect(res._id).toBe('kp1'));
    http.expectOne(`${BASE}/kp/kp1`).flush(mockKp);
  });

  it('createKp() — POST /api/kp', () => {
    service.createKp({ title: 'Новое КП' }).subscribe(res => expect(res).toEqual(mockKp));
    const req = http.expectOne(`${BASE}/kp`);
    expect(req.request.method).toBe('POST');
    req.flush(mockKp);
  });

  it('updateKp() — PUT /api/kp/:id', () => {
    service.updateKp('kp1', { title: 'Обновлено' }).subscribe(res => expect(res._id).toBe('kp1'));
    const req = http.expectOne(`${BASE}/kp/kp1`);
    expect(req.request.method).toBe('PUT');
    req.flush(mockKp);
  });

  it('deleteKp() — DELETE /api/kp/:id', () => {
    service.deleteKp('kp1').subscribe();
    const req = http.expectOne(`${BASE}/kp/kp1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
