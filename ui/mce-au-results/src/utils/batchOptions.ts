export type BatchSelectOption = {
  value: string;
  label: string;
};

const createBatchLabel = (batchYear: string) => {
  const shortYear = batchYear.slice(-2);
  return `${batchYear} (${shortYear})`;
};

const createFallbackYears = (yearsBack = 8): string[] => {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: yearsBack + 1 }, (_item, index) =>
    String(currentYear - index),
  );
};

export const buildBatchSelectOptions = (
  availableBatches: string[],
): BatchSelectOption[] => {
  const source =
    availableBatches.length > 0 ? availableBatches : createFallbackYears();

  const uniqueYears = Array.from(
    new Set(
      source
        .map((value) => value.trim())
        .filter((value) => /^\d{4}$/.test(value)),
    ),
  ).sort((left, right) => Number(right) - Number(left));

  return uniqueYears.map((batchYear) => ({
    value: batchYear,
    label: createBatchLabel(batchYear),
  }));
};
