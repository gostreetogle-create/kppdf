import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ButtonComponent } from './button.component';

type ButtonStoryArgs = ButtonComponent & { label: string; disabled: boolean };

const meta: Meta<ButtonStoryArgs> = {
  title: 'UI/Button',
  component: ButtonComponent,
  decorators: [
    moduleMetadata({
      imports: [ButtonComponent]
    })
  ],
  args: {
    variant: 'default',
    size: 'md',
    icon: false
  },
  render: (args) => ({
    props: args,
    template: `
      <button ui-btn [variant]="variant" [size]="size" [icon]="icon" [disabled]="disabled">
        {{ label }}
      </button>
    `
  }),
  argTypes: {
    label: { control: 'text' },
    disabled: { control: 'boolean' }
  }
};

export default meta;
type Story = StoryObj<ButtonStoryArgs>;

export const Default: Story = {
  args: { label: 'Кнопка', disabled: false }
};

export const Primary: Story = {
  args: { label: 'Сохранить', variant: 'primary', disabled: false }
};

export const Disabled: Story = {
  args: { label: 'Недоступно', variant: 'secondary', disabled: true }
};

export const Loading: Story = {
  args: { label: 'Сохраняю...', variant: 'primary', disabled: true }
};
