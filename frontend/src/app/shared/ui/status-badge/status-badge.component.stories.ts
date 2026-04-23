import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { StatusBadgeComponent } from './status-badge.component';

const meta: Meta<StatusBadgeComponent> = {
  title: 'UI/Status Badge',
  component: StatusBadgeComponent,
  decorators: [
    moduleMetadata({
      imports: [StatusBadgeComponent]
    })
  ],
  args: {
    variant: 'draft'
  }
};

export default meta;
type Story = StoryObj<StatusBadgeComponent>;

export const Draft: Story = { args: { variant: 'draft' } };
export const Sent: Story = { args: { variant: 'sent' } };
export const Accepted: Story = { args: { variant: 'accepted' } };
export const Rejected: Story = { args: { variant: 'rejected' } };
