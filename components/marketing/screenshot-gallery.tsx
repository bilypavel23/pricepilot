"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenshotGalleryProps {
  images: string[];
  alt?: string;
}

export function ScreenshotGallery({ images, alt = "Screenshot" }: ScreenshotGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showArrows, setShowArrows] = useState(false);

  // Keyboard navigation
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      } else if (e.key === "ArrowLeft") {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, images.length]);

  // Disable body scroll when modal is open
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isFullscreen]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleDotClick = (index: number) => {
    setCurrentIndex(index);
  };

  const handleImageClick = () => {
    setIsFullscreen(true);
  };

  const handleCloseFullscreen = (e: React.MouseEvent) => {
    // Close if clicking on the backdrop (not the image)
    if (e.target === e.currentTarget) {
      setIsFullscreen(false);
    }
  };

  const currentImage = images[currentIndex];

  return (
    <>
      {/* Inline Gallery */}
      <div
        className="relative rounded-xl bg-slate-900/50 border border-slate-800 p-8 min-h-[400px] flex items-center justify-center group"
        onMouseEnter={() => setShowArrows(true)}
        onMouseLeave={() => setShowArrows(false)}
      >
        {/* Left Arrow */}
        {showArrows && (
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white transition-opacity opacity-0 group-hover:opacity-100"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <div
          className="relative w-full max-w-5xl cursor-pointer"
          onClick={handleImageClick}
        >
          <Image
            src={currentImage}
            alt={`${alt} ${currentIndex + 1}`}
            width={1200}
            height={800}
            className="rounded-lg object-contain w-full h-auto shadow-2xl"
            priority={currentIndex === 0}
          />
        </div>

        {/* Right Arrow */}
        {showArrows && (
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white transition-opacity opacity-0 group-hover:opacity-100"
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Dot Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentIndex
                  ? "bg-blue-500 w-8"
                  : "bg-slate-600 hover:bg-slate-500"
              )}
              aria-label={`Go to screenshot ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseFullscreen}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white z-20"
            aria-label="Close fullscreen"
          >
            <X className="h-6 w-6" />
          </button>

          {/* Left Arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white z-20"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="h-8 w-8" />
          </button>

          {/* Image */}
          <div
            className="relative max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={currentImage}
              alt={`${alt} ${currentIndex + 1}`}
              width={1920}
              height={1080}
              className="rounded-lg object-contain w-full h-full max-h-[90vh] shadow-2xl"
            />
          </div>

          {/* Right Arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-white z-20"
            aria-label="Next screenshot"
          >
            <ChevronRight className="h-8 w-8" />
          </button>

          {/* Dot Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDotClick(index);
                }}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  index === currentIndex
                    ? "bg-blue-500 w-8"
                    : "bg-slate-600 hover:bg-slate-500"
                )}
                aria-label={`Go to screenshot ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

