import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/user.model';
import { Product } from '../models/product.model';
import { Counterparty } from '../models/counterparty.model';
import { Kp } from '../models/kp.model';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kp-app';

// ─── Данные ───────────────────────────────────────────────────────────────────

const PRODUCTS = [
  { code: 'МК-001', name: 'Металлоконструкция стальная', description: 'Изготовление по чертежам заказчика, сталь 09Г2С', category: 'Металлоконструкции', unit: 'шт.', price: 25000, costRub: 18000, kind: 'ITEM' },
  { code: 'МК-002', name: 'Ферма стропильная', description: 'Пролёт 12м, сталь С245', category: 'Металлоконструкции', unit: 'шт.', price: 85000, costRub: 62000, kind: 'ITEM' },
  { code: 'МК-003', name: 'Колонна стальная', description: 'Двутавр 30Б1, высота 6м', category: 'Металлоконструкции', unit: 'шт.', price: 32000, costRub: 23000, kind: 'ITEM' },
  { code: 'МК-004', name: 'Балка перекрытия', description: 'Двутавр 20, длина 6м', category: 'Металлоконструкции', unit: 'шт.', price: 12000, costRub: 8500, kind: 'ITEM' },
  { code: 'МК-005', name: 'Профнастил НС-35', description: 'Оцинкованный, толщина 0.7мм', category: 'Кровля', unit: 'м²', price: 650, costRub: 480, kind: 'ITEM' },
  { code: 'КР-001', name: 'Сэндвич-панель кровельная', description: 'Толщина 150мм, минвата', category: 'Кровля', unit: 'м²', price: 1850, costRub: 1400, kind: 'ITEM' },
  { code: 'КР-002', name: 'Водосточная система', description: 'ПВХ, диаметр 100мм', category: 'Кровля', unit: 'м.п.', price: 380, costRub: 280, kind: 'ITEM' },
  { code: 'ОТД-001', name: 'Покраска порошковая', description: 'RAL 7024, полимерное покрытие', category: 'Отделка', unit: 'м²', price: 500, costRub: 320, kind: 'SERVICE' },
  { code: 'ОТД-002', name: 'Антикоррозийная обработка', description: 'Грунтовка ГФ-021 + эмаль', category: 'Отделка', unit: 'м²', price: 300, costRub: 180, kind: 'SERVICE' },
  { code: 'МОН-001', name: 'Монтажные работы', description: 'Монтаж металлоконструкций на объекте', category: 'Монтаж', unit: 'комплект', price: 45000, costRub: 30000, kind: 'WORK' },
  { code: 'МОН-002', name: 'Сварочные работы', description: 'Сварка полуавтоматом в среде защитных газов', category: 'Монтаж', unit: 'м.п.', price: 800, costRub: 500, kind: 'WORK' },
  { code: 'МОН-003', name: 'Монтаж кровли', description: 'Укладка профнастила с крепежом', category: 'Монтаж', unit: 'м²', price: 350, costRub: 220, kind: 'WORK' },
  { code: 'ПРО-001', name: 'Проектирование', description: 'Разработка рабочих чертежей КМД', category: 'Проектирование', unit: 'комплект', price: 35000, costRub: 20000, kind: 'SERVICE' },
  { code: 'ПРО-002', name: 'Технический надзор', description: 'Авторский надзор за монтажом', category: 'Проектирование', unit: 'услуга', price: 15000, costRub: 8000, kind: 'SERVICE' },
  { code: 'ДОС-001', name: 'Доставка по Москве', description: 'Доставка готовых изделий до объекта', category: 'Доставка', unit: 'рейс', price: 8000, costRub: 5500, kind: 'SERVICE' },
  { code: 'ДОС-002', name: 'Доставка по МО', description: 'До 100км от МКАД', category: 'Доставка', unit: 'рейс', price: 12000, costRub: 8500, kind: 'SERVICE' },
  { code: 'КРЕ-001', name: 'Крепёжные элементы', description: 'Болты, гайки, шайбы высокопрочные', category: 'Комплектующие', unit: 'комплект', price: 5500, costRub: 3800, kind: 'ITEM' },
  { code: 'КРЕ-002', name: 'Анкерные болты', description: 'М24, длина 300мм, сталь 5.8', category: 'Комплектующие', unit: 'шт.', price: 180, costRub: 120, kind: 'ITEM' },
  { code: 'ОГР-001', name: 'Ограждение кровли', description: 'Парапетное ограждение h=1.2м', category: 'Безопасность', unit: 'м.п.', price: 2800, costRub: 2000, kind: 'ITEM' },
  { code: 'ОГР-002', name: 'Лестница пожарная', description: 'П1, высота 6м, ГОСТ 53254', category: 'Безопасность', unit: 'шт.', price: 28000, costRub: 20000, kind: 'ITEM' },
];

const COUNTERPARTIES = [
  { legalForm: 'ООО', role: ['client'], name: 'ООО "СтройГрупп"', shortName: 'СтройГрупп', inn: '7719402047', kpp: '771901001', ogrn: '1157746078984', legalAddress: 'г. Москва, ул. Строителей, д. 15', phone: '+7 (495) 123-45-67', email: 'info@stroygroup.ru', status: 'active' },
  { legalForm: 'ООО', role: ['client'], name: 'ООО "ПромИнвест"', shortName: 'ПромИнвест', inn: '5047082100', kpp: '504701001', ogrn: '1025006176250', legalAddress: 'г. Мытищи, пр-т Мира, д. 42', phone: '+7 (495) 987-65-43', email: 'zakaz@prominvest.ru', status: 'active' },
  { legalForm: 'АО', role: ['client'], name: 'АО "МеталлТрейд"', shortName: 'МеталлТрейд', inn: '7701234567', kpp: '770101001', ogrn: '1027700132195', legalAddress: 'г. Москва, Варшавское ш., д. 125', phone: '+7 (495) 555-00-11', email: 'trade@metalltr.ru', status: 'active' },
  { legalForm: 'ИП', role: ['client'], name: 'ИП Иванов Иван Иванович', shortName: 'ИП Иванов', inn: '771234567890', ogrn: '321774600123456', legalAddress: 'г. Москва, ул. Ленина, д. 1, кв. 5', phone: '+7 (916) 111-22-33', email: 'ivanov@mail.ru', founderName: 'Иванов Иван Иванович', founderNameShort: 'И.И. Иванов', status: 'active' },
  { legalForm: 'ООО', role: ['client', 'supplier'], name: 'ООО "УниверсалСтрой"', shortName: 'УниверсалСтрой', inn: '5001234567', kpp: '500101001', ogrn: '1025000123456', legalAddress: 'г. Балашиха, ул. Советская, д. 8', phone: '+7 (495) 777-88-99', email: 'info@universtroy.ru', status: 'active' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomItems(products: any[], count: number) {
  const shuffled = [...products].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(p => ({
    productId:   p._id.toString(),
    code:        p.code,
    name:        p.name,
    description: p.description,
    unit:        p.unit,
    price:       p.price,
    qty:         Math.ceil(Math.random() * 5),
    imageUrl:    '',
  }));
}

function makeKp(title: string, status: string, counterparty: any, products: any[], num: number) {
  const items = randomItems(products, Math.ceil(Math.random() * 5) + 2);
  const subtotal = items.reduce((s: number, i: any) => s + i.price * i.qty, 0);
  return {
    title,
    status,
    counterpartyId: counterparty._id.toString(),
    recipient: {
      name:         counterparty.name,
      shortName:    counterparty.shortName,
      legalForm:    counterparty.legalForm,
      inn:          counterparty.inn,
      kpp:          counterparty.kpp,
      legalAddress: counterparty.legalAddress,
      phone:        counterparty.phone,
      email:        counterparty.email,
    },
    metadata: {
      number:            `КП-2024-${String(num).padStart(3, '0')}`,
      validityDays:      10,
      prepaymentPercent: 50,
      productionDays:    15,
    },
    items,
    conditions: [
      'Цены действительны при заказе полного комплекта.',
      'Доставка рассчитывается отдельно.',
      'Гарантия на изделия — 12 месяцев.',
    ],
    vatPercent: 20,
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB connected');

  // Очищаем демо-данные (не трогаем реальные если есть)
  const existingProducts = await Product.countDocuments();
  if (existingProducts > 0) {
    console.log(`ℹ️  В БД уже есть ${existingProducts} товаров. Пропускаю seed товаров.`);
  } else {
    const products = await Product.insertMany(
      PRODUCTS.map(p => ({ ...p, images: [], isActive: true }))
    );
    console.log(`✅ Создано ${products.length} товаров`);
  }

  const existingCp = await Counterparty.countDocuments();
  if (existingCp > 0) {
    console.log(`ℹ️  В БД уже есть ${existingCp} контрагентов. Пропускаю.`);
  } else {
    const cps = await Counterparty.insertMany(
      COUNTERPARTIES.map(c => ({ ...c, contacts: [], tags: [], sameAddress: false }))
    );
    console.log(`✅ Создано ${cps.length} контрагентов`);
  }

  // Admin
  const adminExists = await User.findOne({ username: 'admin' });
  if (!adminExists) {
    await User.create({
      username: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Администратор',
      role: 'admin',
      isActive: true,
      mustChangePassword: true
    });
    console.log('✅ Admin создан: admin / admin123');
  }

  // КП
  const existingKp = await Kp.countDocuments();
  if (existingKp > 0) {
    console.log(`ℹ️  В БД уже есть ${existingKp} КП. Пропускаю.`);
  } else {
    const allProducts = await Product.find();
    const allCp       = await Counterparty.find();

    const kps = [
      makeKp('КП для СтройГрупп — металлоконструкции склада', 'draft',    allCp[0], allProducts, 1),
      makeKp('КП для ПромИнвест — кровля цеха',               'sent',     allCp[1], allProducts, 2),
      makeKp('КП для МеталлТрейд — ограждения',               'accepted', allCp[2], allProducts, 3),
      makeKp('КП для ИП Иванов — навес',                      'rejected', allCp[3], allProducts, 4),
      makeKp('КП для УниверсалСтрой — полный комплект',       'draft',    allCp[4], allProducts, 5),
      makeKp('КП для СтройГрупп — монтаж',                    'sent',     allCp[0], allProducts, 6),
      makeKp('КП для ПромИнвест — проектирование',            'draft',    allCp[1], allProducts, 7),
    ];

    await Kp.insertMany(kps);
    console.log(`✅ Создано ${kps.length} КП`);
  }

  console.log('\n🎉 Demo seed завершён!');
  console.log('   Вход: admin@example.com / admin123');
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
