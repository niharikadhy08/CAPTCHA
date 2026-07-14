import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Capcha } from './capcha/capcha';

@Component({
  selector: 'app-root',
  imports: [Capcha],
  template: '<app-capcha />',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class App {}
