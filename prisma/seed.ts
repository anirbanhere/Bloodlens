import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import 'dotenv/config'

const dbUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
const adapter = new PrismaBetterSqlite3({ url: dbUrl })
const prisma = new PrismaClient({ adapter } as any)

const markers = [
  // Kidney Function
  { markerKey: 'creatinine', canonicalName: 'Serum Creatinine', category: 'Kidney Function', aliases: ['creatinine', 'serum creatinine', 's. creatinine', 's.creatinine', 'creat'], defaultUnit: 'mg/dL', description: 'Kidney filtration waste marker' },
  { markerKey: 'egfr', canonicalName: 'eGFR', category: 'Kidney Function', aliases: ['egfr', 'gfr', 'estimated gfr', 'estimated glomerular filtration rate', 'glomerular filtration rate'], defaultUnit: 'mL/min/1.73m²', description: 'Estimated glomerular filtration rate' },
  { markerKey: 'urea', canonicalName: 'Blood Urea', category: 'Kidney Function', aliases: ['urea', 'blood urea', 'serum urea', 'urea nitrogen'], defaultUnit: 'mg/dL', description: 'Kidney waste product' },
  { markerKey: 'bun', canonicalName: 'BUN', category: 'Kidney Function', aliases: ['bun', 'blood urea nitrogen'], defaultUnit: 'mg/dL', description: 'Blood urea nitrogen' },
  { markerKey: 'uric_acid', canonicalName: 'Uric Acid', category: 'Kidney Function', aliases: ['uric acid', 'serum uric acid', 'urate'], defaultUnit: 'mg/dL', description: 'Uric acid level' },

  // Electrolytes
  { markerKey: 'sodium', canonicalName: 'Sodium', category: 'Electrolytes', aliases: ['sodium', 'na', 'serum sodium', 'na+'], defaultUnit: 'mmol/L', description: 'Serum sodium' },
  { markerKey: 'potassium', canonicalName: 'Potassium', category: 'Electrolytes', aliases: ['potassium', 'k', 'k+', 'serum potassium'], defaultUnit: 'mmol/L', description: 'Serum potassium' },
  { markerKey: 'chloride', canonicalName: 'Chloride', category: 'Electrolytes', aliases: ['chloride', 'cl', 'cl-', 'serum chloride'], defaultUnit: 'mmol/L', description: 'Serum chloride' },
  { markerKey: 'bicarbonate', canonicalName: 'Bicarbonate', category: 'Electrolytes', aliases: ['bicarbonate', 'hco3', 'co2', 'serum bicarbonate', 'total co2'], defaultUnit: 'mmol/L', description: 'Serum bicarbonate' },
  { markerKey: 'calcium', canonicalName: 'Calcium', category: 'Electrolytes', aliases: ['calcium', 'ca', 'serum calcium', 'total calcium', 'ca2+'], defaultUnit: 'mg/dL', description: 'Serum calcium' },
  { markerKey: 'phosphorus', canonicalName: 'Phosphorus', category: 'Electrolytes', aliases: ['phosphorus', 'phosphate', 'serum phosphorus', 'inorganic phosphorus', 'phos'], defaultUnit: 'mg/dL', description: 'Serum phosphorus' },
  { markerKey: 'magnesium', canonicalName: 'Magnesium', category: 'Electrolytes', aliases: ['magnesium', 'mg', 'serum magnesium', 'mg2+'], defaultUnit: 'mg/dL', description: 'Serum magnesium' },

  // Anemia / Blood
  { markerKey: 'hemoglobin', canonicalName: 'Hemoglobin', category: 'Anemia / Blood', aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'], defaultUnit: 'g/dL', description: 'Red blood cell protein' },
  { markerKey: 'rbc', canonicalName: 'RBC Count', category: 'Anemia / Blood', aliases: ['rbc', 'red blood cell', 'red blood cells', 'rbc count', 'erythrocytes'], defaultUnit: 'million/µL', description: 'Red blood cell count' },
  { markerKey: 'wbc', canonicalName: 'WBC Count', category: 'Anemia / Blood', aliases: ['wbc', 'white blood cell', 'white blood cells', 'wbc count', 'tlc', 'total leukocyte count', 'total wbc'], defaultUnit: 'cells/µL', description: 'White blood cell count' },
  { markerKey: 'platelets', canonicalName: 'Platelet Count', category: 'Anemia / Blood', aliases: ['platelets', 'platelet count', 'plt', 'thrombocytes'], defaultUnit: 'lakh/µL', description: 'Platelet count' },
  { markerKey: 'ferritin', canonicalName: 'Ferritin', category: 'Anemia / Blood', aliases: ['ferritin', 'serum ferritin'], defaultUnit: 'ng/mL', description: 'Iron storage protein' },
  { markerKey: 'serum_iron', canonicalName: 'Serum Iron', category: 'Anemia / Blood', aliases: ['iron', 'serum iron', 'fe'], defaultUnit: 'µg/dL', description: 'Serum iron' },
  { markerKey: 'tibc', canonicalName: 'TIBC', category: 'Anemia / Blood', aliases: ['tibc', 'total iron binding capacity', 'total iron-binding capacity'], defaultUnit: 'µg/dL', description: 'Total iron-binding capacity' },
  { markerKey: 'tsat', canonicalName: 'TSAT', category: 'Anemia / Blood', aliases: ['tsat', 'transferrin saturation', 'transferrin sat', '%tsat'], defaultUnit: '%', description: 'Transferrin saturation' },

  // CKD Mineral Balance
  { markerKey: 'pth', canonicalName: 'PTH', category: 'CKD Mineral Balance', aliases: ['pth', 'parathyroid hormone', 'ipth', 'intact pth', 'parathormone'], defaultUnit: 'pg/mL', description: 'Parathyroid hormone' },
  { markerKey: 'vitamin_d', canonicalName: 'Vitamin D', category: 'CKD Mineral Balance', aliases: ['vitamin d', '25-oh vitamin d', '25 hydroxy vitamin d', 'calcidiol', '25(oh)d', 'vit d'], defaultUnit: 'ng/mL', description: '25-OH Vitamin D' },
  { markerKey: 'alp', canonicalName: 'ALP', category: 'CKD Mineral Balance', aliases: ['alp', 'alkaline phosphatase', 'alk phos', 'alkphos'], defaultUnit: 'U/L', description: 'Alkaline phosphatase' },

  // Diabetes / Metabolic
  { markerKey: 'hba1c', canonicalName: 'HbA1c', category: 'Diabetes', aliases: ['hba1c', 'glycated hemoglobin', 'glycosylated hemoglobin', 'a1c', 'haemoglobin a1c'], defaultUnit: '%', description: 'Glycated hemoglobin' },
  { markerKey: 'fasting_glucose', canonicalName: 'Fasting Glucose', category: 'Diabetes', aliases: ['fasting glucose', 'fbs', 'fasting blood sugar', 'fasting sugar', 'fasting blood glucose', 'glucose fasting'], defaultUnit: 'mg/dL', description: 'Fasting blood sugar' },
  { markerKey: 'pp_glucose', canonicalName: 'Post-Prandial Glucose', category: 'Diabetes', aliases: ['ppbs', 'post prandial', 'post-prandial glucose', 'pp blood sugar', 'post meal glucose', 'post meal sugar', '2hr ppbs'], defaultUnit: 'mg/dL', description: 'Post-meal blood sugar' },
  { markerKey: 'random_glucose', canonicalName: 'Random Glucose', category: 'Diabetes', aliases: ['rbs', 'random blood sugar', 'random glucose', 'random blood glucose'], defaultUnit: 'mg/dL', description: 'Random blood sugar' },

  // Urine Protein
  { markerKey: 'urine_protein', canonicalName: 'Urine Protein', category: 'Urine Protein', aliases: ['urine protein', 'protein urine', 'urinary protein', 'spot urine protein'], defaultUnit: 'mg/dL', description: 'Urine protein' },
  { markerKey: 'acr', canonicalName: 'ACR', category: 'Urine Protein', aliases: ['acr', 'albumin creatinine ratio', 'uacr', 'urinary albumin creatinine ratio', 'albumin:creatinine'], defaultUnit: 'mg/g', description: 'Albumin-to-creatinine ratio' },
  { markerKey: 'pcr', canonicalName: 'PCR', category: 'Urine Protein', aliases: ['pcr', 'protein creatinine ratio', 'upcr', 'urinary protein creatinine ratio', 'protein:creatinine'], defaultUnit: 'mg/g', description: 'Protein-to-creatinine ratio' },
  { markerKey: 'microalbumin', canonicalName: 'Urine Albumin', category: 'Urine Protein', aliases: ['microalbumin', 'urine albumin', 'urinary albumin', 'urine microalbumin', 'spot albumin'], defaultUnit: 'mg/L', description: 'Urine microalbumin' },
  { markerKey: 'urine_creatinine', canonicalName: 'Urine Creatinine', category: 'Urine Protein', aliases: ['urine creatinine', 'urinary creatinine', 'spot urine creatinine'], defaultUnit: 'mg/dL', description: 'Urine creatinine' },

  // Lipids
  { markerKey: 'total_cholesterol', canonicalName: 'Total Cholesterol', category: 'Lipids', aliases: ['total cholesterol', 'cholesterol', 'serum cholesterol', 'chol'], defaultUnit: 'mg/dL', description: 'Total cholesterol' },
  { markerKey: 'ldl', canonicalName: 'LDL', category: 'Lipids', aliases: ['ldl', 'ldl cholesterol', 'low density lipoprotein', 'ldl-c'], defaultUnit: 'mg/dL', description: 'LDL cholesterol' },
  { markerKey: 'hdl', canonicalName: 'HDL', category: 'Lipids', aliases: ['hdl', 'hdl cholesterol', 'high density lipoprotein', 'hdl-c'], defaultUnit: 'mg/dL', description: 'HDL cholesterol' },
  { markerKey: 'triglycerides', canonicalName: 'Triglycerides', category: 'Lipids', aliases: ['triglycerides', 'tg', 'trigs', 'serum triglycerides'], defaultUnit: 'mg/dL', description: 'Triglycerides' },

  // Liver / General
  { markerKey: 'albumin', canonicalName: 'Albumin', category: 'Liver / General', aliases: ['albumin', 'serum albumin'], defaultUnit: 'g/dL', description: 'Serum albumin' },
  { markerKey: 'sgot', canonicalName: 'SGOT / AST', category: 'Liver / General', aliases: ['sgot', 'ast', 'aspartate aminotransferase', 'aspartate transaminase'], defaultUnit: 'U/L', description: 'AST liver enzyme' },
  { markerKey: 'sgpt', canonicalName: 'SGPT / ALT', category: 'Liver / General', aliases: ['sgpt', 'alt', 'alanine aminotransferase', 'alanine transaminase'], defaultUnit: 'U/L', description: 'ALT liver enzyme' },
  { markerKey: 'bilirubin', canonicalName: 'Total Bilirubin', category: 'Liver / General', aliases: ['bilirubin', 'total bilirubin', 's. bilirubin', 'serum bilirubin'], defaultUnit: 'mg/dL', description: 'Total bilirubin' },
  { markerKey: 'total_protein', canonicalName: 'Total Protein', category: 'Liver / General', aliases: ['total protein', 'serum total protein', 'protein total'], defaultUnit: 'g/dL', description: 'Total serum protein' },

  // Urinalysis (urine routine — dipstick + physical)
  { markerKey: 'urine_colour', canonicalName: 'Urine Colour', category: 'Urinalysis', aliases: ['colour', 'color'], defaultUnit: null, description: 'Urine colour', valueType: 'qualitative' },
  { markerKey: 'urine_clarity', canonicalName: 'Urine Clarity', category: 'Urinalysis', aliases: ['clarity', 'appearance', 'turbidity'], defaultUnit: null, description: 'Urine clarity / appearance', valueType: 'qualitative' },
  { markerKey: 'urine_ph', canonicalName: 'Urine pH', category: 'Urinalysis', aliases: ['ph'], defaultUnit: null, description: 'Urine pH', valueType: 'numeric' },
  { markerKey: 'urine_specific_gravity', canonicalName: 'Specific Gravity', category: 'Urinalysis', aliases: ['specific gravity', 'sp gravity', 'sp. gr', 'spgr', 'sp gr'], defaultUnit: null, description: 'Urine specific gravity', valueType: 'numeric' },
  { markerKey: 'urine_glucose', canonicalName: 'Urine Glucose', category: 'Urinalysis', aliases: ['glucose'], defaultUnit: null, description: 'Urine glucose (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_protein_dipstick', canonicalName: 'Urine Protein (dipstick)', category: 'Urinalysis', aliases: ['protein'], defaultUnit: null, description: 'Urine protein (dipstick) — proteinuria', valueType: 'ordinal' },
  { markerKey: 'urine_blood', canonicalName: 'Urine Blood', category: 'Urinalysis', aliases: ['blood'], defaultUnit: null, description: 'Urine blood (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_ketones', canonicalName: 'Urine Ketones', category: 'Urinalysis', aliases: ['ketone bodies', 'ketones', 'ketone'], defaultUnit: null, description: 'Urine ketones (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_urobilinogen', canonicalName: 'Urobilinogen', category: 'Urinalysis', aliases: ['urobilinogen'], defaultUnit: null, description: 'Urine urobilinogen (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_bile_salt', canonicalName: 'Bile Salt', category: 'Urinalysis', aliases: ['bilesalt', 'bile salt', 'bile salts'], defaultUnit: null, description: 'Urine bile salt (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_bile_pigment', canonicalName: 'Bile Pigment', category: 'Urinalysis', aliases: ['bilepigment', 'bile pigment'], defaultUnit: null, description: 'Urine bile pigment (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_nitrite', canonicalName: 'Nitrite', category: 'Urinalysis', aliases: ['nitrite', 'nitrites'], defaultUnit: null, description: 'Urine nitrite (dipstick)', valueType: 'ordinal' },
  { markerKey: 'urine_leucocytes', canonicalName: 'Leucocytes (dipstick)', category: 'Urinalysis', aliases: ['leucocytes', 'leukocytes', 'leucocyte esterase', 'leukocyte esterase'], defaultUnit: null, description: 'Urine leucocytes (dipstick)', valueType: 'ordinal' },

  // Urine Microscopy (per high-power field counts)
  { markerKey: 'urine_rbc_micro', canonicalName: 'Urine RBCs (microscopy)', category: 'Urine Microscopy', aliases: ['rbcs', 'rbc', 'red blood cells', 'red blood cell'], defaultUnit: '/HPF', description: 'Urine red cells per high-power field', valueType: 'numeric' },
  { markerKey: 'urine_wbc_micro', canonicalName: 'Urine WBC (microscopy)', category: 'Urine Microscopy', aliases: ['wbc', 'wbcs', 'pus cells', 'white blood cells'], defaultUnit: '/HPF', description: 'Urine white cells per high-power field', valueType: 'numeric' },
  { markerKey: 'urine_epithelial_cells', canonicalName: 'Epithelial Cells', category: 'Urine Microscopy', aliases: ['epithelial cells', 'epithelial cell', 'non squamous epithelial cells'], defaultUnit: '/HPF', description: 'Urine epithelial cells per high-power field', valueType: 'numeric' },
  { markerKey: 'urine_hyaline_casts', canonicalName: 'Hyaline Casts', category: 'Urine Microscopy', aliases: ['hyaline casts', 'hyaline cast'], defaultUnit: '/HPF', description: 'Urine hyaline casts per high-power field', valueType: 'numeric' },
  { markerKey: 'urine_pathological_casts', canonicalName: 'Pathological Casts', category: 'Urine Microscopy', aliases: ['pathological casts', 'pathological cast', 'granular casts'], defaultUnit: '/HPF', description: 'Urine pathological casts per high-power field', valueType: 'numeric' },
  { markerKey: 'urine_crystals', canonicalName: 'Crystals', category: 'Urine Microscopy', aliases: ['crystals', 'crystal'], defaultUnit: '/HPF', description: 'Urine crystals per high-power field', valueType: 'numeric' },
]

async function main() {
  console.log('Seeding marker definitions...')
  for (const m of markers) {
    const valueType = (m as { valueType?: string }).valueType ?? 'numeric'
    await prisma.markerDefinition.upsert({
      where: { markerKey: m.markerKey },
      update: { canonicalName: m.canonicalName, category: m.category, aliases: JSON.stringify(m.aliases), defaultUnit: m.defaultUnit, description: m.description, valueType },
      create: { markerKey: m.markerKey, canonicalName: m.canonicalName, category: m.category, aliases: JSON.stringify(m.aliases), defaultUnit: m.defaultUnit, description: m.description, valueType },
    })
  }
  console.log(`Seeded ${markers.length} markers.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
