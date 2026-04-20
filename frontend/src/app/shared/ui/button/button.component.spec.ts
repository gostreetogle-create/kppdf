import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ButtonComponent } from './button.component';
import { By } from '@angular/platform-browser';

@Component({
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <button ui-btn>Default</button>
    <button ui-btn variant="primary">Primary</button>
    <button ui-btn variant="danger" size="sm">Danger SM</button>
    <button ui-btn icon>✕</button>
  `
})
class TestHostComponent {}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should apply default variant class', () => {
    const btn = fixture.debugElement.queryAll(By.directive(ButtonComponent))[0];
    expect(btn.nativeElement.classList).toContain('btn--default');
  });

  it('should apply primary variant class', () => {
    const btn = fixture.debugElement.queryAll(By.directive(ButtonComponent))[1];
    expect(btn.nativeElement.classList).toContain('btn--primary');
  });

  it('should apply danger + sm classes', () => {
    const btn = fixture.debugElement.queryAll(By.directive(ButtonComponent))[2];
    expect(btn.nativeElement.classList).toContain('btn--danger');
    expect(btn.nativeElement.classList).toContain('btn--sm');
  });

  it('should apply icon class when icon attribute present', () => {
    const btn = fixture.debugElement.queryAll(By.directive(ButtonComponent))[3];
    expect(btn.nativeElement.classList).toContain('btn--icon');
  });
});
