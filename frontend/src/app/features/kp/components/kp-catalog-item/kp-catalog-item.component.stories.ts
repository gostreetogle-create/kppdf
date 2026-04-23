import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { KpCatalogItemComponent } from './kp-catalog-item.component';
import type { Product } from '../../../../core/services/api.service';

const demoProduct: Product = {
  _id: 'p-story-1',
  code: 'KPP-001',
  name: 'Кронштейн потолочный',
  description: 'Легкий алюминиевый кронштейн для подвесной системы.',
  category: 'Крепеж',
  unit: 'шт',
  price: 1850,
  images: [{ url: '', isMain: true, sortOrder: 0, context: 'product' }],
  isActive: true,
  kind: 'ITEM'
};

const meta: Meta<KpCatalogItemComponent> = {
  title: 'KP/Product Card',
  component: KpCatalogItemComponent,
  decorators: [
    moduleMetadata({
      imports: [KpCatalogItemComponent]
    })
  ],
  args: {
    product: demoProduct,
    isSelected: false
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="max-width: 360px;">
        <app-kp-catalog-item [product]="product" [isSelected]="isSelected"></app-kp-catalog-item>
      </div>
    `
  })
};

export default meta;
type Story = StoryObj<KpCatalogItemComponent>;

export const Default: Story = {};

export const Selected: Story = {
  args: { isSelected: true }
};
