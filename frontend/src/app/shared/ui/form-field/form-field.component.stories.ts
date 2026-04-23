import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { FormFieldComponent } from './form-field.component';

type FormFieldStoryArgs = FormFieldComponent & { value: string; disabled: boolean };

const meta: Meta<FormFieldStoryArgs> = {
  title: 'UI/Form Field',
  component: FormFieldComponent,
  decorators: [
    moduleMetadata({
      imports: [FormFieldComponent]
    })
  ],
  args: {
    label: 'Наименование',
    required: false,
    hint: 'Подсказка для пользователя',
    error: '',
    value: ''
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="max-width: 360px;">
        <ui-form-field [label]="label" [required]="required" [hint]="hint" [error]="error">
          <input class="form-control" [value]="value" [disabled]="disabled" placeholder="Введите значение" />
        </ui-form-field>
      </div>
    `
  }),
  argTypes: {
    value: { control: 'text' },
    disabled: { control: 'boolean' }
  }
};

export default meta;
type Story = StoryObj<FormFieldStoryArgs>;

export const Default: Story = {
  args: { value: '', disabled: false }
};

export const Filled: Story = {
  args: { value: 'Кронштейн К-42', disabled: false, hint: '' }
};

export const Error: Story = {
  args: { value: '!', error: 'Минимум 3 символа', hint: '', disabled: false }
};

export const Disabled: Story = {
  args: { value: 'Только чтение', disabled: true }
};
