import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiCheckRecipeUrl } from "@/api/client";
import {
  buildGoogleRecipeSearchUrl,
  hostnameForSiteSearch,
} from "@/lib/recipeSearchUrl";

type Props = {
  title: string;
  source: string;
  url: string | null;
};

export default function RecipeSourceLink({ title, source, url }: Props) {
  const { t } = useTranslation("recipe");
  const [linkHref, setLinkHref] = useState<string>(() =>
    url ?? buildGoogleRecipeSearchUrl(title, source, hostnameForSiteSearch(url))
  );
  const [linkLabel, setLinkLabel] = useState(() =>
    url ? t("viewSource") : t("searchWeb")
  );

  useEffect(() => {
    if (!url) {
      setLinkHref(buildGoogleRecipeSearchUrl(title, source, null));
      setLinkLabel(t("searchWeb"));
      return;
    }
    setLinkHref(url);
    setLinkLabel(t("viewSource"));

    let cancelled = false;
    void (async () => {
      try {
        const result = await apiCheckRecipeUrl(url);
        if (cancelled) return;
        if (
          result.determined &&
          (result.status === 404 || result.status === 410)
        ) {
          setLinkHref(
            buildGoogleRecipeSearchUrl(title, source, hostnameForSiteSearch(url))
          );
          setLinkLabel(t("searchBroken"));
        }
      } catch {
        if (!cancelled) {
          /* réseau ou session : on garde le lien d’origine */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, title, source, t]);

  const titleAttr =
    url && linkHref !== url ? t("brokenUrlTitle") : undefined;

  return (
    <>
      {" · "}
      <a href={linkHref} target="_blank" rel="noreferrer" title={titleAttr}>
        {linkLabel}
      </a>
    </>
  );
}
