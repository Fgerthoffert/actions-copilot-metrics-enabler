/**
 * Extracts a composite group key from a totals_by_X item based on the category.
 * For single-key categories (ide, feature) returns the value directly.
 * For composite categories (language_feature, etc.) joins with " / ".
 */

const categoryKeyFields: Record<string, string[]> = {
  totals_by_ide: ['ide'],
  totals_by_feature: ['feature'],
  totals_by_language_feature: ['language', 'feature'],
  totals_by_language_model: ['language', 'model'],
  totals_by_model_feature: ['model', 'feature']
}

export const getGroupKey = (
  category: string,
  item: Record<string, unknown>
): string => {
  const fields = categoryKeyFields[category] || []
  return fields.map((f) => String(item[f] || 'unknown')).join(' / ')
}
