import { MasterDataItem } from '../types';

export const defaultMasterData: MasterDataItem[] = [
  // 1. Buyers
  { id: 'md-buy-1', category: 'Buyer', code: 'BUY-HM', name: 'H&M Global', description: 'Hennes & Mauritz Global Buyer', status: 'Active' },
  { id: 'md-buy-2', category: 'Buyer', code: 'BUY-ZARA', name: 'Zara / Inditex', description: 'Inditex Fashion Group', status: 'Active' },
  { id: 'md-buy-3', category: 'Buyer', code: 'BUY-LEVI', name: 'Levi Strauss & Co.', description: 'Levi Strauss Global Brand', status: 'Active' },
  { id: 'md-buy-4', category: 'Buyer', code: 'BUY-TGT', name: 'Target US', description: 'Target Corporation USA', status: 'Active' },
  { id: 'md-buy-5', category: 'Buyer', code: 'BUY-PVH', name: 'PVH Corp', description: 'PVH Tommy & Calvin Klein', status: 'Active' },
  { id: 'md-buy-6', category: 'Buyer', code: 'BUY-UNIQLO', name: 'Uniqlo / Fast Retailing', description: 'Fast Retailing Japan', status: 'Active' },
  { id: 'md-buy-7', category: 'Buyer', code: 'BUY-NEXT', name: 'Next UK', description: 'Next Sourcing UK', status: 'Active' },
  { id: 'md-buy-8', category: 'Buyer', code: 'BUY-MNS', name: 'Marks & Spencer', description: 'M&S UK Retail', status: 'Active' },

  // 2. Brands
  { id: 'md-brd-1', category: 'Brand', code: 'BRD-DIV', name: 'Divided', description: 'H&M Divided Brand', status: 'Active' },
  { id: 'md-brd-2', category: 'Brand', code: 'BRD-IND', name: 'Inditex Denim', description: 'Zara Denim Division', status: 'Active' },
  { id: 'md-brd-3', category: 'Brand', code: 'BRD-RED', name: 'Red Tab 501', description: 'Levi Strauss Red Tab', status: 'Active' },
  { id: 'md-brd-4', category: 'Brand', code: 'BRD-GDF', name: 'Goodfellow & Co', description: 'Target Goodfellow Menswear', status: 'Active' },
  { id: 'md-brd-5', category: 'Brand', code: 'BRD-TH', name: 'Tommy Hilfiger', description: 'PVH Tommy Hilfiger', status: 'Active' },
  { id: 'md-brd-6', category: 'Brand', code: 'BRD-CK', name: 'Calvin Klein Jeans', description: 'PVH CK Denim', status: 'Active' },

  // 3. Garment Types
  { id: 'md-gar-1', category: 'GarmentType', code: 'GAR-DNM-BTM', name: 'Denim Bottom', description: '5-Pocket Denim Jeans', status: 'Active' },
  { id: 'md-gar-2', category: 'GarmentType', code: 'GAR-CHINO', name: 'Chino Pants', description: 'Cotton Casual Chino Pants', status: 'Active' },
  { id: 'md-gar-3', category: 'GarmentType', code: 'GAR-TSHIRT', name: 'Knit T-Shirt', description: 'Round Neck Knit T-Shirt', status: 'Active' },
  { id: 'md-gar-4', category: 'GarmentType', code: 'GAR-JACKET', name: 'Jacket / Outerwear', description: 'Denim & Woven Outerwear Jacket', status: 'Active' },
  { id: 'md-gar-5', category: 'GarmentType', code: 'GAR-POLO', name: 'Polo Shirt', description: 'Collar Pique Polo Shirt', status: 'Active' },
  { id: 'md-gar-6', category: 'GarmentType', code: 'GAR-CARGO', name: 'Cargo Pants', description: 'Multi-pocket Utility Cargo Bottom', status: 'Active' },
  { id: 'md-gar-7', category: 'GarmentType', code: 'GAR-SHIRT', name: 'Woven Shirt', description: 'Long & Short Sleeve Woven Shirt', status: 'Active' },
  { id: 'md-gar-8', category: 'GarmentType', code: 'GAR-SHORTS', name: 'Denim Shorts', description: 'Denim Summer Shorts', status: 'Active' },

  // 4. Master Sizes
  { id: 'md-sz-1', category: 'Size', code: 'SZ-XS', name: 'XS', description: 'Extra Small', status: 'Active' },
  { id: 'md-sz-2', category: 'Size', code: 'SZ-S', name: 'S', description: 'Small', status: 'Active' },
  { id: 'md-sz-3', category: 'Size', code: 'SZ-M', name: 'M', description: 'Medium', status: 'Active' },
  { id: 'md-sz-4', category: 'Size', code: 'SZ-L', name: 'L', description: 'Large', status: 'Active' },
  { id: 'md-sz-5', category: 'Size', code: 'SZ-XL', name: 'XL', description: 'Extra Large', status: 'Active' },
  { id: 'md-sz-6', category: 'Size', code: 'SZ-2XL', name: '2XL', description: 'Double Extra Large', status: 'Active' },
  { id: 'md-sz-7', category: 'Size', code: 'SZ-3XL', name: '3XL', description: 'Triple Extra Large', status: 'Active' },
  { id: 'md-sz-8', category: 'Size', code: 'SZ-4XL', name: '4XL', description: 'Four Extra Large', status: 'Active' },
  { id: 'md-sz-9', category: 'Size', code: 'SZ-28', name: '28', description: 'Waist 28 inch', status: 'Active' },
  { id: 'md-sz-10', category: 'Size', code: 'SZ-29', name: '29', description: 'Waist 29 inch', status: 'Active' },
  { id: 'md-sz-11', category: 'Size', code: 'SZ-30', name: '30', description: 'Waist 30 inch', status: 'Active' },
  { id: 'md-sz-12', category: 'Size', code: 'SZ-31', name: '31', description: 'Waist 31 inch', status: 'Active' },
  { id: 'md-sz-13', category: 'Size', code: 'SZ-32', name: '32', description: 'Waist 32 inch', status: 'Active' },
  { id: 'md-sz-14', category: 'Size', code: 'SZ-33', name: '33', description: 'Waist 33 inch', status: 'Active' },
  { id: 'md-sz-15', category: 'Size', code: 'SZ-34', name: '34', description: 'Waist 34 inch', status: 'Active' },
  { id: 'md-sz-16', category: 'Size', code: 'SZ-36', name: '36', description: 'Waist 36 inch', status: 'Active' },
  { id: 'md-sz-17', category: 'Size', code: 'SZ-38', name: '38', description: 'Waist 38 inch', status: 'Active' },
  { id: 'md-sz-18', category: 'Size', code: 'SZ-40', name: '40', description: 'Waist 40 inch', status: 'Active' },
  { id: 'md-sz-19', category: 'Size', code: 'SZ-42', name: '42', description: 'Waist 42 inch', status: 'Active' },

  // 5. Size Matrix Presets
  { id: 'md-sm-1', category: 'SizeMatrix', code: 'SM-ALPHA-STD', name: 'Alpha Standard (XS - 2XL)', description: 'XS, S, M, L, XL, 2XL', status: 'Active' },
  { id: 'md-sm-2', category: 'SizeMatrix', code: 'SM-ALPHA-EXT', name: 'Alpha Extended (XS - 4XL)', description: 'XS, S, M, L, XL, 2XL, 3XL, 4XL', status: 'Active' },
  { id: 'md-sm-3', category: 'SizeMatrix', code: 'SM-NUM-STD', name: 'Waist Numeric Standard (28 - 38)', description: '28, 30, 32, 34, 36, 38', status: 'Active' },
  { id: 'md-sm-4', category: 'SizeMatrix', code: 'SM-NUM-EXT', name: 'Waist Numeric Extended (28 - 42)', description: '28, 29, 30, 31, 32, 33, 34, 36, 38, 40, 42', status: 'Active' },
  { id: 'md-sm-5', category: 'SizeMatrix', code: 'SM-EUR-STD', name: 'Euro Numeric (36 - 46)', description: '36, 38, 40, 42, 44, 46', status: 'Active' },
  { id: 'md-sm-6', category: 'SizeMatrix', code: 'SM-KIDS-STD', name: 'Kids Standard (4Y - 14Y)', description: '4Y, 6Y, 8Y, 10Y, 12Y, 14Y', status: 'Active' },

  // 6. Colours
  { id: 'md-col-1', category: 'Colour', code: 'COL-INDIGO', name: 'Indigo Blue', description: 'Deep Indigo Denim Shade', status: 'Active' },
  { id: 'md-col-2', category: 'Colour', code: 'COL-VNT-BLK', name: 'Vintage Black', description: 'Overdyed Vintage Black', status: 'Active' },
  { id: 'md-col-3', category: 'Colour', code: 'COL-BLC-BLU', name: 'Bleach Light Blue', description: 'Light Bleached Sky Blue', status: 'Active' },
  { id: 'md-col-4', category: 'Colour', code: 'COL-OPT-WHT', name: 'Optical White', description: 'Crisp White', status: 'Active' },
  { id: 'md-col-5', category: 'Colour', code: 'COL-DRK-WSH', name: 'Dark Wash Blue', description: 'Dark Rinse Classic Denim', status: 'Active' },
  { id: 'md-col-6', category: 'Colour', code: 'COL-OLV-GRN', name: 'Olive Green', description: 'Military Olive Green', status: 'Active' },
  { id: 'md-col-7', category: 'Colour', code: 'COL-NVY-BLU', name: 'Navy Blue', description: 'Deep Navy Blue', status: 'Active' },
  { id: 'md-col-8', category: 'Colour', code: 'COL-HTH-GRY', name: 'Heather Grey', description: 'Melange Heather Grey', status: 'Active' },
  { id: 'md-col-9', category: 'Colour', code: 'COL-KHK', name: 'Khaki', description: 'Standard Khaki Tan', status: 'Active' },
  { id: 'md-col-10', category: 'Colour', code: 'COL-RAW', name: 'Raw Denim', description: 'Unwashed Rigid Raw Denim', status: 'Active' },

  // 7. Seasons
  { id: 'md-sea-1', category: 'Season', code: 'SEA-SS26', name: 'SS 2026', description: 'Spring Summer 2026', status: 'Active' },
  { id: 'md-sea-2', category: 'Season', code: 'SEA-FW26', name: 'FW 2026', description: 'Fall Winter 2026', status: 'Active' },
  { id: 'md-sea-3', category: 'Season', code: 'SEA-SPR27', name: 'Spring 2027', description: 'Spring Season 2027', status: 'Active' },
  { id: 'md-sea-4', category: 'Season', code: 'SEA-SUM27', name: 'Summer 2027', description: 'Summer Season 2027', status: 'Active' },
  { id: 'md-sea-5', category: 'Season', code: 'SEA-AUT27', name: 'Autumn 2027', description: 'Autumn Season 2027', status: 'Active' },
  { id: 'md-sea-6', category: 'Season', code: 'SEA-WIN27', name: 'Winter 2027', description: 'Winter Season 2027', status: 'Active' },

  // 8. Wash Types
  { id: 'md-wsh-1', category: 'WashType', code: 'WSH-ENZ', name: 'Enzyme Wash', description: 'Bio-polishing Enzymatic Wash', status: 'Active' },
  { id: 'md-wsh-2', category: 'WashType', code: 'WSH-BLC', name: 'Bleach Wash', description: 'Hypochlorite Bleaching Process', status: 'Active' },
  { id: 'md-wsh-3', category: 'WashType', code: 'WSH-STN', name: 'Stone Wash', description: 'Pumice Stone Abrasion Wash', status: 'Active' },
  { id: 'md-wsh-4', category: 'WashType', code: 'WSH-ACD', name: 'Acid Wash', description: 'Pumice Soaked Potassium Permanganate Acid Wash', status: 'Active' },
  { id: 'md-wsh-5', category: 'WashType', code: 'WSH-SFT', name: 'Softener Wash', description: 'Silicone & Cationic Softener Finish', status: 'Active' },
  { id: 'md-wsh-6', category: 'WashType', code: 'WSH-TNT', name: 'Tint Wash', description: 'Direct Yellow / Brown Tint Overdye', status: 'Active' },
  { id: 'md-wsh-7', category: 'WashType', code: 'WSH-OZN', name: 'Vintage Ozone Wash', description: 'Eco Ozone Gas Decolorization', status: 'Active' },
  { id: 'md-wsh-8', category: 'WashType', code: 'WSH-LSR', name: 'Laser Whisker Wash', description: 'Laser 3D Whisker & Scrapping Pattern', status: 'Active' },
  { id: 'md-wsh-9', category: 'WashType', code: 'WSH-RAW', name: 'Raw / Rinse Wash', description: 'Light Rinse Anti-Stiffening Wash', status: 'Active' },

  // 9. Defect Types
  { id: 'md-def-1', category: 'DefectType', code: 'DEF-STITCH', name: 'Stitch Fault / Skip', description: 'Broken stitch, skipped stitch, loose tension', status: 'Active' },
  { id: 'md-def-2', category: 'DefectType', code: 'DEF-STAIN', name: 'Oil Stain / Dirt', description: 'Machine oil, spot, or grease contamination', status: 'Active' },
  { id: 'md-def-3', category: 'DefectType', code: 'DEF-MEASURE', name: 'Measurement Out of Spec', description: 'Tolerance variance beyond buyer spec sheet', status: 'Active' },
  { id: 'md-def-4', category: 'DefectType', code: 'DEF-HOLE', name: 'Fabric Hole', description: 'Needle cut, yarn break or fabric tear', status: 'Active' },
  { id: 'md-def-5', category: 'DefectType', code: 'DEF-NEEDLE', name: 'Broken Needle', description: 'Broken needle tip detected / needle log check', status: 'Active' },
  { id: 'md-def-6', category: 'DefectType', code: 'DEF-SHADE', name: 'Shade Variation', description: 'Tone difference between panels or lots', status: 'Active' },
  { id: 'md-def-7', category: 'DefectType', code: 'DEF-HEM', name: 'Uneven Hem', description: 'Wavy or uneven bottom hem stitch', status: 'Active' },
  { id: 'md-def-8', category: 'DefectType', code: 'DEF-RAWEDGE', name: 'Raw Edge / Fray', description: 'Exposed raw fabric edges without overlock', status: 'Active' },
  { id: 'md-def-9', category: 'DefectType', code: 'DEF-TRIM', name: 'Button / Rivet Defect', description: 'Loose, broken or misplaced button / rivet', status: 'Active' },

  // 10. Sewing Lines
  { id: 'md-line-1', category: 'SewingLine', code: 'LINE-01', name: 'Line 01', description: 'Denim Bottom Assembly Line', status: 'Active' },
  { id: 'md-line-2', category: 'SewingLine', code: 'LINE-02', name: 'Line 02', description: 'Denim Bottom Assembly Line', status: 'Active' },
  { id: 'md-line-3', category: 'SewingLine', code: 'LINE-03', name: 'Line 03', description: 'Chino & Casual Pants Line', status: 'Active' },
  { id: 'md-line-4', category: 'SewingLine', code: 'LINE-04', name: 'Line 04', description: 'Jacket & Outerwear Line', status: 'Active' },
  { id: 'md-line-5', category: 'SewingLine', code: 'LINE-05', name: 'Line 05', description: 'T-Shirt & Knit Line', status: 'Active' },
  { id: 'md-line-6', category: 'SewingLine', code: 'LINE-06', name: 'Line 06', description: 'Polo & Knit Line', status: 'Active' },
  { id: 'md-line-7', category: 'SewingLine', code: 'LINE-07', name: 'Line 07', description: 'Woven Shirt Assembly Line', status: 'Active' },
  { id: 'md-line-8', category: 'SewingLine', code: 'LINE-08', name: 'Line 08', description: 'Flexible Production Unit', status: 'Active' },

  // 11. Suppliers
  { id: 'md-sup-1', category: 'Supplier', code: 'SUP-PACIFIC', name: 'Pacific Fabrics Ltd.', description: 'Denim & Woven Mill Supplier', status: 'Active' },
  { id: 'md-sup-2', category: 'Supplier', code: 'SUP-YKK', name: 'YKK Bangladesh Ltd.', description: 'Metal & Coil Zippers, Rivets', status: 'Active' },
  { id: 'md-sup-3', category: 'Supplier', code: 'SUP-COATS', name: 'Coats Bangladesh', description: 'Core-spun & Poly Sewing Thread', status: 'Active' },
  { id: 'md-sup-4', category: 'Supplier', code: 'SUP-AVERY', name: 'Avery Dennison', description: 'Care Labels, Hangtags, Barcodes', status: 'Active' },
  { id: 'md-sup-5', category: 'Supplier', code: 'SUP-HAMEEM', name: 'Ha-Meem Trims', description: 'Interlining, Buttons, Poly Bags', status: 'Active' },
  { id: 'md-sup-6', category: 'Supplier', code: 'SUP-ENVOY', name: 'Envoy Textiles Ltd.', description: 'Rope Dyeing Denim Mill', status: 'Active' },
  { id: 'md-sup-7', category: 'Supplier', code: 'SUP-SQUARE', name: 'Square Denim Ltd.', description: 'Premium Ring Spun Denim', status: 'Active' },

  // 12. UOM
  { id: 'md-uom-1', category: 'UOM', code: 'UOM-PCS', name: 'Pcs', description: 'Pieces (Standard Count)', status: 'Active' },
  { id: 'md-uom-2', category: 'UOM', code: 'UOM-DZN', name: 'Dzn', description: 'Dozen (12 Pcs)', status: 'Active' },
  { id: 'md-uom-3', category: 'UOM', code: 'UOM-YDS', name: 'Yards', description: 'Fabric Linear Yards', status: 'Active' },
  { id: 'md-uom-4', category: 'UOM', code: 'UOM-MTR', name: 'Meters', description: 'Fabric Metric Meters', status: 'Active' },
  { id: 'md-uom-5', category: 'UOM', code: 'UOM-KGS', name: 'Kgs', description: 'Kilograms Weight', status: 'Active' },
  { id: 'md-uom-6', category: 'UOM', code: 'UOM-GRS', name: 'Gross', description: 'Gross (144 Units)', status: 'Active' },
  { id: 'md-uom-7', category: 'UOM', code: 'UOM-RLL', name: 'Rolls', description: 'Fabric / Elastic Rolls', status: 'Active' },
  { id: 'md-uom-8', category: 'UOM', code: 'UOM-CON', name: 'Cones', description: 'Thread Cones', status: 'Active' },
  { id: 'md-uom-9', category: 'UOM', code: 'UOM-PCK', name: 'Packs', description: 'Packaging Cartons / Packs', status: 'Active' },

  // 13. Fabric Types
  { id: 'md-fab-1', category: 'FabricType', code: 'FAB-DNM-12', name: '100% Cotton Denim 12.5oz', description: 'Rigid Indigo Cotton Denim', status: 'Active' },
  { id: 'md-fab-2', category: 'FabricType', code: 'FAB-DNM-ST', name: 'Cotton Spandex Stretch Denim 11oz', description: '98% Cotton 2% Elastane Stretch Denim', status: 'Active' },
  { id: 'md-fab-3', category: 'FabricType', code: 'FAB-TWL-240', name: 'Cotton Twill 240 GSM', description: 'Chino & Bottom Twill Fabric', status: 'Active' },
  { id: 'md-fab-4', category: 'FabricType', code: 'FAB-SJ-180', name: 'Single Jersey 180 GSM', description: '100% Combed Cotton T-Shirt Knit', status: 'Active' },
  { id: 'md-fab-5', category: 'FabricType', code: 'FAB-PQ-220', name: 'Pique Knit 220 GSM', description: 'Polo Shirt Textured Pique Knit', status: 'Active' }
];

export function parseSizeMatrixDescription(description?: string): string[] {
  if (!description) return [];
  return description
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}
