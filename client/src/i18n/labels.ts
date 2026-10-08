import { useTranslation } from "react-i18next";

const AISLE_KEYS: Record<string, string> = {
  "Fruits & Légumes": "aisles.fruitsLegumes",
  "Viandes & Poissons": "aisles.viandesPoissons",
  "Frais & Laitier": "aisles.fraisLaitier",
  "Épicerie Salée": "aisles.epicerieSalee",
  "Épicerie Sucrée": "aisles.epicerieSucree",
  Boulangerie: "aisles.boulangerie",
  Surgelés: "aisles.surgeles",
  Boissons: "aisles.boissons",
  "Hygiène & Beauté": "aisles.hygieneBeaute",
  Divers: "aisles.divers",
};

const UNIT_KEYS: Record<string, string> = {
  pièce: "units.piece",
  pincée: "units.pinch",
  càs: "units.tbsp",
  càc: "units.tsp",
};

export function useCatalogLabels() {
  const { t } = useTranslation("common");
  return {
    aisleLabel: (aisle: string) => {
      const key = AISLE_KEYS[aisle];
      return key ? t(key) : aisle;
    },
    unitLabel: (unit: string) => {
      const key = UNIT_KEYS[unit];
      return key ? t(key) : unit;
    },
  };
}
