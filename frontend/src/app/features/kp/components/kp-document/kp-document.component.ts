import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KpBackgroundComponent } from '../kp-background/kp-background.component';
import { KpHeaderComponent, type KpRecipient, type KpMetadata } from '../kp-header/kp-header.component';
import { KpCatalogComponent, type KpCatalogItem } from '../kp-catalog/kp-catalog.component';
import { KpTableComponent, type KpTotals } from '../kp-table/kp-table.component';

interface KpPageChunk {
  items: KpCatalogItem[];
  displayOffset: number;
  useFirstBackground: boolean;
  showHeader: boolean;
  showTotals: boolean;
}

@Component({
  selector: 'app-kp-document',
  standalone: true,
  imports: [
    CommonModule, 
    KpBackgroundComponent, 
    KpHeaderComponent, 
    KpCatalogComponent, 
    KpTableComponent
  ],
  templateUrl: './kp-document.component.html',
  styleUrl: './kp-document.component.scss'
})
export class KpDocumentComponent {
  title = input('Коммерческое предложение');
  itemsPerPage = input(10); // Количество товаров на странице

  protected readonly backgroundUrl1 = '/kp/kp-1str.png';
  protected readonly backgroundUrl2 = '/kp/kp-2str.png';

  // Данные получателя
  protected readonly recipient: KpRecipient = {
    name: 'ООО "Пример Компания"',
    inn: '1234567890',
    email: 'info@example.com',
    phone: '+7 (999) 123-45-67'
  };

  // Метаданные КП
  protected readonly metadata: KpMetadata = {
    number: 'КП-2024-001',
    createdAt: new Date(),
    validityDays: 10,
    prepaymentPercent: 50,
    productionDays: 15
  };

  // Товары (добавим больше для демонстрации многостраничности)
  protected readonly items: KpCatalogItem[] = [
    {
      id: 1,
      name: 'Металлоконструкция стальная',
      description: 'Изготовление по чертежам заказчика, сталь 09Г2С',
      qty: 2,
      unit: 'шт.',
      price: 25000,
      imageUrl: '/kp/kp-1str.png'
    },
    {
      id: 2,
      name: 'Покраска порошковая',
      description: 'RAL 7024, полимерное покрытие',
      qty: 2,
      unit: 'шт.',
      price: 5000,
      imageUrl: '/kp/kp-2str.png'
    },
    {
      id: 3,
      name: 'Сварочные работы',
      description: 'Сварка полуавтоматом в среде защитных газов',
      qty: 50,
      unit: 'м.п.',
      price: 800,
      imageUrl: '/kp/kp-1str.png'
    },
    {
      id: 4,
      name: 'Монтажные работы',
      description: 'Монтаж металлоконструкций на объекте',
      qty: 1,
      unit: 'комплект',
      price: 15000,
      imageUrl: '/kp/kp-2str.png'
    },
    {
      id: 5,
      name: 'Доставка',
      description: 'Доставка готовых изделий до объекта',
      qty: 1,
      unit: 'рейс',
      price: 8000,
      imageUrl: '/kp/kp-1str.png'
    },
    {
      id: 6,
      name: 'Проектирование',
      description: 'Разработка рабочих чертежей',
      qty: 1,
      unit: 'комплект',
      price: 12000,
      imageUrl: '/kp/kp-2str.png'
    },
    {
      id: 7,
      name: 'Антикоррозийная обработка',
      description: 'Грунтовка и покраска металла',
      qty: 100,
      unit: 'м²',
      price: 300,
      imageUrl: '/kp/kp-1str.png'
    },
    {
      id: 8,
      name: 'Крепежные элементы',
      description: 'Болты, гайки, шайбы высокопрочные',
      qty: 1,
      unit: 'комплект',
      price: 5500,
      imageUrl: '/kp/kp-2str.png'
    }
  ];

  // Итоги (пересчитаем для всех товаров)
  protected readonly totals: KpTotals = {
    subtotal: this.items.reduce((sum, item) => sum + (item.price * item.qty), 0),
    vatPercent: 20,
    get vatAmount() { return Math.round(this.subtotal * this.vatPercent / 100); },
    get total() { return this.subtotal + this.vatAmount; }
  };

  // Дополнительные условия
  protected readonly conditions: string[] = [
    'Цены действительны при заказе полного комплекта.',
    'Доставка по Москве и области рассчитывается отдельно.',
    'Гарантия на изделия - 12 месяцев.',
    'Оплата: 50% предоплата, 50% по готовности.',
    'Срок изготовления: 15 рабочих дней с момента получения предоплаты.'
  ];

  // Вычисляемое свойство для разбивки на страницы
  protected readonly pageChunks = computed((): KpPageChunk[] => {
    const chunks: KpPageChunk[] = [];
    const itemsPerPageValue = this.itemsPerPage();
    
    for (let i = 0; i < this.items.length; i += itemsPerPageValue) {
      const pageItems = this.items.slice(i, i + itemsPerPageValue);
      const isFirstPage = i === 0;
      const isLastPage = i + itemsPerPageValue >= this.items.length;
      
      chunks.push({
        items: pageItems,
        displayOffset: i,
        useFirstBackground: isFirstPage,
        showHeader: isFirstPage,
        showTotals: isLastPage
      });
    }
    
    return chunks;
  });

  protected readonly totalPages = computed(() => this.pageChunks().length);
}
