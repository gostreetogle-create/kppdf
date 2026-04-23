import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { SearchInputComponent } from './search-input.component';

const meta: Meta<SearchInputComponent> = {
  title: 'UI/Search Input',
  component: SearchInputComponent,
  decorators: [
    moduleMetadata({
      imports: [SearchInputComponent]
    })
  ],
  args: {
    value: '',
    placeholder: 'Поиск по каталогу...',
    fullWidth: false
  },
  render: (args) => ({
    props: {
      ...args,
      onValueChange: (value: string) => {
        args.value = value;
      }
    },
    template: `
      <div style="max-width: 420px;">
        <ui-search-input
          [value]="value"
          [placeholder]="placeholder"
          [fullWidth]="fullWidth"
          (valueChange)="onValueChange($event)">
        </ui-search-input>
      </div>
    `
  })
};

export default meta;
type Story = StoryObj<SearchInputComponent>;

export const Default: Story = {};

export const Filled: Story = {
  args: {
    value: 'Турник'
  }
};

export const FullWidth: Story = {
  args: {
    fullWidth: true
  },
  render: (args) => ({
    props: {
      ...args,
      onValueChange: (value: string) => {
        args.value = value;
      }
    },
    template: `
      <div style="max-width: 640px;">
        <ui-search-input
          [value]="value"
          [placeholder]="placeholder"
          [fullWidth]="fullWidth"
          (valueChange)="onValueChange($event)">
        </ui-search-input>
      </div>
    `
  })
};
