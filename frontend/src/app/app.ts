import { Component, signal } from '@angular/core';
import {KpBuilderComponent} from './features/kp/kp-builder/kp-builder.component';

@Component({
  selector: 'app-root',
  imports: [KpBuilderComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('kppdf-frontend');
}
