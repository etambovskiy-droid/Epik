/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SourceProductParam {
  name: string;
  value: string;
  code?: string;
  valuecode?: string;
}

export interface SourceProduct {
  id: string;
  available: boolean;
  price: string;
  price_old?: string;
  categoryId: string;
  categoryName: string;
  picture: string;
  pictures: string[];
  name: string;
  name_ua?: string;
  name_ru?: string;
  description: string;
  description_ua?: string;
  description_ru?: string;
  brand?: string;
  country_of_origin?: string;
  barcode?: string;
  ratio?: string;
  measure?: string;
  params: SourceProductParam[];
}

export interface ParsedFeedResult {
  shopName?: string;
  categories: { id: string; name: string; parentId?: string }[];
  products: SourceProduct[];
  totalOffers: number;
}

// Built-in Sample Feed for 1-click testing
export const SAMPLE_SOURCE_XML_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="2026-10-15 14:00">
  <shop>
    <name>ПромПостач Маркет</name>
    <currencies>
      <currency id="UAH" rate="1"/>
    </currencies>
    <categories>
      <category id="101">Электроинструмент</category>
      <category id="102" parentId="101">Дрели и шуруповерты</category>
      <category id="201">Сантехника</category>
      <category id="202" parentId="201">Смесители для кухни</category>
      <category id="301">Освещение и LED</category>
    </categories>
    <offers>
      <offer id="DR-850" available="true">
        <price>1899.00</price>
        <oldprice>2199.00</oldprice>
        <categoryId>102</categoryId>
        <picture>https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&amp;fit=crop&amp;w=600&amp;q=80</picture>
        <name>Ударная дрель Bosch EasyImpact 850W</name>
        <vendor>Bosch</vendor>
        <country_of_origin>Германия</country_of_origin>
        <barcode>4016538923011</barcode>
        <description><![CDATA[Компактная и мощная ударная дрель мощностью 850 Вт для точного сверления в бетоне, кирпиче и древесине. Быстрозажимной патрон и эргономичная рукоятка.]]></description>
        <param name="Потребляемая мощность, Вт">850</param>
        <param name="Тип патрона">Быстрозажимной</param>
        <param name="Количество скоростей">2</param>
      </offer>

      <offer id="MIX-204" available="true">
        <price>1450.00</price>
        <oldprice>1600.00</oldprice>
        <categoryId>202</categoryId>
        <picture>https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&amp;fit=crop&amp;w=600&amp;q=80</picture>
        <name>Смеситель для кухни с поворотным изливом Grohe Eurosmart</name>
        <vendor>Grohe</vendor>
        <country_of_origin>Германия</country_of_origin>
        <barcode>4005176865213</barcode>
        <description><![CDATA[Однорычажный смеситель для мойки с хромированным покрытием StarLight. Керамический картридж 35 мм с плавной регулировкой температуры и напора.]]></description>
        <param name="Материал">Латунь</param>
        <param name="Тип излива">Поворотный</param>
        <param name="Цвет">Хром</param>
      </offer>

      <offer id="LED-15W" available="true">
        <price>129.00</price>
        <categoryId>301</categoryId>
        <picture>https://images.unsplash.com/photo-1550985616-10810253b84d?auto=format&amp;fit=crop&amp;w=600&amp;q=80</picture>
        <name>Светодиодная лампа Philips LED A60 15W E27 4000K</name>
        <vendor>Philips</vendor>
        <country_of_origin>Польша</country_of_origin>
        <barcode>8718696577035</barcode>
        <description><![CDATA[Энергосберегающая лампа нейтрального белого света с цоколем E27. Ресурс работы до 25 000 часов без мерцания.]]></description>
        <param name="Цоколь">E27</param>
        <param name="Цветовая температура">4000K</param>
        <param name="Мощность">15 Вт</param>
      </offer>

      <offer id="REF-771" available="true">
        <price>18499.00</price>
        <oldprice>19999.00</oldprice>
        <categoryId>101</categoryId>
        <picture>https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?auto=format&amp;fit=crop&amp;w=600&amp;q=80</picture>
        <name>Холодильник двухкамерный Samsung No Frost RB34</name>
        <name_ua>Холодильник двокамерний Samsung No Frost RB34</name_ua>
        <vendor>Samsung</vendor>
        <country_of_origin>Польша</country_of_origin>
        <barcode>8806090123456</barcode>
        <description><![CDATA[Современный холодильник с инверторным компрессором и системой раздельного охлаждения All-Around Cooling. Общий полезный объем 340 л.]]></description>
        <description_ua><![CDATA[Сучасний холодильник з інверторним компресором та системою роздільного охолодження All-Around Cooling. Загальний корисний об'єм 340 л.]]></description_ua>
        <param name="Класс энергопотребления">A++</param>
        <param name="Общий объем">340 л</param>
      </offer>
    </offers>
  </shop>
</yml_catalog>`;

export class XmlFeedParserService {
  /**
   * Parse XML/YML text string into structured objects
   */
  public static parseXmlString(xmlContent: string): ParsedFeedResult {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error(`Помилка синтаксису XML: ${parserError.textContent?.slice(0, 200)}`);
    }

    // Extract shop name
    const shopName = xmlDoc.querySelector('shop > name')?.textContent?.trim() || undefined;

    // Extract categories
    const categories: { id: string; name: string; parentId?: string }[] = [];
    const categoryNodes = xmlDoc.querySelectorAll('categories > category');
    const categoryMap = new Map<string, string>();

    categoryNodes.forEach((catNode) => {
      const id = catNode.getAttribute('id') || '';
      const parentId = catNode.getAttribute('parentId') || undefined;
      const name = catNode.textContent?.trim() || '';
      if (id) {
        categories.push({ id, name, parentId });
        categoryMap.set(id, name);
      }
    });

    // Extract offers
    const products: SourceProduct[] = [];
    const offerNodes = xmlDoc.querySelectorAll('offers > offer, offer');

    offerNodes.forEach((offerNode) => {
      const id = offerNode.getAttribute('id') || `item_${Math.random().toString(36).substring(2, 9)}`;
      const availableAttr = offerNode.getAttribute('available');
      const available = availableAttr !== 'false' && availableAttr !== '0';

      const price = offerNode.querySelector('price')?.textContent?.trim() || '0';
      const price_old = offerNode.querySelector('price_old, oldprice')?.textContent?.trim() || undefined;

      const categoryId = offerNode.querySelector('categoryId, category_id')?.textContent?.trim() ||
        offerNode.querySelector('category')?.getAttribute('code') ||
        offerNode.querySelector('category')?.textContent?.trim() || '';

      const categoryName = categoryMap.get(categoryId) ||
        offerNode.querySelector('category')?.textContent?.trim() ||
        'Загальна категорія';

      // Pictures
      const pictures: string[] = [];
      offerNode.querySelectorAll('picture').forEach((p) => {
        const url = p.textContent?.trim();
        if (url) pictures.push(url);
      });
      const picture = pictures[0] || 'https://via.placeholder.com/600x600?text=Product+Image';

      // Names (checking lang="ru", lang="ua", and tags)
      let name = '';
      let name_ua: string | undefined = undefined;
      let name_ru: string | undefined = undefined;

      const nameNodes = offerNode.querySelectorAll('name');
      if (nameNodes.length > 0) {
        nameNodes.forEach((n) => {
          const lang = n.getAttribute('lang')?.toLowerCase();
          const val = n.textContent?.trim() || '';
          if (lang === 'ua' || lang === 'uk') {
            name_ua = val;
          } else if (lang === 'ru') {
            name_ru = val;
          } else if (!name) {
            name = val;
          }
        });
      }

      if (!name) {
        const tagUa = offerNode.querySelector('name_ua')?.textContent?.trim();
        const tagRu = offerNode.querySelector('name_ru')?.textContent?.trim();
        if (tagUa) name_ua = tagUa;
        if (tagRu) name_ru = tagRu;
        name = name_ua || name_ru || offerNode.querySelector('title, model')?.textContent?.trim() || 'Товар без назви';
      }

      // Descriptions
      let description = '';
      let description_ua: string | undefined = undefined;
      let description_ru: string | undefined = undefined;

      const descNodes = offerNode.querySelectorAll('description');
      if (descNodes.length > 0) {
        descNodes.forEach((d) => {
          const lang = d.getAttribute('lang')?.toLowerCase();
          const val = d.textContent?.trim() || '';
          if (lang === 'ua' || lang === 'uk') {
            description_ua = val;
          } else if (lang === 'ru') {
            description_ru = val;
          } else if (!description) {
            description = val;
          }
        });
      }

      if (!description) {
        const descTagUa = offerNode.querySelector('description_ua')?.textContent?.trim();
        const descTagRu = offerNode.querySelector('description_ru')?.textContent?.trim();
        if (descTagUa) description_ua = descTagUa;
        if (descTagRu) description_ru = descTagRu;
        description = description_ua || description_ru || '';
      }

      // Brand / Vendor
      const brand = offerNode.querySelector('vendor, brand')?.textContent?.trim() ||
        offerNode.querySelector('param[name="Бренд"], param[name="Производитель"], param[name="Виробник"]')?.textContent?.trim() ||
        undefined;

      // Country of origin
      const country_of_origin = offerNode.querySelector('country_of_origin, country')?.textContent?.trim() ||
        offerNode.querySelector('param[name="Країна-виробник"], param[name="Страна-производитель"]')?.textContent?.trim() ||
        undefined;

      // Barcode
      const barcode = offerNode.querySelector('barcode, barcodes')?.textContent?.trim() ||
        offerNode.querySelector('param[name="Штрих код"], param[name="Штрих-код"]')?.textContent?.trim() ||
        undefined;

      // Ratio & Measure
      const ratio = offerNode.querySelector('ratio, min_quantity')?.textContent?.trim() || '1';
      const measure = offerNode.querySelector('measure')?.textContent?.trim() || 'шт.';

      // Extract all other parameters
      const params: SourceProductParam[] = [];
      offerNode.querySelectorAll('param').forEach((paramNode) => {
        const paramName = paramNode.getAttribute('name') || '';
        const paramValue = paramNode.textContent?.trim() || '';
        const code = paramNode.getAttribute('paramcode') || undefined;
        const valuecode = paramNode.getAttribute('valuecode') || undefined;

        if (paramName && paramValue) {
          params.push({ name: paramName, value: paramValue, code, valuecode });
        }
      });

      products.push({
        id,
        available,
        price,
        price_old,
        categoryId,
        categoryName,
        picture,
        pictures,
        name,
        name_ua,
        name_ru,
        description,
        description_ua,
        description_ru,
        brand,
        country_of_origin,
        barcode,
        ratio,
        measure,
        params
      });
    });

    return {
      shopName,
      categories,
      products,
      totalOffers: products.length
    };
  }

  /**
   * Load feed from remote URL via client/proxy
   */
  public static async fetchFeedFromUrl(url: string): Promise<string> {
    const trimmedUrl = url.trim();
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      throw new Error('Вкажіть коректне URL-посилання (наприклад, https://example.com/feed.xml)');
    }

    // Try direct fetch first
    try {
      const res = await fetch(trimmedUrl, { mode: 'cors' });
      if (res.ok) {
        return await res.text();
      }
    } catch {
      // CORS blocked or failed; attempt public CORS proxy
    }

    try {
      const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(trimmedUrl)}`;
      const proxyRes = await fetch(corsProxyUrl);
      if (proxyRes.ok) {
        return await proxyRes.text();
      }
    } catch (corsErr: any) {
      throw new Error(`Не вдалося завантажити фід за URL: ${corsErr.message || 'перевірте посилання або обмеження CORS'}`);
    }

    throw new Error('Не вдалося завантажити фід з віддаленого сервера.');
  }
}
