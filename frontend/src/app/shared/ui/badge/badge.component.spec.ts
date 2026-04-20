import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { BadgeComponent } from './badge.component';
import { By } from '@angular/platform-browser';

@Component({
  standalone: true,
  imports: [BadgeComponent],
  template: `
    <ui-badge>Default</ui-badge>
    <ui-badge color="blue">Blue</ui-badge>
    <ui-badge color="green">Green</ui-badge>
    <ui-badge color="red">Red</ui-badge>
  `
})
class TestHostComponent {}

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  });

  it('should apply default color class', () => {
    const badges = fixture.debugElement.queryAll(By.directive(BadgeComponent));
    expect(badges[0].nativeElement.classList).toContain('badge--default');
  });

  it('should apply blue color class', () => {
    const badges = fixture.debugElement.queryAll(By.directive(BadgeComponent));
    expect(badges[1].nativeElement.classList).toContain('badge--blue');
  });

  it('should apply green color class', () => {
    const badges = fixture.debugElement.queryAll(By.directive(BadgeComponent));
    expect(badges[2].nativeElement.classList).toContain('badge--green');
  });

  it('should apply red color class', () => {
    const badges = fixture.debugElement.queryAll(By.directive(BadgeComponent));
    expect(badges[3].nativeElement.classList).toContain('badge--red');
  });
});
