import React from "react";
import { Ad, resolveAdImageSrc } from "../types";
import { trackEvent } from "../lib/gtag";
import { Image as ImageIcon } from "lucide-react";

interface PublicAdCardProps {
  key?: React.Key;
  ad: Ad;
  position: string;
  onImageError: (id: string) => void;
}

export default function PublicAdCard({ ad, position, onImageError }: PublicAdCardProps) {
  // Extract and apply fallbacks as instructed
  const publicTitle = ad.publicTitle || "";
  const description = ad.description || "";
  const buttonText = ad.buttonText || "Saiba mais";
  
  let format = ad.format || "medium_rectangle";
  if (format === "automatic") {
    format = "auto";
  }
  if (format === "horizontal_large") {
    format = "wide_banner";
  }
  
  // Auto-detect and override format to "wide_banner" (970x250) if the imageUrl contains 970x250/970_por_250 patterns
  if (
    ad.imageUrl && 
    (ad.imageUrl.includes("970_por_250") || ad.imageUrl.includes("970x250") || ad.imageUrl.includes("970-250"))
  ) {
    format = "wide_banner";
  }
  
  const destinationUrl = ad.destinationUrl || "";
  const altText = ad.altText || ad.title || "Anúncio";

  // Check if link is external
  const isExternal = destinationUrl.startsWith("http://") || destinationUrl.startsWith("https://") || destinationUrl.startsWith("//");

  // Track event click
  const handleClick = () => {
    trackEvent("ad_click", { ad_id: ad.id, ad_position: position, destination_url: destinationUrl });
  };

  const hasImage = !!(ad.imageUrl || ad.storagePath);
  
  // Robust dual-strategy URL configuration:
  // 1. Preferred (Proxy): ALWAYS prefer the local Express server proxy first if storagePath is available.
  // This avoids mixed content issues, bypasses iframe sandboxes, CORS blocks, and external domain AdBlockers.
  // 2. Alternative (Direct): Fallback to direct public R2 CDN url.
  const preferredSrc = resolveAdImageSrc(ad);

  const alternativeSrc = ad.storagePath && ad.imageUrl && (ad.imageUrl.startsWith("http://") || ad.imageUrl.startsWith("https://"))
    ? ad.imageUrl
    : "";

  const [currentSrc, setCurrentSrc] = React.useState(preferredSrc);
  const [hasFailedOnce, setHasFailedOnce] = React.useState(false);

  // Synchronize component state if ad changes (e.g. edited inline without full remount)
  React.useEffect(() => {
    const preferred = resolveAdImageSrc(ad);
    setCurrentSrc(preferred);
    setHasFailedOnce(false);
  }, [ad.imageUrl, ad.storagePath]);

  const handleImageError = () => {
    if (!hasFailedOnce && alternativeSrc && currentSrc !== alternativeSrc) {
      console.warn(`[ADS] Primary image load failed for ad ${ad.id}. Swapping to alternative URL: ${alternativeSrc}`);
      setCurrentSrc(alternativeSrc);
      setHasFailedOnce(true);
    } else {
      if (ad.id !== "preview") {
        console.error(`[ADS ERROR] Failed to load image for ad: ${ad.id}`, ad);
        onImageError(ad.id);
      }
    }
  };

  const isHorizontalArea = ["below_how_it_works", "below_pdf_tools", "page_bottom"].includes(position);
  const isWideFormat = format === "wide_banner" || format === "horizontal_banner" || format === "horizontal_rectangle" || isHorizontalArea;

  // Compute dimensions for custom format
  const sidebarPositions = ["sidebar_top", "sidebar_middle", "sidebar_bottom"];
  const isSidebar = sidebarPositions.includes(position);
  const widthVal = ad.customWidth !== undefined && ad.customWidth !== null ? ad.customWidth : (isSidebar ? 340 : 1100);
  const heightVal = ad.customHeight !== undefined && ad.customHeight !== null ? ad.customHeight : 250;

  const isWideBanner = format === "wide_banner" || (widthVal === 970 && heightVal === 250) || (ad.imageUrl && (ad.imageUrl.includes("970_por_250") || ad.imageUrl.includes("970x250") || ad.imageUrl.includes("970-250")));

  // Shared Image Element with strict styling specifications (prevents stretching/distortion)
  const ImageElement = hasImage ? (
    <img
      src={currentSrc}
      alt={altText}
      loading="lazy"
      style={{
        width: "100%",
        height: format === "auto" ? "auto" : "100%",
        objectFit: "contain",
        objectPosition: "center",
        display: "block",
      }}
      className={isWideBanner || format === "auto" ? "" : "transition-transform duration-300 group-hover:scale-[1.015]"}
      referrerPolicy="no-referrer"
      onError={handleImageError}
    />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center bg-card-inner border border-dashed border-border-main text-text-muted gap-2 p-4 min-h-[120px]">
      <ImageIcon className="h-6 w-6 stroke-[1.5]" />
      <span className="text-[10px] font-bold uppercase tracking-wider">Sem Imagem</span>
    </div>
  );
  // ----------------------------------------------------
  // LAYOUT RENDERER BY SELECTED FORMAT
  // ----------------------------------------------------

  // A. Image-Only Card (No title and no description)
  // Renders a clean image-only layout to avoid distortion and remove unused margins or headers/footers
  if (!publicTitle && !description) {
    const customStyle = format === "auto"
      ? { width: "min(970px, 100%)", aspectRatio: "auto", marginInline: "auto", overflow: "hidden", padding: "0", height: "auto" }
      : isWideBanner
        ? { width: "min(970px, 100%)", aspectRatio: "970 / 250", marginInline: "auto", overflow: "hidden", padding: "0" }
        : format === "custom" 
          ? { maxWidth: `${widthVal}px`, maxHeight: `${heightVal}px`, width: "100%", height: "auto" }
          : format === "square"
            ? { width: "100%", maxWidth: "340px", aspectRatio: "1/1" }
            : format === "medium_rectangle"
              ? { width: "100%", maxWidth: "340px", aspectRatio: "300/250" }
              : format === "horizontal_banner" || format === "horizontal_rectangle"
                ? { width: "100%", maxWidth: "728px", aspectRatio: "728/90" }
                : format === "wide_banner" || isHorizontalArea
                  ? { width: "100%", maxWidth: "970px", aspectRatio: "970/250" }
                  : { width: "100%", maxWidth: "340px", aspectRatio: "300/250" }; // fallback

    return (
      <div 
        style={customStyle}
        className="w-full bg-[#0a0d12] border border-border-main hover:border-green-primary rounded-[20px] overflow-hidden transition-all duration-300 shadow-md relative group flex items-center justify-center"
      >
        {destinationUrl ? (
          <a
            href={destinationUrl}
            target={isExternal ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full h-full cursor-pointer"
            onClick={handleClick}
          >
            {ImageElement}
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
        )}
      </div>
    );
  }

  // B. Custom Format with Text
  if (format === "custom") {
    const calculatedAspect = `${widthVal}/${heightVal}`;
    const isWide = widthVal >= 600;

    if (isWide) {
      // Horizontal Custom Layout for wide formats - Stacked for full visibility
      return (
        <div 
          style={{ maxWidth: `${widthVal}px` }}
          className="w-full bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group"
        >
          <div 
            style={{ aspectRatio: calculatedAspect }}
            className="w-full bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center"
          >
            {destinationUrl ? (
              <a
                href={destinationUrl}
                target={isExternal ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="block w-full h-full cursor-pointer"
                onClick={handleClick}
              >
                {ImageElement}
              </a>
            ) : (
              <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1 text-left min-w-0 flex-1">
              {publicTitle && (
                <h4 className="font-display font-extrabold text-[15px] text-text-main leading-tight tracking-tight">
                  {publicTitle}
                </h4>
              )}
              {description && (
                <p className="text-xs text-text-sec font-medium leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {destinationUrl && (
              <div className="shrink-0">
                <a
                  href={destinationUrl}
                  target={isExternal ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  onClick={handleClick}
                >
                  <button className="w-full sm:w-auto bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:scale-[1.01]">
                    {buttonText}
                  </button>
                </a>
              </div>
            )}
          </div>
        </div>
      );
    } else {
      // Vertical Custom Layout for narrow/square formats
      return (
        <div 
          style={{ maxWidth: `${widthVal}px` }}
          className="w-full bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group"
        >
          <div 
            style={{ aspectRatio: calculatedAspect }}
            className="w-full bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center"
          >
            {destinationUrl ? (
              <a
                href={destinationUrl}
                target={isExternal ? "_blank" : "_self"}
                rel="noopener noreferrer"
                className="block w-full h-full cursor-pointer"
                onClick={handleClick}
              >
                {ImageElement}
              </a>
            ) : (
              <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
            )}
          </div>
          
          {(publicTitle || description) && (
            <div className="space-y-1.5 min-w-0 text-left">
              {publicTitle && (
                <h4 className="font-display font-extrabold text-[14px] text-text-main leading-snug tracking-tight">
                  {publicTitle}
                </h4>
              )}
              {description && (
                <p className="text-xs text-text-sec font-medium leading-relaxed">
                  {description}
                </p>
              )}
            </div>
          )}

          {destinationUrl && (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full mt-auto"
              onClick={handleClick}
            >
              <button className="w-full bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-colors duration-200 shadow-sm hover:scale-[1.01]">
                {buttonText}
              </button>
            </a>
          )}
        </div>
      );
    }
  }

  // 1. Horizontal Card (Image left, text/button right)
  if (format === "horizontal_card") {
    return (
      <div className="w-full bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col md:flex-row gap-5 transition-all duration-300 shadow-md relative group">
        <div className="w-full md:w-2/5 shrink-0 bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center aspect-[300/200] max-h-[220px]">
          {destinationUrl ? (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full h-full cursor-pointer"
              onClick={handleClick}
            >
              {ImageElement}
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
          <div className="space-y-2">
            {publicTitle && (
              <h4 className="font-display font-extrabold text-[15px] text-text-main leading-snug tracking-tight text-left">
                {publicTitle}
              </h4>
            )}
            {description && (
              <p className="text-xs text-text-sec font-medium leading-relaxed text-left">
                {description}
              </p>
            )}
          </div>
          {destinationUrl && (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="inline-block mt-4 w-full md:w-auto"
              onClick={handleClick}
            >
              <button className="w-full md:w-auto bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs py-2.5 px-6 rounded-xl cursor-pointer transition-colors duration-200 shadow-sm">
                {buttonText}
              </button>
            </a>
          )}
        </div>
      </div>
    );
  }

  // 2. Horizontal Wide Banners (728x90 or 970x250) with text
  if (format === "wide_banner") {
    return (
      <div className="w-full max-w-[970px] bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group">
        {/* Banner image container with precise 970/250 aspect ratio */}
        <div className="w-full aspect-[970/250] bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center">
          {destinationUrl ? (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full h-full cursor-pointer"
              onClick={handleClick}
            >
              {ImageElement}
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
          )}
        </div>

        {/* Info row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="space-y-1 text-left min-w-0 flex-1">
            {publicTitle && (
              <h4 className="font-display font-extrabold text-[15px] md:text-lg text-text-main leading-tight tracking-tight">
                {publicTitle}
              </h4>
            )}
            {description && (
              <p className="text-xs md:text-sm text-text-sec font-medium leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {destinationUrl && (
            <div className="shrink-0">
              <a
                href={destinationUrl}
                target={isExternal ? "_blank" : "_self"}
                rel="noopener noreferrer"
                onClick={handleClick}
              >
                <button className="w-full sm:w-auto bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs md:text-sm py-2.5 px-6 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:scale-[1.01]">
                  {buttonText}
                </button>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (format === "horizontal_banner" || format === "horizontal_rectangle") {
    return (
      <div className="w-full max-w-[728px] bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group">
        {/* Banner image container with precise 728/90 aspect ratio */}
        <div className="w-full aspect-[728/90] bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center">
          {destinationUrl ? (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full h-full cursor-pointer"
              onClick={handleClick}
            >
              {ImageElement}
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
          )}
        </div>

        {/* Info row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="space-y-1 text-left min-w-0 flex-1">
            {publicTitle && (
              <h4 className="font-display font-extrabold text-[14px] md:text-base text-text-main leading-tight tracking-tight">
                {publicTitle}
              </h4>
            )}
            {description && (
              <p className="text-xs text-text-sec font-medium leading-relaxed">
                {description}
              </p>
            )}
          </div>
          {destinationUrl && (
            <div className="shrink-0">
              <a
                href={destinationUrl}
                target={isExternal ? "_blank" : "_self"}
                rel="noopener noreferrer"
                onClick={handleClick}
              >
                <button className="w-full sm:w-auto bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs py-2.5 px-5 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:scale-[1.01]">
                  {buttonText}
                </button>
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (format === "auto") {
    return (
      <div className="w-full max-w-[970px] bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group mx-auto">
        {/* Banner image container with auto aspect ratio and auto height */}
        <div className="w-full bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center h-auto">
          {destinationUrl ? (
            <a
              href={destinationUrl}
              target={isExternal ? "_blank" : "_self"}
              rel="noopener noreferrer"
              className="block w-full h-full cursor-pointer"
              onClick={handleClick}
            >
              {ImageElement}
            </a>
          ) : (
            <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
          )}
        </div>

        {/* Info row */}
        {(publicTitle || description) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1 text-left min-w-0 flex-1">
              {publicTitle && (
                <h4 className="font-display font-extrabold text-[15px] md:text-lg text-text-main leading-tight tracking-tight">
                  {publicTitle}
                </h4>
              )}
              {description && (
                <p className="text-xs md:text-sm text-text-sec font-medium leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            {destinationUrl && (
              <div className="shrink-0">
                <a
                  href={destinationUrl}
                  target={isExternal ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  onClick={handleClick}
                >
                  <button className="w-full sm:w-auto bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs md:text-sm py-2.5 px-6 rounded-xl cursor-pointer transition-all duration-200 shadow-sm hover:scale-[1.01]">
                    {buttonText}
                  </button>
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // 3. Vertical & Compact Formats: Square, Medium Rectangle, Auto
  const isSquare = format === "square";
  const isMediumRectangle = format === "medium_rectangle";

  const containerWidthClass = "w-full max-w-full md:max-w-[340px] lg:max-w-none";
  const imageContainerStyle = isSquare 
    ? { aspectRatio: "1/1", width: "100%" } 
    : isMediumRectangle 
      ? { aspectRatio: "300/250", width: "100%" } 
      : { aspectRatio: "300/250", width: "100%" }; // 300/250 as high quality default

  return (
    <div className={`bg-card-main border border-border-main hover:border-green-primary rounded-[20px] p-5 flex flex-col gap-4 transition-all duration-300 shadow-md relative group ${containerWidthClass}`}>
      <div 
        style={imageContainerStyle}
        className="w-full bg-[#0a0d12] rounded-xl overflow-hidden flex items-center justify-center"
      >
        {destinationUrl ? (
          <a
            href={destinationUrl}
            target={isExternal ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="block w-full h-full cursor-pointer"
            onClick={handleClick}
          >
            {ImageElement}
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">{ImageElement}</div>
        )}
      </div>
      
      {(publicTitle || description) && (
        <div className="space-y-1.5 min-w-0 text-left">
          {publicTitle && (
            <h4 className="font-display font-extrabold text-[14px] md:text-[15px] text-text-main leading-snug tracking-tight">
              {publicTitle}
            </h4>
          )}
          {description && (
            <p className="text-xs md:text-[13px] text-text-sec font-medium leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}

      {destinationUrl && (
        <a
          href={destinationUrl}
          target={isExternal ? "_blank" : "_self"}
          rel="noopener noreferrer"
          className="block w-full mt-auto"
          onClick={handleClick}
        >
          <button className="w-full bg-green-primary hover:bg-green-dark text-bg-main font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer transition-colors duration-200 shadow-sm hover:scale-[1.01]">
            {buttonText}
          </button>
        </a>
      )}
    </div>
  );
}
