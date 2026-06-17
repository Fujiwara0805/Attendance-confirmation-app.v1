import JSZip from 'jszip';
import type JSZipType from 'jszip';

export type ProjectionDocument =
  | ProjectionSpreadsheetDocument
  | ProjectionPresentationDocument
  | ProjectionWordDocument;

export interface ProjectionSpreadsheetDocument {
  kind: 'spreadsheet';
  name: string;
  sheets: ProjectionSheet[];
}

export interface ProjectionSheet {
  name: string;
  rows: string[][];
  cellStyles: ProjectionCellStyle[][];
  totalRows: number;
  totalColumns: number;
  objects: ProjectionSheetObject[];
}

export interface ProjectionCellStyle {
  backgroundColor?: string;
}

export type ProjectionSheetObject = ProjectionSheetChart | ProjectionSheetImage;

export interface ProjectionSheetChart {
  type: 'chart';
  id: string;
  title: string;
  chartType: 'bar' | 'line' | 'scatter' | 'area' | 'pie' | 'unknown';
  orientation: 'horizontal' | 'vertical';
  anchor: string | null;
  series: ProjectionChartSeries[];
}

export interface ProjectionChartSeries {
  name: string;
  categories: string[];
  values: number[];
  pointLabels?: string[];
}

export interface ProjectionSheetImage {
  type: 'image';
  id: string;
  title: string;
  src: string;
  alt: string;
  anchor: string | null;
}

export interface ProjectionPresentationDocument {
  kind: 'presentation';
  name: string;
  slideSize: {
    width: number;
    height: number;
  };
  slides: ProjectionSlide[];
}

export interface ProjectionSlide {
  id: string;
  title: string;
  backgroundColor: string;
  elements: ProjectionSlideElement[];
}

export type ProjectionSlideElement =
  | ProjectionSlideTextElement
  | ProjectionSlideImageElement
  | ProjectionSlideShapeElement;

export interface ProjectionSlideRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ProjectionSlideTextElement {
  type: 'text';
  id: string;
  rect: ProjectionSlideRect;
  text: string;
  fontSizeEmu: number;
  color: string;
  backgroundColor: string | null;
  fontWeight: 'normal' | 'bold';
  textAlign: 'left' | 'center' | 'right';
}

export interface ProjectionSlideImageElement {
  type: 'image';
  id: string;
  rect: ProjectionSlideRect;
  src: string;
  alt: string;
}

export interface ProjectionSlideShapeElement {
  type: 'shape';
  id: string;
  rect: ProjectionSlideRect;
  backgroundColor: string;
}

export interface ProjectionWordDocument {
  kind: 'word';
  name: string;
  blocks: ProjectionWordBlock[];
}

export type ProjectionWordBlock =
  | ProjectionWordParagraphBlock
  | ProjectionWordTableBlock
  | ProjectionWordImageBlock;

export interface ProjectionWordParagraphBlock {
  type: 'paragraph';
  id: string;
  text: string;
  headingLevel: number | null;
  textAlign: 'left' | 'center' | 'right';
}

export interface ProjectionWordTableBlock {
  type: 'table';
  id: string;
  rows: string[][];
}

export interface ProjectionWordImageBlock {
  type: 'image';
  id: string;
  src: string;
  alt: string;
}

const DEFAULT_SLIDE_SIZE = {
  width: 12192000,
  height: 6858000,
};

interface SpreadsheetPackage {
  zip: JSZipType;
  sheetPathsByName: Map<string, string>;
  cellStyleByIndex: Map<number, ProjectionCellStyle>;
}

interface SpreadsheetRowRecord {
  sourceRow: number;
  sourceStartColumn: number;
  values: string[];
}

interface SpreadsheetRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

interface SpreadsheetColorStop {
  type: string;
  value: number | null;
  color: string;
}

interface SpreadsheetColorScaleRule {
  ranges: SpreadsheetRange[];
  stops: SpreadsheetColorStop[];
}

export async function parseProjectionDocument(file: File): Promise<ProjectionDocument> {
  const fileName = file.name || '資料';
  const extension = fileName.split('.').pop()?.toLowerCase();

  if (extension === 'xlsx' || extension === 'xls' || extension === 'csv') {
    return parseSpreadsheet(file);
  }

  if (extension === 'pptx') {
    return parsePresentation(file);
  }

  if (extension === 'docx') {
    return parseWordDocument(file);
  }

  if (extension === 'ppt') {
    throw new Error('古い PowerPoint 形式（.ppt）は未対応です。.pptx に変換してから取り込んでください。');
  }

  if (extension === 'doc') {
    throw new Error('古い Word 形式（.doc）は未対応です。.docx に変換してから取り込んでください。');
  }

  throw new Error('Excel（.xlsx/.xls/.csv）、PowerPoint（.pptx）、Word（.docx）を選択してください。');
}

async function parseSpreadsheet(file: File): Promise<ProjectionSpreadsheetDocument> {
  const XLSX = await import('xlsx');
  const extension = file.name.split('.').pop()?.toLowerCase();
  const binaryBuffer = extension === 'csv' ? null : await file.arrayBuffer();
  const workbook =
    extension === 'csv'
      ? XLSX.read(await file.text(), { type: 'string', cellDates: true })
      : XLSX.read(binaryBuffer, { type: 'array', cellDates: true });
  const spreadsheetPackage =
    extension === 'xlsx' && binaryBuffer ? await readSpreadsheetPackage(binaryBuffer) : null;

  const sheets = await Promise.all(workbook.SheetNames.map(async (sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const range = worksheet['!ref'] ? XLSX.utils.decode_range(worksheet['!ref']) : null;
    const rowRecords: SpreadsheetRowRecord[] = [];
    let totalColumns = 0;

    if (range) {
      for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
        const values: string[] = [];
        let lastValueColumn = -1;

        for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
          const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
          const value = formatWorksheetCell(worksheet[cellRef]);
          const displayColumn = columnIndex - range.s.c;
          values[displayColumn] = value;

          if (value !== '') {
            lastValueColumn = displayColumn;
          }
        }

        if (lastValueColumn >= 0) {
          totalColumns = Math.max(totalColumns, lastValueColumn + 1);
          rowRecords.push({ sourceRow: rowIndex, sourceStartColumn: range.s.c, values });
        }
      }
    }

    const rows = rowRecords.map((row) =>
      Array.from({ length: totalColumns }, (_, index) => row.values[index] || '')
    );
    const cellStyles = spreadsheetPackage
      ? await readSheetCellStyles(spreadsheetPackage, sheetName, rowRecords, totalColumns, rows)
      : [];

    return {
      name: sheetName,
      rows,
      cellStyles,
      totalRows: rows.length,
      totalColumns,
      objects: spreadsheetPackage ? await readSheetObjects(spreadsheetPackage, sheetName) : [],
    };
  }));

  return {
    kind: 'spreadsheet',
    name: file.name,
    sheets: sheets.length > 0 ? sheets : [createEmptySheet()],
  };
}

async function parsePresentation(file: File): Promise<ProjectionPresentationDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideSize = await readSlideSize(zip);
  const slidePaths = await readOrderedSlidePaths(zip);

  if (slidePaths.length === 0) {
    throw new Error('PowerPoint ファイルからスライドを読み込めませんでした。');
  }

  const slides: ProjectionSlide[] = [];

  for (const slidePath of slidePaths) {
    const slideFile = zip.file(slidePath);
    if (!slideFile) continue;

    const slideXml = await slideFile.async('string');
    const slideDoc = parseXml(slideXml);
    const relationships = await readRelationships(zip, slidePath);
    const elements: ProjectionSlideElement[] = [];
    const slideNumber = extractSlideNumber(slidePath);
    const shapeTree = getFirstDescendantByLocalName(slideDoc, 'spTree');
    const drawableNodes = shapeTree
      ? Array.from(shapeTree.children).filter((node) => node.localName === 'sp' || node.localName === 'pic')
      : [
          ...getDescendantsByLocalName(slideDoc, 'sp'),
          ...getDescendantsByLocalName(slideDoc, 'pic'),
        ];

    for (let index = 0; index < drawableNodes.length; index += 1) {
      const node = drawableNodes[index];

      if (node.localName === 'sp') {
        const shapeProperties = getFirstDescendantByLocalName(node, 'spPr');
        const text = extractShapeText(node);
        const fillColor = shapeProperties ? extractSolidFillColor(shapeProperties) : null;
        const rect = extractRect(shapeProperties || node, slideSize);
        const imageFill = await parsePictureElement(
          zip,
          relationships,
          slidePath,
          node,
          slideSize,
          slideNumber,
          index
        );

        if (imageFill) {
          elements.push(imageFill);
          continue;
        }

        if (!rect || (!text && !fillColor)) continue;

        if (text) {
          elements.push({
            type: 'text',
            id: `slide-${slideNumber}-text-${index}`,
            rect,
            text,
            fontSizeEmu: extractFontSizeEmu(node),
            color: extractTextColor(node),
            backgroundColor: fillColor,
            fontWeight: extractFontWeight(node),
            textAlign: extractTextAlign(node),
          });
          continue;
        }

        if (fillColor) {
          elements.push({
            type: 'shape',
            id: `slide-${slideNumber}-shape-${index}`,
            rect,
            backgroundColor: fillColor,
          });
        }
        continue;
      }

      if (node.localName === 'pic') {
        const pictureElement = await parsePictureElement(
          zip,
          relationships,
          slidePath,
          node,
          slideSize,
          slideNumber,
          index
        );
        if (pictureElement) elements.push(pictureElement);
      }
    }

    slides.push({
      id: `slide-${slideNumber}`,
      title: `スライド ${slideNumber}`,
      backgroundColor: extractSlideBackground(slideDoc),
      elements,
    });
  }

  return {
    kind: 'presentation',
    name: file.name,
    slideSize,
    slides,
  };
}

async function parseWordDocument(file: File): Promise<ProjectionWordDocument> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    throw new Error('Word ファイルから本文を読み込めませんでした。');
  }

  const documentDoc = parseXml(documentXml);
  const relationships = await readRelationships(zip, 'word/document.xml');
  const body = getFirstDescendantByLocalName(documentDoc, 'body');
  const blocks: ProjectionWordBlock[] = [];

  if (body) {
    const bodyChildren = Array.from(body.children).filter((child) => child.localName === 'p' || child.localName === 'tbl');

    for (let index = 0; index < bodyChildren.length; index += 1) {
      const child = bodyChildren[index];

      if (child.localName === 'tbl') {
        const table = extractWordTable(child, `word-table-${index}`);
        if (table) blocks.push(table);
        continue;
      }

      const paragraph = extractWordParagraph(child, `word-paragraph-${index}`);
      if (paragraph) blocks.push(paragraph);

      const images = await extractWordImages(zip, relationships, child, `word-image-${index}`);
      blocks.push(...images);
    }
  }

  if (blocks.length === 0) {
    throw new Error('Word ファイルに表示できる本文がありません。');
  }

  return {
    kind: 'word',
    name: file.name,
    blocks,
  };
}

async function parsePictureElement(
  zip: JSZipType,
  relationships: Map<string, string>,
  slidePath: string,
  picture: Element,
  slideSize: { width: number; height: number },
  slideNumber: number,
  index: number
): Promise<ProjectionSlideImageElement | null> {
  const blip = getFirstDescendantByLocalName(picture, 'blip');
  const relationshipId = blip
    ? getRelationshipAttribute(blip, 'embed') || getRelationshipAttribute(blip, 'link')
    : null;
  const target = relationshipId ? relationships.get(relationshipId) : null;
  const rect = extractRect(picture, slideSize);

  if (!target || !rect) return null;

  const mediaPath = resolveRelationshipTarget(slidePath, target);
  const mediaFile = zip.file(mediaPath);
  if (!mediaFile) return null;

  const src = `data:${mimeTypeForPath(mediaPath)};base64,${await mediaFile.async('base64')}`;
  return {
    type: 'image',
    id: `slide-${slideNumber}-image-${index}`,
    rect,
    src,
    alt: `スライド ${slideNumber} の画像 ${index + 1}`,
  };
}

async function readSpreadsheetPackage(buffer: ArrayBuffer): Promise<SpreadsheetPackage | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const workbookXml = await zip.file('xl/workbook.xml')?.async('string');
    if (!workbookXml) return null;

    const workbookDoc = parseXml(workbookXml);
    const workbookRelationships = await readRelationships(zip, 'xl/workbook.xml');
    const sheetPathsByName = new Map<string, string>();
    const cellStyleByIndex = await readWorkbookCellStyles(zip);

    getDescendantsByLocalName(workbookDoc, 'sheet').forEach((sheet) => {
      const name = sheet.getAttribute('name');
      const relationshipId = getRelationshipAttribute(sheet, 'id');
      const target = relationshipId ? workbookRelationships.get(relationshipId) : null;
      if (!name || !target) return;

      sheetPathsByName.set(name, resolveRelationshipTarget('xl/workbook.xml', target));
    });

    return { zip, sheetPathsByName, cellStyleByIndex };
  } catch {
    return null;
  }
}

async function readWorkbookCellStyles(zip: JSZipType): Promise<Map<number, ProjectionCellStyle>> {
  const stylesXml = await zip.file('xl/styles.xml')?.async('string');
  const cellStyleByIndex = new Map<number, ProjectionCellStyle>();
  if (!stylesXml) return cellStyleByIndex;

  try {
    const stylesDoc = parseXml(stylesXml);
    const fills = getFirstDescendantByLocalName(stylesDoc, 'fills');
    const fillColors = fills
      ? getDirectChildrenByLocalName(fills, 'fill').map((fill) => extractSpreadsheetFillColor(fill))
      : [];
    const cellXfs = getFirstDescendantByLocalName(stylesDoc, 'cellXfs');
    if (!cellXfs) return cellStyleByIndex;

    getDirectChildrenByLocalName(cellXfs, 'xf').forEach((xf, index) => {
      const fillId = Number(xf.getAttribute('fillId'));
      const backgroundColor = Number.isFinite(fillId) ? fillColors[fillId] : null;
      if (backgroundColor) {
        cellStyleByIndex.set(index, { backgroundColor });
      }
    });
  } catch {
    return cellStyleByIndex;
  }

  return cellStyleByIndex;
}

async function readSheetCellStyles(
  spreadsheetPackage: SpreadsheetPackage,
  sheetName: string,
  rowRecords: SpreadsheetRowRecord[],
  totalColumns: number,
  rows: string[][]
): Promise<ProjectionCellStyle[][]> {
  const sheetPath = spreadsheetPackage.sheetPathsByName.get(sheetName);
  const emptyStyles = rowRecords.map(() => Array.from({ length: totalColumns }, () => ({})));
  if (!sheetPath || totalColumns === 0) return emptyStyles;

  try {
    const sheetXml = await spreadsheetPackage.zip.file(sheetPath)?.async('string');
    if (!sheetXml) return emptyStyles;

    const sheetDoc = parseXml(sheetXml);
    const rowIndexBySourceRow = new Map(rowRecords.map((row, index) => [row.sourceRow, index]));
    const cellStyles = emptyStyles.map((row) => row.map((style) => ({ ...style })));

    getDescendantsByLocalName(sheetDoc, 'c').forEach((cell) => {
      const reference = parseCellReference(cell.getAttribute('r') || '');
      const styleIndex = Number(cell.getAttribute('s'));
      const baseStyle = Number.isFinite(styleIndex) ? spreadsheetPackage.cellStyleByIndex.get(styleIndex) : null;
      if (!reference || !baseStyle) return;

      const displayRow = rowIndexBySourceRow.get(reference.row);
      if (displayRow === undefined) return;

      const displayColumn = reference.column - rowRecords[displayRow].sourceStartColumn;
      if (displayColumn < 0 || displayColumn >= totalColumns) return;

      cellStyles[displayRow][displayColumn] = {
        ...cellStyles[displayRow][displayColumn],
        ...baseStyle,
      };
    });

    const colorScaleRules = extractColorScaleRules(sheetDoc);
    colorScaleRules.forEach((rule) => {
      applyColorScaleRule(rule, rowRecords, rows, cellStyles, totalColumns);
    });

    return cellStyles;
  } catch {
    return emptyStyles;
  }
}

async function readSheetObjects(
  spreadsheetPackage: SpreadsheetPackage,
  sheetName: string
): Promise<ProjectionSheetObject[]> {
  const sheetPath = spreadsheetPackage.sheetPathsByName.get(sheetName);
  if (!sheetPath) return [];

  try {
    const sheetXml = await spreadsheetPackage.zip.file(sheetPath)?.async('string');
    if (!sheetXml) return [];

    const sheetDoc = parseXml(sheetXml);
    const sheetRelationships = await readRelationships(spreadsheetPackage.zip, sheetPath);
    const drawingPaths = new Set<string>();

    getDescendantsByLocalName(sheetDoc, 'drawing').forEach((drawing) => {
      const relationshipId = getRelationshipAttribute(drawing, 'id');
      const target = relationshipId ? sheetRelationships.get(relationshipId) : null;
      if (target) drawingPaths.add(resolveRelationshipTarget(sheetPath, target));
    });

    const drawingObjects = await Promise.all(
      Array.from(drawingPaths).map((drawingPath) => readDrawingObjects(spreadsheetPackage.zip, drawingPath))
    );

    return drawingObjects.flat();
  } catch {
    return [];
  }
}

async function readDrawingObjects(zip: JSZipType, drawingPath: string): Promise<ProjectionSheetObject[]> {
  try {
    const drawingXml = await zip.file(drawingPath)?.async('string');
    if (!drawingXml) return [];

    const drawingDoc = parseXml(drawingXml);
    const drawingRelationships = await readRelationships(zip, drawingPath);
    const anchors = [
      ...getDescendantsByLocalName(drawingDoc, 'twoCellAnchor'),
      ...getDescendantsByLocalName(drawingDoc, 'oneCellAnchor'),
      ...getDescendantsByLocalName(drawingDoc, 'absoluteAnchor'),
    ];
    const objects: ProjectionSheetObject[] = [];

    for (let index = 0; index < anchors.length; index += 1) {
      const anchor = anchors[index];
      const anchorCell = readAnchorCell(anchor);
      const objectName = extractDrawingObjectName(anchor);
      const chartElement = getFirstDescendantByLocalName(anchor, 'chart');
      const chartRelationshipId = chartElement ? getRelationshipAttribute(chartElement, 'id') : null;
      const chartTarget = chartRelationshipId ? drawingRelationships.get(chartRelationshipId) : null;

      if (chartTarget) {
        const chartPath = resolveRelationshipTarget(drawingPath, chartTarget);
        const chart = await readSpreadsheetChart(
          zip,
          chartPath,
          `${drawingPath}-chart-${index}`,
          anchorCell,
          objectName
        );
        if (chart) objects.push(chart);
        continue;
      }

      const blip = getFirstDescendantByLocalName(anchor, 'blip');
      const imageRelationshipId = blip
        ? getRelationshipAttribute(blip, 'embed') || getRelationshipAttribute(blip, 'link')
        : null;
      const imageTarget = imageRelationshipId ? drawingRelationships.get(imageRelationshipId) : null;

      if (imageTarget) {
        const mediaPath = resolveRelationshipTarget(drawingPath, imageTarget);
        const mediaFile = zip.file(mediaPath);
        if (!mediaFile) continue;

        objects.push({
          type: 'image',
          id: `${drawingPath}-image-${index}`,
          title: objectName || `画像 ${objects.length + 1}`,
          src: `data:${mimeTypeForPath(mediaPath)};base64,${await mediaFile.async('base64')}`,
          alt: objectName || `シート内画像 ${objects.length + 1}`,
          anchor: anchorCell,
        });
      }
    }

    return objects;
  } catch {
    return [];
  }
}

async function readSpreadsheetChart(
  zip: JSZipType,
  chartPath: string,
  id: string,
  anchor: string | null,
  fallbackTitle: string | null
): Promise<ProjectionSheetChart | null> {
  try {
    const chartXml = await zip.file(chartPath)?.async('string');
    if (!chartXml) return null;

    const chartDoc = parseXml(chartXml);
    const chartNode = findChartNode(chartDoc);
    const chartType = chartNode ? mapChartType(chartNode.localName) : 'unknown';
    const orientation = chartNode?.localName === 'barChart' && getChartBarDirection(chartNode) === 'bar'
      ? 'horizontal'
      : 'vertical';
    const seriesNodes = chartNode ? getDirectChildrenByLocalName(chartNode, 'ser') : getDescendantsByLocalName(chartDoc, 'ser');
    const series = seriesNodes
      .map((seriesNode, index) => parseChartSeries(seriesNode, chartType, index))
      .filter((item): item is ProjectionChartSeries => !!item);

    return {
      type: 'chart',
      id,
      title: extractChartTitle(chartDoc) || fallbackTitle || chartTypeLabel(chartType),
      chartType,
      orientation,
      anchor,
      series,
    };
  } catch {
    return null;
  }
}

function createEmptySheet(): ProjectionSheet {
  return {
    name: 'Sheet1',
    rows: [],
    cellStyles: [],
    totalRows: 0,
    totalColumns: 0,
    objects: [],
  };
}

function formatWorksheetCell(cell: unknown): string {
  if (!cell || typeof cell !== 'object') return '';

  const worksheetCell = cell as { w?: unknown; v?: unknown };
  if (typeof worksheetCell.w === 'string') return worksheetCell.w.trim();
  return formatCellValue(worksheetCell.v);
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleDateString('ja-JP');
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'string') return value.trim();
  return String(value);
}

async function readSlideSize(zip: JSZipType) {
  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
  if (!presentationXml) return DEFAULT_SLIDE_SIZE;

  const presentationDoc = parseXml(presentationXml);
  const slideSize = getFirstDescendantByLocalName(presentationDoc, 'sldSz');
  const width = Number(slideSize?.getAttribute('cx'));
  const height = Number(slideSize?.getAttribute('cy'));

  return {
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_SLIDE_SIZE.width,
    height: Number.isFinite(height) && height > 0 ? height : DEFAULT_SLIDE_SIZE.height,
  };
}

async function readOrderedSlidePaths(zip: JSZipType) {
  const fallback = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => extractSlideNumber(a) - extractSlideNumber(b));

  const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
  const relationshipXml = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
  if (!presentationXml || !relationshipXml) return fallback;

  const presentationDoc = parseXml(presentationXml);
  const relationshipDoc = parseXml(relationshipXml);
  const relationships = new Map<string, string>();

  Array.from(relationshipDoc.getElementsByTagName('Relationship')).forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) relationships.set(id, target);
  });

  const ordered = getDescendantsByLocalName(presentationDoc, 'sldId')
    .map((slideId) => getRelationshipAttribute(slideId, 'id'))
    .map((relationshipId) => (relationshipId ? relationships.get(relationshipId) : null))
    .map((target) => (target ? resolveRelationshipTarget('ppt/presentation.xml', target) : null))
    .filter((path): path is string => !!path && !!zip.file(path));

  return ordered.length > 0 ? ordered : fallback;
}

async function readRelationships(
  zip: JSZipType,
  slidePath: string
) {
  const fileName = slidePath.split('/').pop();
  const directory = slidePath.slice(0, slidePath.lastIndexOf('/'));
  const relationshipPath = `${directory}/_rels/${fileName}.rels`;
  const relationshipXml = await zip.file(relationshipPath)?.async('string');
  const relationships = new Map<string, string>();

  if (!relationshipXml) return relationships;

  const relationshipDoc = parseXml(relationshipXml);
  Array.from(relationshipDoc.getElementsByTagName('Relationship')).forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) relationships.set(id, target);
  });

  return relationships;
}

function parseXml(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('資料ファイルの XML を解析できませんでした。');
  }
  return doc;
}

function getDescendantsByLocalName(root: ParentNode, localName: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName === localName);
}

function getFirstDescendantByLocalName(root: ParentNode, localName: string): Element | null {
  return getDescendantsByLocalName(root, localName)[0] || null;
}

function getDirectChildrenByLocalName(root: ParentNode, localName: string): Element[] {
  return Array.from(root.children).filter((element) => element.localName === localName);
}

function getDirectChildByLocalName(root: ParentNode, localName: string): Element | null {
  return getDirectChildrenByLocalName(root, localName)[0] || null;
}

function getRelationshipAttribute(element: Element, localName: string) {
  const direct = element.getAttribute(`r:${localName}`) || element.getAttribute(localName);
  if (direct) return direct;

  const relationshipAttribute = Array.from(element.attributes).find(
    (attribute) =>
      attribute.localName === localName &&
      attribute.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  );
  return relationshipAttribute?.value || null;
}

function getAnyAttribute(element: Element, localName: string) {
  return element.getAttribute(localName) ||
    Array.from(element.attributes).find((attribute) => attribute.localName === localName)?.value ||
    null;
}

function extractSlideNumber(path: string) {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] || 0);
}

function readAnchorCell(anchor: Element): string | null {
  const from = getDirectChildByLocalName(anchor, 'from');
  if (!from) return null;

  const column = Number(getDirectChildByLocalName(from, 'col')?.textContent || NaN);
  const row = Number(getDirectChildByLocalName(from, 'row')?.textContent || NaN);
  if (!Number.isFinite(column) || !Number.isFinite(row)) return null;

  return `${columnIndexToName(column)}${row + 1}`;
}

function columnIndexToName(zeroBasedIndex: number) {
  let column = Math.max(0, Math.floor(zeroBasedIndex)) + 1;
  let name = '';

  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }

  return name;
}

function parseCellReference(reference: string): { column: number; row: number } | null {
  const match = reference.match(/^([A-Z]+)(\d+)$/i);
  if (!match) return null;

  return {
    column: columnNameToIndex(match[1]),
    row: Number(match[2]) - 1,
  };
}

function columnNameToIndex(name: string) {
  return name
    .toUpperCase()
    .split('')
    .reduce((value, character) => value * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

function parseSpreadsheetRange(rawRange: string): SpreadsheetRange | null {
  const [startRaw, endRaw = startRaw] = rawRange.split(':');
  const start = parseCellReference(startRaw);
  const end = parseCellReference(endRaw);
  if (!start || !end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endColumn: Math.max(start.column, end.column),
  };
}

function extractDrawingObjectName(anchor: Element): string | null {
  const nonVisualProperties = getFirstDescendantByLocalName(anchor, 'cNvPr');
  const title = nonVisualProperties?.getAttribute('title');
  const description = nonVisualProperties?.getAttribute('descr');
  const name = nonVisualProperties?.getAttribute('name');
  return title || description || name || null;
}

function findChartNode(chartDoc: Document): Element | null {
  const chartNodeNames = ['barChart', 'lineChart', 'scatterChart', 'areaChart', 'pieChart', 'doughnutChart'];
  for (const chartNodeName of chartNodeNames) {
    const chartNode = getFirstDescendantByLocalName(chartDoc, chartNodeName);
    if (chartNode) return chartNode;
  }
  return null;
}

function mapChartType(localName: string): ProjectionSheetChart['chartType'] {
  if (localName === 'barChart') return 'bar';
  if (localName === 'lineChart') return 'line';
  if (localName === 'scatterChart') return 'scatter';
  if (localName === 'areaChart') return 'area';
  if (localName === 'pieChart' || localName === 'doughnutChart') return 'pie';
  return 'unknown';
}

function getChartBarDirection(chartNode: Element) {
  return getFirstDescendantByLocalName(chartNode, 'barDir')?.getAttribute('val') || 'col';
}

function parseChartSeries(
  seriesNode: Element,
  chartType: ProjectionSheetChart['chartType'],
  index: number
): ProjectionChartSeries | null {
  const valueRoot =
    chartType === 'scatter'
      ? getFirstDescendantByLocalName(seriesNode, 'yVal') || getFirstDescendantByLocalName(seriesNode, 'val')
      : getFirstDescendantByLocalName(seriesNode, 'val') || getFirstDescendantByLocalName(seriesNode, 'yVal');
  const categoryRoot =
    chartType === 'scatter'
      ? getFirstDescendantByLocalName(seriesNode, 'xVal') || getFirstDescendantByLocalName(seriesNode, 'cat')
      : getFirstDescendantByLocalName(seriesNode, 'cat') || getFirstDescendantByLocalName(seriesNode, 'xVal');

  const rawValues = valueRoot ? extractCachedValues(valueRoot) : [];
  const rawCategories = categoryRoot ? extractCachedValues(categoryRoot) : [];
  const values: number[] = [];
  const categories: string[] = [];

  rawValues.forEach((value, valueIndex) => {
    const numberValue = parseChartNumber(value);
    if (!Number.isFinite(numberValue)) return;

    values.push(numberValue);
    categories.push(rawCategories[valueIndex] || String(valueIndex + 1));
  });

  if (values.length === 0) return null;

  return {
    name: extractSeriesName(seriesNode, index),
    categories,
    values,
    pointLabels: extractChartPointLabels(seriesNode, categories),
  };
}

function parseChartNumber(value: string) {
  const normalized = value.replace(/,/g, '').replace(/%$/, '').trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function extractCachedValues(root: Element): string[] {
  const points = getDescendantsByLocalName(root, 'pt')
    .map((point, order) => ({
      order,
      index: Number(point.getAttribute('idx')),
      value: getFirstDescendantByLocalName(point, 'v')?.textContent?.trim() || '',
    }))
    .filter((point) => point.value !== '')
    .sort((a, b) => {
      const aIndex = Number.isFinite(a.index) ? a.index : a.order;
      const bIndex = Number.isFinite(b.index) ? b.index : b.order;
      return aIndex - bIndex;
    });

  if (points.length > 0) return points.map((point) => point.value);

  return getDescendantsByLocalName(root, 'v')
    .map((value) => value.textContent?.trim() || '')
    .filter(Boolean);
}

function extractSeriesName(seriesNode: Element, index: number) {
  const textNode = getFirstDescendantByLocalName(seriesNode, 'tx');
  if (!textNode) return `系列 ${index + 1}`;

  const cachedName = extractCachedValues(textNode)[0];
  if (cachedName) return cachedName;

  return getFirstDescendantByLocalName(textNode, 'v')?.textContent?.trim() || `系列 ${index + 1}`;
}

function extractChartPointLabels(seriesNode: Element, categories: string[]) {
  const labels: string[] = [];
  const dataLabels = getFirstDescendantByLocalName(seriesNode, 'dLbls');
  if (!dataLabels) return labels;

  getDirectChildrenByLocalName(dataLabels, 'dLbl').forEach((labelNode) => {
    const index = Number(getFirstDescendantByLocalName(labelNode, 'idx')?.getAttribute('val'));
    if (!Number.isFinite(index)) return;

    const customText = extractChartRichText(labelNode);
    if (customText) labels[index] = customText;
  });

  const showCategoryName = getFirstDescendantByLocalName(dataLabels, 'showCatName')?.getAttribute('val');
  if ((showCategoryName === '1' || showCategoryName === 'true') && labels.length === 0) {
    return categories;
  }

  return labels;
}

function extractChartRichText(root: ParentNode) {
  return getDescendantsByLocalName(root, 't')
    .map((node) => node.textContent || '')
    .join('')
    .trim();
}

function extractChartTitle(chartDoc: Document) {
  const chartRoot = getFirstDescendantByLocalName(chartDoc, 'chart');
  const title = chartRoot ? getFirstDescendantByLocalName(chartRoot, 'title') : null;
  if (!title) return '';

  const text = getDescendantsByLocalName(title, 't')
    .map((node) => node.textContent || '')
    .join('')
    .trim();
  if (text) return text;

  return getFirstDescendantByLocalName(title, 'v')?.textContent?.trim() || '';
}

function chartTypeLabel(chartType: ProjectionSheetChart['chartType']) {
  const labels: Record<ProjectionSheetChart['chartType'], string> = {
    bar: '棒グラフ',
    line: '折れ線グラフ',
    scatter: '散布図',
    area: '面グラフ',
    pie: '円グラフ',
    unknown: 'グラフ',
  };
  return labels[chartType];
}

function extractSpreadsheetFillColor(fill: Element): string | null {
  const patternFill = getFirstDescendantByLocalName(fill, 'patternFill');
  if (!patternFill) return null;

  const patternType = patternFill.getAttribute('patternType');
  if (patternType && patternType !== 'solid') return null;

  const foreground = getFirstDescendantByLocalName(patternFill, 'fgColor');
  const background = getFirstDescendantByLocalName(patternFill, 'bgColor');
  return extractSpreadsheetColor(foreground) || extractSpreadsheetColor(background);
}

function extractSpreadsheetColor(colorNode: Element | null): string | null {
  if (!colorNode) return null;

  const rgb = colorNode.getAttribute('rgb');
  if (rgb) return normalizeOfficeRgb(rgb);

  const indexed = colorNode.getAttribute('indexed');
  if (indexed) return spreadsheetIndexedColor(Number(indexed));

  const theme = colorNode.getAttribute('theme');
  if (theme) return spreadsheetThemeColor(Number(theme), Number(colorNode.getAttribute('tint') || 0));

  return null;
}

function normalizeOfficeRgb(value: string) {
  const normalized = value.replace(/^#/, '').trim();
  const rgb = normalized.length === 8 ? normalized.slice(2) : normalized;
  return /^[0-9a-fA-F]{6}$/.test(rgb) ? `#${rgb.toLowerCase()}` : null;
}

function spreadsheetIndexedColor(index: number) {
  const palette: Record<number, string> = {
    9: '#ffffff',
    10: '#ff0000',
    11: '#00ff00',
    12: '#0000ff',
    13: '#ffff00',
    14: '#ff00ff',
    15: '#00ffff',
    16: '#800000',
    17: '#008000',
    18: '#000080',
    19: '#808000',
    20: '#800080',
    21: '#008080',
    22: '#c0c0c0',
    23: '#808080',
  };
  return palette[index] || null;
}

function spreadsheetThemeColor(theme: number, tint: number) {
  const themeColors = ['#ffffff', '#000000', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646'];
  const color = themeColors[theme] || null;
  return color ? applyTint(color, tint) : null;
}

function applyTint(color: string, tint: number) {
  if (!Number.isFinite(tint) || tint === 0) return color;
  const { r, g, b } = hexToRgb(color);
  const adjust = (value: number) => {
    const next = tint < 0 ? value * (1 + tint) : value + (255 - value) * tint;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return rgbToHex(adjust(r), adjust(g), adjust(b));
}

function extractColorScaleRules(sheetDoc: Document): SpreadsheetColorScaleRule[] {
  return getDescendantsByLocalName(sheetDoc, 'conditionalFormatting')
    .map((conditionalFormatting) => {
      const sqref = conditionalFormatting.getAttribute('sqref') || '';
      const ranges = sqref.split(/\s+/).map(parseSpreadsheetRange).filter((range): range is SpreadsheetRange => !!range);
      if (ranges.length === 0) return null;

      const colorScale = getFirstDescendantByLocalName(conditionalFormatting, 'colorScale');
      if (!colorScale) return null;

      const values = getDirectChildrenByLocalName(colorScale, 'cfvo');
      const colors = getDirectChildrenByLocalName(colorScale, 'color');
      const stops = values
        .map((valueNode, index) => {
          const color = extractSpreadsheetColor(colors[index]);
          if (!color) return null;

          return {
            type: valueNode.getAttribute('type') || 'num',
            value: valueNode.getAttribute('val') === null ? null : Number(valueNode.getAttribute('val')),
            color,
          };
        })
        .filter((stop): stop is SpreadsheetColorStop => !!stop);

      return stops.length >= 2 ? { ranges, stops } : null;
    })
    .filter((rule): rule is SpreadsheetColorScaleRule => !!rule);
}

function applyColorScaleRule(
  rule: SpreadsheetColorScaleRule,
  rowRecords: SpreadsheetRowRecord[],
  rows: string[][],
  cellStyles: ProjectionCellStyle[][],
  totalColumns: number
) {
  const values: number[] = [];
  const cells: Array<{ row: number; column: number; value: number }> = [];

  rowRecords.forEach((rowRecord, rowIndex) => {
    for (let columnIndex = 0; columnIndex < totalColumns; columnIndex += 1) {
      const sourceColumn = rowRecord.sourceStartColumn + columnIndex;
      if (!rule.ranges.some((range) => isCellInRange(rowRecord.sourceRow, sourceColumn, range))) continue;

      const value = parseChartNumber(rows[rowIndex][columnIndex] || '');
      if (!Number.isFinite(value)) continue;

      values.push(value);
      cells.push({ row: rowIndex, column: columnIndex, value });
    }
  });

  if (values.length === 0) return;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const resolvedStops = rule.stops
    .map((stop) => ({
      value: resolveColorStopValue(stop, min, max),
      color: stop.color,
    }))
    .sort((a, b) => a.value - b.value);

  cells.forEach((cell) => {
    cellStyles[cell.row][cell.column] = {
      ...cellStyles[cell.row][cell.column],
      backgroundColor: interpolateColorScale(cell.value, resolvedStops),
    };
  });
}

function isCellInRange(row: number, column: number, range: SpreadsheetRange) {
  return row >= range.startRow && row <= range.endRow && column >= range.startColumn && column <= range.endColumn;
}

function resolveColorStopValue(stop: SpreadsheetColorStop, min: number, max: number) {
  if (stop.type === 'min') return min;
  if (stop.type === 'max') return max;
  if (stop.type === 'percent' || stop.type === 'percentile') {
    return min + (max - min) * ((stop.value ?? 50) / 100);
  }
  return Number.isFinite(stop.value) ? stop.value as number : min;
}

function interpolateColorScale(value: number, stops: Array<{ value: number; color: string }>) {
  if (value <= stops[0].value) return stops[0].color;

  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const next = stops[index];
    if (value > next.value) continue;

    const ratio = next.value === previous.value ? 0 : (value - previous.value) / (next.value - previous.value);
    return mixHexColors(previous.color, next.color, ratio);
  }

  return stops[stops.length - 1].color;
}

function mixHexColors(start: string, end: string, ratio: number) {
  const a = hexToRgb(start);
  const b = hexToRgb(end);
  const mix = (from: number, to: number) => Math.round(from + (to - from) * Math.max(0, Math.min(1, ratio)));
  return rgbToHex(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b));
}

function hexToRgb(color: string) {
  const hex = color.replace('#', '');
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function extractWordParagraph(paragraph: Element, id: string): ProjectionWordParagraphBlock | null {
  const text = extractWordText(paragraph);
  if (!text) return null;

  const paragraphProperties = getDirectChildByLocalName(paragraph, 'pPr');
  const style = paragraphProperties ? getFirstDescendantByLocalName(paragraphProperties, 'pStyle') : null;
  const styleValue = style ? getAnyAttribute(style, 'val') || '' : '';
  const headingLevel = styleValue.toLowerCase().startsWith('heading')
    ? Number(styleValue.match(/\d+/)?.[0] || 1)
    : null;
  const justification = paragraphProperties ? getFirstDescendantByLocalName(paragraphProperties, 'jc') : null;
  const alignValue = justification ? getAnyAttribute(justification, 'val') : null;

  return {
    type: 'paragraph',
    id,
    text,
    headingLevel: Number.isFinite(headingLevel) ? headingLevel : null,
    textAlign: alignValue === 'center' ? 'center' : alignValue === 'right' || alignValue === 'end' ? 'right' : 'left',
  };
}

function extractWordTable(table: Element, id: string): ProjectionWordTableBlock | null {
  const rows = getDirectChildrenByLocalName(table, 'tr')
    .map((row) =>
      getDirectChildrenByLocalName(row, 'tc')
        .map((cell) => extractWordText(cell))
    )
    .filter((row) => row.some((cell) => cell !== ''));

  return rows.length > 0 ? { type: 'table', id, rows } : null;
}

async function extractWordImages(
  zip: JSZipType,
  relationships: Map<string, string>,
  paragraph: Element,
  idPrefix: string
): Promise<ProjectionWordImageBlock[]> {
  const images: ProjectionWordImageBlock[] = [];
  const blips = getDescendantsByLocalName(paragraph, 'blip');

  for (let index = 0; index < blips.length; index += 1) {
    const relationshipId = getRelationshipAttribute(blips[index], 'embed') || getRelationshipAttribute(blips[index], 'link');
    const target = relationshipId ? relationships.get(relationshipId) : null;
    if (!target) continue;

    const mediaPath = resolveRelationshipTarget('word/document.xml', target);
    const mediaFile = zip.file(mediaPath);
    if (!mediaFile) continue;

    images.push({
      type: 'image',
      id: `${idPrefix}-${index}`,
      src: `data:${mimeTypeForPath(mediaPath)};base64,${await mediaFile.async('base64')}`,
      alt: `Word 文書内の画像 ${index + 1}`,
    });
  }

  return images;
}

function extractWordText(root: ParentNode) {
  const paragraphs = getDescendantsByLocalName(root, 'p')
    .map((paragraph) =>
      getDescendantsByLocalName(paragraph, 't')
        .map((textNode) => textNode.textContent || '')
        .join('')
        .trim()
    )
    .filter(Boolean);

  if (paragraphs.length > 0) return paragraphs.join('\n');

  return getDescendantsByLocalName(root, 't')
    .map((textNode) => textNode.textContent || '')
    .join('')
    .trim();
}

function extractRect(root: ParentNode, slideSize: { width: number; height: number }): ProjectionSlideRect | null {
  const transform = root instanceof Element && root.localName === 'xfrm' ? root : getFirstDescendantByLocalName(root, 'xfrm');
  const offset = transform ? getFirstDescendantByLocalName(transform, 'off') : null;
  const extent = transform ? getFirstDescendantByLocalName(transform, 'ext') : null;
  if (!offset || !extent) return null;

  const x = Number(offset.getAttribute('x') || 0);
  const y = Number(offset.getAttribute('y') || 0);
  const width = Number(extent.getAttribute('cx') || 0);
  const height = Number(extent.getAttribute('cy') || 0);

  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;

  return {
    left: (x / slideSize.width) * 100,
    top: (y / slideSize.height) * 100,
    width: (width / slideSize.width) * 100,
    height: (height / slideSize.height) * 100,
  };
}

function extractShapeText(shape: Element) {
  const textBody = getFirstDescendantByLocalName(shape, 'txBody');
  if (!textBody) return '';

  return getDescendantsByLocalName(textBody, 'p')
    .map((paragraph) =>
      getDescendantsByLocalName(paragraph, 't')
        .map((textNode) => textNode.textContent || '')
        .join('')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

function extractFontSizeEmu(shape: Element) {
  const runProperties = getFirstDescendantByLocalName(shape, 'rPr');
  const rawSize = Number(runProperties?.getAttribute('sz'));
  if (Number.isFinite(rawSize) && rawSize > 0) {
    return Math.round((rawSize / 100) * 12700);
  }
  return 24 * 12700;
}

function extractFontWeight(shape: Element): 'normal' | 'bold' {
  const runProperties = getFirstDescendantByLocalName(shape, 'rPr');
  return runProperties?.getAttribute('b') === '1' ? 'bold' : 'normal';
}

function extractTextAlign(shape: Element): 'left' | 'center' | 'right' {
  const paragraphProperties = getFirstDescendantByLocalName(shape, 'pPr');
  const align = paragraphProperties?.getAttribute('algn');
  if (align === 'ctr') return 'center';
  if (align === 'r') return 'right';
  return 'left';
}

function extractTextColor(shape: Element) {
  const runProperties = getFirstDescendantByLocalName(shape, 'rPr');
  return runProperties ? extractSolidFillColor(runProperties) || '#111827' : '#111827';
}

function extractSlideBackground(slideDoc: Document) {
  const backgroundProperties = getFirstDescendantByLocalName(slideDoc, 'bgPr');
  return backgroundProperties ? extractSolidFillColor(backgroundProperties) || '#ffffff' : '#ffffff';
}

function extractSolidFillColor(root: ParentNode): string | null {
  const solidFill = getFirstDescendantByLocalName(root, 'solidFill');
  if (!solidFill) return null;

  const srgbColor = getFirstDescendantByLocalName(solidFill, 'srgbClr')?.getAttribute('val');
  if (srgbColor && /^[0-9a-fA-F]{6}$/.test(srgbColor)) return `#${srgbColor}`;

  const schemeColor = getFirstDescendantByLocalName(solidFill, 'schemeClr')?.getAttribute('val');
  return schemeColor ? mapSchemeColor(schemeColor) : null;
}

function mapSchemeColor(value: string) {
  const schemeColors: Record<string, string> = {
    bg1: '#ffffff',
    tx1: '#111827',
    bg2: '#f8fafc',
    tx2: '#334155',
    accent1: '#2563eb',
    accent2: '#dc2626',
    accent3: '#16a34a',
    accent4: '#7c3aed',
    accent5: '#0891b2',
    accent6: '#ea580c',
  };
  return schemeColors[value] || '#111827';
}

function resolveRelationshipTarget(sourcePath: string, target: string) {
  if (target.startsWith('/')) return target.slice(1);

  const sourceParts = sourcePath.split('/');
  sourceParts.pop();
  const parts = [...sourceParts, ...target.split('/')];
  const resolved: string[] = [];

  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      resolved.pop();
      return;
    }
    resolved.push(part);
  });

  return resolved.join('/');
}

function mimeTypeForPath(path: string) {
  const extension = path.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'svg') return 'image/svg+xml';
  return 'image/png';
}
