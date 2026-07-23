/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface VideoPreviewProps {
  file: File;
}

export default function VideoPreview({ file }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setVideoUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.error("Play error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div className="bg-card-main border border-border-main rounded-[20px] p-4 md:p-5 space-y-3">
      <h5 className="text-xs font-bold text-text-sec uppercase tracking-wider flex items-center gap-2">
        <span>Prévia do Vídeo</span>
      </h5>

      <div className="relative rounded-xl overflow-hidden bg-black/60 border border-border-main/80 aspect-video max-h-56 mx-auto flex items-center justify-center">
        {videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            onEnded={() => setIsPlaying(false)}
            controls
          />
        )}
      </div>
    </div>
  );
}
