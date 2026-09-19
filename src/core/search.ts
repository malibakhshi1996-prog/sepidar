export function normalizePersianSearch(input: string): string {
  return input
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[\u200c\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR')
}

export function matchesPersianQuery(fields: string[], query: string): boolean {
  const normalizedQuery = normalizePersianSearch(query)
  if (!normalizedQuery) return true
  return fields.some((field) => normalizePersianSearch(field).replace(/ /g, '').includes(normalizedQuery.replace(/ /g, '')))
}
