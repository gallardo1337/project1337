export const TAG_CATEGORY_ORDER = ["haircolor", "place", "finish"];

const TAG_CATEGORY_LABELS = {
  haircolor: "Color",
  place: "Place",
  finish: "Finish",
};

export function tagCategoryRank(category) {
  const index = TAG_CATEGORY_ORDER.indexOf(category);
  return index === -1 ? TAG_CATEGORY_ORDER.length : index;
}

export function tagCategoryLabel(category) {
  return TAG_CATEGORY_LABELS[category] || "Ohne Kategorie";
}

export function isCategorizedTag(tag) {
  return TAG_CATEGORY_ORDER.includes(tag?.category);
}

export function sortTagsByCategory(tags = []) {
  return [...tags].sort(
    (left, right) =>
      tagCategoryRank(left.category) - tagCategoryRank(right.category) ||
      (left.name || "").localeCompare(right.name || "", "de", {
        sensitivity: "base",
      })
  );
}

export function prioritizeTagIds(value, tags = []) {
  const categoryById = new Map(
    tags.map((tag) => [String(tag.id), tagCategoryRank(tag.category)])
  );

  return (Array.isArray(value) ? value : [])
    .map((tagId, index) => ({
      tagId: String(tagId),
      index,
      categoryRank: categoryById.get(String(tagId)) ?? TAG_CATEGORY_ORDER.length,
    }))
    .sort(
      (left, right) =>
        left.categoryRank - right.categoryRank || left.index - right.index
    )
    .map(({ tagId }) => tagId);
}
