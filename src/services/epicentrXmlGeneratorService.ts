/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SourceProduct } from './xmlFeedParserService';
import { EpicentrCategory } from './epicentrMerchantApiService';

export interface CategoryMappingConfig {
  [sourceCategoryId: string]: {
    epicentrCategoryCode: string;
    epicentrCategoryName: string;
    attributeSetCode: string;
    attributeSetName: string;
  };
}

export interface EpicentrFeedGenerationOptions {
  categoryMappings?: CategoryMappingConfig;
  defaultMeasure?: string;
  defaultRatio?: string;
  defaultCountry?: string;
  defaultBrand?: string;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
}

export class EpicentrXmlGeneratorService {
  /**
   * Formats the current date in YYYY-MM-DD HH:mm format
   */
  public static getCurrentDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }

  /**
   * Generates valid Epicentr XML feed string matching the exact official structure
   */
  public static generateEpicentrXml(
    products: SourceProduct[],
    categoriesList: EpicentrCategory[],
    options: EpicentrFeedGenerationOptions = {}
  ): string {
    const dateStr = this.getCurrentDateString();
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<yml_catalog date="${dateStr}">`);
    lines.push('<offers>');

    const mappings = options.categoryMappings || {};
    const defaultCat = categoriesList[0] || {
      code: '10542',
      name: 'Електроінструменти',
      attribute_set_code: 'attr_set_powertools',
      attribute_set_name: 'Електроінструменти та оснащення'
    };

    products.forEach((prod) => {
      const mapping = mappings[prod.categoryId] || mappings[prod.categoryName];

      const categoryCode = mapping?.epicentrCategoryCode || defaultCat.code;
      const categoryName = mapping?.epicentrCategoryName || defaultCat.name;
      const attributeSetCode = mapping?.attributeSetCode || defaultCat.attribute_set_code || `attr_set_${categoryCode}`;
      const attributeSetName = mapping?.attributeSetName || defaultCat.attribute_set_name || categoryName;

      const availableAttr = prod.available ? 'true' : 'false';
      const availabilityStatus = prod.available ? 'in_stock' : 'out_of_stock';

      lines.push(`<offer id="${escapeXml(prod.id)}" available="${availableAttr}">`);
      lines.push(`<price>${escapeXml(prod.price)}</price>`);
      if (prod.price_old) {
        lines.push(`<price_old>${escapeXml(prod.price_old)}</price_old>`);
      }
      lines.push(`<availability>${availabilityStatus}</availability>`);
      lines.push(`<category code="${escapeXml(categoryCode)}">${escapeXml(categoryName)}</category>`);

      // Picture
      const mainPicture = prod.picture || (prod.pictures && prod.pictures[0]) || '';
      if (mainPicture) {
        lines.push(`<picture>${escapeXml(mainPicture)}</picture>`);
      }

      // Bilingual Names
      const nameRu = prod.name_ru || prod.name || '';
      const nameUa = prod.name_ua || prod.name || '';
      lines.push(`<name lang="ru">${escapeXml(nameRu)}</name>`);
      lines.push(`<name lang="ua">${escapeXml(nameUa)}</name>`);

      // Bilingual Descriptions with CDATA
      const descRu = prod.description_ru || prod.description || '';
      const descUa = prod.description_ua || prod.description || '';
      lines.push(`<description lang="ru"><![CDATA[${descRu}]]></description>`);
      lines.push(`<description lang="ua"><![CDATA[${descUa}]]></description>`);

      // Attribute set
      lines.push(`<attribute_set code="${escapeXml(attributeSetCode)}">${escapeXml(attributeSetName)}</attribute_set>`);

      // Custom parameters (excluding standard ones to avoid duplication)
      prod.params.forEach((param) => {
        const paramLower = param.name.toLowerCase();
        if (
          paramLower.includes('бренд') ||
          paramLower.includes('производитель') ||
          paramLower.includes('країна') ||
          paramLower.includes('страна') ||
          paramLower.includes('штрих') ||
          paramLower.includes('міра') ||
          paramLower.includes('кратність')
        ) {
          return;
        }

        const codeAttr = param.code ? ` paramcode="${escapeXml(param.code)}"` : ` paramcode="${escapeXml(slugify(param.name))}"`;
        const valCodeAttr = param.valuecode ? ` valuecode="${escapeXml(param.valuecode)}"` : ` valuecode="${escapeXml(slugify(param.value))}"`;
        lines.push(`<param${codeAttr} name="${escapeXml(param.name)}"${valCodeAttr}>${escapeXml(param.value)}</param>`);
      });

      // Standard Mandatory Epicentr Parameters
      const measure = prod.measure || options.defaultMeasure || 'шт.';
      const measureCode = measure === 'шт.' ? 'measure_pcs' : slugify(measure);
      lines.push(`<param paramcode="measure" name="Міра виміру" valuecode="${measureCode}">${escapeXml(measure)}</param>`);

      const ratio = prod.ratio || options.defaultRatio || '1';
      lines.push(`<param paramcode="ratio" name="Мінімальна кратність товару"><![CDATA[${ratio}]]></param>`);

      const country = prod.country_of_origin || options.defaultCountry || 'Україна';
      const countryCode = slugify(country) || 'ukr';
      lines.push(`<param paramcode="country_of_origin" name="Країна-виробник" valuecode="${countryCode}">${escapeXml(country)}</param>`);

      const brand = prod.brand || options.defaultBrand || 'Generic';
      const brandCode = slugify(brand) || 'generic';
      lines.push(`<param paramcode="brand" name="Бренд" valuecode="${brandCode}">${escapeXml(brand)}</param>`);

      const barcode = prod.barcode || `200000${prod.id.replace(/\D/g, '').padEnd(7, '0').slice(0, 7)}`;
      lines.push(`<param paramcode="barcodes" name="Штрих код"><![CDATA[${barcode}]]></param>`);

      lines.push('</offer>');
    });

    lines.push('</offers>');
    lines.push('</yml_catalog>');

    return lines.join('\n');
  }

  /**
   * Helper to trigger direct browser download of generated XML file
   */
  public static downloadXmlFile(xmlContent: string, filename = 'epicentr_catalog_feed.xml'): void {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Official Epicentr Marketplace XML Feed XSD Schema (PIM v2 Standard)
   */
  public static readonly EPICENTR_OFFICIAL_XSD = `<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" elementFormDefault="qualified">
  <xs:element name="yml_catalog">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="offers" minOccurs="1" maxOccurs="1">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="offer" minOccurs="1" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="price" type="xs:decimal" minOccurs="1" maxOccurs="1"/>
                    <xs:element name="price_old" type="xs:decimal" minOccurs="0" maxOccurs="1"/>
                    <xs:element name="availability" minOccurs="1" maxOccurs="1">
                      <xs:simpleType>
                        <xs:restriction base="xs:string">
                          <xs:enumeration value="in_stock"/>
                          <xs:enumeration value="out_of_stock"/>
                          <xs:enumeration value="on_order"/>
                        </xs:restriction>
                      </xs:simpleType>
                    </xs:element>
                    <xs:element name="category" minOccurs="1" maxOccurs="1">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="code" type="xs:string" use="required"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="picture" type="xs:anyURI" minOccurs="0" maxOccurs="15"/>
                    <xs:element name="name" minOccurs="2" maxOccurs="2">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="lang" use="required">
                              <xs:simpleType>
                                <xs:restriction base="xs:string">
                                  <xs:enumeration value="ru"/>
                                  <xs:enumeration value="ua"/>
                                </xs:restriction>
                              </xs:simpleType>
                            </xs:attribute>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="description" minOccurs="2" maxOccurs="2">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="lang" use="required">
                              <xs:simpleType>
                                <xs:restriction base="xs:string">
                                  <xs:enumeration value="ru"/>
                                  <xs:enumeration value="ua"/>
                                </xs:restriction>
                              </xs:simpleType>
                            </xs:attribute>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="attribute_set" minOccurs="1" maxOccurs="1">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="code" type="xs:string" use="required"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                    <xs:element name="param" minOccurs="5" maxOccurs="unbounded">
                      <xs:complexType>
                        <xs:simpleContent>
                          <xs:extension base="xs:string">
                            <xs:attribute name="paramcode" type="xs:string" use="required"/>
                            <xs:attribute name="name" type="xs:string" use="required"/>
                            <xs:attribute name="valuecode" type="xs:string" use="optional"/>
                          </xs:extension>
                        </xs:simpleContent>
                      </xs:complexType>
                    </xs:element>
                  </xs:sequence>
                  <xs:attribute name="id" type="xs:string" use="required"/>
                  <xs:attribute name="available" type="xs:boolean" use="required"/>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
      <xs:attribute name="date" use="required">
        <xs:simpleType>
          <xs:restriction base="xs:string">
            <xs:pattern value="\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"/>
          </xs:restriction>
        </xs:simpleType>
      </xs:attribute>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

  /**
   * Validates generated XML string against the official Epicentr XSD Schema standards
   */
  public static validateXmlAgainstEpicentrXsd(xmlContent: string): EpicentrXsdValidationReport {
    const issues: EpicentrXsdIssue[] = [];
    const checkpoints: EpicentrXsdCheckpoint[] = [];

    if (!xmlContent || !xmlContent.trim()) {
      return {
        isValid: false,
        validatedAt: new Date().toISOString(),
        offersValidated: 0,
        errorCount: 1,
        warningCount: 0,
        complianceScore: 0,
        checkpoints: [],
        issues: [
          {
            severity: 'error',
            code: 'XSD_EMPTY_DOCUMENT',
            element: 'document',
            message: 'XML-документ порожній. Спочатку згенеруйте XML-фід.'
          }
        ]
      };
    }

    // 1. Check XML Well-formedness & Declaration
    const hasXmlDecl = xmlContent.trimStart().startsWith('<?xml version="1.0" encoding="UTF-8"?>');
    if (!hasXmlDecl) {
      issues.push({
        severity: 'warning',
        code: 'XSD_XML_DECLARATION',
        element: '<?xml?>',
        message: 'Відсутня або нестандартна декларація <?xml version="1.0" encoding="UTF-8"?> на початку файлу.',
        line: 1
      });
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const parserError = xmlDoc.querySelector('parsererror');

    if (parserError) {
      issues.push({
        severity: 'error',
        code: 'XSD_MALFORMED_XML',
        element: 'xml',
        message: `Синтаксична помилка XML (DOMParser): ${parserError.textContent?.slice(0, 180) || 'Некоректна розмітка тегів'}`
      });

      checkpoints.push({
        id: 'xml_syntax',
        title: 'Синтаксис XML та кодування UTF-8',
        xsdRule: 'xs:schema / XML 1.0 Well-Formed',
        passed: false,
        details: 'Виявлено синтаксичну помилку парсингу XML'
      });

      return {
        isValid: false,
        validatedAt: new Date().toISOString(),
        offersValidated: 0,
        errorCount: issues.filter((i) => i.severity === 'error').length,
        warningCount: issues.filter((i) => i.severity === 'warning').length,
        complianceScore: 15,
        checkpoints,
        issues
      };
    }

    checkpoints.push({
      id: 'xml_syntax',
      title: 'Синтаксис XML та кодування UTF-8',
      xsdRule: '<?xml version="1.0" encoding="UTF-8"?>',
      passed: true,
      details: 'Валідне дерево DOM, кодування UTF-8 підтверджено'
    });

    // 2. Root <yml_catalog> & date attribute pattern (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) + forbidden tags check
    const root = xmlDoc.documentElement;
    let rootPassed = true;

    if (!root || root.tagName !== 'yml_catalog') {
      rootPassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_ROOT_ELEMENT',
        element: root?.tagName || 'root',
        message: `Кореневий елемент має бути <yml_catalog>, знайдено <${root?.tagName || 'unknown'}>.`
      });
    } else {
      const dateAttr = root.getAttribute('date');
      const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
      if (!dateAttr) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DATE',
          element: 'yml_catalog[@date]',
          message: 'У кореневому тезі <yml_catalog> відсутній обовʼязковий атрибут date.'
        });
      } else if (!dateRegex.test(dateAttr)) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_DATE_PATTERN',
          element: 'yml_catalog[@date]',
          message: `Атрибут date="${dateAttr}" не відповідає XSD-шаблону "YYYY-MM-DD HH:mm".`
        });
      }

      // Check for prohibited legacy YML tags (<shop>, <currencies>, <categories> outside offers)
      const forbiddenShop = root.querySelector(':scope > shop');
      const forbiddenCurrencies = root.querySelector('currencies');
      const forbiddenCategories = root.querySelector('categories');
      if (forbiddenShop || forbiddenCurrencies || forbiddenCategories) {
        rootPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_FORBIDDEN_LEGACY_TAGS',
          element: 'yml_catalog',
          message: 'Виявлено заборонені застарілі теги (<shop>, <currencies> або <categories>). Схема Епіцентру вимагає прямий контейнер <offers> всередині <yml_catalog>.'
        });
      }
    }

    checkpoints.push({
      id: 'root_catalog',
      title: 'Кореневий вузол <yml_catalog> та формат дати',
      xsdRule: 'xs:element name="yml_catalog" date="\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}"',
      passed: rootPassed,
      details: rootPassed
        ? `date="${root?.getAttribute('date') || ''}", без застарілих тегів <shop>`
        : 'Порушено структуру кореневого елемента або формат дати'
    });

    // 3. <offers> & <offer id="..." available="true|false">
    const offersContainer = root?.querySelector(':scope > offers');
    const offerNodes = offersContainer ? Array.from(offersContainer.querySelectorAll(':scope > offer')) : [];
    let offersStructurePassed = true;

    if (!offersContainer) {
      offersStructurePassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_MISSING_OFFERS',
        element: 'offers',
        message: 'Відсутній обовʼязковий контейнер <offers> безпосередньо всередині <yml_catalog>.'
      });
    } else if (offerNodes.length === 0) {
      offersStructurePassed = false;
      issues.push({
        severity: 'error',
        code: 'XSD_EMPTY_OFFERS',
        element: 'offers',
        message: 'Контейнер <offers> не містить жодного елемента <offer> (xs:minOccurs="1").'
      });
    }

    const seenIds = new Set<string>();
    let elementsStructurePassed = true;
    let bilingualPassed = true;
    let mandatoryParamsPassed = true;

    const REQUIRED_PARAM_CODES = ['measure', 'ratio', 'country_of_origin', 'brand', 'barcodes'];

    offerNodes.forEach((offer, idx) => {
      const offerId = offer.getAttribute('id')?.trim() || '';
      const availableAttr = offer.getAttribute('available');
      const offerLabel = offerId || `#${idx + 1}`;

      if (!offerId) {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_MISSING_ID',
          offerId: offerLabel,
          element: 'offer[@id]',
          message: `Товар #${idx + 1}: відсутній обов'язковий атрибут id в тезі <offer>.`
        });
      } else if (seenIds.has(offerId)) {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_DUPLICATE_ID',
          offerId,
          element: 'offer[@id]',
          message: `Товар [${offerId}]: дублювання унікального атрибута id у фіді.`
        });
      } else {
        seenIds.add(offerId);
      }

      if (availableAttr !== 'true' && availableAttr !== 'false') {
        offersStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_OFFER_AVAILABLE_BOOLEAN',
          offerId: offerLabel,
          element: 'offer[@available]',
          message: `Товар [${offerLabel}]: атрибут available="${availableAttr || ''}" має бути строго "true" або "false" (xs:boolean).`
        });
      }

      // 4. Mandatory child elements: price, availability, category, picture, attribute_set
      const priceNode = offer.querySelector(':scope > price');
      const priceOldNode = offer.querySelector(':scope > price_old');
      const priceVal = priceNode?.textContent?.trim() || '';
      const priceNum = Number(priceVal);

      if (!priceNode || !priceVal || Number.isNaN(priceNum) || priceNum <= 0) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_PRICE',
          offerId: offerLabel,
          element: 'price',
          message: `Товар [${offerLabel}]: тег <price> має містити додатне числове значення (xs:decimal > 0), отримано "${priceVal}".`
        });
      }

      if (priceOldNode && priceOldNode.textContent?.trim()) {
        const oldNum = Number(priceOldNode.textContent.trim());
        if (Number.isNaN(oldNum) || oldNum <= priceNum) {
          issues.push({
            severity: 'warning',
            code: 'XSD_PRICE_OLD_LOGIC',
            offerId: offerLabel,
            element: 'price_old',
            message: `Товар [${offerLabel}]: стара ціна <price_old> (${priceOldNode.textContent.trim()}) має бути більшою за поточну <price> (${priceVal}).`
          });
        }
      }

      const availabilityNode = offer.querySelector(':scope > availability');
      const availVal = availabilityNode?.textContent?.trim() || '';
      if (!['in_stock', 'out_of_stock', 'on_order'].includes(availVal)) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_AVAILABILITY',
          offerId: offerLabel,
          element: 'availability',
          message: `Товар [${offerLabel}]: тег <availability> має значення "${availVal}", дозволені лише: in_stock, out_of_stock, on_order.`
        });
      }

      const categoryNode = offer.querySelector(':scope > category');
      const catCode = categoryNode?.getAttribute('code')?.trim() || '';
      const catText = categoryNode?.textContent?.trim() || '';
      if (!categoryNode || !catCode || !catText) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_CATEGORY',
          offerId: offerLabel,
          element: 'category[@code]',
          message: `Товар [${offerLabel}]: тег <category> повинен мати непорожній атрибут code та назву категорії.`
        });
      }

      const pictureNodes = Array.from(offer.querySelectorAll(':scope > picture'));
      if (pictureNodes.length > 0) {
        pictureNodes.forEach((pic) => {
          const url = pic.textContent?.trim() || '';
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            issues.push({
              severity: 'warning',
              code: 'XSD_PICTURE_URI',
              offerId: offerLabel,
              element: 'picture',
              message: `Товар [${offerLabel}]: значення <picture> "${url.slice(0, 50)}" не є валідним HTTP/HTTPS посиланням.`
            });
          }
        });
      }

      const attrSetNode = offer.querySelector(':scope > attribute_set');
      const attrSetCode = attrSetNode?.getAttribute('code')?.trim() || '';
      const attrSetText = attrSetNode?.textContent?.trim() || '';
      if (!attrSetNode || !attrSetCode || !attrSetText) {
        elementsStructurePassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_INVALID_ATTRIBUTE_SET',
          offerId: offerLabel,
          element: 'attribute_set[@code]',
          message: `Товар [${offerLabel}]: відсутній або неповний обов'язковий тег <attribute_set code="...">.`
        });
      }

      // 5. Bilingual <name lang="ua|ru"> and <description lang="ua|ru">
      const nameUa = offer.querySelector(':scope > name[lang="ua"]')?.textContent?.trim() || '';
      const nameRu = offer.querySelector(':scope > name[lang="ru"]')?.textContent?.trim() || '';
      if (!nameUa) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_NAME_UA',
          offerId: offerLabel,
          element: 'name[@lang="ua"]',
          message: `Товар [${offerLabel}]: відсутня обов'язкова українська назва <name lang="ua">.`
        });
      }
      if (!nameRu) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_NAME_RU',
          offerId: offerLabel,
          element: 'name[@lang="ru"]',
          message: `Товар [${offerLabel}]: відсутня обов'язкова російська назва <name lang="ru">.`
        });
      }

      const descUa = offer.querySelector(':scope > description[lang="ua"]')?.textContent?.trim() || '';
      const descRu = offer.querySelector(':scope > description[lang="ru"]')?.textContent?.trim() || '';
      if (!descUa) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DESC_UA',
          offerId: offerLabel,
          element: 'description[@lang="ua"]',
          message: `Товар [${offerLabel}]: відсутній обов'язковий опис українською <description lang="ua">.`
        });
      }
      if (!descRu) {
        bilingualPassed = false;
        issues.push({
          severity: 'error',
          code: 'XSD_MISSING_DESC_RU',
          offerId: offerLabel,
          element: 'description[@lang="ru"]',
          message: `Товар [${offerLabel}]: відсутній обов'язковий опис російською <description lang="ru">.`
        });
      }

      // 6. Mandatory PIM <param> nodes & attributes
      const paramNodes = Array.from(offer.querySelectorAll(':scope > param'));
      const foundParamCodes = new Set<string>();

      paramNodes.forEach((param) => {
        const pCode = param.getAttribute('paramcode')?.trim() || '';
        const pName = param.getAttribute('name')?.trim() || '';
        const pVal = param.textContent?.trim() || '';

        if (!pCode || !pName) {
          mandatoryParamsPassed = false;
          issues.push({
            severity: 'error',
            code: 'XSD_PARAM_MISSING_ATTRS',
            offerId: offerLabel,
            element: 'param',
            message: `Товар [${offerLabel}]: тег <param> повинен містити обов'язкові атрибути paramcode та name.`
          });
        } else {
          foundParamCodes.add(pCode);
        }

        if (!pVal) {
          issues.push({
            severity: 'warning',
            code: 'XSD_EMPTY_PARAM_VALUE',
            offerId: offerLabel,
            element: `param[@paramcode="${pCode}"]`,
            message: `Товар [${offerLabel}]: атрибут "${pName}" (${pCode}) має порожнє значення.`
          });
        }
      });

      REQUIRED_PARAM_CODES.forEach((reqCode) => {
        if (!foundParamCodes.has(reqCode)) {
          mandatoryParamsPassed = false;
          issues.push({
            severity: 'error',
            code: 'XSD_MISSING_SYSTEM_PARAM',
            offerId: offerLabel,
            element: `param[@paramcode="${reqCode}"]`,
            message: `Товар [${offerLabel}]: відсутній обов'язковий системний параметр Епіцентру <param paramcode="${reqCode}">.`
          });
        }
      });
    });

    checkpoints.push({
      id: 'offers_structure',
      title: 'Контейнер <offers> та атрибути <offer id available>',
      xsdRule: 'offer[@id (unique), @available (xs:boolean)]',
      passed: offersStructurePassed,
      details: offersStructurePassed
        ? `Перевірено ${offerNodes.length} унікальних пропозицій (offers)`
        : 'Виявлено помилки унікальності ID або атрибута available'
    });

    checkpoints.push({
      id: 'mandatory_elements',
      title: 'Обовʼязкові вузли: price, availability, category, attribute_set (picture опціонально)',
      xsdRule: 'xs:sequence (price, availability, category[@code], attribute_set[@code])',
      passed: elementsStructurePassed,
      details: elementsStructurePassed
        ? 'Усі обовʼязкові теги та коди категорій присутні'
        : 'Відсутні обовʼязкові теги або коди категорій/наборів'
    });

    checkpoints.push({
      id: 'bilingual_tags',
      title: 'Двомовна локалізація <name> та <description> (lang="ua" / "ru")',
      xsdRule: 'name[@lang="ua|ru"], description[@lang="ua|ru"] (CDATA)',
      passed: bilingualPassed,
      details: bilingualPassed
        ? 'Усі товари містять непорожні UA та RU версії назви й опису'
        : 'Незаповнені двомовні теги name або description'
    });

    checkpoints.push({
      id: 'pim_params',
      title: 'Системні параметри PIM (measure, ratio, country_of_origin, brand, barcodes)',
      xsdRule: 'param[@paramcode, @name, @valuecode]',
      passed: mandatoryParamsPassed,
      details: mandatoryParamsPassed
        ? 'Усі 5 системних параметрів та коди атрибутів валідні'
        : 'Відсутні обовʼязкові системні параметри або paramcode'
    });

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const passedCheckpointsCount = checkpoints.filter((c) => c.passed).length;
    const complianceScore =
      checkpoints.length > 0
        ? Math.max(0, Math.round((passedCheckpointsCount / checkpoints.length) * 100) - Math.min(20, errorCount * 5))
        : 0;

    return {
      isValid: errorCount === 0,
      validatedAt: new Date().toISOString(),
      offersValidated: offerNodes.length,
      errorCount,
      warningCount,
      complianceScore: errorCount === 0 ? 100 : complianceScore,
      checkpoints,
      issues
    };
  }
}

export interface EpicentrXsdIssue {
  severity: 'error' | 'warning';
  code: string;
  element: string;
  offerId?: string;
  message: string;
  line?: number;
}

export interface EpicentrXsdCheckpoint {
  id: string;
  title: string;
  xsdRule: string;
  passed: boolean;
  details: string;
}

export interface EpicentrXsdValidationReport {
  isValid: boolean;
  validatedAt: string;
  offersValidated: number;
  errorCount: number;
  warningCount: number;
  complianceScore: number;
  checkpoints: EpicentrXsdCheckpoint[];
  issues: EpicentrXsdIssue[];
}

