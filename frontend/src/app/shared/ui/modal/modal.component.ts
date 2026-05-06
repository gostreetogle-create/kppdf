import { Component, input, output, AfterViewInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'ui-modal',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss'
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  private static seq = 0;
  readonly titleId = `ui-modal-title-${ModalComponent.seq++}`;

  private readonly host = inject(ElementRef<HTMLElement>);
  private lastActive: HTMLElement | null = null;

  @ViewChild('closeBtn', { read: ElementRef })
  private closeBtn?: ElementRef<HTMLButtonElement>;

  title    = input('');
  maxWidth = input('540px');
  closeOnBackdrop = input(true);
  closed   = output<void>();

  constructor() {
    this.lastActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  onBackdrop(e: MouseEvent) {
    if (this.closeOnBackdrop() && (e.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.closed.emit();
    }
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.closeBtn?.nativeElement.focus());
  }

  ngOnDestroy(): void {
    this.lastActive?.focus?.();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }

    if (event.key !== 'Tab') return;
    const focusables = this.getFocusable();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const activeInside = active ? this.host.nativeElement.contains(active) : false;

    if (event.shiftKey) {
      if (!activeInside || active === first) {
        event.preventDefault();
        last.focus();
      }
      return;
    }

    if (active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    const root = this.host.nativeElement as HTMLElement;
    const nodes = root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    return (Array.from(nodes) as HTMLElement[]).filter((el) => {
      const disabled = (el as any).disabled === true || el.getAttribute('aria-disabled') === 'true';
      const hidden = el.getAttribute('hidden') !== null || el.getAttribute('aria-hidden') === 'true';
      return !disabled && !hidden && el.tabIndex >= 0;
    });
  }
}
